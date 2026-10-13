from django.urls import path, re_path

from . import views

urlpatterns = [
    path('api/client/campaigns', views.ClientCampaignListView.as_view()),
    path('api/admin/campaigns', views.AdminCampaignView.as_view()),
    path('api/admin/launch-campaign', views.LaunchCampaignView.as_view()),
    re_path(r'^media/(?P<path>campaign-banners/[\w.-]+)$', views.banner_file),
]
