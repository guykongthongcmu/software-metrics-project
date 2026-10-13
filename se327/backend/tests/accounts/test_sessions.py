from datetime import date, timedelta

from django.http import HttpResponse
from django.test import TestCase, override_settings
from django.urls import path
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Admin, Session, User
from apps.accounts.permissions import IsAdmin, IsCustomer
from apps.accounts.sessions import (
    COOKIE_NAME,
    create_session,
    find_valid_session,
    revoke,
    set_session_cookie,
)
from config.urls import urlpatterns as app_urlpatterns


class CustomerView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        return Response({'email': request.customer.email})


class AdminView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response({'email': request.admin.email})


urlpatterns = [
    path('customer-only', CustomerView.as_view()),
    path('admin-only', AdminView.as_view()),
] + app_urlpatterns


def make_user(email='buyer@example.com'):
    return User.objects.create(
        email=email, password_hash='x', first_name='A', last_name='B',
        date_of_birth=date(2000, 1, 1), phone_number='0800000000',
    )


def make_admin(email='boss@example.com', is_active=True):
    return Admin.objects.create(
        email=email, password_hash='x', display_name='Boss', is_active=is_active
    )


@override_settings(ROOT_URLCONF='tests.accounts.test_sessions')
class SessionTestCase(TestCase):
    def login(self, token):
        self.client.cookies[COOKIE_NAME] = token


class CreateSessionTests(SessionTestCase):
    def test_creates_row_with_future_expiry(self):
        user = make_user()
        token, expires = create_session(user, Session.SubjectType.USER)
        row = Session.objects.get(session_token=token)
        self.assertEqual(row.user, user)
        self.assertIsNone(row.admin)
        self.assertEqual(row.subject_type, 'USER')
        self.assertEqual(row.expires_at, expires)
        self.assertGreater(expires, timezone.now())
        self.assertGreaterEqual(len(token), 32)

    def test_admin_session_has_admin_owner(self):
        admin = make_admin()
        token, _ = create_session(admin, Session.SubjectType.ADMIN)
        row = Session.objects.get(session_token=token)
        self.assertEqual(row.admin, admin)
        self.assertIsNone(row.user)

    def test_tokens_are_unique(self):
        user = make_user()
        a, _ = create_session(user, Session.SubjectType.USER)
        b, _ = create_session(user, Session.SubjectType.USER)
        self.assertNotEqual(a, b)


class CookieTests(SessionTestCase):
    def test_cookie_is_http_only_lax_with_expiry(self):
        response = HttpResponse()
        set_session_cookie(response, 'abc', timezone.now() + timedelta(hours=1))
        cookie = response.cookies[COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Lax')
        self.assertEqual(cookie['path'], '/')
        self.assertTrue(cookie['expires'])

    @override_settings(DEBUG=False)
    def test_cookie_secure_outside_debug(self):
        response = HttpResponse()
        set_session_cookie(response, 'abc', timezone.now() + timedelta(hours=1))
        self.assertTrue(response.cookies[COOKIE_NAME]['secure'])

    @override_settings(DEBUG=True)
    def test_cookie_not_secure_in_debug(self):
        response = HttpResponse()
        set_session_cookie(response, 'abc', timezone.now() + timedelta(hours=1))
        self.assertFalse(response.cookies[COOKIE_NAME]['secure'])


class FindValidSessionTests(SessionTestCase):
    def test_valid_session_found(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.assertEqual(find_valid_session(token).session_token, token)

    def test_missing_token_returns_none(self):
        self.assertIsNone(find_valid_session(''))
        self.assertIsNone(find_valid_session(None))
        self.assertIsNone(find_valid_session('does-not-exist'))

    def test_expired_returns_none(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        Session.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertIsNone(find_valid_session(token))

    def test_revoked_returns_none(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        revoke(Session.objects.get(session_token=token))
        self.assertIsNone(find_valid_session(token))

    def test_revoke_twice_keeps_first_timestamp(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        session = Session.objects.get(session_token=token)
        revoke(session)
        first = session.revoked_at
        revoke(session)
        self.assertEqual(Session.objects.get(session_token=token).revoked_at, first)


class GuardTests(SessionTestCase):
    def assert_error(self, res, status, code):
        self.assertEqual(res.status_code, status)
        body = res.json()
        self.assertEqual(body['status'], 'error')
        self.assertEqual(body['code'], code)

    def test_no_cookie_is_401_on_both_guards(self):
        self.assert_error(self.client.get('/customer-only'), 401, 'UNAUTHORIZED')
        self.assert_error(self.client.get('/admin-only'), 401, 'UNAUTHORIZED')

    def test_unknown_token_is_401(self):
        self.login('nope')
        self.assert_error(self.client.get('/customer-only'), 401, 'UNAUTHORIZED')

    def test_expired_session_is_401(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        Session.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
        self.login(token)
        self.assert_error(self.client.get('/customer-only'), 401, 'UNAUTHORIZED')

    def test_revoked_session_is_401(self):
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        Session.objects.update(revoked_at=timezone.now())
        self.login(token)
        self.assert_error(self.client.get('/admin-only'), 401, 'UNAUTHORIZED')

    def test_customer_session_reaches_customer_route(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.login(token)
        res = self.client.get('/customer-only')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['email'], 'buyer@example.com')

    def test_admin_session_reaches_admin_route(self):
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.login(token)
        res = self.client.get('/admin-only')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['email'], 'boss@example.com')

    def test_admin_session_on_customer_route_is_403(self):
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.login(token)
        self.assert_error(self.client.get('/customer-only'), 403, 'FORBIDDEN')

    def test_customer_session_on_admin_route_is_403(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.login(token)
        self.assert_error(self.client.get('/admin-only'), 403, 'FORBIDDEN')

    def test_inactive_admin_is_403(self):
        token, _ = create_session(make_admin(is_active=False), Session.SubjectType.ADMIN)
        self.login(token)
        self.assert_error(self.client.get('/admin-only'), 403, 'FORBIDDEN')


class LogoutTests(SessionTestCase):
    def test_logout_revokes_session_and_clears_cookie(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.login(token)
        res = self.client.post('/api/auth/logout')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'success')
        self.assertIsNotNone(Session.objects.get(session_token=token).revoked_at)
        cookie = res.cookies[COOKIE_NAME]
        self.assertEqual(cookie.value, '')
        self.assertEqual(cookie['path'], '/')
        self.assertEqual(cookie['max-age'], 0)

    def test_revoked_token_no_longer_works(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.login(token)
        self.client.post('/api/auth/logout')
        self.login(token)
        self.assertEqual(self.client.get('/customer-only').status_code, 401)

    def test_admin_can_log_out(self):
        token, _ = create_session(make_admin(), Session.SubjectType.ADMIN)
        self.login(token)
        self.assertEqual(self.client.post('/api/auth/logout').status_code, 200)

    def test_logout_without_session_is_401(self):
        res = self.client.post('/api/auth/logout')
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()['code'], 'UNAUTHORIZED')

    def test_logout_twice_is_401(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.login(token)
        self.client.post('/api/auth/logout')
        self.login(token)
        self.assertEqual(self.client.post('/api/auth/logout').status_code, 401)
