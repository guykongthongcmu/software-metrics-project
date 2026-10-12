## Documentation Version
- Current: v1.2.0
- Last updated: 2026-03-12
- Owner: Core&Co Team
- Changelog: [CHANGELOG.md](../CHANGELOG.md)

## Frontend (Core & Co)

This frontend is an Express + EJS app located in `frontend/` and started by the root `package.json`.

## Features
- Webstore homepage with hero banner and "New Arrivals"
- Admin and webstore EJS layouts with reusable partials
- Search page with filtering and sorting
- JSON endpoint for new arrivals
- Responsive UI for desktop/mobile

## Tech Stack
- Node.js + Express
- EJS + `express-ejs-layouts`
- Static assets in `frontend/public`
- Views in `frontend/views`

## Run Locally

Run commands from the repository root (not from `frontend/`):

```bash
npm ci
npm start
```

Frontend URL:
- [http://localhost:8080](http://localhost:8080)

## Key Routes
- `/` webstore home
- `/search` product search
- `/login` webstore login
- `/account/profile` user profile
- `/admin/login` admin login
- `/admin/dashboard` admin dashboard
- `/admin/orders` order list
- `/admin/products` product list

## API Endpoint
- `GET /products/new-arrivals` returns the 4 most recently added products as JSON

## Docker Compose (Frontend)

Because `package.json` and `package-lock.json` are at the repo root, the frontend container should mount the whole repo and run from `/app`.

Example service:

```yaml
frontend:
  image: node:22-alpine
  working_dir: /app
  volumes:
    - ./:/app
    - /app/node_modules
  ports:
    - "8080:8080"
  depends_on:
    - backend
  command: sh -c "npm ci && node frontend/server.js"
```

Start frontend service:

```bash
docker compose up --build frontend
```

## Troubleshooting
- Error: "`npm ci` can only install with an existing package-lock.json"
  - Cause: container is running in `./frontend` where no lockfile exists.
  - Fix: set `working_dir: /app` and mount `./:/app`.
- App not reachable
  - Ensure port mapping matches app port (`3002:3002`).
