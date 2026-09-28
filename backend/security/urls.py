"""Security URL configuration."""

from django.urls import path
from .views import LogSecurityEventView, AdminSecurityEventListView

urlpatterns = [
    path("events/", LogSecurityEventView.as_view(), name="security-events-log"),
    path("events/admin/", AdminSecurityEventListView.as_view(), name="security-events-admin"),
]
