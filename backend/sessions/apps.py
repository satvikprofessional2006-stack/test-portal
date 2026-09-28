from django.apps import AppConfig


class ExamSessionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "sessions"
    label = "exam_sessions"  # avoids conflict with django.contrib.sessions
