from apps.accounts.permissions import IsCustomer
from apps.catalog.storefront import parse_lang
from apps.catalog.views import CatalogView, ok

from . import favourites_services as services


class FavouritesView(CatalogView):
    permission_classes = [IsCustomer]

    def get(self, request):
        lang = parse_lang(request.query_params.get('lang'))
        return ok('favorites retrieved successfully', services.list_favourites(request.customer, lang))


class FavouriteItemView(CatalogView):
    permission_classes = [IsCustomer]

    def post(self, request, product_id):
        lang = parse_lang(request.query_params.get('lang'))
        data = services.add_favourite(request.customer, services.parse_product_id(product_id), lang)
        return ok('product added to favorites successfully', data)

    def delete(self, request, product_id):
        lang = parse_lang(request.query_params.get('lang'))
        data = services.remove_favourite(request.customer, services.parse_product_id(product_id), lang)
        return ok('product removed from favorites successfully', data)
