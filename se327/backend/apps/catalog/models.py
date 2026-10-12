from django.db import models
from django.db.models import F, Q
from django.db.models.functions import Lower

from common.choices import Language


class Category(models.Model):
    category_id = models.BigAutoField(primary_key=True)
    parent = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='parent_category_id', related_name='children',
    )
    category_name = models.CharField(max_length=100)
    slug = models.CharField(max_length=255)
    is_hidden = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'category'
        constraints = [models.UniqueConstraint(Lower('slug'), name='uq_category_slug_ci')]
        indexes = [
            models.Index(fields=['parent', 'category_name'], name='idx_category_parent_name'),
            models.Index(fields=['is_hidden', 'category_name'], name='idx_category_hidden_name'),
        ]


class CategoryTranslation(models.Model):
    category_translation_id = models.BigAutoField(primary_key=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, db_column='category_id', related_name='translations')
    language_code = models.CharField(max_length=2, choices=Language.choices)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'category_translation'
        constraints = [
            models.UniqueConstraint(fields=['category', 'language_code'], name='uq_category_language'),
        ]
        indexes = [models.Index(fields=['language_code', 'name'], name='idx_cat_tr_language_name')]


class Product(models.Model):
    class ProductType(models.TextChoices):
        TOP = 'TOP'
        BOTTOM = 'BOTTOM'
        ACCESSORY = 'ACCESSORY'

    class DiscountType(models.TextChoices):
        PERCENTAGE = 'PERCENTAGE'
        FIXED = 'FIXED'

    product_id = models.BigAutoField(primary_key=True)
    product_type = models.CharField(max_length=10, choices=ProductType.choices)
    is_active = models.BooleanField(default=True)
    campaign_discount_type = models.CharField(max_length=10, choices=DiscountType.choices, null=True, blank=True)
    campaign_discount_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    campaign_discount_start_date = models.DateField(null=True, blank=True)
    campaign_discount_end_date = models.DateField(null=True, blank=True)
    campaign_discount_campaign = models.ForeignKey(
        'campaigns.Campaign', null=True, blank=True, on_delete=models.SET_NULL,
        db_column='campaign_discount_campaign_id', related_name='discounted_products',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        indexes = [models.Index(fields=['created_at'], name='idx_product_created')]
        constraints = [
            models.CheckConstraint(
                name='chk_products_discount_value_positive',
                condition=Q(campaign_discount_value__isnull=True) | Q(campaign_discount_value__gt=0),
            ),
            models.CheckConstraint(
                name='chk_products_discount_dates',
                condition=(
                    Q(campaign_discount_start_date__isnull=True)
                    | Q(campaign_discount_end_date__isnull=True)
                    | Q(campaign_discount_start_date__lte=F('campaign_discount_end_date'))
                ),
            ),
        ]


class ProductTranslation(models.Model):
    product_translation_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='translations')
    language_code = models.CharField(max_length=2, choices=Language.choices)
    name = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_translation'
        constraints = [
            models.UniqueConstraint(fields=['product', 'language_code'], name='uq_product_language'),
        ]
        indexes = [models.Index(fields=['language_code', 'name'], name='idx_prod_tr_language_name')]


class ProductCategory(models.Model):
    product_category_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='product_categories')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, db_column='category_id', related_name='product_categories')
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = 'product_category'
        constraints = [
            models.UniqueConstraint(fields=['product', 'category'], name='uq_product_category'),
            models.UniqueConstraint(
                fields=['product'], condition=Q(is_primary=True),
                name='uq_product_primary_category',
            ),
        ]
        indexes = [models.Index(fields=['category'], name='idx_pc_category')]


class ProductVariant(models.Model):
    product_variant_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='variants')
    sku_code = models.CharField(max_length=100)
    colour = models.CharField(max_length=100)
    size = models.CharField(max_length=20)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    compare_at_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_qty = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_variant'
        constraints = [
            models.UniqueConstraint(Lower('sku_code'), name='uq_variant_sku_ci'),
            models.UniqueConstraint(fields=['product', 'colour', 'size'], name='uq_product_colour_size'),
            models.CheckConstraint(name='chk_variant_price_nonnegative', condition=Q(price__gte=0)),
        ]


class ProductMedia(models.Model):
    product_media_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='media')
    bucket_name = models.CharField(max_length=100)
    file_path = models.CharField(max_length=512)
    public_url = models.CharField(max_length=2048)
    alt_text = models.CharField(max_length=255, null=True, blank=True)
    sort_order = models.PositiveIntegerField()
    is_thumbnail = models.BooleanField(default=False)
    is_hero = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'product_media'
        constraints = [
            models.UniqueConstraint(fields=['product', 'sort_order'], name='uq_product_sort_order'),
            models.UniqueConstraint(
                fields=['product'], condition=Q(is_thumbnail=True),
                name='uq_product_one_thumbnail',
            ),
            models.UniqueConstraint(
                fields=['product'], condition=Q(is_hero=True),
                name='uq_product_one_hero',
            ),
            models.CheckConstraint(
                name='chk_product_media_sort_order',
                condition=Q(sort_order__gte=1, sort_order__lte=4),
            ),
        ]
