"""
Custom User model.

Replaces Django's default User with role-aware accounts.
All authentication decisions go through this model.
"""

import logging
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

logger = logging.getLogger(__name__)


class UserRole(models.TextChoices):
    STUDENT = "student", "Student"
    ADMIN = "admin", "Administrator"
    PROCTOR = "proctor", "Proctor"


class UserManager(BaseUserManager):
    """Manager that supports email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email address is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        logger.info("Created user %s with role %s", email, extra_fields.get("role", UserRole.STUDENT))
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("role") != UserRole.ADMIN:
            raise ValueError("Superuser must have role=admin")
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Central user model for the exam platform.

    Using email as the primary login identifier instead of username
    to match institutional email conventions.
    """

    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    roll_number = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
        help_text="Institutional roll/registration number for students",
    )
    institution = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    batch_year = models.PositiveSmallIntegerField(null=True, blank=True)
    role = models.CharField(max_length=20, choices=UserRole.choices, default=UserRole.STUDENT)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django admin access

    date_joined = models.DateTimeField(default=timezone.now)
    last_login = models.DateTimeField(null=True, blank=True)

    # Password reset token fields (avoids a separate model for MVP)
    password_reset_token = models.CharField(max_length=64, blank=True, db_index=True)
    password_reset_expires = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "accounts_user"
        verbose_name = "User"
        verbose_name_plural = "Users"
        indexes = [
            models.Index(fields=["role", "institution"]),
            models.Index(fields=["roll_number", "institution"]),
        ]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN

    @property
    def is_student(self):
        return self.role == UserRole.STUDENT

    def clean_fields(self, exclude=None):
        super().clean_fields(exclude=exclude)
        self.email = self.email.lower().strip()
