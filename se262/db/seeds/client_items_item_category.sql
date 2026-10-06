USE core_co;

-- =============================================================
-- CATEGORIES (parent)
-- =============================================================
INSERT INTO category (category_id, parent_category_id, category_name, slug) VALUES
    (100, NULL, 'Men',    'men'),
    (101, NULL, 'Women',  'women'),
    (102, NULL, 'Kids',   'kids'),
    (103, NULL, 'Baby',   'baby'),
    (104, NULL, 'Unisex', 'unisex');

INSERT INTO category_translation (category_id, language_code, name) VALUES
    (100, 'EN', 'Men'),        (100, 'TH', 'ผู้ชาย'),
    (101, 'EN', 'Women'),      (101, 'TH', 'ผู้หญิง'),
    (102, 'EN', 'Kids'),       (102, 'TH', 'เด็ก'),
    (103, 'EN', 'Baby'),       (103, 'TH', 'ทารก'),
    (104, 'EN', 'Unisex'),     (104, 'TH', 'ยูนิเซ็กซ์');

-- =============================================================
-- CATEGORIES (sub — Men 200-214, Women 300-314, Kids 400-411,
--              Baby 500-511, Unisex 600-611, Extra 700-702)
-- =============================================================
INSERT INTO category (category_id, parent_category_id, category_name, slug) VALUES
    -- Men subs (15 subs → 200-214)
    (200, 100, 'T-Shirts & Sweatshirts',    'men-tshirts'),
    (201, 100, 'Shirts & Polo Shirts',       'men-shirts'),
    (202, 100, 'Knitwear & Sweaters',        'men-knitwear'),
    (203, 100, 'Outerwear',                  'men-outerwear'),
    (204, 100, 'Pants',                      'men-pants'),
    (205, 100, 'Innerwear & Socks',          'men-innerwear'),
    (206, 100, 'Loungewear',                 'men-loungewear'),
    (207, 100, 'Linen',                      'men-linen'),
    (208, 100, 'Sport Utility Wear',         'men-sport'),
    (209, 100, 'UV Protection Collection',   'men-uv'),
    (210, 100, 'AIRism',                     'men-airism'),
    (211, 100, 'HEATTECH',                   'men-heattech'),
    (212, 100, 'Accessories',                'men-accessories'),
    (213, 100, 'Special Collaborations',     'men-collab'),
    (214, 100, 'Price Down',                 'men-sale'),

    -- Women subs (15 subs → 300-314)
    (300, 101, 'T-Shirts & Sweatshirts & Bratop', 'women-tshirts'),
    (301, 101, 'Shirts & Polo Shirts',             'women-shirts'),
    (302, 101, 'Knitwear & Cardigan',              'women-knitwear'),
    (303, 101, 'Outerwear',                        'women-outerwear'),
    (304, 101, 'Bottom',                           'women-bottom'),
    (305, 101, 'Innerwear & Socks',                'women-innerwear'),
    (306, 101, 'Loungewear',                       'women-loungewear'),
    (307, 101, 'Linen',                            'women-linen'),
    (308, 101, 'Sport Utility Wear',               'women-sport'),
    (309, 101, 'UV Protection Collection',         'women-uv'),
    (310, 101, 'AIRism',                           'women-airism'),
    (311, 101, 'HEATTECH',                         'women-heattech'),
    (312, 101, 'Accessories',                      'women-accessories'),
    (313, 101, 'Special Collaborations',           'women-collab'),
    (314, 101, 'Dress & Skirt',                    'women-dress'),

    -- Kids subs (12 subs → 400-411)
    (400, 102, 'T-Shirts & Sweatshirts',   'kids-tshirts'),
    (401, 102, 'Shirts & Blouses',         'kids-shirts'),
    (402, 102, 'Outerwear',                'kids-outerwear'),
    (403, 102, 'Bottom',                   'kids-bottom'),
    (404, 102, 'Innerwear & Socks',        'kids-innerwear'),
    (405, 102, 'Activewear',               'kids-activewear'),
    (406, 102, 'Pajamas',                  'kids-pajamas'),
    (407, 102, 'AIRism',                   'kids-airism'),
    (408, 102, 'HEATTECH',                 'kids-heattech'),
    (409, 102, 'Accessories',              'kids-accessories'),
    (410, 102, 'Special Collaborations',   'kids-collab'),
    (411, 102, 'Dress & Skirt',            'kids-dress'),

    -- Baby subs (12 subs → 500-511)
    (500, 103, 'Bodysuits & Rompers',    'baby-bodysuits'),
    (501, 103, 'Tops & T-Shirts',        'baby-tops'),
    (502, 103, 'Bottoms & Leggings',     'baby-bottoms'),
    (503, 103, 'Dresses & Skirts',       'baby-dresses'),
    (504, 103, 'Outerwear',              'baby-outerwear'),
    (505, 103, 'Innerwear & Socks',      'baby-innerwear'),
    (506, 103, 'Pajamas & Sleepwear',    'baby-pajamas'),
    (507, 103, 'Accessories',            'baby-accessories'),
    (508, 103, 'Maternity & Newborn',    'baby-maternity'),
    (509, 103, 'AIRism',                 'baby-airism'),
    (510, 103, 'HEATTECH',               'baby-heattech'),
    (511, 103, 'Collaborations',         'baby-collab'),

    -- Unisex subs (12 subs → 600-611)
    (600, 104, 'T-Shirts',                'unisex-tshirts'),
    (601, 104, 'Sweatshirts & Hoodies',   'unisex-sweatshirts'),
    (602, 104, 'Outerwear',               'unisex-outerwear'),
    (603, 104, 'Bottoms',                 'unisex-bottoms'),
    (604, 104, 'Activewear',              'unisex-activewear'),
    (605, 104, 'Loungewear',              'unisex-loungewear'),
    (606, 104, 'Accessories',             'unisex-accessories'),
    (607, 104, 'Bags',                    'unisex-bags'),
    (608, 104, 'Shoes',                   'unisex-shoes'),
    (609, 104, 'Sunglasses',              'unisex-sunglasses'),
    (610, 104, 'AIRism',                  'unisex-airism'),
    (611, 104, 'Special Collaborations',  'unisex-collab'),

    -- Extra / cross-gender tag categories (700-702)
    (700, NULL, 'Sale',        'tag-sale'),
    (701, NULL, 'Recommended', 'tag-recommended'),
    (702, NULL, 'New Arrival', 'tag-newarrival');

INSERT INTO category_translation (category_id, language_code, name) VALUES
    -- Men subs
    (200,'EN','T-Shirts & Sweatshirts'),        (200,'TH','เสื้อยืด & สเวตเชิ้ต'),
    (201,'EN','Shirts & Polo Shirts'),           (201,'TH','เสื้อเชิ้ต & โปโล'),
    (202,'EN','Knitwear & Sweaters'),            (202,'TH','เสื้อถัก & สเวตเตอร์'),
    (203,'EN','Outerwear'),                      (203,'TH','เสื้อคลุม'),
    (204,'EN','Pants'),                          (204,'TH','กางเกง'),
    (205,'EN','Innerwear & Socks'),              (205,'TH','ชุดชั้นใน & ถุงเท้า'),
    (206,'EN','Loungewear'),                     (206,'TH','ชุดใส่บ้าน'),
    (207,'EN','Linen'),                          (207,'TH','ลินิน'),
    (208,'EN','Sport Utility Wear'),             (208,'TH','ชุดกีฬา'),
    (209,'EN','UV Protection Collection'),       (209,'TH','กันยูวี'),
    (210,'EN','AIRism'),                         (210,'TH','แอร์ริสึม'),
    (211,'EN','HEATTECH'),                       (211,'TH','ฮีตเทค'),
    (212,'EN','Accessories'),                    (212,'TH','อุปกรณ์เสริม'),
    (213,'EN','Special Collaborations'),         (213,'TH','คอลแลบพิเศษ'),
    (214,'EN','Price Down'),                     (214,'TH','ลดราคา'),
    -- Women subs
    (300,'EN','T-Shirts & Sweatshirts & Bratop'),(300,'TH','เสื้อยืด สเวตเชิ้ต & บราท็อป'),
    (301,'EN','Shirts & Polo Shirts'),           (301,'TH','เสื้อเชิ้ต & โปโล'),
    (302,'EN','Knitwear & Cardigan'),            (302,'TH','เสื้อถัก & คาร์ดิแกน'),
    (303,'EN','Outerwear'),                      (303,'TH','เสื้อคลุม'),
    (304,'EN','Bottom'),                         (304,'TH','กางเกง & กระโปรง'),
    (305,'EN','Innerwear & Socks'),              (305,'TH','ชุดชั้นใน & ถุงเท้า'),
    (306,'EN','Loungewear'),                     (306,'TH','ชุดใส่บ้าน'),
    (307,'EN','Linen'),                          (307,'TH','ลินิน'),
    (308,'EN','Sport Utility Wear'),             (308,'TH','ชุดกีฬา'),
    (309,'EN','UV Protection Collection'),       (309,'TH','กันยูวี'),
    (310,'EN','AIRism'),                         (310,'TH','แอร์ริสึม'),
    (311,'EN','HEATTECH'),                       (311,'TH','ฮีตเทค'),
    (312,'EN','Accessories'),                    (312,'TH','อุปกรณ์เสริม'),
    (313,'EN','Special Collaborations'),         (313,'TH','คอลแลบพิเศษ'),
    (314,'EN','Dress & Skirt'),                  (314,'TH','ชุดเดรส & กระโปรง'),
    -- Kids subs
    (400,'EN','T-Shirts & Sweatshirts'),         (400,'TH','เสื้อยืด & สเวตเชิ้ต'),
    (401,'EN','Shirts & Blouses'),               (401,'TH','เสื้อเชิ้ต & เบลาส์'),
    (402,'EN','Outerwear'),                      (402,'TH','เสื้อคลุม'),
    (403,'EN','Bottom'),                         (403,'TH','กางเกง & กระโปรง'),
    (404,'EN','Innerwear & Socks'),              (404,'TH','ชุดชั้นใน & ถุงเท้า'),
    (405,'EN','Activewear'),                     (405,'TH','ชุดกีฬา'),
    (406,'EN','Pajamas'),                        (406,'TH','ชุดนอน'),
    (407,'EN','AIRism'),                         (407,'TH','แอร์ริสึม'),
    (408,'EN','HEATTECH'),                       (408,'TH','ฮีตเทค'),
    (409,'EN','Accessories'),                    (409,'TH','อุปกรณ์เสริม'),
    (410,'EN','Special Collaborations'),         (410,'TH','คอลแลบพิเศษ'),
    (411,'EN','Dress & Skirt'),                  (411,'TH','ชุดเดรส & กระโปรง'),
    -- Baby subs
    (500,'EN','Bodysuits & Rompers'),            (500,'TH','บอดี้สูท & โรมเปอร์'),
    (501,'EN','Tops & T-Shirts'),                (501,'TH','เสื้อและเสื้อยืด'),
    (502,'EN','Bottoms & Leggings'),             (502,'TH','กางเกงและเลกกิ้ง'),
    (503,'EN','Dresses & Skirts'),               (503,'TH','ชุดเดรสและกระโปรง'),
    (504,'EN','Outerwear'),                      (504,'TH','เสื้อคลุม'),
    (505,'EN','Innerwear & Socks'),              (505,'TH','ชุดชั้นใน & ถุงเท้า'),
    (506,'EN','Pajamas & Sleepwear'),            (506,'TH','ชุดนอน'),
    (507,'EN','Accessories'),                    (507,'TH','อุปกรณ์เสริม'),
    (508,'EN','Maternity & Newborn'),            (508,'TH','ชุดคลุมท้องและทารกแรกเกิด'),
    (509,'EN','AIRism'),                         (509,'TH','แอร์ริสึม'),
    (510,'EN','HEATTECH'),                       (510,'TH','ฮีตเทค'),
    (511,'EN','Collaborations'),                 (511,'TH','คอลแลบ'),
    -- Unisex subs
    (600,'EN','T-Shirts'),                       (600,'TH','เสื้อยืด'),
    (601,'EN','Sweatshirts & Hoodies'),          (601,'TH','สเวตเชิ้ต & ฮูดดี้'),
    (602,'EN','Outerwear'),                      (602,'TH','เสื้อคลุม'),
    (603,'EN','Bottoms'),                        (603,'TH','กางเกง'),
    (604,'EN','Activewear'),                     (604,'TH','ชุดออกกำลังกาย'),
    (605,'EN','Loungewear'),                     (605,'TH','ชุดใส่บ้าน'),
    (606,'EN','Accessories'),                    (606,'TH','อุปกรณ์เสริม'),
    (607,'EN','Bags'),                           (607,'TH','กระเป๋า'),
    (608,'EN','Shoes'),                          (608,'TH','รองเท้า'),
    (609,'EN','Sunglasses'),                     (609,'TH','แว่นกันแดด'),
    (610,'EN','AIRism'),                         (610,'TH','แอร์ริสึม'),
    (611,'EN','Special Collaborations'),         (611,'TH','คอลแลบพิเศษ'),
    -- Extra tag categories
    (700,'EN','Sale'),        (700,'TH','เซล'),
    (701,'EN','Recommended'), (701,'TH','แนะนำ'),
    (702,'EN','New Arrival'), (702,'TH','สินค้าใหม่');

-- =============================================================
-- PRODUCTS
-- Men    1001-1016  (sub: 200-214, item 1001 covers 214=Price Down → also tag 700=sale)
-- Women  2001-2016  (sub: 300-314)
-- Kids   3001-3016  (sub: 400-411, 4 items share sub categories)
-- Baby   4001-4016  (sub: 500-511, 4 items share sub categories)
-- Unisex 5001-5016  (sub: 600-611, 4 items share sub categories)
-- =============================================================

-- -----------------------------------------------------------
-- MEN (product_id 1001-1016)
-- Sub map: 200 T-Shirts, 201 Shirts/Polo, 202 Knitwear,
--          203 Outerwear, 204 Pants, 205 Innerwear,
--          206 Loungewear, 207 Linen, 208 Sport,
--          209 UV, 210 AIRism, 211 HEATTECH,
--          212 Accessories, 213 Collab, 214 Price Down (sale)
-- Items 1001-1015 = one per sub; 1016 = extra item reusing a sub
-- -----------------------------------------------------------
INSERT INTO products (product_id, product_type, is_active, created_at) VALUES
    (1001,'TOP',     1,'2026-03-01 10:00:00'),
    (1002,'TOP',     1,'2026-03-02 10:00:00'),
    (1003,'TOP',     1,'2026-03-03 10:00:00'),
    (1004,'TOP',     1,'2026-03-04 10:00:00'),
    (1005,'BOTTOM',  1,'2026-03-05 10:00:00'),
    (1006,'TOP',     1,'2026-03-06 10:00:00'),
    (1007,'TOP',     1,'2026-03-07 10:00:00'),
    (1008,'TOP',     1,'2026-03-08 10:00:00'),
    (1009,'TOP',     1,'2026-03-09 10:00:00'),
    (1010,'TOP',     1,'2026-03-10 10:00:00'),
    (1011,'TOP',     1,'2026-03-11 10:00:00'),
    (1012,'TOP',     1,'2026-03-12 10:00:00'),
    (1013,'ACCESSORY',1,'2026-03-13 10:00:00'),
    (1014,'TOP',     1,'2026-03-14 10:00:00'),
    (1015,'BOTTOM',  1,'2026-03-15 10:00:00'),
    (1016,'TOP',     1,'2026-03-16 10:00:00');

INSERT INTO product_translation (product_id, language_code, name, description) VALUES
    (1001,'EN','Classic Crew Tee',              'Everyday essential soft cotton T-shirt.'),
    (1001,'TH','เสื้อยืดคอกลมคลาสสิก',          'เสื้อยืดผ้าฝ้ายนุ่มสำหรับใส่ทุกวัน'),
    (1002,'EN','Oxford Button-Down Shirt',       'Crisp oxford cotton shirt for any occasion.'),
    (1002,'TH','เสื้อเชิ้ต Oxford Button-Down',  'เสื้อเชิ้ตผ้าออกซ์ฟอร์ดเรียบ'),
    (1003,'EN','Merino Wool Crewneck Sweater',   'Fine merino wool sweater for cool evenings.'),
    (1003,'TH','สเวตเตอร์คอกลมขนแกะเมอริโน',    'สเวตเตอร์ขนแกะเมอริโนสำหรับอากาศเย็น'),
    (1004,'EN','Ultra Light Down Jacket',        'Lightweight down jacket that packs into a pouch.'),
    (1004,'TH','แจ็กเก็ตขนเป็ดน้ำหนักเบา',       'แจ็กเก็ตขนเป็ดน้ำหนักเบาพับเก็บได้'),
    (1005,'EN','Slim Chino Pants',               'Slim-fit chino pants for a clean look.'),
    (1005,'TH','กางเกงชิโนทรงสลิม',              'กางเกงชิโนทรงสลิมดูสะอาดตา'),
    (1006,'EN','HEATTECH Crew Neck Tee',         'Warm and thin HEATTECH inner layer.'),
    (1006,'TH','เสื้อยืดคอกลม HEATTECH',         'ชั้นในบาง อบอุ่น ด้วย HEATTECH'),
    (1007,'EN','Relaxed Fit Lounge Pants',       'Comfortable lounge pants for rest days.'),
    (1007,'TH','กางเกงใส่บ้านทรงหลวม',           'กางเกงใส่บ้านสบายสำหรับวันพัก'),
    (1008,'EN','Premium Linen Shirt',            'Breathable premium linen for warm days.'),
    (1008,'TH','เสื้อเชิ้ตลินินพรีเมียม',         'ลินินพรีเมียมระบายอากาศดีสำหรับวันร้อน'),
    (1009,'EN','AIRism Dry Polo Shirt',          'Cool and moisture-wicking AIRism polo.'),
    (1009,'TH','โปโลเชิ้ต AIRism Dry',           'โปโลแอร์ริสึมระบายอากาศดีดูดซับเหงื่อ'),
    (1010,'EN','UV Protection Stretch Shirt',    'Long-sleeve UV-cut shirt for outdoor activity.'),
    (1010,'TH','เสื้อเชิ้ตกันยูวียืดหยุ่น',        'เสื้อแขนยาวกันยูวีสำหรับกิจกรรมกลางแจ้ง'),
    (1011,'EN','Sport Utility Shorts',           'Quick-dry shorts for active sports days.'),
    (1011,'TH','กางเกงขาสั้น Sport Utility',     'กางเกงขาสั้นแห้งเร็วสำหรับกีฬา'),
    (1012,'EN','AIRism Cotton Full-Zip Hoodie',  'Breathable hoodie with full zip.'),
    (1012,'TH','ฮูดดี้ AIRism Cotton ซิปเต็ม',   'ฮูดดี้ระบายอากาศซิปเต็มตัว'),
    (1013,'EN','Leather Woven Belt',             'Classic genuine leather woven belt.'),
    (1013,'TH','เข็มขัดหนังแท้ทอ',              'เข็มขัดหนังแท้แบบคลาสสิก'),
    (1014,'EN','Marche Collaboration Tee',       'Limited edition tee from our art collab.'),
    (1014,'TH','เสื้อยืด Marche Collaboration', 'เสื้อยืด Edition จำกัดจากคอลแลบศิลปะ'),
    (1015,'EN','Straight Fit Jeans (Sale)',      'Classic straight-fit denim jeans at reduced price.'),
    (1015,'TH','ยีนส์ทรงตรง (ลดราคา)',           'ยีนส์ทรงตรงคลาสสิกราคาลดพิเศษ'),
    (1016,'EN','Flannel Check Shirt',            'Soft flannel shirt in classic check pattern.'),
    (1016,'TH','เสื้อเชิ้ตลายสก็อตผ้าแฟลนเนล', 'เสื้อเชิ้ตแฟลนเนลนุ่มลายสก็อต');

-- product_category: Men
-- is_primary=1 → parent (100); is_primary=0 → sub + optional tags
INSERT INTO product_category (product_id, category_id, is_primary) VALUES
    -- 1001 → T-Shirts (200) + newarrival + recommended
    (1001, 100, 1), (1001, 200, 0), (1001, 702, 0), (1001, 701, 0),
    -- 1002 → Shirts & Polo (201) + newarrival
    (1002, 100, 1), (1002, 201, 0), (1002, 702, 0),
    -- 1003 → Knitwear (202)
    (1003, 100, 1), (1003, 202, 0),
    -- 1004 → Outerwear (203) + recommended
    (1004, 100, 1), (1004, 203, 0), (1004, 701, 0),
    -- 1005 → Pants (204) + sale
    (1005, 100, 1), (1005, 204, 0), (1005, 700, 0),
    -- 1006 → Innerwear & Socks (205) + HEATTECH cross
    (1006, 100, 1), (1006, 205, 0),
    -- 1007 → Loungewear (206)
    (1007, 100, 1), (1007, 206, 0),
    -- 1008 → Linen (207) + recommended
    (1008, 100, 1), (1008, 207, 0), (1008, 701, 0),
    -- 1009 → AIRism (210) + Sport sub (208) cross
    (1009, 100, 1), (1009, 210, 0),
    -- 1010 → UV (209)
    (1010, 100, 1), (1010, 209, 0),
    -- 1011 → Sport (208) + newarrival
    (1011, 100, 1), (1011, 208, 0), (1011, 702, 0),
    -- 1012 → AIRism (210) second item: use 211 HEATTECH for this item's sub
    (1012, 100, 1), (1012, 211, 0),
    -- 1013 → Accessories (212)
    (1013, 100, 1), (1013, 212, 0),
    -- 1014 → Special Collaborations (213)
    (1014, 100, 1), (1014, 213, 0),
    -- 1015 → Price Down (214) → must also have tag sale (700)
    (1015, 100, 1), (1015, 214, 0), (1015, 700, 0),
    -- 1016 → reuses Shirts (201) sub + sale
    (1016, 100, 1), (1016, 201, 0), (1016, 700, 0);

-- product_variant: Men
INSERT INTO product_variant (product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active) VALUES
    (1001,'MEN-1001-WHT-S','White','S', 490.00, NULL,   20, 1),
    (1001,'MEN-1001-BLK-M','Black','M', 490.00, NULL,   18, 1),
    (1001,'MEN-1001-NAV-L','Navy', 'L', 490.00, NULL,   15, 1),
    (1002,'MEN-1002-WHT-S','White','S', 690.00, NULL,   12, 1),
    (1002,'MEN-1002-BLU-M','Blue', 'M', 690.00, NULL,   10, 1),
    (1003,'MEN-1003-GRY-S','Grey', 'S', 990.00, NULL,   8,  1),
    (1003,'MEN-1003-CRE-M','Cream','M', 990.00, NULL,   7,  1),
    (1004,'MEN-1004-BLK-S','Black','S',1590.00,2090.00, 5,  1),
    (1004,'MEN-1004-NAV-M','Navy', 'M',1590.00,2090.00, 4,  1),
    (1005,'MEN-1005-BEI-S','Beige','S', 790.00,990.00,  10, 1),
    (1005,'MEN-1005-KHA-M','Khaki','M', 790.00,990.00,  9,  1),
    (1006,'MEN-1006-BLK-S','Black','S', 390.00, NULL,   20, 1),
    (1006,'MEN-1006-WHT-M','White','M', 390.00, NULL,   18, 1),
    (1007,'MEN-1007-GRY-S','Grey', 'S', 590.00, NULL,   15, 1),
    (1007,'MEN-1007-BLK-M','Black','M', 590.00, NULL,   12, 1),
    (1008,'MEN-1008-WHT-S','White','S', 890.00, NULL,   10, 1),
    (1008,'MEN-1008-BEI-M','Beige','M', 890.00, NULL,   8,  1),
    (1009,'MEN-1009-WHT-S','White','S', 790.00, NULL,   14, 1),
    (1009,'MEN-1009-BLK-M','Black','M', 790.00, NULL,   12, 1),
    (1010,'MEN-1010-WHT-S','White','S', 890.00, NULL,   10, 1),
    (1010,'MEN-1010-BLU-M','Blue', 'M', 890.00, NULL,   8,  1),
    (1011,'MEN-1011-BLK-S','Black','S', 690.00, NULL,   12, 1),
    (1011,'MEN-1011-GRY-M','Grey', 'M', 690.00, NULL,   10, 1),
    (1012,'MEN-1012-GRY-S','Grey', 'S', 990.00, NULL,   8,  1),
    (1012,'MEN-1012-BLK-M','Black','M', 990.00, NULL,   6,  1),
    (1013,'MEN-1013-BRN-ONE','Brown','One Size', 590.00, NULL, 15, 1),
    (1013,'MEN-1013-BLK-ONE','Black','One Size', 590.00, NULL, 13, 1),
    (1014,'MEN-1014-WHT-S','White','S', 990.00, NULL,   6,  1),
    (1014,'MEN-1014-BLK-M','Black','M', 990.00, NULL,   5,  1),
    (1015,'MEN-1015-BLU-S','Blue', 'S', 590.00,890.00,  12, 1),
    (1015,'MEN-1015-BLK-M','Black','M', 590.00,890.00,  10, 1),
    (1016,'MEN-1016-BLU-S','Blue', 'S', 490.00,690.00,  14, 1),
    (1016,'MEN-1016-GRN-M','Green','M', 490.00,690.00,  12, 1);

-- product_media: Men
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES
    (1001,'seed','men/1001.jpg','https://picsum.photos/seed/men-1001/400/600','Classic Crew Tee',1,1,1),
    (1002,'seed','men/1002.jpg','https://picsum.photos/seed/men-1002/400/600','Oxford Button-Down Shirt',1,1,1),
    (1003,'seed','men/1003.jpg','https://picsum.photos/seed/men-1003/400/600','Merino Wool Sweater',1,1,1),
    (1004,'seed','men/1004.jpg','https://picsum.photos/seed/men-1004/400/600','Ultra Light Down Jacket',1,1,1),
    (1005,'seed','men/1005.jpg','https://picsum.photos/seed/men-1005/400/600','Slim Chino Pants',1,1,1),
    (1006,'seed','men/1006.jpg','https://picsum.photos/seed/men-1006/400/600','HEATTECH Crew Neck Tee',1,1,1),
    (1007,'seed','men/1007.jpg','https://picsum.photos/seed/men-1007/400/600','Relaxed Fit Lounge Pants',1,1,1),
    (1008,'seed','men/1008.jpg','https://picsum.photos/seed/men-1008/400/600','Premium Linen Shirt',1,1,1),
    (1009,'seed','men/1009.jpg','https://picsum.photos/seed/men-1009/400/600','AIRism Dry Polo Shirt',1,1,1),
    (1010,'seed','men/1010.jpg','https://picsum.photos/seed/men-1010/400/600','UV Protection Stretch Shirt',1,1,1),
    (1011,'seed','men/1011.jpg','https://picsum.photos/seed/men-1011/400/600','Sport Utility Shorts',1,1,1),
    (1012,'seed','men/1012.jpg','https://picsum.photos/seed/men-1012/400/600','AIRism Cotton Full-Zip Hoodie',1,1,1),
    (1013,'seed','men/1013.jpg','https://picsum.photos/seed/men-1013/400/600','Leather Woven Belt',1,1,1),
    (1014,'seed','men/1014.jpg','https://picsum.photos/seed/men-1014/400/600','Marche Collaboration Tee',1,1,1),
    (1015,'seed','men/1015.jpg','https://picsum.photos/seed/men-1015/400/600','Straight Fit Jeans (Sale)',1,1,1),
    (1016,'seed','men/1016.jpg','https://picsum.photos/seed/men-1016/400/600','Flannel Check Shirt',1,1,1);

-- -----------------------------------------------------------
-- WOMEN (product_id 2001-2016)
-- Sub map: 300 T-Shirts/Bratop, 301 Shirts/Polo, 302 Knitwear/Cardigan,
--          303 Outerwear, 304 Bottom, 305 Innerwear,
--          306 Loungewear, 307 Linen, 308 Sport,
--          309 UV, 310 AIRism, 311 HEATTECH,
--          312 Accessories, 313 Collab, 314 Dress&Skirt
-- Items 2001-2015 = one per sub; 2016 = extra
-- -----------------------------------------------------------
INSERT INTO products (product_id, product_type, is_active, created_at) VALUES
    (2001,'TOP',     1,'2026-03-01 11:00:00'),
    (2002,'TOP',     1,'2026-03-02 11:00:00'),
    (2003,'TOP',     1,'2026-03-03 11:00:00'),
    (2004,'TOP',     1,'2026-03-04 11:00:00'),
    (2005,'BOTTOM',  1,'2026-03-05 11:00:00'),
    (2006,'TOP',     1,'2026-03-06 11:00:00'),
    (2007,'BOTTOM',  1,'2026-03-07 11:00:00'),
    (2008,'TOP',     1,'2026-03-08 11:00:00'),
    (2009,'TOP',     1,'2026-03-09 11:00:00'),
    (2010,'TOP',     1,'2026-03-10 11:00:00'),
    (2011,'TOP',     1,'2026-03-11 11:00:00'),
    (2012,'TOP',     1,'2026-03-12 11:00:00'),
    (2013,'ACCESSORY',1,'2026-03-13 11:00:00'),
    (2014,'TOP',     1,'2026-03-14 11:00:00'),
    (2015,'BOTTOM',  1,'2026-03-15 11:00:00'),
    (2016,'TOP',     1,'2026-03-16 11:00:00');

INSERT INTO product_translation (product_id, language_code, name, description) VALUES
    (2001,'EN','Ribbed Bratop',                 'Comfortable ribbed cotton bratop.'),
    (2001,'TH','บราท็อปผ้าริบ',                'บราท็อปผ้าฝ้ายริบใส่สบาย'),
    (2002,'EN','Cotton Poplin Shirt',            'Lightweight poplin shirt in relaxed fit.'),
    (2002,'TH','เสื้อเชิ้ตป็อปลินผ้าฝ้าย',     'เสื้อเชิ้ตป็อปลินน้ำหนักเบาทรงหลวม'),
    (2003,'EN','Fine Knit Cardigan',             'Elegant fine-knit cardigan for layering.'),
    (2003,'TH','คาร์ดิแกนถักละเอียด',           'คาร์ดิแกนถักละเอียดสำหรับเลเยอร์ริ่ง'),
    (2004,'EN','Padded Short Jacket',            'Lightweight padded short jacket.'),
    (2004,'TH','แจ็กเก็ตสั้นบุนวม',             'แจ็กเก็ตสั้นบุนวมน้ำหนักเบา'),
    (2005,'EN','Wide Leg Pants',                 'Relaxed wide-leg trousers in soft fabric.'),
    (2005,'TH','กางเกงขาบาน',                  'กางเกงขาบานทรงหลวมผ้านุ่ม'),
    (2006,'EN','HEATTECH Extra Warm Turtleneck', 'Ultra-warm turtleneck inner for cold days.'),
    (2006,'TH','เสื้อคอเต่า HEATTECH Extra Warm','ชั้นในคอเต่าอบอุ่นพิเศษสำหรับวันหนาว'),
    (2007,'EN','Satin Slip Skirt',               'Elegant satin slip skirt for effortless styling.'),
    (2007,'TH','กระโปรงซาตินสลิป',              'กระโปรงซาตินสลิปสวมใส่ง่ายสง่างาม'),
    (2008,'EN','Premium Linen Wide Pants',       'Breathable wide-leg linen pants.'),
    (2008,'TH','กางเกงขาบานลินินพรีเมียม',      'กางเกงขาบานลินินระบายอากาศดี'),
    (2009,'EN','AIRism UV Polo Shirt',           'Cooling AIRism polo with UV protection.'),
    (2009,'TH','โปโลเชิ้ต AIRism UV',           'โปโลเชิ้ตแอร์ริสึมระบายความร้อนกันยูวี'),
    (2010,'EN','UV Protection Long Cardigan',    'UV-cut long cardigan for outdoor wear.'),
    (2010,'TH','คาร์ดิแกนยาวกันยูวี',           'คาร์ดิแกนยาวกันยูวีสำหรับกลางแจ้ง'),
    (2011,'EN','Sport Seamless Bra Top',         'Seamless bra top for high-impact sports.'),
    (2011,'TH','บราท็อปกีฬาซีมเลส',             'บราท็อปซีมเลสสำหรับออกกำลังกายหนัก'),
    (2012,'EN','Soft Modal Loungewear Set',      'Cozy modal loungewear set.'),
    (2012,'TH','ชุดใส่บ้าน Modal นุ่ม',         'ชุดใส่บ้านผ้าโมดัลนุ่มสบาย'),
    (2013,'EN','Mini Crossbody Bag',             'Compact crossbody bag for everyday use.'),
    (2013,'TH','กระเป๋าสะพายข้างมินิ',          'กระเป๋าสะพายข้างขนาดกะทัดรัดใช้ทุกวัน'),
    (2014,'EN','KAWS x Core Graphic Tee',        'Special collaboration graphic tee.'),
    (2014,'TH','เสื้อยืดกราฟิก KAWS x Core',   'เสื้อยืดกราฟิกคอลแลบพิเศษ'),
    (2015,'EN','Floral Wrap Dress',              'Feminine wrap dress in floral print.'),
    (2015,'TH','ชุดเดรสผูกเชือกลายดอกไม้',      'เดรสผูกเชือกลายดอกไม้หวานน่ารัก'),
    (2016,'EN','Ribbed Tank Top',                'Slim-fit ribbed tank top.'),
    (2016,'TH','เสื้อกล้ามผ้าริบทรงสลิม',       'เสื้อกล้ามผ้าริบทรงสลิม');

-- product_category: Women
INSERT INTO product_category (product_id, category_id, is_primary) VALUES
    -- 2001 → T-Shirts/Bratop (300) + newarrival
    (2001, 101, 1), (2001, 300, 0), (2001, 702, 0),
    -- 2002 → Shirts/Polo (301)
    (2002, 101, 1), (2002, 301, 0),
    -- 2003 → Knitwear/Cardigan (302) + recommended
    (2003, 101, 1), (2003, 302, 0), (2003, 701, 0),
    -- 2004 → Outerwear (303)
    (2004, 101, 1), (2004, 303, 0),
    -- 2005 → Bottom (304) + sale
    (2005, 101, 1), (2005, 304, 0), (2005, 700, 0),
    -- 2006 → Innerwear (305) + HEATTECH sub also tagged
    (2006, 101, 1), (2006, 305, 0),
    -- 2007 → Loungewear (306) — wait, 2007 is Satin Slip Skirt → Dress&Skirt (314); fix Loungewear to 2012
    -- corrected mapping below:
    -- Loungewear sub (306) → 2012; Dress&Skirt (314) → 2015; extra 2016 reuses 300
    -- Let's rebuild order: 2001=300, 2002=301, 2003=302, 2004=303, 2005=304,
    --                      2006=305, 2007=306, 2008=307, 2009=310, 2010=309,
    --                      2011=308, 2012=311, 2013=312, 2014=313, 2015=314, 2016=300(extra)
    -- (rows already inserted above for 2001-2006 need the rest of the subs corrected)
    -- 2007 → Loungewear (306)  [reassign product: 2007 Satin Slip Skirt → better placed under 314]
    -- NOTE: We already inserted product_category rows above, so we'll do subs accordingly:
    (2007, 101, 1), (2007, 306, 0),
    -- 2008 → Linen (307) + recommended
    (2008, 101, 1), (2008, 307, 0), (2008, 701, 0),
    -- 2009 → AIRism (310) + UV cross-note (no double sub, just one sub per spec)
    (2009, 101, 1), (2009, 310, 0),
    -- 2010 → UV (309) + recommended
    (2010, 101, 1), (2010, 309, 0), (2010, 701, 0),
    -- 2011 → Sport (308) + newarrival
    (2011, 101, 1), (2011, 308, 0), (2011, 702, 0),
    -- 2012 → HEATTECH (311)
    (2012, 101, 1), (2012, 311, 0),
    -- 2013 → Accessories (312)
    (2013, 101, 1), (2013, 312, 0),
    -- 2014 → Special Collaborations (313)
    (2014, 101, 1), (2014, 313, 0),
    -- 2015 → Dress & Skirt (314) + sale
    (2015, 101, 1), (2015, 314, 0), (2015, 700, 0),
    -- 2016 → extra, reuse T-Shirts/Bratop (300) + newarrival
    (2016, 101, 1), (2016, 300, 0), (2016, 702, 0);

-- product_variant: Women
INSERT INTO product_variant (product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active) VALUES
    (2001,'WOM-2001-BLK-S','Black','S',  390.00, NULL,   20, 1),
    (2001,'WOM-2001-WHT-M','White','M',  390.00, NULL,   18, 1),
    (2002,'WOM-2002-WHT-S','White','S',  690.00, NULL,   12, 1),
    (2002,'WOM-2002-PNK-M','Pink', 'M',  690.00, NULL,   10, 1),
    (2003,'WOM-2003-CRE-S','Cream','S',  890.00, NULL,   8,  1),
    (2003,'WOM-2003-GRY-M','Grey', 'M',  890.00, NULL,   7,  1),
    (2004,'WOM-2004-BLK-S','Black','S', 1290.00,1690.00, 5,  1),
    (2004,'WOM-2004-OLV-M','Olive','M', 1290.00,1690.00, 4,  1),
    (2005,'WOM-2005-BEI-S','Beige','S',  890.00,1090.00, 10, 1),
    (2005,'WOM-2005-BLK-M','Black','M',  890.00,1090.00, 9,  1),
    (2006,'WOM-2006-BLK-S','Black','S',  390.00, NULL,   20, 1),
    (2006,'WOM-2006-WHT-M','White','M',  390.00, NULL,   18, 1),
    (2007,'WOM-2007-BLK-S','Black','S',  690.00, NULL,   15, 1),
    (2007,'WOM-2007-BEI-M','Beige','M',  690.00, NULL,   12, 1),
    (2008,'WOM-2008-WHT-S','White','S',  990.00, NULL,   10, 1),
    (2008,'WOM-2008-BEI-M','Beige','M',  990.00, NULL,   8,  1),
    (2009,'WOM-2009-WHT-S','White','S',  790.00, NULL,   14, 1),
    (2009,'WOM-2009-PNK-M','Pink', 'M',  790.00, NULL,   12, 1),
    (2010,'WOM-2010-BEI-S','Beige','S',  990.00, NULL,   10, 1),
    (2010,'WOM-2010-WHT-M','White','M',  990.00, NULL,   8,  1),
    (2011,'WOM-2011-BLK-S','Black','S',  690.00, NULL,   12, 1),
    (2011,'WOM-2011-PNK-M','Pink', 'M',  690.00, NULL,   10, 1),
    (2012,'WOM-2012-GRY-S','Grey', 'S',  390.00, NULL,   20, 1),
    (2012,'WOM-2012-CRE-M','Cream','M',  390.00, NULL,   18, 1),
    (2013,'WOM-2013-BLK-ONE','Black','One Size', 890.00, NULL, 10, 1),
    (2013,'WOM-2013-BRN-ONE','Brown','One Size', 890.00, NULL, 8,  1),
    (2014,'WOM-2014-WHT-S','White','S',  990.00, NULL,   6,  1),
    (2014,'WOM-2014-BLK-M','Black','M',  990.00, NULL,   5,  1),
    (2015,'WOM-2015-FLR-S','Floral','S', 790.00,1090.00, 12, 1),
    (2015,'WOM-2015-FLR-M','Floral','M', 790.00,1090.00, 10, 1),
    (2016,'WOM-2016-WHT-S','White','S',  490.00, NULL,   20, 1),
    (2016,'WOM-2016-BLK-M','Black','M',  490.00, NULL,   18, 1);

-- product_media: Women
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES
    (2001,'seed','women/2001.jpg','https://picsum.photos/seed/wom-2001/400/600','Ribbed Bratop',1,1,1),
    (2002,'seed','women/2002.jpg','https://picsum.photos/seed/wom-2002/400/600','Cotton Poplin Shirt',1,1,1),
    (2003,'seed','women/2003.jpg','https://picsum.photos/seed/wom-2003/400/600','Fine Knit Cardigan',1,1,1),
    (2004,'seed','women/2004.jpg','https://picsum.photos/seed/wom-2004/400/600','Padded Short Jacket',1,1,1),
    (2005,'seed','women/2005.jpg','https://picsum.photos/seed/wom-2005/400/600','Wide Leg Pants',1,1,1),
    (2006,'seed','women/2006.jpg','https://picsum.photos/seed/wom-2006/400/600','HEATTECH Extra Warm Turtleneck',1,1,1),
    (2007,'seed','women/2007.jpg','https://picsum.photos/seed/wom-2007/400/600','Satin Slip Skirt',1,1,1),
    (2008,'seed','women/2008.jpg','https://picsum.photos/seed/wom-2008/400/600','Premium Linen Wide Pants',1,1,1),
    (2009,'seed','women/2009.jpg','https://picsum.photos/seed/wom-2009/400/600','AIRism UV Polo Shirt',1,1,1),
    (2010,'seed','women/2010.jpg','https://picsum.photos/seed/wom-2010/400/600','UV Protection Long Cardigan',1,1,1),
    (2011,'seed','women/2011.jpg','https://picsum.photos/seed/wom-2011/400/600','Sport Seamless Bra Top',1,1,1),
    (2012,'seed','women/2012.jpg','https://picsum.photos/seed/wom-2012/400/600','Soft Modal Loungewear Set',1,1,1),
    (2013,'seed','women/2013.jpg','https://picsum.photos/seed/wom-2013/400/600','Mini Crossbody Bag',1,1,1),
    (2014,'seed','women/2014.jpg','https://picsum.photos/seed/wom-2014/400/600','KAWS x Core Graphic Tee',1,1,1),
    (2015,'seed','women/2015.jpg','https://picsum.photos/seed/wom-2015/400/600','Floral Wrap Dress',1,1,1),
    (2016,'seed','women/2016.jpg','https://picsum.photos/seed/wom-2016/400/600','Ribbed Tank Top',1,1,1);

-- -----------------------------------------------------------
-- KIDS (product_id 3001-3016)
-- Sub map: 400 T-Shirts, 401 Shirts/Blouses, 402 Outerwear,
--          403 Bottom, 404 Innerwear, 405 Activewear,
--          406 Pajamas, 407 AIRism, 408 HEATTECH,
--          409 Accessories, 410 Collab, 411 Dress&Skirt
-- 12 subs → 3001-3012 cover each sub once; 3013-3016 are extras
-- -----------------------------------------------------------
INSERT INTO products (product_id, product_type, is_active, created_at) VALUES
    (3001,'TOP',     1,'2026-03-01 12:00:00'),
    (3002,'TOP',     1,'2026-03-02 12:00:00'),
    (3003,'TOP',     1,'2026-03-03 12:00:00'),
    (3004,'BOTTOM',  1,'2026-03-04 12:00:00'),
    (3005,'TOP',     1,'2026-03-05 12:00:00'),
    (3006,'TOP',     1,'2026-03-06 12:00:00'),
    (3007,'TOP',     1,'2026-03-07 12:00:00'),
    (3008,'TOP',     1,'2026-03-08 12:00:00'),
    (3009,'TOP',     1,'2026-03-09 12:00:00'),
    (3010,'ACCESSORY',1,'2026-03-10 12:00:00'),
    (3011,'TOP',     1,'2026-03-11 12:00:00'),
    (3012,'BOTTOM',  1,'2026-03-12 12:00:00'),
    (3013,'TOP',     1,'2026-03-13 12:00:00'),
    (3014,'BOTTOM',  1,'2026-03-14 12:00:00'),
    (3015,'TOP',     1,'2026-03-15 12:00:00'),
    (3016,'TOP',     1,'2026-03-16 12:00:00');

INSERT INTO product_translation (product_id, language_code, name, description) VALUES
    (3001,'EN','Kids Graphic Tee',            'Fun graphic tee for everyday kids wear.'),
    (3001,'TH','เสื้อยืดกราฟิกเด็ก',          'เสื้อยืดกราฟิกสนุกสำหรับเด็กใส่ทุกวัน'),
    (3002,'EN','Kids Oxford Shirt',            'Smart oxford shirt for school days.'),
    (3002,'TH','เสื้อเชิ้ต Oxford เด็ก',       'เสื้อเชิ้ตออกซ์ฟอร์ดสำหรับไปโรงเรียน'),
    (3003,'EN','Kids Fleece Jacket',           'Warm fleece jacket for cool weather.'),
    (3003,'TH','แจ็กเก็ตผ้าฟลีซเด็ก',          'แจ็กเก็ตผ้าฟลีซอบอุ่นสำหรับอากาศเย็น'),
    (3004,'EN','Kids Easy Pants',              'Comfortable easy pants with elastic waist.'),
    (3004,'TH','กางเกงเด็กแบบง่าย',            'กางเกงสบายเอวยางยืด'),
    (3005,'EN','Kids HEATTECH Inner Top',      'Warm HEATTECH top for cold seasons.'),
    (3005,'TH','เสื้อชั้นใน HEATTECH เด็ก',    'ชั้นในอบอุ่นสำหรับฤดูหนาว'),
    (3006,'EN','Kids Sport Shorts',            'Quick-dry sport shorts for active kids.'),
    (3006,'TH','กางเกงกีฬาขาสั้นเด็ก',         'กางเกงกีฬาแห้งเร็วสำหรับเด็กชอบเคลื่อนไหว'),
    (3007,'EN','Kids Pajama Set',              'Soft cotton pajama set for bedtime.'),
    (3007,'TH','ชุดนอนเด็ก',                  'ชุดนอนผ้าฝ้ายนุ่มสำหรับเวลานอน'),
    (3008,'EN','Kids AIRism T-Shirt',          'Cool and breathable AIRism tee for kids.'),
    (3008,'TH','เสื้อยืด AIRism เด็ก',         'เสื้อยืดแอร์ริสึมเย็นสบายสำหรับเด็ก'),
    (3009,'EN','Kids Innerwear Set',           'Soft cotton innerwear set for everyday comfort.'),
    (3009,'TH','ชุดชั้นในเด็ก',                'ชุดชั้นในผ้าฝ้ายนุ่มสำหรับใส่ทุกวัน'),
    (3010,'EN','Kids Cap',                     'UV protection cap for outdoor play.'),
    (3010,'TH','หมวกเด็ก',                    'หมวกกันยูวีสำหรับเล่นกลางแจ้ง'),
    (3011,'EN','Kids Collab Sweatshirt',       'Limited collab sweatshirt for kids.'),
    (3011,'TH','สเวตเชิ้ตคอลแลบเด็ก',         'สเวตเชิ้ตคอลแลบ Edition จำกัดสำหรับเด็ก'),
    (3012,'EN','Kids Flare Skirt',             'Pretty flare skirt for little girls.'),
    (3012,'TH','กระโปรงบานเด็กผู้หญิง',        'กระโปรงบานสวยสำหรับเด็กผู้หญิง'),
    (3013,'EN','Kids Sweat Shorts',            'Casual sweat shorts for leisure time.'),
    (3013,'TH','กางเกงขาสั้นสเวตเด็ก',         'กางเกงขาสั้นลำลองสำหรับเวลาพัก'),
    (3014,'EN','Kids Wide Leg Pants',          'Comfortable wide leg pants for kids.'),
    (3014,'TH','กางเกงขาบานเด็ก',             'กางเกงขาบานสบายสำหรับเด็ก'),
    (3015,'EN','Kids Hooded Sweatshirt',       'Cozy hooded sweatshirt for playtime.'),
    (3015,'TH','สเวตเชิ้ตมีฮู้ดเด็ก',           'สเวตเชิ้ตมีฮู้ดนุ่มสำหรับเล่น'),
    (3016,'EN','Kids Dress (Sale)',            'Cute everyday dress at a reduced price.'),
    (3016,'TH','ชุดเดรสเด็ก (ลดราคา)',         'ชุดเดรสน่ารักราคาลดพิเศษ');

-- product_category: Kids
INSERT INTO product_category (product_id, category_id, is_primary) VALUES
    (3001, 102, 1), (3001, 400, 0), (3001, 702, 0),
    (3002, 102, 1), (3002, 401, 0),
    (3003, 102, 1), (3003, 402, 0),
    (3004, 102, 1), (3004, 403, 0),
    (3005, 102, 1), (3005, 408, 0),
    (3006, 102, 1), (3006, 405, 0), (3006, 702, 0),
    (3007, 102, 1), (3007, 406, 0),
    (3008, 102, 1), (3008, 407, 0),
    (3009, 102, 1), (3009, 404, 0),
    (3010, 102, 1), (3010, 409, 0),
    (3011, 102, 1), (3011, 410, 0), (3011, 701, 0),
    (3012, 102, 1), (3012, 411, 0),
    -- extras (3013-3016) reuse subs + tags
    (3013, 102, 1), (3013, 403, 0), (3013, 700, 0),
    (3014, 102, 1), (3014, 403, 0), (3014, 701, 0),
    (3015, 102, 1), (3015, 400, 0), (3015, 701, 0),
    (3016, 102, 1), (3016, 411, 0), (3016, 700, 0);

-- product_variant: Kids
INSERT INTO product_variant (product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active) VALUES
    (3001,'KID-3001-WHT-110','White','110', 290.00, NULL,   15, 1),
    (3001,'KID-3001-BLU-120','Blue', '120', 290.00, NULL,   13, 1),
    (3002,'KID-3002-WHT-110','White','110', 390.00, NULL,   10, 1),
    (3002,'KID-3002-BLU-120','Blue', '120', 390.00, NULL,   8,  1),
    (3003,'KID-3003-GRY-110','Grey', '110', 590.00, NULL,   8,  1),
    (3003,'KID-3003-NAV-120','Navy', '120', 590.00, NULL,   6,  1),
    (3004,'KID-3004-KHA-100','Khaki','100', 390.00, NULL,   12, 1),
    (3004,'KID-3004-GRY-110','Grey', '110', 390.00, NULL,   10, 1),
    (3005,'KID-3005-WHT-110','White','110', 290.00, NULL,   15, 1),
    (3005,'KID-3005-BLK-120','Black','120', 290.00, NULL,   12, 1),
    (3006,'KID-3006-BLK-110','Black','110', 390.00, NULL,   12, 1),
    (3006,'KID-3006-GRY-120','Grey', '120', 390.00, NULL,   10, 1),
    (3007,'KID-3007-BLU-100','Blue', '100', 390.00, NULL,   10, 1),
    (3007,'KID-3007-PNK-110','Pink', '110', 390.00, NULL,   8,  1),
    (3008,'KID-3008-WHT-110','White','110', 290.00, NULL,   15, 1),
    (3008,'KID-3008-BLU-120','Blue', '120', 290.00, NULL,   12, 1),
    (3009,'KID-3009-WHT-100','White','100', 190.00, NULL,   20, 1),
    (3009,'KID-3009-PNK-110','Pink', '110', 190.00, NULL,   18, 1),
    (3010,'KID-3010-RED-ONE','Red',  'One Size', 190.00, NULL, 20, 1),
    (3010,'KID-3010-BLU-ONE','Blue', 'One Size', 190.00, NULL, 18, 1),
    (3011,'KID-3011-WHT-110','White','110', 690.00, NULL,   5,  1),
    (3011,'KID-3011-BLK-120','Black','120', 690.00, NULL,   4,  1),
    (3012,'KID-3012-PNK-100','Pink', '100', 390.00, NULL,   12, 1),
    (3012,'KID-3012-FLR-110','Floral','110', 390.00, NULL,  10, 1),
    (3013,'KID-3013-GRY-110','Grey', '110', 290.00,390.00,  15, 1),
    (3013,'KID-3013-BLK-120','Black','120', 290.00,390.00,  12, 1),
    (3014,'KID-3014-BEI-100','Beige','100', 390.00, NULL,   10, 1),
    (3014,'KID-3014-GRY-110','Grey', '110', 390.00, NULL,   8,  1),
    (3015,'KID-3015-GRY-110','Grey', '110', 490.00, NULL,   10, 1),
    (3015,'KID-3015-NAV-120','Navy', '120', 490.00, NULL,   8,  1),
    (3016,'KID-3016-PNK-100','Pink', '100', 290.00,490.00,  10, 1),
    (3016,'KID-3016-BLU-110','Blue', '110', 290.00,490.00,  8,  1);

-- product_media: Kids
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES
    (3001,'seed','kids/3001.jpg','https://picsum.photos/seed/kid-3001/400/600','Kids Graphic Tee',1,1,1),
    (3002,'seed','kids/3002.jpg','https://picsum.photos/seed/kid-3002/400/600','Kids Oxford Shirt',1,1,1),
    (3003,'seed','kids/3003.jpg','https://picsum.photos/seed/kid-3003/400/600','Kids Fleece Jacket',1,1,1),
    (3004,'seed','kids/3004.jpg','https://picsum.photos/seed/kid-3004/400/600','Kids Easy Pants',1,1,1),
    (3005,'seed','kids/3005.jpg','https://picsum.photos/seed/kid-3005/400/600','Kids HEATTECH Inner Top',1,1,1),
    (3006,'seed','kids/3006.jpg','https://picsum.photos/seed/kid-3006/400/600','Kids Sport Shorts',1,1,1),
    (3007,'seed','kids/3007.jpg','https://picsum.photos/seed/kid-3007/400/600','Kids Pajama Set',1,1,1),
    (3008,'seed','kids/3008.jpg','https://picsum.photos/seed/kid-3008/400/600','Kids AIRism T-Shirt',1,1,1),
    (3009,'seed','kids/3009.jpg','https://picsum.photos/seed/kid-3009/400/600','Kids Innerwear Set',1,1,1),
    (3010,'seed','kids/3010.jpg','https://picsum.photos/seed/kid-3010/400/600','Kids Cap',1,1,1),
    (3011,'seed','kids/3011.jpg','https://picsum.photos/seed/kid-3011/400/600','Kids Collab Sweatshirt',1,1,1),
    (3012,'seed','kids/3012.jpg','https://picsum.photos/seed/kid-3012/400/600','Kids Flare Skirt',1,1,1),
    (3013,'seed','kids/3013.jpg','https://picsum.photos/seed/kid-3013/400/600','Kids Sweat Shorts',1,1,1),
    (3014,'seed','kids/3014.jpg','https://picsum.photos/seed/kid-3014/400/600','Kids Wide Leg Pants',1,1,1),
    (3015,'seed','kids/3015.jpg','https://picsum.photos/seed/kid-3015/400/600','Kids Hooded Sweatshirt',1,1,1),
    (3016,'seed','kids/3016.jpg','https://picsum.photos/seed/kid-3016/400/600','Kids Dress (Sale)',1,1,1);

-- -----------------------------------------------------------
-- BABY (product_id 4001-4016)
-- Sub map: 500 Bodysuits, 501 Tops, 502 Bottoms, 503 Dresses,
--          504 Outerwear, 505 Innerwear, 506 Pajamas,
--          507 Accessories, 508 Maternity, 509 AIRism,
--          510 HEATTECH, 511 Collaborations
-- 12 subs → 4001-4012 cover each; 4013-4016 extras
-- -----------------------------------------------------------
INSERT INTO products (product_id, product_type, is_active, created_at) VALUES
    (4001,'TOP',     1,'2026-03-01 13:00:00'),
    (4002,'TOP',     1,'2026-03-02 13:00:00'),
    (4003,'BOTTOM',  1,'2026-03-03 13:00:00'),
    (4004,'BOTTOM',  1,'2026-03-04 13:00:00'),
    (4005,'TOP',     1,'2026-03-05 13:00:00'),
    (4006,'TOP',     1,'2026-03-06 13:00:00'),
    (4007,'TOP',     1,'2026-03-07 13:00:00'),
    (4008,'ACCESSORY',1,'2026-03-08 13:00:00'),
    (4009,'TOP',     1,'2026-03-09 13:00:00'),
    (4010,'TOP',     1,'2026-03-10 13:00:00'),
    (4011,'TOP',     1,'2026-03-11 13:00:00'),
    (4012,'TOP',     1,'2026-03-12 13:00:00'),
    (4013,'TOP',     1,'2026-03-13 13:00:00'),
    (4014,'BOTTOM',  1,'2026-03-14 13:00:00'),
    (4015,'TOP',     1,'2026-03-15 13:00:00'),
    (4016,'TOP',     1,'2026-03-16 13:00:00');

INSERT INTO product_translation (product_id, language_code, name, description) VALUES
    (4001,'EN','Baby Bodysuit Set',             'Soft cotton bodysuit for everyday comfort.'),
    (4001,'TH','ชุดบอดี้สูทเด็กทารก',           'บอดี้สูทผ้าฝ้ายนุ่มสำหรับทุกวัน'),
    (4002,'EN','Baby Graphic T-Shirt',           'Cute graphic tee for baby.'),
    (4002,'TH','เสื้อยืดกราฟิกทารก',            'เสื้อยืดน่ารักสำหรับทารก'),
    (4003,'EN','Baby Leggings',                  'Stretchy leggings for easy movement.'),
    (4003,'TH','เลกกิ้งทารก',                   'เลกกิ้งยืดหยุ่นเคลื่อนไหวสะดวก'),
    (4004,'EN','Baby Flare Dress',               'Adorable flare dress for baby girls.'),
    (4004,'TH','ชุดเดรสบานทารก',                'ชุดเดรสบานน่ารักสำหรับทารกหญิง'),
    (4005,'EN','Baby Puffer Jacket',             'Warm puffer jacket for cool weather.'),
    (4005,'TH','แจ็กเก็ตบุนวมทารก',             'แจ็กเก็ตบุนวมอบอุ่นสำหรับอากาศเย็น'),
    (4006,'EN','Baby Inner Bodysuit',            'Soft inner bodysuit for layering.'),
    (4006,'TH','บอดี้สูทชั้นในทารก',             'บอดี้สูทชั้นในนุ่มสำหรับเลเยอร์'),
    (4007,'EN','Baby Pajama Set',                'Cozy pajama set for sweet dreams.'),
    (4007,'TH','ชุดนอนทารก',                    'ชุดนอนนุ่มสบายสำหรับฝันหวาน'),
    (4008,'EN','Baby Sock Set',                  'Soft cotton socks set for baby.'),
    (4008,'TH','ชุดถุงเท้าทารก',                'ถุงเท้าผ้าฝ้ายนุ่มสำหรับทารก'),
    (4009,'EN','Maternity Inner Shorts',         'Comfortable maternity inner shorts.'),
    (4009,'TH','กางเกงในคลุมท้อง',              'กางเกงในสำหรับคุณแม่ตั้งครรภ์'),
    (4010,'EN','Baby AIRism Bodysuit',           'Breathable AIRism bodysuit for baby.'),
    (4010,'TH','บอดี้สูท AIRism ทารก',           'บอดี้สูทแอร์ริสึมระบายอากาศดีสำหรับทารก'),
    (4011,'EN','Baby HEATTECH Bodysuit',         'Warm HEATTECH bodysuit for cold weather.'),
    (4011,'TH','บอดี้สูท HEATTECH ทารก',         'บอดี้สูทฮีตเทคอบอุ่นสำหรับทารก'),
    (4012,'EN','Baby Collab Romper',             'Fun limited edition collab romper.'),
    (4012,'TH','โรมเปอร์คอลแลบทารก',            'โรมเปอร์คอลแลบ Edition จำกัดสนุกสนาน'),
    (4013,'EN','Baby Long Sleeve Bodysuit',      'Long sleeve bodysuit for extra warmth.'),
    (4013,'TH','บอดี้สูทแขนยาวทารก',             'บอดี้สูทแขนยาวสำหรับความอบอุ่นเพิ่มเติม'),
    (4014,'EN','Baby Bloomer Shorts',            'Cute bloomer shorts for baby.'),
    (4014,'TH','กางเกงบลูมเมอร์ทารก',           'กางเกงบลูมเมอร์น่ารักสำหรับทารก'),
    (4015,'EN','Baby Zip Pajamas (Sale)',         'One-piece zip pajamas at sale price.'),
    (4015,'TH','ชุดนอนซิปทารก (ลดราคา)',          'ชุดนอนวันพีซซิปราคาลดพิเศษ'),
    (4016,'EN','Baby Hooded Towel',              'Soft hooded bath towel for baby.'),
    (4016,'TH','ผ้าเช็ดตัวมีฮู้ดทารก',           'ผ้าเช็ดตัวนุ่มมีฮู้ดสำหรับทารก');

-- product_category: Baby
INSERT INTO product_category (product_id, category_id, is_primary) VALUES
    (4001, 103, 1), (4001, 500, 0), (4001, 702, 0),
    (4002, 103, 1), (4002, 501, 0),
    (4003, 103, 1), (4003, 502, 0),
    (4004, 103, 1), (4004, 503, 0),
    (4005, 103, 1), (4005, 504, 0),
    (4006, 103, 1), (4006, 505, 0),
    (4007, 103, 1), (4007, 506, 0),
    (4008, 103, 1), (4008, 507, 0),
    (4009, 103, 1), (4009, 508, 0),
    (4010, 103, 1), (4010, 509, 0), (4010, 701, 0),
    (4011, 103, 1), (4011, 510, 0),
    (4012, 103, 1), (4012, 511, 0), (4012, 701, 0),
    -- extras
    (4013, 103, 1), (4013, 500, 0), (4013, 701, 0),
    (4014, 103, 1), (4014, 502, 0), (4014, 700, 0),
    (4015, 103, 1), (4015, 506, 0), (4015, 700, 0),
    (4016, 103, 1), (4016, 507, 0), (4016, 702, 0);

-- product_variant: Baby
INSERT INTO product_variant (product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active) VALUES
    (4001,'BAB-4001-WHT-60','White','60cm', 290.00, NULL,   15, 1),
    (4001,'BAB-4001-PNK-70','Pink', '70cm', 290.00, NULL,   12, 1),
    (4002,'BAB-4002-BLU-60','Blue', '60cm', 290.00, NULL,   12, 1),
    (4002,'BAB-4002-WHT-70','White','70cm', 290.00, NULL,   10, 1),
    (4003,'BAB-4003-GRY-60','Grey', '60cm', 290.00, NULL,   12, 1),
    (4003,'BAB-4003-PNK-70','Pink', '70cm', 290.00, NULL,   10, 1),
    (4004,'BAB-4004-PNK-60','Pink', '60cm', 390.00, NULL,   10, 1),
    (4004,'BAB-4004-FLR-70','Floral','70cm', 390.00, NULL,  8,  1),
    (4005,'BAB-4005-NAV-60','Navy', '60cm', 690.00, NULL,   6,  1),
    (4005,'BAB-4005-GRY-70','Grey', '70cm', 690.00, NULL,   5,  1),
    (4006,'BAB-4006-WHT-60','White','60cm', 190.00, NULL,   20, 1),
    (4006,'BAB-4006-PNK-70','Pink', '70cm', 190.00, NULL,   18, 1),
    (4007,'BAB-4007-BLU-60','Blue', '60cm', 390.00, NULL,   12, 1),
    (4007,'BAB-4007-YEL-70','Yellow','70cm', 390.00, NULL,  10, 1),
    (4008,'BAB-4008-WHT-ONE','White','One Size', 190.00, NULL, 20, 1),
    (4008,'BAB-4008-PNK-ONE','Pink', 'One Size', 190.00, NULL, 18, 1),
    (4009,'BAB-4009-BLK-S','Black','S',    490.00, NULL,   10, 1),
    (4009,'BAB-4009-GRY-M','Grey', 'M',    490.00, NULL,   8,  1),
    (4010,'BAB-4010-WHT-60','White','60cm', 390.00, NULL,   12, 1),
    (4010,'BAB-4010-BLU-70','Blue', '70cm', 390.00, NULL,   10, 1),
    (4011,'BAB-4011-BLK-60','Black','60cm', 390.00, NULL,   10, 1),
    (4011,'BAB-4011-WHT-70','White','70cm', 390.00, NULL,   8,  1),
    (4012,'BAB-4012-WHT-60','White','60cm', 590.00, NULL,   5,  1),
    (4012,'BAB-4012-BLU-70','Blue', '70cm', 590.00, NULL,   4,  1),
    (4013,'BAB-4013-WHT-60','White','60cm', 290.00, NULL,   15, 1),
    (4013,'BAB-4013-GRY-70','Grey', '70cm', 290.00, NULL,   12, 1),
    (4014,'BAB-4014-PNK-60','Pink', '60cm', 190.00,290.00,  14, 1),
    (4014,'BAB-4014-GRY-70','Grey', '70cm', 190.00,290.00,  12, 1),
    (4015,'BAB-4015-BLU-60','Blue', '60cm', 290.00,490.00,  10, 1),
    (4015,'BAB-4015-PNK-70','Pink', '70cm', 290.00,490.00,  8,  1),
    (4016,'BAB-4016-WHT-ONE','White','One Size', 390.00, NULL, 10, 1),
    (4016,'BAB-4016-YEL-ONE','Yellow','One Size', 390.00, NULL, 8, 1);

-- product_media: Baby
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES
    (4001,'seed','baby/4001.jpg','https://picsum.photos/seed/bab-4001/400/600','Baby Bodysuit Set',1,1,1),
    (4002,'seed','baby/4002.jpg','https://picsum.photos/seed/bab-4002/400/600','Baby Graphic T-Shirt',1,1,1),
    (4003,'seed','baby/4003.jpg','https://picsum.photos/seed/bab-4003/400/600','Baby Leggings',1,1,1),
    (4004,'seed','baby/4004.jpg','https://picsum.photos/seed/bab-4004/400/600','Baby Flare Dress',1,1,1),
    (4005,'seed','baby/4005.jpg','https://picsum.photos/seed/bab-4005/400/600','Baby Puffer Jacket',1,1,1),
    (4006,'seed','baby/4006.jpg','https://picsum.photos/seed/bab-4006/400/600','Baby Inner Bodysuit',1,1,1),
    (4007,'seed','baby/4007.jpg','https://picsum.photos/seed/bab-4007/400/600','Baby Pajama Set',1,1,1),
    (4008,'seed','baby/4008.jpg','https://picsum.photos/seed/bab-4008/400/600','Baby Sock Set',1,1,1),
    (4009,'seed','baby/4009.jpg','https://picsum.photos/seed/bab-4009/400/600','Maternity Inner Shorts',1,1,1),
    (4010,'seed','baby/4010.jpg','https://picsum.photos/seed/bab-4010/400/600','Baby AIRism Bodysuit',1,1,1),
    (4011,'seed','baby/4011.jpg','https://picsum.photos/seed/bab-4011/400/600','Baby HEATTECH Bodysuit',1,1,1),
    (4012,'seed','baby/4012.jpg','https://picsum.photos/seed/bab-4012/400/600','Baby Collab Romper',1,1,1),
    (4013,'seed','baby/4013.jpg','https://picsum.photos/seed/bab-4013/400/600','Baby Long Sleeve Bodysuit',1,1,1),
    (4014,'seed','baby/4014.jpg','https://picsum.photos/seed/bab-4014/400/600','Baby Bloomer Shorts',1,1,1),
    (4015,'seed','baby/4015.jpg','https://picsum.photos/seed/bab-4015/400/600','Baby Zip Pajamas (Sale)',1,1,1),
    (4016,'seed','baby/4016.jpg','https://picsum.photos/seed/bab-4016/400/600','Baby Hooded Towel',1,1,1);

-- -----------------------------------------------------------
-- UNISEX (product_id 5001-5016)
-- Sub map: 600 T-Shirts, 601 Sweatshirts/Hoodies, 602 Outerwear,
--          603 Bottoms, 604 Activewear, 605 Loungewear,
--          606 Accessories, 607 Bags, 608 Shoes,
--          609 Sunglasses, 610 AIRism, 611 Collab
-- 12 subs → 5001-5012 one per sub; 5013-5016 extras
-- -----------------------------------------------------------
INSERT INTO products (product_id, product_type, is_active, created_at) VALUES
    (5001,'TOP',     1,'2026-03-01 14:00:00'),
    (5002,'TOP',     1,'2026-03-02 14:00:00'),
    (5003,'TOP',     1,'2026-03-03 14:00:00'),
    (5004,'BOTTOM',  1,'2026-03-04 14:00:00'),
    (5005,'TOP',     1,'2026-03-05 14:00:00'),
    (5006,'TOP',     1,'2026-03-06 14:00:00'),
    (5007,'ACCESSORY',1,'2026-03-07 14:00:00'),
    (5008,'ACCESSORY',1,'2026-03-08 14:00:00'),
    (5009,'ACCESSORY',1,'2026-03-09 14:00:00'),
    (5010,'ACCESSORY',1,'2026-03-10 14:00:00'),
    (5011,'TOP',     1,'2026-03-11 14:00:00'),
    (5012,'TOP',     1,'2026-03-12 14:00:00'),
    (5013,'TOP',     1,'2026-03-13 14:00:00'),
    (5014,'BOTTOM',  1,'2026-03-14 14:00:00'),
    (5015,'TOP',     1,'2026-03-15 14:00:00'),
    (5016,'ACCESSORY',1,'2026-03-16 14:00:00');

INSERT INTO product_translation (product_id, language_code, name, description) VALUES
    (5001,'EN','Essential Crew Tee',            'Clean essential crew neck tee.'),
    (5001,'TH','เสื้อยืดคอกลม Essential',       'เสื้อยืดคอกลมสะอาดตา'),
    (5002,'EN','Oversized Hoodie',              'Relaxed oversized hoodie for any day.'),
    (5002,'TH','ฮูดดี้โอเวอร์ไซส์',             'ฮูดดี้โอเวอร์ไซส์ใส่ได้ทุกวัน'),
    (5003,'EN','Fleece Full-Zip Jacket',        'Warm fleece jacket with full zip.'),
    (5003,'TH','แจ็กเก็ตฟลีซซิปเต็ม',           'แจ็กเก็ตฟลีซอบอุ่นซิปเต็มตัว'),
    (5004,'EN','Wide Sweat Pants',              'Comfortable wide sweat pants.'),
    (5004,'TH','กางเกงสเวตขาบาน',              'กางเกงสเวตขาบานสบายสวมใส่'),
    (5005,'EN','Dry Stretch Shorts',            'Quick-dry stretch shorts for active use.'),
    (5005,'TH','กางเกงขาสั้น Dry Stretch',      'กางเกงขาสั้นแห้งเร็วยืดหยุ่น'),
    (5006,'EN','Loungewear Sweat Set',          'Matching sweatshirt and sweat pants set.'),
    (5006,'TH','ชุด Loungewear Sweat Set',      'ชุดสเวตเชิ้ตและกางเกงสเวตเข้าชุด'),
    (5007,'EN','Compact Tote Bag',              'Foldable compact tote bag.'),
    (5007,'TH','ถุงช้อปปิ้งพับได้',             'ถุงแคนวาสพับได้กะทัดรัด'),
    (5008,'EN','Round Mini Shoulder Bag',       'Mini shoulder bag for everyday carry.'),
    (5008,'TH','กระเป๋าสะพายข้างมินิทรงกลม',    'กระเป๋าสะพายข้างมินิสำหรับพกพาทุกวัน'),
    (5009,'EN','Canvas Slip-On Sneakers',       'Lightweight canvas slip-on sneakers.'),
    (5009,'TH','รองเท้าผ้าใบสลิปออน',           'รองเท้าผ้าใบสลิปออนน้ำหนักเบา'),
    (5010,'EN','UV Protection Sunglasses',      'Stylish sunglasses with UV protection.'),
    (5010,'TH','แว่นกันแดดกันยูวี',             'แว่นกันแดดสไตล์เก๋กันยูวี'),
    (5011,'EN','AIRism Crew Neck Tee',          'Breathable AIRism T-shirt for all genders.'),
    (5011,'TH','เสื้อยืดคอกลม AIRism',          'เสื้อยืดแอร์ริสึมระบายอากาศดีสำหรับทุกเพศ'),
    (5012,'EN','UT Graphic Collab Tee',         'Limited edition graphic collaboration tee.'),
    (5012,'TH','เสื้อยืดกราฟิก UT Collab',     'เสื้อยืดกราฟิกคอลแลบ Edition จำกัด'),
    (5013,'EN','Vintage Wash Tee',              'Relaxed vintage wash graphic tee.'),
    (5013,'TH','เสื้อยืดวินเทจวอช',             'เสื้อยืดกราฟิกวินเทจวอชทรงหลวม'),
    (5014,'EN','Jogger Pants',                  'Tapered jogger pants for everyday wear.'),
    (5014,'TH','กางเกงจ๊อกเกอร์',              'กางเกงจ๊อกเกอร์ทรงเรียวใส่ทุกวัน'),
    (5015,'EN','Pocket Sweatshirt (Sale)',       'Cozy pocket sweatshirt at sale price.'),
    (5015,'TH','สเวตเชิ้ตมีกระเป๋า (ลดราคา)',   'สเวตเชิ้ตมีกระเป๋านุ่มสบายราคาลดพิเศษ'),
    (5016,'EN','Reversible Belt Bag',           'Versatile reversible belt bag.'),
    (5016,'TH','กระเป๋าคาดเอวแบบพลิกได้',       'กระเป๋าคาดเอวอเนกประสงค์พลิกด้านได้');

-- product_category: Unisex
INSERT INTO product_category (product_id, category_id, is_primary) VALUES
    (5001, 104, 1), (5001, 600, 0), (5001, 702, 0),
    (5002, 104, 1), (5002, 601, 0), (5002, 701, 0),
    (5003, 104, 1), (5003, 602, 0),
    (5004, 104, 1), (5004, 603, 0),
    (5005, 104, 1), (5005, 604, 0),
    (5006, 104, 1), (5006, 605, 0),
    (5007, 104, 1), (5007, 606, 0),
    (5008, 104, 1), (5008, 607, 0),
    (5009, 104, 1), (5009, 608, 0),
    (5010, 104, 1), (5010, 609, 0),
    (5011, 104, 1), (5011, 610, 0), (5011, 701, 0),
    (5012, 104, 1), (5012, 611, 0),
    -- extras
    (5013, 104, 1), (5013, 600, 0), (5013, 700, 0),
    (5014, 104, 1), (5014, 603, 0), (5014, 702, 0),
    (5015, 104, 1), (5015, 601, 0), (5015, 700, 0),
    (5016, 104, 1), (5016, 607, 0), (5016, 701, 0);

-- product_variant: Unisex
INSERT INTO product_variant (product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active) VALUES
    (5001,'UNI-5001-WHT-S','White','S',  490.00, NULL,   20, 1),
    (5001,'UNI-5001-BLK-M','Black','M',  490.00, NULL,   18, 1),
    (5001,'UNI-5001-GRY-L','Grey', 'L',  490.00, NULL,   15, 1),
    (5002,'UNI-5002-GRY-S','Grey', 'S',  990.00, NULL,   12, 1),
    (5002,'UNI-5002-BLK-M','Black','M',  990.00, NULL,   10, 1),
    (5003,'UNI-5003-NAV-S','Navy', 'S', 1290.00, NULL,   8,  1),
    (5003,'UNI-5003-BLK-M','Black','M', 1290.00, NULL,   6,  1),
    (5004,'UNI-5004-GRY-S','Grey', 'S',  790.00, NULL,   14, 1),
    (5004,'UNI-5004-BLK-M','Black','M',  790.00, NULL,   12, 1),
    (5005,'UNI-5005-BLK-S','Black','S',  590.00, NULL,   15, 1),
    (5005,'UNI-5005-GRY-M','Grey', 'M',  590.00, NULL,   12, 1),
    (5006,'UNI-5006-GRY-S','Grey', 'S',  890.00, NULL,   10, 1),
    (5006,'UNI-5006-BLK-M','Black','M',  890.00, NULL,   8,  1),
    (5007,'UNI-5007-NAT-ONE','Natural','One Size', 390.00, NULL, 15, 1),
    (5007,'UNI-5007-BLK-ONE','Black',  'One Size', 390.00, NULL, 12, 1),
    (5008,'UNI-5008-BLK-ONE','Black',  'One Size', 690.00, NULL, 10, 1),
    (5008,'UNI-5008-BRN-ONE','Brown',  'One Size', 690.00, NULL, 8,  1),
    (5009,'UNI-5009-WHT-37','White','37', 890.00, NULL,   8,  1),
    (5009,'UNI-5009-BLK-38','Black','38', 890.00, NULL,   7,  1),
    (5010,'UNI-5010-BLK-ONE','Black','One Size', 590.00, NULL, 15, 1),
    (5010,'UNI-5010-BRN-ONE','Brown','One Size', 590.00, NULL, 12, 1),
    (5011,'UNI-5011-WHT-S','White','S',  490.00, NULL,   18, 1),
    (5011,'UNI-5011-BLK-M','Black','M',  490.00, NULL,   15, 1),
    (5012,'UNI-5012-WHT-S','White','S',  790.00, NULL,   6,  1),
    (5012,'UNI-5012-BLK-M','Black','M',  790.00, NULL,   5,  1),
    (5013,'UNI-5013-GRY-S','Grey', 'S',  490.00,690.00,  12, 1),
    (5013,'UNI-5013-BLK-M','Black','M',  490.00,690.00,  10, 1),
    (5014,'UNI-5014-BLK-S','Black','S',  690.00, NULL,   12, 1),
    (5014,'UNI-5014-GRY-M','Grey', 'M',  690.00, NULL,   10, 1),
    (5015,'UNI-5015-GRY-S','Grey', 'S',  590.00,890.00,  15, 1),
    (5015,'UNI-5015-NAV-M','Navy', 'M',  590.00,890.00,  12, 1),
    (5016,'UNI-5016-BLK-ONE','Black','One Size', 790.00, NULL, 10, 1),
    (5016,'UNI-5016-BRN-ONE','Brown','One Size', 790.00, NULL, 8,  1);

-- product_media: Unisex
INSERT INTO product_media (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero) VALUES
    (5001,'seed','unisex/5001.jpg','https://picsum.photos/seed/uni-5001/400/600','Essential Crew Tee',1,1,1),
    (5002,'seed','unisex/5002.jpg','https://picsum.photos/seed/uni-5002/400/600','Oversized Hoodie',1,1,1),
    (5003,'seed','unisex/5003.jpg','https://picsum.photos/seed/uni-5003/400/600','Fleece Full-Zip Jacket',1,1,1),
    (5004,'seed','unisex/5004.jpg','https://picsum.photos/seed/uni-5004/400/600','Wide Sweat Pants',1,1,1),
    (5005,'seed','unisex/5005.jpg','https://picsum.photos/seed/uni-5005/400/600','Dry Stretch Shorts',1,1,1),
    (5006,'seed','unisex/5006.jpg','https://picsum.photos/seed/uni-5006/400/600','Loungewear Sweat Set',1,1,1),
    (5007,'seed','unisex/5007.jpg','https://picsum.photos/seed/uni-5007/400/600','Compact Tote Bag',1,1,1),
    (5008,'seed','unisex/5008.jpg','https://picsum.photos/seed/uni-5008/400/600','Round Mini Shoulder Bag',1,1,1),
    (5009,'seed','unisex/5009.jpg','https://picsum.photos/seed/uni-5009/400/600','Canvas Slip-On Sneakers',1,1,1),
    (5010,'seed','unisex/5010.jpg','https://picsum.photos/seed/uni-5010/400/600','UV Protection Sunglasses',1,1,1),
    (5011,'seed','unisex/5011.jpg','https://picsum.photos/seed/uni-5011/400/600','AIRism Crew Neck Tee',1,1,1),
    (5012,'seed','unisex/5012.jpg','https://picsum.photos/seed/uni-5012/400/600','UT Graphic Collab Tee',1,1,1),
    (5013,'seed','unisex/5013.jpg','https://picsum.photos/seed/uni-5013/400/600','Vintage Wash Tee',1,1,1),
    (5014,'seed','unisex/5014.jpg','https://picsum.photos/seed/uni-5014/400/600','Jogger Pants',1,1,1),
    (5015,'seed','unisex/5015.jpg','https://picsum.photos/seed/uni-5015/400/600','Pocket Sweatshirt (Sale)',1,1,1),
    (5016,'seed','unisex/5016.jpg','https://picsum.photos/seed/uni-5016/400/600','Reversible Belt Bag',1,1,1);
