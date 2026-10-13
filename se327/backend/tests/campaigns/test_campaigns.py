import json
import os
import shutil
import tempfile
from datetime import date, timedelta
from unittest import mock

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.campaigns.models import Campaign, CampaignProduct
from apps.catalog.models import Product, ProductMedia, ProductTranslation, ProductVariant
from apps.orders.models import Order, OrderItem

MAIL_ENV = {
    'SMTP_HOST': 'smtp.example.com',
    'SMTP_USER': 'shop@example.com',
    'SMTP_PASS': 'secret',
    'WEBSTORE_BASE_URL': 'https://shop.example.com',
}


def make_admin(email='boss@example.com', is_active=True):
    return Admin.objects.create(email=email, password_hash='x', display_name='Boss', is_active=is_active)


def make_user(email='buyer@example.com', verified=True):
    return User.objects.create(
        email=email, password_hash='x', first_name='Ann', last_name='B', date_of_birth=date(2000, 1, 1),
        phone_number='0800000000', email_verified_at=timezone.now() if verified else None,
    )


def make_product(name='Tee', active=True):
    product = Product.objects.create(product_type='TOP', is_active=active)
    ProductTranslation.objects.create(product=product, language_code='EN', name=name)
    return product


def sell(product, quantity):
    variant = ProductVariant.objects.create(
        product=product, sku_code=f'sku-{product.pk}', colour='red', size='M', price=10, stock_qty=5,
    )
    order = Order.objects.create(user=make_user(f'b{product.pk}@example.com'), subtotal=10, total=10)
    OrderItem.objects.create(
        order=order, product_variant=variant, snapshot_product_name='x', snapshot_unit_price=10,
        quantity=quantity, line_total=10 * quantity,
    )


def image(name='banner.png', content_type='image/png', size=20):
    return SimpleUploadedFile(name, b'x' * size, content_type=content_type)


def campaign_json(**changes):
    data = {
        'name': 'Summer', 'type': 'PERCENTAGE_DISCOUNT', 'discountValue': 20,
        'startDate': '2026-06-01', 'endDate': '2026-06-30', 'channels': {'web': True, 'email': False},
    }
    data.update(changes)
    return data


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class CampaignTestCase(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        patcher = mock.patch.dict(os.environ, {**MAIL_ENV, 'CAMPAIGN_MEDIA_DIR': self.media})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(shutil.rmtree, self.media, True)
        mail.outbox = []
        self.admin = make_admin()
        self.login_as(self.admin)

    def login_as(self, admin):
        token, _ = create_session(admin, Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token

    def launch(self, data=None, file='default'):
        """Post a multipart launch. data may be a dict or a raw string."""
        data = campaign_json() if data is None else data
        body = {'campaignData': data if isinstance(data, str) else json.dumps(data)}
        if file == 'default':
            file = image()
        if file is not None:
            body['mediaFile'] = file
        return self.client.post('/api/admin/launch-campaign', body)


class GuardTests(CampaignTestCase):
    def test_no_session_is_401(self):
        self.client.cookies.clear()
        self.assertEqual(self.launch().status_code, 401)
        self.assertEqual(self.client.post('/api/admin/campaigns', {}, content_type='application/json').status_code, 401)

    def test_customer_is_403(self):
        token, _ = create_session(make_user(), Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.launch().status_code, 403)
        self.assertEqual(self.client.post('/api/admin/campaigns', {}, content_type='application/json').status_code, 403)

    def test_inactive_admin_is_403(self):
        self.login_as(make_admin('off@example.com', is_active=False))
        self.assertEqual(self.launch().status_code, 403)

    def test_listing_is_public(self):
        self.client.cookies.clear()
        self.assertEqual(self.client.get('/api/client/campaigns').status_code, 200)


class LaunchTests(CampaignTestCase):
    def test_launch_stores_campaign_and_discounts_products(self):
        a = make_product('A')
        make_product('B')
        hidden = make_product('Hidden', active=False)
        response = self.launch()
        self.assertEqual(response.status_code, 201)
        data = response.json()['data']
        self.assertEqual(data['emailBlast']['enabled'], False)
        self.assertEqual(data['message'], '20% off')
        campaign = Campaign.objects.get()
        self.assertEqual(campaign.created_by_admin, self.admin)
        self.assertEqual(campaign.status, 'ACTIVE')
        self.assertEqual(CampaignProduct.objects.filter(campaign=campaign).count(), 2)
        a.refresh_from_db()
        hidden.refresh_from_db()
        self.assertEqual(a.campaign_discount_type, 'PERCENTAGE')
        self.assertEqual(a.campaign_discount_campaign, campaign)
        self.assertIsNone(hidden.campaign_discount_type)
        self.assertTrue(os.path.isfile(os.path.join(self.media, 'campaign-banners', f'{campaign.pk}.png')))

    def test_launch_with_product_ids_only_discounts_those(self):
        a, b = make_product('A'), make_product('B')
        self.assertEqual(self.launch(campaign_json(productIds=[a.pk])).status_code, 201)
        a.refresh_from_db()
        b.refresh_from_db()
        self.assertIsNotNone(a.campaign_discount_type)
        self.assertIsNone(b.campaign_discount_type)

    def test_launch_fixed_alias_is_normalised(self):
        make_product()
        response = self.launch(campaign_json(type='FIXED_AMOUNT_DISCOUNT', discountValue=50))
        self.assertEqual(response.json()['data']['type'], 'FIXED_DISCOUNT')
        self.assertEqual(response.json()['data']['message'], '50 off')

    def test_launch_best_seller_without_sales(self):
        response = self.launch(campaign_json(type='BEST_SELLER', discountValue=None))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(CampaignProduct.objects.count(), 0)

    def test_launch_best_seller_links_top_product(self):
        top = make_product('Top')
        sell(top, 3)
        self.launch(campaign_json(type='BEST_SELLER', discountValue=None))
        self.assertEqual(CampaignProduct.objects.get().product, top)

    def test_launch_web_off_is_inactive_and_not_listed(self):
        product = make_product()
        self.launch(campaign_json(startDate='2000-01-01', endDate='2999-01-01', channels={'web': False, 'email': False}))
        self.assertEqual(Campaign.objects.get().status, 'INACTIVE')
        product.refresh_from_db()
        self.assertIsNone(product.campaign_discount_type)
        self.assertEqual(self.client.get('/api/client/campaigns').json()['data']['campaigns'], [])

    def test_launched_banner_shows_in_listing_and_is_served(self):
        make_product()
        today = timezone.localdate()
        self.launch(campaign_json(startDate=str(today - timedelta(days=1)), endDate=str(today + timedelta(days=1))))
        campaigns = self.client.get('/api/client/campaigns').json()['data']['campaigns']
        self.assertEqual(len(campaigns), 1)
        self.assertEqual(campaigns[0]['name'], 'Summer')
        url = campaigns[0]['bannerImageUrl']
        self.assertTrue(url.startswith('/media/campaign-banners/'))
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.post(url).status_code, 405)

    def test_json_body_without_image_is_400(self):
        response = self.client.post(
            '/api/admin/launch-campaign', {'campaignData': campaign_json()}, content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)

    def test_bad_campaign_data_is_400(self):
        cases = [
            ('INVALID_CAMPAIGN_PAYLOAD', 'not json'),
            ('INVALID_CAMPAIGN_PAYLOAD', json.dumps([1])),
            ('VALIDATION_ERROR', campaign_json(name='')),
            ('VALIDATION_ERROR', campaign_json(name='x' * 151)),
            ('INVALID_CAMPAIGN_TYPE', campaign_json(type='NOPE')),
            ('VALIDATION_ERROR', campaign_json(discountValue=None)),
            ('VALIDATION_ERROR', campaign_json(discountValue=0)),
            ('VALIDATION_ERROR', campaign_json(discountValue='abc')),
            ('VALIDATION_ERROR', campaign_json(discountValue=101)),
            ('VALIDATION_ERROR', campaign_json(type='BEST_SELLER', discountValue=5)),
            ('VALIDATION_ERROR', campaign_json(startDate='2026-07-01')),
            ('VALIDATION_ERROR', campaign_json(startDate='bad')),
            ('VALIDATION_ERROR', campaign_json(channels={'web': 'yes'})),
            ('VALIDATION_ERROR', campaign_json(message=5)),
        ]
        for code, data in cases:
            with self.subTest(data=data):
                response = self.launch(data)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()['code'], code)
        self.assertEqual(Campaign.objects.count(), 0)

    def test_bad_image_is_400(self):
        self.assertEqual(self.launch(file=None).status_code, 400)
        self.assertEqual(self.launch(file=image('a.txt', 'text/plain')).status_code, 400)
        self.assertEqual(self.launch(file=image(size=5 * 1024 * 1024 + 1)).status_code, 400)
        self.assertEqual(Campaign.objects.count(), 0)

    def test_unknown_product_is_404(self):
        self.assertEqual(self.launch(campaign_json(productIds=[999])).status_code, 404)


class EmailBlastTests(CampaignTestCase):
    def setUp(self):
        super().setUp()
        make_user('one@example.com')
        make_user('two@example.com')
        make_user('unverified@example.com', verified=False)

    def blast(self):
        return self.launch(campaign_json(channels={'web': True, 'email': True}))

    def test_every_verified_customer_is_emailed(self):
        blast = self.blast().json()['data']['emailBlast']
        self.assertEqual(
            (blast['enabled'], blast['totalRecipients'], blast['sentCount'], blast['failedCount']), (True, 2, 2, 0),
        )
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['one@example.com', 'two@example.com'])

    def test_failed_sends_are_counted_and_do_not_fail_the_request(self):
        real = mail.EmailMultiAlternatives.send

        def flaky(message, *args, **kwargs):
            if message.to == ['two@example.com']:
                raise OSError('smtp down')
            return real(message, *args, **kwargs)

        with mock.patch.object(mail.EmailMultiAlternatives, 'send', flaky):
            response = self.blast()
        self.assertEqual(response.status_code, 201)
        blast = response.json()['data']['emailBlast']
        self.assertEqual((blast['sentCount'], blast['failedCount']), (1, 1))
        self.assertEqual(blast['failedRecipients'][0]['email'], 'two@example.com')
        self.assertEqual(Campaign.objects.count(), 1)

    def test_missing_mail_config_fails_every_send_but_not_the_request(self):
        with mock.patch.dict(os.environ, {'SMTP_PASS': ''}):
            response = self.blast()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['data']['emailBlast']['failedCount'], 2)

    def test_crashing_sender_is_counted(self):
        with mock.patch('apps.campaigns.services.mail.send_campaign_email', side_effect=RuntimeError('boom')):
            response = self.blast()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['data']['emailBlast']['failedCount'], 2)


class CreateCampaignTests(CampaignTestCase):
    def post(self, data):
        return self.client.post('/api/admin/campaigns', data, content_type='application/json')

    def body(self, **changes):
        data = {
            'name': 'Sale', 'type': 'FIXED_DISCOUNT', 'discountValue': 5.5,
            'startDate': '2026-01-01', 'endDate': '2026-01-31',
        }
        data.update(changes)
        return data

    def test_creates_discount_campaign(self):
        product = make_product()
        response = self.post(self.body(productIds=[product.pk, product.pk]))
        self.assertEqual(response.status_code, 201)
        data = response.json()['data']
        self.assertEqual((data['status'], data['discountValue'], data['productIds']), ('ACTIVE', 5.5, [product.pk]))
        product.refresh_from_db()
        self.assertEqual(product.campaign_discount_type, 'FIXED')

    def test_best_seller_picks_top_product(self):
        low, top = make_product('Low'), make_product('Top')
        sell(low, 1)
        sell(top, 4)
        response = self.post(self.body(type='BEST_SELLER', discountValue=None))
        self.assertEqual(response.json()['data']['productIds'], [top.pk])

    def test_best_seller_without_sales_is_400(self):
        response = self.post(self.body(type='BEST_SELLER', discountValue=None))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'VALIDATION_ERROR')

    def test_best_seller_rejects_product_ids(self):
        product = make_product()
        sell(product, 1)
        response = self.post(self.body(type='BEST_SELLER', discountValue=None, productIds=[product.pk]))
        self.assertEqual(response.status_code, 400)

    def test_errors(self):
        product = make_product()
        cases = [
            (400, 'INVALID_CAMPAIGN_TYPE', self.body(type='X', productIds=[product.pk])),
            (400, 'VALIDATION_ERROR', self.body()),
            (400, 'VALIDATION_ERROR', self.body(productIds=[])),
            (400, 'VALIDATION_ERROR', self.body(productIds=['a'])),
            (400, 'VALIDATION_ERROR', self.body(productIds=[True])),
            (400, 'VALIDATION_ERROR', self.body(productIds=[product.pk], message='m' * 256)),
            (400, 'VALIDATION_ERROR', self.body(productIds=[product.pk], endDate='2025-01-01')),
            (400, 'VALIDATION_ERROR', [1]),
            (404, 'PRODUCT_NOT_FOUND', self.body(productIds=[product.pk, 12345])),
        ]
        for status, code, data in cases:
            with self.subTest(data=data):
                response = self.post(data)
                self.assertEqual((response.status_code, response.json()['code']), (status, code))
        self.assertEqual(Campaign.objects.count(), 0)


class ListingTests(CampaignTestCase):
    def make(self, name, kind='PERCENTAGE_DISCOUNT', start=-1, end=1, status='ACTIVE'):
        today = timezone.localdate()
        return Campaign.objects.create(
            name=name, type=kind, status=status, discount_value=None if kind == 'BEST_SELLER' else 10,
            start_date=today + timedelta(days=start), end_date=today + timedelta(days=end),
        )

    def listing(self, query=''):
        return self.client.get('/api/client/campaigns' + query)

    def test_only_active_current_campaigns_newest_first(self):
        self.make('older', start=-5)
        new = self.make('newer', start=-1)
        self.make('future', start=2, end=3)
        self.make('expired', start=-9, end=-2)
        self.make('off', status='INACTIVE')
        names = [c['name'] for c in self.listing().json()['data']['campaigns']]
        self.assertEqual(names, ['newer', 'older'])
        link = CampaignProduct.objects.create(campaign=new, product=make_product())
        first = self.listing().json()['data']['campaigns'][0]
        self.assertEqual(first['discount'], {'type': 'PERCENTAGE', 'value': 10.0})
        self.assertEqual(first['productIds'], [link.product_id])
        self.assertIsNone(first['bannerImageUrl'])

    def test_best_seller_shape_and_language(self):
        product = make_product('Tee')
        ProductTranslation.objects.create(product=product, language_code='TH', name='shirt-th')
        ProductMedia.objects.create(
            product=product, bucket_name='b', file_path='p', public_url='https://img/1.png', sort_order=1,
        )
        CampaignProduct.objects.create(campaign=self.make('best', 'BEST_SELLER'), product=product)
        en = self.listing().json()['data']['campaigns'][0]['bestSellerProduct']
        th = self.listing('?lang=th').json()['data']['campaigns'][0]['bestSellerProduct']
        self.assertEqual((en['name'], en['image']), ('Tee', 'https://img/1.png'))
        self.assertEqual(th['name'], 'shirt-th')

    def test_best_seller_without_product_is_null(self):
        self.make('best', 'BEST_SELLER')
        self.assertIsNone(self.listing().json()['data']['campaigns'][0]['bestSellerProduct'])

    def test_bad_lang_is_400(self):
        response = self.listing('?lang=FR')
        self.assertEqual((response.status_code, response.json()['code']), (400, 'INVALID_QUERY'))

    def test_empty_listing(self):
        self.assertEqual(self.listing().json()['data'], {'campaigns': []})
