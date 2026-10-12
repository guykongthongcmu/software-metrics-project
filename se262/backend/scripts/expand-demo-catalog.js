#!/usr/bin/env node

require('dotenv').config();

const db = require('../src/config/db');
const {
  ADDITIONAL_TOP_LEVEL_CATEGORIES,
  EXISTING_TOP_LEVEL_ASSIGNMENTS,
  EXPANDED_DEMO_PRODUCTS,
} = require('./demo-catalog-data');

function createPlaceholders(items) {
  return items.map(() => '?').join(', ');
}

async function main() {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const productIds = EXPANDED_DEMO_PRODUCTS.map((product) => product.productId);

    if (productIds.length > 0) {
      await connection.query(
        `DELETE FROM products
         WHERE product_id IN (${createPlaceholders(productIds)})`,
        productIds
      );
    }

    for (const category of ADDITIONAL_TOP_LEVEL_CATEGORIES) {
      await connection.execute(
        `INSERT INTO category
          (category_id, parent_category_id, category_name, slug, is_hidden)
         VALUES (?, NULL, ?, ?, 0)
         ON DUPLICATE KEY UPDATE
          category_name = VALUES(category_name),
          slug = VALUES(slug),
          is_hidden = VALUES(is_hidden)`,
        [category.categoryId, category.categoryName, category.slug]
      );

      for (const [languageCode, name] of Object.entries(category.translations)) {
        await connection.execute(
          `INSERT INTO category_translation (category_id, language_code, name)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
            name = VALUES(name)`,
          [category.categoryId, languageCode, name]
        );
      }
    }

    for (const assignment of EXISTING_TOP_LEVEL_ASSIGNMENTS) {
      await connection.execute(
        `INSERT IGNORE INTO product_category (product_id, category_id, is_primary)
         VALUES (?, ?, 0)`,
        [assignment.productId, assignment.categoryId]
      );
    }

    for (const product of EXPANDED_DEMO_PRODUCTS) {
      await connection.execute(
        `INSERT INTO products
          (product_id, product_type, is_active, created_at, updated_at)
         VALUES (?, ?, 1, ?, ?)`,
        [product.productId, product.productType, product.createdAt, product.updatedAt]
      );

      await connection.execute(
        `INSERT INTO product_translation (product_id, language_code, name, description)
         VALUES
          (?, 'EN', ?, ?),
          (?, 'TH', ?, ?)`,
        [
          product.productId,
          product.nameEn,
          product.descriptionEn,
          product.productId,
          product.nameTh,
          product.descriptionTh,
        ]
      );

      await connection.execute(
        `INSERT INTO product_category (product_id, category_id, is_primary)
         VALUES (?, ?, 1)`,
        [product.productId, product.categoryId]
      );

      for (const variant of product.variants) {
        await connection.execute(
          `INSERT INTO product_variant
            (
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
            )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            variant.productVariantId,
            product.productId,
            variant.skuCode,
            variant.colour,
            variant.size,
            variant.price,
            variant.compareAtPrice,
            variant.stockQty,
            variant.createdAt,
            variant.updatedAt,
          ]
        );
      }
    }

    await connection.commit();

    console.log(
      `Expanded demo catalog seeded successfully: ${EXPANDED_DEMO_PRODUCTS.length} products`
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
