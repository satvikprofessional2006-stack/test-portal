"""
Security event models.

SecurityEvent: structured audit trail of suspicious or noteworthy
student actions during an exam.

Events are logged from both the frontend (JS events) and backend
(IP changes, session anomalies). Admins can review these per-session.
"""

import logging
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class SecurityEventType(models.TextChoices):
    """Categorised security event types."""
    # Focus / visibility events (detected client-side)
    TAB_SWITCH = "tab_switch", "Tab Switch — student switched browser tab"
    WINDOW_BLUR = "window_blur", "Window Blur — browser window lost focus"
    FULLSCREEN_EXIT = "fullscreen_exit", "Fullscreen Exit"
    FULLSCREEN_ENTER = "fullscreen_enter", "Fullscreen Entered"

    # Copy/paste events
    COPY_DETECTED = "copy_detected", "Copy Detected in exam window"
    PASTE_DETECTED = "paste_detected", "Paste Detected in editor"
    CUT_DETECTED = "cut_detected", "Cut Detected in exam window"

    # Keyboard shortcuts
    DEVTOOLS_SHORTCUT = "devtools_shortcut", "DevTools shortcut pressed"
    SCREENSHOT_SHORTCUT = "screenshot_shortcut", "Screenshot shortcut pressed"

    # Session anomalies (detected server-side)
    MULTIPLE_SESSION_ATTEMPT = "multiple_session_attempt", "Attempt to open duplicate session"
    IP_CHANGE = "ip_change", "IP address changed during exam"
    SUSPICIOUS_USER_AGENT = "suspicious_user_agent", "Unexpected user-agent change"
    SESSION_REPLAY_ATTEMPT = "session_replay_attempt", "Reuse of an expired token"

    # Network
    NETWORK_OFFLINE = "network_offline", "Student went offline"
    NETWORK_ONLINE = "network_online", "Student came back online"

    # Admin actions
    ADMIN_TERMINATED = "admin_terminated", "Session terminated by administrator"
    EXAM_SUBMITTED = "exam_submitted", "Student submitted the exam"
    EXAM_TIME_EXPIRED = "exam_time_expired", "Exam time expired"


class SecurityEventSeverity(models.TextChoices):
    INFO = "info", "Informational"
    LOW = "low", "Low — possibly accidental"
    MEDIUM = "medium", "Medium — warrants review"
    HIGH = "high", "High — likely cheating attempt"
    CRITICAL = "critical", "Critical — immediate action recommended"


# Map event type → default severity (override in the record if needed)
EVENT_SEVERITY_MAP = {
    SecurityEventType.TAB_SWITCH: SecurityEventSeverity.MEDIUM,
    SecurityEventType.WINDOW_BLUR: SecurityEventSeverity.LOW,
    SecurityEventType.FULLSCREEN_EXIT: SecurityEventSeverity.MEDIUM,
    SecurityEventType.FULLSCREEN_ENTER: SecurityEventSeverity.INFO,
    SecurityEventType.COPY_DETECTED: SecurityEventSeverity.MEDIUM,
    SecurityEventType.PASTE_DETECTED: SecurityEventSeverity.HIGH,
    SecurityEventType.CUT_DETECTED: SecurityEventSeverity.MEDIUM,
    SecurityEventType.DEVTOOLS_SHORTCUT: SecurityEventSeverity.HIGH,
    SecurityEventType.SCREENSHOT_SHORTCUT: SecurityEventSeverity.MEDIUM,
    SecurityEventType.MULTIPLE_SESSION_ATTEMPT: SecurityEventSeverity.HIGH,
    SecurityEventType.IP_CHANGE: SecurityEventSeverity.HIGH,
    SecurityEventType.SUSPICIOUS_USER_AGENT: SecurityEventSeverity.HIGH,
    SecurityEventType.SESSION_REPLAY_ATTEMPT: SecurityEventSeverity.CRITICAL,
    SecurityEventType.NETWORK_OFFLINE: SecurityEventSeverity.INFO,
    SecurityEventType.NETWORK_ONLINE: SecurityEventSeverity.INFO,
    SecurityEventType.ADMIN_TERMINATED: SecurityEventSeverity.INFO,
    SecurityEventType.EXAM_SUBMITTED: SecurityEventSeverity.INFO,
    SecurityEventType.EXAM_TIME_EXPIRED: SecurityEventSeverity.INFO,
}


class SecurityEvent(models.Model):
    """
    Immutable audit log entry for a security-relevant event.

    Records are NEVER deleted (append-only for audit integrity).
    Admins can view and filter by exam, student, severity, and type.
    """

    session = models.ForeignKey(
        "exam_sessions.ExamSession",
        on_delete=models.PROTECT,  # Never cascade-delete audit events
        related_name="security_events",
    )
    event_type = models.CharField(
        max_length=50, choices=SecurityEventType.choices, db_index=True,
    )
    severity = models.CharField(
        max_length=10, choices=SecurityEventSeverity.choices, db_index=True,
    )

    # Arbitrary structured data (screenshot URL, element info, previous IP, etc.)
    payload = models.JSONField(default=dict)

    # When and from where the event was recorded
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    # Source: "client" (browser reported) or "server" (backend detected)
    source = models.CharField(
        max_length=10,
        choices=[("client", "Client"), ("server", "Server")],
        default="client",
    )

    class Meta:
        db_table = "security_event"
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["session", "event_type"]),
            models.Index(fields=["session", "severity"]),
            models.Index(fields=["event_type", "severity", "-timestamp"]),
        ]
        # Prevent accidental deletion of audit records
        default_permissions = ("add", "view")  # no change/delete permission

    def __str__(self):
        return f"SecurityEvent({self.event_type}, {self.severity}, {self.timestamp:%Y-%m-%d %H:%M})"

    @classmethod
    def log(cls, session, event_type, payload=None, ip_address=None, source="client", severity=None):
        """
        Convenience factory method for creating security events.
        Falls back to the severity map if not explicitly provided.
        """
        if severity is None:
            severity = EVENT_SEVERITY_MAP.get(event_type, SecurityEventSeverity.INFO)
        event = cls.objects.create(
            session=session,
            event_type=event_type,
            severity=severity,
            payload=payload or {},
            ip_address=ip_address,
            source=source,
        )
        logger.info(
            "SecurityEvent[%s] session=%d severity=%s",
            event_type, session.pk, severity,
        )
        return event
