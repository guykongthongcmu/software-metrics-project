from django.db import IntegrityError, transaction
from django.db.models import Count, Exists, Min, OuterRef, Q, Sum
from django.db.models.functions import Coalesce, Lower

from common import storage
from common.choices import Language

from . import storefront
from .admin_base import AdminError, parse_id
from .admin_product_payload import parse_create, parse_update, validation_error
from .models import (
    Category, Product, ProductCategory, ProductMedia, ProductTranslation, ProductVariant,
)

LIST_LIMIT_DEFAULT = 20
LIST_LIMIT_MAX = 100
SEARCH_MAX = 150
MEDIA_FOLDER = 'products'


def parse_product_id(raw):
    return parse_id(raw, 'INVALID_PRODUCT_ID', 'productId must be a positive integer')


def get_product(product_id, for_update=False):
    queryset = Product.objects.select_for_update() if for_update else Product.objects
    product = queryset.filter(pk=product_id).first()
    if product is None:
        raise AdminError(404, 'PRODUCT_NOT_FOUND', f'product {product_id} was not found')
    return product


def money(value):
    return float(value) if value is not None else None


def stamp(value):
    return value.isoformat()


def serialize_media(media):
    return {
        'productMediaId': media.pk,
        'productId': media.product_id,
        'bucketName': media.bucket_name,
        'filePath': media.file_path,
        'publicUrl': media.public_url,
        'altText': media.alt_text,
        'sortOrder': media.sort_order,
        'isThumbnail': media.is_thumbnail,
        'isHero': media.is_hero,
        'createdAt': stamp(media.created_at),
    }


def pick_translation(rows, lang):
    by_code = {row.language_code: row for row in rows}
    return by_code.get(lang) or by_code.get(Language.EN) or (rows[0] if rows else None)


def status_of(product):
    return 'ACTIVE' if product.is_active else 'INACTIVE'


def list_media(product_id):
    get_product(product_id)
    rows = ProductMedia.objects.filter(product_id=product_id).order_by('sort_order', 'pk')
    return [serialize_media(row) for row in rows]


def serialize_detail(product, lang):
    translations = list(product.translations.order_by('pk'))
    chosen = pick_translation(translations, lang)
    links = list(product.product_categories.select_related('category').order_by('-is_primary', 'pk'))
    names = storefront.localized_category_names(
        {link.category_id: link.category.category_name for link in links}, lang,
    )
    return {
        'productId': product.pk,
        'productType': product.product_type,
        'isActive': product.is_active,
        'status': status_of(product),
        'languageCode': chosen.language_code if chosen else None,
        'name': chosen.name if chosen else None,
        'description': chosen.description if chosen else None,
        'translations': [
            {
                'productTranslationId': row.pk,
                'languageCode': row.language_code,
                'name': row.name,
                'description': row.description,
                'createdAt': stamp(row.created_at),
                'updatedAt': stamp(row.updated_at),
            }
            for row in translations
        ],
        'categories': [
            {
                'categoryId': link.category_id,
                'name': names[link.category_id],
                'slug': link.category.slug,
                'isPrimary': link.is_primary,
            }
            for link in links
        ],
        'variants': [
            {
                'productVariantId': variant.pk,
                'sku': variant.sku_code,
                'colour': variant.colour,
                'size': variant.size,
                'price': money(variant.price),
                'compareAtPrice': money(variant.compare_at_price),
                'stockQty': variant.stock_qty,
                'isActive': variant.is_active,
                'createdAt': stamp(variant.created_at),
                'updatedAt': stamp(variant.updated_at),
            }
            for variant in product.variants.order_by('pk')
        ],
        'media': [serialize_media(row) for row in product.media.order_by('sort_order', 'pk')],
        'createdAt': stamp(product.created_at),
        'updatedAt': stamp(product.updated_at),
    }


def get_detail(product_id, lang):
    return serialize_detail(get_product(product_id), lang)


def parse_search(raw):
    text = (raw or '').strip()
    if '\x00' in text or len(text) > SEARCH_MAX:
        raise AdminError(400, 'INVALID_QUERY', f'search must be text up to {SEARCH_MAX} characters')
    return text


def category_filter(raw):
    category_id = parse_id(raw, 'INVALID_QUERY', 'category must be a positive integer')
    ids = [category_id, *Category.objects.filter(parent_id=category_id).values_list('pk', flat=True)]
    return Exists(ProductCategory.objects.filter(product=OuterRef('pk'), category_id__in=ids))


def summary_categories(product_ids, lang):
    """Primary category and its root, per product, loaded in one go."""
    rows = ProductCategory.objects.filter(product_id__in=product_ids).select_related(
        'category', 'category__parent',
    ).order_by('-is_primary', 'pk')
    chosen = {}
    for row in rows:
        chosen.setdefault(row.product_id, row.category)
    wanted = {}
    for category in chosen.values():
        root = category.parent or category
        wanted[category.pk] = category.category_name
        wanted[root.pk] = root.category_name
    names = storefront.localized_category_names(wanted, lang)
    result = {}
    for product_id, category in chosen.items():
        root = category.parent or category
        result[product_id] = (category.pk, names[category.pk], root.pk, names[root.pk])
    return result


def list_products(params):
    lang = storefront.parse_lang(params.get('lang'))
    page = storefront.parse_page(params.get('page'))
    limit = min(storefront.parse_positive_int(params.get('limit'), LIST_LIMIT_DEFAULT), LIST_LIMIT_MAX)

    queryset = Product.objects.all()
    search = parse_search(params.get('search'))
    if search:
        queryset = queryset.filter(storefront.matches_name(search))
    if params.get('category'):
        queryset = queryset.filter(category_filter(params['category'].strip()))
    active = Q(variants__is_active=True)
    queryset = queryset.annotate(
        price_from=Min('variants__price', filter=active),
        compare_at_from=Min('variants__compare_at_price', filter=active),
        total_stock=Coalesce(Sum('variants__stock_qty', filter=active), 0),
        variant_count=Count('variants', filter=active),
    ).order_by('-created_at', '-pk')

    rows, pagination = storefront.paginate(queryset, page, limit)
    ids = [row.pk for row in rows]
    translations = {}
    for translation in ProductTranslation.objects.filter(product_id__in=ids).order_by('pk'):
        translations.setdefault(translation.product_id, []).append(translation)
    thumbnails = {}
    for media in ProductMedia.objects.filter(product_id__in=ids).order_by('-is_thumbnail', 'sort_order', 'pk'):
        thumbnails.setdefault(media.product_id, media)
    categories = summary_categories(ids, lang)

    items = []
    for product in rows:
        chosen = pick_translation(translations.get(product.pk, []), lang)
        category = categories.get(product.pk, (None, None, None, None))
        thumbnail = thumbnails.get(product.pk)
        items.append({
            'productId': product.pk,
            'productType': product.product_type,
            'isActive': product.is_active,
            'status': status_of(product),
            'languageCode': chosen.language_code if chosen else None,
            'name': chosen.name if chosen else None,
            'description': chosen.description if chosen else None,
            'primaryCategoryId': category[0],
            'primaryCategoryName': category[1],
            'rootCategoryId': category[2],
            'rootCategoryName': category[3],
            'thumbnailUrl': thumbnail.public_url if thumbnail else None,
            'thumbnailAlt': thumbnail.alt_text if thumbnail else None,
            'priceFrom': money(product.price_from),
            'compareAtPriceFrom': money(product.compare_at_from),
            'totalStock': product.total_stock,
            'variantCount': product.variant_count,
            'createdAt': stamp(product.created_at),
            'updatedAt': stamp(product.updated_at),
        })
    return {**pagination, 'items': items}


def taken_skus(skus):
    lowered = [sku.lower() for sku in skus]
    rows = ProductVariant.objects.annotate(sku_lower=Lower('sku_code')).filter(sku_lower__in=lowered)
    return list(rows.values_list('sku_code', flat=True))


def integrity_to_error(exc):
    """Turn a unique violation from a race into the matching 409, or hand the error back."""
    constraint = getattr(getattr(exc.__cause__, 'diag', None), 'constraint_name', None)
    if constraint == 'uq_variant_sku_ci':
        return AdminError(409, 'DUPLICATE_SKU', 'a sku is already in use')
    if constraint == 'uq_product_colour_size':
        return AdminError(409, 'DUPLICATE_VARIANT', 'colour and size pair is already used')
    return exc


def check_references(data):
    wanted = {row['categoryId'] for row in data['categories']}
    missing = wanted - set(Category.objects.filter(pk__in=wanted).values_list('pk', flat=True))
    if missing:
        raise validation_error({'categories': f'unknown category ids: {sorted(missing)}'})
    if taken_skus([row['sku'] for row in data['variants']]):
        raise AdminError(409, 'DUPLICATE_SKU', 'a sku is already in use')


def create_product(fields, uploads):
    """Save a product with everything attached or nothing at all, files included."""
    data = parse_create(fields, len(uploads))
    for upload in uploads:
        storage.check_image(upload)
    check_references(data)

    saved = []
    try:
        with transaction.atomic():
            product = Product.objects.create(product_type=data['productType'], is_active=data['isActive'])
            ProductTranslation.objects.bulk_create([
                ProductTranslation(
                    product=product, language_code=row['languageCode'],
                    name=row['name'], description=row['description'],
                )
                for row in data['translations']
            ])
            ProductCategory.objects.bulk_create([
                ProductCategory(product=product, category_id=row['categoryId'], is_primary=row['isPrimary'])
                for row in data['categories']
            ])
            ProductVariant.objects.bulk_create([
                ProductVariant(
                    product=product, sku_code=row['sku'], colour=row['colour'], size=row['size'],
                    price=row['price'], compare_at_price=row['compareAtPrice'],
                    stock_qty=row['stockQty'], is_active=row['isActive'],
                )
                for row in data['variants']
            ])
            for meta, upload in zip(data['media'], uploads):
                stored = storage.save_image(upload, MEDIA_FOLDER)
                saved.append(stored.file_path)
                ProductMedia.objects.create(
                    product=product, bucket_name=stored.bucket_name, file_path=stored.file_path,
                    public_url=stored.public_url, alt_text=meta['altText'] or None,
                    sort_order=meta['sortOrder'], is_thumbnail=meta['isThumbnail'], is_hero=meta['isHero'],
                )
    except storage.StorageError as exc:
        storage.delete_files(saved)
        raise AdminError(500, 'STORAGE_UPLOAD_FAILED', 'could not store the uploaded image') from exc
    except IntegrityError as exc:
        storage.delete_files(saved)
        raise integrity_to_error(exc) from exc
    except Exception:
        storage.delete_files(saved)
        raise
    return {'productId': product.pk}


def apply_variant_changes(product, data):
    changes = {key: data[key] for key in ('price', 'compareAtPrice', 'stock') if key in data}
    if not changes:
        return
    variants = list(product.variants.select_for_update().order_by('pk'))
    if 'sku' in data:
        matching = [variant for variant in variants if variant.sku_code.lower() == data['sku'].lower()]
        variant = matching[0] if matching else None
    else:
        variant = variants[0] if len(variants) == 1 else None
    if variant is None:
        raise validation_error({'sku': 'name the sku of the variant to change'})

    price = changes.get('price', variant.price)
    compare = changes['compareAtPrice'] if 'compareAtPrice' in changes else variant.compare_at_price
    if compare is not None and compare < price:
        raise validation_error({'compare_at_price': 'compare_at_price must not be below price'})
    variant.price = price
    variant.compare_at_price = compare
    if 'stock' in changes:
        variant.stock_qty = changes['stock']
    variant.save()


def apply_translation_changes(product, data, lang):
    if 'name' not in data and 'description' not in data:
        return
    translation = product.translations.filter(language_code=lang).first()
    if translation is None:
        if 'name' not in data:
            raise validation_error({'name': f'name is required to add the {lang} translation'})
        translation = ProductTranslation(product=product, language_code=lang)
    if 'name' in data:
        translation.name = data['name']
    if 'description' in data:
        translation.description = data['description']
    translation.save()


def make_primary(product, category_id):
    if not Category.objects.filter(pk=category_id).exists():
        raise validation_error({'category_id': 'category does not exist'})
    # demote first so the one-primary index is never hit
    ProductCategory.objects.filter(product=product, is_primary=True).update(is_primary=False)
    ProductCategory.objects.update_or_create(
        product=product, category_id=category_id, defaults={'is_primary': True},
    )


def update_product(product_id, body):
    data = parse_update(body)
    raw_lang = body.get('lang')
    if raw_lang is not None and not isinstance(raw_lang, str):
        raise storefront.CatalogError(400, 'INVALID_LANGUAGE', 'lang must be EN or TH')
    lang = storefront.parse_lang(raw_lang)

    with transaction.atomic():
        product = get_product(product_id, for_update=True)
        if 'isActive' in data:
            product.is_active = data['isActive']
        product.save(update_fields=['is_active', 'updated_at'])
        apply_translation_changes(product, data, lang)
        if 'categoryId' in data:
            make_primary(product, data['categoryId'])
        apply_variant_changes(product, data)
    return get_detail(product_id, lang)


def delete_product(product_id, params):
    mode = (params.get('mode') or 'SOFT').strip().upper()
    if mode not in ('SOFT', 'HARD'):
        raise AdminError(400, 'INVALID_QUERY', 'mode must be SOFT or HARD')
    with transaction.atomic():
        product = get_product(product_id, for_update=True)
        if mode == 'SOFT':
            product.is_active = False
            product.save(update_fields=['is_active', 'updated_at'])
            product.variants.update(is_active=False)
        else:
            # order items keep their snapshots, their variant link just becomes null
            paths = list(product.media.filter(bucket_name=storage.BUCKET).values_list('file_path', flat=True))
            product.delete()
            transaction.on_commit(lambda: storage.delete_files(paths))
    return {'productId': product_id, 'deleted': True, 'mode': mode}
