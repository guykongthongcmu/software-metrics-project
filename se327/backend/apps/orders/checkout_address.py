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


def clean_address(body):
    if not isinstance(body, dict):
        raise invalid({'body': 'request body must be a JSON object'})

    address = {}
    errors = {}
    for field, (required, max_length) in FIELDS.items():
        raw = body.get(field)
        if raw is None:
            value = ''
        elif isinstance(raw, str):
            value = raw.strip()
        else:
            errors[field] = f'{field} must be a string'
            continue

        if has_bad_chars(value):
            errors[field] = f'{field} contains invalid characters'
        elif not value:
            if required:
                errors[field] = f'{field} is required'
        elif len(value) > max_length:
            errors[field] = f'{field} must be at most {max_length} characters'
        address[field] = value or None

    phone = address.get('phoneNumber')
    if 'phoneNumber' not in errors and phone and not PHONE_PATTERN.fullmatch(phone):
        errors['phoneNumber'] = 'phoneNumber format is invalid'
    postal = address.get('postalCode')
    if 'postalCode' not in errors and postal and not POSTAL_PATTERN.fullmatch(postal):
        errors['postalCode'] = 'postalCode format is invalid'

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
    """The default shipping address, else the most recently updated one, else None."""
    addresses = Address.objects.filter(user=user)
    return (
        addresses.filter(is_default_shipping=True).first()
        or addresses.order_by('-updated_at', '-address_id').first()
    )


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
