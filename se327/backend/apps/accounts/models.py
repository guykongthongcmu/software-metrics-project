from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

from common.choices import Language


class User(models.Model):
    user_id = models.BigAutoField(primary_key=True)
    email = models.CharField(max_length=255)
    password_hash = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    phone_number = models.CharField(max_length=30)
    preferred_language = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        constraints = [models.UniqueConstraint(Lower('email'), name='uq_users_email_ci')]


class EmailVerificationToken(models.Model):
    email_verification_token_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id', related_name='email_verification_tokens')
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_verification_tokens'
        indexes = [models.Index(fields=['user', 'created_at'], name='idx_evt_user_created')]


class PasswordResetToken(models.Model):
    password_reset_token_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id', related_name='password_reset_tokens')
    token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'password_reset_tokens'
        indexes = [models.Index(fields=['user', 'created_at'], name='idx_prt_user_created')]


class Admin(models.Model):
    admin_id = models.BigAutoField(primary_key=True)
    email = models.CharField(max_length=255)
    password_hash = models.CharField(max_length=255)
    display_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'admin'
        constraints = [models.UniqueConstraint(Lower('email'), name='uq_admin_email_ci')]


class Session(models.Model):
    class SubjectType(models.TextChoices):
        USER = 'USER'
        ADMIN = 'ADMIN'

    session_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.CASCADE, db_column='user_id', related_name='sessions')
    admin = models.ForeignKey(Admin, null=True, blank=True, on_delete=models.CASCADE, db_column='admin_id', related_name='sessions')
    subject_type = models.CharField(max_length=5, choices=SubjectType.choices)
    session_token = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sessions'
        indexes = [models.Index(fields=['user', 'created_at'], name='idx_session_user_created')]
        constraints = [
            models.CheckConstraint(
                name='chk_sessions_subject_type',
                condition=Q(subject_type__in=['USER', 'ADMIN']),
            ),
            models.CheckConstraint(
                name='chk_sessions_exactly_one_owner',
                condition=(
                    Q(subject_type='USER', user__isnull=False, admin__isnull=True)
                    | Q(subject_type='ADMIN', admin__isnull=False, user__isnull=True)
                ),
            ),
        ]


class Address(models.Model):
    address_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_column='user_id', related_name='addresses')
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=30)
    line1 = models.CharField(max_length=255)
    line2 = models.CharField(max_length=255, null=True, blank=True)
    district = models.CharField(max_length=120)
    province = models.CharField(max_length=120)
    postcode = models.CharField(max_length=20)
    country = models.CharField(max_length=100, default='Thailand')
    is_default_shipping = models.BooleanField(default=False)
    is_default_billing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'address'
        constraints = [
            models.UniqueConstraint(
                fields=['user'], condition=Q(is_default_shipping=True),
                name='uq_address_default_shipping_per_user',
            ),
            models.UniqueConstraint(
                fields=['user'], condition=Q(is_default_billing=True),
                name='uq_address_default_billing_per_user',
            ),
        ]
