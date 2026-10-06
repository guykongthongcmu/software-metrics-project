-- Seed Data for Core&Co Project
-- Based on Frontend Mock Data

USE core_co;

-- 1. Admin User
INSERT INTO admin (email, password_hash, display_name, is_active)
VALUES ('admin@example.com', '$2b$10$YourHashedPasswordHere', 'Admin User', 1);

-- 2. Categories
INSERT INTO category (category_id, category_name, slug) VALUES (1, 'Men', 'men');
INSERT INTO category (category_id, category_name, slug) VALUES (2, 'Women', 'women');
INSERT INTO category (category_id, category_name, slug) VALUES (3, 'Kids', 'kids');
INSERT INTO category (category_id, category_name, slug) VALUES (4, 'Baby', 'baby');
INSERT INTO category (category_id, category_name, slug) VALUES (5, 'Unisex', 'unisex');

INSERT INTO category_translation (category_id, language_code, name) VALUES (1, 'EN', 'Men');
INSERT INTO category_translation (category_id, language_code, name) VALUES (2, 'EN', 'Women');
INSERT INTO category_translation (category_id, language_code, name) VALUES (3, 'EN', 'Kids');
INSERT INTO category_translation (category_id, language_code, name) VALUES (4, 'EN', 'Baby');
INSERT INTO category_translation (category_id, language_code, name) VALUES (5, 'EN', 'Unisex');

-- 3. Products & Translations & Variants
-- Product 1: Premium Oxford Shirt
INSERT INTO products (product_id, product_type, is_active) VALUES (1, 'TOP', 1);
INSERT INTO product_translation (product_id, language_code, name, description) VALUES (1, 'EN', 'Premium Oxford Shirt', 'A high-quality oxford shirt for men.');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (1, 1, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES (1, 'PROD-MN-1', 'Blue', 'M', 39.9, 40);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES (1, 'PROD-MN-1-L', 'Blue', 'L', 39.9, 45);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, sort_order, is_thumbnail, is_hero) 
VALUES (1, 'product-images', 'mn-1.jpg', 'https://images.unsplash.com/photo-1598033129183-c4f50c717658?w=400', 1, 1, 1);

-- Product 2: Crew Neck T-Shirt
INSERT INTO products (product_id, product_type, is_active) VALUES (2, 'TOP', 1);
INSERT INTO product_translation (product_id, language_code, name, description) VALUES (2, 'EN', 'Crew Neck T-Shirt', 'Classic cotton crew neck t-shirt.');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (2, 1, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES (2, 'PROD-MN-2', 'White', 'M', 19.9, 60);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES (2, 'PROD-MN-2-L', 'White', 'L', 19.9, 60);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, sort_order, is_thumbnail, is_hero) 
VALUES (2, 'product-images', 'mn-2.jpg', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400', 1, 1, 1);

-- Product 13: Rayon Long Sleeve Blouse (Women)
INSERT INTO products (product_id, product_type, is_active) VALUES (13, 'TOP', 1);
INSERT INTO product_translation (product_id, language_code, name, description) VALUES (13, 'EN', 'Rayon Long Sleeve Blouse', 'Elegant rayon blouse for women.');
INSERT INTO product_category (product_id, category_id, is_primary) VALUES (13, 2, 1);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES (13, 'PROD-WM-13', 'Pink', 'S', 29.9, 50);
INSERT INTO product_variant (product_id, sku_code, colour, size, price, stock_qty) VALUES (13, 'PROD-WM-13-M', 'Pink', 'M', 29.9, 60);
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, sort_order, is_thumbnail, is_hero) 
VALUES (13, 'product-images', 'wm-13.jpg', 'https://images.unsplash.com/photo-1582533081064-0752f99f1fa0?w=400', 1, 1, 1);

-- 4. Users & Reviews
INSERT INTO users (user_id, email, password_hash, first_name, last_name, date_of_birth, phone_number)
VALUES (1, 'sarah@example.com', '$2b$10$HashedPassword', 'Sarah', 'Johnson', '1995-05-20', '0812345678');

INSERT INTO review (review_id, product_id, user_id, rating, comment, status)
VALUES (1, 2, 1, 5, 'Absolutely love this tee! The fabric is so soft and the fit is perfect.', 'VISIBLE');

INSERT INTO review_reply (review_id, admin_id, reply_text)
VALUES (1, 1, 'Thank you so much, Sarah! We are glad you love it. Enjoy your new tees!');

INSERT INTO review_like (review_id, admin_id)
VALUES (1, 1);

-- 5. Mock Orders for Dashboard (Total Revenue 284,750, Total Orders 2,543, Products Sold 4,280)
-- For demonstration, inserting a few orders
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (1, 1, 'PROCESSING', 12000.00, 0.00, 12000.00, '2026-03-17 10:00:00');
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (2, 1, 'PROCESSING', 19000.00, 0.00, 19000.00, '2026-03-18 11:00:00');
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (3, 1, 'PROCESSING', 15000.00, 0.00, 15000.00, '2026-03-19 12:00:00');
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (4, 1, 'PROCESSING', 22000.00, 0.00, 22000.00, '2026-03-20 13:00:00');
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (5, 1, 'PROCESSING', 18000.00, 0.00, 18000.00, '2026-03-21 14:00:00');
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (6, 1, 'PROCESSING', 25000.00, 0.00, 25000.00, '2026-03-22 15:00:00');
INSERT INTO orders (order_id, user_id, status, subtotal, shipping_fee, total, created_at)
VALUES (7, 1, 'PROCESSING', 21000.00, 0.00, 21000.00, '2026-03-23 16:00:00');

-- Order Items
INSERT INTO order_item (order_id, product_variant_id, snapshot_product_name, snapshot_unit_price, quantity, line_total)
VALUES (1, 1, 'Premium Oxford Shirt', 39.9, 300, 11970.00);
INSERT INTO order_item (order_id, product_variant_id, snapshot_product_name, snapshot_unit_price, quantity, line_total)
VALUES (2, 2, 'Crew Neck T-Shirt', 19.9, 950, 18905.00);
