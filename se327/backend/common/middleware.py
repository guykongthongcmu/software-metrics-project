import json
import logging

from django.conf import settings
from django.core.exceptions import RequestDataTooBig, SuspiciousOperation
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


# these views check their own text and answer with a more specific error, so the body is left to them
OWN_TEXT_CHECKS = (
    '/api/auth/reset-password',
    '/api/client/checkout/address',
    '/api/admin/categories',
    '/api/admin/products',
)


def has_bad_text(value):
    """True for text holding NUL or a lone surrogate, which the database or encoder cannot take."""
    if '\x00' in value:
        return True
    try:
        value.encode('utf-8')
    except UnicodeEncodeError:
        return True
    return False


def json_has_bad_text(data):
    stack = [data]
    while stack:
        item = stack.pop()
        if isinstance(item, str):
            if has_bad_text(item):
                return True
        elif isinstance(item, list):
            stack.extend(item)
        elif isinstance(item, dict):
            for key, value in item.items():
                if has_bad_text(key):
                    return True
                stack.append(value)
    return False


def is_json_request(request):
    if request.method not in ('POST', 'PUT', 'PATCH'):
        return False
    kind = request.content_type
    return kind == 'application/json' or kind.endswith('+json')


def parsed_json_body(request):
    """The decoded JSON body, or None when it is not JSON, not parseable or too big.

    Too big is left alone here because the view answers 413 for it. Very deep nesting raises
    RecursionError, which the caller turns into a 400.
    """
    if not is_json_request(request):
        return None
    try:
        length = int(request.META.get('CONTENT_LENGTH') or 0)
    except ValueError:
        length = 0
    if length > settings.DATA_UPLOAD_MAX_MEMORY_SIZE:
        return None
    try:
        return json.loads(request.body)
    except (ValueError, RequestDataTooBig):
        return None


class BadTextMiddleware:
    """Answer 400 for NUL bytes and lone surrogates in the path, query string or JSON body.

    PostgreSQL cannot store them and they would otherwise end up as a 500 in whichever view
    happens to touch the text first.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        values = [request.path_info]
        try:
            for key, items in request.GET.lists():
                values.append(key)
                values.extend(items)
        except SuspiciousOperation:
            # more query parameters than DATA_UPLOAD_MAX_NUMBER_FIELDS allows
            return error_response('INVALID_QUERY', 'the query string was rejected', 400)
        if any(has_bad_text(value) for value in values):
            return error_response('INVALID_QUERY', 'text contains characters that are not allowed', 400)

        if request.path_info.startswith(OWN_TEXT_CHECKS):
            return self.get_response(request)

        try:
            body = parsed_json_body(request)
        except RecursionError:
            return error_response('INVALID_JSON', 'request body is nested too deeply', 400)
        if body is not None and json_has_bad_text(body):
            return error_response('INVALID_FIELD_LENGTH', 'a field is too long or has invalid characters', 400)
        return self.get_response(request)
