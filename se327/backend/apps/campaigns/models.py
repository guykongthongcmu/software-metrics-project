from django.db import models
from django.db.models import F, Q


class Campaign(models.Model):
    class Type(models.TextChoices):
        BEST_SELLER = 'BEST_SELLER'
        PERCENTAGE_DISCOUNT = 'PERCENTAGE_DISCOUNT'
        FIXED_DISCOUNT = 'FIXED_DISCOUNT'

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE'
        INACTIVE = 'INACTIVE'

    campaign_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=150)
    type = models.CharField(max_length=20, choices=Type.choices)
    message = models.CharField(max_length=255, null=True, blank=True)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    start_date = models.DateField()
    end_date = models.DateField()
    created_by_admin = models.ForeignKey(
        'accounts.Admin', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='created_by_admin_id', related_name='campaigns',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaigns'
        indexes = [
            models.Index(fields=['status', 'start_date', 'end_date'], name='idx_campaigns_status_date'),
            models.Index(fields=['type'], name='idx_campaigns_type'),
        ]
        constraints = [
            models.CheckConstraint(
                name='chk_campaigns_discount_rules',
                condition=(
                    Q(type='BEST_SELLER', discount_value__isnull=True)
                    | Q(type__in=['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT'], discount_value__gt=0)
                ),
            ),
            models.CheckConstraint(name='chk_campaigns_date_range', condition=Q(start_date__lte=F('end_date'))),
        ]


class CampaignProduct(models.Model):
    campaign_product_id = models.BigAutoField(primary_key=True)
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, db_column='campaign_id', related_name='campaign_products')
    product = models.ForeignKey('catalog.Product', on_delete=models.CASCADE, db_column='product_id', related_name='campaign_products')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'campaign_products'
        constraints = [
            models.UniqueConstraint(fields=['campaign', 'product'], name='uq_campaign_products_campaign_product'),
        ]
