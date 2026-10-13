from datetime import date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.analytics.models import AnalyticsEvent
from apps.cart.models import Wishlist
from apps.catalog.models import (
    Category, Product, ProductCategory, ProductTranslation, ProductVariant,
)
from apps.orders.models import Order, OrderItem

URL = '/api/admin/dashboard/summary'


def make_user(email='buyer@example.com'):
    return User.objects.create(
        email=email, password_hash='x', first_name='A', last_name='B',
        date_of_birth=date(2000, 1, 1), phone_number='0800000000',
    )


def make_admin(email='boss@example.com', is_active=True):
    return Admin.objects.create(email=email, password_hash='x', display_name='Boss', is_active=is_active)


def at(day, hour=12):
    """A timezone aware moment on the given local date."""
    return timezone.make_aware(datetime(day.year, day.month, day.day, hour))


class Shop:
    """Small factory for products and orders."""

    def __init__(self):
        self.user = make_user()
        self.n = 0

    def product(self, name, category=None):
        self.n += 1
        product = Product.objects.create(product_type='TOP')
        ProductTranslation.objects.create(product=product, language_code='EN', name=name)
        if category:
            cat, _ = Category.objects.get_or_create(category_name=category, defaults={'slug': category.lower()})
            ProductCategory.objects.create(product=product, category=cat, is_primary=True)
        variant = ProductVariant.objects.create(
            product=product, sku_code=f'SKU-{self.n}', colour='Black', size='M',
            price=Decimal('10.00'), stock_qty=100,
        )
        return product, variant

    def order(self, when, lines, status='PURCHASED'):
        """lines is a list of (variant, quantity, line_total)."""
        total = sum(Decimal(line[2]) for line in lines)
        order = Order.objects.create(user=self.user, status=status, subtotal=total, total=total)
        for variant, qty, line_total in lines:
            OrderItem.objects.create(
                order=order, product_variant=variant, snapshot_product_name='x',
                snapshot_unit_price=Decimal('10.00'), quantity=qty, line_total=Decimal(line_total),
            )
        Order.objects.filter(pk=order.pk).update(created_at=when)
        return order


class DashboardTestCase(TestCase):
    def login(self, admin=None):
        token, _ = create_session(admin or make_admin(), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token

    def summary(self, **params):
        res = self.client.get(URL, params)
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()['data']


class GuardTests(DashboardTestCase):
    def test_no_session_is_401(self):
        self.assertEqual(self.client.get(URL).status_code, 401)

    def test_customer_session_is_403(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_inactive_admin_is_403(self):
        self.login(make_admin(is_active=False))
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_admin_gets_envelope(self):
        self.login()
        res = self.client.get(URL)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'success')


class ValidationTests(DashboardTestCase):
    def setUp(self):
        self.login()

    def error(self, **params):
        res = self.client.get(URL, params)
        self.assertEqual(res.status_code, 400)
        return res.json()['code']

    def test_unknown_period(self):
        self.assertEqual(self.error(period='yearly'), 'INVALID_QUERY')

    def test_custom_needs_both_dates(self):
        self.assertEqual(self.error(period='custom', **{'from': '2026-01-01'}), 'INVALID_DATE_RANGE')
        self.assertEqual(self.error(period='custom'), 'INVALID_DATE_RANGE')

    def test_dates_without_period_count_as_custom(self):
        self.assertEqual(self.error(**{'from': '2026-01-01'}), 'INVALID_DATE_RANGE')

    def test_bad_date_format(self):
        self.assertEqual(self.error(**{'from': '01/02/2026', 'to': '2026-02-01'}), 'INVALID_DATE_RANGE')
        self.assertEqual(self.error(**{'from': '2026-1-2', 'to': '2026-02-01'}), 'INVALID_DATE_RANGE')

    def test_impossible_date(self):
        self.assertEqual(self.error(**{'from': '2026-02-30', 'to': '2026-03-01'}), 'INVALID_DATE_RANGE')

    def test_from_after_to(self):
        self.assertEqual(self.error(**{'from': '2026-03-02', 'to': '2026-03-01'}), 'INVALID_DATE_RANGE')

    def test_range_at_the_calendar_edge(self):
        self.assertEqual(self.error(**{'from': '0001-01-01', 'to': '0001-01-05'}), 'INVALID_DATE_RANGE')

    def test_dates_ignored_for_preset_period(self):
        res = self.client.get(URL, {'period': '7d', 'from': 'junk'})
        self.assertEqual(res.status_code, 200)


class TotalsTests(DashboardTestCase):
    def setUp(self):
        self.shop = Shop()
        self.product, self.variant = self.shop.product('Tee', 'Men')
        self.login()

    def custom(self, first, last):
        return self.summary(**{'period': 'custom', 'from': first, 'to': last})

    def test_totals_and_chart_for_custom_range(self):
        self.shop.order(at(date(2026, 3, 2)), [(self.variant, 2, '20.00')])
        self.shop.order(at(date(2026, 3, 2), 18), [(self.variant, 1, '10.50')])
        self.shop.order(at(date(2026, 3, 4)), [(self.variant, 3, '30.00')])
        data = self.custom('2026-03-01', '2026-03-05')

        self.assertEqual(data['period'], {'from': '2026-03-01', 'to': '2026-03-05', 'granularity': 'day'})
        self.assertEqual(data['revenue'], {'total': 60.5, 'growth': 0, 'currency': 'USD'})
        self.assertEqual(data['orders'], {'total': 3, 'growth': 0})
        self.assertEqual(data['productsSold'], {'total': 6, 'growth': 0})
        self.assertEqual(data['charts'], {
            'labels': ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'],
            'revenue': [0, 30.5, 0, 30.0, 0],
            'orders': [0, 2, 0, 1, 0],
            'productsSold': [0, 3, 0, 3, 0],
        })

    def test_empty_period_is_all_zeros(self):
        data = self.custom('2026-03-01', '2026-03-03')
        self.assertEqual(data['revenue']['total'], 0)
        self.assertEqual(data['charts']['orders'], [0, 0, 0])
        self.assertEqual(data['salesByCategory'], [])
        self.assertEqual(data['topSellers'], [])

    def test_growth_against_previous_window(self):
        # previous window is 03-01..03-03, current is 03-04..03-06
        self.shop.order(at(date(2026, 3, 2)), [(self.variant, 2, '40.00')])
        self.shop.order(at(date(2026, 3, 5)), [(self.variant, 3, '60.00')])
        self.shop.order(at(date(2026, 3, 6)), [(self.variant, 3, '30.00')])
        data = self.custom('2026-03-04', '2026-03-06')
        self.assertEqual(data['revenue']['total'], 90)
        self.assertEqual(data['revenue']['growth'], 125.0)
        self.assertEqual(data['orders']['growth'], 100.0)
        self.assertEqual(data['productsSold']['growth'], 200.0)

    def test_negative_growth_rounds_to_one_decimal(self):
        self.shop.order(at(date(2026, 3, 2)), [(self.variant, 1, '30.00')])
        self.shop.order(at(date(2026, 3, 5)), [(self.variant, 1, '20.00')])
        data = self.custom('2026-03-04', '2026-03-06')
        self.assertEqual(data['revenue']['growth'], -33.3)

    def test_orders_outside_window_are_ignored(self):
        self.shop.order(at(date(2026, 2, 27)), [(self.variant, 1, '10.00')])
        self.shop.order(at(date(2026, 3, 9)), [(self.variant, 1, '10.00')])
        data = self.custom('2026-03-01', '2026-03-05')
        self.assertEqual(data['orders']['total'], 0)

    def test_window_edges_use_the_project_time_zone(self):
        # 23:30 on 3 March in Bangkok is still 3 March, although it is 16:30 UTC
        self.shop.order(at(date(2026, 3, 3), 23), [(self.variant, 1, '10.00')])
        # 00:30 on 4 March in Bangkok is 17:30 UTC on 3 March
        self.shop.order(timezone.make_aware(datetime(2026, 3, 4, 0, 30)), [(self.variant, 1, '5.00')])
        data = self.custom('2026-03-03', '2026-03-03')
        self.assertEqual(data['orders']['total'], 1)
        self.assertEqual(data['revenue']['total'], 10)

    def test_single_day_range_has_one_label(self):
        data = self.custom('2026-03-03', '2026-03-03')
        self.assertEqual(data['charts']['labels'], ['2026-03-03'])


class PeriodTests(DashboardTestCase):
    def setUp(self):
        self.login()
        self.today = date(2026, 10, 14)  # a Wednesday

    def run_period(self, period):
        with patch('apps.analytics.services.timezone.localdate', return_value=self.today):
            res = self.client.get(URL, {'period': period})
        self.assertEqual(res.status_code, 200)
        return res.json()['data']

    def test_7d(self):
        data = self.run_period('7d')
        self.assertEqual(data['period'], {'from': '2026-10-08', 'to': '2026-10-14', 'granularity': 'day'})
        self.assertEqual(len(data['charts']['labels']), 7)

    def test_30d(self):
        data = self.run_period('30d')
        self.assertEqual(data['period']['from'], '2026-09-15')
        self.assertEqual(len(data['charts']['revenue']), 30)

    def test_weekly_is_monday_to_sunday(self):
        data = self.run_period('weekly')
        self.assertEqual(data['period'], {'from': '2026-10-12', 'to': '2026-10-18', 'granularity': 'day'})
        self.assertEqual(len(data['charts']['labels']), 7)

    def test_default_is_weekly(self):
        with patch('apps.analytics.services.timezone.localdate', return_value=self.today):
            data = self.client.get(URL).json()['data']
        self.assertEqual(data['period']['from'], '2026-10-12')

    def test_monthly_has_twelve_month_labels(self):
        shop = Shop()
        _, variant = shop.product('Tee', 'Men')
        shop.order(at(date(2026, 1, 15)), [(variant, 1, '10.00')])
        shop.order(at(date(2026, 1, 20)), [(variant, 2, '20.00')])
        shop.order(at(date(2026, 10, 1)), [(variant, 1, '7.00')])
        data = self.run_period('monthly')
        self.assertEqual(data['period'], {'from': '2026-01-01', 'to': '2026-12-31', 'granularity': 'month'})
        self.assertEqual(data['charts']['labels'][0], '2026-01')
        self.assertEqual(len(data['charts']['labels']), 12)
        self.assertEqual(data['charts']['revenue'][0], 30)
        self.assertEqual(data['charts']['orders'][0], 2)
        self.assertEqual(data['charts']['productsSold'][0], 3)
        self.assertEqual(data['charts']['orders'][9], 1)
        self.assertEqual(data['revenue']['total'], 37)


class ContentTests(DashboardTestCase):
    def setUp(self):
        self.shop = Shop()
        self.login()
        self.day = date(2026, 3, 3)

    def custom(self):
        return self.summary(**{'period': 'custom', 'from': '2026-03-01', 'to': '2026-03-05'})

    def test_sales_by_category_is_real_and_period_scoped(self):
        _, tee = self.shop.product('Tee', 'Men')
        _, dress = self.shop.product('Dress', 'Women')
        _, hat = self.shop.product('Hat', 'Kids')
        self.shop.order(at(self.day), [(tee, 1, '10.00'), (dress, 2, '50.00')])
        self.shop.order(at(self.day), [(tee, 1, '15.00')])
        self.shop.order(at(date(2026, 4, 1)), [(hat, 5, '99.00')])
        data = self.custom()
        self.assertEqual(data['salesByCategory'], [
            {'label': 'Women', 'value': 50.0},
            {'label': 'Men', 'value': 25.0},
        ])

    def test_products_without_primary_category_are_left_out_of_categories(self):
        _, bare = self.shop.product('Bare')
        self.shop.order(at(self.day), [(bare, 1, '10.00')])
        data = self.custom()
        self.assertEqual(data['salesByCategory'], [])
        self.assertEqual(data['productsSold']['total'], 1)

    def test_top_sellers_sorted_with_likes_and_limited_to_five(self):
        variants = []
        for i in range(6):
            product, variant = self.shop.product(f'P{i}', 'Men')
            variants.append((product, variant))
            self.shop.order(at(self.day), [(variant, i + 1, '10.00')])
        # P5 is best with 6 sold, P0 is the sixth with 1 sold
        Wishlist.objects.create(user=self.shop.user, product=variants[5][0])
        other = make_user('other@example.com')
        Wishlist.objects.create(user=other, product=variants[5][0])
        data = self.custom()
        sellers = data['topSellers']
        self.assertEqual(len(sellers), 5)
        self.assertEqual(sellers[0], {
            'productId': variants[5][0].pk, 'label': 'P5', 'category': 'Men',
            'salesValue': 6, 'likesCount': 2,
        })
        self.assertEqual([s['label'] for s in sellers], ['P5', 'P4', 'P3', 'P2', 'P1'])

    def test_top_sellers_follow_the_selected_period(self):
        _, old = self.shop.product('Old', 'Men')
        _, new = self.shop.product('New', 'Men')
        self.shop.order(at(date(2025, 1, 1)), [(old, 50, '10.00')])
        self.shop.order(at(self.day), [(new, 1, '10.00')])
        data = self.custom()
        self.assertEqual([s['label'] for s in data['topSellers']], ['New'])

    def test_total_likes_counts_all_favourites(self):
        product, _ = self.shop.product('Tee', 'Men')
        Wishlist.objects.create(user=self.shop.user, product=product)
        Wishlist.objects.create(user=make_user('b@example.com'), product=product)
        self.assertEqual(self.custom()['totalLikes'], 2)

    def test_unique_viewers_from_product_view_events(self):
        product, _ = self.shop.product('Tee', 'Men')
        buyer = self.shop.user

        def view(user=None, session=None, kind='PRODUCT_VIEW', when=None):
            event = AnalyticsEvent.objects.create(
                user=user, session_id=session, event_type=kind, product=product,
            )
            AnalyticsEvent.objects.filter(pk=event.pk).update(created_at=when or at(self.day))

        view(user=buyer)
        view(user=buyer)                      # same signed-in user counts once
        view(user=buyer, session='s1')        # user wins over session
        view(session='s1')
        view(session='s1')                    # same anonymous id counts once
        view(session='s2')
        view(session='')                      # blank identifier is ignored
        view()                                # no identifier is ignored
        view(session='s3', kind='PRODUCT_LIKE')   # not a view
        view(session='s4', when=at(date(2026, 4, 1)))  # outside the period
        self.assertEqual(self.custom()['uniqueViewers'], 3)

    def test_recent_activity_lists_latest_known_events(self):
        for i in range(7):
            event = AnalyticsEvent.objects.create(event_type='PRODUCT_LIKE')
            AnalyticsEvent.objects.filter(pk=event.pk).update(created_at=at(self.day, i + 1))
        AnalyticsEvent.objects.create(event_type='SEARCH')
        data = self.custom()
        self.assertEqual(len(data['recentActivity']), 5)
        self.assertEqual(data['recentActivity'][0]['type'], 'PRODUCT_LIKE')
        self.assertEqual(data['recentActivity'][0]['message'], 'Product liked')
