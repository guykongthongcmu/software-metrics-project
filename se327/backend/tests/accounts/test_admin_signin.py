from django.contrib.auth.hashers import make_password
from django.test import TestCase, override_settings

from apps.accounts.models import Admin, Session
from apps.accounts.sessions import COOKIE_NAME

from .test_signin import FAST_HASH, make_user


def make_admin(email='boss@example.com', password='adminpass1', active=True):
    return Admin.objects.create(
        email=email, password_hash=make_password(password), display_name='Boss', is_active=active,
    )


@FAST_HASH
class AdminSigninTests(TestCase):
    def post(self, data):
        return self.client.post('/api/auth/admin/signin', data, content_type='application/json')

    def test_valid_signin_creates_admin_session_and_cookie(self):
        admin = make_admin()
        res = self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        self.assertEqual(res.status_code, 200)
        cookie = res.cookies[COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        session = Session.objects.get(session_token=cookie.value)
        self.assertEqual(session.subject_type, 'ADMIN')
        self.assertEqual(session.admin_id, admin.admin_id)
        self.assertIsNone(session.user_id)

    def test_response_shape_and_redirect(self):
        admin = make_admin()
        data = self.post({'email': 'Boss@Example.com', 'password': 'adminpass1'}).json()['data']
        self.assertEqual(data['role'], 'admin')
        self.assertEqual(data['admin_id'], admin.admin_id)
        self.assertEqual(data['email'], 'boss@example.com')
        self.assertEqual(data['name'], 'Boss')
        self.assertEqual(data['redirectTo'], '/dashboard')
        self.assertIn('expiresAt', data['session'])

    # test_sessions has a throwaway admin-only route next to the real ones
    @override_settings(ROOT_URLCONF='tests.accounts.test_sessions')
    def test_cookie_opens_admin_guard(self):
        make_admin()
        self.assertEqual(self.client.get('/admin-only').status_code, 401)
        self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        res = self.client.get('/admin-only')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['email'], 'boss@example.com')

    def test_each_signin_adds_a_session(self):
        make_admin()
        self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        self.assertEqual(Session.objects.filter(subject_type='ADMIN', revoked_at__isnull=True).count(), 2)

    def test_wrong_password(self):
        make_admin()
        res = self.post({'email': 'boss@example.com', 'password': 'wrongpass1'})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'INVALID_CREDENTIALS')
        self.assertEqual(Session.objects.count(), 0)

    def test_unknown_email(self):
        res = self.post({'email': 'nobody@example.com', 'password': 'adminpass1'})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'INVALID_CREDENTIALS')

    def test_customer_credentials_rejected_on_admin_route(self):
        make_user()
        res = self.post({'email': 'jane@example.com', 'password': 'longenough1'})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'INVALID_CREDENTIALS')

    def test_inactive_admin_403_no_session_created(self):
        make_admin(active=False)
        res = self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()['code'], 'ACCOUNT_INACTIVE')
        self.assertEqual(Session.objects.count(), 0)
        self.assertNotIn(COOKIE_NAME, res.cookies)

    def test_inactive_with_wrong_password_is_invalid_credentials(self):
        make_admin(active=False)
        res = self.post({'email': 'boss@example.com', 'password': 'wrongpass1'})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'INVALID_CREDENTIALS')

    def test_logout_revokes_admin_session_and_guard_then_401(self):
        make_admin()
        self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        token = self.client.cookies[COOKIE_NAME].value
        res = self.client.post('/api/auth/logout')
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(Session.objects.get(session_token=token).revoked_at)
        # the old cookie no longer works
        self.client.cookies[COOKIE_NAME] = token
        res = self.client.post('/api/auth/logout')
        self.assertEqual(res.status_code, 401)

    def test_missing_fields(self):
        for body in ({}, {'email': 'boss@example.com'}, {'password': 'adminpass1'}):
            res = self.post(body)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')

    def test_bad_email_format(self):
        res = self.post({'email': 'nope', 'password': 'adminpass1'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_EMAIL_FORMAT')

    def test_nul_and_overlong_fields_400(self):
        for body in ({'email': 'boss\x00@example.com', 'password': 'adminpass1'},
                     {'email': 'boss@example.com', 'password': 'a' * 1001}):
            res = self.post(body)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_lone_surrogate_400_not_500(self):
        for body in ({'email': 'bo\ud800ss@example.com', 'password': 'adminpass1'},
                     {'email': 'boss@example.com', 'password': 'admin\ud800pass1'}):
            res = self.post(body)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_non_object_body_400(self):
        self.assertEqual(self.post(['a']).status_code, 400)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get('/api/auth/admin/signin').status_code, 405)
