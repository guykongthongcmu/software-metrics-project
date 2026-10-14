#!/bin/sh
set -e

# wait until postgres accepts connections
python - <<'PY'
import os, sys, time
import psycopg

for attempt in range(30):
    try:
        psycopg.connect(
            host=os.environ.get('DB_HOST', 'localhost'),
            port=os.environ.get('DB_PORT', '5432'),
            user=os.environ.get('DB_USER', 'postgres'),
            password=os.environ.get('DB_PASSWORD', ''),
            dbname=os.environ.get('DB_NAME', 'core_co'),
            connect_timeout=3,
        ).close()
        sys.exit(0)
    except psycopg.OperationalError:
        print('waiting for the database...', flush=True)
        time.sleep(2)
print('database not reachable', file=sys.stderr)
sys.exit(1)
PY

python manage.py migrate --noinput

case "$(echo "${SEED_DEMO:-false}" | tr 'A-Z' 'a-z')" in
  1|true|yes|on) python manage.py seed_demo ;;
esac

exec "$@"
