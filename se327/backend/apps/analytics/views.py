from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from common.responses import error_response, success_body

from . import services
from .services import DashboardError


class DashboardSummaryView(APIView):
    permission_classes = [IsAdmin]

    def handle_exception(self, exc):
        if isinstance(exc, DashboardError):
            return error_response(exc.code, exc.message, 400)
        return super().handle_exception(exc)

    def get(self, request):
        data = services.dashboard_summary(request.query_params)
        return Response(success_body('dashboard summary retrieved successfully', data))
