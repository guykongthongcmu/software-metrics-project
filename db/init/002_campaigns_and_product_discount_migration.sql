USE core_co;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS campaign_discount_type ENUM('PERCENTAGE', 'FIXED') NULL AFTER is_active,
  ADD COLUMN IF NOT EXISTS campaign_discount_value DECIMAL(10,2) NULL AFTER campaign_discount_type,
  ADD COLUMN IF NOT EXISTS campaign_discount_start_date DATE NULL AFTER campaign_discount_value,
  ADD COLUMN IF NOT EXISTS campaign_discount_end_date DATE NULL AFTER campaign_discount_start_date,
  ADD COLUMN IF NOT EXISTS campaign_discount_campaign_id BIGINT UNSIGNED NULL AFTER campaign_discount_end_date;

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
