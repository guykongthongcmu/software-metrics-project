import os

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.accounts.models import Admin
from apps.catalog.models import (
    Category,
    CategoryTranslation,
    Product,
    ProductCategory,
    ProductMedia,
    ProductTranslation,
    ProductVariant,
)
from apps.catalog.seed_data import CATEGORIES, GROUP_ASSETS, GROUPS, KEYWORDS

# Local dev fallbacks only. In any other environment the password must come from the env.
DEV_ADMIN_EMAIL = 'admin@coreco.test'
DEV_ADMIN_PASSWORD = 'secret123'

# Images are served by the frontend from public/images unless SEED_IMAGE_BASE_URL points elsewhere
# (for example a Supabase public bucket URL after the files were uploaded by hand).
DEFAULT_IMAGE_BASE_URL = '/images'


def keyword_for(file_name):
    name = file_name.rsplit('.', 1)[0]
    if name == 'linen_shirt':
        return name
    return name.split('-', 1)[1] if '-' in name else name


class Command(BaseCommand):
    help = 'Seed the demo catalogue (categories, products, variants, images) and the admin account.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Delete all catalogue rows and the seeded admin first, then seed again.',
        )

    def handle(self, *args, **options):
        admin_email = os.environ.get('SEED_ADMIN_EMAIL') or DEV_ADMIN_EMAIL
        admin_password = os.environ.get('SEED_ADMIN_PASSWORD')
        if not admin_password:
            if not settings.DEBUG:
                raise CommandError('Set SEED_ADMIN_PASSWORD (the dev default only works when DEBUG is on).')
            admin_password = DEV_ADMIN_PASSWORD

        with transaction.atomic():
            if options['reset']:
                self.reset(admin_email)
            categories = self.seed_categories()
            count = self.seed_products(categories)
            self.seed_admin(admin_email, admin_password)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {len(categories)} categories, {count} products and admin {admin_email}.'
        ))

    def reset(self, admin_email):
        ProductMedia.objects.all().delete()
        ProductVariant.objects.all().delete()
        ProductTranslation.objects.all().delete()
        ProductCategory.objects.all().delete()
        Product.objects.all().delete()
        CategoryTranslation.objects.all().delete()
        Category.objects.all().delete()
        Admin.objects.filter(email__iexact=admin_email).delete()

    def seed_categories(self):
        categories = {}
        for item in CATEGORIES:
            category, _ = Category.objects.update_or_create(
                slug=item['slug'],
                defaults={'category_name': item['en'], 'parent': None, 'is_hidden': False},
            )
            for code in ('EN', 'TH'):
                CategoryTranslation.objects.update_or_create(
                    category=category, language_code=code,
                    defaults={'name': item[code.lower()]},
                )
            categories[item['slug']] = category
        return categories

    def seed_products(self, categories):
        base_url = (os.environ.get('SEED_IMAGE_BASE_URL') or DEFAULT_IMAGE_BASE_URL).rstrip('/')
        bucket = settings.SUPABASE_BUCKET or 'local'
        product_number = 1101
        count = 0

        for group_key, files in GROUP_ASSETS.items():
            group = GROUPS[group_key]
            for index, file_name in enumerate(files):
                keyword = keyword_for(file_name)
                meta = KEYWORDS[keyword]
                sizes = group[{'ACCESSORY': 'accessory_sizes', 'BOTTOM': 'bottom_sizes'}.get(meta['type'], 'top_sizes')]

                price = meta['base_price'] + group['price_offset'] + index * 20
                compare_at = price + meta['compare_delta'] if index % 2 == 0 else None
                sku_base = f"{group_key[:3].upper()}-{keyword.upper().replace('_', '')}-{product_number}"

                variants = [
                    (f'{sku_base}-A', meta['colours'][0], sizes[0], 16 + index % 8),
                    (f'{sku_base}-B', meta['colours'][1], sizes[1], 13 + index % 7),
                ]

                # The first variant's SKU identifies the product, so a second run updates it.
                existing = ProductVariant.objects.filter(sku_code__iexact=variants[0][0]).first()
                if existing:
                    product = existing.product
                    product.product_type = meta['type']
                    product.is_active = True
                    product.save()
                else:
                    product = Product.objects.create(product_type=meta['type'])

                name_en = f"{group['en']} {meta['name_en']}"
                name_th = f"{meta['name_th']} {group['th']}"
                desc_en = f"{meta['desc_en']} Curated for the {group['en'].lower()} storefront collection."
                desc_th = f"{meta['desc_th']} คัดเลือกสำหรับหมวด{group['th']}ของร้านค้า"
                for code, name, desc in (('EN', name_en, desc_en), ('TH', name_th, desc_th)):
                    ProductTranslation.objects.update_or_create(
                        product=product, language_code=code,
                        defaults={'name': name, 'description': desc},
                    )

                ProductCategory.objects.filter(product=product).exclude(category=categories[group_key]).delete()
                ProductCategory.objects.update_or_create(
                    product=product, category=categories[group_key], defaults={'is_primary': True},
                )

                for sku, colour, size, stock in variants:
                    ProductVariant.objects.update_or_create(
                        sku_code=sku,
                        defaults={
                            'product': product, 'colour': colour, 'size': size, 'price': price,
                            'compare_at_price': compare_at, 'stock_qty': stock, 'is_active': True,
                        },
                    )

                # Sort order 1 is the hero shot and 2 is the thumbnail, both from the same file.
                for order, (is_hero, is_thumb, label) in enumerate(
                    [(True, False, 'hero'), (False, True, 'thumbnail')], start=1,
                ):
                    ProductMedia.objects.update_or_create(
                        product=product, sort_order=order,
                        defaults={
                            'bucket_name': bucket, 'file_path': file_name,
                            'public_url': f'{base_url}/{file_name}', 'alt_text': f'{name_en} {label}',
                            'is_hero': is_hero, 'is_thumbnail': is_thumb,
                        },
                    )

                product_number += 1
                count += 1
        return count

    def seed_admin(self, email, password):
        admin = Admin.objects.filter(email__iexact=email).first()
        if admin is None:
            Admin.objects.create(
                email=email, password_hash=make_password(password), display_name='Admin', is_active=True,
            )
            return
        admin.is_active = True
        # Only rehash when the password changed so a second run leaves the row untouched.
        if not check_password(password, admin.password_hash):
            admin.password_hash = make_password(password)
        admin.save()
