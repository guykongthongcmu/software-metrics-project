import logging

from django.conf import settings
from django.http import HttpResponse

from .responses import error_response

logger = logging.getLogger(__name__)

ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'
DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization'


class CorsMiddleware:
    """Reflect only allowlisted origins and allow credentials so cookies work."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        origin = request.headers.get('Origin')

        if not origin:
            return self.get_response(request)

        if origin not in settings.CORS_ALLOWED_ORIGINS:
            return error_response('CORS_ORIGIN_NOT_ALLOWED', 'origin is not allowed', 403)

        if request.method == 'OPTIONS':
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)

        response['Access-Control-Allow-Origin'] = origin
        response['Access-Control-Allow-Credentials'] = 'true'
        response['Access-Control-Allow-Methods'] = ALLOWED_METHODS
        response['Access-Control-Allow-Headers'] = (
            request.headers.get('Access-Control-Request-Headers') or DEFAULT_ALLOWED_HEADERS
        )
        response['Vary'] = 'Origin, Access-Control-Request-Headers'
        return response


class JsonExceptionMiddleware:
    """Turn uncaught exceptions into a JSON 500 without leaking a stack trace.

    Runs even when DEBUG is on, where Django would otherwise render its HTML debug page.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        logger.exception('Unhandled error on %s', request.path, exc_info=exception)
        return error_response('INTERNAL_SERVER_ERROR', 'internal server error', 500)
