import math
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Case, Count, Exists, IntegerField, OuterRef, Subquery, When
from django.db.models.functions import Lower

from common.choices import Language

from .models import (
    Category, CategoryTranslation, Product, ProductCategory, ProductMedia,
    ProductTranslation, ProductVariant,
)

PAGE_DEFAULT = 1
LIMIT_DEFAULT = 12
LIMIT_MAX = 50
NEW_ARRIVALS_LIMIT = 4
SUGGESTIONS_LIMIT = 8
RECOMMENDATIONS_LIMIT_DEFAULT = 4
RECOMMENDATIONS_LIMIT_MAX = 20

SEARCH_SORTS = ('relevance', 'newest', 'price_asc', 'price_desc')
CATEGORY_SORTS = ('newest', 'price_asc', 'price_desc')


class CatalogError(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def parse_lang(raw):
    if not raw:
        return Language.EN
    value = raw.strip().upper()
    if value not in Language.values:
        raise CatalogError(400, 'INVALID_LANGUAGE', 'lang must be EN or TH')
    return value


def parse_positive_int(raw, default):
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return value if value >= 1 else default


def parse_page(raw):
    return parse_positive_int(raw, PAGE_DEFAULT)


def parse_limit(raw, default=LIMIT_DEFAULT):
    return min(parse_positive_int(raw, default), LIMIT_MAX)


def parse_sort(raw, allowed, default):
    value = (raw or '').strip().lower()
    return value if value in allowed else default


def parse_query_text(raw, message):
    value = (raw or '').strip()
    if not value:
        raise CatalogError(400, 'INVALID_QUERY', message)
    return value


def parse_recommendations_limit(raw):
    message = f'limit must be an integer between 1 and {RECOMMENDATIONS_LIMIT_MAX}'
    if raw is None or raw == '':
        return RECOMMENDATIONS_LIMIT_DEFAULT
    try:
        value = int(raw)
    except ValueError:
        raise CatalogError(400, 'INVALID_QUERY', message)
    if not 1 <= value <= RECOMMENDATIONS_LIMIT_MAX:
        raise CatalogError(400, 'INVALID_QUERY', message)
    return value


def parse_optional_text(raw, name):
    if raw is None or raw == '':
        return None
    value = raw.strip().lower()
    if not value:
        raise CatalogError(400, 'INVALID_QUERY', f'{name} must be a non-empty string')
    return value


def parse_exclude_ids(raw):
    if not raw:
        return []
    ids = []
    for token in (part.strip() for part in raw.split(',')):
        if not token:
            continue
        if not token.isdigit() or int(token) <= 0:
            raise CatalogError(
                400, 'INVALID_EXCLUDE_PRODUCT_IDS',
                'excludeProductIds must be a comma-separated list of positive integers',
            )
        if int(token) not in ids:
            ids.append(int(token))
    return ids


def visible_categories(order='asc'):
    name = 'category_name' if order == 'asc' else '-category_name'
    return Category.objects.filter(is_hidden=False).order_by(name, 'category_id')


def get_visible_category(slug, lang):
    category = Category.objects.filter(is_hidden=False, slug__iexact=slug.strip()).first()
    if category is None:
        raise CatalogError(404, 'CATEGORY_NOT_FOUND', f'category {slug} was not found')
    names = localized_category_names({category.pk: category.category_name}, lang)
    return {'categoryId': category.pk, 'slug': category.slug, 'name': names[category.pk]}


def localized_category_names(fallbacks, lang):
    """fallbacks maps category id to its base name; returns the best name per id."""
    names = dict(fallbacks)
    rows = CategoryTranslation.objects.filter(
        category_id__in=fallbacks.keys(), language_code__in=[lang, Language.EN],
    )
    found = {}
    for row in rows:
        # requested language wins over EN
        if row.category_id not in found or row.language_code == lang:
            found[row.category_id] = row.name
    names.update(found)
    return names


def storefront_products(lang):
    """Active products that have a name, an image and at least one active variant."""
    translation = ProductTranslation.objects.filter(product=OuterRef('pk')).annotate(
        lang_rank=Case(
            When(language_code=lang, then=0),
            When(language_code=Language.EN, then=1),
            default=2,
            output_field=IntegerField(),
        ),
    ).order_by('lang_rank', 'pk')
    media = ProductMedia.objects.filter(product=OuterRef('pk')).exclude(
        public_url__regex=r'^\s*$',
    ).annotate(
        media_rank=Case(
            When(is_hero=True, then=0),
            When(is_thumbnail=True, then=1),
            default=2,
            output_field=IntegerField(),
        ),
    ).order_by('media_rank', 'sort_order', 'pk')
    variants = ProductVariant.objects.filter(product=OuterRef('pk'), is_active=True)
    cheapest = variants.order_by('price', 'pk')

    return Product.objects.filter(is_active=True).filter(
        Exists(translation), Exists(media), Exists(variants),
    ).annotate(
        name=Subquery(translation.values('name')[:1]),
        detail=Subquery(translation.values('description')[:1]),
        image=Subquery(media.values('public_url')[:1]),
        price=Subquery(cheapest.values('price')[:1]),
        compare_at_price=Subquery(cheapest.values('compare_at_price')[:1]),
        in_stock=Exists(variants.filter(stock_qty__gt=0)),
    )


def in_category(slug):
    return Exists(ProductCategory.objects.filter(
        product=OuterRef('pk'), category__is_hidden=False, category__slug__iexact=slug.strip(),
    ))


def matches_name(text):
    return Exists(ProductTranslation.objects.filter(product=OuterRef('pk'), name__icontains=text))


def order_products(queryset, sort, query_text=None):
    if sort == 'price_asc':
        return queryset.order_by('price', '-created_at', '-pk')
    if sort == 'price_desc':
        return queryset.order_by('-price', '-created_at', '-pk')
    if sort == 'relevance' and query_text:
        text = query_text.lower()
        queryset = queryset.annotate(relevance_rank=Case(
            When(name_lower=text, then=0),
            When(name_lower__startswith=text, then=1),
            default=2,
            output_field=IntegerField(),
        ))
        return queryset.order_by('relevance_rank', '-created_at', '-pk')
    return queryset.order_by('-created_at', '-pk')


def with_lower_name(queryset):
    return queryset.annotate(name_lower=Lower('name'))


def paginate(queryset, page, limit):
    total = queryset.count()
    offset = (page - 1) * limit
    rows = list(queryset[offset:offset + limit])
    pagination = {
        'page': page,
        'limit': limit,
        'totalItems': total,
        'totalPages': math.ceil(total / limit) if total else 0,
    }
    return rows, pagination


def discount_for(price, original):
    if original is None or price <= 0 or original <= price:
        return None
    percent = ((original - price) / original * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    if percent <= 0:
        return None
    return {'type': 'percentage', 'value': int(percent)}


def distinct_options(values):
    seen = {}
    for value in values:
        cleaned = (value or '').strip()
        if cleaned and cleaned.upper() not in seen:
            seen[cleaned.upper()] = cleaned
    return [seen[key] for key in sorted(seen)]


def variant_options(product_ids):
    colours = {pid: [] for pid in product_ids}
    sizes = {pid: [] for pid in product_ids}
    rows = ProductVariant.objects.filter(product_id__in=product_ids, is_active=True)
    for product_id, colour, size in rows.values_list('product_id', 'colour', 'size'):
        colours[product_id].append(colour)
        sizes[product_id].append(size)
    return colours, sizes


def primary_categories(product_ids, lang):
    rows = ProductCategory.objects.filter(
        product_id__in=product_ids, category__is_hidden=False,
    ).select_related('category').order_by('-is_primary', 'pk')
    chosen = {}
    for row in rows:
        chosen.setdefault(row.product_id, row.category)
    names = localized_category_names(
        {category.pk: category.category_name for category in chosen.values()}, lang,
    )
    return {
        product_id: {'categoryId': category.pk, 'slug': category.slug, 'name': names[category.pk]}
        for product_id, category in chosen.items()
    }


def build_cards(products, lang, include_category=True):
    ids = [product.pk for product in products]
    colours, sizes = variant_options(ids)
    categories = primary_categories(ids, lang) if include_category else {}

    cards = []
    for product in products:
        price = product.price
        original = product.compare_at_price
        if original is not None and original <= price:
            original = None
        card = {
            'productId': product.pk,
            'name': product.name,
            'detail': product.detail,
            'color': distinct_options(colours[product.pk]),
            'price': float(price),
            'originalPrice': float(original) if original is not None else None,
            'discount': discount_for(price, original),
            'size': distinct_options(sizes[product.pk]),
            'image': product.image.strip(),
            'inStock': product.in_stock,
        }
        if include_category:
            card['category'] = categories.get(product.pk)
        cards.append(card)
    return cards


def list_products(lang, page, limit):
    queryset = storefront_products(lang).order_by('-created_at', '-pk')
    rows, pagination = paginate(queryset, page, limit)
    return {'pagination': pagination, 'products': build_cards(rows, lang, include_category=False)}


def new_arrivals(lang):
    rows = list(storefront_products(lang).order_by('-created_at', '-pk')[:NEW_ARRIVALS_LIMIT])
    return build_cards(rows, lang, include_category=False)


def products_in_category(slug, lang, page, limit, sort):
    category = get_visible_category(slug, lang)
    queryset = order_products(storefront_products(lang).filter(in_category(slug)), sort)
    rows, pagination = paginate(queryset, page, limit)
    return {
        'category': category,
        'pagination': pagination,
        'products': build_cards(rows, lang, include_category=False),
    }


def search_products(query_text, lang, page, limit, sort):
    matching = storefront_products(lang).filter(matches_name(query_text))
    queryset = order_products(with_lower_name(matching), sort, query_text)
    rows, pagination = paginate(queryset, page, limit)
    return {
        'query': query_text,
        'category': None,
        'categoryCounts': category_counts(matching, lang),
        'pagination': pagination,
        'products': build_cards(rows, lang),
    }


def category_counts(products, lang):
    """How many of the matching products sit in each visible category."""
    rows = ProductCategory.objects.filter(
        product__in=products.values('pk'), category__is_hidden=False,
    ).values('category_id', 'category__slug', 'category__category_name').annotate(
        count=Count('product', distinct=True),
    ).order_by('category__category_name', 'category_id')
    rows = list(rows)
    names = localized_category_names(
        {row['category_id']: row['category__category_name'] for row in rows}, lang,
    )
    return [
        {
            'categoryId': row['category_id'],
            'slug': row['category__slug'],
            'name': names[row['category_id']],
            'count': row['count'],
        }
        for row in rows
    ]


def search_suggestions(query_text, lang):
    matching = with_lower_name(storefront_products(lang).filter(matches_name(query_text)))
    rows = list(order_products(matching, 'relevance', query_text)[:SUGGESTIONS_LIMIT])
    return build_cards(rows, lang, include_category=False)


def recommendations(lang, limit, category_slug, excluded):
    chosen = []
    taken = set(excluded)

    def fill(queryset):
        needed = limit - len(chosen)
        if needed <= 0:
            return
        rows = list(queryset.exclude(pk__in=taken).order_by('-created_at', '-pk')[:needed])
        taken.update(row.pk for row in rows)
        chosen.extend(rows)

    base = storefront_products(lang)
    if category_slug:
        fill(base.filter(in_category(category_slug)))
    fill(base)
    return build_cards(chosen, lang, include_category=False)
