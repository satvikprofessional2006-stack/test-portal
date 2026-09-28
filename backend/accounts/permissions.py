"""
Custom DRF permission classes for role-based access control.
"""

from rest_framework.permissions import BasePermission
from .models import UserRole


class IsAdmin(BasePermission):
    """Allow access only to users with role=admin."""
    message = "Administrator access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.ADMIN
        )


class IsStudent(BasePermission):
    """Allow access only to users with role=student."""
    message = "Student access required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.STUDENT
        )


class IsAdminOrReadOnly(BasePermission):
    """Allow read for authenticated users; write only for admins."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return True
        return request.user.role == UserRole.ADMIN
