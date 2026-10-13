from rest_framework.response import Response
from rest_framework.views import APIView

from common.responses import error_response, success_body

from . import storefront
from .storefront import CatalogError


class CatalogView(APIView):
    def handle_exception(self, exc):
        if isinstance(exc, CatalogError):
            return error_response(exc.code, exc.message, exc.status)
        return super().handle_exception(exc)


def ok(message, data):
    return Response(success_body(message, data))


class CategoryListView(CatalogView):
    def get(self, request):
        sort = (request.query_params.get('sort') or 'category_name').strip().lower()
        order = (request.query_params.get('order') or 'asc').strip().lower()
        if sort != 'category_name':
            raise CatalogError(400, 'INVALID_QUERY', 'sort must be category_name')
        if order not in ('asc', 'desc'):
            raise CatalogError(400, 'INVALID_QUERY', 'order must be asc or desc')

        categories = [
            {
                'categoryId': category.pk,
                'categoryName': category.category_name,
                'slug': category.slug,
                'isHidden': False,
            }
            for category in storefront.visible_categories(order)
        ]
        return ok('visible categories retrieved successfully', {'categories': categories})


class ProductListView(CatalogView):
    def get(self, request):
        params = request.query_params
        lang = storefront.parse_lang(params.get('lang'))
        data = storefront.list_products(
            lang, storefront.parse_page(params.get('page')), storefront.parse_limit(params.get('limit')),
        )
        return ok('products retrieved successfully', data)


class NewArrivalsView(CatalogView):
    def get(self, request):
        lang = storefront.parse_lang(request.query_params.get('lang'))
        return ok('new arrival products retrieved successfully', {'products': storefront.new_arrivals(lang)})


class CategoryProductsView(CatalogView):
    def get(self, request, slug):
        params = request.query_params
        lang = storefront.parse_lang(params.get('lang'))
        data = storefront.products_in_category(
            slug, lang,
            storefront.parse_page(params.get('page')),
            storefront.parse_limit(params.get('limit')),
            storefront.parse_sort(params.get('sort'), storefront.CATEGORY_SORTS, 'newest'),
        )
        return ok('products in category retrieved successfully', data)


class SearchView(CatalogView):
    def get(self, request):
        params = request.query_params
        query_text = storefront.parse_query_text(params.get('q'), 'q must be a non-empty string')
        lang = storefront.parse_lang(params.get('lang'))
        data = storefront.search_products(
            query_text, lang,
            storefront.parse_page(params.get('page')),
            storefront.parse_limit(params.get('limit')),
            storefront.parse_sort(params.get('sort'), storefront.SEARCH_SORTS, 'relevance'),
        )
        return ok('products retrieved successfully', data)


class SearchSuggestionsView(CatalogView):
    def get(self, request):
        params = request.query_params
        query_text = storefront.parse_query_text(params.get('q'), 'q must be at least 1 character')
        lang = storefront.parse_lang(params.get('lang'))
        data = {'query': query_text, 'suggestions': storefront.search_suggestions(query_text, lang)}
        return ok('product suggestions retrieved successfully', data)


class RecommendationsView(CatalogView):
    def get(self, request):
        params = request.query_params
        lang = storefront.parse_lang(params.get('lang'))
        limit = storefront.parse_recommendations_limit(params.get('limit'))
        context = storefront.parse_optional_text(params.get('context'), 'context')
        category = storefront.parse_optional_text(params.get('category'), 'category')
        excluded = storefront.parse_exclude_ids(params.get('excludeProductIds'))
        data = {
            'context': context,
            'limit': limit,
            'products': storefront.recommendations(lang, limit, category, excluded),
        }
        return ok('product recommendations retrieved successfully', data)
