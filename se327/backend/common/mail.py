import logging
import os
from email.mime.image import MIMEImage
from pathlib import Path
from urllib.parse import quote

from django.conf import settings
from django.core.mail import EmailMultiAlternatives

from . import email_templates

logger = logging.getLogger(__name__)

LOGO_CID = 'mail-logo'
DEFAULT_LOGO_PATH = Path(__file__).resolve().parent / 'assets' / 'coreandco.png'

# SMTP_HOST, SMTP_USER and SMTP_PASS feed settings.py, WEBSTORE_BASE_URL is read here.
REQUIRED_ENV = ('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'WEBSTORE_BASE_URL')


class MailConfigError(Exception):
    pass


def check_mail_config():
    """Raise MailConfigError naming every required setting that is missing."""
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name, '').strip()]
    if missing:
        raise MailConfigError('Missing required environment variable: ' + ', '.join(missing))


def webstore_base_url():
    check_mail_config()
    return os.environ['WEBSTORE_BASE_URL'].strip().rstrip('/')


def build_verification_url(token):
    return f'{webstore_base_url()}/api/auth/verify-email?token={quote(token, safe="")}'


def build_password_reset_url(token):
    return f'{webstore_base_url()}/auth/reset-password?token={quote(token, safe="")}'


def brand_context(logo_src):
    return {
        'brand_name': os.environ.get('MAIL_BRAND_NAME', 'Core&Co'),
        'support_email': os.environ.get('SUPPORT_EMAIL', ''),
        'logo_src': logo_src,
    }


def logo_asset():
    """Return (src for the img tag, MIMEImage to attach or None)."""
    logo_url = os.environ.get('MAIL_LOGO_URL', '').strip()
    if logo_url:
        return logo_url, None
    path = Path(os.environ.get('MAIL_LOGO_PATH') or DEFAULT_LOGO_PATH)
    if not path.is_file():
        return '', None
    image = MIMEImage(path.read_bytes())
    image.add_header('Content-ID', f'<{LOGO_CID}>')
    image.add_header('Content-Disposition', 'inline', filename=path.name)
    return f'cid:{LOGO_CID}', image


def send_email(to, subject, html, text, logo=None):
    """Send one email. Returns True on success, False if it failed (logged, never raised)."""
    try:
        check_mail_config()
        message = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
        message.attach_alternative(html, 'text/html')
        if logo is not None:
            message.mixed_subtype = 'related'
            message.attach(logo)
        message.send()
        return True
    except Exception:
        logger.exception('Failed to send email to %s (%s)', to, subject)
        return False


def send_verification_email(to, token, first_name=None, expires_in_minutes=5):
    try:
        url = build_verification_url(token)
        logo_src, logo = logo_asset()
        brand = brand_context(logo_src)
        html, text = email_templates.verification_email(url, first_name, expires_in_minutes, **brand)
    except Exception:
        logger.exception('Failed to build verification email for %s', to)
        return False
    return send_email(to, f'Verify your {brand["brand_name"]} account', html, text, logo)


def send_password_reset_email(to, token, first_name=None, expires_in_minutes=5):
    try:
        url = build_password_reset_url(token)
        logo_src, logo = logo_asset()
        brand = brand_context(logo_src)
        html, text = email_templates.password_reset_email(url, first_name, expires_in_minutes, **brand)
    except Exception:
        logger.exception('Failed to build password reset email for %s', to)
        return False
    return send_email(to, f'Reset your {brand["brand_name"]} account password', html, text, logo)


def send_campaign_email(to, first_name=None, campaign_name=None, campaign_type_label=None,
                        offer_label=None, start_date=None, end_date=None, shop_url=None):
    try:
        shop_url = shop_url or webstore_base_url()
        logo_src, logo = logo_asset()
        brand = brand_context(logo_src)
        html, text = email_templates.campaign_email(
            shop_url, first_name, campaign_name, campaign_type_label,
            offer_label, start_date, end_date, **brand,
        )
    except Exception:
        logger.exception('Failed to build campaign email for %s', to)
        return False
    if campaign_name:
        subject = f'{campaign_name} is now live at {brand["brand_name"]}'
    else:
        subject = f'A new offer is live at {brand["brand_name"]}'
    return send_email(to, subject, html, text, logo)
