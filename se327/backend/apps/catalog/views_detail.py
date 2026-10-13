from django.conf import settings

from . import detail, storefront
from .detail import VIEWER_COOKIE, VIEWER_MAX_AGE
from .views import CatalogView, ok


class ProductDetailView(CatalogView):
    def get(self, request, product_id):
        product_id = detail.parse_product_id(product_id)
        lang = storefront.parse_lang(request.query_params.get('lang'))
        data = detail.product_detail(product_id, lang)
        new_token = detail.record_view(request, product_id)

        response = ok('product detail retrieved successfully', data)
        if new_token:
            response.set_cookie(
                VIEWER_COOKIE, new_token, max_age=VIEWER_MAX_AGE, path='/',
                httponly=True, samesite='Lax', secure=not settings.DEBUG,
            )
        return response


class ProductVariantsView(CatalogView):
    def get(self, request, product_id):
        product_id = detail.parse_product_id(product_id)
        storefront.parse_lang(request.query_params.get('lang'))
        return ok('product variants retrieved successfully', detail.product_variants(product_id))


class ProductImagesView(CatalogView):
    def get(self, request, product_id):
        product_id = detail.parse_product_id(product_id)
        return ok('product images retrieved successfully', detail.product_images(product_id))
