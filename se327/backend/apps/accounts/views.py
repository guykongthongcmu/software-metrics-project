from rest_framework.views import APIView

from common.responses import success_response

from .permissions import current_session
from .sessions import clear_session_cookie, revoke


class LogoutView(APIView):
    def post(self, request):
        # no valid session gives 401, same as the legacy API
        revoke(current_session(request))
        response = success_response('signed out successfully', {'sessionRevoked': True})
        clear_session_cookie(response)
        return response
