"""
Sessions serializers — ExamSession and CodeDraft.
"""

from rest_framework import serializers
from .models import ExamSession, CodeDraft


class ExamSessionSerializer(serializers.ModelSerializer):
    seconds_remaining = serializers.IntegerField(read_only=True)
    student_email = serializers.EmailField(source="enrollment.student.email", read_only=True)
    student_name = serializers.CharField(source="enrollment.student.full_name", read_only=True)
    exam_title = serializers.CharField(source="enrollment.exam.title", read_only=True)
    exam_id = serializers.IntegerField(source="enrollment.exam_id", read_only=True)

    class Meta:
        model = ExamSession
        fields = (
            "id", "enrollment", "status",
            "started_at", "expires_at", "seconds_remaining",
            "ip_address", "current_question_order",
            "student_email", "student_name", "exam_title", "exam_id",
        )
        read_only_fields = fields


class CodeDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = CodeDraft
        fields = ("id", "question", "language", "code", "saved_at", "save_count", "is_primary_language")
        read_only_fields = ("saved_at", "save_count")


class AutosaveSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    language = serializers.CharField(max_length=20)
    code = serializers.CharField(allow_blank=True)
    is_primary_language = serializers.BooleanField(default=True)


class HeartbeatSerializer(serializers.Serializer):
    current_question_order = serializers.IntegerField(min_value=1, required=False)
