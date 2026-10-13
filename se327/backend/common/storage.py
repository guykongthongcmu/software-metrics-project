import logging
import os
import uuid
from collections import namedtuple
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

# Images live on local disk for now. A hosted bucket only has to replace save_image and delete_files.
BUCKET = 'local'
MAX_IMAGE_BYTES = 5 * 1024 * 1024

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


def save_image(upload, folder):
    """Write a checked upload under media_root()/folder and return where it went."""
    extension = check_image(upload)
    relative = f'{folder}/{uuid.uuid4().hex}{extension}'
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


def delete_files(file_paths):
    """Best effort clean up. Never raises, and never leaves the media folder."""
    root = media_root().resolve()
    for relative in file_paths:
        try:
            target = (root / relative).resolve()
            if root in target.parents:
                target.unlink(missing_ok=True)
        except OSError:
            logger.warning('could not remove stored file %s', relative)
