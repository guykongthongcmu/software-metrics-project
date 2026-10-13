from pathlib import Path
from unittest import mock

from apps.catalog.models import ProductMedia
from common import storage
from tests.catalog.test_admin_products import JPEG, PNG, AdminProductCase, image
from tests.catalog.test_storefront import make_product

BASE = '/api/admin/products'


class AddImageTests(AdminProductCase):
    def upload(self, product_id, data=None, route='image'):
        form = {'image': image()}
        form.update(data or {})
        return self.client.post(f'{BASE}/{product_id}/{route}', form)

    def test_add_image_201_both_routes(self):
        product = make_product('Tee', media=False)
        for route, order in (('image', 1), ('images', 2)):
            res = self.upload(product.pk, {'altText': 'side'}, route)
            self.assertEqual(res.status_code, 201, res.content)
            data = res.json()['data']
            self.assertEqual((data['productId'], data['sortOrder'], data['altText']), (product.pk, order, 'side'))
            self.assertEqual(data['bucketName'], 'local')
            self.assertRegex(data['publicUrl'], r'^/media/products/[0-9a-f]{32}\.jpg$')
        self.assertEqual(len(self.stored_files()), 2)

    def test_file_exists_under_media_root(self):
        product = make_product('Tee', media=False)
        data = self.upload(product.pk, {'image': image('x.png', PNG, 'image/png')}).json()['data']
        self.assertTrue(data['filePath'].endswith('.png'))
        self.assertEqual((Path(self.tmp.name) / data['filePath']).read_bytes(), PNG)

    def test_add_image_options_persist(self):
        product = make_product('Tee', media=False)
        res = self.upload(product.pk, {'isThumbnail': 'true', 'isHero': 'TRUE', 'sortOrder': '3'})
        data = res.json()['data']
        self.assertEqual((data['isThumbnail'], data['isHero'], data['sortOrder']), (True, True, 3))

    def test_add_image_required_400(self):
        product = make_product('Tee', media=False)
        res = self.client.post(f'{BASE}/{product.pk}/image', {'altText': 'x'})
        self.assertEqual((res.status_code, res.json()['code']), (400, 'IMAGE_REQUIRED'))

    def test_wrong_type_400_and_spoofed(self):
        product = make_product('Tee', media=False)
        for content in (b'GIF89a' + b'0' * 30, b'<?php ?>', b''):
            res = self.upload(product.pk, {'image': image('a.jpg', content)})
            self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_FILE_TYPE'))
        self.assertEqual((ProductMedia.objects.count(), self.stored_files()), (0, []))

    def test_over_5mb_413(self):
        product = make_product('Tee', media=False)
        res = self.upload(product.pk, {'image': image('a.jpg', JPEG + b'0' * storage.MAX_IMAGE_BYTES)})
        self.assertEqual((res.status_code, res.json()['code']), (413, 'FILE_TOO_LARGE'))
        self.assertEqual(self.stored_files(), [])

    def test_huge_content_length_413(self):
        product = make_product('Tee', media=False)
        res = self.client.post(f'{BASE}/{product.pk}/image', {'a': 'b'}, CONTENT_LENGTH=str(10**9))
        self.assertEqual(res.status_code, 413)

    def test_json_body_is_415(self):
        product = make_product('Tee', media=False)
        res = self.client.post(f'{BASE}/{product.pk}/image', {'a': 1}, content_type='application/json')
        self.assertEqual(res.status_code, 415)

    def test_add_image_limit_409(self):
        product = make_product('Tee', media=False)
        for _ in range(4):
            self.assertEqual(self.upload(product.pk).status_code, 201)
        res = self.upload(product.pk)
        self.assertEqual((res.status_code, res.json()['code']), (409, 'PRODUCT_IMAGE_LIMIT_REACHED'))
        self.assertEqual((ProductMedia.objects.count(), len(self.stored_files())), (4, 4))

    def test_add_image_sort_order_taken_400(self):
        product = make_product('Tee')
        res = self.upload(product.pk, {'sortOrder': '1'})
        self.assertEqual((res.status_code, res.json()['code']), (400, 'VALIDATION_ERROR'))
        self.assertIn('sortOrder', res.json()['details'])
        self.assertEqual(self.stored_files(), [])

    def test_add_image_auto_sort_order_takes_first_gap(self):
        product = make_product('Tee')
        ProductMedia.objects.create(
            product=product, bucket_name='local', file_path='products/z.jpg',
            public_url='/media/products/z.jpg', sort_order=3,
        )
        first = self.upload(product.pk).json()['data']['sortOrder']
        second = self.upload(product.pk).json()['data']['sortOrder']
        self.assertEqual((first, second), (2, 4))

    def test_add_image_thumbnail_or_hero_already_taken_400(self):
        product = make_product('Tee')
        ProductMedia.objects.filter(product=product).update(is_thumbnail=True, is_hero=True)
        for field in ('isThumbnail', 'isHero'):
            res = self.upload(product.pk, {field: 'true'})
            self.assertEqual(res.status_code, 400, field)
            self.assertIn(field, res.json()['details'])

    def test_add_image_bad_options_400(self):
        product = make_product('Tee', media=False)
        for data in (
            {'sortOrder': '0'}, {'sortOrder': '5'}, {'sortOrder': 'x'}, {'sortOrder': '٣'},
            {'sortOrder': '1.5'}, {'isThumbnail': 'maybe'}, {'isHero': 'yes'},
            {'altText': 'a' * 256}, {'altText': 'a\x00b'},
        ):
            self.assertEqual(self.upload(product.pk, data).status_code, 400, data)
        self.assertEqual((ProductMedia.objects.count(), self.stored_files()), (0, []))

    def test_add_image_blank_options_use_defaults(self):
        product = make_product('Tee', media=False)
        res = self.upload(product.pk, {'sortOrder': '', 'isThumbnail': '', 'altText': ''})
        data = res.json()['data']
        self.assertEqual((res.status_code, data['sortOrder'], data['altText'], data['isHero']), (201, 1, None, False))

    def test_add_image_404_and_bad_id(self):
        self.assertEqual(self.upload(999).json()['code'], 'PRODUCT_NOT_FOUND')
        self.assertEqual(self.upload('abc').json()['code'], 'INVALID_PRODUCT_ID')
        self.assertEqual(self.stored_files(), [])

    def test_storage_failure_500(self):
        product = make_product('Tee', media=False)
        with mock.patch('apps.catalog.admin_images.storage.save_image', side_effect=storage.StorageError('x')):
            res = self.upload(product.pk)
        self.assertEqual((res.status_code, res.json()['code']), (500, 'STORAGE_UPLOAD_FAILED'))

    def test_file_removed_when_row_fails(self):
        product = make_product('Tee', media=False)
        self.client.raise_request_exception = False
        with mock.patch('apps.catalog.admin_images.ProductMedia.objects.create', side_effect=RuntimeError):
            res = self.upload(product.pk)
        self.assertEqual(res.status_code, 500)
        self.assertEqual(self.stored_files(), [])
