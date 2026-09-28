"""
Milestone 2 API tests — authentication, session management, exam access.

Run with:
  DJANGO_SETTINGS_MODULE=config.settings_local python manage.py test tests.test_m2_api -v2
"""

import datetime
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User, UserRole
from exams.models import Exam, Question, TestCase as TC, ExamEnrollment, Language
from sessions.models import ExamSession, CodeDraft
from security.models import SecurityEvent, SecurityEventType


def make_admin(email="admin@test.com"):
    return User.objects.create_superuser(
        email=email, password="Admin@1234", full_name="Admin User"
    )


def make_student(email="student@test.com"):
    return User.objects.create_user(
        email=email, password="Student@1234",
        full_name="Test Student", role=UserRole.STUDENT,
    )


def make_active_exam(admin):
    return Exam.objects.create(
        title="Active Exam",
        scheduled_start=timezone.now() - datetime.timedelta(minutes=5),
        scheduled_end=timezone.now() + datetime.timedelta(hours=2),
        duration_seconds=7200,
        allowed_languages=[Language.PYTHON3],
        created_by=admin,
        is_published=True,
    )


def make_question(exam):
    return Question.objects.create(
        exam=exam, order=1, title="Q1",
        statement="Print hello", marks=10,
        time_limit_ms=1000, memory_limit_mb=64,
    )


class AuthTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.student = make_student()
        self.admin = make_admin()

    def test_student_login_success(self):
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "student@test.com",
            "password": "Student@1234",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["role"], "student")

    def test_admin_login_success(self):
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "admin@test.com",
            "password": "Admin@1234",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["role"], "admin")

    def test_login_wrong_password(self):
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "student@test.com",
            "password": "wrongpass",
        }, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_login_nonexistent_user(self):
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "nobody@test.com",
            "password": "Student@1234",
        }, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_me_endpoint_authenticated(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.get("/api/v1/auth/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["data"]["email"], "student@test.com")
        self.assertEqual(resp.data["data"]["role"], "student")

    def test_me_endpoint_unauthenticated(self):
        resp = self.client.get("/api/v1/auth/me/")
        self.assertEqual(resp.status_code, 401)

    def test_logout_blacklists_token(self):
        # Login
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "student@test.com",
            "password": "Student@1234",
        }, format="json")
        refresh = resp.data["refresh"]
        access = resp.data["access"]

        # Logout
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        resp2 = self.client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json")
        self.assertEqual(resp2.status_code, 200)

        # Attempt to refresh — should fail
        resp3 = self.client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
        self.assertEqual(resp3.status_code, 401)

    def test_token_case_insensitive_email(self):
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "STUDENT@TEST.COM",  # uppercase
            "password": "Student@1234",
        }, format="json")
        self.assertEqual(resp.status_code, 200)


class AdminUserManagementTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_admin()
        self.client.force_authenticate(user=self.admin)

    def test_admin_create_student(self):
        resp = self.client.post("/api/v1/auth/users/", {
            "email": "new@test.com",
            "full_name": "New Student",
            "password": "Pass@1234",
            "role": "student",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(email="new@test.com").exists())

    def test_student_cannot_access_admin_user_list(self):
        student = make_student(email="s2@test.com")
        self.client.force_authenticate(user=student)
        resp = self.client.get("/api/v1/auth/users/")
        self.assertEqual(resp.status_code, 403)


class ExamAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_admin()
        self.student = make_student()

    def test_admin_create_exam(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/v1/exams/", {
            "title": "Test Exam",
            "scheduled_start": (timezone.now() + datetime.timedelta(hours=1)).isoformat(),
            "scheduled_end": (timezone.now() + datetime.timedelta(hours=3)).isoformat(),
            "duration_seconds": 7200,
            "allowed_languages": ["python3"],
            "is_published": True,
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Exam.objects.count(), 1)

    def test_student_cannot_create_exam(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.post("/api/v1/exams/", {
            "title": "Hack Exam",
            "scheduled_start": timezone.now().isoformat(),
            "scheduled_end": (timezone.now() + datetime.timedelta(hours=1)).isoformat(),
            "duration_seconds": 3600,
            "allowed_languages": ["python3"],
        }, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_student_sees_only_enrolled_exams(self):
        exam = make_active_exam(self.admin)
        ExamEnrollment.objects.create(exam=exam, student=self.student)

        other_exam = make_active_exam(self.admin)  # not enrolled

        self.client.force_authenticate(user=self.student)
        resp = self.client.get("/api/v1/exams/my/")
        self.assertEqual(resp.status_code, 200)
        # Handle both paginated (results key) and direct list (data key)
        results = resp.data.get("results") or resp.data.get("data") or []
        returned_ids = [e["id"] for e in results]
        self.assertIn(exam.pk, returned_ids)
        self.assertNotIn(other_exam.pk, returned_ids)


class ExamSessionTests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_admin()
        self.student = make_student()
        self.exam = make_active_exam(self.admin)
        self.enrollment = ExamEnrollment.objects.create(exam=self.exam, student=self.student)
        self.client.force_authenticate(user=self.student)

    def test_enter_exam_creates_session(self):
        resp = self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(resp.data["success"])
        self.assertFalse(resp.data["resumed"])
        self.assertEqual(ExamSession.objects.count(), 1)

    def test_enter_exam_resumes_existing_session(self):
        # First entry
        resp1 = self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        self.assertEqual(resp1.status_code, 201)
        session_id_1 = resp1.data["data"]["id"]

        # Second entry — should resume
        resp2 = self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        self.assertEqual(resp2.status_code, 200)
        self.assertTrue(resp2.data["resumed"])
        self.assertEqual(resp2.data["data"]["id"], session_id_1)
        self.assertEqual(ExamSession.objects.count(), 1)  # no new session

    def test_enter_exam_not_enrolled(self):
        other_exam = make_active_exam(self.admin)
        resp = self.client.post(f"/api/v1/sessions/enter/{other_exam.pk}/")
        self.assertEqual(resp.status_code, 403)

    def test_timer_returns_positive_seconds(self):
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        resp = self.client.get("/api/v1/sessions/timer/")
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(resp.data["data"]["seconds_remaining"], 0)

    def test_timer_no_session_returns_404(self):
        resp = self.client.get("/api/v1/sessions/timer/")
        self.assertEqual(resp.status_code, 404)

    def test_heartbeat_updates_session(self):
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        resp = self.client.post("/api/v1/sessions/heartbeat/", {
            "current_question_order": 2
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(resp.data["data"]["seconds_remaining"], 0)

    def test_autosave_creates_draft(self):
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        question = make_question(self.exam)
        resp = self.client.post("/api/v1/sessions/autosave/", {
            "question_id": question.pk,
            "language": "python3",
            "code": "print('hello')",
            "is_primary_language": True,
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])
        self.assertEqual(CodeDraft.objects.count(), 1)

    def test_autosave_updates_existing_draft(self):
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        question = make_question(self.exam)

        self.client.post("/api/v1/sessions/autosave/", {
            "question_id": question.pk,
            "language": "python3",
            "code": "print('v1')",
        }, format="json")
        self.client.post("/api/v1/sessions/autosave/", {
            "question_id": question.pk,
            "language": "python3",
            "code": "print('v2')",
        }, format="json")

        draft = CodeDraft.objects.get(question=question, language="python3")
        self.assertEqual(draft.code, "print('v2')")
        self.assertEqual(draft.save_count, 1)  # 0 after create, +1 on update

    def test_draft_retrieval(self):
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        question = make_question(self.exam)
        self.client.post("/api/v1/sessions/autosave/", {
            "question_id": question.pk,
            "language": "python3",
            "code": "print('saved')",
        }, format="json")

        resp = self.client.get(f"/api/v1/sessions/drafts/{question.pk}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["data"]), 1)
        self.assertEqual(resp.data["data"][0]["code"], "print('saved')")

    def test_complete_exam(self):
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")
        resp = self.client.post("/api/v1/sessions/complete/")
        self.assertEqual(resp.status_code, 200)
        session = ExamSession.objects.first()
        self.assertEqual(session.status, ExamSession.Status.COMPLETED)

    def test_expired_session_returns_timeout(self):
        import datetime
        session = ExamSession.objects.create(
            enrollment=self.enrollment,
            started_at=timezone.now() - datetime.timedelta(hours=3),
            expires_at=timezone.now() - datetime.timedelta(hours=1),
            ip_address="127.0.0.1",
        )
        resp = self.client.get("/api/v1/sessions/timer/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["data"]["seconds_remaining"], 0)


class SecurityEventAPITests(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = make_admin()
        self.student = make_student()
        self.exam = make_active_exam(self.admin)
        self.enrollment = ExamEnrollment.objects.create(exam=self.exam, student=self.student)
        self.client.force_authenticate(user=self.student)
        # Create session
        self.client.post(f"/api/v1/sessions/enter/{self.exam.pk}/")

    def test_log_tab_switch(self):
        resp = self.client.post("/api/v1/security/events/", {
            "event_type": "tab_switch",
            "payload": {"count": 1},
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(SecurityEvent.objects.count(), 2)  # entry + tab switch

    def test_invalid_event_type_rejected(self):
        resp = self.client.post("/api/v1/security/events/", {
            "event_type": "not_a_real_event",
            "payload": {},
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_admin_can_list_events(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/v1/security/events/admin/?exam_id={self.exam.pk}")
        self.assertEqual(resp.status_code, 200)

    def test_student_cannot_list_admin_events(self):
        resp = self.client.get("/api/v1/security/events/admin/")
        self.assertEqual(resp.status_code, 403)
