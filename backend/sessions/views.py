"""
Sessions views.

Student:
  POST /api/v1/sessions/enter/{exam_id}/   — create or resume an ExamSession
  GET  /api/v1/sessions/timer/             — server-authoritative remaining time
  POST /api/v1/sessions/heartbeat/         — keep session alive
  POST /api/v1/sessions/autosave/          — save code draft
  GET  /api/v1/sessions/drafts/{qid}/      — retrieve saved drafts for a question
  POST /api/v1/sessions/complete/          — student finishes exam

Admin:
  GET  /api/v1/sessions/active/            — all active sessions
  POST /api/v1/sessions/{id}/terminate/    — terminate a session
"""

import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin, IsStudent
from exams.models import ExamEnrollment, Exam
from security.models import SecurityEvent, SecurityEventType
from .models import ExamSession, CodeDraft
from .serializers import (
    ExamSessionSerializer,
    AutosaveSerializer,
    HeartbeatSerializer,
    CodeDraftSerializer,
)

logger = logging.getLogger(__name__)


def get_active_session(user):
    """Return the student's currently active exam session, or None."""
    return ExamSession.objects.filter(
        enrollment__student=user,
        status=ExamSession.Status.ACTIVE,
    ).select_related("enrollment__exam", "enrollment__student").first()


class EnterExamView(APIView):
    """
    POST /api/v1/sessions/enter/{exam_id}/

    Creates a new ExamSession or resumes an existing one.
    Enforces:
      - Student must be enrolled
      - Exam must be active (started but not ended)
      - Only one active session per enrollment (idempotent resume on reconnect)
      - IP-range policy (if configured on exam)
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request, exam_id):
        # 1. Enrollment check
        try:
            enrollment = ExamEnrollment.objects.select_related("exam").get(
                exam_id=exam_id,
                student=request.user,
            )
        except ExamEnrollment.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "You are not enrolled in this exam."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        exam = enrollment.exam

        # 2. Exam window check
        if not exam.is_published:
            return Response(
                {"success": False, "errors": {"detail": "Exam is not published."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not exam.has_started:
            return Response(
                {"success": False, "errors": {"detail": "Exam has not started yet."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if exam.has_ended:
            return Response(
                {"success": False, "errors": {"detail": "Exam has ended."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 3. Disqualification check
        if enrollment.status == ExamEnrollment.Status.DISQUALIFIED:
            SecurityEvent.log(
                session=ExamSession.objects.filter(enrollment=enrollment).first(),
                event_type=SecurityEventType.MULTIPLE_SESSION_ATTEMPT,
                payload={"reason": "disqualified student attempted entry"},
                ip_address=self._get_ip(request),
                source="server",
            )
            return Response(
                {"success": False, "errors": {"detail": "Your access has been revoked."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 4. Resume existing active session (idempotent)
        existing = ExamSession.objects.filter(
            enrollment=enrollment,
            status=ExamSession.Status.ACTIVE,
        ).first()

        if existing:
            if existing.is_expired:
                existing.time_out()
                return Response(
                    {"success": False, "errors": {"detail": "Your exam session has expired."}},
                    status=status.HTTP_403_FORBIDDEN,
                )
            # Log IP change if it changed
            current_ip = self._get_ip(request)
            if existing.ip_address and existing.ip_address != current_ip:
                SecurityEvent.log(
                    session=existing,
                    event_type=SecurityEventType.IP_CHANGE,
                    payload={"old_ip": existing.ip_address, "new_ip": current_ip},
                    ip_address=current_ip,
                    source="server",
                )
            existing.touch()
            serializer = ExamSessionSerializer(existing)
            return Response({
                "success": True,
                "data": serializer.data,
                "resumed": True,
            })

        # 5. Check for another active session on a DIFFERENT enrollment (duplicate device)
        other_active = ExamSession.objects.filter(
            enrollment__student=request.user,
            status=ExamSession.Status.ACTIVE,
        ).exclude(enrollment=enrollment).first()

        if other_active:
            SecurityEvent.log(
                session=other_active,
                event_type=SecurityEventType.MULTIPLE_SESSION_ATTEMPT,
                payload={"attempted_exam_id": exam_id},
                ip_address=self._get_ip(request),
                source="server",
            )
            return Response(
                {"success": False, "errors": {"detail": "You already have an active session in another exam."}},
                status=status.HTTP_409_CONFLICT,
            )

        # 6. Create new session
        import datetime
        started_at = timezone.now()
        expires_at = started_at + datetime.timedelta(seconds=exam.duration_seconds)

        session = ExamSession.objects.create(
            enrollment=enrollment,
            started_at=started_at,
            expires_at=expires_at,
            ip_address=self._get_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
            status=ExamSession.Status.ACTIVE,
        )

        # Update enrollment status
        enrollment.status = ExamEnrollment.Status.STARTED
        enrollment.save(update_fields=["status"])

        logger.info(
            "Student %d entered exam %d — session %d created",
            request.user.pk, exam_id, session.pk,
        )

        SecurityEvent.log(
            session=session,
            event_type=SecurityEventType.EXAM_SUBMITTED,  # reuse INFO-level for entry
            payload={"action": "exam_entered"},
            ip_address=self._get_ip(request),
            source="server",
        )

        serializer = ExamSessionSerializer(session)
        return Response({
            "success": True,
            "data": serializer.data,
            "resumed": False,
        }, status=status.HTTP_201_CREATED)

    def _get_ip(self, request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")


class TimerView(APIView):
    """
    GET /api/v1/sessions/timer/
    Returns the server-authoritative time remaining for the active session.
    Clients MUST use this — never trust their own timer.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active exam session."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.is_expired:
            session.time_out()
            return Response({
                "success": True,
                "data": {
                    "seconds_remaining": 0,
                    "status": "timed_out",
                    "server_time": timezone.now().isoformat(),
                },
            })
        return Response({
            "success": True,
            "data": {
                "seconds_remaining": session.seconds_remaining,
                "expires_at": session.expires_at.isoformat(),
                "status": session.status,
                "server_time": timezone.now().isoformat(),
            },
        })


class HeartbeatView(APIView):
    """
    POST /api/v1/sessions/heartbeat/
    Called every 30s by the frontend. Updates last_heartbeat_at.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active session."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.is_expired:
            session.time_out()
            return Response({
                "success": True,
                "data": {"status": "timed_out", "seconds_remaining": 0},
            })

        serializer = HeartbeatSerializer(data=request.data)
        if serializer.is_valid():
            order = serializer.validated_data.get("current_question_order")
            if order:
                ExamSession.objects.filter(pk=session.pk).update(
                    current_question_order=order,
                )

        session.touch()
        return Response({
            "success": True,
            "data": {
                "seconds_remaining": session.seconds_remaining,
                "status": session.status,
            },
        })


class AutosaveView(APIView):
    """
    POST /api/v1/sessions/autosave/
    Upserts a CodeDraft for the current question/language.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active session."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if session.is_expired:
            session.time_out()
            return Response(
                {"success": False, "errors": {"detail": "Session has expired."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AutosaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Validate question belongs to this exam
        from exams.models import Question
        try:
            question = Question.objects.get(
                pk=data["question_id"],
                exam=session.enrollment.exam,
            )
        except Question.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Question not found in this exam."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        # If primary language changed, unset old primary
        if data.get("is_primary_language", True):
            CodeDraft.objects.filter(
                session=session, question=question, is_primary_language=True,
            ).update(is_primary_language=False)

        draft, created = CodeDraft.objects.get_or_create(
            session=session,
            question=question,
            language=data["language"],
            defaults={
                "code": data["code"],
                "is_primary_language": data.get("is_primary_language", True),
            },
        )
        if not created:
            from django.db.models import F
            CodeDraft.objects.filter(pk=draft.pk).update(
                code=data["code"],
                is_primary_language=data.get("is_primary_language", True),
                save_count=F("save_count") + 1,
            )
            draft.refresh_from_db()

        return Response({
            "success": True,
            "data": {
                "saved_at": draft.saved_at.isoformat(),
                "save_count": draft.save_count,
            },
        })


class DraftRetrieveView(APIView):
    """
    GET /api/v1/sessions/drafts/{question_id}/
    Returns all saved drafts for the given question in the active session.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request, question_id):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active session."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        drafts = CodeDraft.objects.filter(
            session=session, question_id=question_id,
        ).order_by("-is_primary_language", "language")
        serializer = CodeDraftSerializer(drafts, many=True)
        return Response({"success": True, "data": serializer.data})


class CompleteExamView(APIView):
    """
    POST /api/v1/sessions/complete/
    Student voluntarily submits/ends the exam.
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active session."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        session.complete()
        enrollment = session.enrollment
        enrollment.status = ExamEnrollment.Status.COMPLETED
        enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=["status", "completed_at"])

        SecurityEvent.log(
            session=session,
            event_type=SecurityEventType.EXAM_SUBMITTED,
            payload={"voluntary": True},
            source="server",
        )
        return Response({"success": True, "data": {"status": "completed"}})


# ─── Admin Views ───────────────────────────────────────────────────────────────

class AdminActiveSessionsView(APIView):
    """
    GET /api/v1/sessions/active/
    Returns all currently active exam sessions (admin monitoring).
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def get(self, request):
        sessions = ExamSession.objects.filter(
            status=ExamSession.Status.ACTIVE,
        ).select_related(
            "enrollment__student", "enrollment__exam",
        ).order_by("enrollment__exam", "started_at")

        data = [
            {
                "session_id": s.pk,
                "student_name": s.enrollment.student.full_name,
                "student_email": s.enrollment.student.email,
                "exam_title": s.enrollment.exam.title,
                "exam_id": s.enrollment.exam_id,
                "started_at": s.started_at.isoformat(),
                "seconds_remaining": s.seconds_remaining,
                "ip_address": s.ip_address,
                "last_heartbeat_at": s.last_heartbeat_at.isoformat(),
            }
            for s in sessions
        ]
        return Response({"success": True, "data": data, "count": len(data)})


class AdminTerminateSessionView(APIView):
    """
    POST /api/v1/sessions/{session_id}/terminate/
    Admin terminates a student's session.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, session_id):
        try:
            session = ExamSession.objects.get(pk=session_id)
        except ExamSession.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        session.status = ExamSession.Status.TERMINATED
        session.completed_at = timezone.now()
        session.save(update_fields=["status", "completed_at"])

        SecurityEvent.log(
            session=session,
            event_type=SecurityEventType.ADMIN_TERMINATED,
            payload={"terminated_by": request.user.pk},
            source="server",
        )
        logger.info(
            "Admin %d terminated session %d", request.user.pk, session_id,
        )
        return Response({"success": True, "data": {"status": "terminated"}})


class AdminExtendSessionView(APIView):
    """
    POST /api/v1/sessions/{session_id}/extend/
    Admin extends time (in minutes) for a student's session.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, session_id):
        import datetime
        try:
            session = ExamSession.objects.get(pk=session_id)
        except ExamSession.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        minutes = int(request.data.get("minutes", 15))
        now = timezone.now()
        base_time = max(session.expires_at, now)
        session.expires_at = base_time + datetime.timedelta(minutes=minutes)
        if session.status in [ExamSession.Status.TIMED_OUT, ExamSession.Status.TERMINATED]:
            session.status = ExamSession.Status.ACTIVE
            session.completed_at = None
        session.save(update_fields=["expires_at", "status", "completed_at"])

        SecurityEvent.log(
            session=session,
            event_type="time_extended",
            payload={"extended_by": request.user.pk, "minutes_added": minutes},
            source="server",
        )
        logger.info("Admin %d extended session %d by %d minutes", request.user.pk, session_id, minutes)
        return Response({
            "success": True,
            "data": {
                "session_id": session.pk,
                "seconds_remaining": session.seconds_remaining,
                "expires_at": session.expires_at.isoformat(),
                "status": session.status,
            }
        })


class AdminResetSessionView(APIView):
    """
    POST /api/v1/sessions/{session_id}/reset/
    Admin resets a student's session/enrollment to allow a clean re-entry.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, session_id):
        try:
            session = ExamSession.objects.get(pk=session_id)
        except ExamSession.DoesNotExist:
            return Response(
                {"success": False, "errors": {"detail": "Session not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        enrollment = session.enrollment
        session.status = ExamSession.Status.TIMED_OUT
        session.completed_at = timezone.now()
        session.save(update_fields=["status", "completed_at"])

        enrollment.status = ExamEnrollment.Status.ENROLLED
        enrollment.completed_at = None
        enrollment.final_score = None
        enrollment.save(update_fields=["status", "completed_at", "final_score"])

        logger.info("Admin %d reset enrollment %d (session %d)", request.user.pk, enrollment.pk, session_id)
        return Response({
            "success": True,
            "data": {"detail": "Session reset. Student may enter the exam afresh."}
        })

