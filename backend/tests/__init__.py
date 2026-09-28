"""
Milestone 1 tests — model integrity, constraints, and business logic.

Run with:
  DJANGO_SETTINGS_MODULE=config.settings_local python manage.py test tests.test_m1_models -v2
"""

import datetime
from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from accounts.models import User, UserRole
from exams.models import Exam, Question, TestCase as TC, ExamEnrollment, Language
from sessions.models import ExamSession, CodeDraft
from submissions.models import Submission, SubmissionVerdict, RunRequest
from execution.models import ExecutionJob
from security.models import SecurityEvent, SecurityEventType, SecurityEventSeverity


def make_admin(**kwargs):
    return User.objects.create_superuser(
        email=kwargs.get("email", "admin@test.com"),
        password="Admin@1234",
        full_name=kwargs.get("full_name", "Admin"),
    )


def make_student(**kwargs):
    return User.objects.create_user(
        email=kwargs.get("email", "student@test.com"),
        password="Student@1234",
        full_name=kwargs.get("full_name", "Student"),
        role=UserRole.STUDENT,
    )


def make_exam(admin, **kwargs):
    return Exam.objects.create(
        title=kwargs.get("title", "Test Exam"),
        scheduled_start=timezone.now() - datetime.timedelta(minutes=5),
        scheduled_end=timezone.now() + datetime.timedelta(hours=2),
        duration_seconds=kwargs.get("duration_seconds", 7200),
        allowed_languages=[Language.PYTHON3],
        created_by=admin,
        is_published=True,
    )


def make_question(exam, order=1):
    return Question.objects.create(
        exam=exam, order=order, title=f"Q{order}",
        statement="Solve this.", marks=10,
        time_limit_ms=1000, memory_limit_mb=64,
    )


def make_session(enrollment):
    return ExamSession.objects.create(
        enrollment=enrollment,
        started_at=timezone.now(),
        expires_at=timezone.now() + datetime.timedelta(hours=2),
        ip_address="127.0.0.1",
    )


class UserModelTests(TestCase):

    def test_create_student(self):
        u = make_student(email="s1@test.com")
        self.assertEqual(u.role, UserRole.STUDENT)
        self.assertFalse(u.is_staff)
        self.assertFalse(u.is_admin)
        self.assertTrue(u.is_student)

    def test_create_admin(self):
        a = make_admin(email="a1@test.com")
        self.assertEqual(a.role, UserRole.ADMIN)
        self.assertTrue(a.is_staff)
        self.assertTrue(a.is_admin)

    def test_email_unique(self):
        make_student(email="dup@test.com")
        with self.assertRaises(IntegrityError):
            make_student(email="dup@test.com")

    def test_str(self):
        u = make_student(email="str@test.com", full_name="Jane Doe")
        self.assertIn("Jane Doe", str(u))
        self.assertIn("str@test.com", str(u))


class ExamModelTests(TestCase):

    def setUp(self):
        self.admin = make_admin()

    def test_exam_is_active(self):
        exam = make_exam(self.admin)
        self.assertTrue(exam.is_active)

    def test_exam_not_started(self):
        exam = Exam.objects.create(
            title="Future Exam",
            scheduled_start=timezone.now() + datetime.timedelta(hours=1),
            scheduled_end=timezone.now() + datetime.timedelta(hours=3),
            duration_seconds=7200,
            allowed_languages=[Language.PYTHON3],
            created_by=self.admin,
        )
        self.assertFalse(exam.has_started)
        self.assertFalse(exam.is_active)

    def test_exam_ended(self):
        exam = Exam.objects.create(
            title="Past Exam",
            scheduled_start=timezone.now() - datetime.timedelta(hours=3),
            scheduled_end=timezone.now() - datetime.timedelta(hours=1),
            duration_seconds=7200,
            allowed_languages=[Language.PYTHON3],
            created_by=self.admin,
        )
        self.assertTrue(exam.has_ended)
        self.assertFalse(exam.is_active)

    def test_exam_clean_end_before_start(self):
        exam = Exam(
            title="Bad Exam",
            scheduled_start=timezone.now() + datetime.timedelta(hours=2),
            scheduled_end=timezone.now() + datetime.timedelta(hours=1),
            duration_seconds=3600,
            allowed_languages=[Language.PYTHON3],
            created_by=self.admin,
        )
        with self.assertRaises(ValidationError):
            exam.clean()

    def test_question_order_unique_per_exam(self):
        exam = make_exam(self.admin)
        make_question(exam, order=1)
        with self.assertRaises(IntegrityError):
            make_question(exam, order=1)


class TestCaseModelTests(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.exam = make_exam(self.admin)
        self.q = make_question(self.exam)

    def test_effective_limits_use_question_defaults(self):
        tc = TC.objects.create(
            question=self.q, input_data="1 2", expected_output="3", is_hidden=True,
        )
        self.assertEqual(tc.effective_time_limit_ms(), self.q.time_limit_ms)
        self.assertEqual(tc.effective_memory_limit_mb(), self.q.memory_limit_mb)

    def test_effective_limits_respect_override(self):
        tc = TC.objects.create(
            question=self.q, input_data="1 2", expected_output="3",
            is_hidden=True, time_limit_ms=500, memory_limit_mb=32,
        )
        self.assertEqual(tc.effective_time_limit_ms(), 500)
        self.assertEqual(tc.effective_memory_limit_mb(), 32)


class EnrollmentTests(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.student = make_student()
        self.exam = make_exam(self.admin)

    def test_enrollment_unique_per_student_exam(self):
        ExamEnrollment.objects.create(exam=self.exam, student=self.student)
        with self.assertRaises(IntegrityError):
            ExamEnrollment.objects.create(exam=self.exam, student=self.student)


class ExamSessionTests(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.student = make_student()
        self.exam = make_exam(self.admin)
        self.enrollment = ExamEnrollment.objects.create(exam=self.exam, student=self.student)

    def test_seconds_remaining_positive(self):
        session = make_session(self.enrollment)
        self.assertGreater(session.seconds_remaining, 0)

    def test_session_not_expired(self):
        session = make_session(self.enrollment)
        self.assertFalse(session.is_expired)

    def test_session_expired(self):
        session = ExamSession.objects.create(
            enrollment=self.enrollment,
            started_at=timezone.now() - datetime.timedelta(hours=3),
            expires_at=timezone.now() - datetime.timedelta(hours=1),
        )
        self.assertTrue(session.is_expired)
        self.assertEqual(session.seconds_remaining, 0)

    def test_session_complete(self):
        session = make_session(self.enrollment)
        session.complete()
        self.assertEqual(session.status, ExamSession.Status.COMPLETED)
        self.assertIsNotNone(session.completed_at)

    def test_session_timeout(self):
        session = make_session(self.enrollment)
        session.time_out()
        self.assertEqual(session.status, ExamSession.Status.TIMED_OUT)

    def test_code_draft_upsert(self):
        session = make_session(self.enrollment)
        q = make_question(self.exam)

        draft, _ = CodeDraft.objects.get_or_create(
            session=session, question=q, language="python3",
            defaults={"code": "print('hello')"},
        )
        self.assertEqual(draft.code, "print('hello')")

        # Simulate autosave update
        CodeDraft.objects.filter(pk=draft.pk).update(
            code="print('world')", save_count=1
        )
        draft.refresh_from_db()
        self.assertEqual(draft.code, "print('world')")


class SubmissionTests(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.student = make_student()
        self.exam = make_exam(self.admin)
        self.enrollment = ExamEnrollment.objects.create(exam=self.exam, student=self.student)
        self.session = make_session(self.enrollment)
        self.q = make_question(self.exam)

    def test_submission_starts_pending(self):
        sub = Submission.objects.create(
            session=self.session, question=self.q,
            language="python3", code="print(1+1)",
        )
        self.assertEqual(sub.verdict, SubmissionVerdict.PENDING)
        self.assertFalse(sub.is_final)

    def test_submission_is_final_when_accepted(self):
        sub = Submission.objects.create(
            session=self.session, question=self.q,
            language="python3", code="print(1+1)",
            verdict=SubmissionVerdict.ACCEPTED,
        )
        self.assertTrue(sub.is_final)

    def test_run_request_created(self):
        run = RunRequest.objects.create(
            session=self.session, question=self.q,
            language="python3", code="print('hi')", stdin="",
        )
        self.assertEqual(run.verdict, SubmissionVerdict.PENDING)

    def test_execution_job_lifecycle(self):
        sub = Submission.objects.create(
            session=self.session, question=self.q,
            language="python3", code="print(1)",
        )
        job = ExecutionJob.objects.create(
            job_type=ExecutionJob.JobType.SUBMIT,
            submission=sub,
        )
        self.assertEqual(job.status, ExecutionJob.JobStatus.QUEUED)

        job.mark_started(worker_id="worker-1")
        self.assertEqual(job.status, ExecutionJob.JobStatus.STARTED)
        self.assertIsNotNone(job.started_at)

        job.mark_completed()
        self.assertEqual(job.status, ExecutionJob.JobStatus.COMPLETED)
        self.assertIsNotNone(job.finished_at)


class SecurityEventTests(TestCase):

    def setUp(self):
        self.admin = make_admin()
        self.student = make_student()
        self.exam = make_exam(self.admin)
        self.enrollment = ExamEnrollment.objects.create(exam=self.exam, student=self.student)
        self.session = make_session(self.enrollment)

    def test_log_tab_switch(self):
        evt = SecurityEvent.log(
            session=self.session,
            event_type=SecurityEventType.TAB_SWITCH,
            ip_address="127.0.0.1",
        )
        self.assertEqual(evt.event_type, SecurityEventType.TAB_SWITCH)
        self.assertEqual(evt.severity, SecurityEventSeverity.MEDIUM)
        self.assertIsNotNone(evt.timestamp)

    def test_log_paste_detected_is_high(self):
        evt = SecurityEvent.log(
            session=self.session,
            event_type=SecurityEventType.PASTE_DETECTED,
        )
        self.assertEqual(evt.severity, SecurityEventSeverity.HIGH)

    def test_event_count(self):
        for _ in range(5):
            SecurityEvent.log(self.session, SecurityEventType.WINDOW_BLUR)
        self.assertEqual(
            SecurityEvent.objects.filter(session=self.session).count(), 5
        )
