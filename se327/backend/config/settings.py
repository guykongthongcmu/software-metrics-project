import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_list(name):
    return [v.strip() for v in os.environ.get(name, '').split(',') if v.strip()]


DEBUG = env_bool('DEBUG', False)

SECRET_KEY = os.environ.get('SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError('SECRET_KEY must be set when DEBUG is off')
    SECRET_KEY = 'insecure-dev-only-key'

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS') or (['localhost', '127.0.0.1'] if DEBUG else [])

PORT = int(os.environ.get('PORT', 3000))

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'rest_framework',
    'common',
]

MIDDLEWARE = [
    'common.middleware.JsonExceptionMiddleware',
    'common.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
APPEND_SLASH = False

handler404 = 'common.views.not_found'
handler500 = 'common.views.server_error'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'NAME': os.environ.get('DB_NAME', 'core_co'),
    }
}

# Origins allowed to call the API. Only these are reflected back in CORS headers.
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
    'DEFAULT_AUTHENTICATION_CLASSES': [],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
    'EXCEPTION_HANDLER': 'common.exceptions.api_exception_handler',
    'UNAUTHENTICATED_USER': None,
}

# Mail (SMTP)
EMAIL_HOST = os.environ.get('SMTP_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', 465))
EMAIL_HOST_USER = os.environ.get('SMTP_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('SMTP_PASS', '')
EMAIL_USE_SSL = EMAIL_PORT == 465
DEFAULT_FROM_EMAIL = os.environ.get('MAIL_FROM', EMAIL_HOST_USER)

# Object storage (Supabase)
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SECRET_KEY = os.environ.get('SUPABASE_SECRET_KEY', '')
SUPABASE_BUCKET = os.environ.get('SUPABASE_BUCKET', '')

USE_TZ = True
TIME_ZONE = 'Asia/Bangkok'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}
