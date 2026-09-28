"""
Accounts serializers — login, registration, user profile.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from .models import User, UserRole


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    JWT login serializer.
    Adds role, full_name, and email as custom claims so the frontend
    can set up the correct portal without an extra API call.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.full_name
        token["email"] = user.email
        return token

    def validate(self, attrs):
        # Normalise email to lowercase before auth
        attrs[self.username_field] = attrs[self.username_field].lower().strip()
        data = super().validate(attrs)
        # Add user details to the response body (not just the token)
        data["role"] = self.user.role
        data["full_name"] = self.user.full_name
        data["email"] = self.user.email
        data["user_id"] = self.user.pk
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    """Read-only user profile returned after login or on /me."""

    class Meta:
        model = User
        fields = (
            "id", "email", "full_name", "role",
            "roll_number", "institution", "department", "batch_year",
        )
        read_only_fields = fields


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Admin-only: create a student account."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "email", "full_name", "password", "role",
            "roll_number", "institution", "department", "batch_year",
        )

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class BulkStudentImportSerializer(serializers.Serializer):
    """
    Accepts a list of student records for bulk import.
    Used by the admin CSV import endpoint.
    """

    students = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=500,
    )
