from django.utils import timezone
from django.views.static import serve
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin
from common.choices import Language
from common.responses import error_response, success_body

from . import services, storage
from .services import CampaignError


class CampaignView(APIView):
    def handle_exception(self, exc):
        if isinstance(exc, CampaignError):
            return error_response(exc.code, exc.message, exc.status)
        return super().handle_exception(exc)


class ClientCampaignListView(CampaignView):
    def get(self, request):
        lang = (request.query_params.get('lang') or 'EN').strip().upper()
        if lang not in Language.values:
            raise CampaignError(400, 'INVALID_QUERY', 'lang must be EN or TH')
        campaigns = services.active_campaigns(lang, timezone.localdate())
        return Response(success_body('campaigns retrieved successfully', {'campaigns': campaigns}))


class AdminCampaignView(CampaignView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = services.create_campaign(request.data, request.admin)
        return Response(success_body('campaign created successfully', data), status=201)


class LaunchCampaignView(CampaignView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        data = services.launch_campaign(
            request.data.get('campaignData'), request.FILES.get('mediaFile'), request.admin,
        )
        return Response(success_body('campaign launched successfully', data), status=201)


def banner_file(request, path):
    """Serve a stored banner image from the local media folder."""
    return serve(request, path, document_root=storage.media_root())
