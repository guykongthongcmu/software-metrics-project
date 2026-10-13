from django.urls import path

from . import views

urlpatterns = [
    path('checkout/address', views.CheckoutAddressView.as_view()),
    path('checkout/purchase', views.CheckoutPurchaseView.as_view()),
]
