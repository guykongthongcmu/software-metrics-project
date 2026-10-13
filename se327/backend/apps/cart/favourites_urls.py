from django.urls import path

from . import favourites_views as views

urlpatterns = [
    path('favorites', views.FavouritesView.as_view()),
    path('favorites/<str:product_id>', views.FavouriteItemView.as_view()),
]
