# Core & Co. Admin Panel

This directory contains the EJS views and templates for the Core & Co. Admin Panel. 

The Admin Panel is designed using a modern "Liquid Glass" theme and operates primarily via frontend JavaScript communicating with Backend APIs.

## Directory Structure

* `analytics/` - Product and Sales performance charts (Chart.js via EJS).
* `billing/` - Invoices, receipts, and order histories.
* `campaigns/` - Promotional campaign builder and timeline planners.
* `dashboard/` - Main dashboard overview with revenue and quick stats.
* `orders/` - Order management and status updates (Pending, Shipped, etc.)
* `products/` - Product catalog, stock management, and CRUD form.
* `reviews/` - Customer feedback moderation.
* `auth/` - Admin login page.

---

## Required API & Data Contract

To fully implement the Admin Panel, the Backend must construct APIs that return specific JSON structures. The Admin frontend expects the data to be shaped exactly as defined below.

### 1. Product Data Model
When fetching or sending product data (e.g., in `/admin/products/form`), ensure the JSON payload matches this:
```json
{
  "id": 1,
  "name": "Classic White Tee",
  "category_id": 1,
  "category_name": "Men",
  "sku": "TSH-WHT-001",
  "price": 25.00,
  "discount_price": null,
  "stock": 15,
  "status": "active",
  "wishlists": 342,
  "description": "High quality cotton tee...",
  "created_at": "2026-03-01T10:00:00Z"
}
```

### 2. Order Data Model
When checking out from the Web Store, the order must be saved so the Admin can retrieve it with these fields:
```json
{
  "id": 1,
  "order_id": "ORD-1024",
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_avatar": "J",
  "shipping_address": "123 Main St, NY",
  "status": "PENDING",
  "total": 50.00,
  "items_count": 2,
  "created_at": "2026-03-09 10:00",
  "items": [
    { "product_name": "Tee", "sku": "TSH-M", "size": "M", "quantity": 2, "price": 25.0 }
  ]
}
```

### 3. Review Data Model
```json
{
  "id": 1,
  "customer_name": "Sarah Johnson",
  "product_name": "Classic White Tee",
  "rating": 5,
  "comment": "Absolutely love this tee!",
  "image_url": "https://...",
  "is_liked": true,
  "admin_reply": "Thank you!",
  "created_at": "2026-03-10 14:30"
}
```

---

## Required API Endpoints

The Frontend will use `fetch()` to call these expected Backend RESTful endpoints.

### Products
- `GET /api/v1/admin/products` -> List products
- `GET /api/v1/admin/products/:id` -> Get product details
- `POST /api/v1/admin/products` -> Create product
- `PUT /api/v1/admin/products/:id` -> Update product fields
- `DELETE /api/v1/admin/products/:id` -> Delete product

### Orders
- `GET /api/v1/admin/orders` -> List all orders (can filter by `?status=`)
- `GET /api/v1/admin/orders/:id` -> Get complete order details along with cart items
- `PUT /api/v1/admin/orders/:id/status` -> Update status (e.g., to `SHIPPED`)

### Dashboard
- `GET /api/v1/admin/dashboard/summary` -> Returns total revenue, active orders, and chart metric arrays.
- `GET /api/v1/admin/notifications` -> Returns system notifications (e.g., low stock alerts).

### CSS/Asset Dependencies
- `liquid-glass.css` - Custom styling overrides and theme definitions.
- `app.css` - Layout utilities and baseline styles.
- `app-admin.js` - Dynamic UI handlers and chart rendering scripts.

*Note for Developers: Ensure that CORS is enabled if backend APIs are hosted on a different port/domain from the EJS server.*
