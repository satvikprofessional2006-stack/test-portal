"""
Submission and result models.

Submission: a student's final code submission for a question.
SubmissionResult: per-test-case outcome after execution.
RunRequest: ephemeral run-only request (not graded, not stored long-term).
"""

import logging
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class SubmissionVerdict(models.TextChoices):
    """Standard judge verdicts shared across Submission and SubmissionResult."""
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    ACCEPTED = "accepted", "Accepted"
    WRONG_ANSWER = "wrong_answer", "Wrong Answer"
    TIME_LIMIT_EXCEEDED = "tle", "Time Limit Exceeded"
    MEMORY_LIMIT_EXCEEDED = "mle", "Memory Limit Exceeded"
    COMPILATION_ERROR = "compilation_error", "Compilation Error"
    RUNTIME_ERROR = "runtime_error", "Runtime Error"
    OUTPUT_LIMIT_EXCEEDED = "ole", "Output Limit Exceeded"
    INTERNAL_ERROR = "internal_error", "Internal Error — system issue, not student fault"


class Submission(models.Model):
    """
    A student's graded code submission for a specific question.

    One submission per (session, question) at a time, but multiple
    submissions are allowed (each overwrites the score if higher,
    depending on exam policy).

    The verdict and score are computed by the worker, not the frontend.
    """

    session = models.ForeignKey(
        "exam_sessions.ExamSession",
        on_delete=models.PROTECT,
        related_name="submissions",
    )
    question = models.ForeignKey(
        "exams.Question",
        on_delete=models.PROTECT,
        related_name="submissions",
    )

    language = models.CharField(max_length=20)
    code = models.TextField()

    submitted_at = models.DateTimeField(default=timezone.now, db_index=True)
    verdict = models.CharField(
        max_length=30,
        choices=SubmissionVerdict.choices,
        default=SubmissionVerdict.PENDING,
        db_index=True,
    )

    # Aggregated results (filled once worker completes)
    score = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    passed_test_cases = models.PositiveSmallIntegerField(null=True, blank=True)
    total_test_cases = models.PositiveSmallIntegerField(null=True, blank=True)

    # Compilation error output (if any)
    compiler_output = models.TextField(blank=True)

    # Celery task ID for the execution job
    celery_task_id = models.CharField(max_length=255, blank=True, db_index=True)

    # Worker metadata
    judged_at = models.DateTimeField(null=True, blank=True)
    worker_id = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "submissions_submission"
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["session", "question", "-submitted_at"]),
            models.Index(fields=["verdict"]),
        ]

    def __str__(self):
        return f"Sub#{self.pk}(Q{self.question_id}, {self.language}, {self.verdict})"

    @property
    def is_final(self):
        """True when the verdict is no longer PENDING or RUNNING."""
        return self.verdict not in (
            SubmissionVerdict.PENDING,
            SubmissionVerdict.RUNNING,
        )


class SubmissionResult(models.Model):
    """
    Per-test-case result for a submission.

    Populated by the execution worker after running each test case.
    Hidden test cases are visible to admins but not students.
    """

    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="test_results",
    )
    test_case = models.ForeignKey(
        "exams.TestCase",
        on_delete=models.SET_NULL,
        null=True,
        related_name="results",
    )

    verdict = models.CharField(
        max_length=30,
        choices=SubmissionVerdict.choices,
        default=SubmissionVerdict.PENDING,
    )

    # Execution metrics
    time_ms = models.PositiveIntegerField(null=True, blank=True)
    memory_mb = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    # I/O capture (truncated to reasonable lengths)
    stdout = models.TextField(blank=True)
    stderr = models.TextField(blank=True)

    # Whether this result matched the expected output
    output_matched = models.BooleanField(null=True, blank=True)

    class Meta:
        db_table = "submissions_result"
        ordering = ["submission", "test_case__order"]

    def __str__(self):
        return f"Result(sub={self.submission_id}, tc={self.test_case_id}, {self.verdict})"


class RunRequest(models.Model):
    """
    Ephemeral run-code request (not graded).

    Students use Run Code to test against custom input.
    These are stored for audit but not scored.
    Older records can be pruned periodically.
    """

    session = models.ForeignKey(
        "exam_sessions.ExamSession",
        on_delete=models.CASCADE,
        related_name="run_requests",
    )
    question = models.ForeignKey(
        "exams.Question",
        on_delete=models.CASCADE,
        related_name="run_requests",
        null=True,
        blank=True,
    )

    language = models.CharField(max_length=20)
    code = models.TextField()
    stdin = models.TextField(blank=True, help_text="Custom input provided by the student")

    requested_at = models.DateTimeField(default=timezone.now, db_index=True)

    # Result (filled by worker)
    stdout = models.TextField(blank=True)
    stderr = models.TextField(blank=True)
    compiler_output = models.TextField(blank=True)
    exit_code = models.SmallIntegerField(null=True, blank=True)
    time_ms = models.PositiveIntegerField(null=True, blank=True)
    memory_mb = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    verdict = models.CharField(
        max_length=30,
        choices=SubmissionVerdict.choices,
        default=SubmissionVerdict.PENDING,
    )
    celery_task_id = models.CharField(max_length=255, blank=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "submissions_runrequest"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["session", "-requested_at"]),
        ]

    def __str__(self):
        return f"RunReq#{self.pk}(session={self.session_id}, {self.language})"
