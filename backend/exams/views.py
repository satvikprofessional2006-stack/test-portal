"""
Exam views — student and admin portals.

Student routes:  GET /api/v1/exams/my/               — enrolled exams
                 GET /api/v1/exams/{id}/detail/       — exam detail (for active exam)

Admin routes:    CRUD /api/v1/exams/
                 CRUD /api/v1/exams/{id}/questions/
                 CRUD /api/v1/exams/{id}/questions/{qid}/testcases/
                 POST /api/v1/exams/{id}/enroll/
                 GET  /api/v1/exams/{id}/enrollments/
                 GET  /api/v1/exams/{id}/results/
"""

import logging
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsStudent
from .models import Exam, Question, TestCase, ExamEnrollment
from .serializers import (
    ExamListStudentSerializer,
    ExamDetailStudentSerializer,
    ExamAdminSerializer,
    ExamCreateUpdateSerializer,
    QuestionAdminSerializer,
    QuestionCreateSerializer,
    TestCaseAdminSerializer,
    TestCaseCreateUpdateSerializer,
    EnrollmentAdminSerializer,
    EnrollStudentsSerializer,
)

logger = logging.getLogger(__name__)


# ─── Student Views ─────────────────────────────────────────────────────────────

class StudentExamListView(generics.ListAPIView):
    """
    GET /api/v1/exams/my/
    Returns all exams the authenticated student is enrolled in.
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = ExamListStudentSerializer

    def get_queryset(self):
        return Exam.objects.filter(
            enrollments__student=self.request.user,
            is_published=True,
            is_archived=False,
        ).distinct().order_by("scheduled_start")


class StudentExamDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/exams/{id}/detail/
    Full exam detail including questions (no hidden test cases).
    Only accessible if the student is enrolled and the exam has started.
    """
    permission_classes = [IsAuthenticated, IsStudent]
    serializer_class = ExamDetailStudentSerializer

    def get_queryset(self):
        return Exam.objects.filter(
            enrollments__student=self.request.user,
            is_published=True,
        )

    def retrieve(self, request, *args, **kwargs):
        exam = self.get_object()
        if not exam.has_started:
            return Response(
                {"success": False, "errors": {"detail": "Exam has not started yet."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.get_serializer(exam, context={"request": request})
        return Response({"success": True, "data": serializer.data})


# ─── Admin: Exam CRUD ──────────────────────────────────────────────────────────

class AdminExamListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/exams/          — list all exams (admin)
    POST /api/v1/exams/          — create exam (admin)
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return Exam.objects.all().order_by("-scheduled_start")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return ExamAdminSerializer
        return ExamCreateUpdateSerializer


class AdminExamDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/exams/{id}/    — exam detail (admin)
    PATCH  /api/v1/exams/{id}/    — update exam
    DELETE /api/v1/exams/{id}/    — delete exam
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    queryset = Exam.objects.all()

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return ExamCreateUpdateSerializer
        return ExamAdminSerializer


# ─── Admin: Questions ─────────────────────────────────────────────────────────

class AdminQuestionListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/exams/{exam_id}/questions/
    POST /api/v1/exams/{exam_id}/questions/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_exam(self):
        return Exam.objects.get(pk=self.kwargs["exam_id"])

    def get_queryset(self):
        return Question.objects.filter(exam_id=self.kwargs["exam_id"]).order_by("order")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return QuestionAdminSerializer
        return QuestionCreateSerializer

    def perform_create(self, serializer):
        exam = self.get_exam()
        serializer.save(exam=exam)


class AdminQuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/exams/{exam_id}/questions/{pk}/
    PATCH  /api/v1/exams/{exam_id}/questions/{pk}/
    DELETE /api/v1/exams/{exam_id}/questions/{pk}/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return Question.objects.filter(exam_id=self.kwargs["exam_id"])

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return QuestionCreateSerializer
        return QuestionAdminSerializer


# ─── Admin: Test Cases ────────────────────────────────────────────────────────

class AdminTestCaseListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/exams/{exam_id}/questions/{question_id}/testcases/
    POST /api/v1/exams/{exam_id}/questions/{question_id}/testcases/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return TestCase.objects.filter(
            question_id=self.kwargs["question_id"],
            question__exam_id=self.kwargs["exam_id"],
        ).order_by("order")

    def get_serializer_class(self):
        if self.request.method == "GET":
            return TestCaseAdminSerializer
        return TestCaseCreateUpdateSerializer

    def perform_create(self, serializer):
        question = Question.objects.get(
            pk=self.kwargs["question_id"],
            exam_id=self.kwargs["exam_id"],
        )
        serializer.save(question=question)


class AdminTestCaseDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/v1/exams/{exam_id}/questions/{question_id}/testcases/{pk}/
    PATCH  /api/v1/exams/{exam_id}/questions/{question_id}/testcases/{pk}/
    DELETE /api/v1/exams/{exam_id}/questions/{question_id}/testcases/{pk}/
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        return TestCase.objects.filter(
            question_id=self.kwargs["question_id"],
            question__exam_id=self.kwargs["exam_id"],
        )

    def get_serializer_class(self):
        if self.request.method in ("PATCH", "PUT"):
            return TestCaseCreateUpdateSerializer
        return TestCaseAdminSerializer


# ─── Admin: Enrollment Management ─────────────────────────────────────────────

class AdminEnrollStudentsView(APIView):
    """
    POST /api/v1/exams/{exam_id}/enroll/
    Enroll a list of student IDs into an exam.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, exam_id):
        exam = Exam.objects.get(pk=exam_id)
        serializer = EnrollStudentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from accounts.models import User, UserRole
        student_ids = serializer.validated_data["student_ids"]
        students = User.objects.filter(pk__in=student_ids, role=UserRole.STUDENT)

        enrolled, skipped = [], []
        for student in students:
            _, created = ExamEnrollment.objects.get_or_create(
                exam=exam, student=student,
            )
            if created:
                enrolled.append(student.pk)
            else:
                skipped.append(student.pk)

        logger.info(
            "Admin %d enrolled %d students into exam %d",
            request.user.pk, len(enrolled), exam_id,
        )
        return Response({
            "success": True,
            "data": {"enrolled": enrolled, "already_enrolled": skipped},
        }, status=status.HTTP_201_CREATED)


class AdminEnrollmentListView(generics.ListAPIView):
    """
    GET /api/v1/exams/{exam_id}/enrollments/
    List all enrollments for an exam.
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = EnrollmentAdminSerializer

    def get_queryset(self):
        return ExamEnrollment.objects.filter(
            exam_id=self.kwargs["exam_id"]
        ).select_related("student").order_by("student__full_name")


class AdminExamResultsView(APIView):
    """
    GET /api/v1/exams/{exam_id}/results/
    Returns final scores for all enrolled students.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request, exam_id):
        enrollments = ExamEnrollment.objects.filter(
            exam_id=exam_id
        ).select_related("student").order_by("-final_score")

        data = [
            {
                "student_id": e.student_id,
                "student_name": e.student.full_name,
                "student_email": e.student.email,
                "roll_number": e.student.roll_number,
                "status": e.status,
                "final_score": float(e.final_score) if e.final_score is not None else None,
                "completed_at": e.completed_at,
            }
            for e in enrollments
        ]
        return Response({"success": True, "data": data})
