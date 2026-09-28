"""
Accounts views — login, refresh, logout, /me, admin user management.
"""

import csv
import io
import logging

from django.contrib.auth import get_user_model
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserRole
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserProfileSerializer,
    AdminUserCreateSerializer,
)
from .permissions import IsAdmin

User = get_user_model()
logger = logging.getLogger(__name__)


class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Returns access + refresh JWT tokens plus user profile fields.
    """
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Blacklists the provided refresh token, ending the session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"success": False, "errors": {"refresh": "Refresh token required."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info("User %d logged out", request.user.pk)
            return Response({"success": True}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.warning("Logout failed for user %d: %s", request.user.pk, exc)
            return Response(
                {"success": False, "errors": {"detail": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )


class MeView(APIView):
    """
    GET /api/v1/auth/me/
    Returns the authenticated user's profile.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response({"success": True, "data": serializer.data})


# ─── Admin: User Management ────────────────────────────────────────────────────

class AdminUserListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/auth/users/       — list all users (admin only)
    POST /api/v1/auth/users/       — create a single user (admin only)
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = AdminUserCreateSerializer

    def get_queryset(self):
        qs = User.objects.all().order_by("email")
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(email__icontains=search) | qs.filter(full_name__icontains=search)
        return qs

    def get_serializer_class(self):
        if self.request.method == "GET":
            return UserProfileSerializer
        return AdminUserCreateSerializer


class AdminBulkImportStudentsView(APIView):
    """
    POST /api/v1/auth/users/import/
    Accepts a CSV file with columns: email, full_name, password, roll_number, institution
    Creates student accounts in bulk.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request):
        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"success": False, "errors": {"file": "CSV file is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            decoded = csv_file.read().decode("utf-8")
            reader = csv.DictReader(io.StringIO(decoded))
        except Exception as exc:
            return Response(
                {"success": False, "errors": {"file": f"Could not parse CSV: {exc}"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created, skipped, errors = [], [], []
        required_cols = {"email", "full_name", "password"}

        for i, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            missing = required_cols - set(row.keys())
            if missing:
                return Response(
                    {"success": False, "errors": {"file": f"Missing columns: {missing}"}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            email = row["email"].strip().lower()
            if User.objects.filter(email=email).exists():
                skipped.append(email)
                continue
            try:
                user = User.objects.create_user(
                    email=email,
                    password=row["password"].strip(),
                    full_name=row["full_name"].strip(),
                    role=UserRole.STUDENT,
                    roll_number=row.get("roll_number", "").strip(),
                    institution=row.get("institution", "").strip(),
                    department=row.get("department", "").strip(),
                )
                created.append(email)
            except Exception as exc:
                errors.append({"row": i, "email": email, "error": str(exc)})

        logger.info(
            "Bulk import by admin %d: created=%d, skipped=%d, errors=%d",
            request.user.pk, len(created), len(skipped), len(errors),
        )
        return Response({
            "success": True,
            "data": {
                "created": len(created),
                "skipped": len(skipped),
                "errors": errors,
            },
        }, status=status.HTTP_201_CREATED)
