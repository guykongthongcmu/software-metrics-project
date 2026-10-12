USE core_co;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'core_co'
    AND table_name = 'category'
    AND column_name = 'is_hidden'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE category ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT 0 AFTER slug',
  'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
