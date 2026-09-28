"""
Exam domain models.

Exam → Question → TestCase hierarchy.
ExamEnrollment ties a Student to a specific Exam.
"""

import logging
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

logger = logging.getLogger(__name__)


class Language(models.TextChoices):
    """Supported programming languages for code execution."""
    CPP17 = "cpp17", "C++17"
    PYTHON3 = "python3", "Python 3"
    JAVA = "java", "Java"


class Exam(models.Model):
    """
    An exam is a timed, scheduled set of questions.

    The backend is authoritative for start/end times.
    The frontend timer is cosmetic only — the backend validates
    submission timestamps against exam window.
    """

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    instructions = models.TextField(
        blank=True,
        help_text="Instructions shown to students before the exam begins",
    )

    # Scheduling
    scheduled_start = models.DateTimeField(db_index=True)
    scheduled_end = models.DateTimeField(db_index=True)
    duration_seconds = models.PositiveIntegerField(
        help_text="Wall-clock duration of the exam in seconds. "
                  "The student's personal timer starts when they enter the exam.",
        validators=[MinValueValidator(300)],  # minimum 5 minutes
    )

    # Language configuration
    allowed_languages = models.JSONField(
        default=list,
        help_text="List of Language enum values permitted in this exam",
    )

    # Network/access policy
    allowed_ip_ranges = models.JSONField(
        default=list,
        help_text="CIDR ranges that may access this exam. Empty = no restriction.",
    )

    # Scoring
    passing_score = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Minimum score to pass (optional, informational only)",
    )

    # State flags
    is_published = models.BooleanField(
        default=False,
        help_text="Unpublished exams are invisible to students",
    )
    is_archived = models.BooleanField(default=False)

    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_exams",
        limit_choices_to={"role__in": ["admin", "proctor"]},
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exams_exam"
        ordering = ["-scheduled_start"]
        indexes = [
            models.Index(fields=["scheduled_start", "scheduled_end"]),
            models.Index(fields=["is_published", "is_archived"]),
        ]

    def __str__(self):
        return self.title

    @property
    def is_active(self):
        """True if the exam window is currently open."""
        now = timezone.now()
        return self.scheduled_start <= now <= self.scheduled_end

    @property
    def has_started(self):
        return timezone.now() >= self.scheduled_start

    @property
    def has_ended(self):
        return timezone.now() > self.scheduled_end

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.scheduled_end <= self.scheduled_start:
            raise ValidationError("Exam end time must be after start time.")
        window_seconds = (self.scheduled_end - self.scheduled_start).total_seconds()
        if self.duration_seconds > window_seconds:
            raise ValidationError(
                "Exam duration cannot exceed the scheduled window length."
            )


class Question(models.Model):
    """
    A single programming problem within an exam.

    Questions have a defined order, marks, and display content.
    Test cases are a separate model linked here.
    """

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveSmallIntegerField(
        help_text="Display order within the exam (1-indexed)",
    )
    title = models.CharField(max_length=255)

    # Problem statement parts (stored separately for structured rendering)
    statement = models.TextField(help_text="Problem statement (supports Markdown)")
    input_format = models.TextField(blank=True)
    output_format = models.TextField(blank=True)
    constraints = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    # Sample I/O shown to the student
    sample_input = models.TextField(blank=True)
    sample_output = models.TextField(blank=True)
    sample_explanation = models.TextField(blank=True)

    # Execution limits (can differ per question)
    time_limit_ms = models.PositiveIntegerField(
        default=2000,
        validators=[MinValueValidator(100), MaxValueValidator(30000)],
        help_text="Time limit in milliseconds",
    )
    memory_limit_mb = models.PositiveIntegerField(
        default=256,
        validators=[MinValueValidator(16), MaxValueValidator(1024)],
        help_text="Memory limit in megabytes",
    )

    marks = models.PositiveSmallIntegerField(default=10)

    # Per-question language override (null = use exam-level setting)
    allowed_languages = models.JSONField(
        null=True, blank=True,
        help_text="Override exam-level language list for this question. Null = use exam setting.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "exams_question"
        ordering = ["exam", "order"]
        unique_together = [("exam", "order")]

    def __str__(self):
        return f"Q{self.order}: {self.title} [{self.exam}]"


class TestCase(models.Model):
    """
    An individual test case for a question.

    Hidden test cases are not shown to students but are used for scoring.
    Visible (sample) test cases are shown in the UI.
    """

    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="test_cases")
    input_data = models.TextField(help_text="stdin to feed the student's program")
    expected_output = models.TextField(help_text="Expected stdout (exact match after stripping trailing whitespace)")
    is_hidden = models.BooleanField(
        default=True,
        help_text="Hidden test cases are used for scoring but not shown to students",
    )

    # Per-test-case limit overrides (null = use question defaults)
    time_limit_ms = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Override question time limit for this specific test case",
    )
    memory_limit_mb = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Override question memory limit for this specific test case",
    )

    order = models.PositiveSmallIntegerField(
        default=0,
        help_text="Test case evaluation order (lower = first)",
    )
    explanation = models.TextField(
        blank=True,
        help_text="Admin-facing explanation of what this test case covers",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "exams_testcase"
        ordering = ["question", "order"]

    def __str__(self):
        visibility = "hidden" if self.is_hidden else "visible"
        return f"TC#{self.pk} ({visibility}) for Q#{self.question_id}"

    def effective_time_limit_ms(self):
        """Return the applicable time limit for this test case."""
        return self.time_limit_ms or self.question.time_limit_ms

    def effective_memory_limit_mb(self):
        """Return the applicable memory limit for this test case."""
        return self.memory_limit_mb or self.question.memory_limit_mb


class ExamEnrollment(models.Model):
    """
    Links a student to an exam they are permitted to sit.

    Created by admin during import; the student cannot self-enroll.
    """

    class Status(models.TextChoices):
        ENROLLED = "enrolled", "Enrolled"
        STARTED = "started", "Started"
        COMPLETED = "completed", "Completed"
        DISQUALIFIED = "disqualified", "Disqualified"

    exam = models.ForeignKey(Exam, on_delete=models.CASCADE, related_name="enrollments")
    student = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="enrollments",
        limit_choices_to={"role": "student"},
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ENROLLED)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Final score (populated at exam end or on admin request)
    final_score = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True,
    )

    class Meta:
        db_table = "exams_enrollment"
        unique_together = [("exam", "student")]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["exam", "status"]),
        ]

    def __str__(self):
        return f"{self.student} → {self.exam} [{self.status}]"
