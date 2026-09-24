-- Manual seed for admin dashboard summary testing.
-- Run with:
-- 1) docker compose up -d mysql
-- 2) docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/dashboard_summary_manual.sql
--
-- This seed inserts deterministic PURCHASED orders for two equivalent 7-day windows:
-- - Previous: 2026-03-10..2026-03-16
-- - Current : 2026-03-17..2026-03-23
--
-- Expected totals:
-- Previous => revenue=3000, orders=3, productsSold=6
-- Current  => revenue=6000, orders=4, productsSold=10
-- Growth   => revenue=100.0, orders=33.3, productsSold=66.7

START TRANSACTION;

-- Upsert a dedicated user for dashboard seed orders.
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  date_of_birth,
  phone_number,
  preferred_language,
  email_verified_at
)
VALUES (
  'dashboard.seed.orders@local.test',
  'seed-hash',
  'Dashboard',
  'Seed',
  '1997-01-01',
  '0890000010',
  'EN',
  NOW()
)
ON DUPLICATE KEY UPDATE
  user_id = LAST_INSERT_ID(user_id),
  first_name = VALUES(first_name),
  last_name = VALUES(last_name),
  phone_number = VALUES(phone_number),
  preferred_language = VALUES(preferred_language),
  email_verified_at = VALUES(email_verified_at),
  updated_at = CURRENT_TIMESTAMP;
SET @dashboard_seed_user_id = LAST_INSERT_ID();

-- Re-runnable cleanup for this seed set.
DELETE oi
FROM order_item oi
INNER JOIN orders o
  ON o.order_id = oi.order_id
WHERE o.user_id = @dashboard_seed_user_id
  AND o.shipping_address_snapshot = '[DASHBOARD-SEED]';

DELETE FROM orders
WHERE user_id = @dashboard_seed_user_id
  AND shipping_address_snapshot = '[DASHBOARD-SEED]';

-- PREVIOUS WINDOW (2026-03-10..2026-03-16)
INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  1000.00,
  0.00,
  0.00,
  1000.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-10 10:00:00',
  '2026-03-10 10:00:00'
);
SET @seed_order_prev_1 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_prev_1,
  NULL,
  '[DASHBOARD-SEED] Product A',
  'Black',
  'M',
  500.00,
  NULL,
  2,
  1000.00
);

INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  1500.00,
  0.00,
  0.00,
  1500.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-12 12:00:00',
  '2026-03-12 12:00:00'
);
SET @seed_order_prev_2 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_prev_2,
  NULL,
  '[DASHBOARD-SEED] Product B',
  'White',
  'L',
  500.00,
  NULL,
  3,
  1500.00
);

INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  500.00,
  0.00,
  0.00,
  500.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-15 16:30:00',
  '2026-03-15 16:30:00'
);
SET @seed_order_prev_3 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_prev_3,
  NULL,
  '[DASHBOARD-SEED] Product C',
  'Brown',
  'S',
  500.00,
  NULL,
  1,
  500.00
);

-- CURRENT WINDOW (2026-03-17..2026-03-23)
INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  1200.00,
  0.00,
  0.00,
  1200.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-17 10:00:00',
  '2026-03-17 10:00:00'
);
SET @seed_order_curr_1 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_curr_1,
  NULL,
  '[DASHBOARD-SEED] Product D',
  'Grey',
  'M',
  600.00,
  NULL,
  2,
  1200.00
);

INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  1800.00,
  0.00,
  0.00,
  1800.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-18 11:45:00',
  '2026-03-18 11:45:00'
);
SET @seed_order_curr_2 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_curr_2,
  NULL,
  '[DASHBOARD-SEED] Product E',
  'Blue',
  'L',
  450.00,
  NULL,
  4,
  1800.00
);

INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  2000.00,
  0.00,
  0.00,
  2000.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-20 15:20:00',
  '2026-03-20 15:20:00'
);
SET @seed_order_curr_3 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_curr_3,
  NULL,
  '[DASHBOARD-SEED] Product F',
  'Green',
  'XL',
  666.67,
  NULL,
  3,
  2000.00
);

INSERT INTO orders (
  user_id,
  shipping_address_id,
  billing_address_id,
  status,
  subtotal,
  shipping_fee,
  vat_amount,
  total,
  shipping_address_snapshot,
  billing_address_snapshot,
  created_at,
  updated_at
)
VALUES (
  @dashboard_seed_user_id,
  NULL,
  NULL,
  'PURCHASED',
  1000.00,
  0.00,
  0.00,
  1000.00,
  '[DASHBOARD-SEED]',
  '[DASHBOARD-SEED]',
  '2026-03-23 21:10:00',
  '2026-03-23 21:10:00'
);
SET @seed_order_curr_4 = LAST_INSERT_ID();

INSERT INTO order_item (
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
)
VALUES (
  @seed_order_curr_4,
  NULL,
  '[DASHBOARD-SEED] Product G',
  'Navy',
  'S',
  1000.00,
  NULL,
  1,
  1000.00
);

COMMIT;

-- Quick check result for period=custom&from=2026-03-17&to=2026-03-23
SELECT
  6000.00 AS expectedRevenueCurrent,
  4 AS expectedOrdersCurrent,
  10 AS expectedProductsSoldCurrent,
  100.0 AS expectedRevenueGrowthPercent,
  33.3 AS expectedOrdersGrowthPercent,
  66.7 AS expectedProductsSoldGrowthPercent;
