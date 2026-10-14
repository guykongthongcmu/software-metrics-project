import json
import tempfile
from datetime import date
from decimal import Decimal
from pathlib import Path
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase

from apps.accounts.models import Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.catalog.models import (
    Category, Product, ProductCategory, ProductMedia, ProductTranslation, ProductVariant,
)
from apps.orders.models import Order, OrderItem
from common import storage
from tests.catalog.test_admin_categories import make_admin
from tests.catalog.test_storefront import add_variant, make_category, make_product

BASE = '/api/admin/products'
JPEG = b'\xff\xd8\xff\xe0' + b'0' * 40
PNG = b'\x89PNG\r\n\x1a\n' + b'0' * 40


def image(name='a.jpg', content=JPEG, content_type='image/jpeg'):
    return SimpleUploadedFile(name, content, content_type=content_type)


def good_payload(category_id, sku='SKU-NEW', images=1):
    return {
        'productType': 'TOP',
        'status': 'ACTIVE',
        'translations': [
            {'languageCode': 'EN', 'name': 'New Tee', 'description': 'soft'},
            {'languageCode': 'TH', 'name': 'เสื้อใหม่', 'description': None},
        ],
        'categories': [{'categoryId': category_id, 'isPrimary': True}],
        'variants': [{
            'sku': sku, 'colour': 'Black', 'size': 'M', 'price': '199.00',
            'compareAtPrice': 250, 'stockQty': 5,
        }],
        'media': [
            {'sortOrder': n + 1, 'isThumbnail': n == 0, 'isHero': n == 0, 'altText': f'view {n}'}
            for n in range(images)
        ],
    }


class AdminProductCase(TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        patcher = mock.patch.dict('os.environ', {'MEDIA_DIR': self.tmp.name, 'MEDIA_URL': '/media'})
        patcher.start()
        self.addCleanup(patcher.stop)
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token

    def stored_files(self):
        return [path for path in Path(self.tmp.name).rglob('*') if path.is_file()]

    def create(self, payload, files=None, **extra):
        form = {key: json.dumps(value) for key, value in payload.items() if key in (
            'translations', 'categories', 'variants', 'media')}
        form.update({key: value for key, value in payload.items() if isinstance(value, str)})
        form['mediaFiles'] = files if files is not None else [image() for _ in payload.get('media', [])]
        form.update(extra)
        return self.client.post(BASE, form)

    def create_as_payload(self, payload, files):
        return self.client.post(BASE, {'payload': json.dumps(payload), 'mediaFiles': files})


class ListTests(AdminProductCase):
    def test_list_includes_inactive(self):
        make_product('Live Tee')
        make_product('Old Tee', active=False)
        data = self.client.get(BASE).json()['data']
        self.assertEqual(data['totalItems'], 2)
        self.assertEqual({item['status'] for item in data['items']}, {'ACTIVE', 'INACTIVE'})

    def test_list_search_case_insensitive_both_languages(self):
        product = make_product('Linen Shirt')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อลินิน')
        make_product('Wool Hat')
        names = lambda res: [item['name'] for item in res.json()['data']['items']]
        self.assertEqual(names(self.client.get(BASE, {'search': 'LINEN'})), ['Linen Shirt'])
        self.assertEqual(names(self.client.get(BASE, {'search': 'ลินิน'})), ['Linen Shirt'])
        self.assertEqual(names(self.client.get(BASE, {'search': '%'})), [])
        self.assertEqual(len(names(self.client.get(BASE, {'search': '  '}))), 2)

    def test_list_filter_category_and_children(self):
        parent = make_category('Men')
        child = Category.objects.create(category_name='Shirts', slug='shirts', parent=parent)
        other = make_category('Women')
        make_product('Parent Tee', category=parent)
        make_product('Child Tee', category=child)
        make_product('Other Tee', category=other)
        res = self.client.get(BASE, {'category': parent.pk})
        self.assertEqual({item['name'] for item in res.json()['data']['items']}, {'Parent Tee', 'Child Tee'})
        res = self.client.get(BASE, {'category': child.pk})
        self.assertEqual([item['name'] for item in res.json()['data']['items']], ['Child Tee'])

    def test_list_pagination_and_clamping(self):
        for number in range(5):
            make_product(f'Tee {number}', age_days=number)
        data = self.client.get(BASE, {'limit': 2, 'page': 2}).json()['data']
        self.assertEqual((data['page'], data['limit'], data['totalItems'], data['totalPages']), (2, 2, 5, 3))
        self.assertEqual([item['name'] for item in data['items']], ['Tee 2', 'Tee 3'])
        data = self.client.get(BASE, {'limit': 5000, 'page': 'x'}).json()['data']
        self.assertEqual((data['limit'], data['page']), (100, 1))
        self.assertEqual(self.client.get(BASE, {'limit': 0}).json()['data']['limit'], 20)

    def test_list_summary_fields_and_totals(self):
        parent = make_category('Men')
        child = Category.objects.create(category_name='Shirts', slug='shirts', parent=parent)
        product = make_product('Tee', price='80.00', compare_at='100.00', stock=3, category=child)
        add_variant(product, price='60.00', stock=4, colour='Red')
        add_variant(product, price='10.00', stock=100, colour='Gone', active=False)
        item = self.client.get(BASE).json()['data']['items'][0]
        self.assertEqual(item['productId'], product.pk)
        self.assertEqual((item['priceFrom'], item['compareAtPriceFrom']), (60.0, 100.0))
        self.assertEqual((item['totalStock'], item['variantCount']), (7, 2))
        self.assertEqual((item['primaryCategoryId'], item['primaryCategoryName']), (child.pk, 'Shirts'))
        self.assertEqual((item['rootCategoryId'], item['rootCategoryName']), (parent.pk, 'Men'))
        self.assertTrue(item['thumbnailUrl'] is None or item['thumbnailUrl'].startswith('https://'))
        self.assertEqual((item['languageCode'], item['status'], item['productType']), ('EN', 'ACTIVE', 'TOP'))

    def test_list_product_without_variants_or_translation(self):
        Product.objects.create(product_type='TOP')
        item = self.client.get(BASE).json()['data']['items'][0]
        self.assertEqual((item['priceFrom'], item['totalStock'], item['variantCount']), (None, 0, 0))
        self.assertIsNone(item['name'])
        self.assertIsNone(item['primaryCategoryId'])

    def test_list_bad_query_and_lang(self):
        for params in (
            {'category': 'abc'}, {'category': '0'}, {'category': '٣'}, {'search': 'a\x00b'},
            {'search': 'x' * 151},
        ):
            res = self.client.get(BASE, params)
            self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_QUERY'), params)
        self.assertEqual(self.client.get(BASE, {'lang': 'FR'}).json()['code'], 'INVALID_LANGUAGE')

    def test_list_localized_name(self):
        product = make_product('Tee')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อ')
        item = self.client.get(BASE, {'lang': 'th'}).json()['data']['items'][0]
        self.assertEqual((item['name'], item['languageCode']), ('เสื้อ', 'TH'))


class DetailTests(AdminProductCase):
    def test_detail_shape(self):
        category = make_category('Tops')
        product = make_product('Tee', description='soft', category=category, compare_at='60.00')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อ')
        data = self.client.get(f'{BASE}/{product.pk}').json()['data']
        self.assertEqual((data['name'], data['description'], data['status']), ('Tee', 'soft', 'ACTIVE'))
        self.assertEqual(len(data['translations']), 2)
        self.assertEqual(
            data['categories'], [{'categoryId': category.pk, 'name': 'Tops', 'slug': 'tops', 'isPrimary': True}],
        )
        variant = data['variants'][0]
        self.assertEqual((variant['colour'], variant['size'], variant['compareAtPrice']), ('Black', 'M', 60.0))
        self.assertNotIn('color', variant)
        self.assertEqual(data['media'][0]['sortOrder'], 1)
        self.assertEqual(self.client.get(f'{BASE}/{product.pk}', {'lang': 'TH'}).json()['data']['name'], 'เสื้อ')

    def test_detail_inactive_still_visible(self):
        product = make_product('Tee', active=False)
        data = self.client.get(f'{BASE}/{product.pk}').json()['data']
        self.assertEqual((data['isActive'], data['status']), (False, 'INACTIVE'))

    def test_detail_404_and_bad_id(self):
        self.assertEqual(self.client.get(f'{BASE}/999').json()['code'], 'PRODUCT_NOT_FOUND')
        for raw in ('abc', '0', '-2', '٣', '9' * 30):
            res = self.client.get(f'{BASE}/{raw}')
            self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_PRODUCT_ID'), raw)
        self.assertEqual(self.client.get(f'{BASE}/1', {'lang': 'xx'}).json()['code'], 'INVALID_LANGUAGE')

    def test_images_list(self):
        product = make_product('Tee')
        ProductMedia.objects.create(
            product=product, bucket_name='local', file_path='products/x.jpg',
            public_url='/media/products/x.jpg', sort_order=2,
        )
        rows = self.client.get(f'{BASE}/{product.pk}/images').json()['data']
        self.assertEqual([row['sortOrder'] for row in rows], [1, 2])
        self.assertEqual(set(rows[0]), {
            'productMediaId', 'productId', 'bucketName', 'filePath', 'publicUrl', 'altText',
            'sortOrder', 'isThumbnail', 'isHero', 'createdAt',
        })
        self.assertEqual(self.client.get(f'{BASE}/999/images').status_code, 404)
        self.assertEqual(self.client.get(f'{BASE}/zz/images').status_code, 400)


class CreateTests(AdminProductCase):
    def setUp(self):
        super().setUp()
        self.category = make_category('Tops')

    def test_create_multipart_full_product(self):
        payload = good_payload(self.category.pk, images=2)
        res = self.create(payload, files=[image('one.jpg'), image('two.png', PNG, 'image/png')])
        self.assertEqual(res.status_code, 201, res.content)
        product = Product.objects.get(pk=res.json()['data']['productId'])
        self.assertEqual((product.product_type, product.is_active), ('TOP', True))
        self.assertEqual(
            {row.language_code: row.name for row in product.translations.all()},
            {'EN': 'New Tee', 'TH': 'เสื้อใหม่'},
        )
        link = product.product_categories.get()
        self.assertEqual((link.category_id, link.is_primary), (self.category.pk, True))
        variant = product.variants.get()
        self.assertEqual((variant.sku_code, variant.price, variant.compare_at_price, variant.stock_qty),
                         ('SKU-NEW', Decimal('199.00'), Decimal('250.00'), 5))
        self.assertEqual([m.sort_order for m in product.media.order_by('sort_order')], [1, 2])
        self.assertEqual(len(self.stored_files()), 2)

    def test_create_saves_files_and_public_urls(self):
        res = self.create(good_payload(self.category.pk))
        media = ProductMedia.objects.get(product_id=res.json()['data']['productId'])
        self.assertEqual(media.bucket_name, 'local')
        self.assertRegex(media.public_url, r'^/media/products/[0-9a-f]{32}\.jpg$')
        self.assertEqual(media.alt_text, 'view 0')
        self.assertTrue((Path(self.tmp.name) / media.file_path).is_file())
        self.assertTrue(media.is_thumbnail and media.is_hero)

    def test_created_image_is_served(self):
        res = self.create(good_payload(self.category.pk))
        url = ProductMedia.objects.get(product_id=res.json()['data']['productId']).public_url
        served = self.client.get(url)
        self.assertEqual(served.status_code, 200)
        self.assertEqual(b''.join(served.streaming_content), JPEG)
        self.assertEqual(self.client.post(url).status_code, 405)

    def test_create_payload_field_form(self):
        res = self.create_as_payload(good_payload(self.category.pk), [image()])
        self.assertEqual(res.status_code, 201, res.content)

    def test_create_is_visible_in_list_and_detail(self):
        product_id = self.create(good_payload(self.category.pk)).json()['data']['productId']
        item = self.client.get(BASE).json()['data']['items'][0]
        self.assertEqual((item['productId'], item['name'], item['priceFrom']), (product_id, 'New Tee', 199.0))
        self.assertEqual(self.client.get(f'{BASE}/{product_id}').json()['data']['variants'][0]['sku'], 'SKU-NEW')

    def test_create_inactive_with_is_active_flag(self):
        payload = good_payload(self.category.pk)
        del payload['status']
        res = self.create(payload, isActive='false')
        self.assertFalse(Product.objects.get(pk=res.json()['data']['productId']).is_active)

    def test_create_rolls_back_on_duplicate_sku_and_removes_files(self):
        other = make_product('Existing')
        ProductVariant.objects.filter(product=other).update(sku_code='SKU-NEW')
        before = Product.objects.count()
        res = self.create(good_payload(self.category.pk, sku='sku-new'))
        self.assertEqual((res.status_code, res.json()['code']), (409, 'DUPLICATE_SKU'))
        self.assertEqual(Product.objects.count(), before)
        self.assertEqual(self.stored_files(), [])

    def test_create_race_on_sku_rolls_back_and_removes_files(self):
        other = make_product('Existing')
        ProductVariant.objects.filter(product=other).update(sku_code='SKU-NEW')
        before = Product.objects.count()
        with mock.patch('apps.catalog.admin_products.taken_skus', return_value=[]):
            res = self.create(good_payload(self.category.pk))
        self.assertEqual((res.status_code, res.json()['code']), (409, 'DUPLICATE_SKU'))
        self.assertEqual(Product.objects.count(), before)
        self.assertEqual(self.stored_files(), [])

    def test_create_race_on_variant_pair_409(self):
        payload = good_payload(self.category.pk)
        cause = Exception()
        cause.diag = mock.Mock(constraint_name='uq_product_colour_size')
        failure = IntegrityError()
        failure.__cause__ = cause
        with mock.patch('apps.catalog.admin_products.ProductVariant.objects.bulk_create', side_effect=failure):
            res = self.create(payload)
        self.assertEqual((res.status_code, res.json()['code']), (409, 'DUPLICATE_VARIANT'))
        self.assertEqual(Product.objects.count(), 0)

    def fail_bulk_create(self, sqlstate=None):
        cause = Exception()
        cause.sqlstate = sqlstate
        failure = IntegrityError()
        failure.__cause__ = cause
        return mock.patch('apps.catalog.admin_products.ProductVariant.objects.bulk_create', side_effect=failure)

    def test_create_foreign_key_failure_is_409(self):
        with self.fail_bulk_create('23503'):
            res = self.create(good_payload(self.category.pk))
        self.assertEqual((res.status_code, res.json()['code']), (409, 'CATEGORY_NOT_FOUND'))
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_create_other_integrity_failure_is_409_not_500(self):
        with self.fail_bulk_create():
            res = self.create(good_payload(self.category.pk))
        self.assertEqual((res.status_code, res.json()['code']), (409, 'CONFLICT'))
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_create_lone_surrogate_400(self):
        for field in ('name', 'description'):
            payload = good_payload(self.category.pk)
            payload['translations'][0][field] = 'bad\ud800'
            self.assertEqual(self.create(payload).status_code, 400, field)
        for field in ('sku', 'colour', 'size'):
            payload = good_payload(self.category.pk)
            payload['variants'][0][field] = 'bad\ud800'
            self.assertEqual(self.create(payload).status_code, 400, field)
        payload = good_payload(self.category.pk)
        payload['media'][0]['altText'] = 'bad\ud800'
        self.assertEqual(self.create(payload).status_code, 400)
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_create_rolls_back_on_unknown_category(self):
        res = self.create(good_payload(self.category.pk + 500))
        self.assertEqual((res.status_code, res.json()['code']), (400, 'VALIDATION_ERROR'))
        self.assertIn('categories', res.json()['details'])
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_create_storage_failure_on_second_file_rolls_back(self):
        real = storage.save_image
        calls = []

        def flaky(upload, folder):
            calls.append(1)
            if len(calls) == 2:
                raise storage.StorageError('disk full')
            return real(upload, folder)

        with mock.patch('apps.catalog.admin_products.storage.save_image', side_effect=flaky):
            res = self.create(good_payload(self.category.pk, images=2))
        self.assertEqual((res.status_code, res.json()['code']), (500, 'STORAGE_UPLOAD_FAILED'))
        self.assertEqual((Product.objects.count(), ProductMedia.objects.count(), self.stored_files()), (0, 0, []))

    def test_create_unexpected_failure_cleans_files_and_reraises(self):
        self.client.raise_request_exception = False
        with mock.patch('apps.catalog.admin_products.ProductMedia.objects.create', side_effect=RuntimeError):
            res = self.create(good_payload(self.category.pk))
        self.assertEqual(res.status_code, 500)
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_create_validation_details(self):
        cat = self.category.pk
        cases = {
            'productType': {'productType': 'HAT'},
            'status': {'status': 'MAYBE'},
            'translations': {'translations': [{'languageCode': 'EN', 'name': 'only en'}]},
            'translations[0].name': {'translations': [
                {'languageCode': 'EN', 'name': 'x' * 151}, {'languageCode': 'TH', 'name': 'ok'}]},
            'translations[1].languageCode': {'translations': [
                {'languageCode': 'EN', 'name': 'a'}, {'languageCode': 'EN', 'name': 'b'}]},
            'categories': {'categories': [{'categoryId': cat, 'isPrimary': False}]},
            'categories[1].categoryId': {'categories': [
                {'categoryId': cat, 'isPrimary': True}, {'categoryId': cat, 'isPrimary': False}]},
            'categories[0]': {'categories': [{'categoryId': '1', 'isPrimary': True}]},
            'variants': {'variants': []},
            'variants[0].sku': {'variants': [dict(good_payload(cat)['variants'][0], sku='')]},
            'variants[0].colour': {'variants': [dict(good_payload(cat)['variants'][0], colour='c' * 101)]},
            'variants[0].size': {'variants': [dict(good_payload(cat)['variants'][0], size='s' * 21)]},
            'variants[0].price': {'variants': [dict(good_payload(cat)['variants'][0], price=0)]},
            'variants[0].compareAtPrice': {'variants': [dict(good_payload(cat)['variants'][0], compareAtPrice=10)]},
            'variants[0].stockQty': {'variants': [dict(good_payload(cat)['variants'][0], stockQty=-1)]},
            'variants[1].sku': {'variants': [
                dict(good_payload(cat)['variants'][0]),
                dict(good_payload(cat)['variants'][0], sku='sku-NEW', colour='Red')]},
            'variants[1]': {'variants': [
                dict(good_payload(cat)['variants'][0]),
                dict(good_payload(cat)['variants'][0], sku='OTHER')]},
            'media[0].altText': {'media': [dict(good_payload(cat)['media'][0], altText='a' * 256)]},
        }
        for key, change in cases.items():
            res = self.create(dict(good_payload(cat), **change))
            self.assertEqual((res.status_code, res.json()['code']), (400, 'VALIDATION_ERROR'), key)
            self.assertIn(key, res.json()['details'], key)
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_create_bad_numbers_rejected(self):
        for field, value in (
            ('price', True), ('price', '١٢'), ('price', '1.234'), ('price', '1e3'), ('price', '123456789'),
            ('price', None), ('price', [1]), ('stockQty', 1.5), ('stockQty', True), ('stockQty', 2**31),
            ('stockQty', '5'), ('sku', 'a\x00b'), ('isActive', 'maybe'),
        ):
            payload = good_payload(self.category.pk)
            payload['variants'][0][field] = value
            res = self.create(payload)
            self.assertEqual(res.status_code, 400, (field, value))
        self.assertEqual(Product.objects.count(), 0)

    def test_create_accepts_numeric_forms(self):
        payload = good_payload(self.category.pk)
        payload['variants'][0].update(price=199, compareAtPrice='250.5')
        self.assertEqual(self.create(payload).status_code, 201)

    def test_create_one_thumbnail_one_hero_rules(self):
        cat = self.category.pk
        for media in (
            [dict(sortOrder=1, isThumbnail=False, isHero=True), dict(sortOrder=2, isThumbnail=False, isHero=False)],
            [dict(sortOrder=1, isThumbnail=True, isHero=True), dict(sortOrder=2, isThumbnail=True, isHero=False)],
            [dict(sortOrder=1, isThumbnail=True, isHero=True), dict(sortOrder=1, isThumbnail=False, isHero=False)],
        ):
            res = self.create(dict(good_payload(cat), media=media))
            self.assertEqual(res.status_code, 400)
            self.assertIn('media', res.json()['details'])
        bad = [dict(sortOrder=5, isThumbnail=True, isHero=True)]
        self.assertIn('media[0]', self.create(dict(good_payload(cat), media=bad)).json()['details'])

    def test_create_media_and_file_counts_must_match(self):
        res = self.create(good_payload(self.category.pk, images=2), files=[image()])
        self.assertEqual(res.json()['details']['media'], 'send one media entry for every uploaded file')
        res = self.create(good_payload(self.category.pk), files=[])
        self.assertIn('media', res.json()['details'])

    def test_more_than_4_files_400(self):
        res = self.create(good_payload(self.category.pk, images=5))
        self.assertEqual((res.status_code, res.json()['code']), (400, 'VALIDATION_ERROR'))
        self.assertEqual(self.stored_files(), [])

    def test_create_files_in_media_field_also_accepted(self):
        payload = good_payload(self.category.pk)
        res = self.client.post(BASE, {'payload': json.dumps(payload), 'media': [image()]})
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(len(self.stored_files()), 1)

    def test_wrong_type_400(self):
        res = self.create(good_payload(self.category.pk), files=[image('a.jpg', b'GIF89a' + b'0' * 30)])
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_FILE_TYPE'))
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_spoofed_content_type_400(self):
        script = image('shell.jpg', b'<?php system($_GET[1]); ?>', 'image/jpeg')
        res = self.create(good_payload(self.category.pk), files=[script])
        self.assertEqual(res.json()['code'], 'INVALID_FILE_TYPE')

    def test_over_5mb_413(self):
        big = image('big.jpg', JPEG + b'0' * storage.MAX_IMAGE_BYTES)
        res = self.create(good_payload(self.category.pk), files=[big])
        self.assertEqual((res.status_code, res.json()['code']), (413, 'FILE_TOO_LARGE'))
        self.assertEqual((Product.objects.count(), self.stored_files()), (0, []))

    def test_huge_content_length_413_before_parsing(self):
        res = self.client.post(BASE, {'a': 'b'}, CONTENT_LENGTH=str(10**9))
        self.assertEqual((res.status_code, res.json()['code']), (413, 'FILE_TOO_LARGE'))

    def test_garbage_content_length_is_ignored(self):
        res = self.client.post(BASE, {'a': 'b'}, CONTENT_LENGTH='lots')
        self.assertEqual(res.status_code, 400)

    def test_oversize_text_field_is_not_a_500(self):
        res = self.client.post(BASE, {'payload': 'x' * (3 * 1024 * 1024), 'mediaFiles': image()})
        self.assertEqual((res.status_code, res.json()['code']), (413, 'PAYLOAD_TOO_LARGE'))

    def test_create_invalid_json_400(self):
        for form in (
            {'productType': 'TOP', 'translations': '{nope', 'mediaFiles': image()},
            {'payload': '{nope', 'mediaFiles': image()},
            {'payload': '[1, 2]', 'mediaFiles': image()},
            {'productType': 'TOP', 'variants': '[' * 100000, 'mediaFiles': image()},
        ):
            res = self.client.post(BASE, form)
            self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_JSON'), list(form))

    def test_create_json_body_without_files_is_rejected_cleanly(self):
        res = self.client.post(BASE, good_payload(self.category.pk), content_type='application/json')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'VALIDATION_ERROR'))
        res = self.client.post(BASE, [1], content_type='application/json')
        self.assertEqual(res.json()['code'], 'INVALID_JSON')
        res = self.client.post(BASE, 'x', content_type='text/plain')
        self.assertEqual(res.status_code, 415)

    def test_create_requires_admin(self):
        self.client.cookies.clear()
        self.assertEqual(self.create(good_payload(self.category.pk)).status_code, 401)
        self.assertEqual(Product.objects.count(), 0)


class UpdateTests(AdminProductCase):
    def put(self, product_id, body):
        return self.client.put(f'{BASE}/{product_id}', body, content_type='application/json')

    def test_update_name_description_per_lang(self):
        product = make_product('Tee', description='old')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อ')
        res = self.put(product.pk, {'name': 'Tee 2', 'description': 'new'})
        self.assertEqual((res.json()['data']['name'], res.json()['data']['description']), ('Tee 2', 'new'))
        self.put(product.pk, {'name': 'เสื้อ 2', 'lang': 'th'})
        names = {row.language_code: row.name for row in product.translations.all()}
        self.assertEqual(names, {'EN': 'Tee 2', 'TH': 'เสื้อ 2'})

    def test_update_description_null_clears(self):
        product = make_product('Tee', description='old')
        self.put(product.pk, {'description': None})
        self.assertIsNone(product.translations.get().description)
        self.put(product.pk, {'description': '  '})
        self.assertIsNone(product.translations.get().description)

    def test_update_creates_missing_translation_only_with_name(self):
        product = make_product('Tee')
        res = self.put(product.pk, {'description': 'x', 'lang': 'TH'})
        self.assertIn('name', res.json()['details'])
        res = self.put(product.pk, {'name': 'เสื้อ', 'lang': 'TH'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(product.translations.count(), 2)

    def test_update_status(self):
        product = make_product('Tee')
        self.assertEqual(self.put(product.pk, {'status': 'inactive'}).json()['data']['status'], 'INACTIVE')
        self.assertEqual(self.put(product.pk, {'isActive': True}).json()['data']['isActive'], True)

    def test_update_category_becomes_primary(self):
        old = make_category('Old')
        new = make_category('New')
        product = make_product('Tee', category=old)
        res = self.put(product.pk, {'category_id': new.pk})
        self.assertEqual(res.status_code, 200)
        flags = {link.category_id: link.is_primary for link in product.product_categories.all()}
        self.assertEqual(flags, {old.pk: False, new.pk: True})
        self.put(product.pk, {'category_id': old.pk})
        flags = {link.category_id: link.is_primary for link in product.product_categories.all()}
        self.assertEqual(flags, {old.pk: True, new.pk: False})

    def test_update_unknown_category_400_nothing_changed(self):
        product = make_product('Tee')
        res = self.put(product.pk, {'name': 'Changed', 'category_id': 9999})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(product.translations.get().name, 'Tee')

    def test_update_price_stock_single_variant(self):
        product = make_product('Tee', price='50.00')
        res = self.put(product.pk, {'price': 75.5, 'stock': 9, 'compare_at_price': '90'})
        variant = res.json()['data']['variants'][0]
        self.assertEqual((variant['price'], variant['stockQty'], variant['compareAtPrice']), (75.5, 9, 90.0))
        self.put(product.pk, {'compareAtPrice': None})
        self.assertIsNone(ProductVariant.objects.get(product=product).compare_at_price)

    def test_update_multiple_variants_requires_sku(self):
        product = make_product('Tee')
        second = add_variant(product, colour='Red')
        self.assertIn('sku', self.put(product.pk, {'stock': 1}).json()['details'])
        res = self.put(product.pk, {'stock': 1, 'sku': second.sku_code.lower()})
        self.assertEqual(res.status_code, 200)
        second.refresh_from_db()
        self.assertEqual(second.stock_qty, 1)
        self.assertIn('sku', self.put(product.pk, {'stock': 1, 'sku': 'nope'}).json()['details'])

    def test_update_variant_fields_on_product_without_variants(self):
        product = make_product('Tee', variants=False)
        self.assertEqual(self.put(product.pk, {'stock': 1}).status_code, 400)

    def test_update_compare_at_below_price_400(self):
        product = make_product('Tee', price='50.00', compare_at='60.00')
        self.assertEqual(self.put(product.pk, {'compare_at_price': 40}).status_code, 400)
        self.assertEqual(self.put(product.pk, {'price': 70}).status_code, 400)
        self.assertEqual(ProductVariant.objects.get(product=product).price, Decimal('50.00'))

    def test_update_empty_and_bad_bodies_400(self):
        product = make_product('Tee')
        for body in ({}, {'sku': 'x'}, [], 'text', {'name': ''}, {'name': 'x' * 151}, {'name': 3},
                     {'description': 5}, {'status': 'x'}, {'isActive': 'maybe'}, {'category_id': 'a'},
                     {'price': 0}, {'price': True}, {'compare_at_price': 'x'}, {'stock': -1},
                     {'stock': 1.5}, {'name': 'a\x00b'}, {'sku': 5, 'stock': 1}):
            self.assertEqual(self.put(product.pk, body).status_code, 400, body)
        self.assertEqual(self.put(product.pk, {'name': 'x', 'lang': 'fr'}).json()['code'], 'INVALID_LANGUAGE')
        self.assertEqual(self.put(product.pk, {'name': 'x', 'lang': 5}).json()['code'], 'INVALID_LANGUAGE')

    def test_update_lone_surrogate_400(self):
        product = make_product('Tee')
        raw = '{"%s": "bad\\ud800"%s}'
        for body in (raw % ('name', ''), raw % ('description', ''), raw % ('sku', ', "stock": 1')):
            res = self.client.put(f'{BASE}/{product.pk}', body, content_type='application/json')
            self.assertEqual(res.status_code, 400, body)
        self.assertEqual(product.translations.get().name, 'Tee')

    def test_update_integrity_failure_is_409(self):
        product = make_product('Tee')
        cause = Exception()
        cause.sqlstate = '23503'
        failure = IntegrityError()
        failure.__cause__ = cause
        with mock.patch('apps.catalog.admin_products.ProductCategory.objects.update_or_create', side_effect=failure):
            res = self.put(product.pk, {'category_id': make_category('New').pk})
        self.assertEqual((res.status_code, res.json()['code']), (409, 'CATEGORY_NOT_FOUND'))

    def test_update_404_and_bad_id(self):
        self.assertEqual(self.put(999, {'name': 'x'}).json()['code'], 'PRODUCT_NOT_FOUND')
        self.assertEqual(self.put('abc', {'name': 'x'}).json()['code'], 'INVALID_PRODUCT_ID')


class DeleteTests(AdminProductCase):
    def test_delete_default_soft(self):
        product = make_product('Tee')
        add_variant(product, colour='Red')
        res = self.client.delete(f'{BASE}/{product.pk}')
        self.assertEqual(res.json()['data'], {'productId': product.pk, 'deleted': True, 'mode': 'SOFT'})
        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertEqual(product.variants.filter(is_active=True).count(), 2)
        self.assertEqual(self.client.delete(f'{BASE}/{product.pk}').status_code, 200)

    def test_soft_delete_hides_from_storefront(self):
        product = make_product('Tee')
        self.assertEqual(self.client.get('/api/client/products').json()['data']['pagination']['totalItems'], 1)
        self.client.delete(f'{BASE}/{product.pk}?mode=soft')
        self.assertEqual(self.client.get('/api/client/products').json()['data']['pagination']['totalItems'], 0)
        self.assertEqual(self.client.get(BASE).json()['data']['totalItems'], 1)

    def test_soft_delete_then_reactivate_is_purchasable(self):
        product = make_product('Tee')
        self.client.delete(f'{BASE}/{product.pk}')
        res = self.client.put(f'{BASE}/{product.pk}', {'isActive': True}, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.client.get('/api/client/products').json()['data']['pagination']['totalItems'], 1)
        self.assertTrue(res.json()['data']['variants'][0]['isActive'])

    def test_hard_delete_removes_rows_and_files(self):
        category = make_category('Tops')
        product_id = self.create_product(category)
        paths = [Path(self.tmp.name) / m.file_path for m in ProductMedia.objects.filter(product_id=product_id)]
        self.assertTrue(all(path.is_file() for path in paths))
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.delete(f'{BASE}/{product_id}?mode=HARD')
        self.assertEqual(res.json()['data']['mode'], 'HARD')
        self.assertFalse(Product.objects.filter(pk=product_id).exists())
        self.assertFalse(ProductVariant.objects.filter(product_id=product_id).exists())
        self.assertFalse(any(path.exists() for path in paths))

    def test_hard_delete_removes_bucket_files_but_not_seed_images(self):
        product = make_product('Tee')
        ProductMedia.objects.create(product=product, bucket_name='shop', file_path='products/a.jpg',
                                    public_url='https://x/a.jpg', sort_order=2)
        ProductMedia.objects.create(product=product, bucket_name='local', file_path='hero.jpg',
                                    public_url='/images/hero.jpg', sort_order=3)
        with mock.patch('apps.catalog.admin_products.storage.delete_files') as delete_files:
            with self.captureOnCommitCallbacks(execute=True):
                self.client.delete(f'{BASE}/{product.pk}?mode=HARD')
        delete_files.assert_called_once_with(['products/a.jpg'])

    def create_product(self, category):
        res = self.client.post(BASE, {
            **{key: json.dumps(value) for key, value in good_payload(category.pk).items()
               if key in ('translations', 'categories', 'variants', 'media')},
            'productType': 'TOP', 'mediaFiles': [image()],
        })
        return res.json()['data']['productId']

    def test_hard_delete_keeps_order_snapshots(self):
        product = make_product('Tee')
        variant = product.variants.get()
        user = User.objects.create(
            email='b@example.com', password_hash='x', first_name='A', last_name='B',
            date_of_birth=date(2000, 1, 1), phone_number='0800000000',
        )
        order = Order.objects.create(
            user=user, subtotal=Decimal('50'), shipping_fee=Decimal('0'), vat_amount=Decimal('0'),
            total=Decimal('50'), shipping_address_snapshot={}, billing_address_snapshot={},
        )
        item = OrderItem.objects.create(
            order=order, product_variant=variant, snapshot_product_name='Tee', snapshot_color='Black',
            snapshot_size='M', snapshot_unit_price=Decimal('50'), quantity=1, line_total=Decimal('50'),
        )
        self.assertEqual(self.client.delete(f'{BASE}/{product.pk}?mode=hard').status_code, 200)
        item.refresh_from_db()
        self.assertIsNone(item.product_variant_id)
        self.assertEqual(item.snapshot_product_name, 'Tee')
        self.assertTrue(Order.objects.filter(pk=order.pk).exists())

    def test_delete_bad_mode_400(self):
        product = make_product('Tee')
        res = self.client.delete(f'{BASE}/{product.pk}?mode=gone')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_QUERY'))
        self.assertTrue(Product.objects.filter(pk=product.pk).exists())

    def test_delete_404_and_bad_id(self):
        self.assertEqual(self.client.delete(f'{BASE}/999').json()['code'], 'PRODUCT_NOT_FOUND')
        self.assertEqual(self.client.delete(f'{BASE}/x').json()['code'], 'INVALID_PRODUCT_ID')


class GuardTests(TestCase):
    def calls(self):
        return [
            ('get', BASE), ('post', BASE), ('get', f'{BASE}/1'), ('put', f'{BASE}/1'),
            ('delete', f'{BASE}/1'), ('get', f'{BASE}/1/images'), ('post', f'{BASE}/1/images'),
            ('post', f'{BASE}/1/image'),
        ]

    def test_every_route_401_without_session(self):
        for method, url in self.calls():
            self.assertEqual(getattr(self.client, method)(url).status_code, 401, url)

    def test_every_route_403_for_customer(self):
        user = User.objects.create(
            email='c@example.com', password_hash='x', first_name='A', last_name='B',
            date_of_birth=date(2000, 1, 1), phone_number='0800000000',
        )
        token, _ = create_session(user, Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        for method, url in self.calls():
            self.assertEqual(getattr(self.client, method)(url).status_code, 403, url)

    def test_inactive_admin_403(self):
        token, _ = create_session(make_admin(is_active=False), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.client.get(BASE).status_code, 403)
