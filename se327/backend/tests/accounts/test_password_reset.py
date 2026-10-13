import time
from datetime import timedelta
from unittest import mock

from django.contrib.auth.hashers import check_password
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import PasswordResetToken, Session
from apps.accounts.password_reset import reset_expiry_minutes
from apps.accounts.sessions import create_session

from .test_signin import FAST_HASH, make_user

MAIL_ENV = {
    'SMTP_HOST': 'smtp.test',
    'SMTP_USER': 'user',
    'SMTP_PASS': 'pass',
    'WEBSTORE_BASE_URL': 'http://store.test',
}

NEW_PASSWORD = 'brandnew123'


@FAST_HASH
@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ResetBase(TestCase):
    def setUp(self):
        patcher = mock.patch.dict('os.environ', MAIL_ENV)
        patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, path, data):
        return self.client.post(path, data, content_type='application/json')

    def forgot(self, email='jane@example.com'):
        return self.post('/api/auth/forgot-password', {'email': email})

    def reset(self, token, new='brandnew123', confirm=None):
        return self.post('/api/auth/reset-password', {
            'token': token, 'new_password': new,
            'confirm_password': new if confirm is None else confirm,
        })

    def make_token(self, user=None, token='abc123', minutes=15, used=False):
        user = user or make_user()
        return PasswordResetToken.objects.create(
            user=user, token=token,
            expires_at=timezone.now() + timedelta(minutes=minutes),
            used_at=timezone.now() if used else None,
        )


class ForgotPasswordTests(ResetBase):
    def test_known_email_sends_link_and_stores_token(self):
        user = make_user()
        res = self.forgot()
        self.assertEqual(res.status_code, 200)
        record = PasswordResetToken.objects.get(user=user)
        self.assertIsNone(record.used_at)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['jane@example.com'])
        self.assertIn(f'/auth/reset-password?token={record.token}', mail.outbox[0].body)

    def test_expiry_default_and_env(self):
        self.assertEqual(reset_expiry_minutes(), 15)
        for value, expected in (('30', 30), ('0.5', 0.5), ('0', 15), ('-3', 15), ('abc', 15), ('nan', 15), ('inf', 15), ('-inf', 15)):
            with mock.patch.dict('os.environ', {'PASSWORD_RESET_EXPIRY_MINUTES': value}):
                self.assertEqual(reset_expiry_minutes(), expected)
        make_user()
        with mock.patch.dict('os.environ', {'PASSWORD_RESET_EXPIRY_MINUTES': '30'}):
            self.forgot()
        record = PasswordResetToken.objects.get()
        left = record.expires_at - timezone.now()
        self.assertGreater(left, timedelta(minutes=29))
        self.assertLessEqual(left, timedelta(minutes=30))

    def test_email_is_case_insensitive(self):
        make_user()
        self.forgot('JANE@example.com')
        self.assertEqual(PasswordResetToken.objects.count(), 1)

    def test_unknown_email_same_reply_no_mail(self):
        make_user()
        known = self.forgot()
        unknown = self.forgot('nobody@example.com')
        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(unknown.json(), known.json())
        self.assertEqual(PasswordResetToken.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_second_request_invalidates_first(self):
        make_user()
        self.forgot()
        first = PasswordResetToken.objects.get()
        self.forgot()
        first.refresh_from_db()
        self.assertIsNotNone(first.used_at)
        self.assertEqual(PasswordResetToken.objects.filter(used_at__isnull=True).count(), 1)
        res = self.reset(first.token)
        self.assertEqual(res.status_code, 409)

    def test_mail_failure_still_200(self):
        make_user()
        with mock.patch('apps.accounts.password_reset.send_password_reset_email', return_value=False):
            res = self.forgot()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.count(), 1)

    def test_missing_smtp_config_still_200(self):
        make_user()
        with mock.patch.dict('os.environ', {'SMTP_HOST': ''}):
            res = self.forgot()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_missing_and_bad_email(self):
        res = self.post('/api/auth/forgot-password', {})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')
        res = self.forgot('nope')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_EMAIL_FORMAT')

    def test_nul_and_overlong_email_400(self):
        for email in ('jane\x00@example.com', 'a' * 250 + '@example.com'):
            res = self.forgot(email)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_lone_surrogate_email_400_not_500(self):
        res = self.forgot('ja\ud800ne@example.com')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_huge_email_rejected_quickly(self):
        start = time.monotonic()
        res = self.forgot('a' * 40000 + '@example.com')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')
        self.assertLess(time.monotonic() - start, 1)

    def test_non_object_body_400(self):
        res = self.post('/api/auth/forgot-password', ['a'])
        self.assertEqual(res.status_code, 400)


class ResetPasswordTests(ResetBase):
    def test_reset_updates_hash_and_marks_used(self):
        record = self.make_token()
        res = self.reset('abc123')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'password_reset': True})
        record.refresh_from_db()
        self.assertIsNotNone(record.used_at)
        record.user.refresh_from_db()
        self.assertTrue(check_password(NEW_PASSWORD, record.user.password_hash))

    def test_old_password_stops_working(self):
        record = self.make_token()
        self.reset('abc123')
        res = self.post('/api/auth/user/signin', {'email': record.user.email, 'password': 'longenough1'})
        self.assertEqual(res.status_code, 401)
        res = self.post('/api/auth/user/signin', {'email': record.user.email, 'password': NEW_PASSWORD})
        self.assertEqual(res.status_code, 200)

    def test_short_password(self):
        record = self.make_token()
        res = self.reset('abc123', new='short')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'PASSWORD_TOO_SHORT')
        record.refresh_from_db()
        self.assertIsNone(record.used_at)

    def test_non_string_password_counts_as_short(self):
        self.make_token()
        res = self.reset('abc123', new=12345678)
        self.assertEqual(res.json()['code'], 'PASSWORD_TOO_SHORT')

    def test_confirmation_mismatch(self):
        record = self.make_token()
        res = self.reset('abc123', confirm='different123')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'PASSWORD_CONFIRMATION_MISMATCH')
        record.refresh_from_db()
        self.assertIsNone(record.used_at)

    def test_missing_fields_listed(self):
        res = self.post('/api/auth/reset-password', {'token': 'abc123'})
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body['code'], 'MISSING_REQUIRED_FIELDS')
        self.assertEqual(body['missingFields'], ['new_password', 'confirm_password'])

    def test_non_object_body_400(self):
        res = self.post('/api/auth/reset-password', ['a'])
        self.assertEqual(res.status_code, 400)

    def test_unknown_token_400(self):
        res = self.reset('doesnotexist')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_PASSWORD_RESET_TOKEN')

    def test_odd_tokens_400_not_500(self):
        for token in ('abc\x00def', 'tok٣en', 'a' * 300):
            res = self.reset(token)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_PASSWORD_RESET_TOKEN')

    def test_nul_and_overlong_password_400(self):
        self.make_token()
        for password in ('pass\x00word1', 'a' * 1001):
            res = self.reset('abc123', new=password)
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_lone_surrogate_password_400_not_500(self):
        self.make_token()
        res = self.reset('abc123', new='pass\ud800word1')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_reset_revokes_all_customer_sessions(self):
        record = self.make_token()
        other = make_user('other@example.com')
        mine, _ = create_session(record.user, 'USER')
        theirs, _ = create_session(other, 'USER')
        self.reset('abc123')
        self.assertIsNotNone(Session.objects.get(session_token=mine).revoked_at)
        self.assertIsNone(Session.objects.get(session_token=theirs).revoked_at)
        self.client.cookies['session'] = mine
        self.assertEqual(self.client.get('/api/auth/user/profile').status_code, 401)

    def test_used_token_409(self):
        self.make_token(used=True)
        res = self.reset('abc123')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'PASSWORD_RESET_TOKEN_ALREADY_USED')

    def test_expired_token_410(self):
        record = self.make_token(minutes=-1)
        res = self.reset('abc123')
        self.assertEqual(res.status_code, 410)
        self.assertEqual(res.json()['code'], 'PASSWORD_RESET_TOKEN_EXPIRED')
        record.user.refresh_from_db()
        self.assertTrue(check_password('longenough1', record.user.password_hash))

    def test_used_wins_over_expired(self):
        self.make_token(minutes=-1, used=True)
        res = self.reset('abc123')
        self.assertEqual(res.status_code, 409)

    def test_token_cannot_be_reused_after_success(self):
        self.make_token()
        self.assertEqual(self.reset('abc123').status_code, 200)
        res = self.reset('abc123', new='another1234')
        self.assertEqual(res.status_code, 409)

    def test_other_open_tokens_closed_after_success(self):
        record = self.make_token()
        other = self.make_token(user=record.user, token='second')
        self.reset('abc123')
        other.refresh_from_db()
        self.assertIsNotNone(other.used_at)

    def test_full_flow_from_mail_link(self):
        make_user()
        self.forgot()
        token = PasswordResetToken.objects.get().token
        res = self.reset(token)
        self.assertEqual(res.status_code, 200)
