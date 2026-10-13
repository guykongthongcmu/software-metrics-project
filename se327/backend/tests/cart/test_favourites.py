from django.test import TestCase

from apps.accounts.models import Admin, Session, User
from apps.accounts.sessions import COOKIE_NAME, create_session
from apps.cart.models import Wishlist
from tests.catalog.test_storefront import add_variant, make_product

URL = '/api/client/favorites'


def make_user(email='a@test.com'):
    return User.objects.create(
        email=email, password_hash='x', first_name='A', last_name='B',
        date_of_birth='2000-01-01', phone_number='0800000000',
    )


class FavouritesTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.login(self.user)

    def login(self, user):
        token, _ = create_session(user, Session.SubjectType.USER)
        self.client.cookies[COOKIE_NAME] = token

    def test_requires_customer_session(self):
        self.client.cookies.clear()
        for res in (self.client.get(URL), self.client.post(f'{URL}/1'), self.client.delete(f'{URL}/1')):
            self.assertEqual(res.status_code, 401)

    def test_admin_session_is_forbidden(self):
        admin = Admin.objects.create(email='ad@test.com', password_hash='x', display_name='Ad')
        token, _ = create_session(admin, Session.SubjectType.ADMIN)
        self.client.cookies[COOKIE_NAME] = token
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_empty_list(self):
        res = self.client.get(URL)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'favoritesCount': 0, 'products': []})

    def test_list_returns_cards_with_colours_and_sizes_newest_first(self):
        first = make_product('First')
        second = make_product('Second')
        add_variant(second, colour='Red', size='L')
        self.client.post(f'{URL}/{first.pk}')
        self.client.post(f'{URL}/{second.pk}')
        data = self.client.get(URL).json()['data']
        self.assertEqual(data['favoritesCount'], 2)
        self.assertEqual([p['name'] for p in data['products']], ['Second', 'First'])
        self.assertEqual(data['products'][0]['color'], ['Black', 'Red'])
        self.assertEqual(data['products'][0]['size'], ['L', 'M'])

    def test_list_only_shows_own_favourites(self):
        product = make_product('Mine')
        self.client.post(f'{URL}/{product.pk}')
        self.login(make_user('other@test.com'))
        self.assertEqual(self.client.get(URL).json()['data']['favoritesCount'], 0)

    def test_add_is_idempotent(self):
        product = make_product('Tee')
        for _ in range(2):
            res = self.client.post(f'{URL}/{product.pk}')
            self.assertEqual(res.status_code, 200)
            data = res.json()['data']
            self.assertTrue(data['isFavorite'])
            self.assertEqual(data['favoritesCount'], 1)
            self.assertEqual(data['product']['name'], 'Tee')
        self.assertEqual(Wishlist.objects.filter(user=self.user).count(), 1)

    def test_remove_deletes_only_that_favourite(self):
        keep = make_product('Keep')
        drop = make_product('Drop')
        other = make_user('other@test.com')
        Wishlist.objects.create(user=other, product=drop)
        self.client.post(f'{URL}/{keep.pk}')
        self.client.post(f'{URL}/{drop.pk}')
        res = self.client.delete(f'{URL}/{drop.pk}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data'], {'productId': drop.pk, 'isFavorite': False, 'favoritesCount': 1})
        mine = Wishlist.objects.filter(user=self.user).values_list('product_id', flat=True)
        self.assertEqual(list(mine), [keep.pk])
        self.assertTrue(Wishlist.objects.filter(user=other, product=drop).exists())

    def test_remove_when_not_a_favourite_still_succeeds(self):
        product = make_product('Tee')
        res = self.client.delete(f'{URL}/{product.pk}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['favoritesCount'], 0)

    def test_inactive_product_is_404_on_add_and_remove(self):
        product = make_product('Gone', active=False)
        for call in (self.client.post, self.client.delete):
            res = call(f'{URL}/{product.pk}')
            self.assertEqual(res.status_code, 404)
            self.assertEqual(res.json()['code'], 'PRODUCT_NOT_FOUND')

    def test_unknown_product_is_404(self):
        self.assertEqual(self.client.post(f'{URL}/999999').status_code, 404)

    def test_bad_product_id_is_400(self):
        for bad in ('abc', '0', '-1', '1.5'):
            for call in (self.client.post, self.client.delete):
                res = call(f'{URL}/{bad}')
                self.assertEqual(res.status_code, 400)
                self.assertEqual(res.json()['code'], 'INVALID_PRODUCT_ID')

    def test_inactive_favourite_is_left_out_of_list_and_count(self):
        gone = make_product('Gone')
        shown = make_product('Shown')
        Wishlist.objects.create(user=self.user, product=gone)
        Wishlist.objects.create(user=self.user, product=shown)
        gone.is_active = False
        gone.save()
        data = self.client.get(URL).json()['data']
        self.assertEqual(data['favoritesCount'], 1)
        self.assertEqual([p['name'] for p in data['products']], ['Shown'])

    def test_bad_lang_is_400(self):
        res = self.client.get(f'{URL}?lang=FR')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()['code'], 'INVALID_LANGUAGE')
