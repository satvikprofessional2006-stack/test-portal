"""
Session-layer models.

ExamSession: tracks a student's active exam attempt.
CodeDraft: autosaved code per question/language.

The backend validates every submission against the active session.
Only one active session per enrollment is allowed at any time.
"""

import logging
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class ExamSession(models.Model):
    """
    Represents a student's active exam attempt.

    Key invariant: at most ONE active session per enrollment.
    If a student reconnects (crash, network drop), the existing session
    is resumed rather than creating a duplicate.

    The backend is authoritative for:
    - started_at (when the student's personal timer began)
    - expires_at (started_at + exam.duration_seconds)
    - is_active (only the backend can deactivate a session)
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed — student submitted all questions"
        TIMED_OUT = "timed_out", "Timed Out — time expired"
        TERMINATED = "terminated", "Terminated — admin or system action"
        DISCONNECTED = "disconnected", "Disconnected — student left mid-exam"

    enrollment = models.ForeignKey(
        "exams.ExamEnrollment",
        on_delete=models.PROTECT,
        related_name="sessions",
    )

    # Timing (all server-side)
    started_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(
        help_text="Computed as started_at + exam.duration_seconds. Never trust the client.",
    )
    last_heartbeat_at = models.DateTimeField(default=timezone.now)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    # Device / network fingerprinting (for audit, not enforcement)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    # Browser fingerprint (screen res, timezone, etc.) — stored for security audit
    device_fingerprint = models.JSONField(default=dict, blank=True)

    # Last question the student was viewing
    current_question_order = models.PositiveSmallIntegerField(default=1)

    class Meta:
        db_table = "sessions_examsession"
        indexes = [
            models.Index(fields=["enrollment", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]

    def __str__(self):
        return f"Session({self.enrollment}, {self.status})"

    @property
    def seconds_remaining(self):
        """Server-authoritative remaining seconds. Returns 0 if expired."""
        remaining = (self.expires_at - timezone.now()).total_seconds()
        return max(0, int(remaining))

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def touch(self):
        """Update heartbeat timestamp. Called on every authenticated API request."""
        ExamSession.objects.filter(pk=self.pk).update(
            last_heartbeat_at=timezone.now()
        )

    def complete(self):
        """Mark session as completed."""
        self.status = self.Status.COMPLETED
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at"])
        logger.info("Session %d completed", self.pk)

    def time_out(self):
        """Called by background task when expires_at passes."""
        self.status = self.Status.TIMED_OUT
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at"])
        logger.info("Session %d timed out", self.pk)


class CodeDraft(models.Model):
    """
    Autosaved code for a specific question within a session.

    One record per (session, question, language) combination.
    Upserted on every autosave — not versioned (keep it simple for MVP).
    Students can switch languages; each gets its own draft.
    """

    session = models.ForeignKey(
        ExamSession,
        on_delete=models.CASCADE,
        related_name="code_drafts",
    )
    question = models.ForeignKey(
        "exams.Question",
        on_delete=models.CASCADE,
        related_name="code_drafts",
    )
    language = models.CharField(max_length=20)
    code = models.TextField(blank=True)

    # Track when and how the draft was last saved
    saved_at = models.DateTimeField(auto_now=True)
    save_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of times this draft has been autosaved",
    )
    # The last language the student had selected (for restoring UI state)
    is_primary_language = models.BooleanField(
        default=True,
        help_text="True for the language the student last had selected for this question",
    )

    class Meta:
        db_table = "sessions_codedraft"
        unique_together = [("session", "question", "language")]
        indexes = [
            models.Index(fields=["session", "question"]),
        ]

    def __str__(self):
        return f"Draft({self.session_id}, Q{self.question_id}, {self.language})"
