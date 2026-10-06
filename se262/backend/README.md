## Documentation Version
- Current: v1.20.0
- Last updated: 2026-03-26
- Owner: Core&Co Team
- Changelog: [CHANGELOG.md](../CHANGELOG.md)

## Backend Running Guide

### Prerequisites
- Node.js 22+
- Docker + Docker Compose

### Environment Variables
Backend DB defaults are set in `backend/src/config/db.js`.

- `PORT` (default: `3000`)
- `CORS_ALLOWED_ORIGINS` (required for browser CORS, comma-separated allowlist, e.g. `http://localhost:8080`)
- `DB_HOST` (default: `localhost`)
- `DB_PORT` (default: `3307`)
- `DB_USER` (default: `root`)
- `DB_PASSWORD` (default: `rootpass`)
- `DB_NAME` (default: `core_co`)
- `SMTP_HOST` (required for email sending)
- `SMTP_PORT` (default: `587`)
- `SMTP_USER` (required for email sending)
- `SMTP_PASS` (required for email sending)
- `MAIL_FROM` (required for email sending, e.g. `Core&Co <no-reply@coreco.local>`)
- `APP_BASE_URL` (required for verification link generation, e.g. `http://localhost:3000`)
- `EMAIL_VERIFICATION_EXPIRY_MINUTES` (optional, default: `5`)
- `SESSION_TTL_HOURS` (optional, default: `24`)
- `SESSION_COOKIE_SAMESITE` (optional: `lax` | `strict` | `none`, default: `lax`)
- `WEBSTORE_BASE_URL` (optional, used for the verify-email success/error page CTA button)
- `MAIL_BRAND_NAME` (optional, default: `Core&Co`)
- `SUPPORT_EMAIL` (optional, used in email footer)
- `MAIL_LOGO_URL` (optional, hosted logo URL)
- `MAIL_LOGO_PATH` (optional, local file path for CID inline logo, example: `src/assets/logo.png`)
- `SUPABASE_URL` (required for product media upload)
- `SUPABASE_SECRET_KEY` (required for product media upload)
- `SUPABASE_PRODUCT_BUCKET` (optional, default: `product-images`)

When running inside Docker Compose, backend uses:
- `DB_HOST=mysql`
- `DB_PORT=3306`
- set `CORS_ALLOWED_ORIGINS` in the backend service environment (for local compose, usually `http://localhost:8080`)

### Option A: Run Backend Locally + MySQL in Docker
From repository root:

```bash
docker compose up -d mysql
```

From `backend/`:

```bash
npm ci
npm run dev
```

Backend health check:

```bash
curl http://localhost:3000/health
```

### Option B: Run Backend + MySQL Together via Docker Compose
From repository root:

```bash
docker compose up --build
```

Services:
- Backend: `http://localhost:3000`
- MySQL host port: `localhost:3307`

### Notes
- SQL init scripts in `db/init/` run automatically only when the MySQL volume is first created.
- To reset database and re-run init scripts:

```bash
docker compose down -v
docker compose up -d mysql
```

## CORS and Cross-Origin Cookies

Current backend CORS behavior:
- CORS applies to all API routes.
- Allowed origins are read from `CORS_ALLOWED_ORIGINS`.
- Wildcard origin (`*`) is not used.
- Approved origins receive:
  - `Access-Control-Allow-Origin: <request_origin>`
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
  - `Access-Control-Allow-Headers: <requested_headers>` (fallback `Content-Type, Authorization`)
- Preflight (`OPTIONS`) returns `204 No Content` for approved origins.
- Unapproved origins receive `403` with `CORS_ORIGIN_NOT_ALLOWED`.

Frontend requirement for cookie-based auth:
- Browser requests must include credentials (`credentials: 'include'` or `withCredentials: true`).
- For same-site local dev across ports (for example `localhost:8080` -> `localhost:3000`), `SameSite=Lax` cookies are usually enough.
- For true cross-site frontend/backend domains, cookies must be `SameSite=None; Secure`, and HTTPS is required.

## Auth API

Base path: `/api/auth`

### 1) Check Email
`POST /check-email`

Request:
```json
{
  "email": "user@example.com"
}
```

Success:
- `200` `email is valid and available`

Errors:
- `400` `MISSING_REQUIRED_FIELDS`
- `400` `INVALID_EMAIL_FORMAT`
- `409` `EMAIL_ALREADY_EXISTS`
- `500` `INTERNAL_SERVER_ERROR`

### 2) Signup
`POST /signup`

Request:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "DOB": "2005-08-10",
  "phone_number": "0812345678"
}
```

Success:
- `201` `user registered successfully`

Errors:
- `400` `MISSING_REQUIRED_FIELDS`
- `400` `INVALID_EMAIL_FORMAT`
- `400` `PASSWORD_TOO_SHORT`
- `409` `EMAIL_ALREADY_EXISTS`
- `500` `INTERNAL_SERVER_ERROR`

### Session Signin / Logout

- `POST /user/signin` creates a persisted `USER` session and sets `Set-Cookie: session=<token>`
- `POST /admin/signin` creates a persisted `ADMIN` session and sets `Set-Cookie: session=<token>`
- `POST /logout` revokes the current session and clears the `session` cookie

Session cookie behavior:
- `HttpOnly` is always enabled
- `Secure` is enabled in production (`NODE_ENV=production`)
- `SameSite` is controlled by `SESSION_COOKIE_SAMESITE` (default `lax`)
- cookie expiry aligns with `SESSION_TTL_HOURS`

Protected routes:
- `/api/client/*` requires a valid active `USER` session from cookie
- `/api/admin/*` requires a valid active `ADMIN` session from cookie
- missing/invalid/revoked/expired sessions return `401 UNAUTHORIZED`
- non-admin session on admin routes returns `403 FORBIDDEN`

## Admin Product Backend Flow

Base admin path: `/api/admin`  
Auth: send `Cookie: session=<admin-session-token>` from `POST /api/auth/admin/signin`

### Category Visibility

Use category endpoints to drive admin category management and storefront category filtering.

- `GET /categories?sort=category_name&order=asc`
- `PATCH /categories/:id/visibility` with `{ "isHidden": true|false }`
- `GET /api/client/categories?sort=category_name&order=asc` (visible categories only)

Behavior:
- admin category list is DB-backed and sorted by `category_name`
- toggling visibility persists into `category.is_hidden`
- hidden categories are excluded from `/api/client/categories`
- storefront category slug filtering (`/api/client/products/category/:category`) ignores hidden categories

### Dashboard Summary

Use `GET /dashboard/summary` to fetch dashboard KPIs and chart series in one response.

Supported query patterns:
- `GET /dashboard/summary`
- `GET /dashboard/summary?period=7d`
- `GET /dashboard/summary?period=30d`
- `GET /dashboard/summary?period=custom&from=2026-03-01&to=2026-03-23`

Response fields:
- `period.from`
- `period.to`
- `period.granularity`
- `revenue.total`
- `revenue.growth`
- `orders.total`
- `orders.growth`
- `productsSold.total`
- `productsSold.growth`
- `charts.labels`
- `charts.revenue`
- `charts.orders`
- `charts.productsSold`

Current implementation notes:
- chart labels are returned as `YYYY-MM-DD` date buckets
- chart arrays are aligned by index with `charts.labels`
- growth compares the selected range against the previous equivalent range
- dashboard aggregation counts only orders with status `PURCHASED`

### Campaigns

Use these endpoints to create admin campaigns and expose active campaign content to the storefront.

- `POST /api/admin/campaigns` (admin session required)
- `GET /api/client/campaigns?lang=EN`

Behavior:
- supported types: `BEST_SELLER`, `PERCENTAGE_DISCOUNT`, `FIXED_DISCOUNT`
- discount campaigns require `discountValue` + `productIds`
- best-seller campaign resolves the top-selling product using `order_item` aggregation
- discount campaigns persist campaign discount fields directly on `products`
- client endpoint returns only active campaigns (`status=ACTIVE` and date-window match)

### Create Product

Use `POST /products` with `multipart/form-data`.

- Text field `payload`: JSON string for the product core/category/variant/media metadata
- File field `mediaFiles`: 1-4 uploaded images, in the same order as `payload.media`

`payload` shape:

```json
{
  "productType": "TOP",
  "status": "ACTIVE",
  "translations": [
    { "languageCode": "en", "name": "Classic Tee", "description": "Soft cotton tee" },
    { "languageCode": "th", "name": "เสื้อยืดคลาสสิก", "description": "เสื้อคอตตอนนุ่ม" }
  ],
  "categories": [
    { "categoryId": 12, "isPrimary": true },
    { "categoryId": 21, "isPrimary": false }
  ],
  "variants": [
    {
      "sku": "TEE-BLK-M",
      "colour": "BLACK",
      "size": "M",
      "price": 790,
      "compareAtPrice": 990,
      "stockQty": 20
    }
  ],
  "media": [
    {
      "sortOrder": 1,
      "isThumbnail": true,
      "isHero": true,
      "altText": "Classic tee front view"
    }
  ]
}
```

Current backend rules:
- `productType` must be `TOP`, `BOTTOM`, or `ACCESSORY`
- `translations` must contain both `EN` and `TH`
- exactly one primary category is required
- at least one variant is required
- at least one image is required and at most four are allowed
- exactly one thumbnail image and one hero image are required
- the whole database write runs in one transaction, and uploaded files are removed if the create flow fails

### Verify In Admin

- `GET /products?page=1&limit=20&search=linen&category=12&lang=EN`
- `GET /products/:productId?lang=EN`
- `PUT /products/:productId?lang=EN`
- `DELETE /products/:productId` (default soft-delete)
- `DELETE /products/:productId?mode=HARD` (explicit hard-delete)
- `GET /products/:productId/images`

### Verify In Client-Facing Reads

- `GET /api/client/products?lang=EN`
- `GET /api/client/products/:productId?lang=TH`
- `GET /api/client/products/search?q=linen&page=1&limit=12&sort=relevance&lang=EN`
- `GET /api/client/products/search/suggestions?q=lin&lang=EN`
- `GET /api/client/products/recommendations?limit=4&context=cart&category=men-shirts&excludeProductIds=101,102&lang=EN`
- `GET /api/client/products/category/men-shirts?page=1&limit=12&sort=newest&lang=EN`
- `GET /api/client/categories?sort=category_name&order=asc`
- `GET /api/client/favorites?lang=EN` (requires `session` cookie)
- `POST /api/client/favorites/101?lang=EN` (requires `session` cookie)
- `DELETE /api/client/favorites/101?lang=EN` (requires `session` cookie)
- `GET /api/client/products/new-arrivals?lang=EN`
- `GET /api/client/cart?lang=EN` (requires `session` cookie)
- `POST /api/client/cart/items?lang=EN` (requires `session` cookie)
- `PUT /api/client/cart/items/88?lang=EN` (requires `session` cookie)
- `DELETE /api/client/cart/items/88` (requires `session` cookie)
- `GET /api/client/checkout/address` (requires `session` cookie)
- `PUT /api/client/checkout/address` (requires `session` cookie)
- `POST /api/client/checkout/purchase` (requires `session` cookie)

Storefront detail endpoint (`GET /api/client/products/:productId`) returns a frontend-ready payload:
- response envelope: `status`, `message`, `data`
- detail payload: `productId`, `name`, `detail`, `category`, `color`, `price`, `originalPrice`, `discount`, `size`, `image`, `inStock`
- detail is `404 PRODUCT_NOT_FOUND` when product is missing/inactive or not storefront-ready (no active variants/media)

Storefront search/category endpoints:
- `GET /api/client/products/search` returns paginated products by name query (`q`) with empty `products: []` for no matches
- `GET /api/client/products/search/suggestions` returns lightweight autocomplete suggestions
- `GET /api/client/products/recommendations` returns deterministic recommendation cards without requiring search query input
- `GET /api/client/products/category/:category` returns paginated products for a category slug or `404 CATEGORY_NOT_FOUND`

Cart endpoint:
- `GET /api/client/cart` returns the authenticated user's cart with `items`, per-item `lineTotal`, and `cartSummary` (`totalItems`, `subtotal`)
- missing/empty cart returns `200` with `cartId: null`, `items: []`, and zero totals
- `POST /api/client/cart/items` adds by `productId + color + size`, auto-creates active cart when needed, and increments quantity if the variant is already in cart
- `PUT /api/client/cart/items/:itemId` updates `quantityCartItem` for an existing cart item in the authenticated user's active cart
- `DELETE /api/client/cart/items/:itemId` removes an existing item from the authenticated user's active cart and returns updated `cartSummary`
- cart write endpoints return `409 INSUFFICIENT_STOCK` when requested quantity exceeds variant stock

Checkout endpoints (mock payment flow):
- `GET /api/client/checkout/address` returns the signed-in user's checkout address or `address: null`
- `PUT /api/client/checkout/address` creates/updates checkout address with payload validation
- `POST /api/client/checkout/purchase` performs mock purchase (no real payment gateway), creates order + order items from active cart with order status `PURCHASED`, then marks cart as converted

### Admin Orders

Use these endpoints to manage and inspect purchased orders from the admin panel.

- `GET /orders?page=1&limit=20&status=PURCHASED&search=john`
- `GET /orders/:orderId`
- `PATCH /orders/:orderId`
- `DELETE /orders/:orderId`

Behavior:
- list endpoint supports pagination with `page` and `limit`
- optional filters: `status` (currently `PURCHASED` only) and free-text `search`
- detail endpoint returns order header + customer info + shipping/billing snapshots + line items
- patch endpoint currently allows admin correction of the stored order address snapshot and mirrors the update to billing snapshot
- delete endpoint permanently removes the order row; `order_item` and `receipt` rows are removed through existing FK cascades
- invalid query/id returns `400`; missing order returns `404`; invalid patch payload returns `400 VALIDATION_ERROR`

Favorites endpoints:
- favorites are persisted in `wishlist` per authenticated user session
- `GET /api/client/favorites` returns `{ favoritesCount, products }` and `200` with empty array when no favorites exist
- `POST /api/client/favorites/:productId` and `DELETE /api/client/favorites/:productId` are idempotent
