from django.contrib import admin
from .models import SecurityEvent


@admin.register(SecurityEvent)
class SecurityEventAdmin(admin.ModelAdmin):
    list_display = (
        "pk", "session", "event_type", "severity", "source", "ip_address", "timestamp",
    )
    list_filter = ("severity", "event_type", "source")
    search_fields = ("session__enrollment__student__email", "ip_address")
    readonly_fields = ("session", "event_type", "severity", "payload", "timestamp", "ip_address", "source")
    ordering = ("-timestamp",)

    # Audit records must NEVER be edited or deleted via admin
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
