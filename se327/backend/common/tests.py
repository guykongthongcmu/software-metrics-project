from django.test import SimpleTestCase, override_settings
from django.urls import path
from rest_framework.views import APIView

ALLOWED = 'http://localhost:8080'


class BoomView(APIView):
    def get(self, request):
        raise RuntimeError('secret internal detail')


def plain_boom(request):
    raise RuntimeError('secret internal detail')


urlpatterns = [
    path('boom', BoomView.as_view()),
    path('plain-boom', plain_boom),
]


@override_settings(CORS_ALLOWED_ORIGINS=[ALLOWED])
class HealthTests(SimpleTestCase):
    def test_health_returns_ok(self):
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {'status': 'ok'})


@override_settings(CORS_ALLOWED_ORIGINS=[ALLOWED])
class NotFoundTests(SimpleTestCase):
    def test_unknown_route_returns_json_envelope(self):
        res = self.client.get('/nope')
        self.assertEqual(res.status_code, 404)
        body = res.json()
        self.assertEqual(body['status'], 'error')
        self.assertEqual(body['code'], 'NOT_FOUND')

    def test_unknown_route_post_returns_json_envelope(self):
        res = self.client.post('/nope', {}, content_type='application/json')
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.json()['code'], 'NOT_FOUND')


@override_settings(ROOT_URLCONF='common.tests', CORS_ALLOWED_ORIGINS=[ALLOWED], DEBUG=True)
class ServerErrorTests(SimpleTestCase):
    def setUp(self):
        self.client.raise_request_exception = False

    def assert_no_leak(self, res):
        self.assertEqual(res.status_code, 500)
        self.assertEqual(
            res.json(),
            {
                'status': 'error',
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'internal server error',
            },
        )
        self.assertNotIn('secret internal detail', res.content.decode())
        self.assertNotIn('Traceback', res.content.decode())

    def test_uncaught_error_in_api_view(self):
        self.assert_no_leak(self.client.get('/boom'))

    def test_uncaught_error_in_plain_view(self):
        self.assert_no_leak(self.client.get('/plain-boom'))


@override_settings(CORS_ALLOWED_ORIGINS=[ALLOWED])
class CorsTests(SimpleTestCase):
    def test_no_origin_header_passes_through(self):
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        self.assertNotIn('Access-Control-Allow-Origin', res)

    def test_disallowed_origin_rejected(self):
        res = self.client.get('/health', HTTP_ORIGIN='http://evil.example.com')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()['code'], 'CORS_ORIGIN_NOT_ALLOWED')
        self.assertNotIn('Access-Control-Allow-Origin', res)

    def test_allowed_origin_reflected_with_credentials(self):
        res = self.client.get('/health', HTTP_ORIGIN=ALLOWED)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Access-Control-Allow-Origin'], ALLOWED)
        self.assertEqual(res['Access-Control-Allow-Credentials'], 'true')

    def test_preflight_allowed_origin(self):
        res = self.client.options(
            '/health',
            HTTP_ORIGIN=ALLOWED,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
        )
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res['Access-Control-Allow-Origin'], ALLOWED)
        self.assertEqual(res['Access-Control-Allow-Credentials'], 'true')
        self.assertEqual(res['Access-Control-Allow-Headers'], 'content-type')

    def test_preflight_disallowed_origin_rejected(self):
        res = self.client.options('/health', HTTP_ORIGIN='http://evil.example.com')
        self.assertEqual(res.status_code, 403)

    def test_error_responses_also_carry_cors_headers(self):
        res = self.client.get('/nope', HTTP_ORIGIN=ALLOWED)
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res['Access-Control-Allow-Origin'], ALLOWED)
