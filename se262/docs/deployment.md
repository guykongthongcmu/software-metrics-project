## Documentation Version
- Current: v1.1.0
- Last updated: 2026-03-26
- Owner: Core&Co Team
- Changelog: [CHANGELOG.md](../CHANGELOG.md)

## CI/CD Deployment Guide (Dev)

This project deploys automatically from GitHub Actions to AWS EC2 for both:
- `main`
- `development`

The pipeline is image-based:
1. Build backend/frontend Docker images in GitHub Actions.
2. Push images to Docker Hub.
3. Deploy on EC2 with `docker compose -f docker-compose.prod.yml`.

## Workflows

### 1) CI (`.github/workflows/ci.yml`)
Trigger:
- Pull requests targeting `main` and `development`

Checks:
- Root app dependency install (`npm ci`)
- Backend app dependency install (`cd backend && npm ci`)
- Optional test scripts (`npm run test --if-present`)

### 2) Deploy (`.github/workflows/deploy.yml`)
Trigger:
- Push to `main` and `development`

Jobs:
- Build and push backend/frontend images to Docker Hub
- Deploy on EC2 by pulling tagged images
- Run smoke checks after deployment

## Required GitHub Secrets

Docker Hub:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

EC2 SSH:
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_PRIVATE_KEY`
- `EC2_APP_DIR`
- optional: `EC2_PORT` (default `22`)

Post-deploy smoke checks:
- `DEV_BACKEND_HEALTH_URL` (example: `http://<ec2-ip>:3000/health`)
- `DEV_FRONTEND_URL` (example: `http://<ec2-ip>:8080`)

## EC2 One-Time Setup

1. Install Docker and Docker Compose plugin.
2. Create deployment directory (same path as `EC2_APP_DIR`).
3. Ensure runtime env files exist:
   - `${EC2_APP_DIR}/.env`
   - `${EC2_APP_DIR}/backend/.env`
4. Ensure inbound security-group rules allow required ports (`8080`, `3000`, and `22` for SSH if needed).

## Production Compose Notes

`docker-compose.prod.yml` uses:
- MySQL container with persistent volume `mysql_data`
- Backend image from `${BACKEND_IMAGE}`
- Frontend image from `${FRONTEND_IMAGE}`
- Internal container healthchecks using `127.0.0.1` (container-local loopback)

## Smoke Checks

The deployment validates:
- Backend health endpoint (`/health`)
- Frontend page load via a browser-level headless check

If any smoke check fails, the workflow fails.

## Rollback

Recommended rollback options:
1. Revert the deploy-related commit and push again.
2. Redeploy last known-good image tags for backend/frontend.
3. Re-run deploy workflow after restoring previous image tags/config.

When rolling back, keep existing `.env` files unchanged unless the rollback requires environment changes.
