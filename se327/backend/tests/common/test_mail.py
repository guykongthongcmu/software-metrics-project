import os
from unittest import mock

from django.core import mail
from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase, override_settings

from common import mail as mailer

ENV = {
    'SMTP_HOST': 'smtp.example.com',
    'SMTP_USER': 'shop@example.com',
    'SMTP_PASS': 'secret',
    'WEBSTORE_BASE_URL': 'https://shop.example.com/',
}


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='Core&Co <shop@example.com>',
)
class MailTestCase(SimpleTestCase):
    def setUp(self):
        patcher = mock.patch.dict(os.environ, ENV)
        patcher.start()
        self.addCleanup(patcher.stop)
        mail.outbox = []

    def html_of(self, message):
        return message.alternatives[0][0]


class ConfigTests(MailTestCase):
    def test_all_present_passes(self):
        mailer.check_mail_config()

    def test_missing_settings_are_named(self):
        with mock.patch.dict(os.environ, {'SMTP_PASS': '', 'WEBSTORE_BASE_URL': ' '}):
            with self.assertRaises(mailer.MailConfigError) as ctx:
                mailer.check_mail_config()
        self.assertIn('SMTP_PASS', str(ctx.exception))
        self.assertIn('WEBSTORE_BASE_URL', str(ctx.exception))
        self.assertNotIn('SMTP_HOST', str(ctx.exception))

    def test_missing_config_is_logged_and_nothing_is_sent(self):
        with mock.patch.dict(os.environ, {'SMTP_HOST': ''}):
            with self.assertLogs('common.mail', level='ERROR') as logs:
                sent = mailer.send_verification_email('a@example.com', 'tok')
        self.assertFalse(sent)
        self.assertEqual(len(mail.outbox), 0)
        self.assertIn('SMTP_HOST', '\n'.join(logs.output))


class VerificationEmailTests(MailTestCase):
    def test_sends_html_with_text_fallback_and_absolute_link(self):
        sent = mailer.send_verification_email('a@example.com', 'abc123', first_name='Mali')
        self.assertTrue(sent)
        message = mail.outbox[0]
        self.assertEqual(message.to, ['a@example.com'])
        self.assertEqual(message.from_email, 'Core&Co <shop@example.com>')
        self.assertEqual(message.subject, 'Verify your Core&Co account')
        link = 'https://shop.example.com/api/auth/verify-email?token=abc123'
        self.assertIn(link, message.body)
        self.assertIn(link, self.html_of(message))
        self.assertIn('Hi Mali,', message.body)
        self.assertEqual(message.alternatives[0][1], 'text/html')

    def test_token_is_url_encoded(self):
        mailer.send_verification_email('a@example.com', 'a b&c')
        self.assertIn('token=a%20b%26c', mail.outbox[0].body)

    def test_name_is_escaped_in_html(self):
        mailer.send_verification_email('a@example.com', 'tok', first_name='<b>x</b>')
        html = self.html_of(mail.outbox[0])
        self.assertNotIn('<b>x</b>', html)
        self.assertIn('&lt;b&gt;x&lt;/b&gt;', html)

    def test_one_minute_is_singular(self):
        mailer.send_verification_email('a@example.com', 'tok', expires_in_minutes=1)
        self.assertIn('within 1 minute.', mail.outbox[0].body)

    def test_missing_name_uses_generic_greeting(self):
        mailer.send_verification_email('a@example.com', 'tok')
        self.assertIn('Hi there,', mail.outbox[0].body)


class PasswordResetEmailTests(MailTestCase):
    def test_sends_reset_link(self):
        self.assertTrue(mailer.send_password_reset_email('a@example.com', 'xyz'))
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Reset your Core&Co account password')
        link = 'https://shop.example.com/auth/reset-password?token=xyz'
        self.assertIn(link, message.body)
        self.assertIn(link, self.html_of(message))


class CampaignEmailTests(MailTestCase):
    def test_sends_offer_details_and_defaults_to_store_home(self):
        sent = mailer.send_campaign_email(
            'a@example.com',
            first_name='Mali',
            campaign_name='Summer Sale',
            campaign_type_label='Discount',
            offer_label='20% OFF',
            start_date='2026-07-01',
            end_date='2026-07-31',
        )
        self.assertTrue(sent)
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Summer Sale is now live at Core&Co')
        self.assertIn('Offer: 20% OFF', message.body)
        self.assertIn('Valid: 2026-07-01 to 2026-07-31', message.body)
        self.assertIn('Shop Now: https://shop.example.com', message.body)
        self.assertIn('shop now to enjoy 20% off.', message.body.lower())

    def test_custom_shop_url_and_no_campaign_name(self):
        mailer.send_campaign_email('a@example.com', shop_url='https://shop.example.com/products')
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'A new offer is live at Core&Co')
        self.assertIn('https://shop.example.com/products', message.body)


class LogoTests(MailTestCase):
    def test_default_logo_is_attached_inline(self):
        mailer.send_verification_email('a@example.com', 'tok')
        message = mail.outbox[0]
        self.assertIn('cid:mail-logo', self.html_of(message))
        self.assertEqual(len(message.attachments), 1)
        self.assertEqual(message.attachments[0]['Content-ID'], '<mail-logo>')

    def test_logo_url_skips_attachment(self):
        with mock.patch.dict(os.environ, {'MAIL_LOGO_URL': 'https://cdn.example.com/logo.png'}):
            mailer.send_verification_email('a@example.com', 'tok')
        message = mail.outbox[0]
        self.assertIn('https://cdn.example.com/logo.png', self.html_of(message))
        self.assertEqual(message.attachments, [])

    def test_missing_logo_file_still_sends(self):
        with mock.patch.dict(os.environ, {'MAIL_LOGO_PATH': '/nope/missing.png'}):
            sent = mailer.send_verification_email('a@example.com', 'tok')
        self.assertTrue(sent)
        self.assertNotIn('<img', self.html_of(mail.outbox[0]))


class BrandTests(MailTestCase):
    def test_brand_name_and_support_email_from_env(self):
        env = {'MAIL_BRAND_NAME': 'Test Shop', 'SUPPORT_EMAIL': 'help@example.com'}
        with mock.patch.dict(os.environ, env):
            mailer.send_verification_email('a@example.com', 'tok')
        message = mail.outbox[0]
        self.assertEqual(message.subject, 'Verify your Test Shop account')
        self.assertIn('Need help? Contact help@example.com.', message.body)


class FailureTests(MailTestCase):
    def test_smtp_failure_is_logged_and_not_raised(self):
        with mock.patch.object(EmailMultiAlternatives, 'send', side_effect=OSError('smtp down')):
            with self.assertLogs('common.mail', level='ERROR') as logs:
                sent = mailer.send_password_reset_email('a@example.com', 'tok')
        self.assertFalse(sent)
        self.assertIn('a@example.com', '\n'.join(logs.output))
