from decimal import Decimal
from unittest import mock

from apps.accounts.models import Address, Admin, Session
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.cart.models import Cart, CartItem
from apps.catalog.models import ProductTranslation, ProductVariant
from apps.orders import checkout
from apps.orders.models import Order, OrderItem
from tests.cart.test_cart import CartTestCase, make_user
from tests.catalog.test_storefront import add_variant, make_product
from tests.orders.test_checkout_address import make_address

URL = '/api/client/checkout/purchase'


class PurchaseTestCase(CartTestCase):
    def buy(self):
        return self.client.post(URL)

    def with_address(self):
        return make_address(self.user, default=True, full_name='Buy Er', line2='Unit 4')

    def assert_nothing_written(self, stock=None):
        self.assertFalse(Order.objects.exists())
        self.assertFalse(OrderItem.objects.exists())
        cart = Cart.objects.filter(user=self.user).first()
        if cart is not None:
            self.assertEqual(cart.status, Cart.Status.ACTIVE)
            self.assertTrue(CartItem.objects.filter(cart=cart).exists())
        for variant, expected in (stock or {}).items():
            variant.refresh_from_db()
            self.assertEqual(variant.stock_qty, expected)


class GuardTests(PurchaseTestCase):
    def test_no_session_is_401(self):
        self.client.cookies.clear()
        res = self.buy()
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'UNAUTHORIZED')

    def test_admin_session_is_403(self):
        admin = Admin.objects.create(email='a@example.com', password_hash='x', display_name='Admin')
        token, _ = create_session(admin, Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.buy().status_code, 403)

    def test_only_post_is_allowed(self):
        self.assertEqual(self.client.get(URL).status_code, 405)
        self.assertEqual(self.client.put(URL).status_code, 405)


class PurchaseSuccessTests(PurchaseTestCase):
    def setUp(self):
        super().setUp()
        self.shirt = make_product('Shirt', price='40.00', compare_at='50.00', stock=9)
        self.red = add_variant(self.shirt, price='19.99', colour='Red', size='L', stock=4)
        self.black = ProductVariant.objects.get(product=self.shirt, colour='Black')
        self.address = self.with_address()
        self.add(self.shirt, qty=2)
        self.add(self.shirt, colour='Red', size='L', qty=3)

    def test_response_shape(self):
        res = self.buy()
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        order = Order.objects.get()
        self.assertEqual(data['orderId'], order.pk)
        self.assertEqual(data['orderStatus'], 'PURCHASED')
        self.assertEqual(data['purchasedAt'], order.created_at.isoformat())
        self.assertEqual(data['cartSummary'], {'totalItems': 5, 'subtotal': 139.97})

    def test_creates_order_items_and_totals(self):
        self.buy()
        order = Order.objects.get()
        # 2 * 40.00 + 3 * 19.99 = 139.97, VAT 7 percent = 9.7979 -> 9.80
        self.assertEqual(order.subtotal, Decimal('139.97'))
        self.assertEqual(order.shipping_fee, Decimal('0.00'))
        self.assertEqual(order.vat_amount, Decimal('9.80'))
        self.assertEqual(order.total, Decimal('149.77'))
        self.assertEqual(order.status, 'PURCHASED')
        self.assertEqual(order.user, self.user)
        self.assertEqual(order.items.count(), 2)

    def test_vat_rate_is_one_constant(self):
        self.assertEqual(checkout.VAT_RATE, Decimal('0.07'))
        with mock.patch.object(checkout, 'VAT_RATE', Decimal('0.10')):
            self.buy()
        self.assertEqual(Order.objects.get().vat_amount, Decimal('14.00'))

    def test_order_item_snapshots(self):
        self.buy()
        black, red = OrderItem.objects.order_by('order_item_id')
        self.assertEqual(black.snapshot_product_name, 'Shirt')
        self.assertEqual(black.snapshot_color, 'Black')
        self.assertEqual(black.snapshot_size, 'M')
        self.assertEqual(black.snapshot_unit_price, Decimal('40.00'))
        self.assertEqual(black.snapshot_compare_at_price, Decimal('50.00'))
        self.assertEqual(black.quantity, 2)
        self.assertEqual(black.line_total, Decimal('80.00'))
        self.assertEqual(black.product_variant, self.black)
        self.assertEqual(red.snapshot_color, 'Red')
        self.assertIsNone(red.snapshot_compare_at_price)
        self.assertEqual(red.line_total, Decimal('59.97'))

    def test_compare_at_not_above_price_is_not_snapshotted(self):
        ProductVariant.objects.filter(pk=self.black.pk).update(compare_at_price=Decimal('40.00'))
        self.buy()
        self.assertIsNone(OrderItem.objects.get(product_variant=self.black).snapshot_compare_at_price)

    def test_name_falls_back_when_no_english_translation(self):
        ProductTranslation.objects.filter(product=self.shirt).update(language_code='TH')
        self.buy()
        self.assertEqual(OrderItem.objects.first().snapshot_product_name, f'Product #{self.shirt.pk}')

    def test_address_snapshot_survives_address_edit(self):
        self.buy()
        order = Order.objects.get()
        expected = {
            'fullName': 'Buy Er', 'phoneNumber': '0812345678', 'addressLine1': '9 Old St',
            'addressLine2': 'Unit 4', 'district': 'D', 'province': 'P',
            'postalCode': '10000', 'country': 'Thailand',
        }
        self.assertEqual(order.shipping_address_snapshot, expected)
        self.assertEqual(order.billing_address_snapshot, expected)
        self.assertEqual(order.shipping_address, self.address)
        Address.objects.filter(pk=self.address.pk).update(full_name='Changed')
        order.refresh_from_db()
        self.assertEqual(order.shipping_address_snapshot['fullName'], 'Buy Er')
        self.address.delete()
        order.refresh_from_db()
        self.assertIsNone(order.shipping_address)
        self.assertEqual(order.shipping_address_snapshot, expected)

    def test_latest_address_used_when_no_default(self):
        Address.objects.filter(pk=self.address.pk).update(is_default_shipping=False)
        self.buy()
        self.assertEqual(Order.objects.get().shipping_address_snapshot['fullName'], 'Buy Er')

    def test_stock_decreases(self):
        self.buy()
        self.black.refresh_from_db()
        self.red.refresh_from_db()
        self.assertEqual(self.black.stock_qty, 7)
        self.assertEqual(self.red.stock_qty, 1)

    def test_cart_emptied_and_converted(self):
        cart = Cart.objects.get(user=self.user)
        self.buy()
        cart.refresh_from_db()
        self.assertEqual(cart.status, Cart.Status.CONVERTED)
        self.assertFalse(CartItem.objects.filter(cart=cart).exists())
        cart_data = self.client.get('/api/client/cart').json()['data']
        self.assertIsNone(cart_data['cartId'])
        self.assertEqual(cart_data['items'], [])

    def test_new_add_after_purchase_creates_fresh_cart(self):
        old = Cart.objects.get(user=self.user)
        self.buy()
        res = self.add(self.shirt, qty=1)
        self.assertEqual(res.status_code, 201)
        self.assertNotEqual(res.json()['data']['cartId'], old.pk)
        self.assertEqual(Cart.objects.filter(user=self.user).count(), 2)

    def test_quantity_equal_to_stock_leaves_zero(self):
        # setUp already has 3 red in the cart and 4 in stock
        self.add(self.shirt, colour='Red', size='L', qty=1)
        self.assertEqual(self.buy().status_code, 200)
        self.red.refresh_from_db()
        self.assertEqual(self.red.stock_qty, 0)

    def test_edits_after_first_read_are_not_dropped_or_orphaned(self):
        hat = make_product('Hat', price='10.00', stock=5)
        hat_variant = ProductVariant.objects.get(product=hat)
        cart = Cart.objects.get(user=self.user)
        real_lock = checkout.lock_variants
        calls = []

        def lock_then_edit(items):
            locked = real_lock(items)
            if not calls:
                # a late edit: one line changes and a new line appears after the first read
                CartItem.objects.filter(cart=cart, product_variant=self.black).update(quantity=3)
                CartItem.objects.create(cart=cart, product_variant=hat_variant, quantity=2)
            calls.append(1)
            return locked

        with mock.patch.object(checkout, 'lock_variants', lock_then_edit):
            res = self.buy()
        self.assertEqual(res.status_code, 200)
        order = Order.objects.get()
        self.assertEqual(order.items.count(), 3)
        self.assertEqual(order.items.get(product_variant=self.black).quantity, 3)
        self.assertEqual(order.items.get(product_variant=hat_variant).quantity, 2)
        self.assertEqual(order.subtotal, Decimal('199.97'))
        self.assertFalse(CartItem.objects.filter(cart=cart).exists())
        self.black.refresh_from_db()
        hat_variant.refresh_from_db()
        self.assertEqual(self.black.stock_qty, 6)
        self.assertEqual(hat_variant.stock_qty, 3)

    def test_second_purchase_finds_cart_empty(self):
        self.assertEqual(self.buy().status_code, 200)
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CART_EMPTY')
        self.assertEqual(Order.objects.count(), 1)

    def test_other_customers_cart_is_untouched(self):
        other = make_user('other@example.com')
        cart = Cart.objects.create(user=other)
        CartItem.objects.create(cart=cart, product_variant=self.black, quantity=1)
        self.buy()
        cart.refresh_from_db()
        self.assertEqual(cart.status, Cart.Status.ACTIVE)
        self.assertEqual(CartItem.objects.filter(cart=cart).count(), 1)


class PurchaseFailureTests(PurchaseTestCase):
    def setUp(self):
        super().setUp()
        self.shirt = make_product('Shirt', price='40.00', stock=5)
        self.black = ProductVariant.objects.get(product=self.shirt)
        self.hat = make_product('Hat', price='10.00', stock=5)
        self.hat_variant = ProductVariant.objects.get(product=self.hat)

    def test_no_cart_is_409(self):
        self.with_address()
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CART_EMPTY')
        self.assertFalse(Order.objects.exists())

    def test_empty_cart_is_409(self):
        self.with_address()
        Cart.objects.create(user=self.user)
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CART_EMPTY')

    def test_no_address_is_400_and_nothing_written(self):
        self.add(self.shirt, qty=2)
        res = self.buy()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'CHECKOUT_ADDRESS_REQUIRED')
        self.assert_nothing_written({self.black: 5})

    def test_total_too_large_is_409_nothing_written(self):
        self.with_address()
        self.add(self.shirt, qty=1)
        ProductVariant.objects.filter(pk=self.black.pk).update(price=Decimal('99999999.00'))
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'ORDER_TOTAL_TOO_LARGE')
        self.assert_nothing_written({self.black: 5})

    def test_inactive_variant_is_409(self):
        self.with_address()
        self.add(self.shirt, qty=1)
        ProductVariant.objects.filter(pk=self.black.pk).update(is_active=False)
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CART_ITEM_UNAVAILABLE')
        self.assert_nothing_written({self.black: 5})

    def test_inactive_product_is_409(self):
        self.with_address()
        self.add(self.shirt, qty=1)
        self.shirt.is_active = False
        self.shirt.save()
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CART_ITEM_UNAVAILABLE')
        self.assert_nothing_written({self.black: 5})

    def test_insufficient_stock_is_409_nothing_written(self):
        self.with_address()
        self.add(self.shirt, qty=4)
        ProductVariant.objects.filter(pk=self.black.pk).update(stock_qty=3)
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'INSUFFICIENT_STOCK')
        self.assert_nothing_written({self.black: 3})

    def test_second_item_short_leaves_first_untouched(self):
        self.with_address()
        self.add(self.shirt, qty=2)
        self.add(self.hat, qty=2)
        ProductVariant.objects.filter(pk=self.hat_variant.pk).update(stock_qty=1)
        res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assert_nothing_written({self.black: 5, self.hat_variant: 1})

    def test_guarded_update_failure_rolls_everything_back(self):
        # stock drops after the check passed, so only the guarded update can catch it
        self.with_address()
        self.add(self.shirt, qty=2)
        self.add(self.hat, qty=2)
        real_check = checkout.check_items

        def sneaky(items, variants):
            real_check(items, variants)
            ProductVariant.objects.filter(pk=self.hat_variant.pk).update(stock_qty=1)

        with mock.patch.object(checkout, 'check_items', sneaky):
            res = self.buy()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'INSUFFICIENT_STOCK')
        self.assert_nothing_written({self.black: 5})
