import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler

from .responses import error_body

logger = logging.getLogger(__name__)

CODES = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    405: 'METHOD_NOT_ALLOWED',
    415: 'UNSUPPORTED_MEDIA_TYPE',
}


def api_exception_handler(exc, context):
    """Wrap DRF errors in the shared error envelope; anything else becomes a 500."""
    response = exception_handler(exc, context)

    if response is None:
        logger.exception('Unhandled error in API view', exc_info=exc)
        return Response(
            error_body('INTERNAL_SERVER_ERROR', 'internal server error'), status=500
        )

    status = response.status_code
    detail = response.data.get('detail') if isinstance(response.data, dict) else None
    response.data = error_body(
        CODES.get(status, 'ERROR'),
        str(detail) if detail else 'request failed',
    )
    return response
