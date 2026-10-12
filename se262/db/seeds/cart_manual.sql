-- Manual seed for cart endpoint testing.
-- Run with:
-- 1) docker compose up -d mysql
-- 2) docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/cart_manual.sql

START TRANSACTION;

-- Re-runnable cleanup for previous cart manual seed users.
-- Cascades into sessions/cart/cart_item because of FK delete rules.
DELETE FROM users
WHERE email IN (
  'cart.seed.populated@local.test',
  'cart.seed.empty@local.test',
  'cart.seed.noaddress@local.test'
);

-- Re-runnable cleanup for previous cart manual seed products.
DELETE p
FROM products p
INNER JOIN product_translation pt
  ON pt.product_id = p.product_id
WHERE pt.name LIKE '[CART-SEED] %';

-- Product 1 (discount + in stock)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-20 10:00:00', '2026-03-20 10:00:00');
SET @cart_p1 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@cart_p1, 'EN', '[CART-SEED] Linen Shirt', 'Cart seed product 1 EN description'),
  (@cart_p1, 'TH', '[CART-SEED] Linen Shirt TH', 'Cart seed product 1 TH description');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@cart_p1, 'CART-SEED-LINEN-M', 'Beige', 'M', 80.00, 100.00, 10, 1);
SET @cart_v1 = LAST_INSERT_ID();

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @cart_p1,
    'product-images',
    'seed/cart-p1-hero.jpg',
    'https://picsum.photos/seed/cart-seed-p1-hero/800/1000',
    'Cart seed product 1 hero',
    1,
    1,
    1
  );

-- Product 2 (no discount + out of stock)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('BOTTOM', 1, '2026-03-20 09:00:00', '2026-03-20 09:00:00');
SET @cart_p2 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@cart_p2, 'EN', '[CART-SEED] Chino Pants', 'Cart seed product 2 EN description'),
  (@cart_p2, 'TH', '[CART-SEED] Chino Pants TH', 'Cart seed product 2 TH description');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@cart_p2, 'CART-SEED-CHINO-L', 'Brown', 'L', 120.00, NULL, 0, 1);
SET @cart_v2 = LAST_INSERT_ID();

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @cart_p2,
    'product-images',
    'seed/cart-p2-thumb.jpg',
    'https://picsum.photos/seed/cart-seed-p2-thumb/800/1000',
    'Cart seed product 2 thumbnail',
    1,
    1,
    0
  );

-- User A: populated cart
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
  'cart.seed.populated@local.test',
  'seed-hash',
  'Cart',
  'Populated',
  '2000-01-01',
  '0800000001',
  'EN',
  NOW()
);
SET @cart_user_pop = LAST_INSERT_ID();

INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at)
VALUES (
  'USER',
  @cart_user_pop,
  NULL,
  'cart-seed-populated-session-token',
  DATE_ADD(NOW(), INTERVAL 7 DAY)
);

INSERT INTO cart (user_id, status, created_at, updated_at)
VALUES (@cart_user_pop, 'ACTIVE', NOW(), NOW());
SET @cart_id_pop = LAST_INSERT_ID();

INSERT INTO cart_item (cart_id, product_variant_id, quantity, created_at, updated_at)
VALUES
  (@cart_id_pop, @cart_v1, 2, NOW(), NOW()),
  (@cart_id_pop, @cart_v2, 1, NOW(), NOW());

-- User B: empty cart case (no active cart)
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
  'cart.seed.empty@local.test',
  'seed-hash',
  'Cart',
  'Empty',
  '2001-01-01',
  '0800000002',
  'EN',
  NOW()
);
SET @cart_user_empty = LAST_INSERT_ID();

INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at)
VALUES (
  'USER',
  @cart_user_empty,
  NULL,
  'cart-seed-empty-session-token',
  DATE_ADD(NOW(), INTERVAL 7 DAY)
);

-- User C: no-address case (has active cart with in-stock item, but no address row)
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
  'cart.seed.noaddress@local.test',
  'seed-hash',
  'Cart',
  'NoAddress',
  '2002-01-01',
  '0800000003',
  'EN',
  NOW()
);
SET @cart_user_noaddr = LAST_INSERT_ID();

INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at)
VALUES (
  'USER',
  @cart_user_noaddr,
  NULL,
  'cart-seed-no-address-session-token',
  DATE_ADD(NOW(), INTERVAL 7 DAY)
);

INSERT INTO cart (user_id, status, created_at, updated_at)
VALUES (@cart_user_noaddr, 'ACTIVE', NOW(), NOW());
SET @cart_id_noaddr = LAST_INSERT_ID();

INSERT INTO cart_item (cart_id, product_variant_id, quantity, created_at, updated_at)
VALUES
  (@cart_id_noaddr, @cart_v1, 1, NOW(), NOW());

COMMIT;

-- Copy these values into Postman environment variables.
SELECT
  'cart-seed-populated-session-token' AS sessionTokenPopulated,
  'cart-seed-empty-session-token' AS sessionTokenEmpty,
  'cart-seed-no-address-session-token' AS sessionTokenNoAddress;
