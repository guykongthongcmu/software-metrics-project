import hashlib
import re

from django.db import IntegrityError, transaction

from common.choices import Language

from .admin_base import AdminError, is_encodable, parse_id
from .models import Category, CategoryTranslation, ProductCategory

NAME_MAX = 100
SLUG_FALLBACK = 'category'


def slugify(name):
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    if slug:
        return slug
    # no latin letters or digits, so keep the slug stable and distinct per name
    digest = hashlib.sha1(name.lower().encode('utf-8')).hexdigest()[:8]
    return f'{SLUG_FALLBACK}-{digest}'


def parse_category_id(raw):
    return parse_id(raw, 'INVALID_CATEGORY_ID', 'categoryId must be a positive integer')


def clean_name(body):
    name = body.get('categoryName') if isinstance(body, dict) else None
    if not isinstance(name, str):
        raise AdminError(400, 'VALIDATION_ERROR', 'categoryName is required')
    name = name.strip()
    if not name or len(name) > NAME_MAX:
        raise AdminError(400, 'VALIDATION_ERROR', f'categoryName must be 1 to {NAME_MAX} characters')
    if '\x00' in name or not is_encodable(name):
        raise AdminError(400, 'VALIDATION_ERROR', 'categoryName contains invalid characters')
    return name


def serialize(category):
    return {
        'categoryId': category.pk,
        'categoryName': category.category_name,
        'slug': category.slug,
        'isHidden': category.is_hidden,
        'parentCategoryId': category.parent_id,
    }


def slug_conflict():
    return AdminError(409, 'CATEGORY_SLUG_CONFLICT', 'a category with this name already exists')


def get_category(category_id, for_update=False):
    queryset = Category.objects.select_for_update() if for_update else Category.objects
    category = queryset.filter(pk=category_id).first()
    if category is None:
        raise AdminError(404, 'CATEGORY_NOT_FOUND', f'category {category_id} was not found')
    return category


def list_categories(params):
    sort = (params.get('sort') or 'category_name').strip().lower()
    order = (params.get('order') or 'asc').strip().lower()
    if sort != 'category_name':
        raise AdminError(400, 'INVALID_QUERY', 'sort must be category_name')
    if order not in ('asc', 'desc'):
        raise AdminError(400, 'INVALID_QUERY', 'order must be asc or desc')
    name = 'category_name' if order == 'asc' else '-category_name'
    rows = Category.objects.order_by(name, 'category_id')
    return {'categories': [serialize(category) for category in rows]}


def create_category(body):
    name = clean_name(body)
    slug = slugify(name)
    if Category.objects.filter(slug__iexact=slug).exists():
        raise slug_conflict()
    try:
        with transaction.atomic():
            category = Category.objects.create(category_name=name, slug=slug)
            CategoryTranslation.objects.create(category=category, language_code=Language.EN, name=name)
    except IntegrityError:
        raise slug_conflict()
    return serialize(category)


def rename_category(category_id, body):
    name = clean_name(body)
    slug = slugify(name)
    try:
        with transaction.atomic():
            category = get_category(category_id, for_update=True)
            if Category.objects.filter(slug__iexact=slug).exclude(pk=category.pk).exists():
                raise slug_conflict()
            category.category_name = name
            category.slug = slug
            category.save()
            CategoryTranslation.objects.update_or_create(
                category=category, language_code=Language.EN, defaults={'name': name},
            )
    except IntegrityError:
        raise slug_conflict()
    return serialize(category)


def set_hidden(category_id, body):
    hidden = body.get('isHidden') if isinstance(body, dict) else None
    if not isinstance(hidden, bool):
        raise AdminError(400, 'INVALID_VISIBILITY_VALUE', 'isHidden must be true or false')
    category = get_category(category_id)
    category.is_hidden = hidden
    category.save(update_fields=['is_hidden', 'updated_at'])
    data = serialize(category)
    return {key: data[key] for key in ('categoryId', 'categoryName', 'slug', 'isHidden')}


def delete_category(category_id):
    with transaction.atomic():
        category = get_category(category_id, for_update=True)
        in_use = (
            ProductCategory.objects.filter(category=category).exists()
            or Category.objects.filter(parent=category).exists()
        )
        if in_use:
            raise AdminError(409, 'CATEGORY_IN_USE', 'category still has products or child categories')
        category.delete()
    return {'categoryId': category_id, 'success': True}
