from django.db import transaction

from common import storage

from .admin_base import AdminError
from .admin_product_payload import clean_text, parse_bool, validation_error
from .admin_products import MEDIA_FOLDER, get_product, serialize_media
from .models import ProductMedia

MAX_IMAGES = 4


def parse_options(fields):
    errors = {}
    thumbnail = parse_bool(fields.get('isThumbnail') or 'false')
    hero = parse_bool(fields.get('isHero') or 'false')
    if thumbnail is None or hero is None:
        errors['flags'] = 'isThumbnail and isHero must be true or false'
    sort_order = None
    raw_order = fields.get('sortOrder')
    if raw_order not in (None, ''):
        raw_order = raw_order.strip()
        if raw_order.isascii() and raw_order.isdigit() and 1 <= int(raw_order) <= MAX_IMAGES:
            sort_order = int(raw_order)
        else:
            errors['sortOrder'] = 'sortOrder must be 1 to 4'
    alt_text = fields.get('altText')
    if alt_text is not None:
        alt_text = clean_text(alt_text, 255, required=False)
        if alt_text is None:
            errors['altText'] = 'altText must be text up to 255 characters'
    if errors:
        raise validation_error(errors)
    return {'isThumbnail': thumbnail, 'isHero': hero, 'sortOrder': sort_order, 'altText': alt_text or None}


def pick_sort_order(wanted, taken):
    if wanted is not None:
        if wanted in taken:
            raise validation_error({'sortOrder': f'sortOrder {wanted} is already used'})
        return wanted
    return next(number for number in range(1, MAX_IMAGES + 1) if number not in taken)


def add_image(product_id, upload, fields):
    """Store one more image for a product, keeping the limit of four."""
    if upload is None:
        raise AdminError(400, 'IMAGE_REQUIRED', 'send the file in the image field')
    storage.check_image(upload)
    options = parse_options(fields)

    saved = []
    try:
        with transaction.atomic():
            # the row lock stops two uploads from both passing the count check
            product = get_product(product_id, for_update=True)
            existing = list(product.media.all())
            if len(existing) >= MAX_IMAGES:
                raise AdminError(409, 'PRODUCT_IMAGE_LIMIT_REACHED', 'a product can have at most 4 images')
            sort_order = pick_sort_order(options['sortOrder'], {row.sort_order for row in existing})
            if options['isThumbnail'] and any(row.is_thumbnail for row in existing):
                raise validation_error({'isThumbnail': 'the product already has a thumbnail'})
            if options['isHero'] and any(row.is_hero for row in existing):
                raise validation_error({'isHero': 'the product already has a hero image'})
            stored = storage.save_image(upload, MEDIA_FOLDER)
            saved.append(stored.file_path)
            media = ProductMedia.objects.create(
                product=product, bucket_name=stored.bucket_name, file_path=stored.file_path,
                public_url=stored.public_url, alt_text=options['altText'], sort_order=sort_order,
                is_thumbnail=options['isThumbnail'], is_hero=options['isHero'],
            )
    except storage.StorageError as exc:
        raise AdminError(500, 'STORAGE_UPLOAD_FAILED', 'could not store the uploaded image') from exc
    except Exception:
        storage.delete_files(saved)
        raise
    return serialize_media(media)
