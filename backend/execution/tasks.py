"""
Celery tasks for code execution.

Two task types:
  - execute_run_request: Run Code (custom input, not graded)
  - execute_submission:  Submit (graded against hidden test cases)

Both tasks update the database with results when done.
"""

import logging
import socket
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=5,
    name="execution.tasks.execute_run_request",
)
def execute_run_request(self, run_request_id: int):
    """
    Execute a Run Code request (not graded).
    Updates RunRequest with stdout/stderr/verdict when done.
    """
    from submissions.models import RunRequest, SubmissionVerdict
    from execution.models import ExecutionJob
    from .sandbox import execute

    try:
        run = RunRequest.objects.select_related("session__enrollment__exam").get(pk=run_request_id)
    except RunRequest.DoesNotExist:
        logger.error("RunRequest %d not found", run_request_id)
        return

    # Mark job as started
    try:
        job = run.execution_job
        job.mark_started(worker_id=socket.gethostname())
    except ExecutionJob.DoesNotExist:
        job = None

    try:
        result = execute(
            language=run.language,
            code=run.code,
            stdin=run.stdin,
        )

        # Map internal verdict to submission verdict
        verdict_map = {
            "accepted": SubmissionVerdict.ACCEPTED,
            "tle": SubmissionVerdict.TIME_LIMIT_EXCEEDED,
            "mle": SubmissionVerdict.MEMORY_LIMIT_EXCEEDED,
            "compilation_error": SubmissionVerdict.COMPILATION_ERROR,
            "runtime_error": SubmissionVerdict.RUNTIME_ERROR,
            "ole": SubmissionVerdict.OUTPUT_LIMIT_EXCEEDED,
            "internal_error": SubmissionVerdict.INTERNAL_ERROR,
            "wrong_answer": SubmissionVerdict.WRONG_ANSWER,
        }

        RunRequest.objects.filter(pk=run.pk).update(
            stdout=result.stdout[:65535],
            stderr=result.stderr[:4096],
            compiler_output=result.compiler_output[:4096],
            exit_code=result.exit_code,
            time_ms=result.time_ms,
            verdict=verdict_map.get(result.verdict, SubmissionVerdict.INTERNAL_ERROR),
            completed_at=timezone.now(),
        )

        if job:
            job.mark_completed()

        logger.info("RunRequest %d completed: %s", run_request_id, result.verdict)

    except Exception as exc:
        logger.exception("RunRequest %d execution failed: %s", run_request_id, exc)
        RunRequest.objects.filter(pk=run.pk).update(
            verdict=SubmissionVerdict.INTERNAL_ERROR,
            stderr=str(exc)[:2048],
            completed_at=timezone.now(),
        )
        if job:
            job.mark_failed(detail=str(exc))
        raise self.retry(exc=exc)


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=10,
    name="execution.tasks.execute_submission",
)
def execute_submission(self, submission_id: int):
    """
    Execute a graded submission against all hidden test cases.
    Updates Submission + SubmissionResult records when done.
    Scoring: full marks if all hidden test cases pass, else proportional.
    """
    from submissions.models import Submission, SubmissionResult, SubmissionVerdict
    from exams.models import TestCase
    from execution.models import ExecutionJob
    from .sandbox import judge

    try:
        sub = Submission.objects.select_related(
            "question", "session__enrollment__exam"
        ).get(pk=submission_id)
    except Submission.DoesNotExist:
        logger.error("Submission %d not found", submission_id)
        return

    try:
        job = sub.execution_job
        job.mark_started(worker_id=socket.gethostname())
    except ExecutionJob.DoesNotExist:
        job = None

    # Mark submission as running
    Submission.objects.filter(pk=sub.pk).update(verdict=SubmissionVerdict.RUNNING)

    try:
        # Fetch all test cases (hidden + visible) — student only sees visible
        test_cases = list(
            TestCase.objects.filter(question=sub.question).order_by("order").values(
                "id", "input_data", "expected_output",
                "is_hidden", "time_limit_ms", "memory_limit_mb",
            )
        )

        if not test_cases:
            Submission.objects.filter(pk=sub.pk).update(
                verdict=SubmissionVerdict.INTERNAL_ERROR,
                compiler_output="No test cases defined for this question.",
            )
            if job:
                job.mark_failed("No test cases")
            return

        q = sub.question
        results = judge(
            language=sub.language,
            code=sub.code,
            test_cases=test_cases,
            time_limit_ms=q.time_limit_ms,
            memory_limit_mb=q.memory_limit_mb,
        )

        # Persist per-test-case results
        verdict_map = {
            "accepted": SubmissionVerdict.ACCEPTED,
            "wrong_answer": SubmissionVerdict.WRONG_ANSWER,
            "tle": SubmissionVerdict.TIME_LIMIT_EXCEEDED,
            "mle": SubmissionVerdict.MEMORY_LIMIT_EXCEEDED,
            "compilation_error": SubmissionVerdict.COMPILATION_ERROR,
            "runtime_error": SubmissionVerdict.RUNTIME_ERROR,
            "ole": SubmissionVerdict.OUTPUT_LIMIT_EXCEEDED,
            "internal_error": SubmissionVerdict.INTERNAL_ERROR,
        }

        result_objects = []
        for r in results:
            tc_id = r["test_case_id"]
            result_objects.append(SubmissionResult(
                submission=sub,
                test_case_id=tc_id,
                verdict=verdict_map.get(r["verdict"], SubmissionVerdict.INTERNAL_ERROR),
                stdout=r.get("stdout", "")[:8192],
                stderr=r.get("stderr", "")[:2048],
                time_ms=r.get("time_ms"),
                output_matched=r.get("output_matched", False),
            ))

        SubmissionResult.objects.bulk_create(result_objects)

        # Aggregate verdict
        verdicts = [r["verdict"] for r in results]
        passed = sum(1 for v in verdicts if v == "accepted")
        total = len(verdicts)

        # Determine overall verdict (worst-case precedence)
        if all(v == "accepted" for v in verdicts):
            overall_verdict = SubmissionVerdict.ACCEPTED
        elif "compilation_error" in verdicts:
            overall_verdict = SubmissionVerdict.COMPILATION_ERROR
        elif "tle" in verdicts:
            overall_verdict = SubmissionVerdict.TIME_LIMIT_EXCEEDED
        elif "mle" in verdicts:
            overall_verdict = SubmissionVerdict.MEMORY_LIMIT_EXCEEDED
        elif "runtime_error" in verdicts:
            overall_verdict = SubmissionVerdict.RUNTIME_ERROR
        elif "internal_error" in verdicts:
            overall_verdict = SubmissionVerdict.INTERNAL_ERROR
        else:
            overall_verdict = SubmissionVerdict.WRONG_ANSWER

        # Score = (passed hidden TCs / total hidden TCs) * marks
        hidden_results = [r for r, tc in zip(results, test_cases) if tc["is_hidden"]]
        hidden_passed = sum(1 for r in hidden_results if r["verdict"] == "accepted")
        hidden_total = len(hidden_results) or 1  # avoid div by zero
        score = round((hidden_passed / hidden_total) * q.marks, 2)

        # Get compiler output from first result if CE
        compiler_output = ""
        if overall_verdict == SubmissionVerdict.COMPILATION_ERROR:
            compiler_output = results[0].get("stderr", "")[:4096]

        Submission.objects.filter(pk=sub.pk).update(
            verdict=overall_verdict,
            score=score,
            passed_test_cases=passed,
            total_test_cases=total,
            compiler_output=compiler_output,
            judged_at=timezone.now(),
            worker_id=socket.gethostname(),
        )

        if job:
            job.mark_completed()

        logger.info(
            "Submission %d judged: %s (%d/%d passed, score=%.2f)",
            submission_id, overall_verdict, passed, total, score,
        )

    except Exception as exc:
        logger.exception("Submission %d failed: %s", submission_id, exc)
        Submission.objects.filter(pk=sub.pk).update(
            verdict=SubmissionVerdict.INTERNAL_ERROR,
        )
        if job:
            job.mark_failed(detail=str(exc))
        raise self.retry(exc=exc)
