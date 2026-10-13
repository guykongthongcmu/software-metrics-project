import os
from pathlib import Path

from django.conf import settings

# Banner images live on local disk for now. Swap these functions to move to object storage.
FOLDER = 'campaign-banners'


def media_url():
    return os.environ.get('CAMPAIGN_MEDIA_URL', '/media/').rstrip('/') + '/'


def media_root():
    return Path(os.environ.get('CAMPAIGN_MEDIA_DIR') or settings.BASE_DIR / 'media')


def save_banner(campaign_id, upload):
    """Store the uploaded image for a campaign and return its public url."""
    extension = Path(upload.name).suffix.lower()
    folder = media_root() / FOLDER
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob(f'{campaign_id}.*'):
        old.unlink()
    with open(folder / f'{campaign_id}{extension}', 'wb') as out:
        for chunk in upload.chunks():
            out.write(chunk)
    return f'{media_url()}{FOLDER}/{campaign_id}{extension}'


def banner_url(campaign_id):
    """Return the url of the stored banner for a campaign, or None."""
    for found in (media_root() / FOLDER).glob(f'{campaign_id}.*'):
        return f'{media_url()}{FOLDER}/{found.name}'
    return None
