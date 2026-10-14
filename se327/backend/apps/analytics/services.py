import re
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import Count, Sum
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone

from apps.cart.models import Wishlist
from apps.catalog.models import ProductCategory, ProductTranslation
from apps.orders.models import Order, OrderItem

from .models import AnalyticsEvent

PERIODS = ('7d', '30d', 'weekly', 'monthly', 'custom')
CURRENCY = 'USD'
TOP_SELLERS_LIMIT = 5
RECENT_ACTIVITY_LIMIT = 5
DATE_PATTERN = re.compile(r'^\d{4}-\d{2}-\d{2}$')
CATEGORY_NAME = 'product_variant__product__product_categories__category__category_name'

ACTIVITY_MESSAGES = {
    AnalyticsEvent.EventType.PURCHASE: 'New order placed',
    AnalyticsEvent.EventType.PRODUCT_LIKE: 'Product liked',
    AnalyticsEvent.EventType.PRODUCT_COMMENT: 'New comment received',
}


class DashboardError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def parse_date(value):
    if value is None or not DATE_PATTERN.match(value):
        raise DashboardError('INVALID_DATE_RANGE', 'from and to must be dates in YYYY-MM-DD format')
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise DashboardError('INVALID_DATE_RANGE', 'from and to must be real calendar dates')


def parse_range(params, today=None):
    """Return (granularity, first_day, last_day). All days are in the project time zone."""
    today = today or timezone.localdate()
    has_dates = 'from' in params or 'to' in params
    period = (params.get('period') or '').strip() or ('custom' if has_dates else 'weekly')

    if period not in PERIODS:
        raise DashboardError('INVALID_QUERY', 'period must be one of 7d, 30d, weekly, monthly, custom')

    granularity = 'day'
    if period == 'custom':
        first = parse_date(params.get('from'))
        last = parse_date(params.get('to'))
        if first > last:
            raise DashboardError('INVALID_DATE_RANGE', 'from must not be after to')
    elif period == 'weekly':
        first = today - timedelta(days=today.weekday())
        last = first + timedelta(days=6)
    elif period == 'monthly':
        first = date(today.year, 1, 1)
        last = date(today.year, 12, 31)
        granularity = 'month'
    else:
        first = today - timedelta(days=int(period[:-1]) - 1)
        last = today
    return granularity, first, last


def day_start(day):
    return timezone.make_aware(datetime.combine(day, time.min))


def growth(current, previous):
    if not previous:
        return 0
    return round(float((current - previous) / previous * 100), 1)


def money(value):
    return round(float(value or 0), 2)


def purchased(start, end):
    return Order.objects.filter(status=Order.Status.PURCHASED, created_at__gte=start, created_at__lt=end)


def totals(start, end):
    """Revenue, order count and units sold for orders created in [start, end)."""
    orders = purchased(start, end)
    summary = orders.aggregate(revenue=Sum('total'), count=Count('order_id'))
    units = OrderItem.objects.filter(order__in=orders).aggregate(units=Sum('quantity'))['units']
    return Decimal(summary['revenue'] or 0), summary['count'], units or 0


def label_for(bucket, granularity):
    if isinstance(bucket, datetime):
        bucket = timezone.localtime(bucket).date()
    return bucket.strftime('%Y-%m') if granularity == 'month' else bucket.isoformat()


def make_labels(granularity, first, last):
    if granularity == 'month':
        return [f'{first.year}-{month:02d}' for month in range(1, 13)]
    return [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]


def chart_series(start, end, granularity, labels):
    trunc = TruncMonth if granularity == 'month' else TruncDate
    orders = purchased(start, end)
    per_order = (
        orders.annotate(bucket=trunc('created_at')).values('bucket')
        .annotate(revenue=Sum('total'), count=Count('order_id'))
    )
    per_item = (
        OrderItem.objects.filter(order__in=orders).annotate(bucket=trunc('order__created_at'))
        .values('bucket').annotate(units=Sum('quantity'))
    )
    revenue = dict.fromkeys(labels, 0)
    count = dict.fromkeys(labels, 0)
    units = dict.fromkeys(labels, 0)
    for row in per_order:
        label = label_for(row['bucket'], granularity)
        revenue[label] = money(row['revenue'])
        count[label] = row['count']
    for row in per_item:
        units[label_for(row['bucket'], granularity)] = row['units']
    return {
        'labels': labels,
        'revenue': [revenue[label] for label in labels],
        'orders': [count[label] for label in labels],
        'productsSold': [units[label] for label in labels],
    }


def sales_by_category(start, end):
    rows = (
        OrderItem.objects.filter(
            order__in=purchased(start, end),
            product_variant__product__product_categories__is_primary=True,
        )
        .values(CATEGORY_NAME)
        .annotate(value=Sum('line_total'))
        .order_by('-value', CATEGORY_NAME)
    )
    return [{'label': row[CATEGORY_NAME], 'value': money(row['value'])} for row in rows]


def top_sellers(start, end):
    rows = list(
        OrderItem.objects.filter(order__in=purchased(start, end), product_variant__isnull=False)
        .values('product_variant__product_id')
        .annotate(sold=Sum('quantity'))
        .order_by('-sold', 'product_variant__product_id')[:TOP_SELLERS_LIMIT]
    )
    ids = [row['product_variant__product_id'] for row in rows]
    names = dict(
        ProductTranslation.objects.filter(product_id__in=ids, language_code='EN')
        .values_list('product_id', 'name')
    )
    categories = dict(
        ProductCategory.objects.filter(product_id__in=ids, is_primary=True)
        .values_list('product_id', 'category__category_name')
    )
    likes = dict(
        Wishlist.objects.filter(product_id__in=ids).values('product_id')
        .annotate(n=Count('wishlist_id')).values_list('product_id', 'n')
    )
    return [
        {
            'productId': pid,
            'label': names.get(pid, ''),
            'category': categories.get(pid, ''),
            'salesValue': row['sold'],
            'likesCount': likes.get(pid, 0),
        }
        for pid, row in zip(ids, rows)
    ]


def unique_viewers(start, end):
    views = AnalyticsEvent.objects.filter(
        event_type=AnalyticsEvent.EventType.PRODUCT_VIEW, created_at__gte=start, created_at__lt=end,
    )
    users = views.filter(user__isnull=False).values('user_id').distinct().count()
    anonymous = (
        views.filter(user__isnull=True, session_id__isnull=False).exclude(session_id='')
        .values('session_id').distinct().count()
    )
    return users + anonymous


def recent_activity():
    events = AnalyticsEvent.objects.filter(event_type__in=list(ACTIVITY_MESSAGES))
    events = events.order_by('-created_at', '-event_id')[:RECENT_ACTIVITY_LIMIT]
    return [
        {
            'type': event.event_type,
            'time': timezone.localtime(event.created_at).isoformat(),
            'message': ACTIVITY_MESSAGES[event.event_type],
        }
        for event in events
    ]


def dashboard_summary(params, today=None):
    granularity, first, last = parse_range(params, today)
    days = (last - first).days + 1
    try:
        start = day_start(first)
        end = day_start(last + timedelta(days=1))
        previous_start = day_start(first - timedelta(days=days))
    except (OverflowError, ValueError):
        raise DashboardError('INVALID_DATE_RANGE', 'date range is out of bounds')

    revenue, orders, units = totals(start, end)
    previous_revenue, previous_orders, previous_units = totals(previous_start, start)
    labels = make_labels(granularity, first, last)

    return {
        'period': {'from': first.isoformat(), 'to': last.isoformat(), 'granularity': granularity},
        'revenue': {'total': money(revenue), 'growth': growth(revenue, previous_revenue), 'currency': CURRENCY},
        'orders': {'total': orders, 'growth': growth(orders, previous_orders)},
        'productsSold': {'total': units, 'growth': growth(units, previous_units)},
        'salesByCategory': sales_by_category(start, end),
        'charts': chart_series(start, end, granularity, labels),
        'totalLikes': Wishlist.objects.count(),
        'uniqueViewers': unique_viewers(start, end),
        'topSellers': top_sellers(start, end),
        'recentActivity': recent_activity(),
    }
