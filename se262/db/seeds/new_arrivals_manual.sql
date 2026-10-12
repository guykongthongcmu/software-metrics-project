-- When testing with docker compose locally use this command to like insert this seed data into the tables
-- 1. docker compose up -d mysql
-- 2. docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/new_arrivals_manual.sql

START TRANSACTION;

-- Remove previous manual new-arrivals seed products so the file can be re-run safely.
DELETE FROM products
WHERE product_id IN (
  SELECT product_id
  FROM product_translation
  WHERE name LIKE '[NA-SEED] %'
);

-- Product 1: newest qualifying product, has EN + TH translations, thumbnail beats hero.
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-17 10:00:00', '2026-03-17 10:00:00');
SET @p1 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@p1, 'EN', '[NA-SEED] Linen Shirt', 'Manual seed product 1 EN'),
  (@p1, 'TH', '[NA-SEED] Linen Shirt TH', 'Manual seed product 1 TH');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@p1, 'NA-SEED-LINEN-S', 'Beige', 'S', 80.00, 100.00, 5, 1),
  (@p1, 'NA-SEED-LINEN-M', 'Beige', 'M', 90.00, 100.00, 2, 1);

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @p1,
    'product-images',
    'seed/p1-hero.jpg',
    'https://picsum.photos/seed/na-seed-p1-hero/800/1000',
    'Seed hero image',
    1,
    0,
    1
  ),
  (
    @p1,
    'product-images',
    'seed/p1-thumb.jpg',
    'https://picsum.photos/seed/na-seed-p1-thumb/800/1000',
    'Seed thumbnail image',
    2,
    1,
    0
  );

-- Product 2: EN only, hero only, it is out of stock.
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-17 09:00:00', '2026-03-17 09:00:00');
SET @p2 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@p2, 'EN', '[NA-SEED] Classic Tee', 'Manual seed product 2 EN');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@p2, 'NA-SEED-TEE-S', 'White', 'S', 45.00, NULL, 0, 1);

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @p2,
    'product-images',
    'seed/p2-hero.jpg',
    'https://picsum.photos/seed/na-seed-p2-hero/800/1000',
    'Classic tee hero',
    1,
    0,
    1
  );

-- Product 3: TH only, no thumbnail/hero, should fall back to first sort_order image.
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('BOTTOM', 1, '2026-03-17 08:00:00', '2026-03-17 08:00:00');
SET @p3 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@p3, 'TH', '[NA-SEED] Thai Only Pants', 'Manual seed product 3 TH');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@p3, 'NA-SEED-PANTS-M', 'Brown', 'M', 95.00, 120.00, 3, 1);

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @p3,
    'product-images',
    'seed/p3-1.jpg',
    'https://picsum.photos/seed/na-seed-p3-1/800/1000',
    'Thai pants image 1',
    1,
    0,
    0
  ),
  (
    @p3,
    'product-images',
    'seed/p3-2.jpg',
    'https://picsum.photos/seed/na-seed-p3-2/800/1000',
    'Thai pants image 2',
    2,
    0,
    0
  );

-- Product 4: active + inactive variants, endpoint should ignore the cheaper inactive one.
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('ACCESSORY', 1, '2026-03-17 07:00:00', '2026-03-17 07:00:00');
SET @p4 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@p4, 'EN', '[NA-SEED] Silk Scarf', 'Manual seed product 4 EN'),
  (@p4, 'TH', '[NA-SEED] Silk Scarf TH', 'Manual seed product 4 TH');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@p4, 'NA-SEED-SCARF-ACTIVE', 'Cream', 'ONE', 70.00, NULL, 1, 1),
  (@p4, 'NA-SEED-SCARF-INACTIVE', 'Cream', 'ALT', 50.00, NULL, 10, 0);

INSERT INTO product_media (
  product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero
)
VALUES
  (
    @p4,
    'product-images',
    'seed/p4-thumb.jpg',
    'https://picsum.photos/seed/na-seed-p4-thumb/800/1000',
    'Silk scarf thumb',
    1,
    1,
    0
  );

-- Product 5: newest by created_at but excluded because it has no media.
INSERT INTO products (product_type, is_active, created_at, updated_at)
VALUES ('TOP', 1, '2026-03-17 11:00:00', '2026-03-17 11:00:00');
SET @p5 = LAST_INSERT_ID();

INSERT INTO product_translation (product_id, language_code, name, description)
VALUES
  (@p5, 'EN', '[NA-SEED] Excluded No Media', 'Should not appear in new arrivals');

INSERT INTO product_variant (
  product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active
)
VALUES
  (@p5, 'NA-SEED-NOMEDIA', 'Black', 'L', 60.00, NULL, 4, 1);

COMMIT;
