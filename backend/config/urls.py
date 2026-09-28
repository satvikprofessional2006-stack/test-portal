"""
Root URL configuration.
Each app owns its own urls.py and is included here under a versioned prefix.
"""

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/exams/", include("exams.urls")),
    path("api/v1/sessions/", include("sessions.urls")),
    path("api/v1/submissions/", include("submissions.urls")),
    path("api/v1/execution/", include("execution.urls")),
    path("api/v1/security/", include("security.urls")),

    # API schema / docs (disable in production via SPECTACULAR_SETTINGS)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
