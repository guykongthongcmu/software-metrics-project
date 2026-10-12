#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const db = require('../src/config/db');
const { EXPANDED_DEMO_PRODUCTS } = require('./demo-catalog-data');

const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const DEFAULT_BUCKET = process.env.SUPABASE_PRODUCT_BUCKET || 'product-images';
const ASSETS_DIR = path.resolve(__dirname, '../../db/webstore-assets');

const PRODUCT_IMAGE_MAP = [
  {
    productId: 1001,
    name: 'Premium Linen Shirt',
    sourceFile: 'linen_shirt.jpg',
  },
  {
    productId: 1002,
    name: 'Oxford Button Shirt',
    sourceFile: 'men-polo.jpg',
  },
  {
    productId: 1003,
    name: 'Classic Cotton Tee',
    sourceFile: 'men-tshirt.jpg',
  },
  {
    productId: 1004,
    name: 'Cargo Trousers',
    sourceFile: 'men-pants.jpg',
  },
  {
    productId: 1005,
    name: 'Pleated Midi Skirt',
    sourceFile: 'women-dress.jpg',
  },
  {
    productId: 1006,
    name: 'Silk Blend Blouse',
    sourceFile: 'women-polo.jpg',
  },
  {
    productId: 1007,
    name: 'Denim Work Jacket',
    sourceFile: 'men-outer.jpg',
  },
  {
    productId: 1008,
    name: 'Straight Fit Jeans',
    sourceFile: 'women-bottoms.jpg',
  },
  {
    productId: 1009,
    name: 'Classic Leather Belt',
    sourceFile: 'men-acc.jpg',
  },
  {
    productId: 1010,
    name: 'Canvas Tote Bag',
    sourceFile: 'unisex-bags.jpg',
  },
  {
    productId: 1011,
    name: 'Running Shorts',
    sourceFile: 'men-sport.jpg',
  },
  {
    productId: 1012,
    name: 'Knit Cardigan',
    sourceFile: 'knitted_sweater.png',
  },
  ...EXPANDED_DEMO_PRODUCTS.map((product) => ({
    productId: product.productId,
    name: product.nameEn,
    sourceFile: product.assetFile,
  })),
];

function ensureEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function ensureSourceFile(sourceFile) {
  const sourcePath = path.join(ASSETS_DIR, sourceFile);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source asset: ${sourcePath}`);
  }

  return sourcePath;
}

function runSips(args) {
  const result = spawnSync('/usr/bin/sips', args, {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `sips failed with code ${result.status}`);
  }
}

function prepareUploadBuffer(sourcePath, productId) {
  const initialStats = fs.statSync(sourcePath);

  if (initialStats.size <= MAX_UPLOAD_BYTES && sourcePath.toLowerCase().endsWith('.jpg')) {
    return {
      buffer: fs.readFileSync(sourcePath),
      tempPath: null,
    };
  }

  const tempPath = path.join(os.tmpdir(), `coreco-seed-${productId}-${Date.now()}.jpg`);

  runSips([
    sourcePath,
    '--resampleHeightWidthMax',
    '1800',
    '--setProperty',
    'format',
    'jpeg',
    '--out',
    tempPath,
  ]);

  const resizedStats = fs.statSync(tempPath);

  if (resizedStats.size > MAX_UPLOAD_BYTES) {
    runSips([
      tempPath,
      '--resampleHeightWidthMax',
      '1200',
      '--out',
      tempPath,
    ]);
  }

  const finalStats = fs.statSync(tempPath);
  if (finalStats.size > MAX_UPLOAD_BYTES) {
    fs.unlinkSync(tempPath);
    throw new Error(
      `Optimized file for product ${productId} is still too large (${finalStats.size} bytes)`
    );
  }

  return {
    buffer: fs.readFileSync(tempPath),
    tempPath,
  };
}

async function uploadProductMedia(supabase, bucketName, entry) {
  const sourcePath = ensureSourceFile(entry.sourceFile);
  const { buffer, tempPath } = prepareUploadBuffer(sourcePath, entry.productId);

  try {
    const heroPath = `products/${entry.productId}/hero.jpg`;
    const thumbPath = `products/${entry.productId}/thumb.jpg`;

    const heroResult = await supabase.storage.from(bucketName).upload(heroPath, buffer, {
      upsert: true,
      contentType: 'image/jpeg',
    });

    if (heroResult.error) {
      throw new Error(`Failed uploading ${heroPath}: ${heroResult.error.message}`);
    }

    const thumbResult = await supabase.storage.from(bucketName).upload(thumbPath, buffer, {
      upsert: true,
      contentType: 'image/jpeg',
    });

    if (thumbResult.error) {
      throw new Error(`Failed uploading ${thumbPath}: ${thumbResult.error.message}`);
    }

    return {
      productId: entry.productId,
      name: entry.name,
      sourceFile: entry.sourceFile,
      heroPath,
      thumbPath,
    };
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

async function syncProductMediaRows(bucketName, publicBaseUrl, uploadedEntries) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const productIds = uploadedEntries.map((entry) => entry.productId);
    const placeholders = productIds.map(() => '?').join(', ');

    await connection.query(
      `DELETE FROM product_media
       WHERE product_id IN (${placeholders})`,
      productIds
    );

    const values = [];
    const rows = [];

    uploadedEntries.forEach((entry) => {
      rows.push('(?, ?, ?, ?, ?, ?, ?, ?)');
      values.push(
        entry.productId,
        bucketName,
        entry.heroPath,
        `${publicBaseUrl}/${entry.heroPath}`,
        `${entry.name} hero`,
        1,
        0,
        1
      );
      rows.push('(?, ?, ?, ?, ?, ?, ?, ?)');
      values.push(
        entry.productId,
        bucketName,
        entry.thumbPath,
        `${publicBaseUrl}/${entry.thumbPath}`,
        `${entry.name} thumbnail`,
        2,
        1,
        0
      );
    });

    await connection.query(
      `INSERT INTO product_media
        (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero)
       VALUES ${rows.join(', ')}`,
      values
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  const supabaseUrl = ensureEnv('SUPABASE_URL');
  const supabaseSecretKey = ensureEnv('SUPABASE_SECRET_KEY');
  const bucketName = DEFAULT_BUCKET;
  const publicBaseUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}`;

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const uploadedEntries = [];

  for (const entry of PRODUCT_IMAGE_MAP) {
    const uploadedEntry = await uploadProductMedia(supabase, bucketName, entry);
    uploadedEntries.push(uploadedEntry);
    console.log(`synced product ${entry.productId} -> ${entry.sourceFile}`);
  }

  await syncProductMediaRows(bucketName, publicBaseUrl, uploadedEntries);
  await db.end();

  console.log(`completed demo media sync for ${uploadedEntries.length} products`);
}

main().catch(async (error) => {
  console.error(error.message || error);
  try {
    await db.end();
  } catch (_error) {
    // Nothing to do if the pool was never opened cleanly.
  }
  process.exit(1);
});
