from django.conf import settings

# A developer's .env may hold real Supabase keys. Tests must never upload to that bucket,
# so they use local disk unless a test turns the bucket on itself with override_settings.
settings.SUPABASE_URL = ''
settings.SUPABASE_SECRET_KEY = ''
settings.SUPABASE_BUCKET = ''
