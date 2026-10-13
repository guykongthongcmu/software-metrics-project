from rest_framework.views import APIView

from common.responses import success_response

from . import signin
from .models import Session
from .permissions import IsCustomer
from .sessions import create_session, set_session_cookie
from .signup import ApiError
from .views_signup import body_of, error_from


class UserSigninView(APIView):
    def post(self, request):
        try:
            user = signin.customer_sign_in(body_of(request))
        except ApiError as exc:
            return error_from(exc)
        token, expires = create_session(user, Session.SubjectType.USER)
        response = success_response('signed in successfully', {
            'role': 'user',
            'user_id': user.user_id,
            'email': user.email,
            'name': signin.full_name(user),
            'phone_number': user.phone_number,
            'email_verified': user.email_verified_at is not None,
            'redirectTo': '/',
            'session': {'expiresAt': expires.isoformat()},
        })
        set_session_cookie(response, token, expires)
        return response


class UserProfileView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        # the session row always points at a real user, so USER_NOT_FOUND cannot happen here
        return success_response(None, signin.customer_profile(request.customer))
