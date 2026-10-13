from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Session
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.analytics.models import AnalyticsEvent
from apps.catalog.models import ProductMedia, ProductTranslation
from tests.accounts.test_sessions import make_admin, make_user
from tests.catalog.test_storefront import BASE, add_variant, make_category, make_product

VIEWER = 'abcdef0123456789abcdef0123456789'


def views_of(product):
    return AnalyticsEvent.objects.filter(product=product, event_type='PRODUCT_VIEW')


class ProductDetailTests(TestCase):
    def test_returns_full_detail(self):
        category = make_category('Men')
        product = make_product('Tee', price='80.00', compare_at='100.00', category=category,
                               description='Soft cotton')
        add_variant(product, price='90.00', colour='White', size='L', stock=0)
        res = self.client.get(f'{BASE}/products/{product.pk}')
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['productId'], product.pk)
        self.assertEqual(data['name'], 'Tee')
        self.assertEqual(data['detail'], 'Soft cotton')
        self.assertEqual(data['category']['slug'], 'men')
        self.assertEqual(data['color'], ['Black', 'White'])
        self.assertEqual(data['size'], ['L', 'M'])
        self.assertEqual(data['price'], 80.0)
        self.assertEqual(data['originalPrice'], 100.0)
        self.assertEqual(data['discount'], {'type': 'percentage', 'value': 20})
        self.assertEqual(data['image'], f'https://cdn.test/{product.pk}.jpg')
        self.assertTrue(data['inStock'])

    def test_out_of_stock_product_still_returned(self):
        product = make_product('Tee', stock=0)
        data = self.client.get(f'{BASE}/products/{product.pk}').json()['data']
        self.assertFalse(data['inStock'])

    def test_uses_thai_name_when_asked(self):
        product = make_product('Tee')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อ')
        data = self.client.get(f'{BASE}/products/{product.pk}?lang=th').json()['data']
        self.assertEqual(data['name'], 'เสื้อ')

    def test_bad_language(self):
        product = make_product('Tee')
        res = self.client.get(f'{BASE}/products/{product.pk}?lang=fr')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_LANGUAGE')

    def test_bad_ids(self):
        for raw in ('abc', '0', '-3', '99999999999999999999'):
            for suffix in ('', '/variants', '/images'):
                res = self.client.get(f'{BASE}/products/{raw}{suffix}')
                self.assertEqual(res.status_code, 400, raw)
                self.assertEqual(res.json()['code'], 'INVALID_PRODUCT_ID')

    def test_missing_product_is_404(self):
        res = self.client.get(f'{BASE}/products/9999')
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'PRODUCT_NOT_FOUND')
        self.assertEqual(res.json()['message'], 'product with id 9999 was not found')

    def test_inactive_product_is_404_everywhere(self):
        product = make_product('Tee', active=False)
        for suffix in ('', '/variants', '/images'):
            res = self.client.get(f'{BASE}/products/{product.pk}{suffix}')
            self.assertEqual(res.status_code, 404)
        self.assertEqual(views_of(product).count(), 0)

    def test_product_without_variant_or_image_is_404(self):
        for kwargs in ({'variants': False}, {'media': False}):
            product = make_product('Tee', **kwargs)
            res = self.client.get(f'{BASE}/products/{product.pk}')
            self.assertEqual(res.status_code, 404)

    def test_static_routes_still_win(self):
        res = self.client.get(f'{BASE}/products/new-arrivals')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['products'], [])


class ProductVariantsTests(TestCase):
    def test_stock_per_colour_and_size(self):
        product = make_product('Tee', price='50.00', stock=5)
        add_variant(product, price='55.00', compare_at='60.00', colour='Black', size='L', stock=0)
        add_variant(product, colour='Red', size='M', stock=2)
        add_variant(product, colour='Red', size='S', stock=9, active=False)
        res = self.client.get(f'{BASE}/products/{product.pk}/variants')
        self.assertEqual(res.status_code, 200)
        rows = res.json()['data']
        self.assertEqual([(r['color'], r['size'], r['stockQty']) for r in rows],
                         [('Black', 'L', 0), ('Black', 'M', 5), ('Red', 'M', 2)])
        self.assertEqual(rows[0]['price'], 55.0)
        self.assertEqual(rows[0]['compareAtPrice'], 60.0)
        self.assertIsNone(rows[1]['compareAtPrice'])
        self.assertTrue(rows[0]['isActive'])
        self.assertEqual(set(rows[0]), {
            'productVariantId', 'sku', 'color', 'size', 'price', 'compareAtPrice', 'stockQty', 'isActive',
        })

    def test_does_not_write_a_view_event(self):
        product = make_product('Tee')
        self.client.get(f'{BASE}/products/{product.pk}/variants')
        self.assertEqual(views_of(product).count(), 0)

    def test_bad_language(self):
        product = make_product('Tee')
        res = self.client.get(f'{BASE}/products/{product.pk}/variants?lang=xx')
        self.assertEqual(res.status_code, 400)


class ProductImagesTests(TestCase):
    def test_ordered_by_sort_order(self):
        product = make_product('Tee')
        ProductMedia.objects.create(
            product=product, bucket_name='b', file_path='second.jpg',
            public_url='https://cdn.test/second.jpg', sort_order=3, alt_text='Back',
        )
        ProductMedia.objects.create(
            product=product, bucket_name='b', file_path='mid.jpg',
            public_url='https://cdn.test/mid.jpg', sort_order=2, is_thumbnail=True,
        )
        res = self.client.get(f'{BASE}/products/{product.pk}/images')
        self.assertEqual(res.status_code, 200)
        rows = res.json()['data']
        self.assertEqual([r['sortOrder'] for r in rows], [1, 2, 3])
        self.assertEqual(rows[2]['altText'], 'Back')
        self.assertTrue(rows[0]['isHero'])
        self.assertTrue(rows[1]['isThumbnail'])
        self.assertEqual(rows[0]['productId'], product.pk)


class ViewTrackingTests(TestCase):
    def test_anonymous_visit_sets_cookie_and_stores_viewer_id(self):
        product = make_product('Tee')
        res = self.client.get(f'{BASE}/products/{product.pk}')
        cookie = res.cookies['viewer_id']
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Lax')
        self.assertEqual(cookie['path'], '/')
        self.assertEqual(cookie['max-age'], 365 * 24 * 60 * 60)
        event = views_of(product).get()
        self.assertIsNone(event.user)
        self.assertEqual(event.session_id, f'anon:{cookie.value}')

    def test_returning_viewer_keeps_cookie(self):
        product = make_product('Tee')
        self.client.cookies['viewer_id'] = VIEWER
        res = self.client.get(f'{BASE}/products/{product.pk}')
        self.assertNotIn('viewer_id', res.cookies)
        self.assertEqual(views_of(product).get().session_id, f'anon:{VIEWER}')

    def test_each_view_writes_one_event(self):
        product = make_product('Tee')
        self.client.cookies['viewer_id'] = VIEWER
        self.client.get(f'{BASE}/products/{product.pk}')
        self.client.get(f'{BASE}/products/{product.pk}')
        self.assertEqual(views_of(product).count(), 2)

    def test_malformed_viewer_cookie_is_replaced(self):
        product = make_product('Tee')
        self.client.cookies['viewer_id'] = 'short'
        res = self.client.get(f'{BASE}/products/{product.pk}')
        self.assertNotEqual(res.cookies['viewer_id'].value, 'short')
        self.assertEqual(views_of(product).count(), 1)

    def test_customer_session_stores_user_id_and_no_cookie(self):
        product = make_product('Tee')
        user = make_user()
        token, _ = create_session(user, Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        res = self.client.get(f'{BASE}/products/{product.pk}')
        self.assertNotIn('viewer_id', res.cookies)
        event = views_of(product).get()
        self.assertEqual(event.user, user)
        self.assertIsNone(event.session_id)

    def test_expired_session_counts_as_anonymous(self):
        product = make_product('Tee')
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        Session.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.client.cookies[COOKIE_NAME] = token
        self.client.cookies['viewer_id'] = VIEWER
        res = self.client.get(f'{BASE}/products/{product.pk}')
        self.assertEqual(res.status_code, 200)
        event = views_of(product).get()
        self.assertIsNone(event.user)
        self.assertEqual(event.session_id, f'anon:{VIEWER}')

    def test_admin_session_counts_as_anonymous(self):
        product = make_product('Tee')
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.client.get(f'{BASE}/products/{product.pk}')
        event = views_of(product).get()
        self.assertIsNone(event.user)
        self.assertTrue(event.session_id.startswith('anon:'))

    def test_failed_event_write_does_not_fail_the_request(self):
        product = make_product('Tee')
        with patch('apps.catalog.detail.AnalyticsEvent.objects.create', side_effect=RuntimeError('db')):
            res = self.client.get(f'{BASE}/products/{product.pk}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(views_of(product).count(), 0)
