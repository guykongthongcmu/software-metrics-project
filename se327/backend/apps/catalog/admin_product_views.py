from django.views.decorators.http import require_safe
from django.views.static import serve
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.response import Response

from common import storage
from common.responses import success_body

from . import admin_images, admin_product_payload, admin_products as service
from .admin_base import AdminError, AdminView
from .storefront import parse_lang

# room for the text fields on top of the largest allowed set of images
FORM_OVERHEAD = 1024 * 1024
MAX_CREATE_BODY = admin_images.MAX_IMAGES * storage.MAX_IMAGE_BYTES + FORM_OVERHEAD
MAX_IMAGE_BODY = storage.MAX_IMAGE_BYTES + FORM_OVERHEAD


def ok(message, data, status=200):
    return Response(success_body(message, data), status=status)


def refuse_big_body(request, limit):
    """Turn away oversize uploads before the body is read."""
    try:
        length = int(request.META.get('CONTENT_LENGTH') or 0)
    except ValueError:
        length = 0
    if length > limit:
        raise AdminError(413, 'FILE_TOO_LARGE', 'the upload is too large')


class AdminProductListView(AdminView):
    parser_classes = [JSONParser, MultiPartParser]

    def get(self, request):
        return ok('products retrieved successfully', service.list_products(request.query_params))

    def post(self, request):
        refuse_big_body(request, MAX_CREATE_BODY)
        fields = admin_product_payload.read_fields(request)
        uploads = request.FILES.getlist('mediaFiles') + request.FILES.getlist('media')
        return ok('product created successfully', service.create_product(fields, uploads), status=201)


class AdminProductView(AdminView):
    def get(self, request, product_id):
        lang = parse_lang(request.query_params.get('lang'))
        data = service.get_detail(service.parse_product_id(product_id), lang)
        return ok('product retrieved successfully', data)

    def put(self, request, product_id):
        data = service.update_product(service.parse_product_id(product_id), request.data)
        return ok('product updated successfully', data)

    def delete(self, request, product_id):
        data = service.delete_product(service.parse_product_id(product_id), request.query_params)
        return ok('product deleted successfully', data)


class AdminProductImagesView(AdminView):
    parser_classes = [MultiPartParser]

    def get(self, request, product_id):
        data = service.list_media(service.parse_product_id(product_id))
        return ok('product images retrieved successfully', data)

    def post(self, request, product_id):
        product_id = service.parse_product_id(product_id)
        refuse_big_body(request, MAX_IMAGE_BODY)
        data = admin_images.add_image(product_id, request.FILES.get('image'), request.POST)
        return ok('image uploaded successfully', data, status=201)


@require_safe
def product_file(request, path):
    """Serve a stored product image from the local media folder."""
    return serve(request, path, document_root=storage.media_root())
