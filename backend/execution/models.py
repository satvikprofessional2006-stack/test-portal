"""
Execution app models.

ExecutionJob: tracks the lifecycle of a code execution in the worker queue.
This is the bridge between the Django API and the Celery worker.
"""

import logging
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class ExecutionJob(models.Model):
    """
    Tracks a single code execution task in the worker queue.

    Linked to either a Submission (graded) or a RunRequest (ungraded).
    Exactly one of submission or run_request will be set.
    """

    class JobType(models.TextChoices):
        SUBMIT = "submit", "Submission — graded against hidden test cases"
        RUN = "run", "Run Only — custom input, not graded"

    class JobStatus(models.TextChoices):
        QUEUED = "queued", "Queued"
        STARTED = "started", "Started by worker"
        COMPILING = "compiling", "Compiling"
        RUNNING = "running", "Running test cases"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed — worker error"
        TIMED_OUT = "timed_out", "Timed out — worker did not respond"

    job_type = models.CharField(max_length=10, choices=JobType.choices)

    # Exactly one of these will be non-null
    submission = models.OneToOneField(
        "submissions.Submission",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="execution_job",
    )
    run_request = models.OneToOneField(
        "submissions.RunRequest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="execution_job",
    )

    celery_task_id = models.CharField(max_length=255, blank=True, db_index=True)
    status = models.CharField(
        max_length=20, choices=JobStatus.choices, default=JobStatus.QUEUED, db_index=True,
    )

    queued_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    # Worker identity (hostname/container ID)
    worker_id = models.CharField(max_length=100, blank=True)

    # Raw worker error for debugging (not shown to students)
    error_detail = models.TextField(blank=True)

    class Meta:
        db_table = "execution_job"
        indexes = [
            models.Index(fields=["status", "queued_at"]),
        ]

    def __str__(self):
        return f"Job#{self.pk}({self.job_type}, {self.status})"

    def mark_started(self, worker_id=""):
        self.status = self.JobStatus.STARTED
        self.started_at = timezone.now()
        self.worker_id = worker_id
        self.save(update_fields=["status", "started_at", "worker_id"])

    def mark_completed(self):
        self.status = self.JobStatus.COMPLETED
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "finished_at"])

    def mark_failed(self, detail=""):
        self.status = self.JobStatus.FAILED
        self.finished_at = timezone.now()
        self.error_detail = detail[:2000]  # Cap to avoid huge error blobs
        self.save(update_fields=["status", "finished_at", "error_detail"])
        logger.error("ExecutionJob %d failed: %s", self.pk, detail[:200])
