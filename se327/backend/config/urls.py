from django.urls import re_path

from common.views import HealthView, NotFoundView

urlpatterns = [
    re_path(r'^health$', HealthView.as_view()),
    re_path(r'^.*$', NotFoundView.as_view()),
]
