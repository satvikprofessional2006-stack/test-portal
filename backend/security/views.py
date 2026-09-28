"""Security views — event logging and admin review."""

import logging
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import serializers

from accounts.permissions import IsAdmin, IsStudent
from sessions.views import get_active_session
from .models import SecurityEvent, SecurityEventType

logger = logging.getLogger(__name__)


class SecurityEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityEvent
        fields = (
            "id", "session", "event_type", "severity",
            "payload", "timestamp", "ip_address", "source",
        )
        read_only_fields = fields


class LogSecurityEventView(APIView):
    """
    POST /api/v1/security/events/
    Students report browser-detected events (tab switch, copy, paste, etc.)
    """
    permission_classes = [IsAuthenticated, IsStudent]

    def post(self, request):
        session = get_active_session(request.user)
        if not session:
            return Response(
                {"success": False, "errors": {"detail": "No active session."}},
                status=status.HTTP_404_NOT_FOUND,
            )

        event_type = request.data.get("event_type")
        payload = request.data.get("payload", {})

        valid_types = [choice[0] for choice in SecurityEventType.choices]
        if event_type not in valid_types:
            return Response(
                {"success": False, "errors": {"event_type": f"Invalid event type. Valid: {valid_types}"}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate payload is a dict
        if not isinstance(payload, dict):
            payload = {"raw": str(payload)}

        SecurityEvent.log(
            session=session,
            event_type=event_type,
            payload=payload,
            ip_address=request.META.get("REMOTE_ADDR"),
            source="client",
        )
        return Response({"success": True}, status=status.HTTP_201_CREATED)


class AdminSecurityEventListView(generics.ListAPIView):
    """
    GET /api/v1/security/events/?session_id=&exam_id=&severity=&event_type=
    Admin: view and filter security events.
    """
    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = SecurityEventSerializer

    def get_queryset(self):
        qs = SecurityEvent.objects.select_related("session").order_by("-timestamp")

        session_id = self.request.query_params.get("session_id")
        if session_id:
            qs = qs.filter(session_id=session_id)

        exam_id = self.request.query_params.get("exam_id")
        if exam_id:
            qs = qs.filter(session__enrollment__exam_id=exam_id)

        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)

        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)

        return qs
