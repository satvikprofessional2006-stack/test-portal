"""
Custom exception handler for DRF.
Returns consistent JSON error shapes across all endpoints.
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        # Wrap DRF errors in a consistent envelope
        error_data = {
            "success": False,
            "errors": response.data,
        }
        response.data = error_data
        request = context.get("request")
        path = getattr(request, "path", "unknown") if request else "unknown"
        logger.warning(
            "API error %s on %s: %s",
            response.status_code,
            path,
            exc,
        )

    return response
