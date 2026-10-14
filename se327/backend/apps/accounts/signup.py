import os
import re
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_date

from common.mail import send_verification_email

from .models import EmailVerificationToken, User

EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$')
MIN_PASSWORD_LENGTH = 8
EMAIL_TAKEN = 'email already exists'
# column sizes from the User model
FIELD_LIMITS = {'email': 255, 'first_name': 100, 'last_name': 100, 'phone_number': 30}
TOKEN_BYTES = 32
SIGNUP_FIELDS = ('email', 'password', 'first_name', 'last_name', 'DOB', 'phone_number')


class ApiError(Exception):
    def __init__(self, code, message, status, extra=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.extra = extra or {}


def verification_expiry_minutes():
    try:
        minutes = float(os.environ.get('EMAIL_VERIFICATION_EXPIRY_MINUTES', ''))
    except ValueError:
        return 5
    if minutes <= 0:
        return 5
    return int(minutes) if minutes == int(minutes) else minutes


def clean_string(value):
    return value.strip() if isinstance(value, str) else ''


def clean_email(value):
    return clean_string(value).lower()


def check_email_format(email):
    if not email:
        raise ApiError('MISSING_REQUIRED_FIELDS', 'email is required', 400)
    if not EMAIL_REGEX.match(email):
        raise ApiError('INVALID_EMAIL_FORMAT', 'email format is invalid', 400)


def email_taken(email):
    return User.objects.filter(email__iexact=email).exists()


def check_email(email):
    check_email_format(email)
    if email_taken(email):
        raise ApiError('EMAIL_ALREADY_EXISTS', EMAIL_TAKEN, 409)


def issue_token(user):
    token = secrets.token_hex(TOKEN_BYTES)
    expires_at = timezone.now() + timedelta(minutes=verification_expiry_minutes())
    EmailVerificationToken.objects.create(user=user, token=token, expires_at=expires_at)
    return token


def send_token_email(user, token):
    """True if the email went out. A failure is already logged and never breaks the request."""
    return send_verification_email(user.email, token, user.first_name, verification_expiry_minutes())


def sign_up(body):
    payload = {
        'email': clean_email(body.get('email')),
        'password': body.get('password'),
        'first_name': clean_string(body.get('first_name')),
        'last_name': clean_string(body.get('last_name')),
        'DOB': clean_string(body.get('DOB')),
        'phone_number': clean_string(body.get('phone_number')),
    }
    missing = [name for name in SIGNUP_FIELDS if payload[name] in (None, '')]
    if missing:
        raise ApiError('MISSING_REQUIRED_FIELDS', 'missing required fields', 400, {'missingFields': missing})

    too_long = [name for name, limit in FIELD_LIMITS.items()
                if len(payload[name]) > limit or '\x00' in payload[name]]
    if too_long:
        raise ApiError('INVALID_FIELD_LENGTH', 'a field is too long or has invalid characters', 400, {'fields': too_long})

    check_email_format(payload['email'])
    if not isinstance(payload['password'], str) or len(payload['password']) < MIN_PASSWORD_LENGTH:
        raise ApiError('PASSWORD_TOO_SHORT', f'password must be at least {MIN_PASSWORD_LENGTH} characters', 400)
    try:
        dob = parse_date(payload['DOB'])
    except ValueError:
        dob = None
    if dob is None:
        raise ApiError('INVALID_DOB', 'DOB must be a valid date in YYYY-MM-DD format', 400)

    try:
        with transaction.atomic():
            if email_taken(payload['email']):
                raise ApiError('EMAIL_ALREADY_EXISTS', EMAIL_TAKEN, 409)
            user = User.objects.create(
                email=payload['email'],
                password_hash=make_password(payload['password']),
                first_name=payload['first_name'],
                last_name=payload['last_name'],
                date_of_birth=dob,
                phone_number=payload['phone_number'],
            )
            token = issue_token(user)
    except IntegrityError:
        # two sign ups with the same email at the same time
        raise ApiError('EMAIL_ALREADY_EXISTS', EMAIL_TAKEN, 409)

    sent = send_token_email(user, token)
    return user, sent


def resend_verification(email):
    check_email_format(email)
    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise ApiError('USER_NOT_FOUND', 'user not found', 404)
        if user.email_verified_at:
            raise ApiError('EMAIL_ALREADY_VERIFIED', 'email is already verified', 409)
        user.email_verification_tokens.filter(used_at__isnull=True).update(used_at=timezone.now())
        token = issue_token(user)

    sent = send_token_email(user, token)
    return user, sent


def verify_email(token):
    """Check the token in the legacy order, then mark the user verified and the token used."""
    with transaction.atomic():
        record = (
            EmailVerificationToken.objects.select_related('user')
            .select_for_update().filter(token=token).first()
        )
        if record is None:
            raise ApiError('INVALID_VERIFICATION_TOKEN', 'verification token is invalid', 400)
        if record.used_at:
            raise ApiError('VERIFICATION_TOKEN_ALREADY_USED', 'verification token has already been used', 409)
        if record.expires_at <= timezone.now():
            raise ApiError('VERIFICATION_TOKEN_EXPIRED', 'verification token has expired', 410)
        if record.user.email_verified_at:
            raise ApiError('EMAIL_ALREADY_VERIFIED', 'email is already verified', 409)

        now = timezone.now()
        record.user.email_verified_at = now
        record.user.save(update_fields=['email_verified_at', 'updated_at'])
        record.used_at = now
        record.save(update_fields=['used_at'])
    return record.user
