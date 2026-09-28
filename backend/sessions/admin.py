from django.contrib import admin
from .models import ExamSession, CodeDraft


class CodeDraftInline(admin.TabularInline):
    model = CodeDraft
    extra = 0
    fields = ("question", "language", "save_count", "saved_at", "is_primary_language")
    readonly_fields = ("saved_at", "save_count")


@admin.register(ExamSession)
class ExamSessionAdmin(admin.ModelAdmin):
    list_display = (
        "pk", "enrollment", "status", "started_at", "expires_at",
        "seconds_remaining", "ip_address", "last_heartbeat_at",
    )
    list_filter = ("status",)
    search_fields = ("enrollment__student__email", "ip_address")
    readonly_fields = ("started_at", "expires_at", "last_heartbeat_at")
    inlines = [CodeDraftInline]

    def seconds_remaining(self, obj):
        return obj.seconds_remaining
    seconds_remaining.short_description = "Remaining (s)"


@admin.register(CodeDraft)
class CodeDraftAdmin(admin.ModelAdmin):
    list_display = ("session", "question", "language", "save_count", "saved_at")
    list_filter = ("language",)
    search_fields = ("session__enrollment__student__email",)
    readonly_fields = ("saved_at",)
