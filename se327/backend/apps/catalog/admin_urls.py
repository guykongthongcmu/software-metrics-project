from django.urls import path

from . import admin_category_views, admin_product_views

urlpatterns = [
    path('categories', admin_category_views.AdminCategoryListView.as_view()),
    path('categories/<str:category_id>', admin_category_views.AdminCategoryView.as_view()),
    path('categories/<str:category_id>/visibility', admin_category_views.AdminCategoryVisibilityView.as_view()),
    path('products', admin_product_views.AdminProductListView.as_view()),
    path('products/<str:product_id>', admin_product_views.AdminProductView.as_view()),
    path('products/<str:product_id>/images', admin_product_views.AdminProductImagesView.as_view()),
    path('products/<str:product_id>/image', admin_product_views.AdminProductImagesView.as_view()),
]
