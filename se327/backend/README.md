# Core&Co backend

Django 5.2 + Django REST Framework on PostgreSQL.

## Seeding demo data

One command loads the demo catalogue and an admin account:

```bash
python manage.py migrate
python manage.py seed_demo
```

It creates:

- the five top-level categories (Men, Women, Kids, Baby, Unisex) with EN and TH names, all visible
- 62 demo products with EN and TH names and descriptions, two variants each (colour, size, price, stock) and a hero and thumbnail image
- one admin account

The command is idempotent. Running it again updates the same rows instead of adding duplicates.

To wipe the catalogue tables and the seeded admin before seeding again:

```bash
python manage.py seed_demo --reset
```

For a full database reset, drop and recreate the database (or run `python manage.py flush`), then run `migrate` and `seed_demo`.

### Admin account

| Variable | Purpose | Default |
| --- | --- | --- |
| `SEED_ADMIN_EMAIL` | Admin login email | `admin@coreco.test` |
| `SEED_ADMIN_PASSWORD` | Admin password (stored hashed) | `secret123`, only when `DEBUG=true` |

With `DEBUG` off the command refuses to run unless `SEED_ADMIN_PASSWORD` is set. Re-running with a different password updates the stored hash.

### Images

Product images come from the existing demo files in `se327/frontend/public/images`, which the frontend serves at `/images/<file>`. The seed stores `/images/<file>` as each image's `public_url`. Nothing is uploaded to Supabase by the command. If you upload the files to a bucket yourself, set `SEED_IMAGE_BASE_URL` to the bucket's public URL before seeding and the stored URLs will use it. `bucket_name` is taken from `SUPABASE_PRODUCT_BUCKET`, or `local` when that is empty.

## Image storage

Product images are uploaded through `common/storage.py`. If `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `SUPABASE_PRODUCT_BUCKET` are all set, files go to that Supabase Storage bucket and the API returns the bucket's public URL. With any of them missing, files are written under `MEDIA_DIR` (default `backend/media`) and served from `/media/`.

Create the bucket in the Supabase dashboard and mark it public. Use the service role key, which must never reach the frontend. Campaign banners are still stored locally.

## Tests

```bash
SECRET_KEY=x python manage.py test
```

Tests need a PostgreSQL server reachable with the `DB_*` settings.
