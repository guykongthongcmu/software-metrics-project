from datetime import date

from django.contrib.auth.hashers import make_password
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session

FAST_HASH = override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])


def make_user(email='jane@example.com', password='longenough1', verified=True):
    return User.objects.create(
        email=email, password_hash=make_password(password), first_name='Jane', last_name='Doe',
        date_of_birth=date(2000, 1, 31), phone_number='0812345678',
        email_verified_at=timezone.now() if verified else None,
    )


@FAST_HASH
class SigninTests(TestCase):
    def post(self, data):
        return self.client.post('/api/auth/user/signin', data, content_type='application/json')

    def test_valid_signin_sets_cookie_and_session_row(self):
        user = make_user()
        res = self.post({'email': 'jane@example.com', 'password': 'longenough1'})
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['role'], 'user')
        self.assertEqual(data['user_id'], user.user_id)
        self.assertEqual(data['name'], 'Jane Doe')
        self.assertEqual(data['phone_number'], '0812345678')
        self.assertIs(data['email_verified'], True)
        self.assertEqual(data['redirectTo'], '/')
        self.assertIn('expiresAt', data['session'])
        cookie = res.cookies[COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        session = Session.objects.get(session_token=cookie.value)
        self.assertEqual(session.subject_type, 'USER')
        self.assertEqual(session.user_id, user.user_id)

    def test_email_is_case_insensitive(self):
        make_user()
        res = self.post({'email': ' JANE@Example.com ', 'password': 'longenough1'})
        self.assertEqual(res.status_code, 200)

    def test_wrong_password_401(self):
        make_user()
        res = self.post({'email': 'jane@example.com', 'password': 'wrongpass1'})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'INVALID_CREDENTIALS')
        self.assertEqual(Session.objects.count(), 0)
        self.assertNotIn(COOKIE_NAME, res.cookies)

    def test_unknown_email_same_error(self):
        make_user()
        wrong = self.post({'email': 'jane@example.com', 'password': 'wrongpass1'})
        unknown = self.post({'email': 'nobody@example.com', 'password': 'wrongpass1'})
        self.assertEqual(unknown.status_code, 401)
        self.assertEqual(unknown.json(), wrong.json())

    def test_missing_fields_400(self):
        for body in ({}, {'email': 'jane@example.com'}, {'password': 'x'},
                     {'email': 'jane@example.com', 'password': ''},
                     {'email': 'jane@example.com', 'password': 12345678}):
            res = self.post(body)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')

    def test_bad_email_format_400(self):
        res = self.post({'email': 'nope', 'password': 'longenough1'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_EMAIL_FORMAT')

    def test_non_object_body_400(self):
        res = self.post(['a'])
        self.assertEqual(res.status_code, 400)

    def test_nul_and_overlong_fields_400(self):
        long_email = 'a' * 250 + '@example.com'
        for body in ({'email': 'jane\x00@example.com', 'password': 'longenough1'},
                     {'email': 'jane@example.com', 'password': 'pass\x00word1'},
                     {'email': long_email, 'password': 'longenough1'},
                     {'email': 'jane@example.com', 'password': 'a' * 1001}):
            res = self.post(body)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_unverified_user_can_sign_in(self):
        make_user(verified=False)
        res = self.post({'email': 'jane@example.com', 'password': 'longenough1'})
        self.assertEqual(res.status_code, 200)
        self.assertIs(res.json()['data']['email_verified'], False)

    def test_admin_credentials_rejected_on_customer_route(self):
        Admin.objects.create(email='boss@example.com', password_hash=make_password('adminpass1'),
                             display_name='Boss')
        res = self.post({'email': 'boss@example.com', 'password': 'adminpass1'})
        self.assertEqual(res.status_code, 401)

    def test_get_not_allowed(self):
        res = self.client.get('/api/auth/user/signin')
        self.assertEqual(res.status_code, 405)

    def test_cookie_works_on_profile(self):
        make_user()
        self.post({'email': 'jane@example.com', 'password': 'longenough1'})
        res = self.client.get('/api/auth/user/profile')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['email'], 'jane@example.com')


@FAST_HASH
class ProfileTests(TestCase):
    def login(self, subject, kind):
        token, _ = create_session(subject, kind)
        self.client.cookies[COOKIE_NAME] = token

    def test_profile_fields(self):
        user = make_user()
        self.login(user, 'USER')
        res = self.client.get('/api/auth/user/profile')
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['user_id'], user.user_id)
        self.assertEqual(data['email'], 'jane@example.com')
        self.assertEqual(data['name'], 'Jane Doe')
        self.assertEqual(data['phone_number'], '0812345678')
        self.assertEqual(data['date_of_birth'], '2000-01-31')
        self.assertEqual(data['created_at'], user.created_at.isoformat())
        self.assertIs(data['email_verified'], True)

    def test_profile_verified_flag(self):
        self.login(make_user(verified=False), 'USER')
        res = self.client.get('/api/auth/user/profile')
        self.assertIs(res.json()['data']['email_verified'], False)

    def test_profile_name_without_last_name(self):
        user = make_user()
        user.last_name = ''
        user.save()
        self.login(user, 'USER')
        res = self.client.get('/api/auth/user/profile')
        self.assertEqual(res.json()['data']['name'], 'Jane')

    def test_profile_no_session_401(self):
        res = self.client.get('/api/auth/user/profile')
        self.assertEqual(res.status_code, 401)

    def test_profile_admin_session_403(self):
        admin = Admin.objects.create(email='boss@example.com', password_hash='x', display_name='Boss')
        self.login(admin, 'ADMIN')
        res = self.client.get('/api/auth/user/profile')
        self.assertEqual(res.status_code, 403)
