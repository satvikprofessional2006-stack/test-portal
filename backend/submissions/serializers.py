"""Submissions serializers."""

from rest_framework import serializers
from .models import Submission, SubmissionResult, RunRequest, SubmissionVerdict


class RunCodeSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    language = serializers.CharField(max_length=20)
    code = serializers.CharField()
    stdin = serializers.CharField(allow_blank=True, default="")


class SubmitCodeSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    language = serializers.CharField(max_length=20)
    code = serializers.CharField()


class SubmissionResultSerializer(serializers.ModelSerializer):
    """Per-test-case result — hides is_hidden status from students."""
    class Meta:
        model = SubmissionResult
        fields = ("id", "verdict", "time_ms", "memory_mb", "stdout", "stderr", "output_matched")


class SubmissionSerializer(serializers.ModelSerializer):
    """Student-facing submission detail."""
    test_results = SubmissionResultSerializer(many=True, read_only=True)

    class Meta:
        model = Submission
        fields = (
            "id", "question", "language", "submitted_at",
            "verdict", "score", "passed_test_cases", "total_test_cases",
            "compiler_output", "judged_at", "test_results",
        )
        read_only_fields = fields


class RunRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = RunRequest
        fields = (
            "id", "language", "verdict", "stdout", "stderr",
            "compiler_output", "exit_code", "time_ms", "requested_at", "completed_at",
        )
        read_only_fields = fields


class AdminSubmissionSerializer(serializers.ModelSerializer):
    """Admin view — includes student identity and full results."""
    test_results = SubmissionResultSerializer(many=True, read_only=True)
    student_email = serializers.EmailField(source="session.enrollment.student.email", read_only=True)
    student_name = serializers.CharField(source="session.enrollment.student.full_name", read_only=True)

    class Meta:
        model = Submission
        fields = (
            "id", "student_email", "student_name",
            "question", "language", "code", "submitted_at",
            "verdict", "score", "passed_test_cases", "total_test_cases",
            "compiler_output", "judged_at", "worker_id", "test_results",
        )
        read_only_fields = fields
