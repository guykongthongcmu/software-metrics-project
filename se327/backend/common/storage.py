import json
import logging
import os
import urllib.error
import urllib.request
import uuid
from collections import namedtuple
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# Images go to a Supabase bucket when it is configured, else to local disk.
BUCKET = 'local'
MAX_IMAGE_BYTES = 5 * 1024 * 1024
REQUEST_TIMEOUT = 20
CONTENT_TYPES = {'.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}

StoredFile = namedtuple('StoredFile', 'bucket_name file_path public_url')


class StorageError(Exception):
    pass


class ImageRejected(Exception):
    def __init__(self, status, code, message):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def media_root():
    # same folder the campaign banners use unless MEDIA_DIR says otherwise
    configured = os.environ.get('MEDIA_DIR') or os.environ.get('CAMPAIGN_MEDIA_DIR')
    return Path(configured or settings.BASE_DIR / 'media')


def media_url():
    configured = os.environ.get('MEDIA_URL') or os.environ.get('CAMPAIGN_MEDIA_URL') or '/media/'
    return configured.rstrip('/') + '/'


def detect_extension(head):
    """Tell the image type from its first bytes. The client file name and content type are ignored."""
    if head.startswith(b'\xff\xd8\xff'):
        return '.jpg'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return '.png'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return '.webp'
    return None


def check_image(upload):
    """Return the extension for a valid upload or raise ImageRejected."""
    if upload.size > MAX_IMAGE_BYTES:
        raise ImageRejected(413, 'FILE_TOO_LARGE', 'image must be 5 MB or smaller')
    upload.seek(0)
    head = upload.read(12)
    upload.seek(0)
    extension = detect_extension(head)
    if extension is None:
        raise ImageRejected(400, 'INVALID_FILE_TYPE', 'image must be a JPEG, PNG or WebP file')
    return extension


def use_supabase():
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SECRET_KEY and settings.SUPABASE_BUCKET)


def supabase_request(path, method, body, content_type):
    request = urllib.request.Request(
        f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{path}",
        data=body, method=method,
        headers={
            'Authorization': f'Bearer {settings.SUPABASE_SECRET_KEY}',
            'apikey': settings.SUPABASE_SECRET_KEY,
            'Content-Type': content_type,
        },
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT):
        pass


def save_to_supabase(upload, relative, extension):
    upload.seek(0)
    try:
        supabase_request(f'{settings.SUPABASE_BUCKET}/{relative}', 'POST', upload.read(), CONTENT_TYPES[extension])
    except (urllib.error.URLError, OSError) as exc:
        raise StorageError(str(exc)) from exc
    public_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/{relative}"
    return StoredFile(settings.SUPABASE_BUCKET, relative, public_url)


def save_to_disk(upload, relative):
    target = media_root() / relative
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        with open(target, 'wb') as out:
            for chunk in upload.chunks():
                out.write(chunk)
    except OSError as exc:
        delete_files([relative])
        raise StorageError(str(exc)) from exc
    return StoredFile(BUCKET, relative, f'{media_url()}{relative}')


def save_image(upload, folder):
    """Store a checked upload under folder and return where it went."""
    extension = check_image(upload)
    relative = f'{folder}/{uuid.uuid4().hex}{extension}'
    if use_supabase():
        return save_to_supabase(upload, relative, extension)
    return save_to_disk(upload, relative)


def delete_from_supabase(file_paths):
    body = json.dumps({'prefixes': list(file_paths)}).encode()
    try:
        supabase_request(settings.SUPABASE_BUCKET, 'DELETE', body, 'application/json')
    except (urllib.error.URLError, OSError):
        logger.warning('could not remove %d stored files from the bucket', len(file_paths))


def delete_files(file_paths):
    """Best effort clean up. Never raises, and never leaves the media folder."""
    if use_supabase():
        if file_paths:
            delete_from_supabase(file_paths)
        return
    root = media_root().resolve()
    for relative in file_paths:
        try:
            target = (root / relative).resolve()
            if root in target.parents:
                target.unlink(missing_ok=True)
        except OSError:
            logger.warning('could not remove stored file %s', relative)
