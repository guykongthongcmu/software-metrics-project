const express = require('express');
const crypto = require('crypto');
const { createRequireUserSession } = require('../middleware/requireUserSession');

const db = require('../config/db');
const {
  addCartItem,
  addProductToFavorites,
  completeCheckoutPurchase,
  ProductHttpError,
  getCheckoutAddress,
  getProductDetail,
  getStorefrontProductDetail,
  listUserFavorites,
  listStorefrontProductsByCategory,
  listStorefrontProductRecommendations,
  listStorefrontProductSuggestions,
  listNewArrivals,
  listProductImages,
  listProducts,
  parseLanguageCode,
  removeCartItem,
  removeProductFromFavorites,
  searchStorefrontProducts,
  upsertCheckoutAddress,
  updateCartItemQuantity,
  getUserCart,
} = require('../modules/products/product.service');

function sendError(res, statusCode, errorCode, message, details) {
  const payload = { error: errorCode, message };
  if (details) {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

function handleRouteError(res, error) {
  if (error instanceof ProductHttpError) {
    return sendError(res, error.statusCode, error.errorCode, error.message, error.details);
  }

  console.error(error);
  return sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Internal server error');
}

function normalizeRequestedLanguage(rawValue) {
  const parsedLanguage = parseLanguageCode(rawValue);
  if (!parsedLanguage.valid) {
    throw new ProductHttpError(400, 'INVALID_LANGUAGE', 'lang must be EN or TH');
  }

  return parsedLanguage.value;
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

function normalizeCartItemId(rawValue) {
  const itemId = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new ProductHttpError(
      400,
      'INVALID_ITEM_ID',
      'itemId must be a positive integer'
    );
  }

  return itemId;
}

function normalizeSearchQuery(rawValue, emptyMessage = 'q must be a non-empty string') {
  if (typeof rawValue !== 'string') {
    throw new ProductHttpError(400, 'INVALID_QUERY', emptyMessage);
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    throw new ProductHttpError(400, 'INVALID_QUERY', emptyMessage);
  }

  return normalized;
}

function getSessionTokenFromRequest(req) {
  const cookieSession =
    typeof req.cookies?.session === 'string' ? req.cookies.session.trim() : '';
  if (cookieSession) {
    return cookieSession;
  }

  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  if (!cookieHeader) {
    return '';
  }

  const cookieEntries = cookieHeader.split(';');
  for (const entry of cookieEntries) {
    const [rawKey, ...rawValueParts] = entry.split('=');
    const key = typeof rawKey === 'string' ? rawKey.trim() : '';
    if (key !== 'session') {
      continue;
    }

    const value = rawValueParts.join('=').trim();
    if (!value) {
      return '';
    }

    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  return '';
}

function getAnonymousViewerTokenFromRequest(req) {
  const viewerToken =
    typeof req.cookies?.viewer_id === 'string' ? req.cookies.viewer_id.trim() : '';
  if (!viewerToken) {
    return '';
  }

  const isValid = /^[A-Za-z0-9_-]{16,128}$/.test(viewerToken);
  return isValid ? viewerToken : '';
}

function ensureAnonymousViewerSessionId(req, res) {
  const existingViewerToken = getAnonymousViewerTokenFromRequest(req);
  if (existingViewerToken) {
    return `anon:${existingViewerToken}`;
  }

  const generatedViewerToken = crypto.randomBytes(16).toString('hex');
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('viewer_id', generatedViewerToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  return `anon:${generatedViewerToken}`;
}

function getAnonymousViewerFingerprintSessionId(req) {
  const forwardedFor =
    typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : '';
  const ipAddress = forwardedFor || req.ip || '';
  const userAgent =
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].trim() : '';
  const fingerprintSource = `${ipAddress}|${userAgent}`;

  if (!fingerprintSource.replace(/\|/g, '').trim()) {
    return null;
  }

  const hash = crypto.createHash('sha256').update(fingerprintSource).digest('hex');
  return `anon:${hash}`.slice(0, 255);
}

async function resolveViewerIdentity({ dbConnection, req }) {
  const sessionToken = getSessionTokenFromRequest(req);
  if (!sessionToken) {
    return {
      userId: null,
      sessionId: null,
    };
  }

  const normalizedSessionId = sessionToken.slice(0, 255);

  try {
    const [sessionRows] = await dbConnection.execute(
      `SELECT user_id, subject_type, expires_at, revoked_at
       FROM sessions
       WHERE session_token = ?
       LIMIT 1`,
      [sessionToken]
    );

    const session = sessionRows[0];
    if (!session || session.revoked_at) {
      return { userId: null, sessionId: normalizedSessionId };
    }

    const expiresAt = new Date(session.expires_at).getTime();
    const isActive = Number.isFinite(expiresAt) && expiresAt > Date.now();
    if (
      isActive &&
      session.subject_type === 'USER' &&
      Number.isInteger(Number(session.user_id)) &&
      Number(session.user_id) > 0
    ) {
      return {
        userId: Number(session.user_id),
        sessionId: normalizedSessionId,
      };
    }

    return { userId: null, sessionId: normalizedSessionId };
  } catch (error) {
    console.error('Failed to resolve viewer session identity:', error);
    return { userId: null, sessionId: normalizedSessionId };
  }
}

async function trackProductViewEvent({ dbConnection, req, res, productId }) {
  try {
    const viewer = await resolveViewerIdentity({ dbConnection, req });
    let sessionId = viewer.sessionId;

    if (!viewer.userId && !sessionId) {
      sessionId = ensureAnonymousViewerSessionId(req, res);
    }

    if (!viewer.userId && !sessionId) {
      sessionId = getAnonymousViewerFingerprintSessionId(req);
    }

    if (!viewer.userId && !sessionId) {
      return;
    }

    await dbConnection.execute(
      `INSERT INTO analytics_event (user_id, session_id, event_type, product_id)
       VALUES (?, ?, 'PRODUCT_VIEW', ?)`,
      [viewer.userId, sessionId || null, productId]
    );
  } catch (error) {
    console.error('Failed to track product view event:', error);
  }
}

function createProductRouter({ dbConnection = db } = {}) {
  const router = express.Router();
  const requireUserSession = createRequireUserSession({ dbConnection });

  function sendClientApiError(res, statusCode, errorCode, message) {
    return res.status(statusCode).json({
      status: 'error',
      code: errorCode,
      message,
    });
  }

  function handleClientApiError(res, error) {
    if (error instanceof ProductHttpError) {
      return sendClientApiError(res, error.statusCode, error.errorCode, error.message);
    }

    console.error(error);
    return sendClientApiError(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'internal server error'
    );
  }

  router.get('/products/new-arrivals', async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await listNewArrivals({
        db: dbConnection,
        languageCode,
      });

      return res.status(200).json({
        message: 'New arrival products retrieved successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.get('/products', async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await listProducts({
        db: dbConnection,
        languageCode,
        includeInactive: false,
      });

      return res.status(200).json({
        message: 'Products retrieved successfully',
        data,
      });
    } catch (error) {
      return handleRouteError(res, error);
    }
  });

  router.get('/products/search/suggestions', async (req, res) => {
    try {
      const queryText = normalizeSearchQuery(req.query.q, 'q must be at least 1 character');
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const suggestions = await listStorefrontProductSuggestions({
        db: dbConnection,
        queryText,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product suggestions retrieved successfully',
        data: {
          query: queryText,
          suggestions,
        },
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.get('/favorites', requireUserSession, async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await listUserFavorites({
        db: dbConnection,
        userId: req.authUser.userId,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'favorites retrieved successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.post('/favorites/:productId', requireUserSession, async (req, res) => {
    let productId = null;
    try {
      productId = normalizeProductId(req.params.productId);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await addProductToFavorites({
        db: dbConnection,
        userId: req.authUser.userId,
        productId,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product added to favorites successfully',
        data,
      });
    } catch (error) {
      if (error instanceof ProductHttpError && error.errorCode === 'PRODUCT_NOT_FOUND') {
        const fallbackId = Number.isInteger(productId) ? productId : req.params.productId;
        return sendClientApiError(
          res,
          error.statusCode,
          error.errorCode,
          `product with id ${fallbackId} was not found`
        );
      }
      return handleClientApiError(res, error);
    }
  });

  router.delete('/favorites/:productId', requireUserSession, async (req, res) => {
    let productId = null;
    try {
      productId = normalizeProductId(req.params.productId);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await removeProductFromFavorites({
        db: dbConnection,
        userId: req.authUser.userId,
        productId,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product removed from favorites successfully',
        data,
      });
    } catch (error) {
      if (error instanceof ProductHttpError && error.errorCode === 'PRODUCT_NOT_FOUND') {
        const fallbackId = Number.isInteger(productId) ? productId : req.params.productId;
        return sendClientApiError(
          res,
          error.statusCode,
          error.errorCode,
          `product with id ${fallbackId} was not found`
        );
      }
      return handleClientApiError(res, error);
    }
  });

  router.get('/products/search', async (req, res) => {
    try {
      const queryText = normalizeSearchQuery(req.query.q);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const searchResult = await searchStorefrontProducts({
        db: dbConnection,
        queryText,
        languageCode,
        page: req.query.page,
        limit: req.query.limit,
        sort: req.query.sort,
      });

      return res.status(200).json({
        status: 'success',
        message: 'products retrieved successfully',
        data: {
          query: queryText,
          category: null,
          pagination: searchResult.pagination,
          products: searchResult.products,
        },
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.get('/products/recommendations', async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await listStorefrontProductRecommendations({
        db: dbConnection,
        languageCode,
        limit: req.query.limit,
        context: req.query.context,
        category: req.query.category,
        excludeProductIds: req.query.excludeProductIds,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product recommendations retrieved successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.get('/products/category/:category', async (req, res) => {
    try {
      const categorySlug = typeof req.params.category === 'string' ? req.params.category.trim() : '';
      if (!categorySlug) {
        throw new ProductHttpError(404, 'CATEGORY_NOT_FOUND', `category ${req.params.category} was not found`);
      }

      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const result = await listStorefrontProductsByCategory({
        db: dbConnection,
        categorySlug,
        languageCode,
        page: req.query.page,
        limit: req.query.limit,
        sort: req.query.sort,
      });

      return res.status(200).json({
        status: 'success',
        message: 'products in category retrieved successfully',
        data: result,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.get('/checkout/address', requireUserSession, async (req, res) => {
    try {
      const data = await getCheckoutAddress({
        db: dbConnection,
        userId: req.authUser.userId,
      });

      return res.status(200).json({
        status: 'success',
        message: 'checkout address retrieved successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.put('/checkout/address', requireUserSession, async (req, res) => {
    try {
      const data = await upsertCheckoutAddress({
        db: dbConnection,
        userId: req.authUser.userId,
        payload: req.body,
      });

      return res.status(200).json({
        status: 'success',
        message: 'checkout address saved successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.post('/checkout/purchase', requireUserSession, async (req, res) => {
    try {
      const data = await completeCheckoutPurchase({
        db: dbConnection,
        userId: req.authUser.userId,
      });

      return res.status(200).json({
        status: 'success',
        message: 'purchase completed successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.get('/cart', requireUserSession, async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await getUserCart({
        db: dbConnection,
        userId: req.authUser.userId,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'cart retrieved successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.post('/cart/items', requireUserSession, async (req, res) => {
    try {
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await addCartItem({
        db: dbConnection,
        userId: req.authUser.userId,
        productId: req.body?.productId,
        color: req.body?.color,
        size: req.body?.size,
        quantityCartItem: req.body?.quantityCartItem,
        languageCode,
      });

      return res.status(201).json({
        status: 'success',
        message: 'cart item added successfully',
        data,
      });
    } catch (error) {
      return handleClientApiError(res, error);
    }
  });

  router.put('/cart/items/:itemId', requireUserSession, async (req, res) => {
    let itemId = null;
    try {
      itemId = normalizeCartItemId(req.params.itemId);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await updateCartItemQuantity({
        db: dbConnection,
        userId: req.authUser.userId,
        itemId,
        quantityCartItem: req.body?.quantityCartItem,
        languageCode,
      });

      return res.status(200).json({
        status: 'success',
        message: 'cart item quantity updated successfully',
        data,
      });
    } catch (error) {
      if (error instanceof ProductHttpError && error.errorCode === 'CART_ITEM_NOT_FOUND') {
        const fallbackId = Number.isInteger(itemId) ? itemId : req.params.itemId;
        return sendClientApiError(
          res,
          404,
          'CART_ITEM_NOT_FOUND',
          `cart item with id ${fallbackId} was not found`
        );
      }
      return handleClientApiError(res, error);
    }
  });

  router.delete('/cart/items/:itemId', requireUserSession, async (req, res) => {
    let itemId = null;
    try {
      itemId = normalizeCartItemId(req.params.itemId);
      const data = await removeCartItem({
        db: dbConnection,
        userId: req.authUser.userId,
        itemId,
      });

      return res.status(200).json({
        status: 'success',
        message: 'cart item removed successfully',
        data,
      });
    } catch (error) {
      if (error instanceof ProductHttpError && error.errorCode === 'CART_ITEM_NOT_FOUND') {
        const fallbackId = Number.isInteger(itemId) ? itemId : req.params.itemId;
        return sendClientApiError(
          res,
          404,
          'CART_ITEM_NOT_FOUND',
          `cart item with id ${fallbackId} was not found`
        );
      }
      return handleClientApiError(res, error);
    }
  });

  router.get('/products/:productId/variants', async (req, res) => {
    let normalizedProductId = null;
    try {
      normalizedProductId = normalizeProductId(req.params.productId);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const detail = await getProductDetail({
        db: dbConnection,
        productId: normalizedProductId,
        languageCode,
        includeInactive: false,
      });

      const data = detail.variants.map((variant) => ({
        productVariantId: variant.productVariantId,
        sku: variant.sku,
        color: variant.colour,
        size: variant.size,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stockQty: variant.stockQty,
        isActive: variant.isActive,
      }));

      return res.status(200).json({
        status: 'success',
        message: 'product variants retrieved successfully',
        data,
      });
    } catch (error) {
      if (error instanceof ProductHttpError) {
        const messageProductId = Number.isInteger(normalizedProductId)
          ? normalizedProductId
          : req.params.productId;
        const normalizedMessage =
          error.errorCode === 'PRODUCT_NOT_FOUND'
            ? `product with id ${messageProductId} was not found`
            : error.message;
        return sendClientApiError(
          res,
          error.statusCode,
          error.errorCode,
          normalizedMessage
        );
      }

      console.error(error);
      return sendClientApiError(
        res,
        500,
        'INTERNAL_SERVER_ERROR',
        'internal server error'
      );
    }
  });

  router.get('/products/:productId/images', async (req, res) => {
    try {
      const productId = normalizeProductId(req.params.productId);
      const data = await listProductImages({
        db: dbConnection,
        productId,
        includeInactive: false,
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
    let normalizedProductId = null;
    try {
      normalizedProductId = normalizeProductId(req.params.productId);
      const languageCode = normalizeRequestedLanguage(req.query.lang);
      const data = await getStorefrontProductDetail({
        db: dbConnection,
        productId: normalizedProductId,
        languageCode,
      });
      await trackProductViewEvent({
        dbConnection,
        req,
        res,
        productId: normalizedProductId,
      });

      return res.status(200).json({
        status: 'success',
        message: 'product detail retrieved successfully',
        data,
      });
    } catch (error) {
      if (error instanceof ProductHttpError) {
        const messageProductId = Number.isInteger(normalizedProductId)
          ? normalizedProductId
          : req.params.productId;
        const normalizedMessage =
          error.errorCode === 'PRODUCT_NOT_FOUND'
            ? `product with id ${messageProductId} was not found`
            : error.message;
        return sendClientApiError(
          res,
          error.statusCode,
          error.errorCode,
          normalizedMessage
        );
      }

      console.error(error);
      return sendClientApiError(
        res,
        500,
        'INTERNAL_SERVER_ERROR',
        'internal server error'
      );
    }
  });

  return router;
}

module.exports = createProductRouter();
module.exports.createProductRouter = createProductRouter;
