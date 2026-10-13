import os
from html import escape

from django.http import HttpResponse, JsonResponse
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.views import APIView

from common.email_templates import COLORS
from common.responses import error_body, success_response

from . import signup
from .signup import ApiError, clean_email, clean_string


def body_of(request):
    return request.data if isinstance(request.data, dict) else {}


def error_from(exc):
    # extras such as missingFields sit next to code and message
    return JsonResponse({**error_body(exc.code, exc.message), **exc.extra}, status=exc.status)


class CheckEmailView(APIView):
    def post(self, request):
        email = clean_email(body_of(request).get('email'))
        try:
            signup.check_email(email)
        except ApiError as exc:
            return error_from(exc)
        return success_response('email is valid and available', {'email': email})


class SignupView(APIView):
    def post(self, request):
        try:
            user, sent = signup.sign_up(body_of(request))
        except ApiError as exc:
            return error_from(exc)
        message = 'user registered successfully. verification email '
        message += 'sent' if sent else 'pending'
        return success_response(message, {
            'user_id': user.user_id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'DOB': user.date_of_birth.isoformat(),
            'phone_number': user.phone_number,
            'email_verified': False,
            'verification_email_sent': sent,
        }, status=201)


class ResendVerificationView(APIView):
    def post(self, request):
        email = clean_email(body_of(request).get('email'))
        try:
            user, sent = signup.resend_verification(email)
        except ApiError as exc:
            return error_from(exc)
        message = 'verification email sent successfully' if sent else 'verification email pending'
        return success_response(message, {'email': user.email, 'verification_email_sent': sent})


# title and subtitle shown on the result page for each outcome
PAGE_TEXT = {
    'INVALID_VERIFICATION_TOKEN': ('Invalid verification link', 'This link is not valid anymore.'),
    'VERIFICATION_TOKEN_ALREADY_USED': ('Link already used', 'Your verification link was already used.'),
    'VERIFICATION_TOKEN_EXPIRED': ('Verification link expired', 'This link has expired.'),
    'EMAIL_ALREADY_VERIFIED': ('Email already verified', 'Your email is already verified.'),
    'MISSING_REQUIRED_FIELDS': ('Verification link missing', 'We could not verify your email just yet.'),
}


def wants_html(request):
    fmt = clean_string(request.query_params.get('format')).lower()
    if fmt == 'json':
        return False
    if fmt == 'html':
        return True
    return 'text/html' in request.headers.get('Accept', '')


def result_page(title, subtitle, status):
    brand = escape(os.environ.get('MAIL_BRAND_NAME', 'Core&Co'))
    home = os.environ.get('WEBSTORE_BASE_URL', '').strip()
    button = ''
    if home:
        button = (f'<a href="{escape(home)}" style="display:inline-block;margin-top:14px;'
                  f'background:{COLORS["accent"]};color:#ffffff;text-decoration:none;'
                  'padding:12px 22px;border-radius:999px;font-weight:600;">Back to store</a>')
    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{escape(title)} | {brand}</title>
</head>
<body style="margin:0;background:{COLORS['background']};font-family:'Helvetica Neue',Arial,sans-serif;color:{COLORS['text']};">
<div style="max-width:560px;margin:48px auto;padding:36px 32px;background:{COLORS['card']};border:1px solid {COLORS['border']};border-radius:16px;text-align:center;">
<h1 style="margin:0 0 10px;color:{COLORS['heading']};">{escape(title)}</h1>
<p style="margin:0 0 20px;font-size:17px;">{escape(subtitle)}</p>
{button}
<p style="margin:28px 0 0;color:{COLORS['muted']};">&copy; {brand}</p>
</div>
</body>
</html>"""
    return HttpResponse(html, status=status, content_type='text/html')


class IgnoreFormatNegotiation(DefaultContentNegotiation):
    """Skip DRF's ?format= and Accept handling, this view picks html or json itself."""

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class VerifyEmailView(APIView):
    content_negotiation_class = IgnoreFormatNegotiation

    def get(self, request):
        token = clean_string(request.query_params.get('token'))
        try:
            if not token:
                raise ApiError('MISSING_REQUIRED_FIELDS', 'token is required', 400)
            user = signup.verify_email(token)
        except ApiError as exc:
            if wants_html(request):
                title, subtitle = PAGE_TEXT[exc.code]
                return result_page(title, subtitle, exc.status)
            return error_from(exc)
        if wants_html(request):
            return result_page('Email verified', 'Thank you for verifying your email.', 200)
        return success_response('email verified successfully', {
            'user_id': user.user_id,
            'email': user.email,
            'email_verified': True,
        })
