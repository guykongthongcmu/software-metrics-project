from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from common.responses import error_body, success_body

from . import services
from .services import OrderError


class AdminOrderView(APIView):
    permission_classes = [IsAdmin]

    def handle_exception(self, exc):
        if isinstance(exc, OrderError):
            body = error_body(exc.code, exc.message)
            if exc.details:
                body['details'] = exc.details
            return JsonResponse(body, status=exc.status)
        return super().handle_exception(exc)


def ok(message, data):
    return Response(success_body(message, data))


class OrderListView(AdminOrderView):
    def get(self, request):
        return ok('orders retrieved successfully', services.list_orders(request.query_params))


class OrderDetailView(AdminOrderView):
    def get(self, request, order_id):
        data = services.get_order(services.parse_order_id(order_id))
        return ok('order retrieved successfully', data)

    def patch(self, request, order_id):
        order_id = services.parse_order_id(order_id)
        return ok('order updated successfully', services.update_order(order_id, request.data))

    def delete(self, request, order_id):
        data = services.delete_order(services.parse_order_id(order_id))
        return ok('order deleted successfully', data)
