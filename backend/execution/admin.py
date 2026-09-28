from django.contrib import admin
from .models import ExecutionJob


@admin.register(ExecutionJob)
class ExecutionJobAdmin(admin.ModelAdmin):
    list_display = ("pk", "job_type", "status", "worker_id", "queued_at", "started_at", "finished_at")
    list_filter = ("job_type", "status")
    search_fields = ("celery_task_id", "worker_id")
    readonly_fields = ("queued_at", "started_at", "finished_at", "celery_task_id")
