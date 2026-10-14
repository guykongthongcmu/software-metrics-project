# Core&Co (se327)

React + Vite frontend, Django + DRF backend, PostgreSQL.

## Run everything with Docker

This compose file is for local use only and needs Docker Compose 2.24 or newer (it uses `env_file` with `required: false`).

From this folder:

```bash
docker compose up --build
```

This starts three containers:

| Service | What it is | Reachable at |
| --- | --- | --- |
| `frontend` | nginx serving the built React app | http://localhost:8080 |
| `backend` | Django served by gunicorn | only through the frontend, at `/api` and `/media` |
| `db` | PostgreSQL 16 | inside the compose network only |

nginx proxies `/api`, `/media` and `/health` to the backend, so the browser only talks to http://localhost:8080. That keeps cookies and CORS out of the way. The frontend is built with `VITE_API_BASE_URL=/api`.

On start the backend waits for the database, runs `migrate`, and runs `seed_demo` when `SEED_DEMO` is true (the default in compose). The seed only runs when the catalogue has no products, so restarting never overwrites edits made in the admin. To skip it:

```bash
SEED_DEMO=false docker compose up --build
```

To seed by hand: `docker compose exec backend python manage.py seed_demo` (this resets the demo rows to their seeded values, including the admin password).

### Admin login

The seed creates `admin@coreco.test` with password `secret123` (see `backend/README.md` for the variables that change this).

### Configuration

Defaults for a plain local run live in `backend/docker.env` (`DEBUG=true`, a dev secret key, CORS for http://localhost:8080). If `backend/.env` exists it is loaded on top, so your Supabase and SMTP keys are picked up. The database settings (`DB_*`) and `PORT` are always forced to match the compose database, whatever `.env` says. Keep `DEBUG=true` over plain http, otherwise the session cookie is marked secure and the browser will not send it.

If a line in `backend/.env` is malformed (for example a quote closed in the wrong place on `MAIL_FROM`), it is ignored with a warning and that value is left unset.

gunicorn is used instead of `runserver` because it is the same command you would run in production and it handles concurrent requests. Edits to backend code need `docker compose up --build` to show up.

### Uploaded images

If `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SUPABASE_PRODUCT_BUCKET` are set in `backend/.env`, uploads go to Supabase. Otherwise they are written to `/app/media` in the backend container, which is the named volume `media`, and served from `/media/`.

### Dependency lock file

The backend image installs from `backend/requirements.lock` with hash checking, while CI and local development keep using `requirements.txt`. After changing `requirements.txt`, regenerate the lock (pip-tools is not a project dependency, install it in a scratch venv). Run it with Python 3.12 so the markers match the image, for example from a `python:3.12-slim` container:

```bash
cd backend
pip-compile --generate-hashes --allow-unsafe --strip-extras -o requirements.lock requirements.txt
```

A backend test fails if the versions in the two files drift apart.

### Stop and reset

```bash
docker compose down        # stop, keep database and uploads
docker compose down -v     # stop and delete the database and uploads
```
