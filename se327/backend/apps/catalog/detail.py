import re
import secrets

from django.db import transaction

from apps.accounts.models import Session
from apps.accounts.sessions import COOKIE_NAME, find_valid_session
from apps.analytics.models import AnalyticsEvent

from .models import Product, ProductMedia, ProductVariant
from .storefront import CatalogError, build_cards, storefront_products

VIEWER_COOKIE = 'viewer_id'
VIEWER_MAX_AGE = 365 * 24 * 60 * 60
VIEWER_PATTERN = re.compile(r'^[A-Za-z0-9_-]{16,128}$')


def parse_product_id(raw):
    if not raw.isdecimal() or not 0 < int(raw) < 2**63:
        raise CatalogError(400, 'INVALID_PRODUCT_ID', 'productId must be a positive integer')
    return int(raw)


def not_found(product_id):
    return CatalogError(404, 'PRODUCT_NOT_FOUND', f'product with id {product_id} was not found')


def require_active_product(product_id):
    if not Product.objects.filter(pk=product_id, is_active=True).exists():
        raise not_found(product_id)


def product_detail(product_id, lang):
    product = storefront_products(lang).filter(pk=product_id).first()
    if product is None:
        raise not_found(product_id)
    return build_cards([product], lang)[0]


def product_variants(product_id):
    require_active_product(product_id)
    rows = ProductVariant.objects.filter(product_id=product_id, is_active=True).order_by('colour', 'size', 'pk')
    return [
        {
            'productVariantId': row.pk,
            'sku': row.sku_code,
            'color': row.colour,
            'size': row.size,
            'price': float(row.price),
            'compareAtPrice': float(row.compare_at_price) if row.compare_at_price is not None else None,
            'stockQty': row.stock_qty,
            'isActive': row.is_active,
        }
        for row in rows
    ]


def product_images(product_id):
    require_active_product(product_id)
    rows = ProductMedia.objects.filter(product_id=product_id).order_by('sort_order', 'pk')
    return [
        {
            'productMediaId': row.pk,
            'productId': row.product_id,
            'bucketName': row.bucket_name,
            'filePath': row.file_path,
            'publicUrl': row.public_url,
            'altText': row.alt_text,
            'sortOrder': row.sort_order,
            'isThumbnail': row.is_thumbnail,
            'isHero': row.is_hero,
            'createdAt': row.created_at.isoformat(),
        }
        for row in rows
    ]


def record_view(request, product_id):
    """Write one PRODUCT_VIEW event. Returns a new viewer token the caller must set as a cookie, or None."""
    session = find_valid_session(request.COOKIES.get(COOKIE_NAME, '').strip())
    user = session.user if session and session.subject_type == Session.SubjectType.USER else None

    new_token = None
    viewer_id = None
    if user is None:
        token = request.COOKIES.get(VIEWER_COOKIE, '').strip()
        if not VIEWER_PATTERN.match(token):
            token = new_token = secrets.token_hex(16)
        viewer_id = f'anon:{token}'

    # a failed insert must never fail the page; the savepoint keeps the outer transaction usable
    try:
        with transaction.atomic():
            AnalyticsEvent.objects.create(
                user=user, session_id=viewer_id,
                event_type=AnalyticsEvent.EventType.PRODUCT_VIEW, product_id=product_id,
            )
    except Exception:
        pass
    return new_token
