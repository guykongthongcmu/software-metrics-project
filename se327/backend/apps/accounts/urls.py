from django.urls import re_path

from .views_signup import CheckEmailView, ResendVerificationView, SignupView, VerifyEmailView

urlpatterns = [
    re_path(r'^check-email$', CheckEmailView.as_view()),
    re_path(r'^signup$', SignupView.as_view()),
    re_path(r'^verify-email$', VerifyEmailView.as_view()),
    re_path(r'^resend-verification$', ResendVerificationView.as_view()),
]
