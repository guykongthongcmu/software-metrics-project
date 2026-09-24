## API Contracts

## Documentation Version
- Current: v2.11.0
- Last Updated: 2026-03-26
- Owner: Core&Co Team
- Changelog: [CHANGELOG.md](../CHANGELOG.md)

## Global CORS Policy (All API Routes)

This backend uses explicit origin allowlisting for browser CORS and supports credentialed requests for approved origins only.

Configuration:
- `CORS_ALLOWED_ORIGINS`: comma-separated allowed origins
- example: `http://localhost:8080,https://frontend.example.com`

Approved-origin behavior:
- `Access-Control-Allow-Origin` is set to the request origin (never `*`)
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
- `Access-Control-Allow-Headers`: requested headers or fallback to `Content-Type, Authorization`
- `OPTIONS` preflight returns `204 No Content`

Preflight request example:
```http
OPTIONS /api/client/products HTTP/1.1
Origin: http://localhost:8080
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

Preflight success response (`204`):
- no response body
- response headers include:
  - `Access-Control-Allow-Origin: http://localhost:8080`
  - `Access-Control-Allow-Credentials: true`
  - `Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, Authorization`

Error response (`403 CORS_ORIGIN_NOT_ALLOWED`):
```json
{
  "status": "error",
  "code": "CORS_ORIGIN_NOT_ALLOWED",
  "message": "origin is not allowed"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Authentication API

This document describes the auth endpoints currently implemented in `backend/src/routes/auth.routes.js`.

Base path: `/api/auth`  
Content type: `application/json` (except token in query string for verify-email)

Session cookie contract:
- successful `POST /user/signin` and `POST /admin/signin` set `Set-Cookie: session=<token>`
- cookie flags: `HttpOnly`, `Path=/`, `Secure` in production, `SameSite` from `SESSION_COOKIE_SAMESITE` (default `lax`)
- session expiry is controlled by `SESSION_TTL_HOURS` (default `24`)
- protected routes authenticate from persisted `sessions` records using the `session` cookie

### 1) Check Email
**POST** `/check-email`

Use this endpoint before signup to validate format and availability.

Request body:
```json
{
  "email": "user@example.com"
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "email is valid and available",
  "data": {
    "email": "user@example.com"
  }
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`):
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "email is required"
}
```

Error response (`400 INVALID_EMAIL_FORMAT`):
```json
{
  "status": "error",
  "code": "INVALID_EMAIL_FORMAT",
  "message": "email format is invalid"
}
```

Error response (`409 EMAIL_ALREADY_EXISTS`):
```json
{
  "status": "error",
  "code": "EMAIL_ALREADY_EXISTS",
  "message": "email already exists"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 2) Signup
**POST** `/signup`

Creates a user, creates verification token, and attempts to send verification email.

Request body:
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

Success response (`201`) - email sent:
```json
{
  "status": "success",
  "message": "user registered successfully. verification email sent",
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "DOB": "2005-08-10",
    "phone_number": "0812345678",
    "email_verified": false,
    "verification_email_sent": true
  }
}
```

Success response (`201`) - email pending:
```json
{
  "status": "success",
  "message": "user registered successfully. verification email pending",
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "DOB": "2005-08-10",
    "phone_number": "0812345678",
    "email_verified": false,
    "verification_email_sent": false
  }
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`):
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "missing required fields",
  "missingFields": [
    "email",
    "password"
  ]
}
```

Error response (`400 INVALID_EMAIL_FORMAT`):
```json
{
  "status": "error",
  "code": "INVALID_EMAIL_FORMAT",
  "message": "email format is invalid"
}
```

Error response (`400 PASSWORD_TOO_SHORT`):
```json
{
  "status": "error",
  "code": "PASSWORD_TOO_SHORT",
  "message": "password must be at least 8 characters"
}
```

Error response (`409 EMAIL_ALREADY_EXISTS`):
```json
{
  "status": "error",
  "code": "EMAIL_ALREADY_EXISTS",
  "message": "email already exists"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 3) Verify Email
**GET** `/verify-email?token=<verification_token>`

Marks email as verified when token is valid and unused.

Success response (`200`):
```json
{
  "status": "success",
  "message": "email verified successfully",
  "data": {
    "user_id": 1,
    "email": "user@example.com",
    "email_verified": true
  }
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`):
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "token is required"
}
```

Error response (`400 INVALID_VERIFICATION_TOKEN`):
```json
{
  "status": "error",
  "code": "INVALID_VERIFICATION_TOKEN",
  "message": "verification token is invalid"
}
```

Error response (`409 VERIFICATION_TOKEN_ALREADY_USED`):
```json
{
  "status": "error",
  "code": "VERIFICATION_TOKEN_ALREADY_USED",
  "message": "verification token has already been used"
}
```

Error response (`409 EMAIL_ALREADY_VERIFIED`):
```json
{
  "status": "error",
  "code": "EMAIL_ALREADY_VERIFIED",
  "message": "email is already verified"
}
```

Error response (`410 VERIFICATION_TOKEN_EXPIRED`):
```json
{
  "status": "error",
  "code": "VERIFICATION_TOKEN_EXPIRED",
  "message": "verification token has expired"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 4) Resend Verification Email
**POST** `/resend-verification`

Creates a fresh token for an unverified account and sends email again.

Request body:
```json
{
  "email": "user@example.com"
}
```

Success response (`200`) - email sent:
```json
{
  "status": "success",
  "message": "verification email sent successfully",
  "data": {
    "email": "user@example.com",
    "verification_email_sent": true
  }
}
```

Success response (`200`) - email pending:
```json
{
  "status": "success",
  "message": "verification email pending",
  "data": {
    "email": "user@example.com",
    "verification_email_sent": false
  }
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`):
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "email is required"
}
```

Error response (`400 INVALID_EMAIL_FORMAT`):
```json
{
  "status": "error",
  "code": "INVALID_EMAIL_FORMAT",
  "message": "email format is invalid"
}
```

Error response (`404 USER_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "USER_NOT_FOUND",
  "message": "user not found"
}
```

Error response (`409 EMAIL_ALREADY_VERIFIED`):
```json
{
  "status": "error",
  "code": "EMAIL_ALREADY_VERIFIED",
  "message": "email is already verified"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 5) User Signin
**POST** `/user/signin`

Request body:
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "signed in successfully",
  "data": {
    "role": "user",
    "user_id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "email_verified": false,
    "redirectTo": "/",
    "session": {
      "expiresAt": "2026-03-31T10:15:00.000Z"
    }
  }
}
```

Response header:
- `Set-Cookie: session=<token>; HttpOnly; Path=/; SameSite=<lax|strict|none>; Expires=<http-date>; [Secure in production]`

Error response (`400 MISSING_REQUIRED_FIELDS`) - missing email:
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "email is required"
}
```

Error response (`400 INVALID_EMAIL_FORMAT`):
```json
{
  "status": "error",
  "code": "INVALID_EMAIL_FORMAT",
  "message": "email format is invalid"
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`) - missing password:
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "password is required"
}
```

Error response (`401 INVALID_CREDENTIALS`):
```json
{
  "status": "error",
  "code": "INVALID_CREDENTIALS",
  "message": "invalid email or password"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 6) Admin Signin
**POST** `/admin/signin`

Request body:
```json
{
  "email": "admin@example.com",
  "password": "secret123"
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "signed in successfully",
  "data": {
    "role": "admin",
    "admin_id": 1,
    "email": "admin@example.com",
    "name": "Admin Name",
    "redirectTo": "/dashboard",
    "session": {
      "expiresAt": "2026-03-31T10:15:00.000Z"
    }
  }
}
```

Response header:
- `Set-Cookie: session=<token>; HttpOnly; Path=/; SameSite=<lax|strict|none>; Expires=<http-date>; [Secure in production]`

Error response (`400 MISSING_REQUIRED_FIELDS`) - missing email:
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "email is required"
}
```

Error response (`400 INVALID_EMAIL_FORMAT`):
```json
{
  "status": "error",
  "code": "INVALID_EMAIL_FORMAT",
  "message": "email format is invalid"
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`) - missing password:
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "password is required"
}
```

Error response (`401 INVALID_CREDENTIALS`):
```json
{
  "status": "error",
  "code": "INVALID_CREDENTIALS",
  "message": "invalid email or password"
}
```

Error response (`403 ACCOUNT_INACTIVE`):
```json
{
  "status": "error",
  "code": "ACCOUNT_INACTIVE",
  "message": "account is inactive, please contact support"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 7) Logout
**POST** `/logout`

Requires:
- `Cookie: session=<session-token>`

Success response (`200`):
```json
{
  "status": "success",
  "message": "signed out successfully",
  "data": {
    "sessionRevoked": true
  }
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 8) Forgot Password
**POST** `/forgot-password`

Request body:
```json
{
  "email": "user@example.com"
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "if the email exists, a password reset link has been sent"
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`):
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "email is required"
}
```

Error response (`400 INVALID_EMAIL_FORMAT`):
```json
{
  "status": "error",
  "code": "INVALID_EMAIL_FORMAT",
  "message": "email format is invalid"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 9) Reset Password
**POST** `/reset-password`

Request body:
```json
{
  "token": "password-reset-token",
  "new_password": "NewSecurePassword123!",
  "confirm_password": "NewSecurePassword123!"
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "password reset successfully",
  "data": {
    "password_reset": true
  }
}
```

Error response (`400 MISSING_REQUIRED_FIELDS`):
```json
{
  "status": "error",
  "code": "MISSING_REQUIRED_FIELDS",
  "message": "missing required fields",
  "missingFields": [
    "token",
    "new_password",
    "confirm_password"
  ]
}
```

Error response (`400 PASSWORD_TOO_SHORT`):
```json
{
  "status": "error",
  "code": "PASSWORD_TOO_SHORT",
  "message": "password must be at least 8 characters"
}
```

Error response (`400 PASSWORD_CONFIRMATION_MISMATCH`):
```json
{
  "status": "error",
  "code": "PASSWORD_CONFIRMATION_MISMATCH",
  "message": "new password and confirm password do not match"
}
```

Error response (`400 INVALID_PASSWORD_RESET_TOKEN`):
```json
{
  "status": "error",
  "code": "INVALID_PASSWORD_RESET_TOKEN",
  "message": "password reset token is invalid"
}
```

Error response (`409 PASSWORD_RESET_TOKEN_ALREADY_USED`):
```json
{
  "status": "error",
  "code": "PASSWORD_RESET_TOKEN_ALREADY_USED",
  "message": "password reset token has already been used"
}
```

Error response (`410 PASSWORD_RESET_TOKEN_EXPIRED`):
```json
{
  "status": "error",
  "code": "PASSWORD_RESET_TOKEN_EXPIRED",
  "message": "password reset token has expired"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

---

### Note for Admin Signup
Admin accounts are created manually by the team. There is no public admin signup endpoint.

## Admin Dashboard API

This section describes the admin dashboard summary endpoint implemented in `backend/src/routes/admin-dashboard.routes.js`.

Base path: `/api/admin`  
Content type: `application/json`  
Auth: requires `Cookie: session=<admin-session-token>` mapped to a valid active `ADMIN` session.

### 1) Get Dashboard Summary
**GET** `/dashboard/summary?period=<7d|30d|custom>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>`

Returns aggregated KPI totals and aligned chart series in a single response.

Query rules:
- `period` is optional and defaults to `7d`
- supported values: `7d`, `30d`, `custom`
- when `period=custom`, both `from` and `to` are required
- `from` and `to` must use `YYYY-MM-DD`
- chart labels are returned as date buckets in `YYYY-MM-DD` format
- summary aggregation counts orders with status `PURCHASED` only

Request example:
```http
GET /api/admin/dashboard/summary?period=7d HTTP/1.1
Cookie: session=<admin-session-token>
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "dashboard summary retrieved successfully",
  "data": {
    "period": {
      "from": "2026-03-17",
      "to": "2026-03-23",
      "granularity": "day"
    },
    "revenue": {
      "total": 284750,
      "growth": 24,
      "currency": "THB"
    },
    "orders": {
      "total": 2543,
      "growth": 12.5
    },
    "productsSold": {
      "total": 4280,
      "growth": 9.8
    },
    "charts": {
      "labels": [
        "2026-03-17",
        "2026-03-18",
        "2026-03-19",
        "2026-03-20",
        "2026-03-21",
        "2026-03-22",
        "2026-03-23"
      ],
      "revenue": [12000, 19000, 15000, 22000, 18000, 25000, 21000],
      "orders": [180, 260, 220, 310, 275, 340, 300],
      "productsSold": [290, 410, 350, 480, 430, 520, 470]
    }
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "period must be one of: 7d, 30d, custom"
}
```

Error response (`400 INVALID_DATE_RANGE`):
```json
{
  "status": "error",
  "code": "INVALID_DATE_RANGE",
  "message": "from and to must be valid dates, and from must be earlier than or equal to to"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Admin Category API

This section describes the admin category endpoints implemented in `backend/src/routes/admin-category.routes.js`.

Base path: `/api/admin`  
Auth: requires `Cookie: session=<admin-session-token>` mapped to a valid active `ADMIN` session.

### 1) List Categories
**GET** `/categories?sort=<category_name>&order=<asc|desc>`

Returns all categories from database.

Query rules:
- `sort` optional, currently supports `category_name` only
- `order` optional, supports `asc` or `desc`
- default sort is `category_name asc`

Success response (`200`):
```json
{
  "status": "success",
  "message": "categories retrieved successfully",
  "data": {
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "Baby",
        "slug": "baby",
        "isHidden": false,
        "parentCategoryId": null
      },
      {
        "categoryId": 2,
        "categoryName": "Kids",
        "slug": "kids",
        "isHidden": false,
        "parentCategoryId": null
      }
    ]
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "sort must be category_name"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 2) Update Category Visibility
**PATCH** `/categories/:id/visibility`

Request body:
```json
{
  "isHidden": true
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "category visibility updated successfully",
  "data": {
    "categoryId": 2,
    "categoryName": "Kids",
    "slug": "kids",
    "isHidden": true
  }
}
```

Error response (`400 INVALID_CATEGORY_ID`):
```json
{
  "status": "error",
  "code": "INVALID_CATEGORY_ID",
  "message": "category id must be a positive integer"
}
```

Error response (`400 INVALID_VISIBILITY_VALUE`):
```json
{
  "status": "error",
  "code": "INVALID_VISIBILITY_VALUE",
  "message": "isHidden must be a boolean"
}
```

Error response (`404 CATEGORY_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "CATEGORY_NOT_FOUND",
  "message": "category with id 2 was not found"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Client Category API

This section describes the client category endpoint implemented in `backend/src/routes/client-category.routes.js`.

Base path: `/api/client`  
Auth: public endpoint

### 1) List Visible Categories
**GET** `/categories?sort=<category_name>&order=<asc|desc>`

Returns only visible categories (`is_hidden = 0`).

Success response (`200`):
```json
{
  "status": "success",
  "message": "visible categories retrieved successfully",
  "data": {
    "categories": [
      {
        "categoryId": 1,
        "categoryName": "Baby",
        "slug": "baby",
        "isHidden": false
      },
      {
        "categoryId": 3,
        "categoryName": "Men",
        "slug": "men",
        "isHidden": false
      }
    ]
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "sort must be category_name"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Admin Product API

This section describes the admin product endpoints implemented in `backend/src/routes/admin-product.routes.js`.

Base path: `/api/admin`  
Auth: requires `Cookie: session=<admin-session-token>` mapped to a valid active `ADMIN` session.

### 1) Create Product
**POST** `/products`

Content type: `multipart/form-data`

Multipart fields:
- `payload`: JSON string for the product payload
- `mediaFiles`: 1-4 uploaded images, in the same order as `payload.media`

`payload` example:
```json
{
  "productType": "TOP",
  "status": "ACTIVE",
  "translations": [
    { "languageCode": "en", "name": "Classic Tee", "description": "Soft cotton tee" },
    { "languageCode": "th", "name": "เสื้อยืดคลาสสิก", "description": "เสื้อคอตตอนนุ่ม" }
  ],
  "categories": [
    { "categoryId": 12, "isPrimary": true }
  ],
  "variants": [
    { "sku": "TEE-BLK-M", "colour": "BLACK", "size": "M", "price": 790, "compareAtPrice": 990, "stockQty": 20 }
  ],
  "media": [
    { "sortOrder": 1, "isThumbnail": true, "isHero": true, "altText": "Classic tee front view" }
  ]
}
```

Notes:
- `languageCode` input is case-insensitive, but stored as `EN`/`TH`
- `status` is optional and maps to `products.is_active`
- accepted active-like values: `ACTIVE`, `PUBLISHED`, `VISIBLE`, `true`
- accepted inactive-like values: `INACTIVE`, `DRAFT`, `ARCHIVED`, `false`
- exactly one primary category is required
- exactly one thumbnail image and one hero image are required

Success response (`201`):
```json
{
  "message": "Product created successfully",
  "data": { "productId": 101 }
}
```

Error response (`400 VALIDATION_ERROR`):
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request data",
  "details": {
    "translations": "translations must include both EN and TH names"
  }
}
```

Error response (`409 DUPLICATE_SKU`):
```json
{
  "error": "DUPLICATE_SKU",
  "message": "A variant SKU already exists",
  "details": {
    "sku": "Duplicate SKU(s): TEE-BLK-M"
  }
}
```

Error response (`409 DUPLICATE_VARIANT`):
```json
{
  "error": "DUPLICATE_VARIANT",
  "message": "A variant colour/size combination is duplicated in the request",
  "details": {
    "variants": "Duplicate variant combination(s): BLACK/M"
  }
}
```

Error response (`500 STORAGE_UPLOAD_FAILED`):
```json
{
  "error": "STORAGE_UPLOAD_FAILED",
  "message": "Failed to upload image to storage"
}
```

### 2) List Admin Products
**GET** `/products?page=<number>&limit=<number>&search=<text>&category=<categoryId>&lang=<EN|TH>`

Query behavior:
- `page` optional, default `1` (must be positive integer)
- `limit` optional, default `20`, max `100` (must be positive integer)
- `search` optional, case-insensitive partial match on product translation name
- `category` optional, positive integer category id filter
- list includes both active and inactive products for admin management

Success response (`200`):
```json
{
  "status": "success",
  "message": "products retrieved successfully",
  "data": {
    "page": 1,
    "limit": 20,
    "totalItems": 54,
    "totalPages": 3,
    "items": [
      {
        "productId": 101,
        "productType": "TOP",
        "isActive": true,
        "status": "ACTIVE",
        "languageCode": "EN",
        "name": "Linen Shirt",
        "description": "Lightweight linen shirt",
        "primaryCategoryId": 12,
        "primaryCategoryName": "Men Shirts",
        "thumbnailUrl": "https://cdn.example/p101.jpg",
        "priceFrom": 80,
        "compareAtPriceFrom": 100,
        "totalStock": 18
      }
    ]
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "page and limit must be positive integers"
}
```

### 3) Get Admin Product Detail
**GET** `/products/:productId?lang=<EN|TH>`

Returns extended localized detail with categories, variants, and media.

Success response (`200`):
```json
{
  "status": "success",
  "message": "product retrieved successfully",
  "data": {
    "productId": 101,
    "name": "Linen Shirt",
    "description": "Lightweight linen shirt",
    "status": "ACTIVE",
    "categories": [
      {
        "categoryId": 12,
        "name": "Men Shirts",
        "isPrimary": true
      }
    ],
    "variants": [
      {
        "productVariantId": 301,
        "sku": "LINEN-001",
        "colour": "BEIGE",
        "size": "M",
        "price": 80,
        "compareAtPrice": 100,
        "stockQty": 10,
        "isActive": true
      }
    ],
    "media": [
      {
        "productMediaId": 901,
        "publicUrl": "https://cdn.example/p101.jpg",
        "isThumbnail": true,
        "isHero": true
      }
    ]
  }
}
```

Error response (`404 PRODUCT_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "PRODUCT_NOT_FOUND",
  "message": "product with id 101 was not found"
}
```

### 4) Update Admin Product
**PUT** `/products/:productId?lang=<EN|TH>`

Supported body fields:
- `name`
- `description`
- `status`
- `category_id` (or `categoryId`)
- `sku` (required for variant updates when product has multiple variants)
- `price`
- `compare_at_price` (aliases: `compareAtPrice`, `discount_price`)
- `stock` (aliases: `stockQty`, `stock_qty`)

Success response (`200`):
```json
{
  "status": "success",
  "message": "product updated successfully",
  "data": {
    "productId": 101,
    "status": "ACTIVE"
  }
}
```

Error response (`400 VALIDATION_ERROR`):
```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "invalid request data"
}
```

### 5) Delete Admin Product
**DELETE** `/products/:productId?mode=<SOFT|HARD>`

Delete mode:
- default `SOFT` (sets `products.is_active = 0` and marks variants inactive)
- optional `HARD` (physical delete with FK cascade)

Success response (`200`):
```json
{
  "status": "success",
  "message": "product deleted successfully",
  "data": {
    "productId": 101,
    "deleted": true,
    "mode": "SOFT"
  }
}
```

Error response (`400 INVALID_PRODUCT_ID`):
```json
{
  "status": "error",
  "code": "INVALID_PRODUCT_ID",
  "message": "productId must be a positive integer"
}
```

### 6) List Admin Product Images
**GET** `/products/:productId/images`

Returns ordered media rows for the product.

### 7) Upload Additional Admin Product Image
**POST** `/products/:productId/image`
**POST** `/products/:productId/images`

Content type: `multipart/form-data`

Multipart fields:
- `image`: uploaded file
- optional `sortOrder`
- optional `isThumbnail`
- optional `isHero`
- optional `altText`

## Admin Order API

This section describes the admin order endpoints implemented in `backend/src/routes/admin-order.routes.js`.

Base path: `/api/admin`  
Auth: requires `Cookie: session=<admin-session-token>` mapped to a valid active `ADMIN` session.

### 1) List Admin Orders
**GET** `/orders?page=<number>&limit=<number>&status=<PURCHASED>&search=<text>`

Query behavior:
- `page` optional, default `1` (must be positive integer)
- `limit` optional, default `20` (must be positive integer)
- `status` optional, currently supports `PURCHASED` only
- `search` optional, case-insensitive search across user email, user full name, and shipping snapshot text

Success response (`200`):
```json
{
  "status": "success",
  "message": "orders retrieved successfully",
  "data": {
    "page": 1,
    "limit": 20,
    "totalItems": 42,
    "totalPages": 3,
    "items": [
      {
        "orderId": 5001,
        "userId": 12,
        "status": "PURCHASED",
        "subtotal": 245,
        "shippingFee": 0,
        "vatAmount": 0,
        "total": 245,
        "createdAt": "2026-03-23T14:20:00.000Z"
      }
    ]
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "page and limit must be positive integers"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 2) Get Admin Order Detail
**GET** `/orders/:orderId`

Success response (`200`):
```json
{
  "status": "success",
  "message": "order retrieved successfully",
  "data": {
    "orderId": 5001,
    "userId": 12,
    "customer": {
      "userId": 12,
      "email": "john@example.com",
      "name": "John Doe"
    },
    "status": "PURCHASED",
    "subtotal": 245,
    "shippingFee": 0,
    "vatAmount": 0,
    "total": 245,
    "shippingAddressSnapshot": {
      "fullName": "John Doe",
      "phoneNumber": "+66 81 234 5678",
      "addressLine1": "123 Sukhumvit Rd",
      "district": "Khlong Toei",
      "province": "Bangkok",
      "postalCode": "10110",
      "country": "Thailand"
    },
    "billingAddressSnapshot": {
      "fullName": "John Doe",
      "phoneNumber": "+66 81 234 5678",
      "addressLine1": "123 Sukhumvit Rd",
      "district": "Khlong Toei",
      "province": "Bangkok",
      "postalCode": "10110",
      "country": "Thailand"
    },
    "items": [
      {
        "orderItemId": 9001,
        "productVariantId": 301,
        "snapshotProductName": "Linen Shirt",
        "snapshotColor": "Beige",
        "snapshotSize": "M",
        "snapshotUnitPrice": 80,
        "snapshotCompareAtPrice": 100,
        "quantity": 2,
        "lineTotal": 160
      }
    ],
    "createdAt": "2026-03-23T14:20:00.000Z",
    "updatedAt": "2026-03-23T14:20:00.000Z"
  }
}
```

Error response (`400 INVALID_ORDER_ID`):
```json
{
  "status": "error",
  "code": "INVALID_ORDER_ID",
  "message": "orderId must be a positive integer"
}
```

Error response (`404 ORDER_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "ORDER_NOT_FOUND",
  "message": "order with id 5001 was not found"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 3) Update Admin Order Address Snapshot
**PATCH** `/orders/:orderId`

Request body:
```json
{
  "shippingAddressSnapshot": {
    "fullName": "John Doe",
    "phoneNumber": "+66 81 234 5678",
    "addressLine1": "123 Sukhumvit Rd",
    "addressLine2": "Unit 9",
    "district": "Khlong Toei",
    "province": "Bangkok",
    "postalCode": "10110",
    "country": "Thailand"
  }
}
```

Behavior:
- updates the stored shipping snapshot on the order
- current implementation mirrors the same snapshot into `billingAddressSnapshot`

Success response (`200`):
```json
{
  "status": "success",
  "message": "order updated successfully",
  "data": {
    "orderId": 5001,
    "userId": 12,
    "customer": {
      "userId": 12,
      "email": "john@example.com",
      "name": "John Doe"
    },
    "status": "PURCHASED",
    "subtotal": 245,
    "shippingFee": 0,
    "vatAmount": 0,
    "total": 245,
    "shippingAddressSnapshot": {
      "fullName": "John Doe",
      "phoneNumber": "+66 81 234 5678",
      "addressLine1": "123 Sukhumvit Rd",
      "addressLine2": "Unit 9",
      "district": "Khlong Toei",
      "province": "Bangkok",
      "postalCode": "10110",
      "country": "Thailand"
    },
    "billingAddressSnapshot": {
      "fullName": "John Doe",
      "phoneNumber": "+66 81 234 5678",
      "addressLine1": "123 Sukhumvit Rd",
      "addressLine2": "Unit 9",
      "district": "Khlong Toei",
      "province": "Bangkok",
      "postalCode": "10110",
      "country": "Thailand"
    },
    "items": [],
    "createdAt": "2026-03-23T14:20:00.000Z",
    "updatedAt": "2026-03-26T02:00:00.000Z"
  }
}
```

Error response (`400 INVALID_ORDER_ID`):
```json
{
  "status": "error",
  "code": "INVALID_ORDER_ID",
  "message": "orderId must be a positive integer"
}
```

Error response (`400 VALIDATION_ERROR`):
```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "fullName, phoneNumber, addressLine1, district, province, postalCode, and country are required",
  "details": {
    "phoneNumber": "phoneNumber is required"
  }
}
```

Error response (`404 ORDER_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "ORDER_NOT_FOUND",
  "message": "order with id 5001 was not found"
}
```

### 4) Delete Admin Order
**DELETE** `/orders/:orderId`

Success response (`200`):
```json
{
  "status": "success",
  "message": "order deleted successfully",
  "data": {
    "orderId": 5001,
    "deleted": true
  }
}
```

Error response (`400 INVALID_ORDER_ID`):
```json
{
  "status": "error",
  "code": "INVALID_ORDER_ID",
  "message": "orderId must be a positive integer"
}
```

Error response (`404 ORDER_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "ORDER_NOT_FOUND",
  "message": "order with id 5001 was not found"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Admin Campaign API

This section describes the admin campaign endpoint implemented in `backend/src/routes/admin-campaign.routes.js`.

Base path: `/api/admin`  
Auth: requires `Cookie: session=<admin-session-token>` mapped to a valid active `ADMIN` session.

Supported campaign types:
- `BEST_SELLER`
- `PERCENTAGE_DISCOUNT`
- `FIXED_DISCOUNT`

### 1) Create Campaign
**POST** `/campaigns`

Request body:
```json
{
  "name": "Weekend 20% Off",
  "type": "PERCENTAGE_DISCOUNT",
  "discountValue": 20,
  "productIds": [101, 102],
  "startDate": "2026-03-23",
  "endDate": "2026-03-30",
  "message": "Save 20% this weekend"
}
```

Behavior:
- discount campaigns (`PERCENTAGE_DISCOUNT`, `FIXED_DISCOUNT`) require `discountValue` and `productIds`
- `BEST_SELLER` resolves top-selling product using `order_item` + `product_variant` aggregation and persists it in `campaign_products`
- discount campaigns update product-level persisted campaign discount fields in `products`

Success response (`201`):
```json
{
  "status": "success",
  "message": "campaign created successfully",
  "data": {
    "campaignId": 11,
    "name": "Weekend 20% Off",
    "type": "PERCENTAGE_DISCOUNT",
    "status": "ACTIVE",
    "startDate": "2026-03-23",
    "endDate": "2026-03-30",
    "discountValue": 20,
    "productIds": [101, 102],
    "createdAt": "2026-03-23T16:00:00.000Z"
  }
}
```

Error response (`400 INVALID_CAMPAIGN_TYPE`):
```json
{
  "status": "error",
  "code": "INVALID_CAMPAIGN_TYPE",
  "message": "type must be one of: BEST_SELLER, PERCENTAGE_DISCOUNT, FIXED_DISCOUNT"
}
```

Error response (`400 VALIDATION_ERROR`):
```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "invalid request data"
}
```

Error response (`404 PRODUCT_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "PRODUCT_NOT_FOUND",
  "message": "one or more productIds were not found"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`403 FORBIDDEN`):
```json
{
  "status": "error",
  "code": "FORBIDDEN",
  "message": "admin access required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Client Campaign API

This section describes the client campaign endpoint implemented in `backend/src/routes/client-campaign.routes.js`.

Base path: `/api/client`  
Content type: `application/json`

### 1) List Active Campaigns
**GET** `/campaigns?lang=<EN|TH>`

Returns campaigns where:
- `campaigns.status = ACTIVE`
- current date is between `start_date` and `end_date`

Success response (`200`):
```json
{
  "status": "success",
  "message": "campaigns retrieved successfully",
  "data": {
    "campaigns": [
      {
        "campaignId": 11,
        "name": "Weekend 20% Off",
        "type": "PERCENTAGE_DISCOUNT",
        "message": "Save 20% this weekend",
        "startDate": "2026-03-23",
        "endDate": "2026-03-30",
        "discount": {
          "type": "PERCENTAGE",
          "value": 20
        },
        "productIds": [101, 102]
      },
      {
        "campaignId": 12,
        "name": "Best Seller Spotlight",
        "type": "BEST_SELLER",
        "message": "Our best seller this week",
        "startDate": "2026-03-23",
        "endDate": "2026-03-30",
        "bestSellerProduct": {
          "productId": 101,
          "name": "Linen Shirt",
          "image": "https://cdn.coreco.local/products/101/hero.webp"
        }
      }
    ]
  }
}
```

Success response (`200`) - no active campaigns:
```json
{
  "status": "success",
  "message": "campaigns retrieved successfully",
  "data": {
    "campaigns": []
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "lang must be EN or TH"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

## Client Product API

This section describes the public product endpoints implemented in `backend/src/routes/product.routes.js`.

Base path: `/api/client`  
Content type: `application/json`

### 1) List Products
**GET** `/products?lang=<EN|TH>`

Returns active products only, using the requested language with `EN` fallback for product/category names.

### Favorites API

The favorites endpoints require an authenticated user session (`session` cookie).  
Base path: `/api/client`

#### a) List Favorites
**GET** `/favorites?lang=<EN|TH>`

Returns storefront-ready favorite products for the authenticated user.

Success response (`200`):
```json
{
  "status": "success",
  "message": "favorites retrieved successfully",
  "data": {
    "favoritesCount": 2,
    "products": [
      {
        "productId": 101,
        "name": "Linen Shirt",
        "detail": "A breathable linen shirt designed for warm weather and everyday wear.",
        "color": ["Beige", "Dark Grey", "Brown"],
        "price": 80,
        "originalPrice": 100,
        "discount": {
          "type": "percentage",
          "value": 20
        },
        "size": ["S", "M", "L", "XL"],
        "image": "https://cdn.coreco.local/products/101/hero.webp",
        "inStock": true
      }
    ]
  }
}
```

Success response (`200`) - no favorites:
```json
{
  "status": "success",
  "message": "favorites retrieved successfully",
  "data": {
    "favoritesCount": 0,
    "products": []
  }
}
```

#### b) Add Favorite (Idempotent)
**POST** `/favorites/:productId?lang=<EN|TH>`

Creates the favorite relation if it does not already exist.

Success response (`200`):
```json
{
  "status": "success",
  "message": "product added to favorites successfully",
  "data": {
    "productId": 101,
    "isFavorite": true,
    "favoritesCount": 3,
    "product": {
      "productId": 101,
      "name": "Linen Shirt",
      "detail": "A breathable linen shirt designed for warm weather and everyday wear.",
      "color": ["Beige", "Dark Grey", "Brown"],
      "price": 80,
      "originalPrice": 100,
      "discount": {
        "type": "percentage",
        "value": 20
      },
      "size": ["S", "M", "L", "XL"],
      "image": "https://cdn.coreco.local/products/101/hero.webp",
      "inStock": true
    }
  }
}
```

#### c) Remove Favorite (Idempotent)
**DELETE** `/favorites/:productId?lang=<EN|TH>`

Removes the favorite relation if it exists.

Success response (`200`):
```json
{
  "status": "success",
  "message": "product removed from favorites successfully",
  "data": {
    "productId": 101,
    "isFavorite": false,
    "favoritesCount": 2
  }
}
```

Favorites error responses:

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`400 INVALID_PRODUCT_ID`):
```json
{
  "status": "error",
  "code": "INVALID_PRODUCT_ID",
  "message": "productId must be a positive integer"
}
```

Error response (`404 PRODUCT_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "PRODUCT_NOT_FOUND",
  "message": "product with id 101 was not found"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 2) Search Products
**GET** `/products/search?q=<query>&page=<number>&limit=<number>&sort=<relevance|newest|price_asc|price_desc>&lang=<EN|TH>`

Returns paginated storefront-ready products filtered by product name (`q`).

Request query:
- `q` (required): non-empty string
- `page` (optional): default `1`
- `limit` (optional): default `12`, max `50`
- `sort` (optional): default `relevance`
- `lang` (optional): `EN` or `TH`, default `EN`

Success response (`200`):
```json
{
  "status": "success",
  "message": "products retrieved successfully",
  "data": {
    "query": "linen",
    "category": null,
    "pagination": {
      "page": 1,
      "limit": 12,
      "totalItems": 1,
      "totalPages": 1
    },
    "products": [
      {
        "productId": 101,
        "name": "Linen Shirt",
        "detail": "A breathable linen shirt designed for warm weather and everyday wear.",
        "category": {
          "categoryId": 12,
          "slug": "men-shirts",
          "name": "Men Shirts"
        },
        "color": ["Beige", "Dark Grey", "Brown"],
        "price": 80,
        "originalPrice": 100,
        "discount": {
          "type": "percentage",
          "value": 20
        },
        "size": ["S", "M", "L", "XL"],
        "image": "https://cdn.coreco.local/products/101/hero.webp",
        "inStock": true
      }
    ]
  }
}
```

Success response (`200`) - no results:
```json
{
  "status": "success",
  "message": "products retrieved successfully",
  "data": {
    "query": "no-match",
    "category": null,
    "pagination": {
      "page": 1,
      "limit": 12,
      "totalItems": 0,
      "totalPages": 0
    },
    "products": []
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "q must be a non-empty string"
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "status": "error",
  "code": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

### 3) Search Suggestions
**GET** `/products/search/suggestions?q=<query>&lang=<EN|TH>`

Returns lightweight storefront product suggestions for autocomplete.

Request query:
- `q` (required): at least 1 character
- `lang` (optional): `EN` or `TH`, default `EN`

Success response (`200`):
```json
{
  "status": "success",
  "message": "product suggestions retrieved successfully",
  "data": {
    "query": "lin",
    "suggestions": [
      {
        "productId": 101,
        "name": "Linen Shirt",
        "detail": "A breathable linen shirt designed for warm weather and everyday wear.",
        "color": ["Beige", "Dark Grey", "Brown"],
        "price": 80,
        "originalPrice": 100,
        "discount": {
          "type": "percentage",
          "value": 20
        },
        "size": ["S", "M", "L", "XL"],
        "image": "https://cdn.coreco.local/products/101/hero.webp",
        "inStock": true
      }
    ]
  }
}
```

Success response (`200`) - no results:
```json
{
  "status": "success",
  "message": "product suggestions retrieved successfully",
  "data": {
    "query": "zzz",
    "suggestions": []
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "q must be at least 1 character"
}
```

### 4) List Products By Category
**GET** `/products/category/:category?page=<number>&limit=<number>&sort=<newest|price_asc|price_desc>&lang=<EN|TH>`

Returns paginated storefront-ready products in the requested category slug.

Request params:
- `category`: category slug

Request query:
- `page` (optional): default `1`
- `limit` (optional): default `12`, max `50`
- `sort` (optional): default `newest`
- `lang` (optional): `EN` or `TH`, default `EN`
- hidden categories (`category.is_hidden = 1`) are treated as not found

Success response (`200`):
```json
{
  "status": "success",
  "message": "products in category retrieved successfully",
  "data": {
    "category": {
      "categoryId": 12,
      "slug": "men-shirts",
      "name": "Men Shirts"
    },
    "pagination": {
      "page": 1,
      "limit": 12,
      "totalItems": 1,
      "totalPages": 1
    },
    "products": [
      {
        "productId": 101,
        "name": "Linen Shirt",
        "detail": "A breathable linen shirt designed for warm weather and everyday wear.",
        "color": ["Beige", "Dark Grey", "Brown"],
        "price": 80,
        "originalPrice": 100,
        "discount": {
          "type": "percentage",
          "value": 20
        },
        "size": ["S", "M", "L", "XL"],
        "image": "https://cdn.coreco.local/products/101/hero.webp",
        "inStock": true
      }
    ]
  }
}
```

Success response (`200`) - no results:
```json
{
  "status": "success",
  "message": "products in category retrieved successfully",
  "data": {
    "category": {
      "categoryId": 12,
      "slug": "men-shirts",
      "name": "Men Shirts"
    },
    "pagination": {
      "page": 1,
      "limit": 12,
      "totalItems": 0,
      "totalPages": 0
    },
    "products": []
  }
}
```

Error response (`404 CATEGORY_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "CATEGORY_NOT_FOUND",
  "message": "category men-shirts was not found"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 5) Get Product Detail
**GET** `/products/:productId?lang=<EN|TH>`

Returns one storefront-ready product detail object for the product page.

Request query:
- `lang` (optional): `EN` or `TH`
- default language: `EN`

Storefront availability rules (`404 PRODUCT_NOT_FOUND`):
- product does not exist
- product is inactive
- product has no active variants
- product has no usable media URL

Response envelope:
- success: `{ "status": "success", "message": "...", "data": { ... } }`
- error: `{ "status": "error", "code": "...", "message": "..." }`

Selection/normalization rules:
- localized `name` and `detail`: requested language first, then `EN`, then first available translation
- `category`: primary category first, else first assigned category, else `null`
- `price`: lowest price among active variants
- `originalPrice`: `compareAtPrice` from that same cheapest active variant
- `discount`: `{ "type": "percentage", "value": <rounded_percent> }` when `originalPrice > price`; otherwise `null`
- `color` and `size`: distinct values across active variants
- `image`: hero first, then thumbnail, then lowest `sortOrder`
- `inStock`: `true` when at least one active variant has `stockQty > 0`

Success response (`200`):
```json
{
  "status": "success",
  "message": "product detail retrieved successfully",
  "data": {
    "productId": 101,
    "name": "Linen Shirt",
    "detail": "A breathable linen shirt designed for warm weather and everyday wear.",
    "category": {
      "categoryId": 12,
      "slug": "men-shirts",
      "name": "Men Shirts"
    },
    "color": ["Beige", "Dark Grey", "Brown"],
    "price": 80,
    "originalPrice": 100,
    "discount": {
      "type": "percentage",
      "value": 20
    },
    "size": ["S", "M", "L", "XL"],
    "image": "https://cdn.coreco.local/products/101/hero.webp",
    "inStock": true
  }
}
```

Error response (`400 INVALID_PRODUCT_ID`):
```json
{
  "status": "error",
  "code": "INVALID_PRODUCT_ID",
  "message": "productId must be a positive integer"
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "status": "error",
  "code": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

Error response (`404 PRODUCT_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "PRODUCT_NOT_FOUND",
  "message": "product with id 101 was not found"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 6) Get Product Images
**GET** `/products/:productId/images`

Returns ordered media rows for one active product.

### 7) Get New Arrivals
**GET** `/products/new-arrivals?lang=<EN|TH>`

Returns up to 4 newest active products for the homepage new-arrivals section.

Selection rules:
- Product must be active
- Product must have at least one translation
- Product must have at least one active variant
- Product must have at least one media row
- Results are ordered by `products.created_at DESC`

Language fallback:
- Requested language first
- Then `EN`
- Then the first available translation

Image fallback:
- `is_thumbnail = true`
- Then `is_hero = true`
- Then the lowest `sort_order`

Pricing and stock rules:
- Price comes from the lowest-priced active variant
- `compareAtPrice` comes from that same active variant
- `inStock` is `true` if any active variant has `stock_qty > 0`

Success response (`200`):
```json
{
  "message": "New arrival products retrieved successfully",
  "data": [
    {
      "productId": 1,
      "languageCode": "EN",
      "name": "[NA-SEED] Linen Shirt",
      "imageUrl": "https://picsum.photos/seed/na-seed-p1-thumb/800/1000",
      "imageAlt": "Seed thumbnail image",
      "price": 80,
      "compareAtPrice": 100,
      "discountPercent": 20,
      "inStock": true,
      "createdAt": "2026-03-17T10:00:00.000Z"
    }
  ]
}
```

Success response (`200`) - no qualifying products:
```json
{
  "message": "New arrival products retrieved successfully",
  "data": []
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "error": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Internal server error"
}
```

### 8) Get User Cart
**GET** `/cart?lang=<EN|TH>`

Returns the authenticated user's active cart items and summary totals.  
Auth: requires `session` cookie.

Request query:
- `lang` (optional): `EN` or `TH`, default `EN`

Behavior rules:
- Returns only the signed-in user's active cart
- Returns `200` with `items: []` and zero totals when cart is missing/empty
- Item pricing and discount use the selected variant in the cart item
- `inStock` is `true` only when product and variant are active and `stockQty > 0`

Success response (`200`) - populated cart:
```json
{
  "status": "success",
  "message": "cart retrieved successfully",
  "data": {
    "cartId": 12,
    "items": [
      {
        "itemId": 88,
        "productId": 101,
        "name": "Linen Shirt",
        "color": "Beige",
        "price": 80,
        "originalPrice": 100,
        "discount": {
          "type": "percentage",
          "value": 20
        },
        "size": "M",
        "image": "https://cdn.coreco.local/products/101/hero.webp",
        "inStock": true,
        "quantityCartItem": 2,
        "lineTotal": 160
      }
    ],
    "cartSummary": {
      "totalItems": 2,
      "subtotal": 160
    }
  }
}
```

Success response (`200`) - empty cart:
```json
{
  "status": "success",
  "message": "cart retrieved successfully",
  "data": {
    "cartId": null,
    "items": [],
    "cartSummary": {
      "totalItems": 0,
      "subtotal": 0
    }
  }
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "status": "error",
  "code": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 9) Add Cart Item
**POST** `/cart/items?lang=<EN|TH>`

Adds a product variant into the authenticated user's active cart and creates an active cart automatically when needed.  
Auth: requires `session` cookie.

Request body:
```json
{
  "productId": 101,
  "color": "Beige",
  "size": "M",
  "quantityCartItem": 2
}
```

Success response (`201`):
```json
{
  "status": "success",
  "message": "cart item added successfully",
  "data": {
    "cartId": 12,
    "item": {
      "itemId": 88,
      "productId": 101,
      "name": "Linen Shirt",
      "color": "Beige",
      "price": 80,
      "originalPrice": 100,
      "discount": {
        "type": "percentage",
        "value": 20
      },
      "size": "M",
      "image": "https://cdn.coreco.local/products/101/hero.webp",
      "inStock": true,
      "quantityCartItem": 2,
      "lineTotal": 160
    },
    "cartSummary": {
      "totalItems": 2,
      "subtotal": 160
    }
  }
}
```

Error response (`400 INVALID_REQUEST`):
```json
{
  "status": "error",
  "code": "INVALID_REQUEST",
  "message": "productId, color, size, and quantityCartItem are required"
}
```

Error response (`400 INVALID_PRODUCT_ID`):
```json
{
  "status": "error",
  "code": "INVALID_PRODUCT_ID",
  "message": "productId must be a positive integer"
}
```

Error response (`400 INVALID_QUANTITY`):
```json
{
  "status": "error",
  "code": "INVALID_QUANTITY",
  "message": "quantityCartItem must be a positive integer"
}
```

Error response (`400 INVALID_VARIANT_SELECTION`):
```json
{
  "status": "error",
  "code": "INVALID_VARIANT_SELECTION",
  "message": "color and size do not match an active variant"
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "status": "error",
  "code": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`404 PRODUCT_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "PRODUCT_NOT_FOUND",
  "message": "product with id 101 was not found"
}
```

Error response (`409 INSUFFICIENT_STOCK`):
```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "requested quantity exceeds available stock"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 10) Update Cart Item Quantity
**PUT** `/cart/items/:itemId?lang=<EN|TH>`

Updates quantity for an existing cart item owned by the authenticated user's active cart.  
Auth: requires `session` cookie.

Request body:
```json
{
  "quantityCartItem": 3
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "cart item quantity updated successfully",
  "data": {
    "cartId": 12,
    "item": {
      "itemId": 88,
      "productId": 101,
      "name": "Linen Shirt",
      "color": "Beige",
      "price": 80,
      "originalPrice": 100,
      "discount": {
        "type": "percentage",
        "value": 20
      },
      "size": "M",
      "image": "https://cdn.coreco.local/products/101/hero.webp",
      "inStock": true,
      "quantityCartItem": 3,
      "lineTotal": 240
    },
    "cartSummary": {
      "totalItems": 3,
      "subtotal": 240
    }
  }
}
```

Error response (`400 INVALID_ITEM_ID`):
```json
{
  "status": "error",
  "code": "INVALID_ITEM_ID",
  "message": "itemId must be a positive integer"
}
```

Error response (`400 INVALID_QUANTITY`):
```json
{
  "status": "error",
  "code": "INVALID_QUANTITY",
  "message": "quantityCartItem must be a positive integer"
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "status": "error",
  "code": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`404 CART_ITEM_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "CART_ITEM_NOT_FOUND",
  "message": "cart item with id 88 was not found"
}
```

Error response (`409 INSUFFICIENT_STOCK`):
```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "requested quantity exceeds available stock"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 11) Remove Cart Item
**DELETE** `/cart/items/:itemId`

Removes an existing cart item owned by the authenticated user's active cart and returns the updated cart totals.  
Auth: requires `session` cookie.  
Repeated deletes for the same `itemId` return `404 CART_ITEM_NOT_FOUND`.

Success response (`200`):
```json
{
  "status": "success",
  "message": "cart item removed successfully",
  "data": {
    "itemId": 88,
    "productId": 101,
    "cartSummary": {
      "totalItems": 0,
      "subtotal": 0
    }
  }
}
```

Error response (`400 INVALID_ITEM_ID`):
```json
{
  "status": "error",
  "code": "INVALID_ITEM_ID",
  "message": "itemId must be a positive integer"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`404 CART_ITEM_NOT_FOUND`):
```json
{
  "status": "error",
  "code": "CART_ITEM_NOT_FOUND",
  "message": "cart item with id 88 was not found"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 12) Product Recommendations
**GET** `/products/recommendations?limit=<number>&context=<string>&category=<slug>&excludeProductIds=<id,id>&lang=<EN|TH>`

Returns storefront-ready product recommendations without requiring a search query.

Request query:
- `limit` (optional): integer `1-20`, default `4`
- `context` (optional): non-empty string (for example `cart`, `product`, `home`)
- `category` (optional): category slug, used for category-prioritized ranking
- `excludeProductIds` (optional): comma-separated positive integers
- `lang` (optional): `EN` or `TH`, default `EN`

Selection rules:
- category matches are ranked first when `category` is provided
- fallback candidates use newest active storefront-ready products
- excluded product ids are removed before returning results
- returns `200` with `products: []` when no candidates are available

Success response (`200`):
```json
{
  "status": "success",
  "message": "product recommendations retrieved successfully",
  "data": {
    "context": "cart",
    "limit": 4,
    "products": [
      {
        "productId": 120,
        "name": "Relaxed Cotton Overshirt",
        "detail": "Lightweight overshirt for layering.",
        "color": ["Beige", "Olive"],
        "price": 95,
        "originalPrice": 120,
        "discount": {
          "type": "percentage",
          "value": 21
        },
        "size": ["S", "M", "L", "XL"],
        "image": "https://cdn.coreco.local/products/120/hero.webp",
        "inStock": true
      }
    ]
  }
}
```

Success response (`200`) - no candidates:
```json
{
  "status": "success",
  "message": "product recommendations retrieved successfully",
  "data": {
    "context": "cart",
    "limit": 4,
    "products": []
  }
}
```

Error response (`400 INVALID_QUERY`):
```json
{
  "status": "error",
  "code": "INVALID_QUERY",
  "message": "limit must be an integer between 1 and 20"
}
```

Error response (`400 INVALID_EXCLUDE_PRODUCT_IDS`):
```json
{
  "status": "error",
  "code": "INVALID_EXCLUDE_PRODUCT_IDS",
  "message": "excludeProductIds must be a comma-separated list of positive integers"
}
```

Error response (`400 INVALID_LANGUAGE`):
```json
{
  "status": "error",
  "code": "INVALID_LANGUAGE",
  "message": "lang must be EN or TH"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 13) Get Checkout Address
**GET** `/checkout/address`

Returns the authenticated user's checkout address.  
Auth: requires `session` cookie.

Success response (`200`) - address exists:
```json
{
  "status": "success",
  "message": "checkout address retrieved successfully",
  "data": {
    "address": {
      "fullName": "John Doe",
      "phoneNumber": "0812345678",
      "addressLine1": "123 Moo 5",
      "addressLine2": "Apt 7",
      "district": "Mueang Chiang Mai",
      "province": "Chiang Mai",
      "postalCode": "50200",
      "country": "TH"
    }
  }
}
```

Success response (`200`) - no address:
```json
{
  "status": "success",
  "message": "checkout address retrieved successfully",
  "data": {
    "address": null
  }
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 14) Save Checkout Address
**PUT** `/checkout/address`

Creates or updates the authenticated user's checkout address.  
Auth: requires `session` cookie.

Request body:
```json
{
  "fullName": "John Doe",
  "phoneNumber": "0812345678",
  "addressLine1": "123 Moo 5",
  "addressLine2": "Apt 7",
  "district": "Mueang Chiang Mai",
  "province": "Chiang Mai",
  "postalCode": "50200",
  "country": "TH"
}
```

Success response (`200`):
```json
{
  "status": "success",
  "message": "checkout address saved successfully",
  "data": {
    "address": {
      "fullName": "John Doe",
      "phoneNumber": "0812345678",
      "addressLine1": "123 Moo 5",
      "addressLine2": "Apt 7",
      "district": "Mueang Chiang Mai",
      "province": "Chiang Mai",
      "postalCode": "50200",
      "country": "TH"
    }
  }
}
```

Error response (`400 INVALID_ADDRESS_PAYLOAD`):
```json
{
  "status": "error",
  "code": "INVALID_ADDRESS_PAYLOAD",
  "message": "fullName, phoneNumber, addressLine1, district, province, postalCode, and country are required"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```

### 15) Complete Mock Purchase
**POST** `/checkout/purchase`

Completes checkout without payment gateway integration and creates an order from the authenticated user's active cart.  
Auth: requires `session` cookie.

Success response (`200`):
```json
{
  "status": "success",
  "message": "purchase completed successfully",
  "data": {
    "orderId": 501,
    "orderStatus": "PURCHASED",
    "purchasedAt": "2026-03-22T10:30:00.000Z",
    "cartSummary": {
      "totalItems": 2,
      "subtotal": 160
    }
  }
}
```

Error response (`400 CHECKOUT_ADDRESS_REQUIRED`):
```json
{
  "status": "error",
  "code": "CHECKOUT_ADDRESS_REQUIRED",
  "message": "checkout address is required before purchase"
}
```

Error response (`401 UNAUTHORIZED`):
```json
{
  "status": "error",
  "code": "UNAUTHORIZED",
  "message": "authentication is required"
}
```

Error response (`409 CART_EMPTY`):
```json
{
  "status": "error",
  "code": "CART_EMPTY",
  "message": "cart is empty"
}
```

Error response (`409 CART_ITEM_UNAVAILABLE`):
```json
{
  "status": "error",
  "code": "CART_ITEM_UNAVAILABLE",
  "message": "cart contains unavailable items"
}
```

Error response (`409 INSUFFICIENT_STOCK`):
```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "requested quantity exceeds available stock"
}
```

Error response (`500 INTERNAL_SERVER_ERROR`):
```json
{
  "status": "error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "internal server error"
}
```
