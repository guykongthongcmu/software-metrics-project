import re

from django.db import transaction

from apps.accounts.models import Address, User

from .services import OrderError

# field name -> (required, max length)
FIELDS = {
    'fullName': (True, 150),
    'phoneNumber': (True, 20),
    'addressLine1': (True, 255),
    'addressLine2': (False, 255),
    'district': (True, 120),
    'province': (True, 120),
    'postalCode': (True, 12),
    'country': (True, 100),
}

# explicit classes with a literal space, so \s style whitespace and other scripts' digits are out
PHONE_PATTERN = re.compile(r'[0-9+\- ()]{7,20}')
POSTAL_PATTERN = re.compile(r'[A-Za-z0-9\- ]{3,12}')
FORMATS = {'phoneNumber': PHONE_PATTERN, 'postalCode': POSTAL_PATTERN}


def invalid(details):
    return OrderError(400, 'INVALID_ADDRESS_PAYLOAD', 'address payload is invalid', details)


def has_bad_chars(value):
    # control characters, which also covers NUL
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        return True
    try:
        value.encode('utf-8')
    except UnicodeEncodeError:
        return True
    return False


def field_error(field, value, required, max_length):
    """The problem with an already stripped string value, or None."""
    if has_bad_chars(value):
        return f'{field} contains invalid characters'
    if not value:
        return f'{field} is required' if required else None
    if len(value) > max_length:
        return f'{field} must be at most {max_length} characters'
    return None


def format_errors(address, errors):
    for field, pattern in FORMATS.items():
        value = address.get(field)
        if field not in errors and value and not pattern.fullmatch(value):
            errors[field] = f'{field} format is invalid'


def clean_address(body):
    if not isinstance(body, dict):
        raise invalid({'body': 'request body must be a JSON object'})

    address = {}
    errors = {}
    for field, (required, max_length) in FIELDS.items():
        raw = body.get(field)
        if raw is not None and not isinstance(raw, str):
            errors[field] = f'{field} must be a string'
            continue
        value = (raw or '').strip()
        error = field_error(field, value, required, max_length)
        if error:
            errors[field] = error
        address[field] = value or None

    format_errors(address, errors)
    if errors:
        raise invalid(errors)
    return address


def address_payload(address):
    return {
        'fullName': address.full_name,
        'phoneNumber': address.phone,
        'addressLine1': address.line1,
        'addressLine2': address.line2,
        'district': address.district,
        'province': address.province,
        'postalCode': address.postcode,
        'country': address.country,
    }


def current_address(user):
    """The default shipping address, or None. Other saved addresses are never used."""
    return Address.objects.filter(user=user, is_default_shipping=True).first()


def get_address(user):
    address = current_address(user)
    return {'address': address_payload(address) if address else None}


def save_address(user, body):
    clean = clean_address(body)
    values = {
        'full_name': clean['fullName'],
        'phone': clean['phoneNumber'],
        'line1': clean['addressLine1'],
        'line2': clean['addressLine2'],
        'district': clean['district'],
        'province': clean['province'],
        'postcode': clean['postalCode'],
        'country': clean['country'],
        'is_default_shipping': True,
    }

    with transaction.atomic():
        # the user row works as a per-user lock so two saves cannot both create a default
        User.objects.select_for_update().get(pk=user.pk)
        address = current_address(user)
        if address is None:
            address = Address.objects.create(user=user, **values)
        else:
            for name, value in values.items():
                setattr(address, name, value)
            address.save()
    return {'address': address_payload(address)}
