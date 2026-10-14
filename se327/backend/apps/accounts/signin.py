from functools import lru_cache

from django.contrib.auth.hashers import check_password, make_password

from .models import Admin, User
from .signup import FIELD_LIMITS, ApiError, check_email_format, clean_email

MAX_PASSWORD_LENGTH = 1000


def check_text(value, limit):
    """Reject strings that are too long, hold NUL or cannot be encoded (lone surrogates)."""
    if not isinstance(value, str):
        return
    try:
        value.encode('utf-8')
    except UnicodeEncodeError:
        value = None
    if value is None or len(value) > limit or '\x00' in value:
        raise ApiError('INVALID_FIELD_LENGTH', 'a field is too long or has invalid characters', 400)


@lru_cache(maxsize=1)
def dummy_hash():
    return make_password('not-a-real-password')


def authenticate(model, body):
    """Return the account whose email and password match, or raise INVALID_CREDENTIALS.

    Unknown email and wrong password give the same error, and an unknown email still
    runs one hash check so the response time does not give the email away.
    """
    email = clean_email(body.get('email'))
    password = body.get('password')
    # size checks come first so a huge body never reaches the email regex
    check_text(email, FIELD_LIMITS['email'])
    check_text(password, MAX_PASSWORD_LENGTH)
    check_email_format(email)
    if not isinstance(password, str) or password == '':
        raise ApiError('MISSING_REQUIRED_FIELDS', 'password is required', 400)

    account = model.objects.filter(email__iexact=email).first()
    if account is None:
        check_password(password, dummy_hash())
        raise ApiError('INVALID_CREDENTIALS', 'invalid email or password', 401)
    if not check_password(password, account.password_hash):
        raise ApiError('INVALID_CREDENTIALS', 'invalid email or password', 401)
    return account


def customer_sign_in(body):
    user = authenticate(User, body)
    # only after the password matched, so it does not show which emails are registered
    if user.email_verified_at is None:
        raise ApiError('EMAIL_NOT_VERIFIED', 'email is not verified yet', 403)
    return user


def full_name(user):
    return f'{user.first_name} {user.last_name}'.strip()


def customer_profile(user):
    return {
        'user_id': user.user_id,
        'email': user.email,
        'name': full_name(user),
        'phone_number': user.phone_number,
        'date_of_birth': user.date_of_birth.isoformat(),
        'email_verified': user.email_verified_at is not None,
        'created_at': user.created_at.isoformat(),
    }


def admin_sign_in(body):
    admin = authenticate(Admin, body)
    # checked after the password so the status is not shown to someone without it
    if not admin.is_active:
        raise ApiError('ACCOUNT_INACTIVE', 'admin account is inactive', 403)
    return admin
