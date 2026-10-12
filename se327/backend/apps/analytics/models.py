from django.db import models


class AnalyticsEvent(models.Model):
    class EventType(models.TextChoices):
        PURCHASE = 'PURCHASE'
        PRODUCT_VIEW = 'PRODUCT_VIEW'
        PRODUCT_COMMENT = 'PRODUCT_COMMENT'
        PRODUCT_LIKE = 'PRODUCT_LIKE'
        SEARCH = 'SEARCH'
        WISHLIST = 'WISHLIST'
        CART = 'CART'
        CHECKOUT_ATTEMPT = 'CHECKOUT_ATTEMPT'
        REVIEW_INTERACTION = 'REVIEW_INTERACTION'

    event_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        'accounts.User', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='user_id', related_name='+',
    )
    session_id = models.CharField(max_length=255, null=True, blank=True)
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    product = models.ForeignKey(
        'catalog.Product', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='product_id', related_name='+',
    )
    product_variant = models.ForeignKey(
        'catalog.ProductVariant', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='product_variant_id', related_name='+',
    )
    cart = models.ForeignKey(
        'cart.Cart', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='cart_id', related_name='+',
    )
    order = models.ForeignKey(
        'orders.Order', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='order_id', related_name='+',
    )
    search_query = models.CharField(max_length=255, null=True, blank=True)
    event_count = models.PositiveIntegerField(default=1)
    event_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    metadata_json = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_event'
        indexes = [
            models.Index(fields=['event_type', 'created_at'], name='idx_analytics_type_created'),
            models.Index(fields=['product', 'event_type', 'created_at'], name='idx_analytics_product_event'),
            models.Index(fields=['user', 'created_at'], name='idx_analytics_user_created'),
        ]
