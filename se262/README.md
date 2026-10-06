# Core&Co

End-of-term **953262 (Web Programming) & 953234 (DevOps / GitHub Workflow) Online Webstore** project.

This repository contains a **customer-facing webstore** and an **admin back-office** system built to match the course requirements:
- Customers can browse/search products, view details, add to basket (login required), and complete a purchase (simulated payment).
- Admins can manage categories/products (CRUD), hide/show categories, and view sales history.
- DevOps requirements include GitHub + Kanban usage, Docker deployment, and GitHub Actions CI/CD (deploy to AWS EC2).

## Documentation Version
- Current: v1.3.0
- Last updated: 2026-03-26
- Owner: Core&Co Team
- Changelog: [CHANGELOG.md](./CHANGELOG.md)

---

## Tech Stack
- **Frontend (SSR):** EJS + Bootstrap
- **Backend:** Node.js + Express
- **Database:** MySQL + Supabase
- **DevOps:** Docker Compose, GitHub Actions, AWS EC2 (optional Nginx reverse proxy)

---

## Features

### Webstore (Customer)
1. **Navigation & Layout**
   - Responsive header with category navigation (`Men/Women/Kids`)
   - Parent-to-child category dropdown
   - Search bar
   - `TH/EN` language toggle
   - Account icon (`login/register/profile`)
   - Wishlist icon
   - Cart icon with item count badge
   - Footer with informational links, contact/support, policy links (`Terms/Privacy`), and social links
   - Mobile-responsive layout

2. **Authentication**
   - Multi-step register flow (`email + personal info`)
   - Email verification with resend option
   - Login/logout (`session-based auth`)
   - Forgot password
   - Reset password via secure token
   - Account profile view/edit
   - Manage saved addresses (`add/edit/delete/set default`)
   - Users must verify email before checkout

3. **Homepage**
   - Hero banner (`new collection/promotion`)
   - New arrivals (auto-filtered by created date)
   - Featured products
   - Shop-now CTAs
   - Localized product preview cards

4. **Product Listing (Category Page)**
   - Category listing (supports parent/child categories)
   - Filters (`category/gender/keyword`)
   - Sorting (`featured/newest/price low to high/price high to low`)
   - Pagination
   - Product cards showing thumbnail, localized name, discount badge, `price + compare_at_price`, wishlist toggle, stock status indicator

5. **Search Page**
   - Keyword search
   - Auto-suggestion dropdown
   - Results list
   - Sorting
   - Filter tabs (`all/men/women`)
   - Total result count
   - Pagination or load more
   - Empty-state when no results

6. **Product Detail Page**
   - Hero image and image gallery
   - Localized description
   - SKU/variant selection (`size/color`)
   - Pricing + discounted pricing + stock status (per variant)
   - Quantity selector
   - Add to cart
   - Add to wishlist
   - Reviews section (`average rating`, `rating breakdown`, `comments`, `review images`, `admin replies`)
   - Recommended products section

7. **Wishlist (Favorites)**
   - Saved products list (no duplicates)
   - Remove item
   - Add to cart from wishlist
   - Empty-state UI when no items
   - Recommendation section
   - Persistent per logged-in user

8. **Cart**
   - View items
   - Update quantity
   - Remove item
   - Subtotal calculation
   - Discount display (if applicable)
   - Stock revalidation on quantity update and checkout
   - Secure checkout badge
   - Empty-state UI
   - Recommendation section
   - One active cart per user

9. **Checkout**
   - Login required (no guest checkout)
   - Select saved shipping/billing address or create new address
   - Order summary (`items`, `subtotal`, `shipping fee`, `VAT if applicable`, `total`)
   - Confirm order
   - Stock deduction upon confirmation
   - Snapshot-based order creation (store product name, variant, and price at purchase)
   - Confirmation page
   - Payment is mock/record-only (no real payment processing)

10. **Orders**
    - Order history list
    - Order detail page
    - Order status tracking (`PENDING`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`)
    - Purchased items with snapshot data
    - Shipping address snapshot
    - Billing address snapshot (if applicable)
    - Receipt information
    - Allow cancellation when status is `PENDING` or `PROCESSING`

11. **Reviews**
    - Only verified users who purchased the product can write reviews
    - `1-5` rating
    - Comment
    - Upload review images
    - View all reviews
    - View admin replies
    - Display average rating and review count

12. **Chat (Optional)**
    - Open conversation with admin
    - Send message
    - Receive response from admin or AI bot
    - Conversation history
    - Read/unread tracking
    - Basic notification indicator

13. **Analytics Tracking (Invisible)**
    - Track product views
    - Track search queries
    - Track wishlist interactions
    - Track cart interactions
    - Track checkout attempts
    - Track review interactions
    - Internal analytics use only

### Admin Panel
1. **Admin Authentication**
   - Admin login
   - Role-based access (`Owner/Manager/Staff`)
   - Logout
   - Account settings
   - Password change

2. **Dashboard**
   - Total revenue by date range
   - Order count
   - Products sold
   - Revenue graph
   - Top sellers
   - Sales by category
   - Growth comparison
   - Recent activity feed

3. **Product Management**
   - Create/edit/soft-delete products
   - Manage translations
   - Manage categories
   - Manage SKU variants
   - Manage stock
   - Manage pricing and discount pricing
   - Manage media (`thumbnail/hero`)
   - Manage attributes

4. **Category Management**
   - Create parent/child categories
   - Edit/delete categories
   - Manage category translations

5. **Order Management**
   - View all orders
   - Filter by status
   - Update status (`PENDING/CONFIRMED/SHIPPING/DELIVERED/CANCELLED`)
   - View detail
   - Trigger receipt generation
   - Resend receipt email

6. **Receipt Management**
   - Generate receipt
   - Download receipt PDF
   - Send receipt via email
   - View receipt email logs
   - Mark receipt as void

7. **Review Moderation**
   - View/filter reviews (`with images/by rating/by date`)
   - Hide/delete reviews
   - Reply to reviews
   - Like reviews (`admin endorsement`)

8. **Chat Management**
   - View open conversations
   - Reply as admin
   - Close conversation
   - View AI bot logs
   - Escalate bot-to-human

9. **Analytics Page**
   - Product view trends (`7 days`)
   - Most viewed products
   - Most wishlisted products
   - Most discussed products
   - Search keyword trends
   - Category performance
   - Revenue trends
   - Growth percentage

---

## Architecture (High Level)
Browser → Express (EJS pages + routes) → MySQL  
(Static assets served via `frontend/public`)

---

## Repository Structure
```core&co
├── frontend/                    # EJS + Bootstrap UI layer
│   ├── README.md
│   ├── views/
│   │   ├── layouts/             # main layout wrapper
│   │   ├── partials/            # navbar/footer/alerts
│   │   └── pages/               # actual pages (home, login, etc.)
│   └── public/                  # static assets
│       ├── css/
│       ├── js/
│       └── images/
│
├── backend/                     # Node.js + Express server
│   ├── README.md
│   ├── src/
│   │   ├── app.js               # express config (middlewares, view/static paths)
│   │   ├── server.js            # start server (listen)
│   │   ├── routes/              # route definitions
│   │   ├── controllers/         # request handlers
│   │   ├── services/            # business logic
│   │   ├── models/              # DB models / ORM
│   │   ├── middleware/          # auth, error handling
│   │   └── config/              # db/env config
│   ├── tests/
│   ├── package.json
│   └── package-lock.json        # required for npm ci in GitHub Actions
│
├── db/                          # MySQL init scripts (docker)
│   ├── README.md
│   └── init/
│       └── 001_init.sql
│
├── docs/                        # documentation
│   ├── architecture.md
│   └── deployment.md
│   └── ui-design.md
│   └── images/
│
├── .github/                     # automation + templates
│   ├── workflows/
│   │   ├── ci.yml               # PR dependency/install checks (root + backend)
│   │   └── deploy.yml           # build/push Docker Hub images + deploy to EC2
│   └── ISSUE_TEMPLATE/
│
├── .gitignore                   # ignore node_modules, .env, logs, etc.
├── .editorconfig                # consistency across editors (recommended)
├── .dockerignore                # build context ignore rules
├── docker-compose.yml           # local
├── docker-compose.prod.yml      # production (image-based runtime)
├── backend/Dockerfile           # backend image build
├── frontend/Dockerfile          # frontend image build
├── .env.example
└── README.md
```
## Subproject READMEs
- Frontend: `frontend/README.md`
- Backend: `backend/README.md`
- Database: `db/README.md`
- Project Architecture: `docs/architecture.md`
- Project UX/UI Design: `docs/ui-design.md`
- Project Deployment Guide: `docs/deployment.md`

## CI/CD (Dev)
- `ci.yml` runs on pull requests targeting `main` and `development`.
- CI installs dependencies with lockfiles in both app entrypoints:
  - root (`package-lock.json`)
  - `backend/package-lock.json`
- `deploy.yml` runs on push to `main` and `development`.
- Deploy flow:
  1. Build backend/frontend Docker images.
  2. Push images to Docker Hub.
  3. SSH to EC2, pull images via `docker compose`, and start services.
  4. Run smoke checks:
     - backend `/health`
     - browser-level frontend check

Required GitHub Secrets:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_PRIVATE_KEY`
- `EC2_APP_DIR`
- `DEV_BACKEND_HEALTH_URL`
- `DEV_FRONTEND_URL`
- optional: `EC2_PORT` (defaults to `22`)

## Team Members
622115040 Suchanun Sirijanya (Only studying 953262)<br>
672115034 Phutawan Muengma<br>
672115039 Metavee Aeinjang<br>
672115045 Virawit Kongthong
