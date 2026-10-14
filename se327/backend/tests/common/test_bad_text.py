from datetime import date
from unittest import mock

from django.test import TestCase

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session


def make_user():
    return User.objects.create(
        email='buyer@example.com', password_hash='x', first_name='Buy', last_name='Er',
        date_of_birth=date(2000, 1, 1), phone_number='0812345678',
    )


def make_admin():
    return Admin.objects.create(email='boss@example.com', password_hash='x', display_name='Boss')


class BadTextTests(TestCase):
    def login(self, account, kind):
        token, _ = create_session(account, kind)
        self.client.cookies[COOKIE_NAME] = token

    def assert_query_rejected(self, url):
        res = self.client.get(url)
        self.assertEqual(res.status_code, 400, url)
        self.assertEqual(res.json()['code'], 'INVALID_QUERY', url)

    def test_public_query_and_path_with_nul(self):
        for url in (
            '/api/client/products/search?q=a%00b',
            '/api/client/products/search/suggestions?q=a%00',
            '/api/client/products/recommendations?category=a%00',
            '/api/client/products/category/men%00x',
            '/api/auth/verify-email?token=a%00b',
        ):
            self.assert_query_rejected(url)

    def test_admin_query_with_nul(self):
        self.login(make_admin(), Session.SubjectType.ADMIN)
        self.assert_query_rejected('/api/admin/orders?search=%00')
        self.assert_query_rejected('/api/admin/products?search=a%00b')

    def test_nul_in_query_key(self):
        self.assert_query_rejected('/api/client/products/search?q%00=a')

    def test_json_body_with_nul(self):
        res = self.client.post('/api/auth/check-email', {'email': 'a\x00@b.co'}, content_type='application/json')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_FIELD_LENGTH'))

    def test_json_body_in_nested_value(self):
        self.login(make_user(), Session.SubjectType.USER)
        res = self.client.post(
            '/api/client/cart/items', {'productId': 1, 'color': 'a\x00', 'size': 'M', 'quantityCartItem': 1},
            content_type='application/json',
        )
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_FIELD_LENGTH'))
        res = self.client.post(
            '/api/auth/forgot-password', '{"email": ["x", {"k": "a\\u0000"}]}', content_type='application/json',
        )
        self.assertEqual(res.status_code, 400)

    def test_signup_lone_surrogate(self):
        body = (
            '{"email": "a@b.co", "password": "longenough1", "first_name": "a\\ud800", "last_name": "b", '
            '"DOB": "2000-01-01", "phone_number": "0812345678"}'
        )
        res = self.client.post('/api/auth/signup', body, content_type='application/json')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_FIELD_LENGTH'))
        self.assertFalse(User.objects.exists())

    def test_valid_unicode_is_not_rejected(self):
        # an emoji is a surrogate pair in a JSON escape, which is fine
        res = self.client.post(
            '/api/auth/check-email', '{"email": "caf\\u00e9\\ud83d\\ude00@b.co"}', content_type='application/json',
        )
        self.assertLess(res.status_code, 500)
        self.assertEqual(self.client.get('/api/client/products/search?q=%E0%B9%80%E0%B8%AA%E0%B8%B7%E0%B9%89%E0%B8%AD').status_code, 200)

    def test_unparsable_body_is_left_to_the_view(self):
        res = self.client.post('/api/auth/check-email', '{not json', content_type='application/json')
        self.assertEqual(res.status_code, 400)
        self.assertNotEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_too_many_query_parameters_is_json_400(self):
        res = self.client.get('/api/client/products/search?' + '&'.join(f'a{i}=1' for i in range(1001)))
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_QUERY'))

    def test_deeply_nested_body_is_400_not_500(self):
        res = self.client.post('/api/auth/check-email', '[' * 400000, content_type='application/json')
        self.assertEqual((res.status_code, res.json()['code']), (400, 'INVALID_JSON'))

    def test_only_json_content_types_are_parsed(self):
        body = '{"email": "a\\u0000@b.co"}'
        res = self.client.post('/api/auth/check-email', body, content_type='text/plain')
        self.assertNotEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')
        res = self.client.post('/api/auth/check-email', body, content_type='application/vnd.api+json')
        self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')
        res = self.client.post('/api/auth/check-email', body, content_type='application/json; charset=utf-8')
        self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_oversize_body_is_not_parsed_by_the_middleware(self):
        with mock.patch('common.middleware.json.loads') as loads:
            self.client.post('/api/auth/check-email', '{"a": "' + 'x' * (3 * 1024 * 1024) + '"}', content_type='application/json')
        loads.assert_not_called()
