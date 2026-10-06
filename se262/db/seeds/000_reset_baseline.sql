USE core_co;

START TRANSACTION;

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

COMMIT;
