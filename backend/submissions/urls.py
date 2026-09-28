"""Submissions URL configuration."""

from django.urls import path
from .views import (
    RunCodeView,
    RunCodeStatusView,
    SubmitCodeView,
    SubmissionStatusView,
    StudentSubmissionListView,
    AdminSubmissionListView,
)

urlpatterns = [
    # Student
    path("run/", RunCodeView.as_view(), name="run-code"),
    path("run/<int:run_id>/", RunCodeStatusView.as_view(), name="run-code-status"),
    path("submit/", SubmitCodeView.as_view(), name="submit-code"),
    path("<int:submission_id>/", SubmissionStatusView.as_view(), name="submission-status"),
    path("my/", StudentSubmissionListView.as_view(), name="student-submissions"),

    # Admin
    path("", AdminSubmissionListView.as_view(), name="admin-submissions"),
]
