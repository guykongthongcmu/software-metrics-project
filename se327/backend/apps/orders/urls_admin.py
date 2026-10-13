from django.urls import path

from . import views_admin

urlpatterns = [
    path('orders', views_admin.OrderListView.as_view()),
    path('orders/<str:order_id>', views_admin.OrderDetailView.as_view()),
]
