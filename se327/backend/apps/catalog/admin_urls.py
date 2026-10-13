from django.urls import path

from . import admin_category_views

urlpatterns = [
    path('categories', admin_category_views.AdminCategoryListView.as_view()),
    path('categories/<str:category_id>', admin_category_views.AdminCategoryView.as_view()),
    path('categories/<str:category_id>/visibility', admin_category_views.AdminCategoryVisibilityView.as_view()),
]
