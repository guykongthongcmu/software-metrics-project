import json
from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import Address, Admin, Session
from apps.accounts.sessions import COOKIE_NAME, create_session
from tests.cart.test_cart import CartTestCase, make_user

URL = '/api/client/checkout/address'

VALID = {
    'fullName': 'Buy Er',
    'phoneNumber': '+66 81-234-5678',
    'addressLine1': '1 Main Road',
    'addressLine2': 'Floor 2',
    'district': 'Bang Rak',
    'province': 'Bangkok',
    'postalCode': '10500',
    'country': 'Thailand',
}


def make_address(user, default=False, **overrides):
    values = {
        'full_name': 'Old Name', 'phone': '0812345678', 'line1': '9 Old St',
        'district': 'D', 'province': 'P', 'postcode': '10000', 'country': 'Thailand',
        'is_default_shipping': default,
    }
    values.update(overrides)
    return Address.objects.create(user=user, **values)


class AddressTestCase(CartTestCase):
    def save(self, **overrides):
        body = {**VALID, **overrides}
        return self.client.put(URL, body, content_type='application/json')


class GuardTests(AddressTestCase):
    def test_no_session_is_401(self):
        self.client.cookies.clear()
        for method in ('get', 'put'):
            res = getattr(self.client, method)(URL)
            self.assertEqual(res.status_code, 401)
            self.assertEqual(res.json()['code'], 'UNAUTHORIZED')

    def test_admin_session_is_403(self):
        admin = Admin.objects.create(email='a@example.com', password_hash='x', display_name='Admin')
        token, _ = create_session(admin, Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        for method in ('get', 'put'):
            res = getattr(self.client, method)(URL)
            self.assertEqual(res.status_code, 403)
            self.assertEqual(res.json()['code'], 'FORBIDDEN')

    def test_other_methods_are_405(self):
        self.assertEqual(self.client.post(URL).status_code, 405)
        self.assertEqual(self.client.delete(URL).status_code, 405)


class GetAddressTests(AddressTestCase):
    def test_none_when_no_address(self):
        res = self.client.get(URL)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'success')
        self.assertEqual(res.json()['data'], {'address': None})

    def test_returns_default_shipping(self):
        make_address(self.user, default=False, full_name='Other')
        make_address(self.user, default=True, full_name='Home', line2='Unit 4')
        address = self.client.get(URL).json()['data']['address']
        self.assertEqual(address['fullName'], 'Home')
        self.assertEqual(address['addressLine2'], 'Unit 4')
        self.assertEqual(
            set(address),
            {'fullName', 'phoneNumber', 'addressLine1', 'addressLine2', 'district', 'province', 'postalCode', 'country'},
        )

    def test_falls_back_to_latest_address(self):
        old = make_address(self.user, full_name='Older')
        new = make_address(self.user, full_name='Newer')
        Address.objects.filter(pk=old.pk).update(updated_at=timezone.now() - timedelta(days=2))
        Address.objects.filter(pk=new.pk).update(updated_at=timezone.now() - timedelta(days=1))
        self.assertEqual(self.client.get(URL).json()['data']['address']['fullName'], 'Newer')

    def test_other_customers_address_not_returned(self):
        make_address(make_user('other@example.com'), default=True)
        self.assertIsNone(self.client.get(URL).json()['data']['address'])


class PutAddressTests(AddressTestCase):
    def test_creates_default(self):
        res = self.save()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['address'], VALID)
        row = Address.objects.get(user=self.user)
        self.assertTrue(row.is_default_shipping)
        self.assertEqual(row.phone, '+66 81-234-5678')
        self.assertEqual(row.postcode, '10500')

    def test_updates_existing_default_not_duplicate(self):
        self.save()
        res = self.save(fullName='New Name', district='Sathorn')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Address.objects.filter(user=self.user).count(), 1)
        self.assertEqual(self.client.get(URL).json()['data']['address']['fullName'], 'New Name')

    def test_promotes_latest_non_default_address(self):
        row = make_address(self.user, default=False)
        self.save()
        row.refresh_from_db()
        self.assertTrue(row.is_default_shipping)
        self.assertEqual(row.full_name, 'Buy Er')
        self.assertEqual(Address.objects.filter(user=self.user).count(), 1)

    def test_does_not_touch_other_customers(self):
        other = make_address(make_user('other@example.com'), default=True)
        self.save()
        other.refresh_from_db()
        self.assertEqual(other.full_name, 'Old Name')

    def test_line2_is_optional_and_trimmed(self):
        body = {**VALID, 'fullName': '  Buy Er  '}
        del body['addressLine2']
        res = self.client.put(URL, body, content_type='application/json')
        self.assertEqual(res.status_code, 200)
        address = res.json()['data']['address']
        self.assertIsNone(address['addressLine2'])
        self.assertEqual(address['fullName'], 'Buy Er')

    def test_missing_fields_report_details(self):
        res = self.client.put(URL, {'fullName': 'Only Name'}, content_type='application/json')
        self.assertEqual(res.status_code, 400)
        body = res.json()
        self.assertEqual(body['code'], 'INVALID_ADDRESS_PAYLOAD')
        self.assertEqual(
            set(body['details']),
            {'phoneNumber', 'addressLine1', 'district', 'province', 'postalCode', 'country'},
        )
        self.assertFalse(Address.objects.exists())

    def test_blank_required_field(self):
        res = self.save(district='   ')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(list(res.json()['details']), ['district'])

    def test_bad_phone_and_postcode(self):
        res = self.save(phoneNumber='12ab34567', postalCode='1@3')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.json()['details']), {'phoneNumber', 'postalCode'})

    def test_phone_and_postcode_length_bounds(self):
        self.assertEqual(self.save(phoneNumber='123456').status_code, 400)
        self.assertEqual(self.save(phoneNumber='1' * 21).status_code, 400)
        self.assertEqual(self.save(postalCode='12').status_code, 400)
        self.assertEqual(self.save(postalCode='1' * 13).status_code, 400)
        self.assertEqual(self.save(phoneNumber='1234567', postalCode='123').status_code, 200)

    def test_non_ascii_digits_rejected(self):
        # Arabic-Indic and Thai digits
        res = self.save(phoneNumber='١٢٣٤٥٦٧')
        self.assertEqual(res.status_code, 400)
        res = self.save(postalCode='๑๐๕๐๐')
        self.assertEqual(res.status_code, 400)
        res = self.save(phoneNumber='123 4567')
        self.assertEqual(res.status_code, 400)

    def test_nul_and_lone_surrogate_rejected(self):
        for field in ('fullName', 'addressLine1', 'addressLine2', 'country'):
            res = self.save(**{field: 'bad\x00value'})
            self.assertEqual(res.status_code, 400, field)
            self.assertIn(field, res.json()['details'])
        res = self.save(district='\ud800')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(Address.objects.exists())

    def test_control_characters_rejected(self):
        for bad in ('\n', '\t', '\x1b', '\x7f'):
            res = self.save(phoneNumber=f'1234{bad}5678')
            self.assertEqual(res.status_code, 400, repr(bad))
            self.assertIn('phoneNumber', res.json()['details'])
            res = self.save(postalCode=f'10{bad}500')
            self.assertEqual(res.status_code, 400, repr(bad))
            res = self.save(fullName=f'Buy{bad}Er')
            self.assertEqual(res.status_code, 400, repr(bad))
            self.assertIn('fullName', res.json()['details'])
        self.assertFalse(Address.objects.exists())

    def test_too_long_fields(self):
        limits = {
            'fullName': 150, 'addressLine1': 255, 'addressLine2': 255,
            'district': 120, 'province': 120, 'country': 100,
        }
        for field, limit in limits.items():
            self.assertEqual(self.save(**{field: 'x' * limit}).status_code, 200, field)
            res = self.save(**{field: 'x' * (limit + 1)})
            self.assertEqual(res.status_code, 400, field)
            self.assertIn(field, res.json()['details'])

    def test_non_string_values_rejected(self):
        res = self.save(fullName=123, district=['a'], addressLine2={'a': 1})
        self.assertEqual(res.status_code, 400)
        self.assertEqual(set(res.json()['details']), {'fullName', 'district', 'addressLine2'})

    def test_non_object_body(self):
        for body in ([], 'text', 5):
            res = self.client.put(URL, json.dumps(body), content_type='application/json')
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'INVALID_ADDRESS_PAYLOAD')

    def test_malformed_json_is_400(self):
        res = self.client.put(URL, '{bad', content_type='application/json')
        self.assertEqual(res.status_code, 400)
