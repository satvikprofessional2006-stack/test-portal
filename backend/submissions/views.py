"""Submissions + execution views."""

import logging
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsStudent
from sessions.views import get_active_session
from execution.models import ExecutionJob
from .models import Submission, SubmissionVerdict, RunRequest
from .serializers import (
    RunCodeSerializer,
    SubmitCodeSerializer,
    SubmissionSerializer,
    RunRequestSerializer,
    AdminSubmissionSerializer,
)

logger = logging.getLogger(__name__)


class RunCodeView(APIView):
    """
    POST /api/v1/submissions/run/
    Queue a run-code request (not graded, custom stdin).
    Returns run_request_id for polling.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active exam session."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if session.is_expired:
            session.time_out()
            return Response(
                {"success": False, "errors": {"detail": "Exam session expired."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = RunCodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        from exams.models import Question
        try:
            question = Question.objects.get(
                pk=data["question_id"],
                exam=session.enrollment.exam,
            )
        except Question.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Question not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        run = RunRequest.objects.create(
            session=session,
            question=question,
            language=data["language"],
            code=data["code"],
            stdin=data["stdin"],
        )
        job = ExecutionJob.objects.create(
            job_type=ExecutionJob.JobType.RUN,
            run_request=run,
        )

        from execution.tasks import execute_run_request
        task = execute_run_request.apply_async(
            args=[run.pk],
            queue="execution",
        )
        ExecutionJob.objects.filter(pk=job.pk).update(celery_task_id=task.id)
        RunRequest.objects.filter(pk=run.pk).update(celery_task_id=task.id)

        return Response({
            "success": True,
            "data": {"run_request_id": run.pk, "status": "queued"},
        }, status=status.HTTP_202_ACCEPTED)


class RunCodeStatusView(APIView):
    """
    GET /api/v1/submissions/run/{run_id}/
    Poll status of a run-code request.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request, run_id):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active session."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            run = RunRequest.objects.get(pk=run_id, session=session)
        except RunRequest.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Run request not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = RunRequestSerializer(run)
        return Response({"success": True, "data": serializer.data})


class SubmitCodeView(APIView):
    """
    POST /api/v1/submissions/submit/
    Submit code for grading against hidden test cases.
    Validates session is active and within exam window.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active exam session."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if session.is_expired:
            session.time_out()
            return Response(
                {"success": False, "errors": {"detail": "Exam session expired."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Double-check exam window (server-authoritative)
        exam = session.enrollment.exam
        if exam.has_ended:
            return Response(
                {"success": False, "errors": {"detail": "Exam has ended — submission rejected."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        ser = SubmitCodeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        from exams.models import Question
        try:
            question = Question.objects.get(
                pk=data["question_id"],
                exam=exam,
            )
        except Question.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Question not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        sub = Submission.objects.create(
            session=session,
            question=question,
            language=data["language"],
            code=data["code"],
            verdict=SubmissionVerdict.PENDING,
        )
        job = ExecutionJob.objects.create(
            job_type=ExecutionJob.JobType.SUBMIT,
            submission=sub,
        )

        from execution.tasks import execute_submission
        task = execute_submission.apply_async(
            args=[sub.pk],
            queue="execution",
        )
        ExecutionJob.objects.filter(pk=job.pk).update(celery_task_id=task.id)
        Submission.objects.filter(pk=sub.pk).update(celery_task_id=task.id)

        logger.info(
            "Submission %d queued for student %d, question %d, lang %s",
            sub.pk, request.user.pk, question.pk, data["language"],
        )
        return Response({
            "success": True,
            "data": {"submission_id": sub.pk, "status": "queued"},
        }, status=status.HTTP_202_ACCEPTED)


class SubmissionStatusView(APIView):
    """
    GET /api/v1/submissions/{submission_id}/
    Poll status and results of a submission.
    Hidden test-case stdout/expected not exposed to student.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request, submission_id):
        session = get_active_session(request.user)
        if not session:
            # Allow viewing past submissions after session ends
            try:
                sub = Submission.objects.get(
                    pk=submission_id,
                    session__enrollment__student=request.user,
                )
            except Submission.DoesNotExist:
                return Response(
                    {"success": False, "errors": {"detail": "Submission not found."}},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            try:
                sub = Submission.objects.get(pk=submission_id, session=session)
            except Submission.DoesNotExist:
                return Response(
                    {"success": False, "errors": {"detail": "Submission not found."}},
                    status=status.HTTP_404_NOT_FOUND,
                )
        serializer = SubmissionSerializer(sub)
        return Response({"success": True, "data": serializer.data})


class StudentSubmissionListView(generics.ListAPIView):
    """
    GET /api/v1/submissions/my/
    Student's own submissions (all exams).
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = SubmissionSerializer

    def get_queryset(self):
        return Submission.objects.filter(
            session__enrollment__student=self.request.user,
        ).order_by("-submitted_at")


# ─── Admin views ───────────────────────────────────────────────────────────────

class AdminSubmissionListView(generics.ListAPIView):
    """
    GET /api/v1/submissions/?exam_id=&student_id=&verdict=
    Admin: view all submissions with filters.
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminSubmissionSerializer

    def get_queryset(self):
        qs = Submission.objects.select_related(
            "session__enrollment__student",
            "question",
        ).order_by("-submitted_at")

        exam_id = self.request.query_params.get("exam_id")
        if exam_id:
            qs = qs.filter(session__enrollment__exam_id=exam_id)

        student_id = self.request.query_params.get("student_id")
        if student_id:
            qs = qs.filter(session__enrollment__student_id=student_id)

        verdict = self.request.query_params.get("verdict")
        if verdict:
            qs = qs.filter(verdict=verdict)

        return qs
