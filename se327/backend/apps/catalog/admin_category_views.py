from rest_framework.response import Response

from common.responses import success_body

from . import admin_categories as service
from .admin_base import AdminView


def ok(message, data, status=200):
    return Response(success_body(message, data), status=status)


class AdminCategoryListView(AdminView):
    def get(self, request):
        return ok('categories retrieved successfully', service.list_categories(request.query_params))

    def post(self, request):
        data = service.create_category(request.data)
        return ok('category created successfully', data, status=201)


class AdminCategoryView(AdminView):
    def put(self, request, category_id):
        category_id = service.parse_category_id(category_id)
        return ok('category updated successfully', service.rename_category(category_id, request.data))

    def delete(self, request, category_id):
        category_id = service.parse_category_id(category_id)
        return ok('category deleted successfully', service.delete_category(category_id))


class AdminCategoryVisibilityView(AdminView):
    def patch(self, request, category_id):
        category_id = service.parse_category_id(category_id)
        return ok('category visibility updated successfully', service.set_hidden(category_id, request.data))
