from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import BasePermission

from .models import Session
from .sessions import COOKIE_NAME, find_valid_session


class SessionCookieAuth(BaseAuthentication):
    """Does no lookup itself. It only makes DRF answer 401 instead of 403 when a guard denies."""

    def authenticate(self, request):
        return None

    def authenticate_header(self, request):
        return 'Session'


def current_session(request):
    """Return the valid session for the request cookie or raise 401."""
    session = find_valid_session(request.COOKIES.get(COOKIE_NAME, '').strip())
    if session is None:
        raise NotAuthenticated('authentication is required')
    request.session_row = session
    return session


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        session = current_session(request)
        if session.subject_type != Session.SubjectType.USER:
            raise PermissionDenied('customer access required')
        request.customer = session.user
        return True


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        session = current_session(request)
        if session.subject_type != Session.SubjectType.ADMIN or not session.admin.is_active:
            raise PermissionDenied('admin access required')
        request.admin = session.admin
        return True
