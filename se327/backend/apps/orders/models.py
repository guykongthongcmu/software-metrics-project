from django.db import models
from django.db.models import Q


class Order(models.Model):
    class Status(models.TextChoices):
        PURCHASED = 'PURCHASED'

    order_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey('accounts.User', on_delete=models.PROTECT, db_column='user_id', related_name='orders')
    # Live links are optional; the snapshots below are what the order is read from.
    shipping_address = models.ForeignKey(
        'accounts.Address', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='shipping_address_id', related_name='+',
    )
    billing_address = models.ForeignKey(
        'accounts.Address', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='billing_address_id', related_name='+',
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PURCHASED)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    shipping_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    shipping_address_snapshot = models.JSONField(null=True, blank=True)
    billing_address_snapshot = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'
        indexes = [models.Index(fields=['status', 'created_at'], name='idx_orders_status_created')]


class OrderItem(models.Model):
    order_item_id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='items')
    product_variant = models.ForeignKey(
        'catalog.ProductVariant', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='product_variant_id', related_name='order_items',
    )
    snapshot_product_name = models.CharField(max_length=255)
    snapshot_color = models.CharField(max_length=100, null=True, blank=True)
    snapshot_size = models.CharField(max_length=40, null=True, blank=True)
    snapshot_unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    snapshot_compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    quantity = models.PositiveIntegerField()
    line_total = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = 'order_item'
        constraints = [
            models.CheckConstraint(name='chk_order_item_quantity_positive', condition=Q(quantity__gt=0)),
        ]
