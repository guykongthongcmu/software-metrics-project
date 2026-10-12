from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .responses import error_response


class HealthView(APIView):
    def get(self, request):
        return Response({'status': 'ok'})


class NotFoundView(APIView):
    """Catch-all so unknown routes get a JSON 404 even when DEBUG is on."""

    def get(self, request, *args, **kwargs):
        raise NotFound(f'route not found: {request.path}')

    post = put = patch = delete = get


def not_found(request, exception=None):
    return error_response('NOT_FOUND', f'route not found: {request.path}', 404)


def server_error(request):
    return error_response('INTERNAL_SERVER_ERROR', 'internal server error', 500)
