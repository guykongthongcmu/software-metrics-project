USE core_co;
SET NAMES utf8mb4;

-- Media backfill template for the demo seed.
-- This file is intentionally separate because 001_seed_demo_no_media.sql seeds without product_media rows.
--
-- Local image source (as provided):
--   db/webstore-assets/
--
-- Suggested storage keys in Supabase bucket `product-images`:
--   products/<product_id>/hero.webp
--   products/<product_id>/thumb.webp
--
-- Steps:
-- 1) Upload files from db/webstore-assets to Supabase bucket `product-images`.
-- 2) Set @PUBLIC_BASE_URL below to your public object base path.
-- 3) Run this file to link uploaded media into product_media.

SET @BUCKET_NAME = 'product-images';
SET @PUBLIC_BASE_URL = 'https://<your-project-ref>.supabase.co/storage/v1/object/public/product-images';

START TRANSACTION;

INSERT INTO product_media (
  product_id,
  bucket_name,
  file_path,
  public_url,
  alt_text,
  sort_order,
  is_thumbnail,
  is_hero
) VALUES
  (1001, @BUCKET_NAME, 'products/1001/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1001/hero.webp'), 'Premium Linen Shirt hero', 1, 0, 1),
  (1001, @BUCKET_NAME, 'products/1001/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1001/thumb.webp'), 'Premium Linen Shirt thumbnail', 2, 1, 0),
  (1002, @BUCKET_NAME, 'products/1002/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1002/hero.webp'), 'Oxford Button Shirt hero', 1, 0, 1),
  (1002, @BUCKET_NAME, 'products/1002/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1002/thumb.webp'), 'Oxford Button Shirt thumbnail', 2, 1, 0),
  (1003, @BUCKET_NAME, 'products/1003/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1003/hero.webp'), 'Classic Cotton Tee hero', 1, 0, 1),
  (1003, @BUCKET_NAME, 'products/1003/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1003/thumb.webp'), 'Classic Cotton Tee thumbnail', 2, 1, 0),
  (1004, @BUCKET_NAME, 'products/1004/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1004/hero.webp'), 'Cargo Trousers hero', 1, 0, 1),
  (1004, @BUCKET_NAME, 'products/1004/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1004/thumb.webp'), 'Cargo Trousers thumbnail', 2, 1, 0),
  (1005, @BUCKET_NAME, 'products/1005/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1005/hero.webp'), 'Pleated Midi Skirt hero', 1, 0, 1),
  (1005, @BUCKET_NAME, 'products/1005/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1005/thumb.webp'), 'Pleated Midi Skirt thumbnail', 2, 1, 0),
  (1006, @BUCKET_NAME, 'products/1006/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1006/hero.webp'), 'Silk Blend Blouse hero', 1, 0, 1),
  (1006, @BUCKET_NAME, 'products/1006/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1006/thumb.webp'), 'Silk Blend Blouse thumbnail', 2, 1, 0),
  (1007, @BUCKET_NAME, 'products/1007/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1007/hero.webp'), 'Denim Work Jacket hero', 1, 0, 1),
  (1007, @BUCKET_NAME, 'products/1007/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1007/thumb.webp'), 'Denim Work Jacket thumbnail', 2, 1, 0),
  (1008, @BUCKET_NAME, 'products/1008/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1008/hero.webp'), 'Straight Fit Jeans hero', 1, 0, 1),
  (1008, @BUCKET_NAME, 'products/1008/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1008/thumb.webp'), 'Straight Fit Jeans thumbnail', 2, 1, 0),
  (1009, @BUCKET_NAME, 'products/1009/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1009/hero.webp'), 'Classic Leather Belt hero', 1, 0, 1),
  (1009, @BUCKET_NAME, 'products/1009/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1009/thumb.webp'), 'Classic Leather Belt thumbnail', 2, 1, 0),
  (1010, @BUCKET_NAME, 'products/1010/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1010/hero.webp'), 'Canvas Tote Bag hero', 1, 0, 1),
  (1010, @BUCKET_NAME, 'products/1010/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1010/thumb.webp'), 'Canvas Tote Bag thumbnail', 2, 1, 0),
  (1011, @BUCKET_NAME, 'products/1011/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1011/hero.webp'), 'Running Shorts hero', 1, 0, 1),
  (1011, @BUCKET_NAME, 'products/1011/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1011/thumb.webp'), 'Running Shorts thumbnail', 2, 1, 0),
  (1012, @BUCKET_NAME, 'products/1012/hero.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1012/hero.webp'), 'Knit Cardigan hero', 1, 0, 1),
  (1012, @BUCKET_NAME, 'products/1012/thumb.webp', CONCAT(@PUBLIC_BASE_URL, '/products/1012/thumb.webp'), 'Knit Cardigan thumbnail', 2, 1, 0);

COMMIT;
