from datetime import date
from itertools import count
from unittest import mock

from django.db import IntegrityError
from django.test import TestCase

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.catalog.admin_categories import slugify
from apps.catalog.models import Category, CategoryTranslation, ProductCategory
from tests.catalog.test_storefront import make_category, make_product

BASE = '/api/admin/categories'
_n = count(1)


def make_admin(is_active=True):
    return Admin.objects.create(
        email=f'boss{next(_n)}@example.com', password_hash='x', display_name='Boss', is_active=is_active,
    )


class AdminCategoryCase(TestCase):
    def login_admin(self, is_active=True):
        token, _ = create_session(make_admin(is_active), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token

    def setUp(self):
        self.login_admin()

    def post(self, body, url=BASE):
        return self.client.post(url, body, content_type='application/json')

    def put(self, category_id, body):
        return self.client.put(f'{BASE}/{category_id}', body, content_type='application/json')

    def patch_visibility(self, category_id, body):
        return self.client.patch(f'{BASE}/{category_id}/visibility', body, content_type='application/json')


class SlugifyTests(TestCase):
    def test_slugify(self):
        self.assertEqual(slugify("Men's  Wear!"), 'men-s-wear')
        self.assertEqual(slugify('  --Tops--  '), 'tops')
        self.assertRegex(slugify('เสื้อ'), r'^category-[0-9a-f]{8}$')
        self.assertEqual(slugify('เสื้อ'), slugify('เสื้อ'))
        self.assertNotEqual(slugify('เสื้อ'), slugify('กางเกง'))


class ListTests(AdminCategoryCase):
    def test_list_includes_hidden_with_fields(self):
        make_category('Women')
        make_category('Secret', hidden=True)
        res = self.client.get(BASE)
        self.assertEqual(res.status_code, 200)
        rows = res.json()['data']['categories']
        self.assertEqual([row['categoryName'] for row in rows], ['Secret', 'Women'])
        self.assertEqual(
            rows[0],
            {'categoryId': rows[0]['categoryId'], 'categoryName': 'Secret', 'slug': 'secret',
             'isHidden': True, 'parentCategoryId': None},
        )

    def test_list_sort_order_and_bad_query(self):
        make_category('Men')
        make_category('Women')
        res = self.client.get(BASE, {'order': 'desc'})
        names = [row['categoryName'] for row in res.json()['data']['categories']]
        self.assertEqual(names, ['Women', 'Men'])
        self.assertEqual(self.client.get(BASE, {'sort': 'price'}).json()['code'], 'INVALID_QUERY')
        self.assertEqual(self.client.get(BASE, {'order': 'up'}).status_code, 400)

    def test_parent_category_id(self):
        parent = make_category('Men')
        child = Category.objects.create(category_name='Shirts', slug='shirts', parent=parent)
        rows = {row['categoryName']: row for row in self.client.get(BASE).json()['data']['categories']}
        self.assertEqual(rows['Shirts']['parentCategoryId'], parent.pk)
        self.assertIsNone(rows['Men']['parentCategoryId'])
        self.assertEqual(rows['Shirts']['categoryId'], child.pk)


class CreateTests(AdminCategoryCase):
    def test_create_builds_slug_and_en_translation(self):
        res = self.post({'categoryName': '  Summer Sale  '})
        self.assertEqual(res.status_code, 201)
        data = res.json()['data']
        self.assertEqual(data['categoryName'], 'Summer Sale')
        self.assertEqual(data['slug'], 'summer-sale')
        self.assertFalse(data['isHidden'])
        translation = CategoryTranslation.objects.get(category_id=data['categoryId'])
        self.assertEqual((translation.language_code, translation.name), ('EN', 'Summer Sale'))

    def test_create_duplicate_slug_409(self):
        self.post({'categoryName': 'Summer Sale'})
        res = self.post({'categoryName': 'summer-SALE'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CATEGORY_SLUG_CONFLICT')
        self.assertEqual(Category.objects.count(), 1)

    def test_create_validation_errors(self):
        for body in (
            {}, [], {'categoryName': None}, {'categoryName': 5}, {'categoryName': '   '},
            {'categoryName': 'x' * 101}, {'categoryName': 'bad\x00name'},
        ):
            res = self.post(body)
            self.assertEqual(res.status_code, 400, body)
            self.assertEqual(res.json()['code'], 'VALIDATION_ERROR')
        self.assertEqual(Category.objects.count(), 0)

    def test_create_name_at_limit_ok(self):
        self.assertEqual(self.post({'categoryName': 'x' * 100}).status_code, 201)

    def test_create_malformed_json_400(self):
        res = self.client.post(BASE, '{nope', content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_create_nonlatin_names_get_distinct_slugs(self):
        first = self.post({'categoryName': 'เสื้อ'})
        self.assertEqual(first.status_code, 201)
        self.assertRegex(first.json()['data']['slug'], r'^category-[0-9a-f]{8}$')
        self.assertEqual(self.post({'categoryName': 'กางเกง'}).status_code, 201)
        dup = self.post({'categoryName': 'เสื้อ'})
        self.assertEqual((dup.status_code, dup.json()['code']), (409, 'CATEGORY_SLUG_CONFLICT'))

    def test_create_lone_surrogate_400(self):
        res = self.client.post(BASE, '{"categoryName": "bad\\ud800name"}', content_type='application/json')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'VALIDATION_ERROR'))
        category = make_category('Tops')
        res = self.client.put(f'{BASE}/{category.pk}', '{"categoryName": "\\ud800"}', content_type='application/json')
        self.assertEqual(res.status_code, 400)

    def test_create_race_on_unique_index_409(self):
        with mock.patch('apps.catalog.admin_categories.Category.objects.create', side_effect=IntegrityError):
            res = self.post({'categoryName': 'Racy'})
        self.assertEqual(res.status_code, 409)


class RenameTests(AdminCategoryCase):
    def test_rename_updates_name_slug_translation(self):
        category = make_category('Tops')
        res = self.put(category.pk, {'categoryName': 'T Shirts'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['slug'], 't-shirts')
        category.refresh_from_db()
        self.assertEqual((category.category_name, category.slug), ('T Shirts', 't-shirts'))
        translation = CategoryTranslation.objects.get(category=category, language_code='EN')
        self.assertEqual(translation.name, 'T Shirts')

    def test_rename_keeps_other_translation(self):
        category = make_category('Tops')
        CategoryTranslation.objects.create(category=category, language_code='TH', name='เสื้อ')
        self.put(category.pk, {'categoryName': 'Shirts'})
        self.assertEqual(CategoryTranslation.objects.get(category=category, language_code='TH').name, 'เสื้อ')

    def test_rename_to_own_slug_ok(self):
        category = make_category('Tops')
        res = self.put(category.pk, {'categoryName': 'TOPS'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['categoryName'], 'TOPS')

    def test_rename_conflict_409(self):
        make_category('Tops')
        other = make_category('Pants')
        res = self.put(other.pk, {'categoryName': 'tops'})
        self.assertEqual(res.status_code, 409)
        other.refresh_from_db()
        self.assertEqual(other.slug, 'pants')

    def test_rename_race_409(self):
        category = make_category('Tops')
        with mock.patch.object(Category, 'save', side_effect=IntegrityError):
            res = self.put(category.pk, {'categoryName': 'Other'})
        self.assertEqual(res.status_code, 409)

    def test_rename_unknown_404_and_validation(self):
        self.assertEqual(self.put(999, {'categoryName': 'X'}).json()['code'], 'CATEGORY_NOT_FOUND')
        category = make_category('Tops')
        self.assertEqual(self.put(category.pk, {'categoryName': ''}).json()['code'], 'VALIDATION_ERROR')

    def test_bad_id_400(self):
        for raw in ('abc', '0', '-1', '1.5', '٣', '9' * 30):
            self.assertEqual(self.put(raw, {'categoryName': 'X'}).json()['code'], 'INVALID_CATEGORY_ID', raw)
            self.assertEqual(self.client.delete(f'{BASE}/{raw}').status_code, 400, raw)
            self.assertEqual(self.patch_visibility(raw, {'isHidden': True}).status_code, 400, raw)


class VisibilityTests(AdminCategoryCase):
    def test_visibility_hide_and_show_persist(self):
        category = make_category('Tops')
        res = self.patch_visibility(category.pk, {'isHidden': True})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(
            res.json()['data'],
            {'categoryId': category.pk, 'categoryName': 'Tops', 'slug': 'tops', 'isHidden': True},
        )
        category.refresh_from_db()
        self.assertTrue(category.is_hidden)
        self.patch_visibility(category.pk, {'isHidden': True})
        self.patch_visibility(category.pk, {'isHidden': False})
        category.refresh_from_db()
        self.assertFalse(category.is_hidden)

    def test_visibility_non_boolean_400(self):
        category = make_category('Tops')
        for value in ('true', 1, None):
            res = self.patch_visibility(category.pk, {'isHidden': value})
            self.assertEqual(res.json()['code'], 'INVALID_VISIBILITY_VALUE')
        self.assertEqual(self.patch_visibility(category.pk, {}).status_code, 400)
        self.assertEqual(self.patch_visibility(category.pk, []).status_code, 400)

    def test_visibility_unknown_404(self):
        self.assertEqual(self.patch_visibility(999, {'isHidden': True}).json()['code'], 'CATEGORY_NOT_FOUND')

    def test_hidden_category_gone_from_storefront_list_and_landing_404(self):
        category = make_category('Tops')
        make_product('Tee', category=category)
        client_base = '/api/client'
        self.assertEqual(self.client.get(f'{client_base}/products/category/tops').status_code, 200)
        self.patch_visibility(category.pk, {'isHidden': True})
        listed = self.client.get(f'{client_base}/categories').json()['data']['categories']
        self.assertEqual(listed, [])
        self.assertEqual(self.client.get(f'{client_base}/products/category/tops').status_code, 404)


class DeleteTests(AdminCategoryCase):
    def test_delete_unused(self):
        category = make_category('Tops')
        CategoryTranslation.objects.create(category=category, language_code='EN', name='Tops')
        res = self.client.delete(f'{BASE}/{category.pk}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'categoryId': category.pk, 'success': True})
        self.assertFalse(Category.objects.filter(pk=category.pk).exists())
        self.assertFalse(CategoryTranslation.objects.filter(category_id=category.pk).exists())

    def test_delete_in_use_by_product_409_nothing_changed(self):
        category = make_category('Tops')
        product = make_product('Tee', category=category)
        res = self.client.delete(f'{BASE}/{category.pk}')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'CATEGORY_IN_USE')
        self.assertTrue(Category.objects.filter(pk=category.pk).exists())
        self.assertTrue(ProductCategory.objects.filter(product=product, category=category).exists())

    def test_delete_with_children_409(self):
        parent = make_category('Men')
        child = Category.objects.create(category_name='Shirts', slug='shirts', parent=parent)
        res = self.client.delete(f'{BASE}/{parent.pk}')
        self.assertEqual(res.status_code, 409)
        child.refresh_from_db()
        self.assertEqual(child.parent_id, parent.pk)

    def test_delete_unknown_404(self):
        self.assertEqual(self.client.delete(f'{BASE}/999').json()['code'], 'CATEGORY_NOT_FOUND')


class GuardTests(TestCase):
    def calls(self):
        return [
            ('get', BASE), ('post', BASE), ('put', f'{BASE}/1'),
            ('patch', f'{BASE}/1/visibility'), ('delete', f'{BASE}/1'),
        ]

    def send(self, method, url):
        return getattr(self.client, method)(url, {}, content_type='application/json')

    def test_every_route_401_without_session(self):
        for method, url in self.calls():
            self.assertEqual(self.send(method, url).status_code, 401, url)

    def test_every_route_403_for_customer(self):
        user = User.objects.create(
            email='c@example.com', password_hash='x', first_name='A', last_name='B',
            date_of_birth=date(2000, 1, 1), phone_number='0800000000',
        )
        token, _ = create_session(user, Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        for method, url in self.calls():
            self.assertEqual(self.send(method, url).status_code, 403, url)

    def test_inactive_admin_403(self):
        token, _ = create_session(make_admin(is_active=False), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.client.get(BASE).status_code, 403)

    def test_unsupported_method_405(self):
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.client.patch(BASE, {}, content_type='application/json').status_code, 405)
