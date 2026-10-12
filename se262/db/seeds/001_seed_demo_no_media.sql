USE core_co;
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE receipt_email_log;
TRUNCATE TABLE receipt;
TRUNCATE TABLE order_item;
TRUNCATE TABLE orders;
TRUNCATE TABLE cart_item;
TRUNCATE TABLE cart;
TRUNCATE TABLE wishlist;
TRUNCATE TABLE review_like;
TRUNCATE TABLE review_reply;
TRUNCATE TABLE review_media;
TRUNCATE TABLE review;
TRUNCATE TABLE message;
TRUNCATE TABLE conversation;
TRUNCATE TABLE sessions;
TRUNCATE TABLE email_verification_tokens;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE analytics_event;
TRUNCATE TABLE campaign_products;
TRUNCATE TABLE campaigns;
TRUNCATE TABLE product_variant_attribute;
TRUNCATE TABLE product_media;
TRUNCATE TABLE product_variant;
TRUNCATE TABLE product_category;
TRUNCATE TABLE product_translation;
TRUNCATE TABLE products;
TRUNCATE TABLE category_translation;
TRUNCATE TABLE category;
TRUNCATE TABLE address;
TRUNCATE TABLE users;
TRUNCATE TABLE admin;

SET FOREIGN_KEY_CHECKS = 1;

START TRANSACTION;

SET @seed_password_hash = '$2b$10$e/KTUWskf1ka.2CqP3viCezYIpTqvYy/US/bTbGWKd6qDaPvBwk4K';

INSERT INTO category (category_id, parent_category_id, category_name, slug, is_hidden) VALUES
  (1, NULL, 'Men', 'men', 0),
  (2, NULL, 'Women', 'women', 0),
  (3, NULL, 'Accessories', 'accessories', 0),
  (4, 1, 'Men Shirts', 'men-shirts', 0),
  (5, 1, 'Men Bottoms', 'men-bottoms', 0),
  (6, 2, 'Women Tops', 'women-tops', 0),
  (7, 2, 'Women Bottoms', 'women-bottoms', 0),
  (8, 3, 'Bags', 'bags', 0),
  (9, 3, 'Belts', 'belts', 0),
  (10, 3, 'Sport Utility Wear', 'sport-utility-wear', 0);

INSERT INTO category_translation (category_id, language_code, name) VALUES
  (1, 'EN', 'Men'),
  (1, 'TH', 'ผู้ชาย'),
  (2, 'EN', 'Women'),
  (2, 'TH', 'ผู้หญิง'),
  (3, 'EN', 'Accessories'),
  (3, 'TH', 'เครื่องประดับ'),
  (4, 'EN', 'Men Shirts'),
  (4, 'TH', 'เสื้อเชิ้ตผู้ชาย'),
  (5, 'EN', 'Men Bottoms'),
  (5, 'TH', 'กางเกงผู้ชาย'),
  (6, 'EN', 'Women Tops'),
  (6, 'TH', 'เสื้อผู้หญิง'),
  (7, 'EN', 'Women Bottoms'),
  (7, 'TH', 'กางเกงผู้หญิง'),
  (8, 'EN', 'Bags'),
  (8, 'TH', 'กระเป๋า'),
  (9, 'EN', 'Belts'),
  (9, 'TH', 'เข็มขัด'),
  (10, 'EN', 'Sport Utility Wear'),
  (10, 'TH', 'ชุดกีฬา');

INSERT INTO products (product_id, product_type, is_active, created_at, updated_at) VALUES
  (1001, 'TOP', 1, '2026-03-01 09:00:00', '2026-03-01 09:00:00'),
  (1002, 'TOP', 1, '2026-03-02 09:00:00', '2026-03-02 09:00:00'),
  (1003, 'TOP', 1, '2026-03-03 09:00:00', '2026-03-03 09:00:00'),
  (1004, 'BOTTOM', 1, '2026-03-04 09:00:00', '2026-03-04 09:00:00'),
  (1005, 'BOTTOM', 1, '2026-03-05 09:00:00', '2026-03-05 09:00:00'),
  (1006, 'TOP', 1, '2026-03-06 09:00:00', '2026-03-06 09:00:00'),
  (1007, 'TOP', 1, '2026-03-07 09:00:00', '2026-03-07 09:00:00'),
  (1008, 'BOTTOM', 1, '2026-03-08 09:00:00', '2026-03-08 09:00:00'),
  (1009, 'ACCESSORY', 1, '2026-03-09 09:00:00', '2026-03-09 09:00:00'),
  (1010, 'ACCESSORY', 1, '2026-03-10 09:00:00', '2026-03-10 09:00:00'),
  (1011, 'BOTTOM', 1, '2026-03-11 09:00:00', '2026-03-11 09:00:00'),
  (1012, 'TOP', 1, '2026-03-12 09:00:00', '2026-03-12 09:00:00');

INSERT INTO product_translation (product_id, language_code, name, description) VALUES
  (1001, 'EN', 'Premium Linen Shirt', 'Breathable linen shirt for warm weather and everyday wear.'),
  (1001, 'TH', 'เสื้อเชิ้ตลินินพรีเมียม', 'เสื้อเชิ้ตผ้าลินินระบายอากาศดี เหมาะกับใส่ทุกวัน'),
  (1002, 'EN', 'Oxford Button Shirt', 'Classic oxford shirt with a clean silhouette.'),
  (1002, 'TH', 'เสื้อเชิ้ตอ็อกซ์ฟอร์ด', 'เสื้อเชิ้ตอ็อกซ์ฟอร์ดทรงคลาสสิกดูเรียบหรู'),
  (1003, 'EN', 'Classic Cotton Tee', 'Soft cotton tee designed for daily comfort.'),
  (1003, 'TH', 'เสื้อยืดผ้าคอตตอนคลาสสิก', 'เสื้อยืดผ้าคอตตอนนุ่ม ใส่สบายทุกวัน'),
  (1004, 'EN', 'Cargo Trousers', 'Relaxed cargo trousers with utility pockets.'),
  (1004, 'TH', 'กางเกงคาร์โก้', 'กางเกงคาร์โก้ทรงสบายพร้อมกระเป๋าใช้งาน'),
  (1005, 'EN', 'Pleated Midi Skirt', 'Light pleated skirt with a flowy silhouette.'),
  (1005, 'TH', 'กระโปรงพลีทมิดิ', 'กระโปรงพลีททรงสวย ใส่สบาย'),
  (1006, 'EN', 'Silk Blend Blouse', 'Elegant silk blend blouse for office and evening.'),
  (1006, 'TH', 'เสื้อเบลาส์ผ้าไหมผสม', 'เสื้อเบลาส์ผ้าไหมผสม สำหรับลุคทำงานและออกงาน'),
  (1007, 'EN', 'Denim Work Jacket', 'Structured denim jacket with durable stitching.'),
  (1007, 'TH', 'แจ็กเก็ตยีนส์เวิร์ก', 'แจ็กเก็ตยีนส์ทรงเท่ ตัดเย็บแข็งแรง'),
  (1008, 'EN', 'Straight Fit Jeans', 'Classic straight jeans in versatile washes.'),
  (1008, 'TH', 'กางเกงยีนส์ทรงตรง', 'กางเกงยีนส์ทรงตรงคลาสสิก ใส่ง่าย'),
  (1009, 'EN', 'Classic Leather Belt', 'Genuine leather belt for formal and casual outfits.'),
  (1009, 'TH', 'เข็มขัดหนังคลาสสิก', 'เข็มขัดหนังแท้สำหรับลุคทางการและลำลอง'),
  (1010, 'EN', 'Canvas Tote Bag', 'Durable canvas tote for daily carry.'),
  (1010, 'TH', 'กระเป๋าโท้ทผ้าแคนวาส', 'กระเป๋าโท้ทผ้าแคนวาสทนทานสำหรับใช้ประจำวัน'),
  (1011, 'EN', 'Running Shorts', 'Lightweight quick-dry shorts for training days.'),
  (1011, 'TH', 'กางเกงวิ่งขาสั้น', 'กางเกงวิ่งผ้าเบา แห้งเร็ว'),
  (1012, 'EN', 'Knit Cardigan', 'Soft knit cardigan for layering in cool weather.'),
  (1012, 'TH', 'คาร์ดิแกนถักนุ่ม', 'คาร์ดิแกนผ้าถักนุ่มสำหรับใส่คลุม');

INSERT INTO product_category (product_id, category_id, is_primary) VALUES
  (1001, 4, 1),
  (1002, 4, 1),
  (1003, 4, 1),
  (1004, 5, 1),
  (1005, 7, 1),
  (1006, 6, 1),
  (1007, 4, 1),
  (1008, 7, 1),
  (1009, 9, 1),
  (1010, 8, 1),
  (1011, 10, 1),
  (1012, 6, 1);

INSERT INTO product_variant (
  product_variant_id,
  product_id,
  sku_code,
  colour,
  size,
  price,
  compare_at_price,
  stock_qty,
  is_active,
  created_at,
  updated_at
) VALUES
  (4001, 1001, 'LINEN-BEIGE-M', 'Beige', 'M', 990.00, 1290.00, 25, 1, '2026-03-01 09:10:00', '2026-03-01 09:10:00'),
  (4002, 1001, 'LINEN-BEIGE-L', 'Beige', 'L', 990.00, 1290.00, 18, 1, '2026-03-01 09:10:00', '2026-03-01 09:10:00'),
  (4003, 1002, 'OXFORD-WHITE-M', 'White', 'M', 1090.00, NULL, 20, 1, '2026-03-02 09:10:00', '2026-03-02 09:10:00'),
  (4004, 1002, 'OXFORD-BLUE-L', 'Blue', 'L', 1090.00, NULL, 16, 1, '2026-03-02 09:10:00', '2026-03-02 09:10:00'),
  (4005, 1003, 'TEE-BLACK-M', 'Black', 'M', 490.00, 590.00, 50, 1, '2026-03-03 09:10:00', '2026-03-03 09:10:00'),
  (4006, 1003, 'TEE-WHITE-L', 'White', 'L', 490.00, 590.00, 45, 1, '2026-03-03 09:10:00', '2026-03-03 09:10:00'),
  (4007, 1004, 'CARGO-OLIVE-32', 'Olive', '32', 1290.00, 1590.00, 15, 1, '2026-03-04 09:10:00', '2026-03-04 09:10:00'),
  (4008, 1004, 'CARGO-BLACK-34', 'Black', '34', 1290.00, 1590.00, 12, 1, '2026-03-04 09:10:00', '2026-03-04 09:10:00'),
  (4009, 1005, 'SKIRT-NAVY-S', 'Navy', 'S', 890.00, NULL, 22, 1, '2026-03-05 09:10:00', '2026-03-05 09:10:00'),
  (4010, 1005, 'SKIRT-BEIGE-M', 'Beige', 'M', 890.00, NULL, 19, 1, '2026-03-05 09:10:00', '2026-03-05 09:10:00'),
  (4011, 1006, 'BLOUSE-IVORY-S', 'Ivory', 'S', 1490.00, 1790.00, 14, 1, '2026-03-06 09:10:00', '2026-03-06 09:10:00'),
  (4012, 1006, 'BLOUSE-ROSE-M', 'Rose', 'M', 1490.00, 1790.00, 11, 1, '2026-03-06 09:10:00', '2026-03-06 09:10:00'),
  (4013, 1007, 'DENIM-INDIGO-M', 'Indigo', 'M', 1890.00, NULL, 10, 1, '2026-03-07 09:10:00', '2026-03-07 09:10:00'),
  (4014, 1007, 'DENIM-INDIGO-L', 'Indigo', 'L', 1890.00, NULL, 8, 1, '2026-03-07 09:10:00', '2026-03-07 09:10:00'),
  (4015, 1008, 'JEANS-BLUE-30', 'Blue', '30', 1690.00, 1990.00, 17, 1, '2026-03-08 09:10:00', '2026-03-08 09:10:00'),
  (4016, 1008, 'JEANS-BLACK-32', 'Black', '32', 1690.00, 1990.00, 13, 1, '2026-03-08 09:10:00', '2026-03-08 09:10:00'),
  (4017, 1009, 'BELT-BROWN-34', 'Brown', '34', 690.00, NULL, 30, 1, '2026-03-09 09:10:00', '2026-03-09 09:10:00'),
  (4018, 1009, 'BELT-BLACK-36', 'Black', '36', 690.00, NULL, 28, 1, '2026-03-09 09:10:00', '2026-03-09 09:10:00'),
  (4019, 1010, 'TOTE-NATURAL-ONE', 'Natural', 'ONE', 790.00, 990.00, 26, 1, '2026-03-10 09:10:00', '2026-03-10 09:10:00'),
  (4020, 1010, 'TOTE-BLACK-ONE', 'Black', 'ONE', 790.00, 990.00, 21, 1, '2026-03-10 09:10:00', '2026-03-10 09:10:00'),
  (4021, 1011, 'SHORTS-CHARCOAL-M', 'Charcoal', 'M', 650.00, NULL, 34, 1, '2026-03-11 09:10:00', '2026-03-11 09:10:00'),
  (4022, 1011, 'SHORTS-NAVY-L', 'Navy', 'L', 650.00, NULL, 29, 1, '2026-03-11 09:10:00', '2026-03-11 09:10:00'),
  (4023, 1012, 'CARDIGAN-CREAM-S', 'Cream', 'S', 1390.00, 1690.00, 16, 1, '2026-03-12 09:10:00', '2026-03-12 09:10:00'),
  (4024, 1012, 'CARDIGAN-CAMEL-M', 'Camel', 'M', 1390.00, 1690.00, 14, 1, '2026-03-12 09:10:00', '2026-03-12 09:10:00');

INSERT INTO users (
  user_id,
  email,
  password_hash,
  first_name,
  last_name,
  date_of_birth,
  phone_number,
  preferred_language,
  email_verified_at,
  created_at,
  updated_at
) VALUES
  (2001, 'alice.chan@example.com', @seed_password_hash, 'Alice', 'Chan', '1998-05-12', '0811111111', 'EN', '2026-03-01 08:00:00', '2026-03-01 08:00:00', '2026-03-01 08:00:00'),
  (2002, 'ben.krit@example.com', @seed_password_hash, 'Ben', 'Krit', '1997-11-03', '0822222222', 'TH', '2026-03-01 08:05:00', '2026-03-01 08:05:00', '2026-03-01 08:05:00'),
  (2003, 'cara.pim@example.com', @seed_password_hash, 'Cara', 'Pim', '2000-02-18', '0833333333', 'EN', '2026-03-01 08:10:00', '2026-03-01 08:10:00', '2026-03-01 08:10:00'),
  (2004, 'dome.rin@example.com', @seed_password_hash, 'Dome', 'Rin', '1999-07-22', '0844444444', 'TH', '2026-03-01 08:15:00', '2026-03-01 08:15:00', '2026-03-01 08:15:00'),
  (2005, 'eve.saran@example.com', @seed_password_hash, 'Eve', 'Saran', '1996-09-14', '0855555555', 'EN', '2026-03-01 08:20:00', '2026-03-01 08:20:00', '2026-03-01 08:20:00'),
  (2006, 'finn.mek@example.com', @seed_password_hash, 'Finn', 'Mek', '1995-12-01', '0866666666', 'TH', '2026-03-01 08:25:00', '2026-03-01 08:25:00', '2026-03-01 08:25:00'),
  (2007, 'gina.nam@example.com', @seed_password_hash, 'Gina', 'Nam', '2001-04-09', '0877777777', 'EN', '2026-03-01 08:30:00', '2026-03-01 08:30:00', '2026-03-01 08:30:00'),
  (2008, 'harry.tan@example.com', @seed_password_hash, 'Harry', 'Tan', '1998-10-30', '0888888888', 'TH', '2026-03-01 08:35:00', '2026-03-01 08:35:00', '2026-03-01 08:35:00');

INSERT INTO address (
  address_id,
  user_id,
  full_name,
  phone,
  line1,
  line2,
  district,
  province,
  postcode,
  country,
  is_default_shipping,
  is_default_billing,
  created_at,
  updated_at
) VALUES
  (3001, 2001, 'Alice Chan', '0811111111', '11 Nimman Rd', 'Unit 1A', 'Mueang', 'Chiang Mai', '50000', 'Thailand', 1, 1, '2026-03-01 08:40:00', '2026-03-01 08:40:00'),
  (3002, 2002, 'Ben Krit', '0822222222', '22 Suthep Rd', NULL, 'Mueang', 'Chiang Mai', '50200', 'Thailand', 1, 1, '2026-03-01 08:41:00', '2026-03-01 08:41:00'),
  (3003, 2003, 'Cara Pim', '0833333333', '33 Huay Kaew Rd', 'Floor 2', 'Mueang', 'Chiang Mai', '50300', 'Thailand', 1, 1, '2026-03-01 08:42:00', '2026-03-01 08:42:00'),
  (3004, 2004, 'Dome Rin', '0844444444', '44 Chang Klan Rd', NULL, 'Mueang', 'Chiang Mai', '50100', 'Thailand', 1, 1, '2026-03-01 08:43:00', '2026-03-01 08:43:00'),
  (3005, 2005, 'Eve Saran', '0855555555', '55 Ratchaphruek Rd', NULL, 'Mueang', 'Chiang Mai', '50400', 'Thailand', 1, 1, '2026-03-01 08:44:00', '2026-03-01 08:44:00'),
  (3006, 2006, 'Finn Mek', '0866666666', '66 Canal Rd', 'Building B', 'Mueang', 'Chiang Mai', '50500', 'Thailand', 1, 1, '2026-03-01 08:45:00', '2026-03-01 08:45:00'),
  (3007, 2007, 'Gina Nam', '0877777777', '77 Chiang Mai-Lamphun Rd', NULL, 'Saraphi', 'Chiang Mai', '50140', 'Thailand', 1, 1, '2026-03-01 08:46:00', '2026-03-01 08:46:00'),
  (3008, 2008, 'Harry Tan', '0888888888', '88 Superhighway Rd', 'Room 804', 'Mueang', 'Chiang Mai', '50000', 'Thailand', 1, 1, '2026-03-01 08:47:00', '2026-03-01 08:47:00');

INSERT INTO admin (
  admin_id,
  email,
  password_hash,
  display_name,
  is_active,
  created_at,
  updated_at
) VALUES
  (1, 'admin@coreco.local', @seed_password_hash, 'CoreCo Admin', 1, '2026-03-01 09:00:00', '2026-03-01 09:00:00');

INSERT INTO orders (
  order_id,
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
) VALUES
  (5001, 2001, 3001, 3001, 'PURCHASED', 990.00, 0.00, 0.00, 990.00, NULL, NULL, '2026-03-01 12:00:00', '2026-03-01 12:00:00'),
  (5002, 2002, 3002, 3002, 'PURCHASED', 1090.00, 0.00, 0.00, 1090.00, NULL, NULL, '2026-03-02 12:00:00', '2026-03-02 12:00:00'),
  (5003, 2003, 3003, 3003, 'PURCHASED', 980.00, 0.00, 0.00, 980.00, NULL, NULL, '2026-03-03 12:00:00', '2026-03-03 12:00:00'),
  (5004, 2004, 3004, 3004, 'PURCHASED', 1290.00, 0.00, 0.00, 1290.00, NULL, NULL, '2026-03-04 12:00:00', '2026-03-04 12:00:00'),
  (5005, 2005, 3005, 3005, 'PURCHASED', 1490.00, 0.00, 0.00, 1490.00, NULL, NULL, '2026-03-05 12:00:00', '2026-03-05 12:00:00'),
  (5006, 2006, 3006, 3006, 'PURCHASED', 1690.00, 0.00, 0.00, 1690.00, NULL, NULL, '2026-03-06 12:00:00', '2026-03-06 12:00:00'),
  (5007, 2007, 3007, 3007, 'PURCHASED', 790.00, 0.00, 0.00, 790.00, NULL, NULL, '2026-03-07 12:00:00', '2026-03-07 12:00:00'),
  (5008, 2008, 3008, 3008, 'PURCHASED', 1380.00, 0.00, 0.00, 1380.00, NULL, NULL, '2026-03-08 12:00:00', '2026-03-08 12:00:00'),
  (5009, 2001, 3001, 3001, 'PURCHASED', 650.00, 0.00, 0.00, 650.00, NULL, NULL, '2026-03-09 12:00:00', '2026-03-09 12:00:00'),
  (5010, 2002, 3002, 3002, 'PURCHASED', 1390.00, 0.00, 0.00, 1390.00, NULL, NULL, '2026-03-10 12:00:00', '2026-03-10 12:00:00'),
  (5011, 2003, 3003, 3003, 'PURCHASED', 990.00, 0.00, 0.00, 990.00, NULL, NULL, '2026-03-11 12:00:00', '2026-03-11 12:00:00'),
  (5012, 2004, 3004, 3004, 'PURCHASED', 2180.00, 0.00, 0.00, 2180.00, NULL, NULL, '2026-03-12 12:00:00', '2026-03-12 12:00:00'),
  (5013, 2005, 3005, 3005, 'PURCHASED', 1290.00, 0.00, 0.00, 1290.00, NULL, NULL, '2026-03-13 12:00:00', '2026-03-13 12:00:00'),
  (5014, 2006, 3006, 3006, 'PURCHASED', 890.00, 0.00, 0.00, 890.00, NULL, NULL, '2026-03-14 12:00:00', '2026-03-14 12:00:00'),
  (5015, 2007, 3007, 3007, 'PURCHASED', 1490.00, 0.00, 0.00, 1490.00, NULL, NULL, '2026-03-15 12:00:00', '2026-03-15 12:00:00'),
  (5016, 2008, 3008, 3008, 'PURCHASED', 1890.00, 0.00, 0.00, 1890.00, NULL, NULL, '2026-03-16 12:00:00', '2026-03-16 12:00:00'),
  (5017, 2001, 3001, 3001, 'PURCHASED', 1690.00, 0.00, 0.00, 1690.00, NULL, NULL, '2026-03-17 12:00:00', '2026-03-17 12:00:00'),
  (5018, 2002, 3002, 3002, 'PURCHASED', 690.00, 0.00, 0.00, 690.00, NULL, NULL, '2026-03-18 12:00:00', '2026-03-18 12:00:00'),
  (5019, 2003, 3003, 3003, 'PURCHASED', 1580.00, 0.00, 0.00, 1580.00, NULL, NULL, '2026-03-19 12:00:00', '2026-03-19 12:00:00'),
  (5020, 2004, 3004, 3004, 'PURCHASED', 1390.00, 0.00, 0.00, 1390.00, NULL, NULL, '2026-03-20 12:00:00', '2026-03-20 12:00:00');

INSERT INTO order_item (
  order_item_id,
  order_id,
  product_variant_id,
  snapshot_product_name,
  snapshot_color,
  snapshot_size,
  snapshot_unit_price,
  snapshot_compare_at_price,
  quantity,
  line_total
) VALUES
  (6001, 5001, 4001, 'Premium Linen Shirt', 'Beige', 'M', 990.00, 1290.00, 1, 990.00),
  (6002, 5002, 4003, 'Oxford Button Shirt', 'White', 'M', 1090.00, NULL, 1, 1090.00),
  (6003, 5003, 4005, 'Classic Cotton Tee', 'Black', 'M', 490.00, 590.00, 2, 980.00),
  (6004, 5004, 4007, 'Cargo Trousers', 'Olive', '32', 1290.00, 1590.00, 1, 1290.00),
  (6005, 5005, 4011, 'Silk Blend Blouse', 'Ivory', 'S', 1490.00, 1790.00, 1, 1490.00),
  (6006, 5006, 4015, 'Straight Fit Jeans', 'Blue', '30', 1690.00, 1990.00, 1, 1690.00),
  (6007, 5007, 4019, 'Canvas Tote Bag', 'Natural', 'ONE', 790.00, 990.00, 1, 790.00),
  (6008, 5008, 4017, 'Classic Leather Belt', 'Brown', '34', 690.00, NULL, 2, 1380.00),
  (6009, 5009, 4021, 'Running Shorts', 'Charcoal', 'M', 650.00, NULL, 1, 650.00),
  (6010, 5010, 4023, 'Knit Cardigan', 'Cream', 'S', 1390.00, 1690.00, 1, 1390.00),
  (6011, 5011, 4002, 'Premium Linen Shirt', 'Beige', 'L', 990.00, 1290.00, 1, 990.00),
  (6012, 5012, 4004, 'Oxford Button Shirt', 'Blue', 'L', 1090.00, NULL, 2, 2180.00),
  (6013, 5013, 4008, 'Cargo Trousers', 'Black', '34', 1290.00, 1590.00, 1, 1290.00),
  (6014, 5014, 4010, 'Pleated Midi Skirt', 'Beige', 'M', 890.00, NULL, 1, 890.00),
  (6015, 5015, 4012, 'Silk Blend Blouse', 'Rose', 'M', 1490.00, 1790.00, 1, 1490.00),
  (6016, 5016, 4014, 'Denim Work Jacket', 'Indigo', 'L', 1890.00, NULL, 1, 1890.00),
  (6017, 5017, 4016, 'Straight Fit Jeans', 'Black', '32', 1690.00, 1990.00, 1, 1690.00),
  (6018, 5018, 4018, 'Classic Leather Belt', 'Black', '36', 690.00, NULL, 1, 690.00),
  (6019, 5019, 4020, 'Canvas Tote Bag', 'Black', 'ONE', 790.00, 990.00, 2, 1580.00),
  (6020, 5020, 4024, 'Knit Cardigan', 'Camel', 'M', 1390.00, 1690.00, 1, 1390.00);

COMMIT;
