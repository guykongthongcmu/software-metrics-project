-- Manual seed for product recommendation endpoint testing.
-- Run with:
-- 1) docker compose up -d mysql
-- 2) docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/recommendations_manual.sql

START TRANSACTION;

-- Re-runnable cleanup for recommendation seed user data.
-- Cascades into sessions/cart/cart_item/wishlist.
DELETE FROM users
WHERE email = 'rec.seed.user@local.test';

-- Re-runnable cleanup for previous recommendation seed products.
DELETE p
FROM products p
INNER JOIN product_translation pt
  ON pt.product_id = p.product_id
WHERE pt.name LIKE '[REC-SEED] %';

-- Re-runnable cleanup for previous recommendation seed categories.
DELETE FROM category
WHERE slug LIKE 'rec-seed-%';

-- Category seeds
INSERT INTO category (parent_category_id, category_name, slug)
VALUES
  (NULL, '[REC-SEED] Men Shirts', 'rec-seed-men-shirts');
SET @rec_cat_men = LAST_INSERT_ID();

INSERT INTO category_translation (category_id, language_code, name)
VALUES
  (@rec_cat_men, 'EN', '[REC-SEED] Men Shirts'),
  (@rec_cat_men, 'TH', '[REC-SEED] Men Shirts TH');

INSERT INTO category (parent_category_id, category_name, slug)
VALUES
  (NULL, '[REC-SEED] Women Tops', 'rec-seed-women-tops');
SET @rec_cat_women = LAST_INSERT_ID();

INSERT INTO category_translation (category_id, language_code, name)
VALUES
  (@rec_cat_women, 'EN', '[REC-SEED] Women Tops'),
  (@rec_cat_women, 'TH', '[REC-SEED] Women Tops TH');

INSERT INTO category (parent_category_id, category_name, slug)
VALUES
  (NULL, '[REC-SEED] Accessories', 'rec-seed-accessories');
SET @rec_cat_accessory = LAST_INSERT_ID();

INSERT INTO category_translation (category_id, language_code, name)
VALUES
  (@rec_cat_accessory, 'EN', '[REC-SEED] Accessories'),
  (@rec_cat_accessory, 'TH', '[REC-SEED] Accessories TH');

-- Product 1: active + in stock + discounted (men shirts)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-21 10:00:00', '2026-03-21 10:00:00');
SET @rec_p1 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@rec_p1, 'EN', '[REC-SEED] Linen Shirt', 'Recommendation seed product 1 EN'),
  (@rec_p1, 'TH', '[REC-SEED] Linen Shirt TH', 'Recommendation seed product 1 TH');

INSERT INTO product_category (product_id, category_id, is_primary)
VALUES
  (@rec_p1, @rec_cat_men, 1);

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@rec_p1, 'REC-SEED-LINEN-BEIGE-M', 'Beige', 'M', 80.00, 100.00, 12, 1),
  (@rec_p1, 'REC-SEED-LINEN-BEIGE-L', 'Beige', 'L', 80.00, 100.00, 8, 1);
SET @rec_v1 = LAST_INSERT_ID();

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @rec_p1,
    'product-images',
    'seed/rec-p1-hero.jpg',
    'https://picsum.photos/seed/rec-seed-p1-hero/800/1000',
    'Recommendation seed product 1 hero',
    1,
    1,
    1
  );

-- Product 2: active + in stock + no discount (men shirts)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-21 09:00:00', '2026-03-21 09:00:00');
SET @rec_p2 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@rec_p2, 'EN', '[REC-SEED] Cotton Tee', 'Recommendation seed product 2 EN');

INSERT INTO product_category (product_id, category_id, is_primary)
VALUES
  (@rec_p2, @rec_cat_men, 1);

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@rec_p2, 'REC-SEED-TEE-WHITE-M', 'White', 'M', 45.00, NULL, 20, 1);
SET @rec_v2 = LAST_INSERT_ID();

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @rec_p2,
    'product-images',
    'seed/rec-p2-hero.jpg',
    'https://picsum.photos/seed/rec-seed-p2-hero/800/1000',
    'Recommendation seed product 2 hero',
    1,
    1,
    1
  );

-- Product 3: active + in stock (women tops)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-21 08:00:00', '2026-03-21 08:00:00');
SET @rec_p3 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@rec_p3, 'EN', '[REC-SEED] Silk Blouse', 'Recommendation seed product 3 EN');

INSERT INTO product_category (product_id, category_id, is_primary)
VALUES
  (@rec_p3, @rec_cat_women, 1);

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@rec_p3, 'REC-SEED-BLOUSE-CREAM-S', 'Cream', 'S', 120.00, 150.00, 7, 1);
SET @rec_v3 = LAST_INSERT_ID();

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @rec_p3,
    'product-images',
    'seed/rec-p3-hero.jpg',
    'https://picsum.photos/seed/rec-seed-p3-hero/800/1000',
    'Recommendation seed product 3 hero',
    1,
    1,
    1
  );

-- Product 4: active but out of stock (accessories)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('ACCESSORY', 1, '2026-03-21 07:00:00', '2026-03-21 07:00:00');
SET @rec_p4 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@rec_p4, 'EN', '[REC-SEED] Leather Belt', 'Recommendation seed product 4 EN');

INSERT INTO product_category (product_id, category_id, is_primary)
VALUES
  (@rec_p4, @rec_cat_accessory, 1);

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@rec_p4, 'REC-SEED-BELT-BROWN-L', 'Brown', 'L', 70.00, NULL, 0, 1);
SET @rec_v4 = LAST_INSERT_ID();

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @rec_p4,
    'product-images',
    'seed/rec-p4-hero.jpg',
    'https://picsum.photos/seed/rec-seed-p4-hero/800/1000',
    'Recommendation seed product 4 hero',
    1,
    1,
    1
  );

-- Product 5: inactive product (should be excluded by active filters)
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 0, '2026-03-21 06:00:00', '2026-03-21 06:00:00');
SET @rec_p5 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@rec_p5, 'EN', '[REC-SEED] Inactive Hoodie', 'Recommendation seed product 5 EN');

INSERT INTO product_category (product_id, category_id, is_primary)
VALUES
  (@rec_p5, @rec_cat_men, 1);

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@rec_p5, 'REC-SEED-HOODIE-GREY-M', 'Grey', 'M', 99.00, NULL, 5, 1);

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @rec_p5,
    'product-images',
    'seed/rec-p5-hero.jpg',
    'https://picsum.photos/seed/rec-seed-p5-hero/800/1000',
    'Recommendation seed product 5 hero',
    1,
    1,
    1
  );

-- Optional auth seed user for protected recommendation endpoints.
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
  'rec.seed.user@local.test',
  'seed-hash',
  'Rec',
  'Seed',
  '2000-01-01',
  '0800009999',
  'EN',
  NOW()
);
SET @rec_user = LAST_INSERT_ID();

INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at)
VALUES (
  'USER',
  @rec_user,
  NULL,
  'rec-seed-session-token',
  DATE_ADD(NOW(), INTERVAL 7 DAY)
);

-- Optional context seed rows (cart + wishlist).
INSERT INTO cart (user_id, status, created_at, updated_at)
VALUES (@rec_user, 'ACTIVE', NOW(), NOW());
SET @rec_cart = LAST_INSERT_ID();

INSERT INTO cart_item (cart_id, product_variant_id, quantity, created_at, updated_at)
VALUES
  (@rec_cart, @rec_v1, 1, NOW(), NOW());

INSERT INTO wishlist (user_id, product_id, created_at)
VALUES
  (@rec_user, @rec_p2, NOW());

COMMIT;

-- Quick copy values for Postman variables.
SELECT
  'rec-seed-session-token' AS sessionToken,
  @rec_p1 AS productId1,
  @rec_p2 AS productId2,
  @rec_p3 AS productId3,
  @rec_p4 AS productId4,
  @rec_p5 AS productId5,
  @rec_cat_men AS categoryIdMen,
  @rec_cat_women AS categoryIdWomen,
  @rec_cat_accessory AS categoryIdAccessory;
