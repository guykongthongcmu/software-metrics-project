const SUPPORTED_CAMPAIGN_TYPES = new Set([
  'BEST_SELLER',
  'PERCENTAGE_DISCOUNT',
  'FIXED_DISCOUNT',
]);
const SUPPORTED_LANGUAGES = new Set(['EN', 'TH']);

class CampaignHttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function parseLanguageCode(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return 'EN';
  }

  const normalized = String(rawValue).trim().toUpperCase();
  if (!SUPPORTED_LANGUAGES.has(normalized)) {
    throw new CampaignHttpError(400, 'INVALID_QUERY', 'lang must be EN or TH');
  }

  return normalized;
}

function createPlaceholders(values) {
  return values.map(() => '?').join(', ');
}

function formatDateOnly(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(rawValue) {
  if (typeof rawValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return null;
  }

  const [year, month, day] = rawValue.split('-').map((part) => Number.parseInt(part, 10));
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function normalizeDateTime(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function parseProductIds(rawProductIds) {
  if (!Array.isArray(rawProductIds) || rawProductIds.length === 0) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  const seen = new Set();
  const productIds = [];

  rawProductIds.forEach((entry) => {
    const parsed = Number.parseInt(entry, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
    }

    if (!seen.has(parsed)) {
      seen.add(parsed);
      productIds.push(parsed);
    }
  });

  if (productIds.length === 0) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  return productIds;
}

function validateCreateCampaignPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name || name.length > 150) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  const type = typeof payload.type === 'string' ? payload.type.trim().toUpperCase() : '';
  if (!SUPPORTED_CAMPAIGN_TYPES.has(type)) {
    throw new CampaignHttpError(
      400,
      'INVALID_CAMPAIGN_TYPE',
      'type must be one of: BEST_SELLER, PERCENTAGE_DISCOUNT, FIXED_DISCOUNT'
    );
  }

  const messageRaw = payload.message;
  const message =
    messageRaw === undefined || messageRaw === null || messageRaw === ''
      ? null
      : String(messageRaw).trim();
  if (message && message.length > 255) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  const startDateParsed = parseDateOnly(payload.startDate);
  const endDateParsed = parseDateOnly(payload.endDate);
  if (!startDateParsed || !endDateParsed || startDateParsed.getTime() > endDateParsed.getTime()) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  const startDate = formatDateOnly(startDateParsed);
  const endDate = formatDateOnly(endDateParsed);

  let discountValue = null;
  let productIds = [];

  if (type === 'PERCENTAGE_DISCOUNT' || type === 'FIXED_DISCOUNT') {
    const parsedDiscountValue = Number(payload.discountValue);
    if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
    }

    if (type === 'PERCENTAGE_DISCOUNT' && parsedDiscountValue > 100) {
      throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
    }

    discountValue = Number(parsedDiscountValue.toFixed(2));
    productIds = parseProductIds(payload.productIds);
  }

  if (type === 'BEST_SELLER') {
    if (!(payload.discountValue === undefined || payload.discountValue === null || payload.discountValue === '')) {
      throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
    }
    if (!(payload.productIds === undefined || payload.productIds === null || payload.productIds === '')) {
      throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
    }
  }

  return {
    name,
    type,
    message,
    startDate,
    endDate,
    discountValue,
    productIds,
  };
}

async function ensureProductsExist(connection, productIds) {
  const placeholders = createPlaceholders(productIds);
  const [rows] = await connection.execute(
    `SELECT product_id
     FROM products
     WHERE product_id IN (${placeholders})`,
    productIds
  );

  if (rows.length !== productIds.length) {
    throw new CampaignHttpError(404, 'PRODUCT_NOT_FOUND', 'one or more productIds were not found');
  }
}

async function resolveBestSellerProductId(connection) {
  const [rows] = await connection.execute(
    `SELECT
       pv.product_id,
       SUM(oi.quantity) AS sold_quantity
     FROM order_item oi
     INNER JOIN orders o
       ON o.order_id = oi.order_id
     INNER JOIN product_variant pv
       ON pv.product_variant_id = oi.product_variant_id
     INNER JOIN products p
       ON p.product_id = pv.product_id
     WHERE p.is_active = 1
       AND o.status IN ('PURCHASED', 'PROCESSING', 'SHIPPED', 'DELIVERED')
     GROUP BY pv.product_id
     ORDER BY sold_quantity DESC, pv.product_id ASC
     LIMIT 1`
  );

  const bestSeller = rows[0];
  if (!bestSeller) {
    throw new CampaignHttpError(400, 'VALIDATION_ERROR', 'invalid request data');
  }

  return Number(bestSeller.product_id);
}

async function createCampaign({ db, adminId, payload }) {
  const normalizedPayload = validateCreateCampaignPayload(payload);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    let mappedProductIds = [...normalizedPayload.productIds];

    if (normalizedPayload.type === 'BEST_SELLER') {
      mappedProductIds = [await resolveBestSellerProductId(connection)];
    } else {
      await ensureProductsExist(connection, mappedProductIds);
    }

    const [insertCampaignResult] = await connection.execute(
      `INSERT INTO campaigns (
         name,
         type,
         message,
         discount_value,
         status,
         start_date,
         end_date,
         created_by_admin_id
       )
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?)`,
      [
        normalizedPayload.name,
        normalizedPayload.type,
        normalizedPayload.message,
        normalizedPayload.discountValue,
        normalizedPayload.startDate,
        normalizedPayload.endDate,
        Number.isInteger(adminId) ? adminId : null,
      ]
    );

    const campaignId = Number(insertCampaignResult.insertId);

    if (mappedProductIds.length > 0) {
      const campaignProductPlaceholders = mappedProductIds.map(() => '(?, ?)').join(', ');
      const campaignProductParams = mappedProductIds.flatMap((productId) => [campaignId, productId]);
      await connection.execute(
        `INSERT INTO campaign_products (campaign_id, product_id)
         VALUES ${campaignProductPlaceholders}`,
        campaignProductParams
      );
    }

    if (
      normalizedPayload.type === 'PERCENTAGE_DISCOUNT' ||
      normalizedPayload.type === 'FIXED_DISCOUNT'
    ) {
      const discountType =
        normalizedPayload.type === 'PERCENTAGE_DISCOUNT' ? 'PERCENTAGE' : 'FIXED';
      const placeholders = createPlaceholders(mappedProductIds);
      await connection.execute(
        `UPDATE products
         SET campaign_discount_type = ?,
             campaign_discount_value = ?,
             campaign_discount_start_date = ?,
             campaign_discount_end_date = ?,
             campaign_discount_campaign_id = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE product_id IN (${placeholders})`,
        [
          discountType,
          normalizedPayload.discountValue,
          normalizedPayload.startDate,
          normalizedPayload.endDate,
          campaignId,
          ...mappedProductIds,
        ]
      );
    }

    const [campaignRows] = await connection.execute(
      `SELECT
         campaign_id,
         name,
         type,
         status,
         DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
         discount_value,
         created_at
       FROM campaigns
       WHERE campaign_id = ?
       LIMIT 1`,
      [campaignId]
    );

    await connection.commit();

    const campaign = campaignRows[0];
    return {
      campaignId: Number(campaign.campaign_id),
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      discountValue:
        campaign.discount_value == null ? null : normalizeMoney(campaign.discount_value),
      productIds: mappedProductIds,
      createdAt: normalizeDateTime(campaign.created_at),
    };
  } catch (error) {
    await connection.rollback();

    if (error instanceof CampaignHttpError) {
      throw error;
    }

    console.error(error);
    throw new CampaignHttpError(500, 'INTERNAL_SERVER_ERROR', 'internal server error');
  } finally {
    connection.release();
  }
}

async function fetchBestSellerProductSummary({ db, productIds, languageCode }) {
  if (!productIds || productIds.length === 0) {
    return new Map();
  }

  const placeholders = createPlaceholders(productIds);
  const [rows] = await db.execute(
    `SELECT
       p.product_id,
       COALESCE(
         pt_requested.name,
         pt_en.name,
         (
           SELECT pt_fallback.name
           FROM product_translation pt_fallback
           WHERE pt_fallback.product_id = p.product_id
           ORDER BY pt_fallback.product_translation_id ASC
           LIMIT 1
         )
       ) AS product_name,
       (
         SELECT pm.public_url
         FROM product_media pm
         WHERE pm.product_id = p.product_id
         ORDER BY
           CASE
             WHEN pm.is_hero = 1 THEN 0
             WHEN pm.is_thumbnail = 1 THEN 1
             ELSE 2
           END,
           pm.sort_order ASC,
           pm.product_media_id ASC
         LIMIT 1
       ) AS image_url
     FROM products p
     LEFT JOIN product_translation pt_requested
       ON pt_requested.product_id = p.product_id
       AND pt_requested.language_code = ?
     LEFT JOIN product_translation pt_en
       ON pt_en.product_id = p.product_id
       AND pt_en.language_code = 'EN'
     WHERE p.product_id IN (${placeholders})`,
    [languageCode, ...productIds]
  );

  const result = new Map();
  rows.forEach((row) => {
    result.set(Number(row.product_id), {
      productId: Number(row.product_id),
      name: row.product_name || null,
      image: row.image_url || null,
    });
  });

  return result;
}

async function listActiveCampaigns({ db, languageCode = 'EN', now = new Date() }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode);
  const today = formatDateOnly(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  );

  const [campaignRows] = await db.execute(
    `SELECT
       campaign_id,
       name,
       type,
       message,
       DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
       DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
       discount_value
     FROM campaigns
     WHERE status = 'ACTIVE'
       AND start_date <= ?
       AND end_date >= ?
     ORDER BY start_date DESC, campaign_id DESC`,
    [today, today]
  );

  if (campaignRows.length === 0) {
    return { campaigns: [] };
  }

  const campaignIds = campaignRows.map((row) => Number(row.campaign_id));
  const mappingPlaceholders = createPlaceholders(campaignIds);
  const [campaignProductRows] = await db.execute(
    `SELECT campaign_id, product_id
     FROM campaign_products
     WHERE campaign_id IN (${mappingPlaceholders})
     ORDER BY campaign_id ASC, campaign_product_id ASC`,
    campaignIds
  );

  const campaignProductsMap = new Map();
  campaignIds.forEach((campaignId) => {
    campaignProductsMap.set(campaignId, []);
  });

  campaignProductRows.forEach((row) => {
    const campaignId = Number(row.campaign_id);
    if (campaignProductsMap.has(campaignId)) {
      campaignProductsMap.get(campaignId).push(Number(row.product_id));
    }
  });

  const bestSellerProductIds = [];
  campaignRows.forEach((row) => {
    if (row.type === 'BEST_SELLER') {
      const mapped = campaignProductsMap.get(Number(row.campaign_id)) || [];
      if (mapped[0]) {
        bestSellerProductIds.push(mapped[0]);
      }
    }
  });

  const bestSellerSummaryMap = await fetchBestSellerProductSummary({
    db,
    productIds: [...new Set(bestSellerProductIds)],
    languageCode: normalizedLanguageCode,
  });

  const campaigns = campaignRows.map((row) => {
    const campaignId = Number(row.campaign_id);
    const commonPayload = {
      campaignId,
      name: row.name,
      type: row.type,
      message: row.message,
      startDate: row.start_date,
      endDate: row.end_date,
    };

    if (row.type === 'BEST_SELLER') {
      const productIds = campaignProductsMap.get(campaignId) || [];
      return {
        ...commonPayload,
        bestSellerProduct: productIds[0]
          ? bestSellerSummaryMap.get(productIds[0]) || {
              productId: productIds[0],
              name: null,
              image: null,
            }
          : null,
      };
    }

    return {
      ...commonPayload,
      discount: {
        type: row.type === 'PERCENTAGE_DISCOUNT' ? 'PERCENTAGE' : 'FIXED',
        value: normalizeMoney(row.discount_value),
      },
      productIds: campaignProductsMap.get(campaignId) || [],
    };
  });

  return { campaigns };
}

module.exports = {
  CampaignHttpError,
  createCampaign,
  listActiveCampaigns,
  parseLanguageCode,
};
