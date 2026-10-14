from django.urls import include, re_path

from apps.accounts.views import LogoutView
from apps.catalog.admin_product_views import product_file
from common.views import HealthView, NotFoundView

CLIENT = r'^api/client/'
ADMIN = r'^api/admin/'

urlpatterns = [
    re_path(r'^health$', HealthView.as_view()),
    re_path(CLIENT, include('apps.catalog.urls')),
    re_path(ADMIN, include('apps.analytics.urls')),
    re_path(ADMIN, include('apps.orders.urls_admin')),
    re_path(ADMIN, include('apps.catalog.admin_urls')),
    re_path(CLIENT, include('apps.cart.favourites_urls')),
    re_path(CLIENT, include('apps.cart.urls')),
    re_path(CLIENT, include('apps.orders.urls')),
    re_path(r'^api/auth/logout$', LogoutView.as_view()),
    re_path(r'^', include('apps.campaigns.urls')),
    re_path(r'^api/auth/', include('apps.accounts.urls')),
    re_path(r'^media/(?P<path>products/[\w.-]+)$', product_file),
    re_path(r'^.*$', NotFoundView.as_view()),
]
