from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsCustomer
from apps.catalog.storefront import CatalogError, parse_lang
from common.responses import error_response, success_body

from . import services
from .services import CartError


class CartView(APIView):
    permission_classes = [IsCustomer]

    def handle_exception(self, exc):
        if isinstance(exc, (CartError, CatalogError)):
            return error_response(exc.code, exc.message, exc.status)
        return super().handle_exception(exc)


class CartDetailView(CartView):
    def get(self, request):
        lang = parse_lang(request.query_params.get('lang'))
        data = services.get_cart(request.customer, lang)
        return Response(success_body('cart retrieved successfully', data))


class CartItemListView(CartView):
    def post(self, request):
        lang = parse_lang(request.query_params.get('lang'))
        data = services.add_item(request.customer, request.data, lang)
        return Response(success_body('cart item added successfully', data), status=201)


class CartItemDetailView(CartView):
    def put(self, request, item_id):
        lang = parse_lang(request.query_params.get('lang'))
        data = services.update_item(request.customer, item_id, request.data, lang)
        return Response(success_body('cart item quantity updated successfully', data))

    def delete(self, request, item_id):
        data = services.remove_item(request.customer, item_id)
        return Response(success_body('cart item removed successfully', data))
