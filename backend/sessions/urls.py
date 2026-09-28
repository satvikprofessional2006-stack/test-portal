"""Sessions URL configuration."""

from django.urls import path
from .views import (
    EnterExamView,
    TimerView,
    HeartbeatView,
    AutosaveView,
    DraftRetrieveView,
    CompleteExamView,
    AdminActiveSessionsView,
    AdminTerminateSessionView,
)

urlpatterns = [
    # Student
    path("enter/<int:exam_id>/", EnterExamView.as_view(), name="session-enter"),
    path("timer/", TimerView.as_view(), name="session-timer"),
    path("heartbeat/", HeartbeatView.as_view(), name="session-heartbeat"),
    path("autosave/", AutosaveView.as_view(), name="session-autosave"),
    path("drafts/<int:question_id>/", DraftRetrieveView.as_view(), name="session-drafts"),
    path("complete/", CompleteExamView.as_view(), name="session-complete"),

    # Admin
    path("active/", AdminActiveSessionsView.as_view(), name="admin-active-sessions"),
    path("<int:session_id>/terminate/", AdminTerminateSessionView.as_view(), name="admin-terminate-session"),
]
