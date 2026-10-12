from django.db import models
from django.db.models import Q


class Cart(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE'
        CONVERTED = 'CONVERTED'
        ABANDONED = 'ABANDONED'

    cart_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, db_column='user_id', related_name='carts')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cart'
        indexes = [models.Index(fields=['status'], name='idx_cart_status')]
        constraints = [
            models.UniqueConstraint(
                fields=['user'], condition=Q(status='ACTIVE'),
                name='uq_one_active_cart_per_user',
            ),
        ]


class CartItem(models.Model):
    cart_item_id = models.BigAutoField(primary_key=True)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, db_column='cart_id', related_name='items')
    product_variant = models.ForeignKey(
        'catalog.ProductVariant', on_delete=models.CASCADE,
        db_column='product_variant_id', related_name='cart_items',
    )
    quantity = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cart_item'
        constraints = [
            models.UniqueConstraint(fields=['cart', 'product_variant'], name='uq_cart_variant'),
            models.CheckConstraint(name='chk_cart_item_quantity_positive', condition=Q(quantity__gt=0)),
        ]


class Wishlist(models.Model):
    wishlist_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, db_column='user_id', related_name='wishlist')
    product = models.ForeignKey('catalog.Product', on_delete=models.CASCADE, db_column='product_id', related_name='wishlisted_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wishlist'
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='uq_wishlist_user_product'),
        ]
