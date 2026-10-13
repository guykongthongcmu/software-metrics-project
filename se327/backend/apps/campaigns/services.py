import json
import logging
from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.db.models import Sum

from apps.accounts.models import User
from apps.catalog.models import Product, ProductTranslation
from apps.orders.models import OrderItem
from common import mail

from .models import Campaign, CampaignProduct
from .storage import banner_url, save_banner

logger = logging.getLogger(__name__)

DISCOUNT_TYPES = (Campaign.Type.PERCENTAGE_DISCOUNT, Campaign.Type.FIXED_DISCOUNT)
IMAGE_TYPES = ('image/jpeg', 'image/png', 'image/webp')
MAX_IMAGE_BYTES = 5 * 1024 * 1024

TYPE_LABELS = {
    Campaign.Type.PERCENTAGE_DISCOUNT: 'Percentage Discount',
    Campaign.Type.FIXED_DISCOUNT: 'Fixed Discount',
    Campaign.Type.BEST_SELLER: 'Best Seller Spotlight',
}


class CampaignError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def invalid(message='invalid request data'):
    return CampaignError(400, 'VALIDATION_ERROR', message)


def parse_date(raw):
    if not isinstance(raw, str) or len(raw) != 10:
        raise invalid('dates must be YYYY-MM-DD')
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise invalid('dates must be YYYY-MM-DD')


def parse_type(raw):
    value = raw.strip().upper() if isinstance(raw, str) else ''
    if value == 'FIXED_AMOUNT_DISCOUNT':
        value = Campaign.Type.FIXED_DISCOUNT
    if value not in Campaign.Type.values:
        raise CampaignError(400, 'INVALID_CAMPAIGN_TYPE', 'type must be BEST_SELLER, PERCENTAGE_DISCOUNT or FIXED_DISCOUNT')
    return value


def parse_discount(raw, campaign_type):
    """Return the discount as a Decimal for discount types, None for best seller."""
    empty = raw is None or raw == ''
    if campaign_type == Campaign.Type.BEST_SELLER:
        if not empty:
            raise invalid('discountValue must be empty for BEST_SELLER')
        return None
    if empty or isinstance(raw, bool):
        raise invalid('discountValue is required')
    try:
        value = Decimal(str(raw))
    except InvalidOperation:
        raise invalid('discountValue must be a number')
    if not value.is_finite() or value <= 0:
        raise invalid('discountValue must be greater than 0')
    if campaign_type == Campaign.Type.PERCENTAGE_DISCOUNT and value > 100:
        raise invalid('discountValue must be at most 100 for a percentage')
    if value >= 10 ** 8:
        raise invalid('discountValue is too large')
    value = value.quantize(Decimal('0.01'))
    if value <= 0:
        raise invalid('discountValue must be greater than 0')
    return value


def parse_basics(payload):
    """Validate the fields shared by both endpoints."""
    if not isinstance(payload, dict):
        raise invalid()
    name = payload.get('name')
    name = name.strip() if isinstance(name, str) else ''
    if not name or len(name) > 150:
        raise invalid('name is required (max 150 characters)')
    campaign_type = parse_type(payload.get('type'))
    message = payload.get('message')
    if message is not None and not isinstance(message, str):
        raise invalid('message must be text')
    message = (message or '').strip() or None
    if message and len(message) > 255:
        raise invalid('message is at most 255 characters')
    start = parse_date(payload.get('startDate'))
    end = parse_date(payload.get('endDate'))
    if start > end:
        raise invalid('startDate must not be after endDate')
    return {
        'name': name, 'type': campaign_type, 'message': message, 'start': start, 'end': end,
        'discount': parse_discount(payload.get('discountValue'), campaign_type),
    }


def parse_product_ids(raw):
    if not isinstance(raw, list) or not raw:
        raise invalid('productIds must be a non-empty list')
    ids = []
    for entry in raw:
        if isinstance(entry, bool) or not isinstance(entry, int) or entry <= 0:
            raise invalid('productIds must be positive integers')
        if entry not in ids:
            ids.append(entry)
    return ids


def existing_product_ids(raw):
    ids = parse_product_ids(raw)
    if Product.objects.filter(pk__in=ids).count() != len(ids):
        raise CampaignError(404, 'PRODUCT_NOT_FOUND', 'one or more productIds were not found')
    return ids


def best_seller_id():
    row = (
        OrderItem.objects.filter(product_variant__product__is_active=True)
        .values('product_variant__product_id')
        .annotate(sold=Sum('quantity'))
        .order_by('-sold', 'product_variant__product_id')
        .first()
    )
    return row['product_variant__product_id'] if row else None


def build_campaign(data, product_ids, admin, status=Campaign.Status.ACTIVE):
    """Save the campaign and its product links and set the product discounts. Caller holds the transaction."""
    campaign = Campaign.objects.create(
        name=data['name'], type=data['type'], message=data['message'], discount_value=data['discount'],
        status=status, start_date=data['start'], end_date=data['end'], created_by_admin=admin,
    )
    CampaignProduct.objects.bulk_create(
        [CampaignProduct(campaign=campaign, product_id=pid) for pid in product_ids]
    )
    if data['type'] in DISCOUNT_TYPES and status == Campaign.Status.ACTIVE:
        if data['type'] == Campaign.Type.PERCENTAGE_DISCOUNT:
            discount_type = Product.DiscountType.PERCENTAGE
        else:
            discount_type = Product.DiscountType.FIXED
        Product.objects.filter(pk__in=product_ids).update(
            campaign_discount_type=discount_type,
            campaign_discount_value=data['discount'],
            campaign_discount_start_date=data['start'],
            campaign_discount_end_date=data['end'],
            campaign_discount_campaign=campaign,
        )
    return campaign


def create_campaign(payload, admin):
    data = parse_basics(payload)
    if data['type'] == Campaign.Type.BEST_SELLER:
        if payload.get('productIds') not in (None, '', []):
            raise invalid('productIds must be empty for BEST_SELLER')
        top = best_seller_id()
        if top is None:
            raise invalid('no sales yet, so there is no best seller')
        product_ids = [top]
    else:
        product_ids = existing_product_ids(payload.get('productIds'))
    with transaction.atomic():
        campaign = build_campaign(data, product_ids, admin)
    return {
        'campaignId': campaign.pk, 'name': campaign.name, 'type': campaign.type, 'status': campaign.status,
        'startDate': campaign.start_date.isoformat(), 'endDate': campaign.end_date.isoformat(),
        'discountValue': float(campaign.discount_value) if campaign.discount_value is not None else None,
        'productIds': product_ids, 'createdAt': campaign.created_at.isoformat(),
    }


def parse_launch_payload(raw):
    """campaignData arrives as a JSON string in the multipart form."""
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raw = None
    if not isinstance(raw, dict):
        raise CampaignError(400, 'INVALID_CAMPAIGN_PAYLOAD', 'campaignData must be a valid JSON object')
    return raw


def parse_channels(raw):
    if raw is None:
        return {'web': True, 'email': False}
    if not isinstance(raw, dict) or not all(isinstance(raw.get(k, False), bool) for k in ('web', 'email')):
        raise invalid('channels must be { web: boolean, email: boolean }')
    return {'web': raw.get('web', False), 'email': raw.get('email', False)}


def check_image(upload):
    if upload is None:
        raise invalid('mediaFile (banner image) is required')
    if upload.content_type not in IMAGE_TYPES:
        raise invalid('banner image must be a jpeg, png or webp file')
    if upload.size > MAX_IMAGE_BYTES:
        raise invalid('banner image must be 5 MB or smaller')


def offer_label(campaign_type, discount):
    if campaign_type == Campaign.Type.PERCENTAGE_DISCOUNT:
        return f'{discount.normalize():f}% off'
    if campaign_type == Campaign.Type.FIXED_DISCOUNT:
        return f'{discount.normalize():f} off'
    return 'our best seller spotlight'


def send_blast(campaign, label):
    """Email every verified customer. A failed send is counted, never raised."""
    recipients = list(
        User.objects.filter(email_verified_at__isnull=False).order_by('user_id').values_list('email', 'first_name')
    )
    failed = []
    for email, first_name in recipients:
        try:
            sent = mail.send_campaign_email(
                email, first_name, campaign.name, TYPE_LABELS[campaign.type], label,
                campaign.start_date.isoformat(), campaign.end_date.isoformat(),
            )
        except Exception:
            logger.exception('Campaign email crashed for %s', email)
            sent = False
        if not sent:
            failed.append({'email': email, 'error': 'email could not be sent'})
    return {
        'enabled': True, 'totalRecipients': len(recipients), 'sentCount': len(recipients) - len(failed),
        'failedCount': len(failed), 'failedRecipients': failed,
    }


def launch_campaign(raw_data, upload, admin):
    payload = parse_launch_payload(raw_data)
    data = parse_basics(payload)
    channels = parse_channels(payload.get('channels'))
    check_image(upload)

    label = offer_label(data['type'], data['discount'])
    data['message'] = data['message'] or label
    if data['type'] == Campaign.Type.BEST_SELLER:
        top = best_seller_id()
        product_ids = [top] if top else []
    elif payload.get('productIds') not in (None, '', []):
        product_ids = existing_product_ids(payload['productIds'])
    else:
        product_ids = list(Product.objects.filter(is_active=True).values_list('pk', flat=True))

    status = Campaign.Status.ACTIVE if channels['web'] else Campaign.Status.INACTIVE
    with transaction.atomic():
        campaign = build_campaign(data, product_ids, admin, status)
        image_url = save_banner(campaign.pk, upload)

    if channels['email']:
        blast = send_blast(campaign, label)
    else:
        blast = {'enabled': False, 'totalRecipients': 0, 'sentCount': 0, 'failedCount': 0, 'failedRecipients': []}
    return {
        'campaignId': campaign.pk, 'name': campaign.name, 'type': campaign.type,
        'message': campaign.message, 'discountValue': float(data['discount']) if data['discount'] else None,
        'startDate': campaign.start_date.isoformat(), 'endDate': campaign.end_date.isoformat(),
        'channels': channels, 'bannerImageUrl': image_url, 'emailBlast': blast,
    }


def product_summary(product_id, lang):
    names = {t.language_code: t.name for t in ProductTranslation.objects.filter(product_id=product_id)}
    media = Product.objects.get(pk=product_id).media.order_by('-is_hero', '-is_thumbnail', 'sort_order').first()
    return {
        'productId': product_id,
        'name': names.get(lang) or names.get('EN') or next(iter(names.values()), None),
        'image': media.public_url if media else None,
    }


def active_campaigns(lang, today):
    campaigns = Campaign.objects.filter(
        status=Campaign.Status.ACTIVE, start_date__lte=today, end_date__gte=today,
    ).prefetch_related('campaign_products').order_by('-start_date', '-campaign_id')
    result = []
    for campaign in campaigns:
        links = sorted(campaign.campaign_products.all(), key=lambda link: link.pk)
        ids = [link.product_id for link in links]
        item = {
            'campaignId': campaign.pk, 'name': campaign.name, 'type': campaign.type, 'message': campaign.message,
            'startDate': campaign.start_date.isoformat(), 'endDate': campaign.end_date.isoformat(),
            'bannerImageUrl': banner_url(campaign.pk),
        }
        if campaign.type == Campaign.Type.BEST_SELLER:
            item['bestSellerProduct'] = product_summary(ids[0], lang) if ids else None
        else:
            kind = 'PERCENTAGE' if campaign.type == Campaign.Type.PERCENTAGE_DISCOUNT else 'FIXED'
            item['discount'] = {'type': kind, 'value': float(campaign.discount_value)}
            item['productIds'] = ids
        result.append(item)
    return result
