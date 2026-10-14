from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import F

from apps.cart.models import Cart, CartItem
from apps.catalog.models import ProductTranslation, ProductVariant
from common.choices import Language

from .checkout_address import address_payload, current_address
from .models import Order, OrderItem
from .services import OrderError

VAT_RATE = Decimal('0.07')
SHIPPING_FEE = Decimal('0.00')
CENT = Decimal('0.01')
# orders.total is a DecimalField(max_digits=10, decimal_places=2)
MAX_TOTAL = Decimal('99999999.99')


def cents(value):
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def product_name(product_id):
    row = ProductTranslation.objects.filter(product_id=product_id, language_code=Language.EN).first()
    return row.name if row else f'Product #{product_id}'


def read_items(cart, lock=False):
    items = CartItem.objects.filter(cart=cart).order_by('cart_item_id')
    return items.select_for_update() if lock else items


def lock_variants(items):
    ids = sorted({item.product_variant_id for item in items})
    variants = ProductVariant.objects.select_for_update(of=('self',)).select_related('product').filter(
        pk__in=ids,
    ).order_by('pk')
    return {variant.pk: variant for variant in variants}


def check_items(items, variants):
    for item in items:
        variant = variants[item.product_variant_id]
        if not (variant.is_active and variant.product.is_active):
            raise OrderError(409, 'CART_ITEM_UNAVAILABLE', 'a cart item is no longer available')
    for item in items:
        if variants[item.product_variant_id].stock_qty < item.quantity:
            raise OrderError(409, 'INSUFFICIENT_STOCK', 'requested quantity exceeds available stock')


def purchase(user):
    with transaction.atomic():
        cart = Cart.objects.select_for_update().filter(user=user, status=Cart.Status.ACTIVE).first()
        if cart is None:
            raise OrderError(409, 'CART_EMPTY', 'the cart is empty')

        # variants are locked before the items are read for good, so quantities cannot move under us
        variants = lock_variants(read_items(cart))
        items = list(read_items(cart, lock=True))
        if any(item.product_variant_id not in variants for item in items):
            variants = lock_variants(items)
        if not items:
            raise OrderError(409, 'CART_EMPTY', 'the cart is empty')
        check_items(items, variants)

        address = current_address(user)
        if address is None:
            raise OrderError(400, 'CHECKOUT_ADDRESS_REQUIRED', 'a default shipping address is required before purchase, please save one first')

        subtotal = sum((variants[i.product_variant_id].price * i.quantity for i in items), Decimal('0'))
        subtotal = cents(subtotal)
        vat_amount = cents(subtotal * VAT_RATE)
        if subtotal + SHIPPING_FEE + vat_amount > MAX_TOTAL:
            raise OrderError(409, 'ORDER_TOTAL_TOO_LARGE', 'the order total is too large')
        snapshot = address_payload(address)
        order = Order.objects.create(
            user=user,
            shipping_address=address,
            billing_address=address,
            status=Order.Status.PURCHASED,
            subtotal=subtotal,
            shipping_fee=SHIPPING_FEE,
            vat_amount=vat_amount,
            total=subtotal + SHIPPING_FEE + vat_amount,
            shipping_address_snapshot=snapshot,
            billing_address_snapshot=dict(snapshot),
        )

        total_items = 0
        for item in items:
            variant = variants[item.product_variant_id]
            compare_at = variant.compare_at_price
            OrderItem.objects.create(
                order=order,
                product_variant=variant,
                snapshot_product_name=product_name(variant.product_id),
                snapshot_color=variant.colour,
                snapshot_size=variant.size,
                snapshot_unit_price=variant.price,
                snapshot_compare_at_price=compare_at if compare_at and compare_at > variant.price else None,
                quantity=item.quantity,
                line_total=cents(variant.price * item.quantity),
            )
            updated = ProductVariant.objects.filter(
                pk=variant.pk, stock_qty__gte=item.quantity,
            ).update(stock_qty=F('stock_qty') - item.quantity)
            if not updated:
                raise OrderError(409, 'INSUFFICIENT_STOCK', 'requested quantity exceeds available stock')
            total_items += item.quantity

        CartItem.objects.filter(pk__in=[item.pk for item in items]).delete()
        cart.status = Cart.Status.CONVERTED
        cart.save(update_fields=['status', 'updated_at'])

    return {
        'orderId': order.pk,
        'orderStatus': order.status,
        'purchasedAt': order.created_at.isoformat(),
        'cartSummary': {'totalItems': total_items, 'subtotal': float(subtotal)},
    }
