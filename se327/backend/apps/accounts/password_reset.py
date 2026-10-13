import math
import os
import secrets
import threading
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone

from common.mail import send_password_reset_email

from .models import PasswordResetToken, Session, User
from .signin import MAX_PASSWORD_LENGTH, check_text
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
    # nan and inf would blow up below, so they fall back too
    if not math.isfinite(minutes) or minutes <= 0:
        return 15
    return int(minutes) if minutes == int(minutes) else minutes


def dispatch_mail(*args):
    """Send the reset email on its own thread so a slow SMTP server does not show in the reply time."""
    thread = threading.Thread(target=send_password_reset_email, args=args, daemon=True)
    thread.start()
    return thread


def request_reset(email):
    """Issue a reset token if an account has this email. Returns nothing either way."""
    check_text(email, FIELD_LIMITS['email'])
    check_email_format(email)

    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return
        # a new link replaces any earlier one
        user.password_reset_tokens.filter(used_at__isnull=True).update(used_at=timezone.now())
        token = secrets.token_hex(TOKEN_BYTES)
        expires_at = timezone.now() + timedelta(minutes=reset_expiry_minutes())
        PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

    # the reply is the same if this fails, so a failure is only logged (by the mail helper)
    dispatch_mail(user.email, token, user.first_name, reset_expiry_minutes())


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
    check_text(new_password, MAX_PASSWORD_LENGTH)
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
