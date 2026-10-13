import os
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from common.mail import send_password_reset_email

from .models import PasswordResetToken, Session, User
from .signin import MAX_PASSWORD_LENGTH
from .signup import (
    FIELD_LIMITS,
    MIN_PASSWORD_LENGTH,
    TOKEN_BYTES,
    ApiError,
    check_email_format,
    clean_string,
)


def reset_expiry_minutes():
    try:
        minutes = float(os.environ.get('PASSWORD_RESET_EXPIRY_MINUTES', ''))
    except ValueError:
        return 15
    if minutes <= 0:
        return 15
    return int(minutes) if minutes == int(minutes) else minutes


def request_reset(email):
    """Issue a reset token if an account has this email. Returns nothing either way."""
    check_email_format(email)
    if len(email) > FIELD_LIMITS['email'] or '\x00' in email:
        raise ApiError('INVALID_FIELD_LENGTH', 'email is too long or has invalid characters', 400)

    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return
        # a new link replaces any earlier one
        user.password_reset_tokens.filter(used_at__isnull=True).update(used_at=timezone.now())
        token = secrets.token_hex(TOKEN_BYTES)
        expires_at = timezone.now() + timedelta(minutes=reset_expiry_minutes())
        PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

    # the reply is the same if this fails, so a failure is only logged
    send_password_reset_email(user.email, token, user.first_name, reset_expiry_minutes())


def reset_password(body):
    token = clean_string(body.get('token'))
    new_password = body.get('new_password')
    confirm = body.get('confirm_password')

    given = (('token', token), ('new_password', new_password), ('confirm_password', confirm))
    missing = [name for name, value in given if value in (None, '')]
    if missing:
        raise ApiError('MISSING_REQUIRED_FIELDS', 'missing required fields', 400, {'missingFields': missing})
    if not isinstance(new_password, str) or len(new_password) < MIN_PASSWORD_LENGTH:
        raise ApiError('PASSWORD_TOO_SHORT', f'password must be at least {MIN_PASSWORD_LENGTH} characters', 400)
    if len(new_password) > MAX_PASSWORD_LENGTH or '\x00' in new_password:
        raise ApiError('INVALID_FIELD_LENGTH', 'a field is too long or has invalid characters', 400)
    if new_password != confirm:
        raise ApiError('PASSWORD_CONFIRMATION_MISMATCH', 'passwords do not match', 400)
    # real tokens are plain hex, and a NUL character would break the query
    if len(token) > 255 or not token.isascii() or '\x00' in token:
        raise ApiError('INVALID_PASSWORD_RESET_TOKEN', 'password reset token is invalid', 400)

    with transaction.atomic():
        record = (
            PasswordResetToken.objects.select_related('user')
            .select_for_update().filter(token=token).first()
        )
        if record is None:
            raise ApiError('INVALID_PASSWORD_RESET_TOKEN', 'password reset token is invalid', 400)
        if record.used_at:
            raise ApiError('PASSWORD_RESET_TOKEN_ALREADY_USED', 'password reset token has already been used', 409)
        if record.expires_at <= timezone.now():
            raise ApiError('PASSWORD_RESET_TOKEN_EXPIRED', 'password reset token has expired', 410)

        now = timezone.now()
        user = record.user
        user.password_hash = make_password(new_password)
        user.save(update_fields=['password_hash', 'updated_at'])
        user.password_reset_tokens.filter(used_at__isnull=True).update(used_at=now)
        # everyone signed in with the old password is signed out
        Session.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=now)
    return user
