from datetime import date

from apps.accounts.models import Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from tests.catalog.test_admin_products import JPEG, AdminProductCase, image
from tests.catalog.test_storefront import make_product

# a little over the 2.5 MB DATA_UPLOAD_MAX_MEMORY_SIZE default
BIG = '{"a": "' + 'x' * (3 * 1024 * 1024) + '"}'


class PayloadTooLargeTests(AdminProductCase):
    def post(self, url, body=BIG):
        return self.client.post(url, body, content_type='application/json')

    def assert_too_large(self, res):
        self.assertEqual(res.status_code, 413)
        self.assertEqual(res.json(), {
            'status': 'error', 'code': 'PAYLOAD_TOO_LARGE', 'message': 'request body is too large',
        })

    def test_public_routes(self):
        self.client.cookies.clear()
        self.assert_too_large(self.post('/api/auth/signup'))
        self.assert_too_large(self.post('/api/auth/forgot-password'))

    def test_customer_route(self):
        user = User.objects.create(
            email='buyer@example.com', password_hash='x', first_name='Buy', last_name='Er',
            date_of_birth=date(2000, 1, 1), phone_number='0812345678',
        )
        token, _ = create_session(user, Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token
        self.assert_too_large(self.post('/api/client/cart/items'))

    def test_admin_routes(self):
        self.assert_too_large(self.post('/api/admin/campaigns'))
        self.assert_too_large(self.client.put('/api/admin/products/1', BIG, content_type='application/json'))

    def test_body_under_the_limit_is_not_413(self):
        res = self.post('/api/auth/forgot-password', '{"email": "' + 'a' * 1000 + '"}')
        self.assertEqual(res.status_code, 400)

    def test_image_upload_over_the_json_limit_still_works(self):
        product = make_product('Tee', media=False)
        content = JPEG + b'0' * (4 * 1024 * 1024)
        res = self.client.post(f'/api/admin/products/{product.pk}/image', {'image': image('big.jpg', content)})
        self.assertEqual(res.status_code, 201, res.content)

    def test_too_many_query_parameters_is_400(self):
        query = '&'.join(f'a{i}=1' for i in range(1001))
        for url in (f'/api/client/products/search?q=x&{query}', f'/api/admin/orders?{query}'):
            res = self.client.get(url)
            self.assertEqual((res.status_code, res.json()['code']), (400, 'BAD_REQUEST'), url)
