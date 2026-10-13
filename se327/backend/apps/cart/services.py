from decimal import Decimal

from django.db import transaction
from django.db.models import Case, IntegerField, When

from apps.catalog.models import Product, ProductMedia, ProductTranslation, ProductVariant
from apps.catalog.storefront import discount_for
from common.choices import Language

from .models import Cart, CartItem


class CartError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def parse_positive_int(raw, code, message):
    """Accept an int or a string of digits that is above zero."""
    if isinstance(raw, bool):
        raise CartError(400, code, message)
    if isinstance(raw, str):
        raw = raw.strip()
        if not (raw.isascii() and raw.isdigit()):
            raise CartError(400, code, message)
        raw = int(raw)
    if not isinstance(raw, int) or raw <= 0:
        raise CartError(400, code, message)
    return raw


def parse_item_id(raw):
    return parse_positive_int(raw, 'INVALID_ITEM_ID', 'itemId must be a positive integer')


def parse_quantity(raw):
    return parse_positive_int(raw, 'INVALID_QUANTITY', 'quantityCartItem must be a positive integer')


def active_cart(user):
    return Cart.objects.filter(user=user, status=Cart.Status.ACTIVE).first()


def product_name(product_id, lang):
    row = ProductTranslation.objects.filter(product_id=product_id).annotate(
        lang_rank=Case(
            When(language_code=lang, then=0),
            When(language_code=Language.EN, then=1),
            default=2,
            output_field=IntegerField(),
        ),
    ).order_by('lang_rank', 'pk').first()
    return row.name if row else ''


def product_image(product_id):
    media = ProductMedia.objects.filter(product_id=product_id).exclude(
        public_url__regex=r'^\s*$',
    ).annotate(
        media_rank=Case(
            When(is_hero=True, then=0),
            When(is_thumbnail=True, then=1),
            default=2,
            output_field=IntegerField(),
        ),
    ).order_by('media_rank', 'sort_order', 'pk').first()
    return media.public_url.strip() if media else None


def cart_line(item, lang):
    variant = item.product_variant
    product = variant.product
    price = variant.price
    original = variant.compare_at_price
    if original is None or original <= price:
        original = price
    return {
        'itemId': item.pk,
        'productId': product.pk,
        'name': product_name(product.pk, lang),
        'color': variant.colour,
        'size': variant.size,
        'price': float(price),
        'originalPrice': float(original),
        'discount': discount_for(price, original),
        'image': product_image(product.pk),
        'inStock': product.is_active and variant.is_active and variant.stock_qty > 0,
        'quantityCartItem': item.quantity,
        'lineTotal': float(price * item.quantity),
    }


def cart_summary(cart):
    total_items = 0
    subtotal = Decimal('0')
    items = CartItem.objects.filter(cart=cart).select_related('product_variant')
    for item in items:
        total_items += item.quantity
        subtotal += item.product_variant.price * item.quantity
    return {'totalItems': total_items, 'subtotal': float(subtotal)}


def get_cart(user, lang):
    cart = active_cart(user)
    if cart is None:
        return {'cartId': None, 'items': [], 'cartSummary': {'totalItems': 0, 'subtotal': 0}}
    items = CartItem.objects.filter(cart=cart).select_related(
        'product_variant__product',
    ).order_by('cart_item_id')
    return {
        'cartId': cart.pk,
        'items': [cart_line(item, lang) for item in items],
        'cartSummary': cart_summary(cart),
    }


def find_variant(product_id, color, size):
    product = Product.objects.filter(pk=product_id, is_active=True).first()
    if product is None:
        raise CartError(404, 'PRODUCT_NOT_FOUND', f'product with id {product_id} was not found')
    variant = ProductVariant.objects.select_for_update().filter(
        product=product, is_active=True, colour__iexact=color, size__iexact=size,
    ).first()
    if variant is None:
        raise CartError(400, 'INVALID_VARIANT_SELECTION', 'color and size do not match an active variant')
    return variant


def add_item(user, body, lang):
    if not isinstance(body, dict):
        raise CartError(400, 'INVALID_REQUEST', 'request body must be a JSON object')
    fields = ('productId', 'color', 'size', 'quantityCartItem')
    if any(body.get(name) is None for name in fields):
        raise CartError(400, 'INVALID_REQUEST', 'productId, color, size, and quantityCartItem are required')
    color = str(body['color']).strip()
    size = str(body['size']).strip()
    if not color or not size:
        raise CartError(400, 'INVALID_REQUEST', 'productId, color, size, and quantityCartItem are required')
    product_id = parse_positive_int(body['productId'], 'INVALID_PRODUCT_ID', 'productId must be a positive integer')
    quantity = parse_quantity(body['quantityCartItem'])

    with transaction.atomic():
        variant = find_variant(product_id, color, size)
        cart, _ = Cart.objects.get_or_create(user=user, status=Cart.Status.ACTIVE)
        item = CartItem.objects.select_for_update().filter(cart=cart, product_variant=variant).first()
        new_quantity = (item.quantity if item else 0) + quantity
        if new_quantity > variant.stock_qty:
            raise CartError(409, 'INSUFFICIENT_STOCK', 'requested quantity exceeds available stock')
        if item:
            item.quantity = new_quantity
            item.save(update_fields=['quantity', 'updated_at'])
        else:
            item = CartItem.objects.create(cart=cart, product_variant=variant, quantity=new_quantity)
        item = CartItem.objects.select_related('product_variant__product').get(pk=item.pk)
        return {
            'cartId': cart.pk,
            'item': cart_line(item, lang),
            'cartSummary': cart_summary(cart),
        }


def own_item(user, item_id):
    item = CartItem.objects.select_for_update().filter(
        pk=item_id, cart__user=user, cart__status=Cart.Status.ACTIVE,
    ).first()
    if item is None:
        raise CartError(404, 'CART_ITEM_NOT_FOUND', f'cart item with id {item_id} was not found')
    return item


def update_item(user, item_id, body, lang):
    item_id = parse_item_id(item_id)
    raw = body.get('quantityCartItem') if isinstance(body, dict) else None
    quantity = parse_quantity(raw)

    with transaction.atomic():
        item = own_item(user, item_id)
        variant = ProductVariant.objects.get(pk=item.product_variant_id)
        if quantity > variant.stock_qty:
            raise CartError(409, 'INSUFFICIENT_STOCK', 'requested quantity exceeds available stock')
        item.quantity = quantity
        item.save(update_fields=['quantity', 'updated_at'])
        item = CartItem.objects.select_related('product_variant__product').get(pk=item.pk)
        return {
            'cartId': item.cart_id,
            'item': cart_line(item, lang),
            'cartSummary': cart_summary(item.cart),
        }


def remove_item(user, item_id):
    item_id = parse_item_id(item_id)

    with transaction.atomic():
        item = own_item(user, item_id)
        cart = item.cart
        product_id = item.product_variant.product_id
        item.delete()
        return {
            'itemId': item_id,
            'productId': product_id,
            'cartSummary': cart_summary(cart),
        }
