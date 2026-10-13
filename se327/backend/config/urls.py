from django.urls import include, re_path

from apps.accounts.views import LogoutView
from common.views import HealthView, NotFoundView

urlpatterns = [
    re_path(r'^health$', HealthView.as_view()),
    re_path(r'^api/client/', include('apps.catalog.urls')),
    re_path(r'^api/client/', include('apps.cart.urls')),
    re_path(r'^api/auth/logout$', LogoutView.as_view()),
    re_path(r'^api/auth/', include('apps.accounts.urls')),
    re_path(r'^.*$', NotFoundView.as_view()),
]
