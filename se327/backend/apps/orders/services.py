import math
import re

from django.db import transaction
from django.db.models import Q, Value
from django.db.models.functions import Concat

from .models import Order

PAGE_DEFAULT = 1
LIMIT_DEFAULT = 20
LIMIT_MAX = 100
STATUS_PURCHASED = 'PURCHASED'

ADDRESS_REQUIRED_MESSAGE = (
    'fullName, phoneNumber, addressLine1, district, province, postalCode, and country are required'
)
PHONE_PATTERN = re.compile(r'^[0-9+\-\s()]{7,20}$')
POSTAL_PATTERN = re.compile(r'^[A-Za-z0-9\- ]{3,12}$')

# field name -> (required, max length)
ADDRESS_FIELDS = {
    'fullName': (True, 150),
    'phoneNumber': (True, 30),
    'addressLine1': (True, 255),
    'addressLine2': (False, 255),
    'district': (True, 120),
    'province': (True, 120),
    'postalCode': (True, 20),
    'country': (True, 100),
}


class OrderError(Exception):
    def __init__(self, status, code, message, details=None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details


def parse_order_id(raw):
    if not raw.isdigit() or int(raw) < 1:
        raise OrderError(400, 'INVALID_ORDER_ID', 'orderId must be a positive integer')
    return int(raw)


def parse_positive(raw, default):
    if raw is None or raw == '':
        return default
    try:
        value = int(raw)
    except ValueError:
        value = 0
    if value < 1:
        raise OrderError(400, 'INVALID_QUERY', 'page and limit must be positive integers')
    return value


def money(value):
    return float(round(value, 2))


def stamp(value):
    return value.isoformat() if value else None


def customer_name(user):
    name = f'{user.first_name} {user.last_name}'.strip()
    return name or user.email


def summary(order):
    return {
        'orderId': order.order_id,
        'userId': order.user_id,
        'status': order.status,
        'subtotal': money(order.subtotal),
        'shippingFee': money(order.shipping_fee),
        'vatAmount': money(order.vat_amount),
        'total': money(order.total),
        'createdAt': stamp(order.created_at),
    }


def detail(order):
    return {
        'orderId': order.order_id,
        'userId': order.user_id,
        'customer': {
            'userId': order.user_id,
            'email': order.user.email,
            'name': customer_name(order.user),
        },
        'status': order.status,
        'subtotal': money(order.subtotal),
        'shippingFee': money(order.shipping_fee),
        'vatAmount': money(order.vat_amount),
        'total': money(order.total),
        'shippingAddressSnapshot': order.shipping_address_snapshot,
        'billingAddressSnapshot': order.billing_address_snapshot,
        'items': [
            {
                'orderItemId': item.order_item_id,
                'productVariantId': item.product_variant_id,
                'snapshotProductName': item.snapshot_product_name,
                'snapshotColor': item.snapshot_color,
                'snapshotSize': item.snapshot_size,
                'snapshotUnitPrice': money(item.snapshot_unit_price),
                'snapshotCompareAtPrice': (
                    None if item.snapshot_compare_at_price is None else money(item.snapshot_compare_at_price)
                ),
                'quantity': item.quantity,
                'lineTotal': money(item.line_total),
            }
            for item in order.items.all().order_by('order_item_id')
        ],
        'createdAt': stamp(order.created_at),
        'updatedAt': stamp(order.updated_at),
    }


def list_orders(params):
    page = parse_positive(params.get('page'), PAGE_DEFAULT)
    limit = min(parse_positive(params.get('limit'), LIMIT_DEFAULT), LIMIT_MAX)

    orders = Order.objects.all()

    status = (params.get('status') or '').strip().upper()
    if status:
        if status != STATUS_PURCHASED:
            raise OrderError(400, 'INVALID_QUERY', 'status must be PURCHASED')
        orders = orders.filter(status=status)

    search = (params.get('search') or '').strip()
    if search:
        orders = orders.annotate(
            customer_full_name=Concat('user__first_name', Value(' '), 'user__last_name'),
        ).filter(
            Q(user__email__icontains=search)
            | Q(customer_full_name__icontains=search)
            | Q(shipping_address_snapshot__icontains=search)
        )

    total_items = orders.count()
    start = (page - 1) * limit
    page_rows = orders.order_by('-created_at', '-order_id')[start:start + limit]
    return {
        'page': page,
        'limit': limit,
        'totalItems': total_items,
        'totalPages': math.ceil(total_items / limit) if total_items else 0,
        'items': [summary(order) for order in page_rows],
    }


def find_order(order_id):
    order = Order.objects.select_related('user').filter(pk=order_id).first()
    if order is None:
        raise OrderError(404, 'ORDER_NOT_FOUND', f'order with id {order_id} was not found')
    return order


def get_order(order_id):
    return detail(find_order(order_id))


def clean_address(payload):
    if not isinstance(payload, dict):
        raise OrderError(400, 'VALIDATION_ERROR', 'invalid request data', {
            'shippingAddressSnapshot': 'shippingAddressSnapshot must be an object',
        })

    address = {}
    errors = {}
    for field, (required, max_length) in ADDRESS_FIELDS.items():
        raw = payload.get(field)
        value = None if raw is None else str(raw).strip()[:max_length]
        address[field] = value or None
        if required and not value:
            errors[field] = f'{field} is required'

    phone = address['phoneNumber']
    if phone and not PHONE_PATTERN.match(phone):
        errors['phoneNumber'] = 'phoneNumber format is invalid'
    postal = address['postalCode']
    if postal and not POSTAL_PATTERN.match(postal):
        errors['postalCode'] = 'postalCode format is invalid'

    if errors:
        raise OrderError(400, 'VALIDATION_ERROR', ADDRESS_REQUIRED_MESSAGE, errors)
    return address


def update_order(order_id, body):
    snapshot = body.get('shippingAddressSnapshot') if isinstance(body, dict) else None
    address = clean_address(snapshot if isinstance(snapshot, dict) else body)

    with transaction.atomic():
        order = find_order(order_id)
        # only the shipping snapshot changes; billing and everything else stay as they were
        order.shipping_address_snapshot = address
        order.save(update_fields=['shipping_address_snapshot', 'updated_at'])
    return detail(order)


def delete_order(order_id):
    with transaction.atomic():
        order = find_order(order_id)
        order.delete()
    return {'orderId': order_id, 'deleted': True}
