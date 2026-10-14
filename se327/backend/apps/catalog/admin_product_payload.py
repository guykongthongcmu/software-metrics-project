import json
import re
from decimal import Decimal

from common.choices import Language

from .admin_base import ID_MAX, AdminError, is_encodable
from .models import Product

MAX_IMAGES = 4
INT_MAX = 2**31 - 1
MONEY = re.compile(r'\d{1,8}(\.\d{1,2})?', re.ASCII)
STATUSES = ('ACTIVE', 'INACTIVE')


def validation_error(errors):
    return AdminError(400, 'VALIDATION_ERROR', 'request validation failed', errors)


def clean_text(value, max_len, required=True):
    """Return the trimmed string, or None when it is not acceptable."""
    if not isinstance(value, str) or '\x00' in value or not is_encodable(value):
        return None
    value = value.strip()
    if len(value) > max_len or (required and not value):
        return None
    return value


def parse_money(value):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    text = value.strip() if isinstance(value, str) else str(value)
    if not MONEY.fullmatch(text):
        return None
    return Decimal(text)


def parse_int(value, low, high):
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        return None
    return value


def parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lower() in ('true', 'false'):
        return value.strip().lower() == 'true'
    return None


def parse_active(fields, errors, default=None):
    """Read status or isActive. Returns the boolean, or default when neither is sent."""
    if fields.get('status') is not None:
        status = fields['status'].strip().upper() if isinstance(fields['status'], str) else None
        if status not in STATUSES:
            errors['status'] = 'status must be ACTIVE or INACTIVE'
            return default
        return status == 'ACTIVE'
    if fields.get('isActive') is not None:
        flag = parse_bool(fields['isActive'])
        if flag is None:
            errors['isActive'] = 'isActive must be true or false'
            return default
        return flag
    return default


def load_json_field(raw, name):
    if not isinstance(raw, str):
        return raw
    try:
        return json.loads(raw)
    except (ValueError, RecursionError):
        raise AdminError(400, 'INVALID_JSON', f'{name} is not valid JSON')


def read_fields(request):
    """Text fields of a create request, from multipart parts, one payload field or a JSON body."""
    is_form = (request.content_type or '').startswith('multipart/')
    fields = request.POST if is_form else request.data
    if not isinstance(fields, dict):
        raise AdminError(400, 'INVALID_JSON', 'request body must be a JSON object')
    if 'payload' in fields:
        payload = load_json_field(fields['payload'], 'payload')
        if not isinstance(payload, dict):
            raise AdminError(400, 'INVALID_JSON', 'payload must be a JSON object')
        return payload
    return fields


def list_field(fields, name, errors):
    value = load_json_field(fields.get(name), name)
    if not isinstance(value, list) or not value or not all(isinstance(item, dict) for item in value):
        errors[name] = f'{name} must be a non-empty list of objects'
        return []
    return value


def parse_translation(item, index, parsed, errors):
    code = item.get('languageCode')
    code = code.strip().upper() if isinstance(code, str) else None
    if code not in Language.values or code in parsed:
        errors[f'translations[{index}].languageCode'] = 'each of EN and TH must appear exactly once'
        return None
    name = clean_text(item.get('name'), 150)
    description = item.get('description')
    if name is None:
        errors[f'translations[{index}].name'] = 'name is required, up to 150 characters'
    if description is not None:
        description = clean_text(description, 10_000, required=False)
        if description is None:
            errors[f'translations[{index}].description'] = 'description must be text'
    return {'languageCode': code, 'name': name, 'description': description or None}


def parse_translations(fields, errors):
    parsed = {}
    for index, item in enumerate(list_field(fields, 'translations', errors)):
        row = parse_translation(item, index, parsed, errors)
        if row is not None:
            parsed[row['languageCode']] = row
    if 'translations' not in errors and set(parsed) != set(Language.values):
        errors['translations'] = 'exactly one EN and one TH translation are required'
    return list(parsed.values())


def parse_categories(fields, errors):
    parsed = []
    for index, item in enumerate(list_field(fields, 'categories', errors)):
        category_id = parse_int(item.get('categoryId'), 1, ID_MAX - 1)
        is_primary = parse_bool(item.get('isPrimary', False))
        if category_id is None or is_primary is None:
            errors[f'categories[{index}]'] = 'categoryId must be a positive integer and isPrimary a boolean'
        elif category_id in [row['categoryId'] for row in parsed]:
            errors[f'categories[{index}].categoryId'] = 'category is repeated'
        else:
            parsed.append({'categoryId': category_id, 'isPrimary': is_primary})
    if 'categories' not in errors and sum(row['isPrimary'] for row in parsed) != 1:
        errors['categories'] = 'exactly one category must be primary'
    return parsed


def parse_variant(item, index, errors):
    where = f'variants[{index}]'
    variant = {
        'sku': clean_text(item.get('sku'), 100),
        'colour': clean_text(item.get('colour'), 100),
        'size': clean_text(item.get('size'), 20),
        'price': parse_money(item.get('price')),
        'compareAtPrice': None,
        'stockQty': parse_int(item.get('stockQty'), 0, INT_MAX),
        'isActive': parse_bool(item.get('isActive', True)),
    }
    for key, message in (
        ('sku', 'sku is required, up to 100 characters'),
        ('colour', 'colour is required, up to 100 characters'),
        ('size', 'size is required, up to 20 characters'),
        ('stockQty', 'stockQty must be an integer of 0 or more'),
        ('isActive', 'isActive must be true or false'),
    ):
        if variant[key] is None:
            errors[f'{where}.{key}'] = message
    if variant['price'] is None or variant['price'] <= 0:
        errors[f'{where}.price'] = 'price must be a number above 0 with at most 2 decimals'
    if item.get('compareAtPrice') is not None:
        compare = parse_money(item['compareAtPrice'])
        if compare is None or (variant['price'] is not None and compare < variant['price']):
            errors[f'{where}.compareAtPrice'] = 'compareAtPrice must be a number not below price'
        variant['compareAtPrice'] = compare
    return variant


def parse_variants(fields, errors):
    parsed = []
    skus, pairs = set(), set()
    for index, item in enumerate(list_field(fields, 'variants', errors)):
        variant = parse_variant(item, index, errors)
        if variant['sku'] is not None:
            if variant['sku'].lower() in skus:
                errors[f'variants[{index}].sku'] = 'sku is repeated'
            skus.add(variant['sku'].lower())
        if variant['colour'] is not None and variant['size'] is not None:
            pair = (variant['colour'], variant['size'])
            if pair in pairs:
                errors[f'variants[{index}]'] = 'colour and size pair is repeated'
            pairs.add(pair)
        parsed.append(variant)
    return parsed


def parse_media_row(item, index, errors):
    row = {
        'sortOrder': parse_int(item.get('sortOrder'), 1, MAX_IMAGES),
        'isThumbnail': parse_bool(item.get('isThumbnail', False)),
        'isHero': parse_bool(item.get('isHero', False)),
        'altText': item.get('altText'),
    }
    if row['altText'] is not None:
        row['altText'] = clean_text(row['altText'], 255, required=False)
        if row['altText'] is None:
            errors[f'media[{index}].altText'] = 'altText must be text up to 255 characters'
    if row['sortOrder'] is None or row['isThumbnail'] is None or row['isHero'] is None:
        errors[f'media[{index}]'] = 'sortOrder must be 1 to 4, isThumbnail and isHero booleans'
    return row


def check_media_set(parsed, errors):
    orders = [row['sortOrder'] for row in parsed]
    if len(set(orders)) != len(orders):
        errors['media'] = 'sortOrder values must be unique'
    elif sum(row['isThumbnail'] for row in parsed) != 1 or sum(row['isHero'] for row in parsed) != 1:
        errors['media'] = 'exactly one image must be the thumbnail and one the hero'


def parse_media(fields, file_count, errors):
    if not 1 <= file_count <= MAX_IMAGES:
        errors['media'] = f'between 1 and {MAX_IMAGES} images are required'
        return []
    items = list_field(fields, 'media', errors)
    if 'media' not in errors and len(items) != file_count:
        errors['media'] = 'send one media entry for every uploaded file'
        return []
    parsed = [parse_media_row(item, index, errors) for index, item in enumerate(items)]
    if 'media' not in errors and not any(key.startswith('media[') for key in errors):
        check_media_set(parsed, errors)
    return parsed


def parse_create(fields, file_count):
    """Validate every create rule at once and return the clean product data."""
    errors = {}
    product_type = fields.get('productType')
    product_type = product_type.strip().upper() if isinstance(product_type, str) else None
    if product_type not in Product.ProductType.values:
        errors['productType'] = 'productType must be TOP, BOTTOM or ACCESSORY'
    is_active = parse_active(fields, errors, default=True)
    data = {
        'productType': product_type,
        'isActive': is_active,
        'translations': parse_translations(fields, errors),
        'categories': parse_categories(fields, errors),
        'variants': parse_variants(fields, errors),
        'media': parse_media(fields, file_count, errors),
    }
    if errors:
        raise validation_error(errors)
    return data


UPDATE_KEYS = (
    'name', 'description', 'status', 'isActive', 'category_id', 'categoryId',
    'price', 'compare_at_price', 'compareAtPrice', 'stock',
)


def update_name(body, data, errors):
    if 'name' in body:
        data['name'] = clean_text(body['name'], 150)
        if data['name'] is None:
            errors['name'] = 'name is required, up to 150 characters'


def update_description(body, data, errors):
    if 'description' in body:
        text = body['description']
        data['description'] = None if text is None else clean_text(text, 10_000, required=False)
        if text is not None and data['description'] is None:
            errors['description'] = 'description must be text or null'
        elif data['description'] == '':
            data['description'] = None


def update_category(body, data, errors):
    for key in ('category_id', 'categoryId'):
        if key in body:
            data['categoryId'] = parse_int(body[key], 1, ID_MAX - 1)
            if data['categoryId'] is None:
                errors[key] = 'category_id must be a positive integer'


def update_price(body, data, errors):
    if 'price' in body:
        data['price'] = parse_money(body['price'])
        if data['price'] is None or data['price'] <= 0:
            errors['price'] = 'price must be a number above 0 with at most 2 decimals'


def update_compare_at_price(body, data, errors):
    for key in ('compare_at_price', 'compareAtPrice'):
        if key in body:
            compare = body[key]
            data['compareAtPrice'] = None if compare is None else parse_money(compare)
            if compare is not None and data['compareAtPrice'] is None:
                errors[key] = 'compare_at_price must be a number or null'


def update_stock(body, data, errors):
    if 'stock' in body:
        data['stock'] = parse_int(body['stock'], 0, INT_MAX)
        if data['stock'] is None:
            errors['stock'] = 'stock must be an integer of 0 or more'


def update_sku(body, data, errors):
    if body.get('sku') is not None:
        data['sku'] = clean_text(body['sku'], 100)
        if data['sku'] is None:
            errors['sku'] = 'sku must be text up to 100 characters'


def parse_update(body):
    """Validate the subset of fields sent on update."""
    if not isinstance(body, dict):
        raise validation_error({'body': 'request body must be a JSON object'})
    errors = {}
    present = [key for key in UPDATE_KEYS if key in body]
    if not present:
        raise validation_error({'body': 'send at least one field to change'})
    data = {}
    update_name(body, data, errors)
    update_description(body, data, errors)
    active = parse_active(body, errors)
    if active is not None:
        data['isActive'] = active
    update_category(body, data, errors)
    update_price(body, data, errors)
    update_compare_at_price(body, data, errors)
    update_stock(body, data, errors)
    update_sku(body, data, errors)
    if errors:
        raise validation_error(errors)
    return data
