const express = require('express');
const multer = require('multer');

const db = require('../config/db');
const supabase = require('../config/supabase');
const {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  ProductHttpError,
  createProduct,
  deleteAdminProduct,
  getProductDetail,
  listAdminProducts,
  listProductImages,
  parseBooleanLike,
  parseLanguageCode,
  parseSortOrder,
  updateAdminProduct,
  uploadProductImage,
} = require('../modules/products/product.service');

const DEFAULT_BUCKET_NAME = process.env.SUPABASE_PRODUCT_BUCKET || 'product-images';
const ADMIN_PRODUCTS_PAGE_DEFAULT = 1;
const ADMIN_PRODUCTS_LIMIT_DEFAULT = 20;
const ADMIN_PRODUCTS_LIMIT_MAX = 100;

function sendError(res, statusCode, errorCode, message, details) {
  const payload = {
    status: 'error',
    code: errorCode,
    error: errorCode,
    message,
  };
  if (details) {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

function handleRouteError(res, error) {
  // Global Architectural Observability: Trace the crash vector
  console.error('[CORE_DASHBOARD_ERROR_WATCHER]', error);

  if (error instanceof ProductHttpError) {
    return sendError(res, error.statusCode, error.errorCode, error.message, error.details);
  }

  // Handle unmanaged Infrastructure Failures (DB, Storage, environmental)
  return res.status(500).json({
    status: 'error',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    message: error.message || 'Deep-tier architectural failure',
    details: error.details || error,
    stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
  });
}

function createMulterUpload() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: MAX_IMAGES_PER_PRODUCT,
    },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        const error = new Error('Unsupported image file type');
        error.code = 'INVALID_FILE_TYPE';
        cb(error);
        return;
      }

      cb(null, true);
    },
  });
}

function handleUploadError(res, uploadError) {
  if (!uploadError) {
    return null;
  }

  if (uploadError instanceof multer.MulterError) {
    if (uploadError.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'Image must be smaller than 5MB');
    }

    if (uploadError.code === 'LIMIT_FILE_COUNT' || uploadError.code === 'LIMIT_UNEXPECTED_FILE') {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        {
          media: `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`,
        }
      );
    }
  }

  if (uploadError.code === 'INVALID_FILE_TYPE') {
    return sendError(
      res,
      400,
      'INVALID_FILE_TYPE',
      'Only JPG, JPEG, PNG, and WEBP files are allowed'
    );
  }

  return sendError(res, 400, 'INVALID_REQUEST', 'Invalid image upload request');
}

function parseStructuredField(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw new ProductHttpError(400, 'INVALID_JSON', `Invalid JSON in ${fieldName}`);
  }
}

function parseCreatePayload(req) {
  const payloadField = req.body?.payload;
  if (payloadField !== undefined) {
    const parsedPayload = parseStructuredField(payloadField, 'payload');
    if (!parsedPayload || typeof parsedPayload !== 'object' || Array.isArray(parsedPayload)) {
      throw new ProductHttpError(400, 'INVALID_JSON', 'payload must be a JSON object');
    }
    return parsedPayload;
  }

  return {
    ...req.body,
    translations: parseStructuredField(req.body?.translations, 'translations'),
    categories: parseStructuredField(req.body?.categories, 'categories'),
    variants: parseStructuredField(req.body?.variants, 'variants'),
    media: parseStructuredField(req.body?.media, 'media'),
  };
}

function normalizeProductId(rawValue) {
  const productId = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new ProductHttpError(
      400,
      'INVALID_PRODUCT_ID',
      'productId must be a positive integer'
    );
  }

  return productId;
}

function normalizeRequestedLanguage(rawValue) {
  const parsedLanguage = parseLanguageCode(rawValue);
  if (!parsedLanguage.valid) {
    throw new ProductHttpError(400, 'INVALID_LANGUAGE', 'lang must be EN or TH');
  }

  return parsedLanguage.value;
}

function parseAdminProductsQuery(query) {
  const pageRaw = query?.page;
  const limitRaw = query?.limit;

  const page = pageRaw === undefined || pageRaw === null || pageRaw === ''
    ? ADMIN_PRODUCTS_PAGE_DEFAULT
    : Number.parseInt(pageRaw, 10);
  const limit = limitRaw === undefined || limitRaw === null || limitRaw === ''
    ? ADMIN_PRODUCTS_LIMIT_DEFAULT
    : Number.parseInt(limitRaw, 10);

  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
    throw new ProductHttpError(
      400,
      'INVALID_QUERY',
      'page and limit must be positive integers'
    );
  }

  const normalizedLimit = Math.min(limit, ADMIN_PRODUCTS_LIMIT_MAX);
  const search = typeof query?.search === 'string' ? query.search.trim() : '';
  const categoryRaw = query?.category;

  let categoryId = null;
  if (!(categoryRaw === undefined || categoryRaw === null || categoryRaw === '')) {
    categoryId = Number.parseInt(categoryRaw, 10);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new ProductHttpError(400, 'INVALID_QUERY', 'category must be a positive integer');
    }
  }

  return {
    page,
    limit: normalizedLimit,
    search: search || null,
    categoryId,
  };
}

function parseDeleteMode(query, body) {
  const rawMode = query?.mode ?? body?.mode;
  if (rawMode === undefined || rawMode === null || rawMode === '') {
    return 'SOFT';
  }

  const normalized = String(rawMode).trim().toUpperCase();
  if (normalized !== 'SOFT' && normalized !== 'HARD') {
    throw new ProductHttpError(400, 'INVALID_QUERY', 'mode must be either SOFT or HARD');
  }

  return normalized;
}

function parseOptionalImageMetadata(body) {
  const isThumbnail = parseBooleanLike(body?.isThumbnail ?? body?.is_thumbnail, false);
  const isHero = parseBooleanLike(body?.isHero ?? body?.is_hero, false);
  if (!isThumbnail.valid || !isHero.valid) {
    throw new ProductHttpError(400, 'VALIDATION_ERROR', 'Invalid request data', {
      flags: 'isThumbnail/isHero must be boolean-like values',
    });
  }

  const parsedSortOrder = parseSortOrder(body?.sortOrder ?? body?.sort_order);
  if (!parsedSortOrder.valid) {
    throw new ProductHttpError(400, 'VALIDATION_ERROR', 'Invalid request data', {
      sortOrder: `sortOrder must be an integer between 1 and ${MAX_IMAGES_PER_PRODUCT}`,
    });
  }

  const altTextRaw = body?.altText ?? body?.alt_text;
  const altText =
    typeof altTextRaw === 'string' && altTextRaw.trim() !== '' ? altTextRaw.trim() : null;

  return {
    isThumbnail: isThumbnail.value,
    isHero: isHero.value,
    sortOrder: parsedSortOrder.value,
    altText,
  };
}

function extractCreateFiles(fileMap) {
  if (!fileMap) {
    return [];
  }

  const mediaFiles = [];
  if (Array.isArray(fileMap.mediaFiles)) {
    mediaFiles.push(...fileMap.mediaFiles);
  }
  if (Array.isArray(fileMap.media)) {
    mediaFiles.push(...fileMap.media);
  }

  return mediaFiles;
}

function createAdminProductRouter({
  dbConnection = db,
  storage = supabase,
  bucketName = DEFAULT_BUCKET_NAME,
} = {}) {
  const router = express.Router();
  const createUpload = createMulterUpload();

  // SECURITY: Access control is handled globally by requireAdmin session middleware.
  // Legacy x-role check removed to enforce strict HttpOnly session-only policy.

  const uploadSingleProductImage = (req, res) => {
    createUpload.single('image')(req, res, async (uploadError) => {
      const errorResponse = handleUploadError(res, uploadError);
      if (errorResponse) {
        return errorResponse;
      }

      try {
        const productId = normalizeProductId(req.params.productId);
        if (!req.file) {
          throw new ProductHttpError(400, 'IMAGE_REQUIRED', 'Image file is required');
        }

        const imageMetadata = parseOptionalImageMetadata(req.body);
        const data = await uploadProductImage({
          db: dbConnection,
          supabase: storage,
          bucketName,
          productId,
          file: req.file,
          ...imageMetadata,
        });

        return res.status(201).json({
          message: 'Image uploaded successfully',
          data,
        });
      } catch (error) {
        return handleRouteError(res, error);
      }
    });
  };

  router.get('/products', async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const query = parseAdminProductsQuery(req.query);
      const data = await listAdminProducts({
        db: dbConnection,
        languageCode,
        page: query.page,
        limit: query.limit,
        search: query.search,
        categoryId: query.categoryId,
        includeInactive: true,
      });

      return res.status(200).json({
        status: 'success',
        message: 'products retrieved successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.get('/products/:productId/images', async (req, res) => {
    try {
      const productId = normalizeProductId(req.params.productId);
      const data = await listProductImages({
        db: dbConnection,
        productId,
        includeInactive: true,
      });

      return res.status(200).json({
        message: 'Product images retrieved successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.get('/products/:productId', async (req, res) => {
    try {
      const productId = normalizeProductId(req.params.productId);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await getProductDetail({
        db: dbConnection,
        productId,
        languageCode,
        includeInactive: true,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product retrieved successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.put('/products/:productId', async (req, res) => {
    try {
      const productId = normalizeProductId(req.params.productId);
      const languageCode = normalizeRequestedLanguage(
        req.query.lang ?? req.body?.lang ?? req.body?.languageCode
      );
      const data = await updateAdminProduct({
        db: dbConnection,
        productId,
        payload: req.body,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product updated successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.delete('/products/:productId', async (req, res) => {
    try {
      const productId = normalizeProductId(req.params.productId);
      const mode = parseDeleteMode(req.query, req.body);
      const data = await deleteAdminProduct({
        db: dbConnection,
        productId,
        mode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product deleted successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.post('/products', (req, res) => {
    const runCreate = async () => {
      try {
        const payload = parseCreatePayload(req);
        const files = extractCreateFiles(req.files);

        /**
         * MISSION_CRITICAL: Begin Core Product Generation (Atomic Persistence)
         * - CHECK: Verify categoryId exists in DB (Foreign Key safety)
         * - CHECK: Verify Supabase Bucket 'product-images' exists + service_role accessibility
         */
        const data = await createProduct({
          db: dbConnection,
          supabase: storage,
          bucketName: bucketName || 'product-images',
          payload,
          files,
        });

        return res.status(201).json({
          message: 'Product created successfully',
          data,
        });
      } catch (error) {
        console.error('--- PRODUCT CREATION CRASH ---', error);
        return handleRouteError(res, error);
      }
    };

    if (req.is('multipart/form-data')) {
      return createUpload.fields([
        { name: 'mediaFiles', maxCount: MAX_IMAGES_PER_PRODUCT },
        { name: 'media', maxCount: MAX_IMAGES_PER_PRODUCT },
      ])(req, res, async (uploadError) => {
        const errorResponse = handleUploadError(res, uploadError);
        if (errorResponse) {
          return errorResponse;
        }

        return runCreate();
      });
    }

    return runCreate();
  });

  router.post('/products/:productId/image', uploadSingleProductImage);
  router.post('/products/:productId/images', uploadSingleProductImage);

  return router;
}

module.exports = createAdminProductRouter();
module.exports.createAdminProductRouter = createAdminProductRouter;
