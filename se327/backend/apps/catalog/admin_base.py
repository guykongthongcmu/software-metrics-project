from django.http import JsonResponse
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from common.responses import error_body
from common.storage import ImageRejected

from .storefront import CatalogError

ID_MAX = 2**63


class AdminError(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


class AdminView(APIView):
    permission_classes = [IsAdmin]

    def handle_exception(self, exc):
        if isinstance(exc, (AdminError, CatalogError, ImageRejected)):
            body = error_body(exc.code, exc.message)
            if getattr(exc, 'details', None):
                body['details'] = exc.details
            return JsonResponse(body, status=exc.status)
        return super().handle_exception(exc)


def parse_id(raw, code, message):
    # isdigit alone accepts non-ascii digits, which int() would turn into a surprise id
    if not (raw.isascii() and raw.isdigit()) or not 0 < int(raw) < ID_MAX:
        raise AdminError(400, code, message)
    return int(raw)
