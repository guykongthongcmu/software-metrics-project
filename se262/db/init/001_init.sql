CREATE DATABASE IF NOT EXISTS core_co
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE core_co;

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  phone_number VARCHAR(30) NOT NULL,
  preferred_language ENUM('TH', 'EN') NOT NULL DEFAULT 'EN',
  email_verified_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  email_verification_token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL, -- varchar(255) for raw tokens but change to 64 if you're going to change to SHA256 hash okay mai future guy
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL, -- null because it means not used yet, timestamp means using currently
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (email_verification_token_id),
  UNIQUE KEY uq_email_verification_tokens (token),
  KEY idx_user_created(user_id, created_at), -- use composite index so that finding most latest user_id is going to be fast O(log n) vs full table scan O(n)
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE -- cascade is like delete from parent table deletes child table too
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  password_reset_token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (password_reset_token_id),
  UNIQUE KEY uq_password_reset_tokens (token),
  KEY idx_password_reset_user_created (user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin (
  admin_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
  session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  admin_id BIGINT UNSIGNED NULL,
  subject_type ENUM('USER', 'ADMIN') NOT NULL,
  session_token VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  UNIQUE KEY uq_session_tokens (session_token),
  KEY idx_session_created(user_id, created_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON DELETE CASCADE,
  CONSTRAINT chk_sessions_exactly_one_owner CHECK (
  (subject_type = 'USER'  AND user_id IS NOT NULL AND admin_id IS NULL) OR
  (subject_type = 'ADMIN' AND admin_id IS NOT NULL AND user_id IS NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS category (
  category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_category_id BIGINT UNSIGNED NULL,
  category_name VARCHAR(100) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_slug (slug),
  KEY idx_category_parent_name (parent_category_id, category_name),
  KEY idx_category_hidden_name (is_hidden, category_name),
  FOREIGN KEY (parent_category_id) REFERENCES category(category_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS category_translation (
  category_translation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id BIGINT UNSIGNED NOT NULL,
  language_code ENUM('TH', 'EN') NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (category_translation_id),
  UNIQUE KEY uq_category_language (category_id, language_code),
  KEY idx_language_name (language_code, name),

  CONSTRAINT fk_category_translation_category
    FOREIGN KEY (category_id) REFERENCES category(category_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_type ENUM('TOP', 'BOTTOM', 'ACCESSORY') NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  campaign_discount_type ENUM('PERCENTAGE', 'FIXED') NULL,
  campaign_discount_value DECIMAL(10,2) NULL,
  campaign_discount_start_date DATE NULL,
  campaign_discount_end_date DATE NULL,
  campaign_discount_campaign_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_products_campaign_discount_campaign_id (campaign_discount_campaign_id),
  CONSTRAINT chk_products_campaign_discount_value_positive
    CHECK (campaign_discount_value IS NULL OR campaign_discount_value > 0),
  CONSTRAINT chk_products_campaign_discount_dates
    CHECK (
      campaign_discount_start_date IS NULL OR
      campaign_discount_end_date IS NULL OR
      campaign_discount_start_date <= campaign_discount_end_date
    ),
  KEY idx_product_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_translation (
  product_translation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  language_code ENUM('TH', 'EN') NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (product_translation_id),
  UNIQUE KEY uq_product_language (product_id, language_code),
  KEY idx_language_name (language_code, name),

  CONSTRAINT fk_product_translation_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_category (
  product_category_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT 0,

  PRIMARY KEY (product_category_id),
  UNIQUE KEY uq_product_category (product_id, category_id),
  UNIQUE KEY uq_product_primary_category ((CASE WHEN is_primary = 1 THEN product_id ELSE NULL END)),
  KEY idx_pc_product (product_id),
  KEY idx_pc_category (category_id),
  KEY idx_pc_product_primary (product_id, is_primary),

  CONSTRAINT fk_pc_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pc_category
    FOREIGN KEY (category_id) REFERENCES category(category_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_variant (
  product_variant_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  sku_code VARCHAR(100) NOT NULL,
  colour VARCHAR(100) NOT NULL,
  size VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2) NULL,
  stock_qty INT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_variant_id),
  UNIQUE KEY uq_sku_code (sku_code),
  UNIQUE KEY uq_product_colour_size (product_id, colour, size),
  CONSTRAINT fk_product_variant
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_variant_attribute (
  product_variant_attribute_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  attr_key VARCHAR(100) NOT NULL,
  attr_value VARCHAR(100) NOT NULL,
  unit VARCHAR(100) NULL,
  PRIMARY KEY (product_variant_attribute_id),
  UNIQUE KEY uq_variant_attr_key (product_variant_id, attr_key),
  CONSTRAINT fk_variant_attr
    FOREIGN KEY (product_variant_id) REFERENCES product_variant(product_variant_id)
    ON DELETE CASCADE 
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_media (
  product_media_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  bucket_name VARCHAR(100) NOT NULL,
  file_path VARCHAR (512) NOT NULL,
  public_url VARCHAR (2048) NOT NULL,
  alt_text VARCHAR(255) NULL,
  sort_order INT UNSIGNED NOT NULL,
  is_thumbnail BOOLEAN NOT NULL DEFAULT 0,
  is_hero BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_media_id),
  KEY idx_product_sort (product_id, sort_order),
  UNIQUE KEY uq_product_sort_order (product_id, sort_order),
  UNIQUE KEY uq_product_one_thumbnail ((CASE WHEN is_thumbnail = 1 THEN product_id ELSE NULL END)),
  UNIQUE KEY uq_product_one_hero ((CASE WHEN is_hero = 1 THEN product_id ELSE NULL END)),
  CONSTRAINT chk_product_media_sort_order CHECK (sort_order BETWEEN 1 AND 4),
  CONSTRAINT fk_product_media
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  type ENUM('BEST_SELLER', 'PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT') NOT NULL,
  message VARCHAR(255) NULL,
  discount_value DECIMAL(10,2) NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (campaign_id),
  KEY idx_campaigns_status_date (status, start_date, end_date),
  KEY idx_campaigns_type (type),
  KEY idx_campaigns_created_by_admin_id (created_by_admin_id),
  CONSTRAINT chk_campaigns_discount_rules CHECK (
    (
      type = 'BEST_SELLER' AND
      discount_value IS NULL
    ) OR (
      type IN ('PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT') AND
      discount_value IS NOT NULL AND
      discount_value > 0
    )
  ),
  CONSTRAINT chk_campaigns_date_range CHECK (start_date <= end_date),
  CONSTRAINT fk_campaigns_created_by_admin
    FOREIGN KEY (created_by_admin_id) REFERENCES admin(admin_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaign_products (
  campaign_product_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (campaign_product_id),
  UNIQUE KEY uq_campaign_products_campaign_product (campaign_id, product_id),
  KEY idx_campaign_products_product_id (product_id),
  CONSTRAINT fk_campaign_products_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_campaign_products_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart (
  cart_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('ACTIVE', 'CONVERTED', 'ABANDONED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_id),
  UNIQUE KEY uq_one_active_cart_per_user ((CASE WHEN status = 'ACTIVE' THEN user_id ELSE NULL END)),
  KEY idx_cart_user_id (user_id),
  KEY idx_cart_status (status),
  CONSTRAINT fk_cart_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS cart_item (
  cart_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cart_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (cart_item_id),
  UNIQUE KEY uq_cart_variant (cart_id, product_variant_id),
  KEY idx_cart_item_cart_id (cart_id),
  KEY idx_cart_item_product_variant_id (product_variant_id),
  CONSTRAINT fk_cart_item_cart
    FOREIGN KEY (cart_id) REFERENCES cart(cart_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cart_item_product_variant
    FOREIGN KEY (product_variant_id) REFERENCES product_variant(product_variant_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_cart_item_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS wishlist (
  wishlist_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (wishlist_id),
  UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
  KEY idx_wishlist_user_id (user_id),
  KEY idx_wishlist_product_id (product_id),
  CONSTRAINT fk_wishlist_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS address (
  address_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255) NULL,
  district VARCHAR(120) NOT NULL,
  province VARCHAR(120) NOT NULL,
  postcode VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Thailand',
  is_default_shipping BOOLEAN NOT NULL DEFAULT 0,
  is_default_billing BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (address_id),
  KEY idx_address_user_id (user_id),
  UNIQUE KEY uq_address_default_shipping_per_user ((CASE WHEN is_default_shipping = 1 THEN user_id ELSE NULL END)),
  UNIQUE KEY uq_address_default_billing_per_user ((CASE WHEN is_default_billing = 1 THEN user_id ELSE NULL END)),
  CONSTRAINT fk_address_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  order_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  shipping_address_id BIGINT UNSIGNED NULL,
  billing_address_id BIGINT UNSIGNED NULL,
  status ENUM('PURCHASED') NOT NULL DEFAULT 'PURCHASED',
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  vat_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  shipping_address_snapshot TEXT NULL,
  billing_address_snapshot TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  KEY idx_orders_user_id (user_id),
  KEY idx_orders_status_created (status, created_at),
  KEY idx_orders_shipping_address_id (shipping_address_id),
  KEY idx_orders_billing_address_id (billing_address_id),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_shipping_address
    FOREIGN KEY (shipping_address_id) REFERENCES address(address_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_orders_billing_address
    FOREIGN KEY (billing_address_id) REFERENCES address(address_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_item (
  order_item_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_variant_id BIGINT UNSIGNED NULL,
  snapshot_product_name VARCHAR(255) NOT NULL,
  snapshot_color VARCHAR(100) NULL,
  snapshot_size VARCHAR(40) NULL,
  snapshot_unit_price DECIMAL(10,2) NOT NULL,
  snapshot_compare_at_price DECIMAL(10,2) NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (order_item_id),
  KEY idx_order_item_order_id (order_id),
  KEY idx_order_item_product_variant_id (product_variant_id),
  CONSTRAINT fk_order_item_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_item_product_variant
    FOREIGN KEY (product_variant_id) REFERENCES product_variant(product_variant_id)
    ON DELETE SET NULL,
  CONSTRAINT chk_order_item_quantity_positive CHECK (quantity > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS receipt (
  receipt_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  receipt_number VARCHAR(100) NOT NULL,
  status ENUM('ISSUED', 'SENT', 'VOID') NOT NULL DEFAULT 'ISSUED',
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'THB',
  delivery_method ENUM('EMAIL', 'DOWNLOAD') NOT NULL DEFAULT 'EMAIL',
  file_url VARCHAR(2048) NULL,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  PRIMARY KEY (receipt_id),
  UNIQUE KEY uq_receipt_number (receipt_number),
  KEY idx_receipt_order_id (order_id),
  CONSTRAINT fk_receipt_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS receipt_email_log (
  receipt_email_log_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_id BIGINT UNSIGNED NOT NULL,
  to_email VARCHAR(255) NOT NULL,
  status ENUM('QUEUED', 'SENT', 'FAILED') NOT NULL DEFAULT 'QUEUED',
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (receipt_email_log_id),
  KEY idx_receipt_email_log_receipt_id (receipt_id),
  CONSTRAINT fk_receipt_email_log_receipt
    FOREIGN KEY (receipt_id) REFERENCES receipt(receipt_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS review (
  review_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  verified_purchase BOOLEAN NOT NULL DEFAULT 0,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  status ENUM('VISIBLE', 'HIDDEN', 'DELETED') NOT NULL DEFAULT 'VISIBLE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (review_id),
  KEY idx_review_product_id (product_id),
  KEY idx_review_user_id (user_id),
  KEY idx_review_status_created (status, created_at),
  CONSTRAINT fk_review_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT chk_review_rating_range CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS review_media (
  review_media_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(2048) NOT NULL,
  media_type ENUM('image', 'video') NOT NULL DEFAULT 'image',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (review_media_id),
  KEY idx_review_media_review_id (review_id),
  CONSTRAINT fk_review_media_review
    FOREIGN KEY (review_id) REFERENCES review(review_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS review_reply (
  review_reply_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  reply_text TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_reply_id),
  KEY idx_review_reply_review_id (review_id),
  KEY idx_review_reply_admin_id (admin_id),
  CONSTRAINT fk_review_reply_review
    FOREIGN KEY (review_id) REFERENCES review(review_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_reply_admin
    FOREIGN KEY (admin_id) REFERENCES admin(admin_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS review_like (
  review_like_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (review_like_id),
  UNIQUE KEY uq_review_like_review_admin (review_id, admin_id),
  KEY idx_review_like_review_id (review_id),
  KEY idx_review_like_admin_id (admin_id),
  CONSTRAINT fk_review_like_review
    FOREIGN KEY (review_id) REFERENCES review(review_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_review_like_admin
    FOREIGN KEY (admin_id) REFERENCES admin(admin_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS conversation (
  conversation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id),
  KEY idx_conversation_user_id (user_id),
  KEY idx_conversation_status_updated (status, updated_at),
  CONSTRAINT fk_conversation_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS message (
  message_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_type ENUM('USER', 'ADMIN') NOT NULL,
  sender_user_id BIGINT UNSIGNED NULL,
  sender_admin_id BIGINT UNSIGNED NULL,
  message_text TEXT NOT NULL,
  message_type ENUM('TEXT', 'IMAGE') NOT NULL DEFAULT 'TEXT',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (message_id),
  KEY idx_message_conversation_created (conversation_id, created_at),
  KEY idx_message_sender_user_id (sender_user_id),
  KEY idx_message_sender_admin_id (sender_admin_id),
  KEY idx_message_read_at (read_at),
  CONSTRAINT fk_message_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_message_sender_user
    FOREIGN KEY (sender_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_message_sender_admin
    FOREIGN KEY (sender_admin_id) REFERENCES admin(admin_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS analytics_event (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  session_id VARCHAR(255) NULL,
  event_type ENUM(
    'PURCHASE',
    'PRODUCT_VIEW',
    'PRODUCT_COMMENT',
    'PRODUCT_LIKE',
    'SEARCH',
    'WISHLIST',
    'CART',
    'CHECKOUT_ATTEMPT',
    'REVIEW_INTERACTION'
  ) NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  product_variant_id BIGINT UNSIGNED NULL,
  cart_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  review_id BIGINT UNSIGNED NULL,
  search_query VARCHAR(255) NULL,
  event_count INT UNSIGNED NOT NULL DEFAULT 1,
  event_value DECIMAL(12,2) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  KEY idx_analytics_event_type_created (event_type, created_at),
  KEY idx_analytics_product_event_created (product_id, event_type, created_at),
  KEY idx_analytics_user_created (user_id, created_at),
  KEY idx_analytics_order_id (order_id),
  KEY idx_analytics_review_id (review_id),
  CONSTRAINT fk_analytics_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_analytics_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_analytics_product_variant
    FOREIGN KEY (product_variant_id) REFERENCES product_variant(product_variant_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_analytics_cart
    FOREIGN KEY (cart_id) REFERENCES cart(cart_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_analytics_order
    FOREIGN KEY (order_id) REFERENCES orders(order_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_analytics_review
    FOREIGN KEY (review_id) REFERENCES review(review_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
