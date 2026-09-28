"""
Exam serializers — student-facing and admin-facing variants.

Student serializers hide hidden test cases and internal fields.
Admin serializers expose everything.
"""

from rest_framework import serializers
from .models import Exam, Question, TestCase, ExamEnrollment, Language


# ─── Test Case ────────────────────────────────────────────────────────────────

class TestCaseAdminSerializer(serializers.ModelSerializer):
    """Full test case — for admin use only."""

    class Meta:
        model = TestCase
        fields = (
            "id", "question", "input_data", "expected_output",
            "is_hidden", "time_limit_ms", "memory_limit_mb", "order", "explanation",
        )


class TestCaseStudentSerializer(serializers.ModelSerializer):
    """
    Visible (sample) test cases only — for student exam screen.
    Hidden test cases must NEVER appear in this serializer.
    """

    class Meta:
        model = TestCase
        fields = ("id", "input_data", "expected_output", "order")


class TestCaseCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestCase
        fields = (
            "id", "input_data", "expected_output",
            "is_hidden", "time_limit_ms", "memory_limit_mb", "order", "explanation",
        )


# ─── Question ─────────────────────────────────────────────────────────────────

class QuestionAdminSerializer(serializers.ModelSerializer):
    """Full question with all test cases — admin only."""

    test_cases = TestCaseAdminSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = (
            "id", "exam", "order", "title", "statement",
            "input_format", "output_format", "constraints", "notes",
            "sample_input", "sample_output", "sample_explanation",
            "time_limit_ms", "memory_limit_mb", "marks",
            "allowed_languages", "test_cases", "created_at", "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class QuestionStudentSerializer(serializers.ModelSerializer):
    """
    Student-facing question: full problem statement + visible test cases only.
    Hidden test cases are excluded at the serializer level.
    """

    sample_test_cases = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = (
            "id", "order", "title", "statement",
            "input_format", "output_format", "constraints", "notes",
            "sample_input", "sample_output", "sample_explanation",
            "time_limit_ms", "memory_limit_mb", "marks",
            "allowed_languages", "sample_test_cases",
        )

    def get_sample_test_cases(self, obj):
        visible = obj.test_cases.filter(is_hidden=False).order_by("order")
        return TestCaseStudentSerializer(visible, many=True).data


class QuestionCreateSerializer(serializers.ModelSerializer):
    """Admin: create/update a question."""

    class Meta:
        model = Question
        fields = (
            "id", "exam", "order", "title", "statement",
            "input_format", "output_format", "constraints", "notes",
            "sample_input", "sample_output", "sample_explanation",
            "time_limit_ms", "memory_limit_mb", "marks", "allowed_languages",
        )


# ─── Exam ─────────────────────────────────────────────────────────────────────

class ExamListStudentSerializer(serializers.ModelSerializer):
    """
    Compact exam representation for the student's exam list.
    Shows only scheduling info and enrollment status.
    """

    enrollment_status = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = (
            "id", "title", "description",
            "scheduled_start", "scheduled_end", "duration_seconds",
            "allowed_languages", "is_published",
            "enrollment_status", "question_count",
        )

    def get_enrollment_status(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        try:
            enr = obj.enrollments.get(student=request.user)
            return enr.status
        except Exception:
            return None

    def get_question_count(self, obj):
        return obj.questions.count()


class ExamDetailStudentSerializer(serializers.ModelSerializer):
    """
    Full exam detail for active exam screen — includes all questions
    (without hidden test cases).
    """

    questions = QuestionStudentSerializer(many=True, read_only=True)
    enrollment_status = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = (
            "id", "title", "instructions",
            "scheduled_start", "scheduled_end", "duration_seconds",
            "allowed_languages", "questions", "enrollment_status",
        )

    def get_enrollment_status(self, obj):
        request = self.context.get("request")
        if not request:
            return None
        try:
            enr = obj.enrollments.get(student=request.user)
            return enr.status
        except Exception:
            return None


class ExamAdminSerializer(serializers.ModelSerializer):
    """Admin: full exam with question count and enrollment stats."""

    questions = QuestionAdminSerializer(many=True, read_only=True)
    enrollment_count = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = (
            "id", "title", "description", "instructions",
            "scheduled_start", "scheduled_end", "duration_seconds",
            "allowed_languages", "allowed_ip_ranges", "passing_score",
            "is_published", "is_archived",
            "created_by", "created_by_name", "created_at", "updated_at",
            "questions", "enrollment_count",
        )
        read_only_fields = ("created_by", "created_at", "updated_at")

    def get_enrollment_count(self, obj):
        return obj.enrollments.count()

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else ""


class ExamCreateUpdateSerializer(serializers.ModelSerializer):
    """Admin: create or update an exam."""

    class Meta:
        model = Exam
        fields = (
            "id", "title", "description", "instructions",
            "scheduled_start", "scheduled_end", "duration_seconds",
            "allowed_languages", "allowed_ip_ranges", "passing_score",
            "is_published", "is_archived",
        )

    def validate(self, data):
        start = data.get("scheduled_start", getattr(self.instance, "scheduled_start", None))
        end = data.get("scheduled_end", getattr(self.instance, "scheduled_end", None))
        duration = data.get("duration_seconds", getattr(self.instance, "duration_seconds", None))
        if start and end and end <= start:
            raise serializers.ValidationError("End time must be after start time.")
        if start and end and duration:
            window = (end - start).total_seconds()
            if duration > window:
                raise serializers.ValidationError(
                    "Duration cannot exceed the exam window length."
                )
        return data

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


# ─── Enrollment ───────────────────────────────────────────────────────────────

class EnrollmentAdminSerializer(serializers.ModelSerializer):
    student_email = serializers.EmailField(source="student.email", read_only=True)
    student_name = serializers.CharField(source="student.full_name", read_only=True)
    roll_number = serializers.CharField(source="student.roll_number", read_only=True)

    class Meta:
        model = ExamEnrollment
        fields = (
            "id", "exam", "student", "student_email", "student_name",
            "roll_number", "status", "final_score", "enrolled_at", "completed_at",
        )
        read_only_fields = ("enrolled_at", "completed_at", "status")


class EnrollStudentsSerializer(serializers.Serializer):
    """Admin: enroll a list of student IDs into an exam."""
    student_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
    )
