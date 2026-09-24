# Changelog

This is the changelogs for all of our README documents.

## README.md
| Version | Date | Change |
|--------:|------|--------|
| v1.2.1 | 2026-03-07 | Added Supabase into Database section of tech stack. |
| v1.2.0 | 2026-03-02 | Removed Project Planning (Kanban) feature from admin features due to time constraints and moved README changelog to this central file. |
| v1.1.1 | 2026-02-27 | Reformatted Webstore and Admin feature sections for consistency and readability. |
| v1.1.0 | 2026-02-26 | Expanded customer and admin feature requirements in the root documentation. |
| v1.0.0 | 2026-02-20 | Initial documentation baseline. |

## backend/README.md
| Version | Date | Change |
|--------:|------|--------|
| v1.21.0 | 2026-03-26 | Expanded Admin Orders docs with `PATCH /api/admin/orders/:orderId` and `DELETE /api/admin/orders/:orderId`, including address-snapshot correction behavior and cascade-delete notes. |
| v1.20.0 | 2026-03-26 | Added demo reseed runbook for `db/seeds/001_seed_demo_no_media.sql`, documented seeded admin credentials, expected row counts, and no-media storefront caveat with media backfill template reference. |
| v1.19.0 | 2026-03-26 | Added category visibility API notes (`GET /api/admin/categories`, `PATCH /api/admin/categories/:id/visibility`, `GET /api/client/categories`) and storefront hidden-category filtering behavior. |
| v1.18.0 | 2026-03-25 | Added campaign endpoint notes for `POST /api/admin/campaigns` and `GET /api/client/campaigns`, including supported campaign types and best-seller/discount behavior. |
| v1.17.0 | 2026-03-25 | Updated admin docs for `PURCHASED`-only order flow, added Admin Orders endpoint verification notes (`GET /api/admin/orders`, `GET /api/admin/orders/:orderId`), and aligned checkout purchase wording with one-step purchased persistence. |
| v1.16.0 | 2026-03-24 | Updated admin product API verification notes for paginated/filterable list (`page/limit/search/category`) and added update/delete route checks (`PUT /products/:id`, `DELETE /products/:id`). |
| v1.15.0 | 2026-03-24 | Updated auth documentation for DB-backed session cookies (`user/admin signin`, `logout`, protected route behavior), added session env vars, and removed `x-role` placeholder notes from admin sections. |
| v1.14.0 | 2026-03-23 | Added admin dashboard summary endpoint documentation, placeholder admin auth notes, supported query patterns, and current aggregation behavior/TODO notes. |
| v1.13.0 | 2026-03-22 | Added checkout endpoint verification notes for `GET/PUT /api/client/checkout/address` and mock purchase flow `POST /api/client/checkout/purchase`. |
| v1.12.0 | 2026-03-22 | Added client recommendations endpoint verification notes for `GET /api/client/products/recommendations` and query usage examples. |
| v1.11.0 | 2026-03-21 | Documented `DELETE /api/client/cart/items/:itemId` verification flow and updated cart endpoint behavior notes for item removal and summary updates. |
| v1.10.0 | 2026-03-21 | Added client cart item endpoint verification notes for `POST /api/client/cart/items` and `PUT /api/client/cart/items/:itemId`, including stock-conflict behavior. |
| v1.9.0 | 2026-03-20 | Documented `GET /api/client/cart` verification flow, auth requirement, and empty-cart response behavior. |
| v1.8.0 | 2026-03-20 | Added CORS allowlist setup (`CORS_ALLOWED_ORIGINS`), preflight behavior, and cross-origin cookie usage notes. |
| v1.7.0 | 2026-03-20 | Added authenticated favorites endpoint verification (`GET/POST/DELETE /api/client/favorites`) and wishlist/idempotency behavior notes. |
| v1.6.0 | 2026-03-19 | Added storefront product search, suggestions, and category endpoint verification notes and response expectations. |
| v1.5.0 | 2026-03-18 | Documented the refined storefront client product detail response envelope, payload shape, and storefront-ready 404 behavior. |
| v1.4.0 | 2026-03-18 | Documented the admin product create flow, required Supabase media env vars, and backend verification endpoints for admin/client product reads. |
| v1.3.0 | 2026-03-06 | Added short two-step auth API section (`/check-email`, `/signup`) with request samples and status codes. |
| v1.2.0 | 2026-03-05 | Added backend run guide for local npm + Docker MySQL and full Docker Compose flow. |
| v1.1.0 | 2026-03-02 | Moved per-file changelog to root CHANGELOG.md. |
| v1.0.0 | 2026-02-27 | Initial documentation baseline. |

## frontend/README.md
| Version | Date | Change |
|--------:|------|--------|
| v1.2.0 | 2026-03-12 | Rewrote frontend documentation with accurate root-level run commands, routes, and Docker Compose setup/troubleshooting for lockfile and port mapping issues. |
| v1.1.0 | 2026-03-02 | Moved per-file changelog to root CHANGELOG.md. |
| v1.0.0 | 2026-02-27 | Initial documentation baseline. |

## db/README.md
| Version | Date | Change |
|--------:|------|--------|
| v1.4.0 | 2026-03-26 | Added full demo reset seed workflow (`001_seed_demo_no_media.sql`), seeded admin login details, and follow-up media backfill guidance tied to `db/webstore-assets` and `002_media_backfill_template.sql`. |
| v1.3.0 | 2026-03-18 | Added manual new-arrivals seed usage notes for repeatable homepage endpoint testing. |
| v1.2.0 | 2026-03-03 | Added repeatable Docker Compose workflow for local DB testing (reset/apply/verify). |
| v1.1.0 | 2026-03-02 | Moved per-file changelog to root CHANGELOG.md. |
| v1.0.0 | 2026-02-27 | Initial documentation baseline. |

## docs/architecture.md
| Version | Date | Change |
|--------:|------|--------|
| v1.4.6 | 2026-03-26 | Added `CATEGORY.category_name` and `CATEGORY.is_hidden` fields to ERD and bumped architecture doc version metadata. |
| v1.4.5 | 2026-03-25 | Simplified `ORDERS.status` in ERD to `PURCHASED` to match the backend status model. |
| v1.4.4 | 2026-03-07 | Updated `PRODUCT_MEDIA` ERD fields to match schema (`product_media_id`, bucket/path/url metadata, `created_at`) and documented 4-image `sort_order` constraint. |
| v1.4.3 | 2026-03-07 | Renamed ERD relationship label from `verifies_with` to `has_verification_token` to avoid secret-scan false positive. |
| v1.4.2 | 2026-03-05 | Added `date_of_birth` and `phone_number` to USER entity in ERD. |
| v1.4.1 | 2026-03-03 | Expanded analytics model to support purchases, product comments, product likes, and richer aggregation fields. |
| v1.4.0 | 2026-03-03 | Updated chat data model to human-admin only and removed bot-specific entities from ERD. |
| v1.3.0 | 2026-03-02 | Removed project planning (Kanban/timeline) entities and relationships from ERD to match feature removal. |
| v1.2.0 | 2026-02-28 | Aligned ERD with updated customer features and DB acceptance criteria (variants, wishlist, sessions, verification tokens, unified analytics). |
| v1.1.0 | 2026-02-26 | Expanded ERD to cover admin requirements and related entities. |
| v1.0.0 | 2026-02-25 | Initial documentation baseline. |

## docs/deployment.md
| Version | Date | Change |
|--------:|------|--------|
| v1.1.0 | 2026-03-26 | Add guide on how to deploy. |
| v1.0.0 | 2026-02-27 | Initial documentation baseline. |

## docs/ui-design.md
| Version | Date | Change |
|--------:|------|--------|
| v1.0.0 | 2026-02-27 | Initial documentation baseline. |

## docs/api-contract.md
| Version | Date | Change |
|--------:|------|--------|
| v2.12.0 | 2026-03-26 | Expanded Admin Orders API contract with customer metadata in detail responses, plus `PATCH /api/admin/orders/:orderId` and `DELETE /api/admin/orders/:orderId` contracts. |
| v2.11.0 | 2026-03-26 | Added Admin/Client Category API contracts for DB-backed listing and visibility toggle, with `isHidden` behavior and error envelopes. |
| v2.10.0 | 2026-03-25 | Added Admin Campaign and Client Campaign API contracts, including campaign type validation, active-campaign filtering, and normalized campaign payloads. |
| v2.9.0 | 2026-03-25 | Added Admin Orders contracts for `GET /api/admin/orders` and `GET /api/admin/orders/:orderId`, and aligned dashboard aggregation notes to `PURCHASED`-only status. |
| v2.8.0 | 2026-03-24 | Expanded Admin Product API contract with paginated/filterable list query, extended detail response, and new update/delete endpoint contracts (soft/hard delete modes). |
| v2.7.0 | 2026-03-24 | Documented session-cookie auth contract for signin routes, added `POST /api/auth/logout`, and replaced admin `x-role` placeholder auth notes with DB-backed admin session requirements. |
| v2.6.0 | 2026-03-23 | Added the admin dashboard summary contract for `GET /api/admin/dashboard/summary`, including query validation, KPI/chart payload, placeholder auth requirements, and error responses. |
| v2.5.0 | 2026-03-22 | Added checkout contracts for `GET/PUT /checkout/address` and mock purchase endpoint `POST /checkout/purchase` with validation and cart/state error responses. |
| v2.4.0 | 2026-03-22 | Added client recommendations contract for `GET /products/recommendations` with `limit/context/category/excludeProductIds` query handling and error envelopes. |
| v2.3.0 | 2026-03-21 | Added authenticated client cart item remove contract for `DELETE /cart/items/:itemId` with ownership checks and updated cart summary response. |
| v2.2.0 | 2026-03-21 | Added authenticated client cart item contracts for `POST /cart/items` and `PUT /cart/items/:itemId` with validation, stock conflict, and ownership error cases. |
| v2.1.0 | 2026-03-20 | Added `GET /api/client/cart` contract with auth, populated/empty responses, and error envelopes. |
| v2.0.0 | 2026-03-20 | Added global CORS contract documentation for origin allowlisting, credentialed requests, preflight behavior, and CORS error responses. |
| v1.9.0 | 2026-03-20 | Added authenticated client favorites contracts (`GET /favorites`, `POST /favorites/:productId`, `DELETE /favorites/:productId`) with idempotent behavior and error envelopes. |
| v1.8.0 | 2026-03-19 | Added client storefront contracts for `/products/search`, `/products/search/suggestions`, and `/products/category/:category` with pagination, discount normalization, and empty-result behavior. |
| v1.7.0 | 2026-03-18 | Refined `GET /api/client/products/:productId` to the storefront contract (`status/code` envelope, localized fields, variant-driven pricing/discount, and hero-first image selection rules). |
| v1.6.0 | 2026-03-18 | Added admin product create/list/detail/image contracts and the new client product list/detail/image contracts alongside the existing new-arrivals endpoint. |
| v1.5.0 | 2026-03-18 | Added the public new-arrivals product endpoint contract, selection rules, and error responses. |
| v1.1.0 | 2026-03-06 | Added short auth API contract for two-step signup (`/check-email`, `/signup`) with request/response and status codes. |
| v1.0.0 | 2026-03-05 | Initial documentation baseline. |
