USE core_co;

-- Backfill legacy order statuses to PURCHASED for existing databases.
UPDATE orders
SET status = 'PURCHASED'
WHERE status IN ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- Normalize the status model to PURCHASED only.
ALTER TABLE orders
  MODIFY COLUMN status ENUM('PURCHASED') NOT NULL DEFAULT 'PURCHASED';
