from unittest import mock

from django.core.management import call_command
from django.test import TestCase

from apps.accounts.models import Session
from apps.accounts.sessions import COOKIE_NAME

from .test_signin import FAST_HASH


@FAST_HASH
class SeededAdminTests(TestCase):
    def test_seeded_admin_can_sign_in(self):
        env = {'SEED_ADMIN_EMAIL': 'seeded@example.com', 'SEED_ADMIN_PASSWORD': 'seedpass123'}
        with mock.patch.dict('os.environ', env):
            call_command('seed_demo', verbosity=0)
        res = self.client.post(
            '/api/auth/admin/signin',
            {'email': 'seeded@example.com', 'password': 'seedpass123'},
            content_type='application/json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['role'], 'admin')
        session = Session.objects.get(session_token=res.cookies[COOKIE_NAME].value)
        self.assertEqual(session.subject_type, 'ADMIN')
