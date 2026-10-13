from rest_framework.views import APIView

from common.responses import success_response

from . import password_reset
from .signup import ApiError, clean_email
from .views_signup import body_of, error_from


class ForgotPasswordView(APIView):
    def post(self, request):
        email = clean_email(body_of(request).get('email'))
        try:
            password_reset.request_reset(email)
        except ApiError as exc:
            return error_from(exc)
        # same reply whether or not the account exists
        return success_response('if the email is registered, a password reset link has been sent')


class ResetPasswordView(APIView):
    def post(self, request):
        try:
            password_reset.reset_password(body_of(request))
        except ApiError as exc:
            return error_from(exc)
        return success_response('password has been reset successfully', {'password_reset': True})
