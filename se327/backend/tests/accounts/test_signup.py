import time
from datetime import timedelta
from unittest import mock

from django.contrib.auth.hashers import check_password
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import EmailVerificationToken, User

MAIL_ENV = {
    'SMTP_HOST': 'smtp.test',
    'SMTP_USER': 'user',
    'SMTP_PASS': 'pass',
    'WEBSTORE_BASE_URL': 'http://store.test',
}

VALID = {
    'email': 'Jane@Example.com',
    'password': 'longenough1',
    'first_name': 'Jane',
    'last_name': 'Doe',
    'DOB': '2000-01-31',
    'phone_number': '0812345678',
}


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class SignupBase(TestCase):
    def setUp(self):
        patcher = mock.patch.dict('os.environ', MAIL_ENV)
        patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, path, data):
        return self.client.post(path, data, content_type='application/json')

    def signup(self, **changes):
        return self.post('/api/auth/signup', {**VALID, **changes})

    def make_token(self, verified=False, used=False, minutes=5):
        user = User.objects.create(
            email='tok@example.com', password_hash='x', first_name='T', last_name='U',
            date_of_birth='2000-01-01', phone_number='1',
            email_verified_at=timezone.now() if verified else None,
        )
        return EmailVerificationToken.objects.create(
            user=user, token='abc123',
            expires_at=timezone.now() + timedelta(minutes=minutes),
            used_at=timezone.now() if used else None,
        )


class CheckEmailTests(SignupBase):
    def test_free_email(self):
        res = self.post('/api/auth/check-email', {'email': ' New@Example.com '})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'email': 'new@example.com'})

    def test_missing_email(self):
        res = self.post('/api/auth/check-email', {})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')

    def test_bad_format(self):
        res = self.post('/api/auth/check-email', {'email': 'nope'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_EMAIL_FORMAT')

    def test_taken_email_ignores_case(self):
        self.signup()
        res = self.post('/api/auth/check-email', {'email': 'JANE@example.COM'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'EMAIL_ALREADY_EXISTS')

    def test_non_object_body(self):
        res = self.post('/api/auth/check-email', ['a'])
        self.assertEqual(res.status_code, 400)


class SignupTests(SignupBase):
    def test_creates_unverified_user_with_hashed_password(self):
        res = self.signup()
        self.assertEqual(res.status_code, 201)
        data = res.json()['data']
        self.assertEqual(data['email'], 'jane@example.com')
        self.assertEqual(data['DOB'], '2000-01-31')
        self.assertFalse(data['email_verified'])
        self.assertTrue(data['verification_email_sent'])

        user = User.objects.get(email='jane@example.com')
        self.assertIsNone(user.email_verified_at)
        self.assertNotEqual(user.password_hash, VALID['password'])
        self.assertTrue(check_password(VALID['password'], user.password_hash))

    def test_creates_token_with_default_expiry(self):
        self.signup()
        token = EmailVerificationToken.objects.get()
        left = token.expires_at - timezone.now()
        self.assertTrue(timedelta(minutes=4) < left <= timedelta(minutes=5))
        self.assertIsNone(token.used_at)

    def test_expiry_comes_from_env(self):
        with mock.patch.dict('os.environ', {'EMAIL_VERIFICATION_EXPIRY_MINUTES': '30'}):
            self.signup()
        left = EmailVerificationToken.objects.get().expires_at - timezone.now()
        self.assertTrue(timedelta(minutes=29) < left <= timedelta(minutes=30))

    def test_bad_expiry_env_falls_back_to_default(self):
        for value in ('abc', '0', '-3'):
            with self.subTest(value=value), mock.patch.dict('os.environ', {'EMAIL_VERIFICATION_EXPIRY_MINUTES': value}):
                EmailVerificationToken.objects.all().delete()
                User.objects.all().delete()
                self.signup()
                left = EmailVerificationToken.objects.get().expires_at - timezone.now()
                self.assertTrue(left <= timedelta(minutes=5))

    def test_sends_email_with_legacy_link(self):
        self.signup()
        token = EmailVerificationToken.objects.get().token
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['jane@example.com'])
        self.assertIn(f'http://store.test/api/auth/verify-email?token={token}', mail.outbox[0].body)

    def test_send_failure_does_not_break_signup(self):
        with mock.patch('common.mail.EmailMultiAlternatives.send', side_effect=OSError('smtp down')):
            res = self.signup()
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.json()['data']['verification_email_sent'])
        self.assertTrue(User.objects.filter(email='jane@example.com').exists())
        self.assertEqual(EmailVerificationToken.objects.count(), 1)

    def test_missing_config_does_not_break_signup(self):
        with mock.patch.dict('os.environ', {'WEBSTORE_BASE_URL': ''}):
            res = self.signup()
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.json()['data']['verification_email_sent'])

    def test_missing_fields_are_listed(self):
        res = self.post('/api/auth/signup', {'email': 'a@b.co', 'password': 'longenough1'})
        body = res.json()
        self.assertEqual(res.status_code, 400)
        self.assertEqual(body['code'], 'MISSING_REQUIRED_FIELDS')
        self.assertEqual(body['missingFields'], ['first_name', 'last_name', 'DOB', 'phone_number'])

    def test_blank_field_counts_as_missing(self):
        res = self.signup(first_name='   ')
        self.assertEqual(res.json()['missingFields'], ['first_name'])

    def test_invalid_email(self):
        res = self.signup(email='not-an-email')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_EMAIL_FORMAT')

    def test_over_long_fields_are_a_400(self):
        for field, value in (('first_name', 'a' * 101), ('phone_number', '1' * 31), ('last_name', 'bad\x00name')):
            with self.subTest(field=field):
                res = self.signup(**{field: value})
                self.assertEqual(res.status_code, 400)
                self.assertEqual(res.json()['code'], 'INVALID_FIELD_LENGTH')

    def test_over_long_email_is_a_400(self):
        res = self.signup(email='a' * 250 + '@x.com')
        self.assertEqual(res.status_code, 400)

    def test_huge_malformed_email_is_rejected_quickly(self):
        start = time.monotonic()
        for email in ('a@' + '.' * 40000, 'a@' + 'b.' * 20000 + '@', '@' * 40000):
            res = self.signup(email=email)
            self.assertEqual(res.status_code, 400)
        self.assertLess(time.monotonic() - start, 1)

    def test_password_too_short(self):
        res = self.signup(password='short12')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'PASSWORD_TOO_SHORT')

    def test_password_of_exactly_min_length_is_fine(self):
        self.assertEqual(self.signup(password='12345678').status_code, 201)

    def test_non_string_password(self):
        res = self.signup(password=12345678)
        self.assertEqual(res.json()['code'], 'PASSWORD_TOO_SHORT')

    def test_invalid_dob(self):
        for value in ('31/01/2000', '2000-02-30'):
            with self.subTest(value=value):
                res = self.signup(DOB=value)
                self.assertEqual(res.status_code, 400)
                self.assertEqual(res.json()['code'], 'INVALID_DOB')
        self.assertEqual(User.objects.count(), 0)

    def test_duplicate_email_is_case_insensitive(self):
        self.assertEqual(self.signup().status_code, 201)
        res = self.signup(email='JANE@EXAMPLE.COM')
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'EMAIL_ALREADY_EXISTS')
        self.assertEqual(User.objects.count(), 1)

    def test_unique_violation_race_gives_409(self):
        with mock.patch('apps.accounts.signup.email_taken', return_value=False):
            self.signup()
            res = self.signup()
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'EMAIL_ALREADY_EXISTS')

    def test_non_object_body(self):
        res = self.post('/api/auth/signup', [1])
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')


class VerifyEmailTests(SignupBase):
    def test_valid_token_verifies_user(self):
        record = self.make_token()
        res = self.client.get('/api/auth/verify-email', {'token': 'abc123'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {
            'user_id': record.user.user_id, 'email': 'tok@example.com', 'email_verified': True,
        })
        record.refresh_from_db()
        record.user.refresh_from_db()
        self.assertIsNotNone(record.used_at)
        self.assertIsNotNone(record.user.email_verified_at)

    def test_link_from_signup_email_works(self):
        self.signup()
        token = EmailVerificationToken.objects.get().token
        res = self.client.get('/api/auth/verify-email', {'token': token})
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(User.objects.get().email_verified_at)

    def test_second_use_is_rejected(self):
        self.make_token()
        self.client.get('/api/auth/verify-email', {'token': 'abc123'})
        res = self.client.get('/api/auth/verify-email', {'token': 'abc123'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'VERIFICATION_TOKEN_ALREADY_USED')

    def test_missing_token(self):
        res = self.client.get('/api/auth/verify-email')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')

    def test_unknown_token(self):
        res = self.client.get('/api/auth/verify-email', {'token': 'nope'})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_VERIFICATION_TOKEN')

    def test_expired_token_leaves_user_unverified(self):
        record = self.make_token(minutes=-1)
        res = self.client.get('/api/auth/verify-email', {'token': 'abc123'})
        self.assertEqual(res.status_code, 410)
        self.assertEqual(res.json()['code'], 'VERIFICATION_TOKEN_EXPIRED')
        record.user.refresh_from_db()
        self.assertIsNone(record.user.email_verified_at)

    def test_already_verified_user(self):
        self.make_token(verified=True)
        res = self.client.get('/api/auth/verify-email', {'token': 'abc123'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'EMAIL_ALREADY_VERIFIED')

    def test_used_check_comes_before_expiry(self):
        record = self.make_token(used=True, minutes=-1)
        res = self.client.get('/api/auth/verify-email', {'token': record.token})
        self.assertEqual(res.json()['code'], 'VERIFICATION_TOKEN_ALREADY_USED')

    def test_html_by_format_param(self):
        self.make_token()
        res = self.client.get('/api/auth/verify-email', {'token': 'abc123', 'format': 'html'})
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/html', res['Content-Type'])
        self.assertIn('Email verified', res.content.decode())
        self.assertIn('http://store.test', res.content.decode())

    def test_html_by_accept_header(self):
        res = self.client.get('/api/auth/verify-email', {'token': 'nope'}, HTTP_ACCEPT='text/html')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Invalid verification link', res.content.decode())

    def test_format_json_beats_accept_header(self):
        res = self.client.get(
            '/api/auth/verify-email', {'token': 'nope', 'format': 'json'}, HTTP_ACCEPT='text/html',
        )
        self.assertEqual(res.json()['code'], 'INVALID_VERIFICATION_TOKEN')

    def test_html_error_pages_keep_status(self):
        cases = [
            (dict(used=True), 409, 'Link already used'),
            (dict(minutes=-1), 410, 'Verification link expired'),
            (dict(verified=True), 409, 'Email already verified'),
        ]
        for kwargs, status, title in cases:
            with self.subTest(title=title):
                User.objects.all().delete()
                self.make_token(**kwargs)
                res = self.client.get('/api/auth/verify-email', {'token': 'abc123', 'format': 'html'})
                self.assertEqual(res.status_code, status)
                self.assertIn(title, res.content.decode())

    def test_html_missing_token(self):
        res = self.client.get('/api/auth/verify-email', {'format': 'html'})
        self.assertEqual(res.status_code, 400)
        self.assertIn('Verification link missing', res.content.decode())

    def test_html_page_without_store_url_has_no_button(self):
        with mock.patch.dict('os.environ', {'WEBSTORE_BASE_URL': ''}):
            res = self.client.get('/api/auth/verify-email', {'token': 'x', 'format': 'html'})
        self.assertNotIn('Back to store', res.content.decode())


class ResendVerificationTests(SignupBase):
    def test_new_token_replaces_old_ones(self):
        self.signup()
        old = EmailVerificationToken.objects.get()
        mail.outbox.clear()
        res = self.post('/api/auth/resend-verification', {'email': 'JANE@example.com'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'email': 'jane@example.com', 'verification_email_sent': True})
        old.refresh_from_db()
        self.assertIsNotNone(old.used_at)
        fresh = EmailVerificationToken.objects.get(used_at__isnull=True)
        self.assertNotEqual(fresh.token, old.token)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(fresh.token, mail.outbox[0].body)

    def test_old_link_stops_working(self):
        self.signup()
        old = EmailVerificationToken.objects.get().token
        self.post('/api/auth/resend-verification', {'email': 'jane@example.com'})
        res = self.client.get('/api/auth/verify-email', {'token': old})
        self.assertEqual(res.json()['code'], 'VERIFICATION_TOKEN_ALREADY_USED')

    def test_send_failure_still_returns_200(self):
        self.signup()
        with mock.patch('common.mail.EmailMultiAlternatives.send', side_effect=OSError('down')):
            res = self.post('/api/auth/resend-verification', {'email': 'jane@example.com'})
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()['data']['verification_email_sent'])

    def test_missing_email(self):
        res = self.post('/api/auth/resend-verification', {})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'MISSING_REQUIRED_FIELDS')

    def test_bad_format(self):
        res = self.post('/api/auth/resend-verification', {'email': 'x'})
        self.assertEqual(res.json()['code'], 'INVALID_EMAIL_FORMAT')

    def test_unknown_user(self):
        res = self.post('/api/auth/resend-verification', {'email': 'ghost@example.com'})
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'USER_NOT_FOUND')

    def test_already_verified(self):
        self.make_token(verified=True)
        res = self.post('/api/auth/resend-verification', {'email': 'tok@example.com'})
        self.assertEqual(res.status_code, 409)
        self.assertEqual(res.json()['code'], 'EMAIL_ALREADY_VERIFIED')
