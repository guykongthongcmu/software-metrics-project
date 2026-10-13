from django.urls import path

from . import views

urlpatterns = [
    path('cart', views.CartDetailView.as_view()),
    path('cart/items', views.CartItemListView.as_view()),
    path('cart/items/<str:item_id>', views.CartItemDetailView.as_view()),
]
