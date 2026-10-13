from apps.catalog.storefront import CatalogError, build_cards, storefront_products

from .models import Wishlist


def parse_product_id(raw):
    if not raw.isdecimal() or not 0 < int(raw) < 2**63:
        raise CatalogError(400, 'INVALID_PRODUCT_ID', 'productId must be a positive integer')
    return int(raw)


def visible_product(product_id, lang):
    product = storefront_products(lang).filter(pk=product_id).first()
    if product is None:
        raise CatalogError(404, 'PRODUCT_NOT_FOUND', f'product with id {product_id} was not found')
    return product


def favourite_products(user, lang):
    """The customer's visible favourites, newest favourite first."""
    rows = Wishlist.objects.filter(user=user).order_by('-created_at', '-pk')
    ids = list(rows.values_list('product_id', flat=True))
    found = {product.pk: product for product in storefront_products(lang).filter(pk__in=ids)}
    return [found[pid] for pid in ids if pid in found]


def list_favourites(user, lang):
    products = favourite_products(user, lang)
    return {'favoritesCount': len(products), 'products': build_cards(products, lang, include_category=False)}


def add_favourite(user, product_id, lang):
    product = visible_product(product_id, lang)
    Wishlist.objects.get_or_create(user=user, product_id=product.pk)
    return {
        'productId': product.pk,
        'isFavorite': True,
        'favoritesCount': len(favourite_products(user, lang)),
        'product': build_cards([product], lang, include_category=False)[0],
    }


def remove_favourite(user, product_id, lang):
    product = visible_product(product_id, lang)
    Wishlist.objects.filter(user=user, product_id=product.pk).delete()
    return {
        'productId': product.pk,
        'isFavorite': False,
        'favoritesCount': len(favourite_products(user, lang)),
    }
