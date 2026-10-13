from datetime import date, timedelta
from decimal import Decimal
from itertools import count

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.catalog.models import Product, ProductVariant
from apps.orders.models import Order, OrderItem

BASE = '/api/admin/orders'
_n = count(1)

ADDRESS = {
    'fullName': 'Somchai Jaidee',
    'phoneNumber': '0812345678',
    'addressLine1': '1 Main Road',
    'addressLine2': None,
    'district': 'Bang Rak',
    'province': 'Bangkok',
    'postalCode': '10500',
    'country': 'Thailand',
}


def make_user(email=None, first='Mali', last='Rak'):
    return User.objects.create(
        email=email or f'buyer{next(_n)}@example.com', password_hash='x', first_name=first,
        last_name=last, date_of_birth=date(2000, 1, 1), phone_number='0800000000',
    )


def make_admin(is_active=True):
    return Admin.objects.create(
        email=f'boss{next(_n)}@example.com', password_hash='x', display_name='Boss', is_active=is_active,
    )


def make_order(user=None, total='120.00', address=None, age_days=0):
    snapshot = address or dict(ADDRESS)
    order = Order.objects.create(
        user=user or make_user(), subtotal=Decimal('100.00'), shipping_fee=Decimal('10.00'),
        vat_amount=Decimal('10.00'), total=Decimal(total),
        shipping_address_snapshot=snapshot, billing_address_snapshot=dict(ADDRESS, fullName='Billing Person'),
    )
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(days=age_days))
    return order


def add_item(order, variant=None, qty=2):
    return OrderItem.objects.create(
        order=order, product_variant=variant, snapshot_product_name='Tee', snapshot_color='Black',
        snapshot_size='M', snapshot_unit_price=Decimal('50.00'),
        snapshot_compare_at_price=Decimal('60.00'), quantity=qty, line_total=Decimal('50.00') * qty,
    )


class AdminOrderCase(TestCase):
    def login_admin(self):
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token


class GuardTests(AdminOrderCase):
    def calls(self, order_id):
        return [
            ('get', BASE), ('get', f'{BASE}/{order_id}'),
            ('patch', f'{BASE}/{order_id}'), ('delete', f'{BASE}/{order_id}'),
        ]

    def test_no_session_is_401(self):
        order = make_order()
        for method, url in self.calls(order.pk):
            res = getattr(self.client, method)(url, content_type='application/json')
            self.assertEqual(res.status_code, 401, url)
            self.assertEqual(res.json()['code'], 'UNAUTHORIZED')

    def test_customer_session_is_403(self):
        order = make_order()
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        for method, url in self.calls(order.pk):
            res = getattr(self.client, method)(url, content_type='application/json')
            self.assertEqual(res.status_code, 403, url)
            self.assertEqual(res.json()['code'], 'FORBIDDEN')

    def test_inactive_admin_is_403(self):
        order = make_order()
        token, _ = create_session(make_admin(is_active=False), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.client.get(f'{BASE}/{order.pk}').status_code, 403)
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())


class ListTests(AdminOrderCase):
    def setUp(self):
        self.login_admin()

    def test_newest_first_with_summary_shape(self):
        old = make_order(age_days=3)
        new = make_order(age_days=0)
        res = self.client.get(BASE)
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual([o['orderId'] for o in data['items']], [new.pk, old.pk])
        self.assertEqual(
            (data['page'], data['limit'], data['totalItems'], data['totalPages']), (1, 20, 2, 1),
        )
        first = data['items'][0]
        self.assertEqual(set(first), {
            'orderId', 'userId', 'status', 'subtotal', 'shippingFee', 'vatAmount', 'total', 'createdAt',
        })
        self.assertEqual(first['status'], 'PURCHASED')
        self.assertEqual(first['total'], 120.0)

    def test_empty_list_has_zero_pages(self):
        data = self.client.get(BASE).json()['data']
        self.assertEqual((data['totalItems'], data['totalPages'], data['items']), (0, 0, []))

    def test_paging(self):
        orders = [make_order(age_days=i) for i in range(5)]
        data = self.client.get(f'{BASE}?page=2&limit=2').json()['data']
        self.assertEqual((data['page'], data['limit'], data['totalItems'], data['totalPages']), (2, 2, 5, 3))
        self.assertEqual([o['orderId'] for o in data['items']], [orders[2].pk, orders[3].pk])

    def test_limit_is_capped_at_100(self):
        self.assertEqual(self.client.get(f'{BASE}?limit=500').json()['data']['limit'], 100)

    def test_bad_page_or_limit_is_rejected(self):
        for query in ('page=0', 'page=abc', 'limit=-1', 'limit=x'):
            res = self.client.get(f'{BASE}?{query}')
            self.assertEqual(res.status_code, 400, query)
            self.assertEqual(res.json()['code'], 'INVALID_QUERY')

    def test_status_filter(self):
        make_order()
        self.assertEqual(self.client.get(f'{BASE}?status=purchased').json()['data']['totalItems'], 1)
        res = self.client.get(f'{BASE}?status=SHIPPED')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_QUERY')

    def test_search_by_email_name_and_address(self):
        by_mail = make_order(user=make_user(email='findme@example.com'))
        by_name = make_order(user=make_user(first='Zelda', last='Quartz'))
        by_addr = make_order(address=dict(ADDRESS, district='Unique Village'))
        make_order()

        def ids(term):
            data = self.client.get(f'{BASE}?search={term}').json()['data']
            return [o['orderId'] for o in data['items']]

        self.assertEqual(ids('FINDME'), [by_mail.pk])
        self.assertEqual(ids('zelda quartz'), [by_name.pk])
        self.assertEqual(ids('unique village'), [by_addr.pk])
        self.assertEqual(ids('nomatch'), [])


class DetailTests(AdminOrderCase):
    def setUp(self):
        self.login_admin()

    def test_detail_has_customer_totals_snapshots_and_items(self):
        user = make_user(email='who@example.com', first='Mali', last='Rak')
        order = make_order(user=user)
        item = add_item(order)
        res = self.client.get(f'{BASE}/{order.pk}')
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['customer'], {'userId': user.pk, 'email': 'who@example.com', 'name': 'Mali Rak'})
        self.assertEqual(
            (data['subtotal'], data['shippingFee'], data['vatAmount'], data['total']),
            (100.0, 10.0, 10.0, 120.0),
        )
        self.assertEqual(data['shippingAddressSnapshot'], ADDRESS)
        self.assertEqual(data['billingAddressSnapshot']['fullName'], 'Billing Person')
        self.assertEqual(len(data['items']), 1)
        line = data['items'][0]
        self.assertEqual(line['orderItemId'], item.pk)
        self.assertEqual(line['snapshotProductName'], 'Tee')
        self.assertEqual(line['snapshotCompareAtPrice'], 60.0)
        self.assertEqual((line['quantity'], line['lineTotal']), (2, 100.0))
        self.assertIsNone(line['productVariantId'])
        self.assertIn('createdAt', data)
        self.assertIn('updatedAt', data)

    def test_name_falls_back_to_email(self):
        user = make_user(first='', last='')
        order = make_order(user=user)
        self.assertEqual(self.client.get(f'{BASE}/{order.pk}').json()['data']['customer']['name'], user.email)

    def test_bad_and_unknown_ids(self):
        for bad in ('0', 'abc', '-1', '1.5'):
            res = self.client.get(f'{BASE}/{bad}')
            self.assertEqual(res.status_code, 400, bad)
            self.assertEqual(res.json()['code'], 'INVALID_ORDER_ID')
        res = self.client.get(f'{BASE}/999999')
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'ORDER_NOT_FOUND')


class UpdateTests(AdminOrderCase):
    def setUp(self):
        self.login_admin()
        self.order = make_order()
        self.url = f'{BASE}/{self.order.pk}'
        self.new_address = dict(ADDRESS, fullName='New Name', addressLine1='99 New Street')

    def patch(self, body, url=None):
        return self.client.patch(url or self.url, body, content_type='application/json')

    def test_updates_only_the_shipping_snapshot(self):
        before = Order.objects.get(pk=self.order.pk)
        res = self.patch({'shippingAddressSnapshot': self.new_address})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['shippingAddressSnapshot'], self.new_address)
        after = Order.objects.get(pk=self.order.pk)
        self.assertEqual(after.shipping_address_snapshot, self.new_address)
        self.assertEqual(after.billing_address_snapshot, before.billing_address_snapshot)
        self.assertEqual(
            (after.subtotal, after.shipping_fee, after.vat_amount, after.total, after.status),
            (before.subtotal, before.shipping_fee, before.vat_amount, before.total, before.status),
        )

    def test_accepts_top_level_fields_and_trims(self):
        body = dict(self.new_address, fullName='  Padded Name  ', addressLine2='')
        res = self.patch(body)
        self.assertEqual(res.status_code, 200)
        snapshot = res.json()['data']['shippingAddressSnapshot']
        self.assertEqual(snapshot['fullName'], 'Padded Name')
        self.assertIsNone(snapshot['addressLine2'])

    def test_extra_keys_are_not_stored(self):
        res = self.patch({'shippingAddressSnapshot': dict(self.new_address, total=1), 'total': 1})
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('total', res.json()['data']['shippingAddressSnapshot'])
        self.assertEqual(Order.objects.get(pk=self.order.pk).total, Decimal('120.00'))

    def test_missing_fields_report_details(self):
        res = self.patch({'shippingAddressSnapshot': {'fullName': 'Only Name'}})
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body['code'], 'VALIDATION_ERROR')
        self.assertEqual(
            set(body['details']),
            {'phoneNumber', 'addressLine1', 'district', 'province', 'postalCode', 'country'},
        )
        self.assertEqual(Order.objects.get(pk=self.order.pk).shipping_address_snapshot, ADDRESS)

    def test_bad_phone_and_postal_code(self):
        res = self.patch(dict(self.new_address, phoneNumber='abc', postalCode='!!'))
        self.assertEqual(res.status_code, 400)
        details = res.json()['details']
        self.assertEqual(set(details), {'phoneNumber', 'postalCode'})
        self.assertIn('invalid', details['phoneNumber'])

    def test_non_object_snapshot_and_body(self):
        for body in ({'shippingAddressSnapshot': 'x'}, [1, 2]):
            res = self.patch(body)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'VALIDATION_ERROR')

    def test_bad_and_unknown_ids(self):
        res = self.patch(self.new_address, f'{BASE}/abc')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_ORDER_ID'))
        res = self.patch(self.new_address, f'{BASE}/999999')
        self.assertEqual((res.status_code, res.json()['code']), (404, 'ORDER_NOT_FOUND'))


class DeleteTests(AdminOrderCase):
    def setUp(self):
        self.login_admin()

    def test_delete_removes_order_and_items_but_not_stock_or_others(self):
        product = Product.objects.create(product_type='TOP', is_active=True)
        variant = ProductVariant.objects.create(
            product=product, sku_code='DEL-1', colour='Black', size='M', price=Decimal('50.00'), stock_qty=3,
        )
        order = make_order()
        other = make_order()
        add_item(order, variant=variant)
        add_item(other)
        res = self.client.delete(f'{BASE}/{order.pk}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'orderId': order.pk, 'deleted': True})
        self.assertFalse(Order.objects.filter(pk=order.pk).exists())
        self.assertFalse(OrderItem.objects.filter(order_id=order.pk).exists())
        self.assertTrue(OrderItem.objects.filter(order=other).exists())
        variant.refresh_from_db()
        self.assertEqual(variant.stock_qty, 3)

    def test_bad_and_unknown_ids(self):
        res = self.client.delete(f'{BASE}/0')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_ORDER_ID'))
        res = self.client.delete(f'{BASE}/999999')
        self.assertEqual((res.status_code, res.json()['code']), (404, 'ORDER_NOT_FOUND'))

    def test_second_delete_is_404(self):
        order = make_order()
        self.client.delete(f'{BASE}/{order.pk}')
        self.assertEqual(self.client.delete(f'{BASE}/{order.pk}').status_code, 404)
