from django.contrib import admin
from .models import Exam, Question, TestCase, ExamEnrollment


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 0
    fields = ("order", "title", "marks", "time_limit_ms", "memory_limit_mb")
    ordering = ("order",)


class TestCaseInline(admin.TabularInline):
    model = TestCase
    extra = 0
    fields = ("order", "is_hidden", "input_data", "expected_output", "time_limit_ms")
    ordering = ("order",)


class EnrollmentInline(admin.TabularInline):
    model = ExamEnrollment
    extra = 0
    fields = ("student", "status", "final_score", "enrolled_at")
    readonly_fields = ("enrolled_at",)


@admin.register(Exam)
class ExamAdmin(admin.ModelAdmin):
    list_display = ("title", "scheduled_start", "scheduled_end", "is_published", "is_archived", "created_by")
    list_filter = ("is_published", "is_archived")
    search_fields = ("title",)
    ordering = ("-scheduled_start",)
    inlines = [QuestionInline, EnrollmentInline]
    readonly_fields = ("created_at", "updated_at")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ("exam", "order", "title", "marks", "time_limit_ms", "memory_limit_mb")
    list_filter = ("exam",)
    search_fields = ("title", "statement")
    inlines = [TestCaseInline]


@admin.register(TestCase)
class TestCaseAdmin(admin.ModelAdmin):
    list_display = ("question", "order", "is_hidden", "time_limit_ms")
    list_filter = ("is_hidden",)
    search_fields = ("question__title",)


@admin.register(ExamEnrollment)
class ExamEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("student", "exam", "status", "final_score", "enrolled_at")
    list_filter = ("status", "exam")
    search_fields = ("student__email", "student__roll_number")
    readonly_fields = ("enrolled_at",)
