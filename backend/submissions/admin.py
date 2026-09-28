from django.contrib import admin
from .models import Submission, SubmissionResult, RunRequest


class SubmissionResultInline(admin.TabularInline):
    model = SubmissionResult
    extra = 0
    fields = ("test_case", "verdict", "time_ms", "memory_mb", "output_matched")
    readonly_fields = ("test_case", "verdict", "time_ms", "memory_mb", "output_matched")


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = (
        "pk", "session", "question", "language", "verdict",
        "score", "passed_test_cases", "total_test_cases", "submitted_at",
    )
    list_filter = ("verdict", "language")
    search_fields = ("session__enrollment__student__email", "celery_task_id")
    readonly_fields = ("submitted_at", "judged_at", "celery_task_id", "worker_id")
    inlines = [SubmissionResultInline]


@admin.register(RunRequest)
class RunRequestAdmin(admin.ModelAdmin):
    list_display = ("pk", "session", "language", "verdict", "time_ms", "requested_at")
    list_filter = ("verdict", "language")
    search_fields = ("session__enrollment__student__email",)
    readonly_fields = ("requested_at", "completed_at", "celery_task_id")
