from datetime import date

from django.test import TestCase

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.cart.models import Cart, CartItem
from tests.catalog.test_storefront import add_variant, make_product

CART = '/api/client/cart'
ITEMS = '/api/client/cart/items'


def make_user(email='buyer@example.com'):
    return User.objects.create(
        email=email, password_hash='x', first_name='Buy', last_name='Er',
        date_of_birth=date(2000, 1, 1), phone_number='0812345678',
    )


class CartTestCase(TestCase):
    def setUp(self):
        self.user = make_user()
        self.login(self.user)

    def login(self, user):
        token, _ = create_session(user, Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token

    def add(self, product, colour='Black', size='M', qty=1):
        return self.client.post(
            ITEMS, {'productId': product.pk, 'color': colour, 'size': size, 'quantityCartItem': qty},
            content_type='application/json',
        )

    def put(self, item_id, qty):
        return self.client.put(
            f'{ITEMS}/{item_id}', {'quantityCartItem': qty}, content_type='application/json',
        )


class GuardTests(CartTestCase):
    def test_no_session_is_401(self):
        self.client.cookies.clear()
        for method, url in (('get', CART), ('post', ITEMS), ('put', f'{ITEMS}/1'), ('delete', f'{ITEMS}/1')):
            res = getattr(self.client, method)(url)
            self.assertEqual(res.status_code, 401, url)
            self.assertEqual(res.json()['code'], 'UNAUTHORIZED')

    def test_admin_session_is_403(self):
        admin = Admin.objects.create(email='a@example.com', password_hash='x', display_name='Admin')
        token, _ = create_session(admin, Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        res = self.client.get(CART)
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()['code'], 'FORBIDDEN')


class GetCartTests(CartTestCase):
    def test_empty_cart_when_none_exists(self):
        res = self.client.get(CART)
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertIsNone(data['cartId'])
        self.assertEqual(data['items'], [])
        self.assertEqual(data['cartSummary'], {'totalItems': 0, 'subtotal': 0})

    def test_lines_and_totals(self):
        shirt = make_product('Shirt', price='40.00', compare_at='50.00', stock=9)
        add_variant(shirt, price='45.00', colour='Red', size='L', stock=9)
        self.add(shirt, qty=2)
        self.add(shirt, colour='Red', size='L', qty=1)
        data = self.client.get(CART).json()['data']
        self.assertEqual(data['cartSummary'], {'totalItems': 3, 'subtotal': 125.0})
        first, second = data['items']
        self.assertEqual(first['name'], 'Shirt')
        self.assertEqual(first['color'], 'Black')
        self.assertEqual(first['size'], 'M')
        self.assertEqual(first['price'], 40.0)
        self.assertEqual(first['originalPrice'], 50.0)
        self.assertEqual(first['discount'], {'type': 'percentage', 'value': 20})
        self.assertEqual(first['quantityCartItem'], 2)
        self.assertEqual(first['lineTotal'], 80.0)
        self.assertTrue(first['image'].startswith('https://cdn.test/'))
        self.assertTrue(first['inStock'])
        self.assertEqual(second['originalPrice'], 45.0)
        self.assertIsNone(second['discount'])

    def test_other_customers_cart_is_not_shown(self):
        shirt = make_product('Shirt')
        self.add(shirt)
        self.login(make_user('other@example.com'))
        self.assertEqual(self.client.get(CART).json()['data']['items'], [])

    def test_bad_lang(self):
        res = self.client.get(f'{CART}?lang=FR')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_LANGUAGE')


class AddItemTests(CartTestCase):
    def test_first_add_creates_cart(self):
        shirt = make_product('Shirt', price='30.00')
        res = self.add(shirt, qty=2)
        self.assertEqual(res.status_code, 201)
        data = res.json()['data']
        self.assertEqual(data['item']['quantityCartItem'], 2)
        self.assertEqual(data['cartSummary'], {'totalItems': 2, 'subtotal': 60.0})
        self.assertEqual(Cart.objects.get(pk=data['cartId']).user, self.user)

    def test_adding_same_variant_increases_quantity(self):
        shirt = make_product('Shirt', stock=5)
        self.add(shirt, qty=2)
        res = self.add(shirt, colour='black', size='m', qty=2)
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()['data']['item']['quantityCartItem'], 4)
        self.assertEqual(CartItem.objects.count(), 1)
        self.assertEqual(Cart.objects.filter(user=self.user, status='ACTIVE').count(), 1)

    def test_total_above_stock_is_409(self):
        shirt = make_product('Shirt', stock=3)
        self.add(shirt, qty=2)
        res = self.add(shirt, qty=2)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'INSUFFICIENT_STOCK')
        self.assertEqual(CartItem.objects.get().quantity, 2)

    def test_missing_fields(self):
        res = self.client.post(ITEMS, {'productId': 1}, content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_REQUEST')

    def test_blank_colour(self):
        shirt = make_product('Shirt')
        res = self.add(shirt, colour='  ')
        self.assertEqual(res.json()['code'], 'INVALID_REQUEST')

    def test_list_body_is_invalid_request(self):
        res = self.client.post(ITEMS, [1], content_type='application/json')
        self.assertEqual(res.json()['code'], 'INVALID_REQUEST')

    def test_bad_product_id(self):
        for value in (0, -1, 'abc', True, 1.5):
            res = self.client.post(
                ITEMS, {'productId': value, 'color': 'Black', 'size': 'M', 'quantityCartItem': 1},
                content_type='application/json',
            )
            self.assertEqual(res.json()['code'], 'INVALID_PRODUCT_ID', value)

    def test_bad_quantity(self):
        shirt = make_product('Shirt')
        for value in (0, -2, 'x', 1.5, False):
            res = self.add(shirt, qty=value)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_QUANTITY', value)

    def test_string_numbers_are_accepted(self):
        shirt = make_product('Shirt')
        res = self.client.post(
            ITEMS, {'productId': str(shirt.pk), 'color': 'Black', 'size': 'M', 'quantityCartItem': '2'},
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 201)

    def test_unknown_product(self):
        res = self.client.post(
            ITEMS, {'productId': 99999, 'color': 'Black', 'size': 'M', 'quantityCartItem': 1},
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'PRODUCT_NOT_FOUND')

    def test_inactive_product(self):
        shirt = make_product('Shirt', active=False)
        res = self.add(shirt)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'PRODUCT_NOT_FOUND')

    def test_wrong_or_inactive_variant(self):
        shirt = make_product('Shirt')
        add_variant(shirt, colour='Blue', size='S', active=False)
        for colour, size in (('Green', 'M'), ('Black', 'XL'), ('Blue', 'S')):
            res = self.add(shirt, colour=colour, size=size)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_VARIANT_SELECTION')


class UpdateItemTests(CartTestCase):
    def setUp(self):
        super().setUp()
        self.shirt = make_product('Shirt', price='20.00', stock=4)
        self.item_id = self.add(self.shirt, qty=1).json()['data']['item']['itemId']

    def test_sets_absolute_quantity(self):
        res = self.put(self.item_id, 3)
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['item']['quantityCartItem'], 3)
        self.assertEqual(data['item']['lineTotal'], 60.0)
        self.assertEqual(data['cartSummary'], {'totalItems': 3, 'subtotal': 60.0})

    def test_above_stock_is_409(self):
        res = self.put(self.item_id, 5)
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'INSUFFICIENT_STOCK')
        self.assertEqual(CartItem.objects.get().quantity, 1)

    def test_bad_quantity(self):
        for value in (0, -1, 'a', None, '²'):
            res = self.put(self.item_id, value)
            self.assertEqual(res.json()['code'], 'INVALID_QUANTITY', value)

    def test_bad_item_id(self):
        for value in ('abc', '0', '-3', '²'):
            res = self.put(value, 1)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_ITEM_ID')

    def test_unknown_item(self):
        res = self.put(99999, 1)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'CART_ITEM_NOT_FOUND')

    def test_other_customers_item_is_404(self):
        self.login(make_user('other@example.com'))
        res = self.put(self.item_id, 2)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'CART_ITEM_NOT_FOUND')

    def test_converted_cart_item_is_404(self):
        Cart.objects.update(status='CONVERTED')
        res = self.put(self.item_id, 2)
        self.assertEqual(res.json()['code'], 'CART_ITEM_NOT_FOUND')


class RemoveItemTests(CartTestCase):
    def test_remove_updates_totals(self):
        shirt = make_product('Shirt', price='10.00', stock=5)
        add_variant(shirt, price='15.00', colour='Red', size='S', stock=5)
        keep = self.add(shirt, qty=2).json()['data']['item']['itemId']
        drop = self.add(shirt, colour='Red', size='S', qty=1).json()['data']['item']['itemId']
        res = self.client.delete(f'{ITEMS}/{drop}')
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['itemId'], drop)
        self.assertEqual(data['productId'], shirt.pk)
        self.assertEqual(data['cartSummary'], {'totalItems': 2, 'subtotal': 20.0})
        self.assertEqual(list(CartItem.objects.values_list('pk', flat=True)), [keep])

    def test_bad_item_id(self):
        res = self.client.delete(f'{ITEMS}/abc')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_ITEM_ID')

    def test_unknown_item(self):
        res = self.client.delete(f'{ITEMS}/99999')
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'CART_ITEM_NOT_FOUND')

    def test_other_customers_item_is_404(self):
        shirt = make_product('Shirt')
        item_id = self.add(shirt).json()['data']['item']['itemId']
        self.login(make_user('other@example.com'))
        self.assertEqual(self.client.delete(f'{ITEMS}/{item_id}').status_code, 404)
        self.assertEqual(CartItem.objects.count(), 1)
