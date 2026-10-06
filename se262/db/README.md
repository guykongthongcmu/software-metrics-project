## Documentation Version
- Current: v1.4.0
- Last updated: 2026-03-26
- Owner: Core&Co Team
- Changelog: [CHANGELOG.md](../CHANGELOG.md)

## How to run Local DB Testing

### 1) Start MySQL with Docker Compose
```bash
docker compose up -d mysql
docker compose ps
```

MySQL is exposed on `localhost:3307` with:
- user: `root`
- password: `rootpass`
- database: `core_co`

### 2) Wait for healthy status
```bash
docker compose ps
```
Wait until service shows healthy.

### 3) Verify schema was initialized
```bash
docker exec -it coreco-mysql mysql -uroot -prootpass -D core_co -e "SHOW TABLES;"
```

### 4) Re-run schema manually (without wiping volume)
```bash
docker exec -i coreco-mysql mysql -uroot -prootpass < db/init/001_init.sql
```

### 5) Full clean reset (recommended for repeatable tests)
```bash
docker compose down -v
docker compose up -d mysql
docker exec -it coreco-mysql mysql -uroot -prootpass -D core_co -e "SHOW TABLES;"
```

### 6) Stop database
```bash
docker compose down
```

## Manual Seed Data

### A) Full Demo Reset Seed (No Media)

Use this to wipe current records and seed a complete local demo baseline:
- categories + EN/TH category translations
- products + EN/TH product translations
- active variants
- users + addresses
- 20 purchased orders + order items
- one active admin account

Seed file:
- `db/seeds/001_seed_demo_no_media.sql`

Run:
```bash
docker compose up -d mysql
docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/001_seed_demo_no_media.sql
```

Admin login seeded:
- email: `admin@coreco.local`
- password: `Admin123!`

Notes:
- This script intentionally seeds `product_media` as empty (`0` rows).
- Use `db/seeds/002_media_backfill_template.sql` after uploading files from `db/webstore-assets` to Supabase.

### B) New Arrivals Manual Seed

Seed file:
- `db/seeds/new_arrivals_manual.sql`

Run it:
```bash
docker compose up -d mysql
docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/new_arrivals_manual.sql
```

What it covers:
- thumbnail vs hero image fallback
- first-image fallback by `sort_order`
- EN/TH translation fallback
- discount pricing
- out-of-stock products
- products excluded for missing media
