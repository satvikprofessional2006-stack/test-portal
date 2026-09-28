"""accounts URL configuration."""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    LoginView,
    LogoutView,
    MeView,
    AdminUserListCreateView,
    AdminBulkImportStudentsView,
)

urlpatterns = [
    # Auth
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),

    # Admin: user management
    path("users/", AdminUserListCreateView.as_view(), name="admin-users"),
    path("users/import/", AdminBulkImportStudentsView.as_view(), name="admin-users-import"),
]
