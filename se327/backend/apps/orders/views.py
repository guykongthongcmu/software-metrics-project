from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCustomer
from common.responses import error_body, success_body

from . import checkout, checkout_address
from .services import OrderError


class CheckoutView(APIView):
    permission_classes = [IsCustomer]

    def handle_exception(self, exc):
        if isinstance(exc, OrderError):
            body = error_body(exc.code, exc.message)
            if exc.details:
                body['details'] = exc.details
            return JsonResponse(body, status=exc.status)
        return super().handle_exception(exc)


class CheckoutAddressView(CheckoutView):
    def get(self, request):
        data = checkout_address.get_address(request.customer)
        return Response(success_body('checkout address retrieved successfully', data))

    def put(self, request):
        data = checkout_address.save_address(request.customer, request.data)
        return Response(success_body('checkout address saved successfully', data))


class CheckoutPurchaseView(CheckoutView):
    def post(self, request):
        data = checkout.purchase(request.customer)
        return Response(success_body('purchase completed successfully', data))
