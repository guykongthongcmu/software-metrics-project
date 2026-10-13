from datetime import timedelta
from decimal import Decimal
from itertools import count

from django.test import TestCase
from django.utils import timezone

from apps.catalog.models import (
    Category, CategoryTranslation, Product, ProductCategory, ProductMedia,
    ProductTranslation, ProductVariant,
)

BASE = '/api/client'
_sku = count(1)


def make_category(name, slug=None, hidden=False):
    return Category.objects.create(
        category_name=name, slug=slug or name.lower().replace(' ', '-'), is_hidden=hidden,
    )


def make_product(name, price='50.00', compare_at=None, category=None, stock=5,
                 age_days=0, active=True, variants=True, media=True, description=None):
    product = Product.objects.create(product_type='TOP', is_active=active)
    ProductTranslation.objects.create(
        product=product, language_code='EN', name=name, description=description,
    )
    if media:
        ProductMedia.objects.create(
            product=product, bucket_name='b', file_path=f'p/{product.pk}.jpg',
            public_url=f'https://cdn.test/{product.pk}.jpg', sort_order=1, is_hero=True,
        )
    if variants:
        add_variant(product, price=price, compare_at=compare_at, stock=stock)
    if category:
        ProductCategory.objects.create(product=product, category=category, is_primary=True)
    # created_at is auto_now_add, so push it back with an update
    Product.objects.filter(pk=product.pk).update(created_at=timezone.now() - timedelta(days=age_days))
    return product


def add_variant(product, price='50.00', compare_at=None, stock=5, colour='Black', size='M', active=True):
    return ProductVariant.objects.create(
        product=product, sku_code=f'SKU-{next(_sku)}', colour=colour, size=size,
        price=Decimal(price), compare_at_price=Decimal(compare_at) if compare_at else None,
        stock_qty=stock, is_active=active,
    )


def names(response):
    return [item['name'] for item in response.json()['data']['products']]


class CategoryTests(TestCase):
    def test_only_visible_categories_sorted_by_name(self):
        make_category('Women')
        make_category('Men')
        make_category('Secret', hidden=True)
        res = self.client.get(f'{BASE}/categories')
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body['status'], 'success')
        self.assertEqual([c['categoryName'] for c in body['data']['categories']], ['Men', 'Women'])
        self.assertFalse(body['data']['categories'][0]['isHidden'])

    def test_order_desc(self):
        make_category('Men')
        make_category('Women')
        res = self.client.get(f'{BASE}/categories?order=desc')
        self.assertEqual([c['categoryName'] for c in res.json()['data']['categories']], ['Women', 'Men'])

    def test_bad_sort_and_order_are_rejected(self):
        for query in ('sort=price', 'order=sideways'):
            res = self.client.get(f'{BASE}/categories?{query}')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_QUERY')


class ProductListTests(TestCase):
    def test_hidden_inactive_and_unready_products_are_left_out(self):
        make_product('Visible')
        make_product('Inactive', active=False)
        make_product('No variants', variants=False)
        make_product('No image', media=False)
        product = make_product('All variants off')
        ProductVariant.objects.filter(product=product).update(is_active=False)

        res = self.client.get(f'{BASE}/products')
        self.assertEqual(names(res), ['Visible'])
        self.assertEqual(res.json()['data']['pagination']['totalItems'], 1)

    def test_card_shape_uses_cheapest_active_variant(self):
        product = make_product('Linen Shirt', price='80.00', compare_at='100.00', description='Light shirt')
        add_variant(product, price='120.00', colour='beige', size='L')
        add_variant(product, price='60.00', colour='Beige', size='S', active=False)
        add_variant(product, price='90.00', colour='Brown', size='XL', stock=0)

        card = self.client.get(f'{BASE}/products').json()['data']['products'][0]
        self.assertEqual(card['productId'], product.pk)
        self.assertEqual(card['detail'], 'Light shirt')
        self.assertEqual(card['price'], 80)
        self.assertEqual(card['originalPrice'], 100)
        self.assertEqual(card['discount'], {'type': 'percentage', 'value': 20})
        self.assertEqual(card['color'], ['beige', 'Black', 'Brown'])
        self.assertEqual(card['size'], ['L', 'M', 'XL'])
        self.assertEqual(card['image'], f'https://cdn.test/{product.pk}.jpg')
        self.assertTrue(card['inStock'])

    def test_compare_at_not_above_price_gives_no_discount(self):
        make_product('Plain', price='50.00', compare_at='50.00')
        card = self.client.get(f'{BASE}/products').json()['data']['products'][0]
        self.assertIsNone(card['originalPrice'])
        self.assertIsNone(card['discount'])

    def test_out_of_stock_flag(self):
        make_product('Sold out', stock=0)
        card = self.client.get(f'{BASE}/products').json()['data']['products'][0]
        self.assertFalse(card['inStock'])

    def test_pagination_and_totals(self):
        for index in range(5):
            make_product(f'Item {index}', age_days=index)
        res = self.client.get(f'{BASE}/products?page=2&limit=2')
        data = res.json()['data']
        self.assertEqual(data['pagination'], {'page': 2, 'limit': 2, 'totalItems': 5, 'totalPages': 3})
        self.assertEqual(names(res), ['Item 2', 'Item 3'])

    def test_bad_paging_falls_back_and_limit_is_capped(self):
        make_product('Only')
        data = self.client.get(f'{BASE}/products?page=abc&limit=999').json()['data']
        self.assertEqual(data['pagination']['page'], 1)
        self.assertEqual(data['pagination']['limit'], 50)

    def test_language_falls_back_to_english(self):
        product = make_product('Shirt')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อ')
        make_product('Only english')
        res = self.client.get(f'{BASE}/products?lang=th')
        self.assertEqual(set(names(res)), {'เสื้อ', 'Only english'})

    def test_invalid_language(self):
        res = self.client.get(f'{BASE}/products?lang=fr')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_LANGUAGE')


class NewArrivalsTests(TestCase):
    def test_returns_four_newest(self):
        for index in range(6):
            make_product(f'Item {index}', age_days=index)
        res = self.client.get(f'{BASE}/products/new-arrivals')
        self.assertEqual(names(res), ['Item 0', 'Item 1', 'Item 2', 'Item 3'])


class CategoryProductsTests(TestCase):
    def setUp(self):
        self.shirts = make_category('Men Shirts', 'men-shirts')
        make_product('Cheap', price='10.00', category=self.shirts, age_days=2)
        make_product('Mid', price='30.00', category=self.shirts, age_days=0)
        make_product('Pricey', price='90.00', category=self.shirts, age_days=1)
        make_product('Elsewhere', category=make_category('Kids'))

    def url(self, query=''):
        return f'{BASE}/products/category/men-shirts{query}'

    def test_lists_only_that_category_with_category_info(self):
        data = self.client.get(self.url()).json()['data']
        self.assertEqual(data['category']['slug'], 'men-shirts')
        self.assertEqual(data['category']['name'], 'Men Shirts')
        self.assertEqual(data['pagination']['totalItems'], 3)
        self.assertNotIn('category', data['products'][0])

    def test_every_sort(self):
        expected = {
            'newest': ['Mid', 'Pricey', 'Cheap'],
            'price_asc': ['Cheap', 'Mid', 'Pricey'],
            'price_desc': ['Pricey', 'Mid', 'Cheap'],
        }
        for sort, order in expected.items():
            self.assertEqual(names(self.client.get(self.url(f'?sort={sort}'))), order, sort)

    def test_unknown_sort_uses_newest(self):
        self.assertEqual(names(self.client.get(self.url('?sort=relevance')))[0], 'Mid')

    def test_slug_is_case_insensitive(self):
        res = self.client.get(f'{BASE}/products/category/MEN-SHIRTS')
        self.assertEqual(res.status_code, 200)

    def test_hidden_or_missing_category_is_404(self):
        make_category('Hidden', 'hidden', hidden=True)
        for slug in ('hidden', 'nope'):
            res = self.client.get(f'{BASE}/products/category/{slug}')
            self.assertEqual(res.status_code, 404)
            self.assertEqual(res.json()['code'], 'CATEGORY_NOT_FOUND')

    def test_products_in_hidden_category_are_not_returned_in_other_lists(self):
        hidden = make_category('Hidden', 'hidden', hidden=True)
        make_product('Ghost', category=hidden)
        res = self.client.get(f'{BASE}/products/search?q=ghost')
        card = res.json()['data']['products'][0]
        self.assertIsNone(card['category'])
        self.assertEqual(res.json()['data']['categoryCounts'], [])

    def test_translated_category_name(self):
        CategoryTranslation.objects.create(category=self.shirts, language_code='TH', name='เสื้อเชิ้ต')
        data = self.client.get(self.url('?lang=TH')).json()['data']
        self.assertEqual(data['category']['name'], 'เสื้อเชิ้ต')


class SearchTests(TestCase):
    def test_query_is_required(self):
        for query in ('', '?q=', '?q=%20%20'):
            res = self.client.get(f'{BASE}/products/search{query}')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_QUERY')

    def test_matches_name_case_insensitively_and_returns_totals(self):
        make_product('Linen Shirt')
        make_product('Wool Coat')
        res = self.client.get(f'{BASE}/products/search?q=LINEN')
        self.assertEqual(names(res), ['Linen Shirt'])
        data = res.json()['data']
        self.assertEqual(data['query'], 'LINEN')
        self.assertEqual(data['pagination']['totalItems'], 1)

    def test_no_results(self):
        data = self.client.get(f'{BASE}/products/search?q=zzz').json()['data']
        self.assertEqual(data['products'], [])
        self.assertEqual(data['pagination']['totalPages'], 0)

    def test_percent_and_underscore_are_literal(self):
        make_product('Plain Tee')
        res = self.client.get(f'{BASE}/products/search?q=%25')
        self.assertEqual(names(res), [])

    def test_relevance_puts_exact_then_prefix_then_contains(self):
        make_product('Big Linen', age_days=0)
        make_product('Linen Shirt', age_days=1)
        make_product('Linen', age_days=2)
        res = self.client.get(f'{BASE}/products/search?q=linen')
        self.assertEqual(names(res), ['Linen', 'Linen Shirt', 'Big Linen'])

    def test_other_sorts(self):
        make_product('Tee A', price='30.00', age_days=1)
        make_product('Tee B', price='10.00', age_days=0)
        make_product('Tee C', price='20.00', age_days=2)
        order = {
            'newest': ['Tee B', 'Tee A', 'Tee C'],
            'price_asc': ['Tee B', 'Tee C', 'Tee A'],
            'price_desc': ['Tee A', 'Tee C', 'Tee B'],
        }
        for sort, expected in order.items():
            self.assertEqual(names(self.client.get(f'{BASE}/products/search?q=tee&sort={sort}')), expected, sort)

    def test_cards_carry_primary_category(self):
        make_product('Linen Shirt', category=make_category('Men Shirts', 'men-shirts'))
        card = self.client.get(f'{BASE}/products/search?q=linen').json()['data']['products'][0]
        self.assertEqual(card['category']['slug'], 'men-shirts')

    def test_counts_per_category_cover_all_pages(self):
        men = make_category('Men')
        kids = make_category('Kids')
        for index in range(3):
            make_product(f'Tee {index}', category=men)
        make_product('Tee kid', category=kids)
        make_product('Hat', category=kids)
        res = self.client.get(f'{BASE}/products/search?q=tee&limit=1')
        counts = res.json()['data']['categoryCounts']
        self.assertEqual([(c['slug'], c['count']) for c in counts], [('kids', 1), ('men', 3)])
        self.assertEqual(res.json()['data']['pagination']['totalItems'], 4)

    def test_product_in_two_categories_counts_in_both(self):
        men = make_category('Men')
        sale = make_category('Sale')
        product = make_product('Tee', category=men)
        ProductCategory.objects.create(product=product, category=sale)
        counts = self.client.get(f'{BASE}/products/search?q=tee').json()['data']['categoryCounts']
        self.assertEqual({c['slug']: c['count'] for c in counts}, {'men': 1, 'sale': 1})

    def test_matches_any_translation(self):
        product = make_product('Shirt')
        ProductTranslation.objects.create(product=product, language_code='TH', name='เสื้อ')
        self.assertEqual(names(self.client.get(f'{BASE}/products/search?q=เสื้อ')), ['Shirt'])


class SuggestionTests(TestCase):
    def test_needs_a_query(self):
        res = self.client.get(f'{BASE}/products/search/suggestions')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['message'], 'q must be at least 1 character')

    def test_returns_cards_without_category_capped_at_eight(self):
        for index in range(10):
            make_product(f'Linen {index}', age_days=index)
        make_product('Wool')
        data = self.client.get(f'{BASE}/products/search/suggestions?q=lin').json()['data']
        self.assertEqual(data['query'], 'lin')
        self.assertEqual(len(data['suggestions']), 8)
        self.assertNotIn('category', data['suggestions'][0])

    def test_no_matches(self):
        data = self.client.get(f'{BASE}/products/search/suggestions?q=zzz').json()['data']
        self.assertEqual(data['suggestions'], [])


class RecommendationTests(TestCase):
    def ids(self, query=''):
        res = self.client.get(f'{BASE}/products/recommendations{query}')
        self.assertEqual(res.status_code, 200)
        return [item['productId'] for item in res.json()['data']['products']], res.json()['data']

    def test_defaults_to_four_newest(self):
        products = [make_product(f'Item {index}', age_days=index) for index in range(6)]
        ids, data = self.ids()
        self.assertEqual(ids, [p.pk for p in products[:4]])
        self.assertEqual(data['limit'], 4)
        self.assertIsNone(data['context'])

    def test_skips_excluded_ids_and_still_fills_the_limit(self):
        products = [make_product(f'Item {index}', age_days=index) for index in range(6)]
        excluded = f'{products[0].pk},{products[1].pk}'
        ids, _ = self.ids(f'?limit=3&excludeProductIds={excluded}')
        self.assertEqual(ids, [p.pk for p in products[2:5]])

    def test_category_matches_come_first(self):
        shirts = make_category('Shirts')
        newest = make_product('Newest other', age_days=0)
        old_a = make_product('Old shirt', category=shirts, age_days=5)
        old_b = make_product('Older shirt', category=shirts, age_days=6)
        ids, _ = self.ids('?limit=3&category=shirts&context=cart')
        self.assertEqual(ids, [old_a.pk, old_b.pk, newest.pk])

    def test_context_is_echoed_lowercased(self):
        _, data = self.ids('?context=Cart')
        self.assertEqual(data['context'], 'cart')

    def test_inactive_products_never_recommended(self):
        make_product('Gone', active=False)
        ids, _ = self.ids()
        self.assertEqual(ids, [])

    def test_bad_limit(self):
        for value in ('0', '21', 'abc'):
            res = self.client.get(f'{BASE}/products/recommendations?limit={value}')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_QUERY')

    def test_huge_page_number_does_not_error(self):
        res = self.client.get(f'{BASE}/products?page=99999999999999999999')
        self.assertEqual(res.status_code, 200)

    def test_bad_exclude_ids(self):
        for value in ('1,x', '-3', '0', '²', '99999999999999999999'):
            res = self.client.get(f'{BASE}/products/recommendations?excludeProductIds={value}')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_EXCLUDE_PRODUCT_IDS')

    def test_duplicate_exclude_ids_are_fine(self):
        product = make_product('Item')
        ids, _ = self.ids(f'?excludeProductIds={product.pk},{product.pk}')
        self.assertEqual(ids, [])
