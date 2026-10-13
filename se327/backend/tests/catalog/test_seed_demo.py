import os
from io import StringIO
from unittest import mock

from django.contrib.auth.hashers import check_password
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from apps.accounts.models import Admin
from apps.catalog.models import (
    Category,
    CategoryTranslation,
    Product,
    ProductMedia,
    ProductTranslation,
    ProductVariant,
)
from apps.catalog.seed_data import GROUP_ASSETS

TOTAL_PRODUCTS = sum(len(files) for files in GROUP_ASSETS.values())


def run_seed(*args, **env):
    values = {'SEED_ADMIN_PASSWORD': 'test-pass-123'}
    values.update(env)
    with mock.patch.dict(os.environ, values):
        call_command('seed_demo', *args, stdout=StringIO())


class SeedDemoTests(TestCase):
    def test_creates_five_visible_top_level_categories(self):
        run_seed()
        categories = Category.objects.all()
        self.assertEqual(
            sorted(c.slug for c in categories),
            ['baby', 'kids', 'men', 'unisex', 'women'],
        )
        for category in categories:
            self.assertIsNone(category.parent)
            self.assertFalse(category.is_hidden)
        self.assertEqual(CategoryTranslation.objects.count(), 10)

    def test_products_have_variants_prices_stock_and_images(self):
        run_seed()
        self.assertEqual(Product.objects.count(), TOTAL_PRODUCTS)
        self.assertEqual(ProductTranslation.objects.count(), TOTAL_PRODUCTS * 2)
        for product in Product.objects.all():
            variants = product.variants.all()
            self.assertEqual(len(variants), 2)
            for variant in variants:
                self.assertGreater(variant.price, 0)
                self.assertGreater(variant.stock_qty, 0)
            self.assertEqual(product.product_categories.filter(is_primary=True).count(), 1)
            media = product.media.order_by('sort_order')
            self.assertEqual([m.sort_order for m in media], [1, 2])
            self.assertTrue(media[0].is_hero)
            self.assertTrue(media[1].is_thumbnail)
            self.assertTrue(media[0].public_url.startswith('/images/'))

    def test_image_base_url_can_be_overridden(self):
        run_seed(SEED_IMAGE_BASE_URL='https://cdn.example.com/products/')
        url = ProductMedia.objects.first().public_url
        self.assertTrue(url.startswith('https://cdn.example.com/products/'))

    def test_running_twice_does_not_duplicate_rows(self):
        run_seed()
        counts = (
            Category.objects.count(), Product.objects.count(), ProductVariant.objects.count(),
            ProductMedia.objects.count(), Admin.objects.count(),
        )
        run_seed()
        self.assertEqual(counts, (
            Category.objects.count(), Product.objects.count(), ProductVariant.objects.count(),
            ProductMedia.objects.count(), Admin.objects.count(),
        ))

    def test_admin_password_is_hashed_and_matches_env(self):
        run_seed(SEED_ADMIN_EMAIL='boss@coreco.test')
        admin = Admin.objects.get(email='boss@coreco.test')
        self.assertNotEqual(admin.password_hash, 'test-pass-123')
        self.assertTrue(check_password('test-pass-123', admin.password_hash))
        self.assertTrue(admin.is_active)

    def test_admin_hash_is_kept_when_password_unchanged_and_updated_when_changed(self):
        run_seed()
        first = Admin.objects.get().password_hash
        run_seed()
        self.assertEqual(Admin.objects.get().password_hash, first)
        run_seed(SEED_ADMIN_PASSWORD='another-pass-456')
        admin = Admin.objects.get()
        self.assertTrue(check_password('another-pass-456', admin.password_hash))

    @override_settings(DEBUG=False)
    def test_missing_password_is_an_error_outside_debug(self):
        env = {k: v for k, v in os.environ.items() if k != 'SEED_ADMIN_PASSWORD'}
        with mock.patch.dict(os.environ, env, clear=True):
            with self.assertRaises(CommandError):
                call_command('seed_demo', stdout=StringIO())
        self.assertEqual(Admin.objects.count(), 0)

    @override_settings(DEBUG=True)
    def test_dev_default_password_is_used_in_debug(self):
        env = {k: v for k, v in os.environ.items() if k != 'SEED_ADMIN_PASSWORD'}
        with mock.patch.dict(os.environ, env, clear=True):
            call_command('seed_demo', stdout=StringIO())
        self.assertTrue(check_password('secret123', Admin.objects.get().password_hash))

    def test_reset_removes_stale_rows_and_reseeds(self):
        run_seed()
        Product.objects.create(product_type='TOP')
        Category.objects.create(category_name='Old', slug='old')
        run_seed('--reset')
        self.assertEqual(Product.objects.count(), TOTAL_PRODUCTS)
        self.assertFalse(Category.objects.filter(slug='old').exists())
        self.assertEqual(Admin.objects.count(), 1)

    def test_rerun_restores_edited_price(self):
        run_seed()
        variant = ProductVariant.objects.first()
        original = variant.price
        variant.price = 1
        variant.save()
        run_seed()
        variant.refresh_from_db()
        self.assertEqual(variant.price, original)
