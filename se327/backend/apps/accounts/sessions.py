import os
import secrets
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import Session

COOKIE_NAME = 'session'

# Same default as the legacy API: 24 hours unless SESSION_TTL_HOURS says otherwise.
try:
    SESSION_TTL_HOURS = float(os.environ.get('SESSION_TTL_HOURS', 24))
except ValueError:
    SESSION_TTL_HOURS = 24
if SESSION_TTL_HOURS <= 0:
    SESSION_TTL_HOURS = 24


def create_session(subject, subject_type):
    """Store a new session for a User or Admin and return (token, expires)."""
    token = secrets.token_urlsafe(32)
    expires = timezone.now() + timedelta(hours=SESSION_TTL_HOURS)
    owner = {'user': subject} if subject_type == Session.SubjectType.USER else {'admin': subject}
    Session.objects.create(
        subject_type=subject_type, session_token=token, expires_at=expires, **owner
    )
    return token, expires


def find_valid_session(token):
    """Return the live session for a token, or None if missing, revoked or expired."""
    if not token:
        return None
    session = (
        Session.objects.select_related('user', 'admin').filter(session_token=token).first()
    )
    if session is None or session.revoked_at is not None:
        return None
    if session.expires_at <= timezone.now():
        return None
    return session


def revoke(session):
    if session.revoked_at is None:
        session.revoked_at = timezone.now()
        session.save(update_fields=['revoked_at', 'updated_at'])


def set_session_cookie(response, token, expires):
    response.set_cookie(
        COOKIE_NAME,
        token,
        expires=expires,
        path='/',
        httponly=True,
        samesite='Lax',
        secure=not settings.DEBUG,
    )


def clear_session_cookie(response):
    response.delete_cookie(COOKIE_NAME, path='/', samesite='Lax')
