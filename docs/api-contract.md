# API Contract

Contract for the rebuilt Core&Co backend (Django with Django REST Framework, PostgreSQL). It lists every endpoint the rebuild exposes: path, auth requirement, request, success response and error codes, together with the shared response envelope and the cookie and session rules.

Sources: backend issues #3 to #19, the legacy routes in `se262/backend/src/routes`, and the envelope in `se327/backend/common/responses.py` and `exceptions.py`. Where these disagree, the endpoint text follows the legacy code (the issue says to trust the routes) and the difference is recorded in [Open questions](#open-questions). Entries marked (OQ n) point to the matching question.

Status: draft, not yet reviewed by the UI and frontend owner (task 4 of issue #4).

## Contents

1. Conventions
2. Shared envelope and error codes
3. Cookies, sessions and access guards
4. Auth endpoints
5. Storefront catalogue endpoints
6. Favourites, cart and checkout endpoints
7. Admin endpoints
8. Campaign endpoints
9. Shared data shapes
10. Open questions

## 1. Conventions

- Base path is `/api`. Groups: `/api/auth`, `/api/client` (storefront), `/api/admin`. `GET /health` returns `{"status": "ok"}` and is the only route outside the envelope.
- Request and response bodies are JSON (`application/json`). Three admin endpoints take `multipart/form-data` and are marked as such.
- JSON field names are camelCase, except in the auth group, which keeps the legacy snake_case names (`first_name`, `phone_number`, `DOB`, `new_password`). Dates use `YYYY-MM-DD`, timestamps use ISO 8601, money is a JSON number with two decimals.
- IDs are positive integers. A malformed ID returns 400 with a route specific code (for example `INVALID_PRODUCT_ID`).
- `lang` (query) accepts `EN` or `TH` and defaults to `EN`. It selects the product or category name and description. Storefront endpoints that return text accept it.
- Paging: `page` starts at 1. Storefront default `limit` is 12 (max 50). Admin product and order lists default to 20 (max 100). Out of range values are clamped by the server, not rejected, except where an error is listed.
- Auth column values: `none`, `customer` (valid customer session), `admin` (valid admin session), `any session` (customer or admin).

## 2. Shared envelope and error codes

### Success

```json
{ "status": "success", "message": "optional text", "data": { } }
```

`message` and `data` are omitted when empty. Every endpoint below states only its `data` value.

### Error

```json
{ "status": "error", "code": "UPPER_SNAKE_CASE", "message": "human readable text" }
```

`code` is the stable value clients branch on. `message` is for display and logs and may change. Validation errors may carry an extra field (see OQ 2).

### Common codes

These can be returned by any endpoint and are not repeated in the tables unless the endpoint adds detail.

| HTTP | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed request that no specific code covers |
| 401 | `UNAUTHORIZED` | No session cookie, or the session is unknown, expired or revoked |
| 403 | `FORBIDDEN` | Session is valid but the wrong kind (customer on an admin route, admin on a customer route) or the admin is inactive |
| 403 | `CORS_ORIGIN_NOT_ALLOWED` | `Origin` header is not on the allowlist |
| 404 | `NOT_FOUND` | Unknown route |
| 405 | `METHOD_NOT_ALLOWED` | Route exists, method does not |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Body type not accepted by the endpoint |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled error. No stack trace or internal detail in the body |

NUL bytes and lone surrogates cannot be stored, so any of them in the path, a query parameter or a JSON body is refused with 400 before the endpoint runs: `INVALID_QUERY` for the path and query string, `INVALID_FIELD_LENGTH` for a JSON body. Endpoints that check their own text (reset password, checkout address, admin categories and products) keep their own error codes.

Standard messages: 401 `authentication is required`, 403 `admin access required` or `customer access required`, 500 `internal server error`.

### CORS

Only origins in `CORS_ALLOWED_ORIGINS` are accepted. The origin is echoed back (never `*`) with `Access-Control-Allow-Credentials: true`. Allowed methods are `GET, POST, PUT, PATCH, DELETE, OPTIONS`. `OPTIONS` preflight returns 204 with no body. Clients must send requests with credentials.

## 3. Cookies, sessions and access guards

| Item | Rule |
|---|---|
| Cookie name | `session` |
| Value | Opaque random token. The server stores it in a `sessions` row with subject type (`USER` or `ADMIN`), owner, expiry and revoked time |
| Set by | `POST /api/auth/user/signin` and `POST /api/auth/admin/signin` |
| Flags | `HttpOnly`, `Path=/`, `SameSite=Lax`, `Secure` outside local development (OQ 12) |
| Expiry | Cookie `Expires` equals the session expiry. Lifetime is `SESSION_TTL_HOURS`, default 24, fixed from sign in (no sliding renewal) |
| Revocation | `POST /api/auth/logout` sets the revoked time and clears the cookie. A successful password reset revokes all of that customer's sessions |
| Invalid session | Missing cookie, unknown token, revoked or expired session: 401 `UNAUTHORIZED` |
| Customer guard | Needs a `USER` session. An `ADMIN` session gets 403 (OQ 9) |
| Admin guard | Needs an `ADMIN` session for an active admin. A `USER` session gets 403. No session gets 401 |
| Multiple sessions | Each sign in creates its own session. Signing in does not revoke others |
| Anonymous viewer cookie | `viewer_id`: random token, `HttpOnly`, `SameSite=Lax`, `Path=/`, one year. Set by `GET /api/client/products/:productId` when the visitor has no session and no `viewer_id`. Used only to count unique viewers |

A session created by one guard type is never accepted by the other. Sign out is one shared endpoint for both kinds.

## 4. Auth endpoints

Base `/api/auth`. Email is trimmed and lower-cased. Email format: `something@something.tld`. Minimum password length is 8.

| Endpoint | Auth | Request | Success `data` | Errors |
|---|---|---|---|---|
| `POST /check-email` | none | `{ email }` | 200 `{ email }` | 400 `MISSING_REQUIRED_FIELDS`, 400 `INVALID_EMAIL_FORMAT`, 409 `EMAIL_ALREADY_EXISTS` |
| `POST /signup` | none | `{ email, password, first_name, last_name, DOB, phone_number }`, all required | 201 [SignupResult](#9-shared-data-shapes) | 400 `MISSING_REQUIRED_FIELDS` (adds `missingFields`), 400 `INVALID_EMAIL_FORMAT`, 400 `PASSWORD_TOO_SHORT`, 409 `EMAIL_ALREADY_EXISTS` |
| `GET /verify-email` | none | Query `token` (required), optional `format=json\|html` | 200 `{ user_id, email, email_verified: true }` | 400 `MISSING_REQUIRED_FIELDS`, 400 `INVALID_VERIFICATION_TOKEN`, 409 `VERIFICATION_TOKEN_ALREADY_USED`, 410 `VERIFICATION_TOKEN_EXPIRED`, 409 `EMAIL_ALREADY_VERIFIED` |
| `POST /resend-verification` | none | `{ email }` | 200 `{ email, verification_email_sent }` | 400 `MISSING_REQUIRED_FIELDS`, 400 `INVALID_EMAIL_FORMAT`, 404 `USER_NOT_FOUND`, 409 `EMAIL_ALREADY_VERIFIED` |
| `POST /user/signin` | none | `{ email, password }` | 200 [SessionInfo](#9-shared-data-shapes) with `role: "user"`; sets cookie | 400 `MISSING_REQUIRED_FIELDS`, 400 `INVALID_EMAIL_FORMAT`, 401 `INVALID_CREDENTIALS` |
| `GET /user/profile` | customer | none | 200 [Profile](#9-shared-data-shapes) | 401, 403, 404 `USER_NOT_FOUND` |
| `POST /admin/signin` | none | `{ email, password }` | 200 SessionInfo with `role: "admin"`; sets cookie | 400 as above, 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_INACTIVE` |
| `POST /forgot-password` | none | `{ email }` | 200, no `data`. Same reply whether or not the email exists | 400 `MISSING_REQUIRED_FIELDS`, 400 `INVALID_EMAIL_FORMAT` (OQ 11) |
| `POST /reset-password` | none | `{ token, new_password, confirm_password }` | 200 `{ password_reset: true }` | 400 `MISSING_REQUIRED_FIELDS` (adds `missingFields`), 400 `PASSWORD_TOO_SHORT`, 400 `PASSWORD_CONFIRMATION_MISMATCH`, 400 `INVALID_PASSWORD_RESET_TOKEN`, 409 `PASSWORD_RESET_TOKEN_ALREADY_USED`, 410 `PASSWORD_RESET_TOKEN_EXPIRED` |
| `POST /logout` | any session | none | 200 `{ sessionRevoked: true }`; clears cookie | 401 |

Behaviour notes

- Sign up stores the user unverified with a hashed password, creates a one-time verification token and emails the link. A failed send does not fail the request; `verification_email_sent` is then `false`.
- `verify-email` checks in this order: token exists, not used, not expired, user not already verified. With `format=html`, or an `Accept` header containing `text/html` and no `format=json`, the same outcome is returned as a branded HTML page with the same status code (OQ 10).
- `resend-verification` invalidates earlier unused verification tokens before issuing a new one.
- Token lifetimes: verification `EMAIL_VERIFICATION_EXPIRY_MINUTES` (default 5), reset `PASSWORD_RESET_EXPIRY_MINUTES` (default 15). Requesting a new reset link invalidates earlier unused ones.
- Admin accounts are seeded. There is no admin sign up.

## 5. Storefront catalogue endpoints

Base `/api/client`. All are `none` auth and read-only. Hidden categories and inactive products never appear. Card shapes are in [section 9](#9-shared-data-shapes).

| Endpoint | Query | Success `data` | Errors |
|---|---|---|---|
| `GET /categories` | `sort=category_name`, `order=asc\|desc` (default `asc`) | `{ categories: [CategorySummary] }`, visible only | 400 `INVALID_QUERY` |
| `GET /products` | `lang` | Array of ProductSummary, all active products, newest first, not paged (OQ 3) | 400 `INVALID_LANGUAGE` |
| `GET /products/new-arrivals` | `lang` | Array of up to 4 NewArrivalCard, newest first (OQ 5) | 400 `INVALID_LANGUAGE` |
| `GET /products/category/:category` | `lang`, `page`, `limit`, `sort=newest\|price_asc\|price_desc` (default `newest`; unknown value falls back to default) | `{ category: { categoryId, slug, name }, pagination, products: [ProductCard] }` | 404 `CATEGORY_NOT_FOUND` (also for hidden), 400 `INVALID_LANGUAGE` |
| `GET /products/search` | `q` (required), `lang`, `page`, `limit`, `sort=relevance\|newest\|price_asc\|price_desc` (default `relevance`) | `{ query, category: null, pagination, products: [ProductCardWithCategory] }` (OQ 6) | 400 `INVALID_QUERY` (missing or empty `q`), 400 `INVALID_LANGUAGE` |
| `GET /products/search/suggestions` | `q` (required), `lang` | `{ query, suggestions: [ProductCard] }`, at most 8 | 400 `INVALID_QUERY`, 400 `INVALID_LANGUAGE` |
| `GET /products/recommendations` | `lang`, `limit` (default 4, 1 to 20), `context`, `category` (slug), `excludeProductIds` (comma separated) | `{ context, limit, products: [ProductCard] }` | 400 `INVALID_QUERY`, 400 `INVALID_EXCLUDE_PRODUCT_IDS` (OQ 7) |
| `GET /products/:productId` | `lang` | [ProductDetail](#9-shared-data-shapes) (OQ 8) | 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` |
| `GET /products/:productId/variants` | `lang` | Array of Variant (colour and size pairs with stock) | 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` |
| `GET /products/:productId/images` | none | Array of Media, ordered by `sortOrder` | 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` |

Behaviour notes

- Recommendations fill up to `limit` from the given category first (newest), then from the newest products overall, skipping every ID in `excludeProductIds`. Duplicate IDs in the list are ignored. `context` is trimmed and lower-cased and echoed back.
- `GET /products/:productId` writes one product view event per call: the signed-in customer's ID, or an anonymous identifier taken from the `session` token or the `viewer_id` cookie. A failure to record the event never fails the request. A product with no active variant or no image returns 404.
- Search and category totals come from `pagination.totalItems`. `totalPages` is 0 when there are no results.

## 6. Favourites, cart and checkout endpoints

Base `/api/client`. Every endpoint needs a customer session (401 without one, 403 for an admin session). All accept `lang` where text is returned.

### Favourites

| Endpoint | Request | Success `data` | Errors |
|---|---|---|---|
| `GET /favorites` | none | `{ favoritesCount, products: [ProductCard] }`, newest favourite first | none beyond common |
| `POST /favorites/:productId` | none | 200 `{ productId, isFavorite: true, favoritesCount, product }` | 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` |
| `DELETE /favorites/:productId` | none | 200 `{ productId, isFavorite: false, favoritesCount }` | 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` (OQ 13) |

Adding is idempotent: the same product twice leaves one favourite and still returns 200.

### Cart

One active cart per customer, created on the first add. Cart shapes are in [section 9](#9-shared-data-shapes).

| Endpoint | Request | Success `data` | Errors |
|---|---|---|---|
| `GET /cart` | none | [Cart](#9-shared-data-shapes). With no cart: `cartId: null`, empty `items`, totals 0 | none beyond common |
| `POST /cart/items` | `{ productId, color, size, quantityCartItem }` | 201 `{ cartId, item: CartLine, cartSummary }` | 400 `INVALID_REQUEST`, 400 `INVALID_PRODUCT_ID`, 400 `INVALID_QUANTITY`, 400 `INVALID_VARIANT_SELECTION`, 404 `PRODUCT_NOT_FOUND`, 409 `INSUFFICIENT_STOCK` |
| `PUT /cart/items/:itemId` | `{ quantityCartItem }` (new absolute quantity) | 200 `{ cartId, item: CartLine, cartSummary }` | 400 `INVALID_ITEM_ID`, 400 `INVALID_QUANTITY`, 404 `CART_ITEM_NOT_FOUND`, 409 `INSUFFICIENT_STOCK` |
| `DELETE /cart/items/:itemId` | none | 200 `{ itemId, productId, cartSummary }` | 400 `INVALID_ITEM_ID`, 404 `CART_ITEM_NOT_FOUND` |

Adding a colour and size already in the cart increases that line's quantity. The resulting quantity must not exceed stock. `color` and `size` match an active variant case-insensitively.

### Checkout

| Endpoint | Request | Success `data` | Errors |
|---|---|---|---|
| `GET /checkout/address` | none | `{ address: Address \| null }`, the saved default shipping address | none beyond common |
| `PUT /checkout/address` | Address | 200 `{ address }`, creates or updates the default shipping address | 400 `INVALID_ADDRESS_PAYLOAD` (adds per-field messages) |
| `POST /checkout/purchase` | none | 200 `{ orderId, orderStatus: "PURCHASED", purchasedAt, cartSummary: { totalItems, subtotal } }` (OQ 14) | 400 `CHECKOUT_ADDRESS_REQUIRED`, 409 `CART_EMPTY`, 409 `CART_ITEM_UNAVAILABLE`, 409 `INSUFFICIENT_STOCK` |

Address fields: `fullName` (max 150), `phoneNumber` (7 to 20 chars of digits, `+ - ( )` and spaces), `addressLine1` (max 255), `addressLine2` (optional, max 255), `district` (max 120), `province` (max 120), `postalCode` (3 to 12 letters, digits, `-` or space), `country` (max 100). All required except `addressLine2`.

Purchase runs in one transaction. It stores an order with item and address snapshots, reduces variant stock, empties the cart and marks it converted. Payment is simulated. On any error nothing is written. Email verification is not checked (pending legacy-feature decision).

## 7. Admin endpoints

Base `/api/admin`. Every endpoint needs an admin session (401, or 403 for a customer session).

### Dashboard

| Endpoint | Query | Success `data` | Errors |
|---|---|---|---|
| `GET /dashboard/summary` | `period=7d\|30d\|weekly\|monthly\|custom` (default `weekly`, or `custom` when `from` or `to` is present), `from`, `to` (`YYYY-MM-DD`, required for `custom`) | [DashboardSummary](#9-shared-data-shapes) | 400 `INVALID_QUERY` (unknown period), 400 `INVALID_DATE_RANGE` (bad format, missing date or `from` after `to`) (OQ 15, 16) |

Period windows: `7d` and `30d` end today and cover 7 or 30 days. `weekly` is Monday to Sunday of the current week. `monthly` is January to December of the current year with one point per month. `custom` is the given range. Growth compares against the previous window of the same length. Only `PURCHASED` orders count.

### Categories

| Endpoint | Request | Success `data` | Errors |
|---|---|---|---|
| `GET /categories` | Query `sort=category_name`, `order=asc\|desc` | `{ categories: [AdminCategory] }` | 400 `INVALID_QUERY` |
| `POST /categories` | `{ categoryName }` (1 to 100 chars) | 201 AdminCategory | 400 `VALIDATION_ERROR`, 409 `CATEGORY_SLUG_CONFLICT` (OQ 17) |
| `PUT /categories/:id` | `{ categoryName }` | 200 AdminCategory | 400 `INVALID_CATEGORY_ID`, 400 `VALIDATION_ERROR`, 404 `CATEGORY_NOT_FOUND`, 409 `CATEGORY_SLUG_CONFLICT` |
| `PATCH /categories/:id/visibility` | `{ isHidden: boolean }` | 200 `{ categoryId, categoryName, slug, isHidden }` | 400 `INVALID_CATEGORY_ID`, 400 `INVALID_VISIBILITY_VALUE`, 404 `CATEGORY_NOT_FOUND` |
| `DELETE /categories/:id` | none | 200 `{ categoryId, success: true }` | 400 `INVALID_CATEGORY_ID`, 404 `CATEGORY_NOT_FOUND`, in-use failure (OQ 17) |

The slug is derived from the name (lower case, non-alphanumerics become `-`). Rename regenerates the slug. Hiding a category removes it from `GET /api/client/categories` and makes its landing endpoint return 404.

### Products

| Endpoint | Request | Success `data` | Errors |
|---|---|---|---|
| `GET /products` | Query `lang`, `page`, `limit`, `search` (name, case-insensitive), `category` (category ID, includes its child categories) | `{ page, limit, totalItems, totalPages, items: [ProductSummary] }`, includes inactive | 400 `INVALID_QUERY`, 400 `INVALID_LANGUAGE` |
| `GET /products/:productId` | Query `lang` | [AdminProductDetail](#9-shared-data-shapes) | 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` |
| `GET /products/:productId/images` | none | Array of Media, includes inactive products | 400, 404 as above |
| `POST /products` | `multipart/form-data` or JSON, see below | 201 `{ productId }` | 400 `VALIDATION_ERROR` (adds per-field `details`), 400 `INVALID_JSON`, 400 `INVALID_FILE_TYPE`, 413 `FILE_TOO_LARGE`, 409 `DUPLICATE_SKU`, 409 `DUPLICATE_VARIANT`, 500 `STORAGE_UPLOAD_FAILED`, 500 `PUBLIC_URL_FAILED`, 500 storage not configured |
| `PUT /products/:productId` | JSON, see below | 200 AdminProductDetail | 400 `VALIDATION_ERROR`, 404 `PRODUCT_NOT_FOUND`, 409 `DUPLICATE_SKU` (OQ 18) |
| `DELETE /products/:productId` | Query `mode=SOFT\|HARD` (default `SOFT`) | 200 `{ productId, deleted: true, mode }` | 400 `INVALID_QUERY`, 400 `INVALID_PRODUCT_ID`, 404 `PRODUCT_NOT_FOUND` (OQ 19) |
| `POST /products/:productId/image` | `multipart/form-data`, field `image` (JPEG, PNG or WebP, max 5 MB) plus optional `isThumbnail`, `isHero`, `sortOrder` (1 to 4), `altText` | 201 Media | 400 `IMAGE_REQUIRED`, 400 `INVALID_FILE_TYPE`, 413 `FILE_TOO_LARGE`, 400 `VALIDATION_ERROR`, 404 `PRODUCT_NOT_FOUND`, 409 `PRODUCT_IMAGE_LIMIT_REACHED` |
| `POST /products/:productId/images` | Same as `/image` (alias) | 201 Media | Same |

Create fields

- `productType`: `TOP`, `BOTTOM` or `ACCESSORY`.
- `status` (`ACTIVE` or `INACTIVE`) or `isActive` (boolean).
- `translations`: array with exactly one `EN` and one `TH` entry, each `{ languageCode, name (max 150), description }`.
- `categories`: at least one `{ categoryId, isPrimary }`, exactly one primary, no repeats.
- `variants`: at least one `{ sku (max 100, unique), colour (max 100), size (max 20), price (> 0), compareAtPrice (optional, not below price), stockQty (integer >= 0), isActive }`. Colour and size pairs are unique per product.
- `media`: one metadata entry per uploaded file `{ sortOrder, isThumbnail, isHero, altText (max 255) }`. Files are sent as `mediaFiles` (or `media`). Between 1 and 4 images; exactly one thumbnail and one hero; `sortOrder` values are unique.
- In `multipart/form-data`, `translations`, `categories`, `variants` and `media` are JSON strings, or the whole object can be sent as one JSON string field `payload`.
- The product, translations, categories, variants and images are saved in one transaction. Uploaded files are removed from storage if the create fails.

Update fields (any subset, at least one required): `name`, `description` (null clears it), `status` or `isActive`, `category_id` (becomes the primary category), and the variant fields `price`, `compare_at_price`, `stock`. Variant fields apply to the variant named by `sku`; `sku` may be left out only when the product has a single variant. `lang` selects which translation `name` and `description` change.

Images are stored in object storage and the public URL is saved with each Media row.

### Orders

| Endpoint | Request | Success `data` | Errors |
|---|---|---|---|
| `GET /orders` | Query `page`, `limit`, `status` (only `PURCHASED` accepted), `search` (customer email, name or address text) | `{ page, limit, totalItems, totalPages, items: [OrderSummary] }`, newest first | 400 `INVALID_QUERY` |
| `GET /orders/:orderId` | none | [OrderDetail](#9-shared-data-shapes) | 400 `INVALID_ORDER_ID`, 404 `ORDER_NOT_FOUND` |
| `PATCH /orders/:orderId` | `{ shippingAddressSnapshot: Address }` (address fields may also be sent at top level) | 200 OrderDetail | 400 `INVALID_ORDER_ID`, 400 `VALIDATION_ERROR` (adds per-field `details`), 404 `ORDER_NOT_FOUND` |
| `DELETE /orders/:orderId` | none | 200 `{ orderId, deleted: true }` | 400 `INVALID_ORDER_ID`, 404 `ORDER_NOT_FOUND` |

`PATCH` changes only the address snapshot (same eight fields and rules as checkout) and nothing else on the order. Deleting an order also removes its line items.

## 8. Campaign endpoints

| Endpoint | Auth | Request | Success `data` | Errors |
|---|---|---|---|---|
| `GET /api/client/campaigns` | none | Query `lang` | `{ campaigns: [Campaign] }`, status `ACTIVE` and today within start and end date, newest start first (OQ 20) | 400 `INVALID_QUERY` (bad `lang`) |
| `POST /api/admin/campaigns` | admin | JSON: `{ name (max 150), type, message (optional, max 255), startDate, endDate, discountValue, productIds }` | 201 `{ campaignId, name, type, status: "ACTIVE", startDate, endDate, discountValue, productIds, createdAt }` | 400 `VALIDATION_ERROR`, 400 `INVALID_CAMPAIGN_TYPE`, 404 `PRODUCT_NOT_FOUND` |
| `POST /api/admin/launch-campaign` | admin | `multipart/form-data`: file `mediaFile` (banner image) and text field `campaignData` (JSON string) | 201 launch result (below) | 400 `INVALID_CAMPAIGN_PAYLOAD`, 400 validation errors (OQ 21) |

Campaign types: `BEST_SELLER`, `PERCENTAGE_DISCOUNT`, `FIXED_DISCOUNT`. For the two discount types, `discountValue` is required (> 0, and at most 100 for percentage) and `productIds` must be a non-empty list of existing products. For `BEST_SELLER`, both must be absent and the server picks the top selling active product (400 `VALIDATION_ERROR` if nothing has sold). `startDate` must not be after `endDate`.

`campaignData` (launch): `{ name, type, discountValue, startDate, endDate, channels: { web: boolean, email: boolean } }`.

Launch result: `campaignData` echoed back plus `emailBlast: { enabled, totalRecipients, sentCount, failedCount, failedRecipients: [{ email, error }] }`. With the email channel off, `enabled` is false and all counts are 0. With it on, every customer with a verified email is sent the campaign email. A failed send is counted in `failedCount`, never fails the request. Where the banner image and text are stored is undecided (OQ 21).

Campaign (client) is either:

- discount types: `{ campaignId, name, type, message, startDate, endDate, discount: { type: "PERCENTAGE" \| "FIXED", value }, productIds }`
- `BEST_SELLER`: `{ campaignId, name, type, message, startDate, endDate, bestSellerProduct: { productId, name, image } \| null }`

## 9. Shared data shapes

Names below are used in the tables above. All money values are numbers.

**CategorySummary**: `{ categoryId, categoryName, slug, isHidden: false }`

**AdminCategory**: `{ categoryId, categoryName, slug, isHidden, parentCategoryId }` (`parentCategoryId` is null for top level categories: Men, Women, Kids, Baby, Unisex)

**ProductCard** (storefront): `{ productId, name, detail, color: [string], price, originalPrice \| null, discount: { type: "percentage", value } \| null, size: [string], image, inStock }`. `originalPrice` is the compare-at price and is set only when it is above `price`. `ProductCardWithCategory` adds `category: { categoryId, slug, name } \| null`.

**NewArrivalCard**: `{ productId, languageCode, name, imageUrl, imageAlt, price, compareAtPrice \| null, discountPercent \| null, inStock, createdAt }`

**ProductDetail** (storefront): `{ productId, name, detail, category: { categoryId, slug, name } \| null, color: [string], price, originalPrice \| null, discount, size: [string], image, inStock }`. Price is the lowest active variant price.

**Variant**: `{ productVariantId, sku, color, size, price, compareAtPrice \| null, stockQty, isActive }`

**Media**: `{ productMediaId, productId, bucketName, filePath, publicUrl, altText, sortOrder, isThumbnail, isHero, createdAt }`

**ProductSummary** (admin list; also `GET /api/client/products`): `{ productId, productType, isActive, status, languageCode, name, description, primaryCategoryId, primaryCategoryName, rootCategoryId, rootCategoryName, thumbnailUrl, thumbnailAlt, priceFrom, compareAtPriceFrom, totalStock, variantCount, createdAt, updatedAt }`

**AdminProductDetail**: `{ productId, productType, isActive, status, languageCode, name, description, translations: [{ productTranslationId, languageCode, name, description, createdAt, updatedAt }], categories: [{ categoryId, name, slug, isPrimary }], variants: [{ productVariantId, sku, colour, size, price, compareAtPrice, stockQty, isActive, createdAt, updatedAt }], media: [Media], createdAt, updatedAt }`. Note the admin variant uses `colour`, the storefront Variant uses `color` (OQ 5).

**Pagination** (storefront lists): `{ page, limit, totalItems, totalPages }`. Admin lists put the same four fields beside `items` (OQ 3).

**CartLine**: `{ itemId, productId, name, color, size, price, originalPrice, discount, image, inStock, quantityCartItem, lineTotal }`. `originalPrice` equals `price` when there is no compare-at price.

**Cart**: `{ cartId \| null, items: [CartLine], cartSummary: { totalItems, subtotal } }`

**Address**: `{ fullName, phoneNumber, addressLine1, addressLine2, district, province, postalCode, country }`

**SignupResult**: `{ user_id, email, first_name, last_name, DOB, phone_number, email_verified: false, verification_email_sent }`

**SessionInfo**: customer `{ role: "user", user_id, email, name, phone_number, email_verified, redirectTo: "/", session: { expiresAt } }`; admin `{ role: "admin", admin_id, email, name, redirectTo: "/dashboard", session: { expiresAt } }`.

**Profile**: `{ user_id, email, name, phone_number, date_of_birth, email_verified, created_at }`. `created_at` is the member-since date.

**OrderSummary**: `{ orderId, userId, status, subtotal, shippingFee, vatAmount, total, createdAt }`

**OrderDetail**: `{ orderId, userId, customer: { userId, email, name }, status, subtotal, shippingFee, vatAmount, total, shippingAddressSnapshot: Address, billingAddressSnapshot: Address, items: [{ orderItemId, productVariantId, snapshotProductName, snapshotColor, snapshotSize, snapshotUnitPrice, snapshotCompareAtPrice, quantity, lineTotal }], createdAt, updatedAt }`. Order status is always `PURCHASED`.

**DashboardSummary**:

```json
{
  "period": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "granularity": "day | month" },
  "revenue": { "total": 0, "growth": 0, "currency": "USD" },
  "orders": { "total": 0, "growth": 0 },
  "productsSold": { "total": 0, "growth": 0 },
  "salesByCategory": [ { "label": "Men", "value": 0 } ],
  "charts": { "labels": [], "revenue": [], "orders": [], "productsSold": [] },
  "totalLikes": 0,
  "uniqueViewers": 0,
  "topSellers": [ { "productId": 0, "label": "", "category": "", "salesValue": 0, "likesCount": 0 } ],
  "recentActivity": [ { "type": "", "time": "", "message": "" } ]
}
```

`growth` is a percentage with one decimal, 0 when the previous value is 0. `charts` arrays have one entry per label, and zero filled for empty days or months. `uniqueViewers` counts distinct signed-in users and anonymous identifiers in the product view events inside the period. `topSellers` holds at most 5 products.

## 10. Open questions

Each item needs a decision before the endpoint is built. None are resolved by guessing in this document.

1. **Envelope on legacy product routes.** `GET /products`, `GET /products/new-arrivals`, both `/images` endpoints, `POST /api/admin/products` and the image upload return `{ message, data }` without `status`, and the storefront ones return errors as `{ error, message }`. This contract assumes the shared envelope everywhere. Confirm, since the frontend currently reads the older shapes.
2. **Validation error detail.** Legacy errors sometimes add `missingFields` (sign up, reset password) or `details` (address, product, order validation). The rebuilt `error_body` only has `code` and `message`. Decide whether to add one optional `details` object to the envelope and drop `missingFields`.
3. **Pagination and "paged product list".** Issue 9 asks for a paged `GET /api/client/products`, but legacy returns every active product unpaged. Storefront lists nest `pagination`, admin lists place the paging fields beside `items`. Pick one style and decide the paging parameters for the product list.
4. **Languages.** Legacy supports `EN` and `TH` and requires both on product create. Bad `lang` returns `INVALID_LANGUAGE` on product routes but `INVALID_QUERY` on campaigns. Confirm TH stays in scope and which code to use.
5. **Card field names.** There are two storefront card shapes (ProductCard and NewArrivalCard) with different names for the same facts (`originalPrice` against `compareAtPrice`, `discount` object against `discountPercent`, `image` against `imageUrl`). Admin variants use `colour`, storefront ones use `color`. Issue 9 and 12 ask for "compare-at price" and "subtotal" per line; legacy names these `originalPrice` and `lineTotal`. Agree one set of names.
6. **Search counts per category.** Issue 9 requires counts per category for the filter chips. Legacy search returns none. Define the field (for example `categoryCounts: [{ slug, name, count }]`) or drop the criterion.
7. **Recommendation context.** Issue 9 says context is one of category, cart or favourites. Legacy accepts any string, only echoes it, and takes the category as a separate `category` slug. Define the allowed `context` values and what each changes.
8. **Product detail content.** Issue 10 says detail returns colours, sizes, "images and stock". Legacy returns one `image` and a boolean `inStock`; per colour and size stock comes from the variants endpoint and images from the images endpoint. Confirm that split is intended.
9. **Wrong session type on customer routes.** Legacy returns 401 when an admin session hits a customer route. Issue 5 and the rebuilt guard return 403. This contract uses 403. Confirm the frontend handles it.
10. **Verification link and result page.** Issue 6 says email links point to the webstore base URL. Legacy verification links point to the API route and the API answers with HTML (by `Accept` or `format=html`); only the reset link points to the webstore. Decide where the link lands and whether the API keeps HTML output. Also confirm the 5 minute verification default is intended.
11. **Forgot password when mail fails, and account disclosure.** Legacy rolls back and returns 500 `PASSWORD_RESET_EMAIL_FAILED`; issue 6 says a failed send is logged and does not crash the request (sign up already behaves that way). Separately, `resend-verification` and `profile` reveal whether an account exists (`USER_NOT_FOUND`) while `forgot-password` hides it. Decide the intended policy.
12. **Cookie attributes across origins.** Legacy `SameSite` is configurable in production (`SESSION_COOKIE_SAMESITE`); the rebuilt helper fixes `Lax`. If the React frontend and the API are served from different sites, `Lax` cookies are not sent on cross-site requests. Decide the deployment origins, the `SameSite` value, and whether CSRF protection is needed. Legacy has none.
13. **Removing a favourite of an inactive product.** Legacy `DELETE /favorites/:productId` returns 404 when the product is inactive or hidden, so a customer cannot clear it. Decide whether removal should succeed.
14. **Checkout totals and status code.** Issue 13 says the order stores price, VAT and shipping totals; legacy always writes shipping 0 and VAT 0. Decide the real rules. Purchase returns 200 in legacy (a created order would normally be 201). The unverified-customer check is a pending decision.
15. **Dashboard guard and reliability.** Legacy mounts `GET /dashboard/summary` without a login (a temporary bypass). Issue 15 states an admin session; this contract does the same, pending the legacy-feature decision. Legacy also answers 500 for bad periods and dates (the code was `INVALID_QUERY` or `INVALID_DATE_RANGE`); issue 15 requires 400.
16. **Dashboard content.** Legacy `salesByCategory` always lists Men, Women, Kids, Baby and Unisex and fills missing categories with random numbers; `topSellers` ignores the selected period; currency is fixed to `USD`; windows use UTC while the project time zone is `Asia/Bangkok`; `recentActivity` reads event types that are not all recorded. Decide the real behaviour for each. Issue 15 lists top sellers as "name, likes, sales"; legacy names are `label`, `likesCount`, `salesValue`.
17. **Category duplicates and delete in use.** Issue 16 says create rejects duplicates and delete returns a clear error when products use the category. Legacy create appends `-2`, `-3` to a clashing slug (409 only on a database race) and delete has no in-use check. Decide what counts as a duplicate (name or slug), and the status and code for delete in use (suggest 409, code to be agreed).
18. **Admin product update shape.** Legacy update uses snake_case (`category_id`, `compare_at_price`, `stock`) with camelCase aliases, edits one variant at a time chosen by `sku`, and differs from create, which is camelCase and nested. Issue 17 lists "name, description, status, category, price and stock". Decide one canonical naming and whether update can edit several variants. The UI uses only list, detail, create and update, so the alias image route and the images list may be dropped (pending legacy-feature decision).
19. **Hard delete of a product.** Not defined when order items still reference its variants. Decide whether `HARD` is blocked in that case. `SOFT` marks the product and all its variants inactive.
20. **Banner data in the campaign list.** Issue 19 says the hero banner shows title, offer text, dates and an uploaded image. `GET /api/client/campaigns` has no image field and only lists rows from the campaigns table, which legacy launch never writes to.
21. **Launch campaign storage and validation.** Legacy launch rewrites a frontend template and overwrites one image on disk, saves no campaign row, and only validates that `campaignData` is JSON. Issue 19 needs validation (400), a launched banner that the home page can read, and a send summary. Decide the storage approach (pending legacy-feature decision), whether launch also creates a campaigns row, the fixed discount type name (`FIXED_AMOUNT_DISCOUNT` in launch against `FIXED_DISCOUNT` elsewhere), and the response shape.
22. **Order edits and deletes.** Legacy `PATCH` also overwrites the billing address snapshot with the shipping one. Deleting an order does not restore stock and removes its revenue from the dashboard. Confirm both are intended.
23. **Multipart parsing.** The current Django settings register only the JSON parser. The three multipart endpoints (create product, add image, launch campaign) need a multipart parser or they return 415.
