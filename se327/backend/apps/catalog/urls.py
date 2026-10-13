from django.urls import path

from . import views, views_detail

urlpatterns = [
    path('categories', views.CategoryListView.as_view()),
    path('products', views.ProductListView.as_view()),
    path('products/new-arrivals', views.NewArrivalsView.as_view()),
    path('products/search', views.SearchView.as_view()),
    path('products/search/suggestions', views.SearchSuggestionsView.as_view()),
    path('products/recommendations', views.RecommendationsView.as_view()),
    path('products/category/<str:slug>', views.CategoryProductsView.as_view()),
    path('products/<str:product_id>', views_detail.ProductDetailView.as_view()),
    path('products/<str:product_id>/variants', views_detail.ProductVariantsView.as_view()),
    path('products/<str:product_id>/images', views_detail.ProductImagesView.as_view()),
]
