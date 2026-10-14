FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.lock ./
RUN pip install --no-cache-dir --require-hashes --only-binary :all: -r requirements.lock

COPY manage.py docker-entrypoint.sh ./
COPY apps ./apps
COPY common ./common
COPY config ./config
RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home app \
    && mkdir -p /app/media \
    && chown -R app:app /app
USER app

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-3000} --workers 2 --access-logfile -"]
