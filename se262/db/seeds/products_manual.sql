-- Manual seed for products across multiple categories.
-- Run with:
-- 1) docker compose up -d mysql
-- 2) docker exec -i coreco-mysql mysql -uroot -prootpass core_co < db/seeds/products_manual.sql

START TRANSACTION;

-- Cleanup previous seed data
DELETE FROM products 
WHERE product_id IN (
  SELECT product_id 
  FROM product_translation 
  WHERE name LIKE '[SEED] %'
);

DELETE FROM category 
WHERE slug LIKE 'seed-%';

-- ---------------------------------------------------------
-- Categories
-- ---------------------------------------------------------

-- Men's Wear
INSERT INTO category (category_name, slug) VALUES ('[SEED] Men\'s Wear', 'seed-mens-wear');
SET @cat_men = LAST_INSERT_ID();
INSERT INTO category_translation (category_id, language_code, name) VALUES (@cat_men, 'EN', '[SEED] Men\'s Wear'), (@cat_men, 'TH', '[SEED] เสื้อผ้าผู้ชาย');

-- Women's Wear
INSERT INTO category (category_name, slug) VALUES ('[SEED] Women\'s Wear', 'seed-womens-wear');
SET @cat_women = LAST_INSERT_ID();
INSERT INTO category_translation (category_id, language_code, name) VALUES (@cat_women, 'EN', '[SEED] Women\'s Wear'), (@cat_women, 'TH', '[SEED] เสื้อผ้าผู้หญิง');

-- Accessories
INSERT INTO category (category_name, slug) VALUES ('[SEED] Accessories', 'seed-accessories');
SET @cat_acc = LAST_INSERT_ID();
INSERT INTO category_translation (category_id, language_code, name) VALUES (@cat_acc, 'EN', '[SEED] Accessories'), (@cat_acc, 'TH', '[SEED] เครื่องประดับ');

-- ---------------------------------------------------------
-- Products: TOPS
-- ---------------------------------------------------------

-- Product 1: Linen Shirt
INSERT INTO products (product_type, is_active) VALUES ('TOP', 1);
SET @p1 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p1, 'EN', '[SEED] Linen Shirt', 'A breathable linen shirt perfect for summer.'),
  (@p1, 'TH', '[SEED] เสื้อเชิ้ตผ้าลินิน', 'เสื้อเชิ้ตผ้าลินินระบายอากาศได้ดี เหมาะสำหรับฤดูร้อน');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p1, @cat_men, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p1, 'SEED-LINEN-WHT-M', 'White', 'M', 890.00, 50),
  (@p1, 'SEED-LINEN-WHT-L', 'White', 'L', 890.00, 30),
  (@p1, 'SEED-LINEN-BLU-M', 'Blue', 'M', 890.00, 20);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p1, 'products', 'seed/linen-1.jpg', 'https://picsum.photos/seed/seed-p1-1/800/1000', 'Linen Shirt Hero', 1, 1, 1);

-- Product 2: Essential Tee
INSERT INTO products (product_type, is_active) VALUES ('TOP', 1);
SET @p2 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p2, 'EN', '[SEED] Essential Tee', 'High-quality cotton tee for everyday wear.'),
  (@p2, 'TH', '[SEED] เสื้อยืด Essential', 'เสื้อยืดผ้าฝ้ายคุณภาพสูงสำหรับใส่ได้ทุกวัน');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p2, @cat_men, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p2, 'SEED-TEE-BLK-M', 'Black', 'M', 450.00, 100),
  (@p2, 'SEED-TEE-GRY-M', 'Grey', 'M', 450.00, 80);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p2, 'products', 'seed/tee-1.jpg', 'https://picsum.photos/seed/seed-p2-1/800/1000', 'Essential Tee Hero', 1, 1, 1);

-- Product 3: Silk Blouse
INSERT INTO products (product_type, is_active) VALUES ('TOP', 1);
SET @p3 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p3, 'EN', '[SEED] Silk Blouse', 'Elegant silk blouse for formal occasions.'),
  (@p3, 'TH', '[SEED] เสื้อเบลาส์ผ้าไหม', 'เสื้อเบลาส์ผ้าไหมหรูหราสำหรับโอกาสทางการ');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p3, @cat_women, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p3, 'SEED-SILK-CRM-S', 'Cream', 'S', 1590.00, 15),
  (@p3, 'SEED-SILK-PNK-S', 'Pink', 'S', 1590.00, 10);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p3, 'products', 'seed/silk-1.jpg', 'https://picsum.photos/seed/seed-p3-1/800/1000', 'Silk Blouse Hero', 1, 1, 1);

-- ---------------------------------------------------------
-- Products: BOTTOMS
-- ---------------------------------------------------------

-- Product 4: Slim Fit Chinos
INSERT INTO products (product_type, is_active) VALUES ('BOTTOM', 1);
SET @p4 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p4, 'EN', '[SEED] Slim Fit Chinos', 'Versatile chinos for a smart-casual look.'),
  (@p4, 'TH', '[SEED] กางเกงชิโนทรงสลิม', 'กางเกงชิโนที่ใช้งานได้หลากหลายสำหรับลุคสมาร์ทแคชชวล');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p4, @cat_men, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p4, 'SEED-CHINO-KHK-32', 'Khaki', '32', 1290.00, 40),
  (@p4, 'SEED-CHINO-NVY-32', 'Navy', '32', 1290.00, 35);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p4, 'products', 'seed/chino-1.jpg', 'https://picsum.photos/seed/seed-p4-1/800/1000', 'Chinos Hero', 1, 1, 1);

-- Product 5: Straight Jeans
INSERT INTO products (product_type, is_active) VALUES ('BOTTOM', 1);
SET @p5 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p5, 'EN', '[SEED] Straight Jeans', 'Classic straight-cut denim jeans.'),
  (@p5, 'TH', '[SEED] กางเกงยีนส์ทรงกระบอก', 'กางเกงยีนส์เดนิมทรงกระบอกคลาสสิก');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p5, @cat_women, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p5, 'SEED-JEANS-BLU-28', 'Blue', '28', 1890.00, 25),
  (@p5, 'SEED-JEANS-BLK-28', 'Black', '28', 1890.00, 20);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p5, 'products', 'seed/jeans-1.jpg', 'https://picsum.photos/seed/seed-p5-1/800/1000', 'Jeans Hero', 1, 1, 1);

-- ---------------------------------------------------------
-- Products: ACCESSORIES
-- ---------------------------------------------------------

-- Product 6: Classic Leather Belt
INSERT INTO products (product_type, is_active) VALUES ('ACCESSORY', 1);
SET @p6 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p6, 'EN', '[SEED] Classic Leather Belt', 'Genuine leather belt with a timeless buckle.'),
  (@p6, 'TH', '[SEED] เข็มขัดหนังคลาสสิก', 'เข็มขัดหนังแท้พร้อมหัวเข็มขัดที่อยู่เหนือกาลเวลา');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p6, @cat_acc, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p6, 'SEED-BELT-BRW-34', 'Brown', '34', 790.00, 60),
  (@p6, 'SEED-BELT-BLK-34', 'Black', '34', 790.00, 55);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p6, 'products', 'seed/belt-1.jpg', 'https://picsum.photos/seed/seed-p6-1/800/1000', 'Belt Hero', 1, 1, 1);

-- Product 7: Silk Scarf
INSERT INTO products (product_type, is_active) VALUES ('ACCESSORY', 1);
SET @p7 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p7, 'EN', '[SEED] Silk Scarf', 'Beautiful silk scarf with vibrant patterns.'),
  (@p7, 'TH', '[SEED] ผ้าพันคอผ้าไหม', 'ผ้าพันคอผ้าไหมที่สวยงามพร้อมลวดลายที่สดใส');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p7, @cat_acc, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p7, 'SEED-SCARF-MLT-ONE', 'Multicolor', 'ONE', 1250.00, 30);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p7, 'products', 'seed/scarf-1.jpg', 'https://picsum.photos/seed/seed-p7-1/800/1000', 'Scarf Hero', 1, 1, 1);

-- Product 8: Canvas Backpack
INSERT INTO products (product_type, is_active) VALUES ('ACCESSORY', 1);
SET @p8 = LAST_INSERT_ID();
INSERT INTO product_translation (product_id, language_code, name, description) VALUES 
  (@p8, 'EN', '[SEED] Canvas Backpack', 'Durable canvas backpack for your daily commute.'),
  (@p8, 'TH', '[SEED] กระเป๋าเป้ผ้าแคนวาส', 'กระเป๋าเป้ผ้าแคนวาสที่ทนทานสำหรับการเดินทางประจำวันของคุณ');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (@p8, @cat_acc, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES 
  (@p8, 'SEED-PACK-TAN-ONE', 'Tan', 'ONE', 2200.00, 20),
  (@p8, 'SEED-PACK-BLK-ONE', 'Black', 'ONE', 2200.00, 15);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES 
  (@p8, 'products', 'seed/pack-1.jpg', 'https://picsum.photos/seed/seed-p8-1/800/1000', 'Backpack Hero', 1, 1, 1);

COMMIT;
