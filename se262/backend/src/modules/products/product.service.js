const crypto = require('crypto');
const path = require('path');

const PRODUCT_TYPES = new Set(['TOP', 'BOTTOM', 'ACCESSORY']);
const SUPPORTED_LANGUAGE_CODES = new Set(['EN', 'TH']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES_PER_PRODUCT = 4;
const DEFAULT_PRODUCT_MEDIA_URL =
  process.env.DEFAULT_PRODUCT_MEDIA_URL || '/images/linen_shirt.jpg';
const DEFAULT_PRODUCT_MEDIA_BUCKET =
  process.env.DEFAULT_PRODUCT_MEDIA_BUCKET || 'local';
const NEW_ARRIVALS_LIMIT = 4;
const STORE_FRONT_PAGE_DEFAULT = 1;
const STORE_FRONT_LIMIT_DEFAULT = 12;
const STORE_FRONT_LIMIT_MAX = 50;
const STORE_FRONT_SUGGESTIONS_LIMIT = 8;
const STORE_FRONT_RECOMMENDATIONS_LIMIT_DEFAULT = 4;
const STORE_FRONT_RECOMMENDATIONS_LIMIT_MAX = 20;
const SEARCH_SORT_OPTIONS = new Set(['relevance', 'newest', 'price_asc', 'price_desc']);
const CATEGORY_SORT_OPTIONS = new Set(['newest', 'price_asc', 'price_desc']);

class ProductHttpError extends Error {
  constructor(statusCode, errorCode, message, details) {
    super(message);
    this.name = 'ProductHttpError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function createPlaceholders(values) {
  return values.map(() => '?').join(', ');
}

function buildStoragePath(productId, originalname) {
  const extension = path.extname(originalname || '').toLowerCase();
  const safeExtension = extension && extension.length <= 10 ? extension : '.bin';
  return `products/${productId}/${Date.now()}-${crypto.randomUUID()}${safeExtension}`;
}

function buildPlaceholderMediaPath(productId, sortOrder) {
  return `products/${productId}/placeholder-${sortOrder}.jpg`;
}

function parseLanguageCode(rawValue, defaultValue = 'EN') {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: true, value: defaultValue };
  }

  const value = String(rawValue).trim().toUpperCase();
  if (!SUPPORTED_LANGUAGE_CODES.has(value)) {
    return { valid: false, value: null };
  }

  return { valid: true, value };
}

function parseBooleanLike(rawValue, defaultValue = false) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: true, value: defaultValue };
  }

  if (typeof rawValue === 'boolean') {
    return { valid: true, value: rawValue };
  }

  if (typeof rawValue === 'number') {
    if (rawValue === 1) return { valid: true, value: true };
    if (rawValue === 0) return { valid: true, value: false };
    return { valid: false, value: defaultValue };
  }

  const normalized = String(rawValue).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return { valid: true, value: true };
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return { valid: true, value: false };
  }

  return { valid: false, value: defaultValue };
}

function parseStatus(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: true, value: true };
  }

  const parsedBoolean = parseBooleanLike(rawValue, true);
  if (parsedBoolean.valid) {
    return parsedBoolean;
  }

  const normalized = String(rawValue).trim().toUpperCase();
  if (['ACTIVE', 'PUBLISHED', 'VISIBLE', 'ENABLED'].includes(normalized)) {
    return { valid: true, value: true };
  }

  if (['INACTIVE', 'HIDDEN', 'DISABLED', 'DRAFT', 'ARCHIVED'].includes(normalized)) {
    return { valid: true, value: false };
  }

  return { valid: false, value: true };
}

function parseSortOrder(rawValue, defaultValue = null) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { provided: false, valid: true, value: defaultValue };
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_IMAGES_PER_PRODUCT) {
    return { provided: true, valid: false, value: defaultValue };
  }

  return { provided: true, valid: true, value: parsed };
}

function parsePage(rawValue, defaultValue = STORE_FRONT_PAGE_DEFAULT) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return parsed;
}

function parseLimit(rawValue, defaultValue = STORE_FRONT_LIMIT_DEFAULT) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultValue;
  }

  return Math.min(parsed, STORE_FRONT_LIMIT_MAX);
}

function parseRecommendationsLimit(
  rawValue,
  defaultValue = STORE_FRONT_RECOMMENDATIONS_LIMIT_DEFAULT
) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultValue;
  }

  if (Array.isArray(rawValue)) {
    throw new ProductHttpError(
      400,
      'INVALID_QUERY',
      `limit must be an integer between 1 and ${STORE_FRONT_RECOMMENDATIONS_LIMIT_MAX}`
    );
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > STORE_FRONT_RECOMMENDATIONS_LIMIT_MAX
  ) {
    throw new ProductHttpError(
      400,
      'INVALID_QUERY',
      `limit must be an integer between 1 and ${STORE_FRONT_RECOMMENDATIONS_LIMIT_MAX}`
    );
  }

  return parsed;
}

function parseRecommendationContext(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  if (Array.isArray(rawValue) || typeof rawValue !== 'string') {
    throw new ProductHttpError(400, 'INVALID_QUERY', 'context must be a non-empty string');
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    throw new ProductHttpError(400, 'INVALID_QUERY', 'context must be a non-empty string');
  }

  return normalized;
}

function parseRecommendationCategorySlug(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return null;
  }

  if (Array.isArray(rawValue) || typeof rawValue !== 'string') {
    throw new ProductHttpError(400, 'INVALID_QUERY', 'category must be a non-empty string');
  }

  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    throw new ProductHttpError(400, 'INVALID_QUERY', 'category must be a non-empty string');
  }

  return normalized;
}

function parseExcludeProductIds(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return [];
  }

  const serialized = Array.isArray(rawValue)
    ? rawValue.join(',')
    : String(rawValue);
  const tokens = serialized
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (tokens.length === 0) {
    return [];
  }

  const parsedIds = [];
  const seen = new Set();

  tokens.forEach((token) => {
    if (!/^\d+$/.test(token)) {
      throw new ProductHttpError(
        400,
        'INVALID_EXCLUDE_PRODUCT_IDS',
        'excludeProductIds must be a comma-separated list of positive integers'
      );
    }

    const value = Number.parseInt(token, 10);
    if (!Number.isInteger(value) || value <= 0 || seen.has(value)) {
      if (Number.isInteger(value) && value > 0 && seen.has(value)) {
        return;
      }

      throw new ProductHttpError(
        400,
        'INVALID_EXCLUDE_PRODUCT_IDS',
        'excludeProductIds must be a comma-separated list of positive integers'
      );
    }

    seen.add(value);
    parsedIds.push(value);
  });

  return parsedIds;
}

function normalizeAddressField(rawValue, { maxLength, required = false } = {}) {
  if (rawValue === undefined || rawValue === null) {
    return required ? null : null;
  }

  const normalized = String(rawValue).trim();
  if (!normalized) {
    return required ? null : null;
  }

  if (maxLength && normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function validateCheckoutAddressPayload(payload) {
  const fullName = normalizeAddressField(payload?.fullName, { required: true, maxLength: 150 });
  const phoneNumber = normalizeAddressField(payload?.phoneNumber, {
    required: true,
    maxLength: 30,
  });
  const addressLine1 = normalizeAddressField(payload?.addressLine1, {
    required: true,
    maxLength: 255,
  });
  const addressLine2 = normalizeAddressField(payload?.addressLine2, { maxLength: 255 });
  const district = normalizeAddressField(payload?.district, { required: true, maxLength: 120 });
  const province = normalizeAddressField(payload?.province, { required: true, maxLength: 120 });
  const postalCode = normalizeAddressField(payload?.postalCode, { required: true, maxLength: 20 });
  const country = normalizeAddressField(payload?.country, { required: true, maxLength: 100 });

  const errors = {};
  if (!fullName) {
    addError(errors, 'fullName', 'fullName is required');
  }
  if (!phoneNumber) {
    addError(errors, 'phoneNumber', 'phoneNumber is required');
  } else if (!/^[0-9+\-\s()]{7,20}$/.test(phoneNumber)) {
    addError(errors, 'phoneNumber', 'phoneNumber format is invalid');
  }
  if (!addressLine1) {
    addError(errors, 'addressLine1', 'addressLine1 is required');
  }
  if (!district) {
    addError(errors, 'district', 'district is required');
  }
  if (!province) {
    addError(errors, 'province', 'province is required');
  }
  if (!postalCode) {
    addError(errors, 'postalCode', 'postalCode is required');
  } else if (!/^[A-Za-z0-9\- ]{3,12}$/.test(postalCode)) {
    addError(errors, 'postalCode', 'postalCode format is invalid');
  }
  if (!country) {
    addError(errors, 'country', 'country is required');
  }

  if (Object.keys(errors).length > 0) {
    throw new ProductHttpError(
      400,
      'INVALID_ADDRESS_PAYLOAD',
      'fullName, phoneNumber, addressLine1, district, province, postalCode, and country are required',
      errors
    );
  }

  return {
    fullName,
    phoneNumber,
    addressLine1,
    addressLine2,
    district,
    province,
    postalCode,
    country,
  };
}

function normalizeSortOption(rawValue, allowedSorts, defaultSort) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return defaultSort;
  }

  const normalized = String(rawValue).trim().toLowerCase();
  return allowedSorts.has(normalized) ? normalized : defaultSort;
}

function parsePositiveNumber(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: false, value: null };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { valid: false, value: null };
  }

  return { valid: true, value: Number(parsed.toFixed(2)) };
}

function parseOptionalNumber(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: true, value: null };
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { valid: false, value: null };
  }

  return { valid: true, value: Number(parsed.toFixed(2)) };
}

function parseNonNegativeInteger(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: false, value: null };
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { valid: false, value: null };
  }

  return { valid: true, value: parsed };
}

function normalizeShortText(rawValue, { maxLength, uppercase = false } = {}) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const trimmed = String(rawValue).trim();
  if (!trimmed) {
    return null;
  }

  const normalized = uppercase ? trimmed.toUpperCase() : trimmed;
  if (maxLength && normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

function addError(errors, field, message) {
  if (!errors[field]) {
    errors[field] = message;
  }
}

function throwValidationError(errors) {
  if (Object.keys(errors).length > 0) {
    throw new ProductHttpError(400, 'VALIDATION_ERROR', 'Invalid request data', errors);
  }
}

function mapMediaRowToApi(row) {
  return {
    productMediaId: row.product_media_id,
    productId: row.product_id,
    bucketName: row.bucket_name,
    filePath: row.file_path,
    publicUrl: row.public_url,
    altText: row.alt_text,
    sortOrder: row.sort_order,
    isThumbnail: row.is_thumbnail === 1 || row.is_thumbnail === true,
    isHero: row.is_hero === 1 || row.is_hero === true,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

function mapVariantRowToApi(row) {
  return {
    productVariantId: row.product_variant_id,
    sku: row.sku_code,
    colour: row.colour,
    size: row.size,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
    stockQty: Number(row.stock_qty),
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function mapTranslationRowToApi(row) {
  return {
    productTranslationId: row.product_translation_id,
    languageCode: row.language_code,
    name: row.name,
    description: row.description,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function mapCategoryRowToApi(row) {
  return {
    categoryId: row.category_id,
    name: row.localized_name,
    slug: row.slug,
    isPrimary: row.is_primary === 1 || row.is_primary === true,
  };
}

function mapProductSummaryRow(row) {
  return {
    productId: row.product_id,
    productType: row.product_type,
    isActive: row.is_active === 1 || row.is_active === true,
    status: row.is_active === 1 || row.is_active === true ? 'ACTIVE' : 'INACTIVE',
    languageCode: row.language_code,
    name: row.name,
    description: row.description,
    primaryCategoryId: row.primary_category_id,
    primaryCategoryName: row.primary_category_name,
    rootCategoryId: row.root_category_id == null ? null : Number(row.root_category_id),
    rootCategoryName: row.root_category_name || row.primary_category_name || null,
    thumbnailUrl: row.thumbnail_url,
    thumbnailAlt: row.thumbnail_alt,
    priceFrom: row.min_price == null ? null : Number(row.min_price),
    compareAtPriceFrom:
      row.min_compare_at_price == null ? null : Number(row.min_compare_at_price),
    totalStock: row.total_stock == null ? 0 : Number(row.total_stock),
    variantCount: row.variant_count == null ? 0 : Number(row.variant_count),
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function pickPreferredTranslation(translations, languageCode) {
  const normalized = parseLanguageCode(languageCode).value;
  return (
    translations.find((entry) => entry.languageCode === normalized) ||
    translations.find((entry) => entry.languageCode === 'EN') ||
    translations[0] ||
    null
  );
}

function normalizeCreatePayload(rawPayload, files) {
  const errors = {};
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {};

  const productType = normalizeShortText(payload.productType, { maxLength: 20, uppercase: true });
  if (!productType || !PRODUCT_TYPES.has(productType)) {
    addError(errors, 'productType', 'productType must be one of TOP, BOTTOM, or ACCESSORY');
  }

  const parsedStatus =
    payload.status !== undefined ? parseStatus(payload.status) : parseStatus(payload.isActive);
  if (!parsedStatus.valid) {
    addError(
      errors,
      payload.status !== undefined ? 'status' : 'isActive',
      'status/isActive must be a valid boolean-like or supported status value'
    );
  }

  const translationsInput = payload.translations;
  const normalizedTranslations = [];
  const translationLanguages = new Set();

  if (!Array.isArray(translationsInput) || translationsInput.length === 0) {
    addError(errors, 'translations', 'translations must contain EN and TH entries');
  } else {
    translationsInput.forEach((entry, index) => {
      const language = parseLanguageCode(entry?.languageCode ?? entry?.language_code, null);
      if (!language.valid || !language.value) {
        addError(
          errors,
          `translations[${index}].languageCode`,
          'languageCode must be EN or TH'
        );
      }

      const name = normalizeShortText(entry?.name, { maxLength: 150 });
      if (!name) {
        addError(errors, `translations[${index}].name`, 'name is required and must be 150 characters or fewer');
      }

      const description = normalizeShortText(entry?.description);

      if (language.value) {
        const languageKey = language.value;
        if (translationLanguages.has(languageKey)) {
          addError(errors, 'translations', `Duplicate translation language ${languageKey} is not allowed`);
        } else {
          translationLanguages.add(languageKey);
        }
      }

      normalizedTranslations.push({
        languageCode: language.value,
        name,
        description,
      });
    });
  }

  if (!translationLanguages.has('EN') || !translationLanguages.has('TH')) {
    addError(errors, 'translations', 'translations must include both EN and TH names');
  }

  const categoriesInput = payload.categories;
  const normalizedCategories = [];
  const categoryIds = new Set();
  let primaryCategoryCount = 0;

  if (!Array.isArray(categoriesInput) || categoriesInput.length === 0) {
    addError(errors, 'categories', 'At least one category is required');
  } else {
    categoriesInput.forEach((entry, index) => {
      const categoryId = Number.parseInt(entry?.categoryId ?? entry?.category_id, 10);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        addError(errors, `categories[${index}].categoryId`, 'categoryId must be a positive integer');
      }

      const isPrimary = parseBooleanLike(entry?.isPrimary ?? entry?.is_primary, false);
      if (!isPrimary.valid) {
        addError(errors, `categories[${index}].isPrimary`, 'isPrimary must be boolean-like');
      }

      if (Number.isInteger(categoryId) && categoryId > 0) {
        if (categoryIds.has(categoryId)) {
          addError(errors, 'categories', 'Duplicate category assignments are not allowed');
        } else {
          categoryIds.add(categoryId);
        }
      }

      if (isPrimary.valid && isPrimary.value) {
        primaryCategoryCount += 1;
      }

      normalizedCategories.push({
        categoryId,
        isPrimary: isPrimary.value,
      });
    });
  }

  if (primaryCategoryCount !== 1) {
    addError(errors, 'categories', 'Exactly one primary category is required');
  }

  const variantsInput = payload.variants;
  const normalizedVariants = [];
  const skuSet = new Set();
  const variantComboSet = new Set();
  const duplicateSkusInPayload = new Set();
  const duplicateVariantCombosInPayload = new Set();

  if (!Array.isArray(variantsInput) || variantsInput.length === 0) {
    addError(errors, 'variants', 'At least one variant is required');
  } else {
    variantsInput.forEach((entry, index) => {
      const sku = normalizeShortText(entry?.sku, { maxLength: 100, uppercase: true });
      if (!sku) {
        addError(errors, `variants[${index}].sku`, 'sku is required and must be 100 characters or fewer');
      }

      const colour = normalizeShortText(entry?.colour ?? entry?.color, {
        maxLength: 100,
        uppercase: true,
      });
      if (!colour) {
        addError(errors, `variants[${index}].colour`, 'colour is required and must be 100 characters or fewer');
      }

      const size = normalizeShortText(entry?.size, { maxLength: 20, uppercase: true });
      if (!size) {
        addError(errors, `variants[${index}].size`, 'size is required and must be 20 characters or fewer');
      }

      const price = parsePositiveNumber(entry?.price);
      if (!price.valid) {
        addError(errors, `variants[${index}].price`, 'price must be a number greater than 0');
      }

      const compareAtPrice = parseOptionalNumber(entry?.compareAtPrice ?? entry?.compare_at_price);
      if (!compareAtPrice.valid) {
        addError(
          errors,
          `variants[${index}].compareAtPrice`,
          'compareAtPrice must be greater than 0 when provided'
        );
      }

      if (
        price.valid &&
        compareAtPrice.valid &&
        compareAtPrice.value != null &&
        compareAtPrice.value < price.value
      ) {
        addError(
          errors,
          `variants[${index}].compareAtPrice`,
          'compareAtPrice must be greater than or equal to price'
        );
      }

      const stockQty = parseNonNegativeInteger(entry?.stockQty ?? entry?.stock_qty);
      if (!stockQty.valid) {
        addError(errors, `variants[${index}].stockQty`, 'stockQty must be a non-negative integer');
      }

      const isActive = parseBooleanLike(entry?.isActive ?? entry?.is_active, true);
      if (!isActive.valid) {
        addError(errors, `variants[${index}].isActive`, 'isActive must be boolean-like');
      }

      if (sku) {
        const skuKey = sku.toUpperCase();
        if (skuSet.has(skuKey)) {
          duplicateSkusInPayload.add(sku);
        } else {
          skuSet.add(skuKey);
        }
      }

      if (colour && size) {
        const comboKey = `${colour.toUpperCase()}::${size.toUpperCase()}`;
        if (variantComboSet.has(comboKey)) {
          duplicateVariantCombosInPayload.add(`${colour}/${size}`);
        } else {
          variantComboSet.add(comboKey);
        }
      }

      normalizedVariants.push({
        sku,
        colour,
        size,
        price: price.value,
        compareAtPrice: compareAtPrice.value,
        stockQty: stockQty.value,
        isActive: isActive.value,
      });
    });
  }

  const mediaInput = payload.media;
  const normalizedMedia = [];
  const sortOrders = new Set();
  let thumbnailCount = 0;
  let heroCount = 0;
  const shouldUsePlaceholderMedia =
    (!Array.isArray(mediaInput) || mediaInput.length === 0) && files.length === 0;

  if (shouldUsePlaceholderMedia) {
    normalizedMedia.push({
      sortOrder: 1,
      isThumbnail: true,
      isHero: true,
      altText: normalizedTranslations[0]?.name || null,
      file: null,
    });
  } else {
    if (!Array.isArray(mediaInput) || mediaInput.length === 0) {
      addError(errors, 'media', 'At least one product image is required');
    } else if (mediaInput.length > MAX_IMAGES_PER_PRODUCT) {
      addError(errors, 'media', `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
    }

    if (files.length > MAX_IMAGES_PER_PRODUCT) {
      addError(errors, 'media', `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
    }

    if (Array.isArray(mediaInput) && mediaInput.length !== files.length) {
      addError(errors, 'media', 'media metadata count must match uploaded file count');
    }

    if (Array.isArray(mediaInput)) {
      mediaInput.forEach((entry, index) => {
        const parsedSortOrder = parseSortOrder(entry?.sortOrder ?? entry?.sort_order, index + 1);
        if (!parsedSortOrder.valid) {
          addError(
            errors,
            `media[${index}].sortOrder`,
            `sortOrder must be an integer between 1 and ${MAX_IMAGES_PER_PRODUCT}`
          );
        }

        const isThumbnail = parseBooleanLike(entry?.isThumbnail ?? entry?.is_thumbnail, false);
        const isHero = parseBooleanLike(entry?.isHero ?? entry?.is_hero, false);
        if (!isThumbnail.valid) {
          addError(errors, `media[${index}].isThumbnail`, 'isThumbnail must be boolean-like');
        }
        if (!isHero.valid) {
          addError(errors, `media[${index}].isHero`, 'isHero must be boolean-like');
        }

        const altText = normalizeShortText(entry?.altText ?? entry?.alt_text, { maxLength: 255 });
        if ((entry?.altText ?? entry?.alt_text) && !altText) {
          addError(errors, `media[${index}].altText`, 'altText must be 255 characters or fewer');
        }

        if (parsedSortOrder.valid) {
          if (sortOrders.has(parsedSortOrder.value)) {
            addError(errors, 'media', 'Duplicate media sortOrder values are not allowed');
          } else {
            sortOrders.add(parsedSortOrder.value);
          }
        }

        if (isThumbnail.valid && isThumbnail.value) {
          thumbnailCount += 1;
        }

        if (isHero.valid && isHero.value) {
          heroCount += 1;
        }

        normalizedMedia.push({
          sortOrder: parsedSortOrder.value,
          isThumbnail: isThumbnail.value,
          isHero: isHero.value,
          altText,
          file: files[index] || null,
        });
      });
    }

    if (thumbnailCount !== 1) {
      addError(errors, 'media', 'Exactly one thumbnail image is required');
    }

    if (heroCount !== 1) {
      addError(errors, 'media', 'Exactly one hero image is required');
    }
  }

  throwValidationError(errors);

  if (duplicateSkusInPayload.size > 0) {
    throw new ProductHttpError(409, 'DUPLICATE_SKU', 'A variant SKU already exists in the request', {
      sku: `Duplicate SKU(s): ${Array.from(duplicateSkusInPayload).join(', ')}`,
    });
  }

  if (duplicateVariantCombosInPayload.size > 0) {
    throw new ProductHttpError(
      409,
      'DUPLICATE_VARIANT',
      'A variant colour/size combination is duplicated in the request',
      {
        variants: `Duplicate variant combination(s): ${Array.from(
          duplicateVariantCombosInPayload
        ).join(', ')}`,
      }
    );
  }

  return {
    productType,
    isActive: parsedStatus.value,
    translations: normalizedTranslations,
    categories: normalizedCategories,
    variants: normalizedVariants,
    media: normalizedMedia,
  };
}

async function cleanupUploadedFiles(supabase, bucketName, uploadedPaths) {
  if (!supabase || !uploadedPaths.length) {
    return;
  }

  try {
    await supabase.storage.from(bucketName).remove(uploadedPaths);
  } catch (cleanupError) {
    console.error(cleanupError);
  }
}

async function ensureProductExists(dbLike, productId, includeInactive = true) {
  const sql = includeInactive
    ? 'SELECT product_id FROM products WHERE product_id = ? LIMIT 1'
    : 'SELECT product_id FROM products WHERE product_id = ? AND is_active = 1 LIMIT 1';
  const [rows] = await dbLike.execute(sql, [productId]);
  return rows.length > 0;
}

function mapMySqlError(error) {
  if (error instanceof ProductHttpError) {
    return error;
  }

  if (error?.code === 'ER_DUP_ENTRY') {
    const message = String(error.sqlMessage || error.message || '');
    if (message.includes('uq_sku_code')) {
      return new ProductHttpError(
        409,
        'DUPLICATE_SKU',
        'A variant SKU already exists',
        { sku: 'sku must be unique across all product variants' }
      );
    }

    if (message.includes('uq_product_colour_size')) {
      return new ProductHttpError(
        409,
        'DUPLICATE_VARIANT',
        'A variant colour/size combination already exists',
        { variants: 'colour and size combinations must be unique per product' }
      );
    }

    if (
      message.includes('uq_product_sort_order') ||
      message.includes('uq_product_one_thumbnail') ||
      message.includes('uq_product_one_hero')
    ) {
      return new ProductHttpError(
        400,
        'VALIDATION_ERROR',
        'Invalid request data',
        { media: 'Media sortOrder, thumbnail, and hero assignments must be unique per product' }
      );
    }
  }

  if (error?.code === 'ER_NO_REFERENCED_ROW_2') {
    return new ProductHttpError(400, 'VALIDATION_ERROR', 'Invalid request data', {
      categories: 'One or more category IDs do not exist',
    });
  }

  return error;
}

async function createProduct({ db, supabase, bucketName, payload, files }) {
  const normalizedInput = normalizeCreatePayload(payload, files);
  const connection = await db.getConnection();
  const uploadedPaths = [];

  try {
    await connection.beginTransaction();

    const categoryIds = normalizedInput.categories.map((entry) => entry.categoryId);
    const [categoryRows] = await connection.execute(
      `SELECT category_id
       FROM category
       WHERE category_id IN (${createPlaceholders(categoryIds)})`,
      categoryIds
    );

    if (categoryRows.length !== new Set(categoryIds).size) {
      const foundIds = new Set(categoryRows.map((row) => Number(row.category_id)));
      const missingIds = categoryIds.filter((categoryId) => !foundIds.has(categoryId));
      throw new ProductHttpError(400, 'VALIDATION_ERROR', 'Invalid request data', {
        categories: `Unknown category IDs: ${missingIds.join(', ')}`,
      });
    }

    const skus = normalizedInput.variants.map((entry) => entry.sku);
    const [skuRows] = await connection.execute(
      `SELECT sku_code
       FROM product_variant
       WHERE sku_code IN (${createPlaceholders(skus)})`,
      skus
    );

    if (skuRows.length > 0) {
      throw new ProductHttpError(409, 'DUPLICATE_SKU', 'A variant SKU already exists', {
        sku: `Duplicate SKU(s): ${skuRows.map((row) => row.sku_code).join(', ')}`,
      });
    }

    const [productInsertResult] = await connection.execute(
      `INSERT INTO products (product_type, is_active)
       VALUES (?, ?)`,
      [normalizedInput.productType, normalizedInput.isActive ? 1 : 0]
    );
    const productId = productInsertResult.insertId;

    for (const translation of normalizedInput.translations) {
      await connection.execute(
        `INSERT INTO product_translation (product_id, language_code, name, description)
         VALUES (?, ?, ?, ?)`,
        [productId, translation.languageCode, translation.name, translation.description]
      );
    }

    for (const category of normalizedInput.categories) {
      await connection.execute(
        `INSERT INTO product_category (product_id, category_id, is_primary)
         VALUES (?, ?, ?)`,
        [productId, category.categoryId, category.isPrimary ? 1 : 0]
      );
    }

    for (const variant of normalizedInput.variants) {
      await connection.execute(
        `INSERT INTO product_variant
          (product_id, sku_code, colour, size, price, compare_at_price, stock_qty, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          variant.sku,
          variant.colour,
          variant.size,
          variant.price,
          variant.compareAtPrice,
          variant.stockQty,
          variant.isActive ? 1 : 0,
        ]
      );
    }

    for (const mediaEntry of normalizedInput.media) {
      let uploadedPath = buildPlaceholderMediaPath(productId, mediaEntry.sortOrder);
      let publicUrl = DEFAULT_PRODUCT_MEDIA_URL;
      let mediaBucketName = DEFAULT_PRODUCT_MEDIA_BUCKET;

      if (mediaEntry.file && supabase && supabase.storage) {
        const storageBucket = supabase.storage.from(bucketName);
        uploadedPath = buildStoragePath(productId, mediaEntry.file.originalname);

        const { error: uploadError } = await storageBucket.upload(uploadedPath, mediaEntry.file.buffer, {
          contentType: mediaEntry.file.mimetype,
          upsert: false,
        });

        if (uploadError) {
          throw new ProductHttpError(
            500,
            'STORAGE_UPLOAD_FAILED',
            uploadError.message || 'Failed to upload image to storage'
          );
        }

        uploadedPaths.push(uploadedPath);

        const { data: publicUrlData } = storageBucket.getPublicUrl(uploadedPath);
        publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) {
          throw new ProductHttpError(
            500,
            'PUBLIC_URL_FAILED',
            'Failed to generate a public URL for an uploaded image'
          );
        }

        mediaBucketName = bucketName;
      }

      await connection.execute(
        `INSERT INTO product_media
          (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          productId,
          mediaBucketName,
          uploadedPath,
          publicUrl,
          mediaEntry.altText,
          mediaEntry.sortOrder,
          mediaEntry.isThumbnail ? 1 : 0,
          mediaEntry.isHero ? 1 : 0,
        ]
      );
    }

    await connection.commit();
    return { productId };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    await cleanupUploadedFiles(supabase, bucketName, uploadedPaths);
    throw mapMySqlError(error);
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function listProductImages({ db, productId, includeInactive = true }) {
  const exists = await ensureProductExists(db, productId, includeInactive);
  if (!exists) {
    throw new ProductHttpError(
      404,
      'PRODUCT_NOT_FOUND',
      `Product with id ${productId} was not found`
    );
  }

  const [rows] = await db.execute(
    `SELECT product_media_id, product_id, bucket_name, file_path, public_url, alt_text, sort_order,
            is_thumbnail, is_hero, created_at
     FROM product_media
     WHERE product_id = ?
     ORDER BY sort_order ASC, product_media_id ASC`,
    [productId]
  );

  return rows.map(mapMediaRowToApi);
}

async function uploadProductImage({
  db,
  supabase,
  bucketName,
  productId,
  file,
  isThumbnail,
  isHero,
  sortOrder,
  altText,
}) {
  if (!supabase || !supabase.storage) {
    throw new ProductHttpError(
      500,
      'SUPABASE_NOT_CONFIGURED',
      'Supabase credentials are not configured'
    );
  }

  const exists = await ensureProductExists(db, productId, true);
  if (!exists) {
    throw new ProductHttpError(
      404,
      'PRODUCT_NOT_FOUND',
      `Product with id ${productId} was not found`
    );
  }

  const [imageCountRows] = await db.execute(
    'SELECT COUNT(*) AS image_count FROM product_media WHERE product_id = ?',
    [productId]
  );
  const imageCount = Number(imageCountRows[0]?.image_count || 0);
  if (imageCount >= MAX_IMAGES_PER_PRODUCT) {
    throw new ProductHttpError(
      409,
      'PRODUCT_IMAGE_LIMIT_REACHED',
      `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`
    );
  }

  let finalSortOrder = sortOrder;
  if (finalSortOrder == null) {
    const [sortOrderRows] = await db.execute(
      'SELECT COALESCE(MAX(sort_order), 0) AS max_sort_order FROM product_media WHERE product_id = ?',
      [productId]
    );
    finalSortOrder = Number(sortOrderRows[0]?.max_sort_order || 0) + 1;
  }

  if (finalSortOrder < 1 || finalSortOrder > MAX_IMAGES_PER_PRODUCT) {
    throw new ProductHttpError(
      400,
      'VALIDATION_ERROR',
      'Invalid request data',
      {
        sortOrder: `sortOrder must be an integer between 1 and ${MAX_IMAGES_PER_PRODUCT}`,
      }
    );
  }

  const uploadedPath = buildStoragePath(productId, file.originalname);
  const storageBucket = supabase.storage.from(bucketName);

  try {
    const { error: uploadError } = await storageBucket.upload(uploadedPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

    if (uploadError) {
      throw new ProductHttpError(
        500,
        'STORAGE_UPLOAD_FAILED',
        uploadError.message || 'Failed to upload image to storage'
      );
    }

    const { data: publicUrlData } = storageBucket.getPublicUrl(uploadedPath);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      throw new ProductHttpError(500, 'PUBLIC_URL_FAILED', 'Failed to generate public URL');
    }

    const [insertResult] = await db.execute(
      `INSERT INTO product_media
        (product_id, bucket_name, file_path, public_url, alt_text, sort_order, is_thumbnail, is_hero)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        bucketName,
        uploadedPath,
        publicUrl,
        altText,
        finalSortOrder,
        isThumbnail ? 1 : 0,
        isHero ? 1 : 0,
      ]
    );

    const [createdRows] = await db.execute(
      `SELECT product_media_id, product_id, bucket_name, file_path, public_url, alt_text, sort_order,
              is_thumbnail, is_hero, created_at
       FROM product_media
       WHERE product_media_id = ?
       LIMIT 1`,
      [insertResult.insertId]
    );

    return createdRows[0]
      ? mapMediaRowToApi(createdRows[0])
      : {
          productMediaId: insertResult.insertId,
          productId,
          bucketName,
          filePath: uploadedPath,
          publicUrl,
          altText,
          sortOrder: finalSortOrder,
          isThumbnail,
          isHero,
          createdAt: new Date().toISOString(),
        };
  } catch (error) {
    await cleanupUploadedFiles(supabase, bucketName, [uploadedPath]);
    throw mapMySqlError(error);
  }
}

async function listProducts({ db, languageCode = 'EN', includeInactive = false }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const [rows] = await db.execute(
    `WITH ranked_translations AS (
       SELECT
         pt.product_id,
         pt.language_code,
         pt.name,
         pt.description,
         ROW_NUMBER() OVER (
           PARTITION BY pt.product_id
           ORDER BY
             CASE
               WHEN pt.language_code = ? THEN 0
               WHEN pt.language_code = 'EN' THEN 1
               ELSE 2
             END,
             pt.product_translation_id ASC
         ) AS translation_rank
       FROM product_translation pt
     ),
     ranked_categories AS (
       SELECT
         pc.product_id,
         pc.category_id,
         COALESCE(ct.name, c.category_name) AS category_name,
         ROW_NUMBER() OVER (
           PARTITION BY pc.product_id
           ORDER BY
             CASE WHEN pc.is_primary = 1 THEN 0 ELSE 1 END,
             pc.product_category_id ASC
         ) AS category_rank
     FROM product_category pc
     INNER JOIN category c
       ON c.category_id = pc.category_id
       AND c.is_hidden = 0
     LEFT JOIN category_translation ct
       ON ct.category_id = c.category_id
       AND ct.language_code = ?
     ),
     ranked_media AS (
       SELECT
         pm.product_id,
         pm.public_url,
         pm.alt_text,
         ROW_NUMBER() OVER (
           PARTITION BY pm.product_id
           ORDER BY
             CASE
               WHEN pm.is_thumbnail = 1 THEN 0
               WHEN pm.is_hero = 1 THEN 1
               ELSE 2
             END,
             pm.sort_order ASC,
             pm.product_media_id ASC
         ) AS media_rank
       FROM product_media pm
     ),
     variant_summary AS (
       SELECT
         pv.product_id,
         MIN(pv.price) AS min_price,
         MIN(pv.compare_at_price) AS min_compare_at_price,
         SUM(pv.stock_qty) AS total_stock,
         COUNT(*) AS variant_count
       FROM product_variant pv
       WHERE pv.is_active = 1
       GROUP BY pv.product_id
     )
     SELECT
       p.product_id,
       p.product_type,
       p.is_active,
       p.created_at,
       p.updated_at,
       rt.language_code,
       rt.name,
       rt.description,
       rc.category_id AS primary_category_id,
       rc.category_name AS primary_category_name,
       rm.public_url AS thumbnail_url,
       rm.alt_text AS thumbnail_alt,
       vs.min_price,
       vs.min_compare_at_price,
       vs.total_stock,
       vs.variant_count
     FROM products p
     INNER JOIN ranked_translations rt
       ON rt.product_id = p.product_id
       AND rt.translation_rank = 1
     LEFT JOIN ranked_categories rc
       ON rc.product_id = p.product_id
       AND rc.category_rank = 1
     LEFT JOIN ranked_media rm
       ON rm.product_id = p.product_id
       AND rm.media_rank = 1
     LEFT JOIN variant_summary vs
       ON vs.product_id = p.product_id
     WHERE ? = 1 OR p.is_active = 1
     ORDER BY p.created_at DESC, p.product_id DESC`,
    [normalizedLanguageCode, normalizedLanguageCode, includeInactive ? 1 : 0]
  );

  return rows.map(mapProductSummaryRow);
}

async function listAdminProducts({
  db,
  languageCode = 'EN',
  page = 1,
  limit = 20,
  search = null,
  categoryId = null,
  includeInactive = true,
}) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const normalizedSearch =
    typeof search === 'string' && search.trim() !== '' ? search.trim().toLowerCase() : null;
  const normalizedCategoryId =
    Number.isInteger(categoryId) && categoryId > 0 ? categoryId : null;
  const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 20;
  const offset = (normalizedPage - 1) * normalizedLimit;

  const [rows] = await db.query(
    `WITH ranked_translations AS (
       SELECT
         pt.product_id,
         pt.language_code,
         pt.name,
         pt.description,
         ROW_NUMBER() OVER (
           PARTITION BY pt.product_id
           ORDER BY
             CASE
               WHEN pt.language_code = ? THEN 0
               WHEN pt.language_code = 'EN' THEN 1
               ELSE 2
             END,
             pt.product_translation_id ASC
         ) AS translation_rank
       FROM product_translation pt
     ),
     ranked_categories AS (
       SELECT
         pc.product_id,
         pc.category_id,
         COALESCE(ct.name, c.category_name) AS category_name,
         COALESCE(parent_c.category_id, c.category_id) AS root_category_id,
         COALESCE(parent_ct.name, parent_c.category_name, ct.name, c.category_name) AS root_category_name,
         ROW_NUMBER() OVER (
           PARTITION BY pc.product_id
           ORDER BY
             CASE WHEN pc.is_primary = 1 THEN 0 ELSE 1 END,
             pc.product_category_id ASC
         ) AS category_rank
       FROM product_category pc
       INNER JOIN category c
         ON c.category_id = pc.category_id
       LEFT JOIN category_translation ct
         ON ct.category_id = c.category_id
         AND ct.language_code = ?
       LEFT JOIN category parent_c
         ON parent_c.category_id = c.parent_category_id
       LEFT JOIN category_translation parent_ct
         ON parent_ct.category_id = parent_c.category_id
         AND parent_ct.language_code = ?
     ),
     ranked_media AS (
       SELECT
         pm.product_id,
         pm.public_url,
         pm.alt_text,
         ROW_NUMBER() OVER (
           PARTITION BY pm.product_id
           ORDER BY
             CASE
               WHEN pm.is_thumbnail = 1 THEN 0
               WHEN pm.is_hero = 1 THEN 1
               ELSE 2
             END,
             pm.sort_order ASC,
             pm.product_media_id ASC
         ) AS media_rank
       FROM product_media pm
     ),
     variant_summary AS (
       SELECT
         pv.product_id,
         MIN(CASE WHEN pv.is_active = 1 THEN pv.price ELSE NULL END) AS min_price,
         MIN(CASE WHEN pv.is_active = 1 THEN pv.compare_at_price ELSE NULL END) AS min_compare_at_price,
         SUM(CASE WHEN pv.is_active = 1 THEN pv.stock_qty ELSE 0 END) AS total_stock,
         SUM(CASE WHEN pv.is_active = 1 THEN 1 ELSE 0 END) AS variant_count
       FROM product_variant pv
       GROUP BY pv.product_id
     )
     SELECT
       p.product_id,
       p.product_type,
       p.is_active,
       p.created_at,
       p.updated_at,
       rt.language_code,
       rt.name,
       rt.description,
       rc.category_id AS primary_category_id,
       rc.category_name AS primary_category_name,
       rc.root_category_id,
       rc.root_category_name,
       rm.public_url AS thumbnail_url,
       rm.alt_text AS thumbnail_alt,
       vs.min_price,
       vs.min_compare_at_price,
       vs.total_stock,
       vs.variant_count,
       COUNT(*) OVER() AS total_items
     FROM products p
     INNER JOIN ranked_translations rt
       ON rt.product_id = p.product_id
       AND rt.translation_rank = 1
     LEFT JOIN ranked_categories rc
       ON rc.product_id = p.product_id
       AND rc.category_rank = 1
     LEFT JOIN ranked_media rm
       ON rm.product_id = p.product_id
       AND rm.media_rank = 1
     LEFT JOIN variant_summary vs
       ON vs.product_id = p.product_id
     WHERE (? = 1 OR p.is_active = 1)
       AND (
         ? = 1 OR EXISTS (
           SELECT 1
           FROM product_translation pt_search
           WHERE pt_search.product_id = p.product_id
             AND LOWER(pt_search.name) LIKE ?
         )
       )
       AND (
         ? = 1 OR EXISTS (
           SELECT 1
           FROM product_category pc_filter
           INNER JOIN category c_filter
             ON c_filter.category_id = pc_filter.category_id
           WHERE pc_filter.product_id = p.product_id
             AND (
               c_filter.category_id = ?
               OR c_filter.parent_category_id = ?
             )
         )
       )
     ORDER BY p.created_at DESC, p.product_id DESC
     LIMIT ? OFFSET ?`,
    [
      normalizedLanguageCode,
      normalizedLanguageCode,
      normalizedLanguageCode,
      includeInactive ? 1 : 0,
      normalizedSearch ? 0 : 1,
      normalizedSearch ? `%${normalizedSearch}%` : '',
      normalizedCategoryId == null ? 1 : 0,
      normalizedCategoryId == null ? 0 : normalizedCategoryId,
      normalizedCategoryId == null ? 0 : normalizedCategoryId,
      normalizedLimit,
      offset,
    ]
  );

  const totalItems = rows.length > 0 ? Number(rows[0].total_items || 0) : 0;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    totalItems,
    totalPages: totalItems > 0 ? Math.ceil(totalItems / normalizedLimit) : 0,
    items: rows.map((row) => mapProductSummaryRow(row)),
  };
}

async function getProductDetail({ db, productId, languageCode = 'EN', includeInactive = false }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const [productRows] = await db.execute(
    `SELECT product_id, product_type, is_active, created_at, updated_at
     FROM products
     WHERE product_id = ?
       AND (? = 1 OR is_active = 1)
     LIMIT 1`,
    [productId, includeInactive ? 1 : 0]
  );

  const productRow = productRows[0];
  if (!productRow) {
    throw new ProductHttpError(
      404,
      'PRODUCT_NOT_FOUND',
      `Product with id ${productId} was not found`
    );
  }

  const [translationRows] = await db.execute(
    `SELECT product_translation_id, product_id, language_code, name, description, created_at, updated_at
     FROM product_translation
     WHERE product_id = ?
     ORDER BY
       CASE
         WHEN language_code = ? THEN 0
         WHEN language_code = 'EN' THEN 1
         ELSE 2
       END,
       product_translation_id ASC`,
    [productId, normalizedLanguageCode]
  );

  const [categoryRows] = await db.execute(
    `SELECT
       pc.category_id,
       pc.is_primary,
       c.slug,
       COALESCE(ct_requested.name, ct_en.name, c.category_name) AS localized_name
     FROM product_category pc
     INNER JOIN category c
       ON c.category_id = pc.category_id
     LEFT JOIN category_translation ct_requested
       ON ct_requested.category_id = c.category_id
       AND ct_requested.language_code = ?
     LEFT JOIN category_translation ct_en
       ON ct_en.category_id = c.category_id
       AND ct_en.language_code = 'EN'
     WHERE pc.product_id = ?
     ORDER BY
       CASE WHEN pc.is_primary = 1 THEN 0 ELSE 1 END,
       pc.product_category_id ASC`,
    [normalizedLanguageCode, productId]
  );

  const [variantRows] = await db.execute(
    `SELECT
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
     FROM product_variant
     WHERE product_id = ?
       AND (? = 1 OR is_active = 1)
     ORDER BY price ASC, product_variant_id ASC`,
    [productId, includeInactive ? 1 : 0]
  );

  const [mediaRows] = await db.execute(
    `SELECT product_media_id, product_id, bucket_name, file_path, public_url, alt_text, sort_order,
            is_thumbnail, is_hero, created_at
     FROM product_media
     WHERE product_id = ?
     ORDER BY sort_order ASC, product_media_id ASC`,
    [productId]
  );

  const translations = translationRows.map(mapTranslationRowToApi);
  const selectedTranslation = pickPreferredTranslation(translations, normalizedLanguageCode);

  return {
    productId: productRow.product_id,
    productType: productRow.product_type,
    isActive: productRow.is_active === 1 || productRow.is_active === true,
    status: productRow.is_active === 1 || productRow.is_active === true ? 'ACTIVE' : 'INACTIVE',
    languageCode: selectedTranslation?.languageCode || normalizedLanguageCode,
    name: selectedTranslation?.name || null,
    description: selectedTranslation?.description || null,
    translations,
    categories: categoryRows.map(mapCategoryRowToApi),
    variants: variantRows.map(mapVariantRowToApi),
    media: mediaRows.map(mapMediaRowToApi),
    createdAt:
      productRow.created_at instanceof Date
        ? productRow.created_at.toISOString()
        : productRow.created_at,
    updatedAt:
      productRow.updated_at instanceof Date
        ? productRow.updated_at.toISOString()
        : productRow.updated_at,
  };
}

async function updateAdminProduct({
  db,
  productId,
  payload,
  languageCode = 'EN',
}) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const body = payload && typeof payload === 'object' ? payload : {};
  const errors = {};

  const hasStatusInput = body.status !== undefined || body.isActive !== undefined || body.is_active !== undefined;
  const hasNameInput = body.name !== undefined;
  const hasDescriptionInput = body.description !== undefined;
  const hasCategoryInput = body.category_id !== undefined || body.categoryId !== undefined || body.category !== undefined;
  const hasSkuInput = body.sku !== undefined;
  const hasPriceInput = body.price !== undefined;
  const hasCompareAtInput =
    body.compare_at_price !== undefined ||
    body.compareAtPrice !== undefined ||
    body.discount_price !== undefined;
  const hasStockInput = body.stock !== undefined || body.stockQty !== undefined || body.stock_qty !== undefined;

  const hasVariantMutationInput = hasPriceInput || hasCompareAtInput || hasStockInput;
  const hasAnyUpdatableField =
    hasStatusInput ||
    hasNameInput ||
    hasDescriptionInput ||
    hasCategoryInput ||
    hasVariantMutationInput;

  if (!hasAnyUpdatableField) {
    throw new ProductHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
      fields: 'at least one updatable field is required',
    });
  }

  let nextStatus = null;
  if (hasStatusInput) {
    const parsedStatus = parseStatus(
      body.status !== undefined
        ? body.status
        : body.isActive !== undefined
        ? body.isActive
        : body.is_active
    );

    if (!parsedStatus.valid) {
      addError(errors, 'status', 'status must be ACTIVE or INACTIVE');
    } else {
      nextStatus = parsedStatus.value;
    }
  }

  let nextName = null;
  if (hasNameInput) {
    nextName = normalizeShortText(body.name, { maxLength: 150 });
    if (!nextName) {
      addError(errors, 'name', 'name is required and must be 150 characters or fewer');
    }
  }

  let nextDescription = null;
  if (hasDescriptionInput) {
    if (body.description === null) {
      nextDescription = null;
    } else {
      const normalizedDescription = String(body.description).trim();
      nextDescription = normalizedDescription ? normalizedDescription : null;
    }
  }

  let nextCategoryId = null;
  if (hasCategoryInput) {
    nextCategoryId = Number.parseInt(
      body.category_id !== undefined
        ? body.category_id
        : body.categoryId !== undefined
        ? body.categoryId
        : body.category,
      10
    );

    if (!Number.isInteger(nextCategoryId) || nextCategoryId <= 0) {
      addError(errors, 'category_id', 'category_id must be a positive integer');
    }
  }

  let targetSku = null;
  if (hasSkuInput) {
    targetSku = normalizeShortText(body.sku, { maxLength: 100, uppercase: true });
    if (!targetSku) {
      addError(errors, 'sku', 'sku must be 100 characters or fewer');
    }
  }

  let nextPrice = null;
  if (hasPriceInput) {
    const parsedPrice = parsePositiveNumber(body.price);
    if (!parsedPrice.valid) {
      addError(errors, 'price', 'price must be a number greater than 0');
    } else {
      nextPrice = parsedPrice.value;
    }
  }

  let nextCompareAtPrice = null;
  if (hasCompareAtInput) {
    const compareAtSource =
      body.compare_at_price !== undefined
        ? body.compare_at_price
        : body.compareAtPrice !== undefined
        ? body.compareAtPrice
        : body.discount_price;
    const parsedCompareAt = parseOptionalNumber(compareAtSource);
    if (!parsedCompareAt.valid) {
      addError(errors, 'compare_at_price', 'compare_at_price must be greater than 0 when provided');
    } else {
      nextCompareAtPrice = parsedCompareAt.value;
    }
  }

  let nextStockQty = null;
  if (hasStockInput) {
    const parsedStock = parseNonNegativeInteger(
      body.stock !== undefined
        ? body.stock
        : body.stockQty !== undefined
        ? body.stockQty
        : body.stock_qty
    );
    if (!parsedStock.valid) {
      addError(errors, 'stock', 'stock must be a non-negative integer');
    } else {
      nextStockQty = parsedStock.value;
    }
  }

  throwValidationError(errors);

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const productExists = await ensureProductExists(connection, productId, true);
    if (!productExists) {
      throw new ProductHttpError(
        404,
        'PRODUCT_NOT_FOUND',
        `product with id ${productId} was not found`
      );
    }

    if (hasStatusInput) {
      await connection.execute(
        `UPDATE products
         SET is_active = ?
         WHERE product_id = ?`,
        [nextStatus ? 1 : 0, productId]
      );
    }

    if (hasCategoryInput) {
      const [categoryRows] = await connection.execute(
        `SELECT category_id
         FROM category
         WHERE category_id = ?
         LIMIT 1`,
        [nextCategoryId]
      );

      if (categoryRows.length === 0) {
        throw new ProductHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
          category_id: `category ${nextCategoryId} does not exist`,
        });
      }

      await connection.execute(
        `UPDATE product_category
         SET is_primary = 0
         WHERE product_id = ?`,
        [productId]
      );

      await connection.execute(
        `INSERT INTO product_category (product_id, category_id, is_primary)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)`,
        [productId, nextCategoryId]
      );
    }

    if (hasNameInput || hasDescriptionInput) {
      const [translationRows] = await connection.execute(
        `SELECT language_code, name, description
         FROM product_translation
         WHERE product_id = ?
         ORDER BY
           CASE
             WHEN language_code = ? THEN 0
             WHEN language_code = 'EN' THEN 1
             ELSE 2
           END,
           product_translation_id ASC
         LIMIT 1`,
        [productId, normalizedLanguageCode]
      );

      const fallbackTranslation = translationRows[0] || null;
      const resolvedName = hasNameInput
        ? nextName
        : fallbackTranslation?.name || null;
      const resolvedDescription = hasDescriptionInput
        ? nextDescription
        : fallbackTranslation?.description || null;

      if (!resolvedName) {
        throw new ProductHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
          name: 'name is required when translation for selected language does not exist',
        });
      }

      await connection.execute(
        `INSERT INTO product_translation (product_id, language_code, name, description)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           description = VALUES(description)`,
        [productId, normalizedLanguageCode, resolvedName, resolvedDescription]
      );
    }

    if (hasVariantMutationInput) {
      let variantId = null;

      if (targetSku) {
        const [variantRows] = await connection.execute(
          `SELECT product_variant_id
           FROM product_variant
           WHERE product_id = ?
             AND UPPER(sku_code) = ?
           LIMIT 1`,
          [productId, targetSku.toUpperCase()]
        );

        if (variantRows.length === 0) {
          throw new ProductHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
            sku: `sku ${targetSku} was not found for product ${productId}`,
          });
        }

        variantId = Number(variantRows[0].product_variant_id);
      } else {
        const [variantRows] = await connection.execute(
          `SELECT product_variant_id
           FROM product_variant
           WHERE product_id = ?
           ORDER BY product_variant_id ASC`,
          [productId]
        );

        if (variantRows.length === 0) {
          throw new ProductHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
            variants: 'product does not have variants to update',
          });
        }

        if (variantRows.length > 1) {
          throw new ProductHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
            sku: 'sku is required when product has multiple variants',
          });
        }

        variantId = Number(variantRows[0].product_variant_id);
      }

      const updateColumns = [];
      const updateValues = [];

      if (hasPriceInput) {
        updateColumns.push('price = ?');
        updateValues.push(nextPrice);
      }

      if (hasCompareAtInput) {
        updateColumns.push('compare_at_price = ?');
        updateValues.push(nextCompareAtPrice);
      }

      if (hasStockInput) {
        updateColumns.push('stock_qty = ?');
        updateValues.push(nextStockQty);
      }

      await connection.execute(
        `UPDATE product_variant
         SET ${updateColumns.join(', ')}
         WHERE product_variant_id = ?`,
        [...updateValues, variantId]
      );
    }

    const updatedProduct = await getProductDetail({
      db: connection,
      productId,
      languageCode: normalizedLanguageCode,
      includeInactive: true,
    });

    await connection.commit();
    return updatedProduct;
  } catch (error) {
    await connection.rollback();
    throw mapMySqlError(error);
  } finally {
    connection.release();
  }
}

async function deleteAdminProduct({ db, productId, mode = 'SOFT' }) {
  const normalizedMode = String(mode || 'SOFT').trim().toUpperCase();
  if (!['SOFT', 'HARD'].includes(normalizedMode)) {
    throw new ProductHttpError(
      400,
      'INVALID_QUERY',
      'mode must be either SOFT or HARD'
    );
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const productExists = await ensureProductExists(connection, productId, true);
    if (!productExists) {
      throw new ProductHttpError(
        404,
        'PRODUCT_NOT_FOUND',
        `product with id ${productId} was not found`
      );
    }

    if (normalizedMode === 'HARD') {
      await connection.execute(
        `DELETE FROM products
         WHERE product_id = ?`,
        [productId]
      );
    } else {
      await connection.execute(
        `UPDATE products
         SET is_active = 0
         WHERE product_id = ?`,
        [productId]
      );

      await connection.execute(
        `UPDATE product_variant
         SET is_active = 0
         WHERE product_id = ?`,
        [productId]
      );
    }

    await connection.commit();

    return {
      productId,
      deleted: true,
      mode: normalizedMode,
    };
  } catch (error) {
    await connection.rollback();
    throw mapMySqlError(error);
  } finally {
    connection.release();
  }
}

function normalizeStorefrontOptions(values) {
  const seen = new Set();
  const normalizedValues = [];

  values.forEach((value) => {
    if (value === undefined || value === null) {
      return;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      return;
    }

    const dedupeKey = trimmed.toUpperCase();
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    normalizedValues.push(trimmed);
  });

  return normalizedValues;
}

function splitDelimitedValues(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return [];
  }

  return String(rawValue)
    .split('||')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function mapStorefrontCardRow(row, { includeCategory = true } = {}) {
  const price = Number(row.price);
  const compareAtPriceRaw =
    row.compare_at_price == null ? null : Number(row.compare_at_price);
  const originalPrice =
    typeof compareAtPriceRaw === 'number' &&
    Number.isFinite(compareAtPriceRaw) &&
    compareAtPriceRaw > price
      ? compareAtPriceRaw
      : null;

  const response = {
    productId: row.product_id,
    name: row.name,
    detail: row.description,
    color: normalizeStorefrontOptions(splitDelimitedValues(row.color_values)),
    price,
    originalPrice,
    discount: buildStorefrontDiscount(price, originalPrice),
    size: normalizeStorefrontOptions(splitDelimitedValues(row.size_values)),
    image: String(row.image_url).trim(),
    inStock: row.in_stock === 1 || row.in_stock === true,
  };

  if (!includeCategory) {
    return response;
  }

  response.category = row.category_id
    ? {
        categoryId: row.category_id,
        slug: row.category_slug,
        name: row.category_name,
      }
    : null;

  return response;
}

function resolveStorefrontOrderBy(sort, { allowRelevance = false } = {}) {
  switch (sort) {
    case 'price_asc':
      return 'price ASC, created_at DESC, product_id DESC';
    case 'price_desc':
      return 'price DESC, created_at DESC, product_id DESC';
    case 'newest':
      return 'created_at DESC, product_id DESC';
    case 'relevance':
      if (allowRelevance) {
        return 'relevance_rank ASC, created_at DESC, product_id DESC';
      }
      return 'created_at DESC, product_id DESC';
    default:
      return 'created_at DESC, product_id DESC';
  }
}

function buildStorefrontProductCardsBaseQuery({
  languageCode,
  queryText = null,
  categorySlug = null,
  includeRelevanceRank = false,
}) {
  const whereClauses = ['p.is_active = 1'];
  const selectParams = [];
  const whereParams = [];
  const normalizedQueryText =
    typeof queryText === 'string' && queryText.trim() ? queryText.trim().toLowerCase() : null;
  const normalizedCategorySlug =
    typeof categorySlug === 'string' && categorySlug.trim()
      ? categorySlug.trim().toLowerCase()
      : null;

  if (includeRelevanceRank && normalizedQueryText) {
    selectParams.push(normalizedQueryText, `${normalizedQueryText}%`);
  }

  if (normalizedQueryText) {
    whereClauses.push(
      `EXISTS (
         SELECT 1
         FROM product_translation pt_search
         WHERE pt_search.product_id = p.product_id
           AND LOWER(pt_search.name) LIKE ?
       )`
    );
    whereParams.push(`%${normalizedQueryText}%`);
  }

  if (normalizedCategorySlug) {
    whereClauses.push(
      `EXISTS (
         SELECT 1
         FROM product_category pc_filter
         INNER JOIN category c_filter
           ON c_filter.category_id = pc_filter.category_id
           AND c_filter.is_hidden = 0
         WHERE pc_filter.product_id = p.product_id
           AND LOWER(c_filter.slug) = ?
       )`
    );
    whereParams.push(normalizedCategorySlug);
  }

  const relevanceRankSelect =
    includeRelevanceRank && normalizedQueryText
      ? `CASE
           WHEN LOWER(rt.name) = ? THEN 0
           WHEN LOWER(rt.name) LIKE ? THEN 1
           ELSE 2
         END AS relevance_rank`
      : '2 AS relevance_rank';

  const sql = `WITH ranked_translations AS (
      SELECT
        pt.product_id,
        pt.language_code,
        pt.name,
        pt.description,
        ROW_NUMBER() OVER (
          PARTITION BY pt.product_id
          ORDER BY
            CASE
              WHEN pt.language_code = ? THEN 0
              WHEN pt.language_code = 'EN' THEN 1
              ELSE 2
            END,
            pt.product_translation_id ASC
        ) AS translation_rank
      FROM product_translation pt
    ),
    ranked_categories AS (
      SELECT
        pc.product_id,
        pc.category_id,
        c.slug,
        COALESCE(ct_requested.name, ct_en.name, c.category_name) AS category_name,
        ROW_NUMBER() OVER (
          PARTITION BY pc.product_id
          ORDER BY
            CASE WHEN pc.is_primary = 1 THEN 0 ELSE 1 END,
            pc.product_category_id ASC
        ) AS category_rank
      FROM product_category pc
      INNER JOIN category c
        ON c.category_id = pc.category_id
        AND c.is_hidden = 0
      LEFT JOIN category_translation ct_requested
        ON ct_requested.category_id = c.category_id
        AND ct_requested.language_code = ?
      LEFT JOIN category_translation ct_en
        ON ct_en.category_id = c.category_id
        AND ct_en.language_code = 'EN'
    ),
    ranked_media AS (
      SELECT
        pm.product_id,
        pm.public_url,
        ROW_NUMBER() OVER (
          PARTITION BY pm.product_id
          ORDER BY
            CASE
              WHEN pm.is_hero = 1 THEN 0
              WHEN pm.is_thumbnail = 1 THEN 1
              ELSE 2
            END,
            pm.sort_order ASC,
            pm.product_media_id ASC
        ) AS media_rank
      FROM product_media pm
      WHERE pm.public_url IS NOT NULL
        AND TRIM(pm.public_url) <> ''
    ),
    ranked_variants AS (
      SELECT
        pv.product_id,
        pv.price,
        pv.compare_at_price,
        ROW_NUMBER() OVER (
          PARTITION BY pv.product_id
          ORDER BY pv.price ASC, pv.product_variant_id ASC
        ) AS variant_rank
      FROM product_variant pv
      WHERE pv.is_active = 1
    ),
    variant_stock AS (
      SELECT
        pv.product_id,
        MAX(CASE WHEN pv.stock_qty > 0 THEN 1 ELSE 0 END) AS in_stock
      FROM product_variant pv
      WHERE pv.is_active = 1
      GROUP BY pv.product_id
    ),
    variant_options AS (
      SELECT
        pv.product_id,
        GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.colour), '') ORDER BY UPPER(TRIM(pv.colour)) SEPARATOR '||') AS color_values,
        GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.size), '') ORDER BY UPPER(TRIM(pv.size)) SEPARATOR '||') AS size_values
      FROM product_variant pv
      WHERE pv.is_active = 1
      GROUP BY pv.product_id
    )
    SELECT
      p.product_id,
      p.created_at AS created_at,
      rt.name,
      rt.description,
      rc.category_id,
      rc.slug AS category_slug,
      rc.category_name,
      rm.public_url AS image_url,
      rv.price,
      rv.compare_at_price,
      vs.in_stock,
      vo.color_values,
      vo.size_values,
      ${relevanceRankSelect},
      COUNT(*) OVER() AS total_items
    FROM products p
    INNER JOIN ranked_translations rt
      ON rt.product_id = p.product_id
      AND rt.translation_rank = 1
    LEFT JOIN ranked_categories rc
      ON rc.product_id = p.product_id
      AND rc.category_rank = 1
    INNER JOIN ranked_media rm
      ON rm.product_id = p.product_id
      AND rm.media_rank = 1
    INNER JOIN ranked_variants rv
      ON rv.product_id = p.product_id
      AND rv.variant_rank = 1
    INNER JOIN variant_stock vs
      ON vs.product_id = p.product_id
    LEFT JOIN variant_options vo
      ON vo.product_id = p.product_id
    WHERE ${whereClauses.join('\n      AND ')}`;

  return {
    sql,
    params: [languageCode, languageCode, ...selectParams, ...whereParams],
  };
}

async function fetchStorefrontProductCards({
  db,
  languageCode = 'EN',
  queryText = null,
  categorySlug = null,
  sort = 'newest',
  page = STORE_FRONT_PAGE_DEFAULT,
  limit = STORE_FRONT_LIMIT_DEFAULT,
  includeRelevanceRank = false,
}) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const normalizedPage = parsePage(page);
  const normalizedLimit = parseLimit(limit);
  const offset = (normalizedPage - 1) * normalizedLimit;
  const orderBy = resolveStorefrontOrderBy(sort, { allowRelevance: includeRelevanceRank });
  const { sql, params } = buildStorefrontProductCardsBaseQuery({
    languageCode: normalizedLanguageCode,
    queryText,
    categorySlug,
    includeRelevanceRank,
  });

  const [rows] = await db.query(
    `${sql}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, normalizedLimit, offset]
  );

  return {
    rows,
    page: normalizedPage,
    limit: normalizedLimit,
    totalItems: rows.length > 0 ? Number(rows[0].total_items || 0) : 0,
  };
}

function removeCategoryFromStorefrontDetail(detail) {
  return {
    productId: detail.productId,
    name: detail.name,
    detail: detail.detail,
    color: detail.color,
    price: detail.price,
    originalPrice: detail.originalPrice,
    discount: detail.discount,
    size: detail.size,
    image: detail.image,
    inStock: detail.inStock,
  };
}

async function listStorefrontFavoriteProducts({ db, userId, languageCode = 'EN' }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const [rows] = await db.execute(
    `WITH ranked_translations AS (
       SELECT
         pt.product_id,
         pt.name,
         pt.description,
         ROW_NUMBER() OVER (
           PARTITION BY pt.product_id
           ORDER BY
             CASE
               WHEN pt.language_code = ? THEN 0
               WHEN pt.language_code = 'EN' THEN 1
               ELSE 2
             END,
             pt.product_translation_id ASC
         ) AS translation_rank
       FROM product_translation pt
     ),
     ranked_media AS (
       SELECT
         pm.product_id,
         pm.public_url,
         ROW_NUMBER() OVER (
           PARTITION BY pm.product_id
           ORDER BY
             CASE
               WHEN pm.is_hero = 1 THEN 0
               WHEN pm.is_thumbnail = 1 THEN 1
               ELSE 2
             END,
             pm.sort_order ASC,
             pm.product_media_id ASC
         ) AS media_rank
       FROM product_media pm
       WHERE pm.public_url IS NOT NULL
         AND TRIM(pm.public_url) <> ''
     ),
     ranked_variants AS (
       SELECT
         pv.product_id,
         pv.price,
         pv.compare_at_price,
         ROW_NUMBER() OVER (
           PARTITION BY pv.product_id
           ORDER BY pv.price ASC, pv.product_variant_id ASC
         ) AS variant_rank
       FROM product_variant pv
       WHERE pv.is_active = 1
     ),
     variant_stock AS (
       SELECT
         pv.product_id,
         MAX(CASE WHEN pv.stock_qty > 0 THEN 1 ELSE 0 END) AS in_stock
       FROM product_variant pv
       WHERE pv.is_active = 1
       GROUP BY pv.product_id
     ),
     variant_options AS (
       SELECT
         pv.product_id,
         GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.colour), '') ORDER BY UPPER(TRIM(pv.colour)) SEPARATOR '||') AS color_values,
         GROUP_CONCAT(DISTINCT NULLIF(TRIM(pv.size), '') ORDER BY UPPER(TRIM(pv.size)) SEPARATOR '||') AS size_values
       FROM product_variant pv
       WHERE pv.is_active = 1
       GROUP BY pv.product_id
     )
     SELECT
       p.product_id,
       rt.name,
       rt.description,
       rm.public_url AS image_url,
       rv.price,
       rv.compare_at_price,
       vs.in_stock,
       vo.color_values,
       vo.size_values
     FROM wishlist w
     INNER JOIN products p
       ON p.product_id = w.product_id
       AND p.is_active = 1
     INNER JOIN ranked_translations rt
       ON rt.product_id = p.product_id
       AND rt.translation_rank = 1
     INNER JOIN ranked_media rm
       ON rm.product_id = p.product_id
       AND rm.media_rank = 1
     INNER JOIN ranked_variants rv
       ON rv.product_id = p.product_id
       AND rv.variant_rank = 1
     INNER JOIN variant_stock vs
       ON vs.product_id = p.product_id
     LEFT JOIN variant_options vo
       ON vo.product_id = p.product_id
     WHERE w.user_id = ?
     ORDER BY w.created_at DESC, w.wishlist_id DESC`,
    [normalizedLanguageCode, userId]
  );

  return rows.map((row) => mapStorefrontCardRow(row, { includeCategory: false }));
}

async function countStorefrontFavoriteProducts({ db, userId }) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS favorites_count
     FROM wishlist w
     INNER JOIN products p
       ON p.product_id = w.product_id
       AND p.is_active = 1
     INNER JOIN (
       SELECT DISTINCT product_id
       FROM product_variant
       WHERE is_active = 1
     ) active_variants
       ON active_variants.product_id = p.product_id
     INNER JOIN (
       SELECT DISTINCT product_id
       FROM product_media
       WHERE public_url IS NOT NULL
         AND TRIM(public_url) <> ''
     ) usable_media
       ON usable_media.product_id = p.product_id
     WHERE w.user_id = ?`,
    [userId]
  );

  return Number(rows[0]?.favorites_count || 0);
}

function pickStorefrontImage(media) {
  if (!Array.isArray(media) || media.length === 0) {
    return null;
  }

  const usableMedia = media.filter((entry) => {
    if (!entry || entry.publicUrl === undefined || entry.publicUrl === null) {
      return false;
    }

    return String(entry.publicUrl).trim().length > 0;
  });

  if (usableMedia.length === 0) {
    return null;
  }

  const sortedMedia = [...usableMedia].sort((left, right) => {
    const leftRank = left.isHero ? 0 : left.isThumbnail ? 1 : 2;
    const rightRank = right.isHero ? 0 : right.isThumbnail ? 1 : 2;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftSortOrder = Number.isFinite(Number(left.sortOrder))
      ? Number(left.sortOrder)
      : Number.POSITIVE_INFINITY;
    const rightSortOrder = Number.isFinite(Number(right.sortOrder))
      ? Number(right.sortOrder)
      : Number.POSITIVE_INFINITY;

    if (leftSortOrder !== rightSortOrder) {
      return leftSortOrder - rightSortOrder;
    }

    return left.productMediaId - right.productMediaId;
  });

  return String(sortedMedia[0].publicUrl).trim();
}

function buildStorefrontDiscount(price, originalPrice) {
  if (
    typeof price !== 'number' ||
    !Number.isFinite(price) ||
    price <= 0 ||
    typeof originalPrice !== 'number' ||
    !Number.isFinite(originalPrice) ||
    originalPrice <= price
  ) {
    return null;
  }

  const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
  if (discountPercent <= 0) {
    return null;
  }

  return {
    type: 'percentage',
    value: discountPercent,
  };
}

async function getStorefrontProductDetail({ db, productId, languageCode = 'EN' }) {
  const detail = await getProductDetail({
    db,
    productId,
    languageCode,
    includeInactive: false,
  });

  if (!Array.isArray(detail.variants) || detail.variants.length === 0) {
    throw new ProductHttpError(
      404,
      'PRODUCT_NOT_FOUND',
      `Product with id ${productId} was not found`
    );
  }

  const sortedVariants = [...detail.variants].sort((left, right) => {
    if (left.price !== right.price) {
      return left.price - right.price;
    }

    return left.productVariantId - right.productVariantId;
  });

  const cheapestVariant = sortedVariants[0];
  const imageUrl = pickStorefrontImage(detail.media);

  if (!imageUrl) {
    throw new ProductHttpError(
      404,
      'PRODUCT_NOT_FOUND',
      `Product with id ${productId} was not found`
    );
  }

  const activeVariantColors = normalizeStorefrontOptions(
    sortedVariants.map((entry) => entry.colour)
  );
  const activeVariantSizes = normalizeStorefrontOptions(
    sortedVariants.map((entry) => entry.size)
  );

  const categoryIds = detail.categories
    .map((entry) => Number(entry.categoryId))
    .filter((value) => Number.isInteger(value) && value > 0);
  const visibleCategoryIds = new Set(categoryIds);

  if (categoryIds.length > 0) {
    const [visibleRows] = await db.query(
      `SELECT category_id
       FROM category
       WHERE is_hidden = 0
         AND category_id IN (${createPlaceholders(categoryIds)})`,
      categoryIds
    );

    visibleCategoryIds.clear();
    visibleRows.forEach((row) => {
      visibleCategoryIds.add(Number(row.category_id));
    });
  }

  const visibleCategories = detail.categories.filter((entry) =>
    visibleCategoryIds.has(Number(entry.categoryId))
  );

  const primaryCategory =
    visibleCategories.find((entry) => entry.isPrimary) ||
    visibleCategories[0] ||
    null;

  const price = Number(cheapestVariant.price);
  const compareAtPriceRaw =
    cheapestVariant.compareAtPrice == null ? null : Number(cheapestVariant.compareAtPrice);
  const originalPrice =
    typeof compareAtPriceRaw === 'number' &&
    Number.isFinite(compareAtPriceRaw) &&
    compareAtPriceRaw > price
      ? compareAtPriceRaw
      : null;
  const discount = buildStorefrontDiscount(price, originalPrice);

  return {
    productId: detail.productId,
    name: detail.name,
    detail: detail.description,
    category: primaryCategory
      ? {
          categoryId: primaryCategory.categoryId,
          slug: primaryCategory.slug,
          name: primaryCategory.name,
        }
      : null,
    color: activeVariantColors,
    price,
    originalPrice,
    discount,
    size: activeVariantSizes,
    image: imageUrl,
    inStock: sortedVariants.some((entry) => entry.stockQty > 0),
  };
}

async function listUserFavorites({ db, userId, languageCode = 'EN' }) {
  const products = await listStorefrontFavoriteProducts({
    db,
    userId,
    languageCode,
  });

  return {
    favoritesCount: products.length,
    products,
  };
}

async function addProductToFavorites({
  db,
  userId,
  productId,
  languageCode = 'EN',
}) {
  const productDetail = await getStorefrontProductDetail({
    db,
    productId,
    languageCode,
  });

  await db.execute(
    `INSERT IGNORE INTO wishlist (user_id, product_id)
     VALUES (?, ?)`,
    [userId, productId]
  );

  const favoritesCount = await countStorefrontFavoriteProducts({ db, userId });

  return {
    productId,
    isFavorite: true,
    favoritesCount,
    product: removeCategoryFromStorefrontDetail(productDetail),
  };
}

async function removeProductFromFavorites({
  db,
  userId,
  productId,
  languageCode = 'EN',
}) {
  await getStorefrontProductDetail({
    db,
    productId,
    languageCode,
  });

  await db.execute(
    `DELETE FROM wishlist
     WHERE user_id = ?
       AND product_id = ?`,
    [userId, productId]
  );

  const favoritesCount = await countStorefrontFavoriteProducts({ db, userId });

  return {
    productId,
    isFavorite: false,
    favoritesCount,
  };
}

async function getStorefrontCategoryBySlug({ db, categorySlug, languageCode = 'EN' }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const normalizedCategorySlug =
    typeof categorySlug === 'string' ? categorySlug.trim().toLowerCase() : '';

  const [rows] = await db.execute(
    `SELECT
       c.category_id,
       c.slug,
       COALESCE(ct_requested.name, ct_en.name, c.category_name) AS localized_name
     FROM category c
     LEFT JOIN category_translation ct_requested
       ON ct_requested.category_id = c.category_id
       AND ct_requested.language_code = ?
     LEFT JOIN category_translation ct_en
       ON ct_en.category_id = c.category_id
       AND ct_en.language_code = 'EN'
     WHERE LOWER(c.slug) = ?
       AND c.is_hidden = 0
     LIMIT 1`,
    [normalizedLanguageCode, normalizedCategorySlug]
  );

  const categoryRow = rows[0];
  if (!categoryRow) {
    throw new ProductHttpError(
      404,
      'CATEGORY_NOT_FOUND',
      `category ${categorySlug} was not found`
    );
  }

  return {
    categoryId: categoryRow.category_id,
    slug: categoryRow.slug,
    name: categoryRow.localized_name,
  };
}

async function searchStorefrontProducts({
  db,
  queryText,
  languageCode = 'EN',
  page = STORE_FRONT_PAGE_DEFAULT,
  limit = STORE_FRONT_LIMIT_DEFAULT,
  sort = 'relevance',
}) {
  const normalizedSort = normalizeSortOption(sort, SEARCH_SORT_OPTIONS, 'relevance');
  const { rows, totalItems, limit: normalizedLimit, page: normalizedPage } =
    await fetchStorefrontProductCards({
      db,
      languageCode,
      queryText,
      sort: normalizedSort,
      page,
      limit,
      includeRelevanceRank: normalizedSort === 'relevance',
    });

  return {
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / normalizedLimit) : 0,
    },
    products: rows.map((row) => mapStorefrontCardRow(row, { includeCategory: true })),
  };
}

async function listStorefrontProductSuggestions({
  db,
  queryText,
  languageCode = 'EN',
  limit = STORE_FRONT_SUGGESTIONS_LIMIT,
}) {
  const normalizedLimit = Math.min(parseLimit(limit, STORE_FRONT_SUGGESTIONS_LIMIT), STORE_FRONT_SUGGESTIONS_LIMIT);
  const { rows } = await fetchStorefrontProductCards({
    db,
    languageCode,
    queryText,
    sort: 'relevance',
    page: 1,
    limit: normalizedLimit,
    includeRelevanceRank: true,
  });

  return rows.map((row) => mapStorefrontCardRow(row, { includeCategory: false }));
}

function buildStorefrontRecommendations({
  prioritizedRows,
  fallbackRows,
  excludeProductIds,
  limit,
}) {
  const seenProductIds = new Set(excludeProductIds);
  const products = [];

  const appendRows = (rows) => {
    for (const row of rows) {
      const productId = Number(row.product_id);
      if (!Number.isInteger(productId) || seenProductIds.has(productId)) {
        continue;
      }

      seenProductIds.add(productId);
      products.push(mapStorefrontCardRow(row, { includeCategory: false }));

      if (products.length >= limit) {
        return;
      }
    }
  };

  appendRows(prioritizedRows);
  if (products.length < limit) {
    appendRows(fallbackRows);
  }

  return products;
}

async function listStorefrontProductRecommendations({
  db,
  languageCode = 'EN',
  limit = STORE_FRONT_RECOMMENDATIONS_LIMIT_DEFAULT,
  context = null,
  category = null,
  excludeProductIds = [],
}) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const normalizedContext = parseRecommendationContext(context);
  const normalizedCategorySlug = parseRecommendationCategorySlug(category);
  const normalizedLimit = parseRecommendationsLimit(limit);
  const excludedProductIds = parseExcludeProductIds(excludeProductIds);
  const candidateLimit = Math.min(
    STORE_FRONT_LIMIT_MAX,
    Math.max(normalizedLimit * 3, normalizedLimit + excludedProductIds.length + 8)
  );

  let prioritizedRows = [];
  if (normalizedCategorySlug) {
    const prioritizedResult = await fetchStorefrontProductCards({
      db,
      languageCode: normalizedLanguageCode,
      categorySlug: normalizedCategorySlug,
      sort: 'newest',
      page: 1,
      limit: candidateLimit,
    });
    prioritizedRows = prioritizedResult.rows;
  }

  const fallbackResult = await fetchStorefrontProductCards({
    db,
    languageCode: normalizedLanguageCode,
    sort: 'newest',
    page: 1,
    limit: candidateLimit,
  });

  const products = buildStorefrontRecommendations({
    prioritizedRows,
    fallbackRows: fallbackResult.rows,
    excludeProductIds: excludedProductIds,
    limit: normalizedLimit,
  });

  return {
    context: normalizedContext,
    limit: normalizedLimit,
    products,
  };
}

async function listStorefrontProductsByCategory({
  db,
  categorySlug,
  languageCode = 'EN',
  page = STORE_FRONT_PAGE_DEFAULT,
  limit = STORE_FRONT_LIMIT_DEFAULT,
  sort = 'newest',
}) {
  const category = await getStorefrontCategoryBySlug({
    db,
    categorySlug,
    languageCode,
  });

  const normalizedSort = normalizeSortOption(sort, CATEGORY_SORT_OPTIONS, 'newest');
  const { rows, totalItems, limit: normalizedLimit, page: normalizedPage } =
    await fetchStorefrontProductCards({
      db,
      languageCode,
      categorySlug,
      sort: normalizedSort,
      page,
      limit,
    });

  return {
    category,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / normalizedLimit) : 0,
    },
    products: rows.map((row) => mapStorefrontCardRow(row, { includeCategory: false })),
  };
}

async function listNewArrivals({ db, languageCode = 'EN' }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const [rows] = await db.execute(
    `WITH ranked_translations AS (
       SELECT
         pt.product_id,
         pt.language_code,
         pt.name,
         ROW_NUMBER() OVER (
           PARTITION BY pt.product_id
           ORDER BY
             CASE
               WHEN pt.language_code = ? THEN 0
               WHEN pt.language_code = 'EN' THEN 1
               ELSE 2
             END,
             pt.product_translation_id ASC
         ) AS translation_rank
       FROM product_translation pt
     ),
     ranked_media AS (
       SELECT
         pm.product_id,
         pm.public_url,
         pm.alt_text,
         ROW_NUMBER() OVER (
           PARTITION BY pm.product_id
           ORDER BY
             CASE
               WHEN pm.is_thumbnail = 1 THEN 0
               WHEN pm.is_hero = 1 THEN 1
               ELSE 2
             END,
             pm.sort_order ASC,
             pm.product_media_id ASC
         ) AS media_rank
       FROM product_media pm
     ),
     ranked_variants AS (
       SELECT
         pv.product_id,
         pv.price,
         pv.compare_at_price,
         ROW_NUMBER() OVER (
           PARTITION BY pv.product_id
           ORDER BY pv.price ASC, pv.product_variant_id ASC
         ) AS variant_rank
       FROM product_variant pv
       WHERE pv.is_active = 1
     ),
     variant_stock AS (
       SELECT
         pv.product_id,
         MAX(CASE WHEN pv.stock_qty > 0 THEN 1 ELSE 0 END) AS in_stock
       FROM product_variant pv
       WHERE pv.is_active = 1
       GROUP BY pv.product_id
     )
     SELECT
       p.product_id,
       p.created_at,
       rt.language_code,
       rt.name,
       rm.public_url,
       rm.alt_text,
       rv.price,
       rv.compare_at_price,
       vs.in_stock
     FROM products p
     INNER JOIN ranked_translations rt
       ON rt.product_id = p.product_id
       AND rt.translation_rank = 1
     INNER JOIN ranked_media rm
       ON rm.product_id = p.product_id
       AND rm.media_rank = 1
     INNER JOIN ranked_variants rv
       ON rv.product_id = p.product_id
       AND rv.variant_rank = 1
     INNER JOIN variant_stock vs
       ON vs.product_id = p.product_id
     WHERE p.is_active = 1
     ORDER BY p.created_at DESC, p.product_id DESC
     LIMIT ${NEW_ARRIVALS_LIMIT}`,
    [normalizedLanguageCode]
  );

  return rows.map((row) => {
    const price = Number(row.price);
    const compareAtPrice =
      row.compare_at_price == null ? null : Number(row.compare_at_price);

    return {
      productId: row.product_id,
      languageCode: row.language_code,
      name: row.name,
      imageUrl: row.public_url,
      imageAlt: row.alt_text && row.alt_text.trim() ? row.alt_text.trim() : row.name,
      price,
      compareAtPrice,
      discountPercent:
        compareAtPrice && compareAtPrice > price
          ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
          : null,
      inStock: row.in_stock === 1 || row.in_stock === true,
      createdAt:
        row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
  });
}

function mapAddressRowToCheckoutAddress(row) {
  if (!row) {
    return null;
  }

  return {
    fullName: row.full_name,
    phoneNumber: row.phone,
    addressLine1: row.line1,
    addressLine2: row.line2,
    district: row.district,
    province: row.province,
    postalCode: row.postcode,
    country: row.country,
  };
}

function buildCheckoutAddressSnapshot(row) {
  if (!row) {
    return null;
  }

  return JSON.stringify({
    fullName: row.full_name,
    phoneNumber: row.phone,
    addressLine1: row.line1,
    addressLine2: row.line2,
    district: row.district,
    province: row.province,
    postalCode: row.postcode,
    country: row.country,
  });
}

async function getCheckoutAddress({ db, userId }) {
  const [rows] = await db.execute(
    `SELECT
       address_id,
       full_name,
       phone,
       line1,
       line2,
       district,
       province,
       postcode,
       country,
       is_default_shipping,
       updated_at
     FROM address
     WHERE user_id = ?
     ORDER BY is_default_shipping DESC, updated_at DESC, address_id DESC
     LIMIT 1`,
    [userId]
  );

  return {
    address: mapAddressRowToCheckoutAddress(rows[0] || null),
  };
}

async function upsertCheckoutAddress({ db, userId, payload }) {
  const normalizedPayload = validateCheckoutAddressPayload(payload);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [defaultShippingRows] = await connection.execute(
      `SELECT address_id
       FROM address
       WHERE user_id = ?
         AND is_default_shipping = 1
       ORDER BY updated_at DESC, address_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    let targetAddressId = defaultShippingRows[0]?.address_id || null;

    if (!targetAddressId) {
      const [latestRows] = await connection.execute(
        `SELECT address_id
         FROM address
         WHERE user_id = ?
         ORDER BY updated_at DESC, address_id DESC
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );

      targetAddressId = latestRows[0]?.address_id || null;
    }

    if (targetAddressId) {
      await connection.execute(
        `UPDATE address
         SET
           full_name = ?,
           phone = ?,
           line1 = ?,
           line2 = ?,
           district = ?,
           province = ?,
           postcode = ?,
           country = ?,
           is_default_shipping = 1
         WHERE address_id = ?
           AND user_id = ?`,
        [
          normalizedPayload.fullName,
          normalizedPayload.phoneNumber,
          normalizedPayload.addressLine1,
          normalizedPayload.addressLine2,
          normalizedPayload.district,
          normalizedPayload.province,
          normalizedPayload.postalCode,
          normalizedPayload.country,
          targetAddressId,
          userId,
        ]
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO address (
          user_id,
          full_name,
          phone,
          line1,
          line2,
          district,
          province,
          postcode,
          country,
          is_default_shipping,
          is_default_billing
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [
          userId,
          normalizedPayload.fullName,
          normalizedPayload.phoneNumber,
          normalizedPayload.addressLine1,
          normalizedPayload.addressLine2,
          normalizedPayload.district,
          normalizedPayload.province,
          normalizedPayload.postalCode,
          normalizedPayload.country,
        ]
      );
      targetAddressId = insertResult.insertId;
    }

    await connection.execute(
      `UPDATE address
       SET is_default_shipping = 0
       WHERE user_id = ?
         AND address_id <> ?
         AND is_default_shipping = 1`,
      [userId, targetAddressId]
    );

    const [rows] = await connection.execute(
      `SELECT
         address_id,
         full_name,
         phone,
         line1,
         line2,
         district,
         province,
         postcode,
         country
       FROM address
       WHERE address_id = ?
         AND user_id = ?
       LIMIT 1`,
      [targetAddressId, userId]
    );

    await connection.commit();

    return {
      address: mapAddressRowToCheckoutAddress(rows[0] || null),
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    throw error;
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function completeCheckoutPurchase({ db, userId }) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [cartRows] = await connection.execute(
      `SELECT cart_id
       FROM cart
       WHERE user_id = ?
         AND status = 'ACTIVE'
       ORDER BY cart_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    const cartRow = cartRows[0];
    if (!cartRow) {
      throw new ProductHttpError(409, 'CART_EMPTY', 'cart is empty');
    }

    const cartId = Number(cartRow.cart_id);

    const [itemRows] = await connection.execute(
      `SELECT
         ci.cart_item_id,
         ci.quantity,
         pv.product_variant_id,
         pv.product_id,
         pv.colour,
         pv.size,
         pv.price,
         pv.compare_at_price,
         pv.stock_qty,
         pv.is_active AS variant_is_active,
         p.is_active AS product_is_active,
         COALESCE(pt_en.name, CONCAT('Product #', p.product_id)) AS product_name
       FROM cart_item ci
       INNER JOIN product_variant pv
         ON pv.product_variant_id = ci.product_variant_id
       INNER JOIN products p
         ON p.product_id = pv.product_id
       LEFT JOIN product_translation pt_en
         ON pt_en.product_id = p.product_id
         AND pt_en.language_code = 'EN'
       WHERE ci.cart_id = ?
       ORDER BY ci.cart_item_id ASC
       FOR UPDATE`,
      [cartId]
    );

    if (!itemRows.length) {
      throw new ProductHttpError(409, 'CART_EMPTY', 'cart is empty');
    }

    const unavailableItem = itemRows.find(
      (row) => !(row.variant_is_active === 1 || row.variant_is_active === true) ||
        !(row.product_is_active === 1 || row.product_is_active === true)
    );
    if (unavailableItem) {
      throw new ProductHttpError(
        409,
        'CART_ITEM_UNAVAILABLE',
        'cart contains unavailable items'
      );
    }

    const insufficientStockItem = itemRows.find((row) => Number(row.stock_qty) < Number(row.quantity));
    if (insufficientStockItem) {
      throw new ProductHttpError(
        409,
        'INSUFFICIENT_STOCK',
        'requested quantity exceeds available stock'
      );
    }

    const [addressRows] = await connection.execute(
      `SELECT
         address_id,
         full_name,
         phone,
         line1,
         line2,
         district,
         province,
         postcode,
         country
       FROM address
       WHERE user_id = ?
       ORDER BY is_default_shipping DESC, updated_at DESC, address_id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    const addressRow = addressRows[0];
    if (!addressRow) {
      throw new ProductHttpError(
        400,
        'CHECKOUT_ADDRESS_REQUIRED',
        'checkout address is required before purchase'
      );
    }

    const subtotal = Number(
      itemRows
        .reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0)
        .toFixed(2)
    );
    const shippingFee = 0;
    const vatAmount = 0;
    const total = Number((subtotal + shippingFee + vatAmount).toFixed(2));
    const addressSnapshot = buildCheckoutAddressSnapshot(addressRow);

    const [orderInsert] = await connection.execute(
      `INSERT INTO orders (
         user_id,
         shipping_address_id,
         billing_address_id,
         status,
         subtotal,
         shipping_fee,
         vat_amount,
         total,
         shipping_address_snapshot,
         billing_address_snapshot
       )
       VALUES (?, ?, ?, 'PURCHASED', ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        addressRow.address_id,
        addressRow.address_id,
        subtotal,
        shippingFee,
        vatAmount,
        total,
        addressSnapshot,
        addressSnapshot,
      ]
    );

    const orderId = Number(orderInsert.insertId);

    for (const row of itemRows) {
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.price);
      const compareAtPriceRaw = row.compare_at_price == null ? null : Number(row.compare_at_price);
      const compareAtPrice =
        Number.isFinite(compareAtPriceRaw) && compareAtPriceRaw > unitPrice
          ? compareAtPriceRaw
          : null;
      const lineTotal = Number((unitPrice * quantity).toFixed(2));

      await connection.execute(
        `INSERT INTO order_item (
           order_id,
           product_variant_id,
           snapshot_product_name,
           snapshot_color,
           snapshot_size,
           snapshot_unit_price,
           snapshot_compare_at_price,
           quantity,
           line_total
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          row.product_variant_id,
          row.product_name,
          row.colour,
          row.size,
          unitPrice,
          compareAtPrice,
          quantity,
          lineTotal,
        ]
      );

      const [stockResult] = await connection.execute(
        `UPDATE product_variant
         SET stock_qty = stock_qty - ?
         WHERE product_variant_id = ?
           AND stock_qty >= ?`,
        [quantity, row.product_variant_id, quantity]
      );

      if (Number(stockResult.affectedRows || 0) === 0) {
        throw new ProductHttpError(
          409,
          'INSUFFICIENT_STOCK',
          'requested quantity exceeds available stock'
        );
      }
    }

    await connection.execute(
      `DELETE FROM cart_item
       WHERE cart_id = ?`,
      [cartId]
    );

    await connection.execute(
      `UPDATE cart
       SET status = 'CONVERTED'
       WHERE cart_id = ?`,
      [cartId]
    );

    const [orderRows] = await connection.execute(
      `SELECT created_at
       FROM orders
       WHERE order_id = ?
         AND user_id = ?
       LIMIT 1`,
      [orderId, userId]
    );

    const purchasedAtRaw = orderRows[0]?.created_at || new Date();

    await connection.commit();

    return {
      orderId,
      orderStatus: 'PURCHASED',
      purchasedAt:
        purchasedAtRaw instanceof Date ? purchasedAtRaw.toISOString() : String(purchasedAtRaw),
      cartSummary: {
        totalItems: itemRows.reduce((sum, row) => sum + Number(row.quantity), 0),
        subtotal,
      },
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    throw error;
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

function buildEmptyCartResponse() {
  return {
    cartId: null,
    items: [],
    cartSummary: {
      totalItems: 0,
      subtotal: 0,
    },
  };
}

function normalizeCartOption(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  const normalized = String(rawValue).trim();
  return normalized.length > 0 ? normalized : null;
}

function parsePositiveIntegerQuantity(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { valid: false, value: null };
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { valid: false, value: null };
  }

  return { valid: true, value: parsed };
}

function mapCartLineToResponse({
  cartItemId,
  productId,
  name,
  color,
  size,
  price,
  compareAtPrice,
  stockQty,
  productIsActive = true,
  variantIsActive = true,
  imageUrl = null,
  quantityCartItem,
}) {
  const normalizedPrice = Number(price);
  const normalizedQuantity = Number(quantityCartItem);
  const compareAtPriceRaw = compareAtPrice == null ? null : Number(compareAtPrice);
  const originalPrice =
    typeof compareAtPriceRaw === 'number' &&
    Number.isFinite(compareAtPriceRaw) &&
    compareAtPriceRaw > normalizedPrice
      ? compareAtPriceRaw
      : normalizedPrice;

  const lineTotal = Number((normalizedPrice * normalizedQuantity).toFixed(2));

  const isProductActive = productIsActive === 1 || productIsActive === true;
  const isVariantActive = variantIsActive === 1 || variantIsActive === true;
  const inStock = isProductActive && isVariantActive && Number(stockQty) > 0;

  return {
    itemId: Number(cartItemId),
    productId: Number(productId),
    name,
    color,
    price: normalizedPrice,
    originalPrice,
    discount: buildStorefrontDiscount(normalizedPrice, originalPrice),
    size,
    image: imageUrl || null,
    inStock,
    quantityCartItem: normalizedQuantity,
    lineTotal,
  };
}

function buildCartSummary(items) {
  const totalItems = items.reduce((sum, item) => sum + item.quantityCartItem, 0);
  const subtotal = Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));

  return {
    totalItems,
    subtotal,
  };
}

async function getOrCreateActiveCartId({ connection, userId }) {
  const [cartRows] = await connection.execute(
    `SELECT cart_id
     FROM cart
     WHERE user_id = ?
       AND status = 'ACTIVE'
     ORDER BY cart_id DESC
     LIMIT 1`,
    [userId]
  );

  const existingCartId = cartRows[0]?.cart_id;
  if (existingCartId) {
    return Number(existingCartId);
  }

  try {
    const [insertResult] = await connection.execute(
      `INSERT INTO cart (user_id, status)
       VALUES (?, 'ACTIVE')`,
      [userId]
    );
    return Number(insertResult.insertId);
  } catch (error) {
    if (error?.code !== 'ER_DUP_ENTRY') {
      throw error;
    }

    const [retryRows] = await connection.execute(
      `SELECT cart_id
       FROM cart
       WHERE user_id = ?
         AND status = 'ACTIVE'
       ORDER BY cart_id DESC
       LIMIT 1`,
      [userId]
    );

    const retriedCartId = retryRows[0]?.cart_id;
    if (!retriedCartId) {
      throw error;
    }

    return Number(retriedCartId);
  }
}

async function addCartItem({
  db,
  userId,
  productId,
  color,
  size,
  quantityCartItem,
  languageCode = 'EN',
}) {
  const missing =
    productId === undefined ||
    color === undefined ||
    size === undefined ||
    quantityCartItem === undefined;

  if (missing) {
    throw new ProductHttpError(
      400,
      'INVALID_REQUEST',
      'productId, color, size, and quantityCartItem are required'
    );
  }

  const normalizedProductId = Number.parseInt(productId, 10);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId <= 0) {
    throw new ProductHttpError(
      400,
      'INVALID_PRODUCT_ID',
      'productId must be a positive integer'
    );
  }

  const parsedQuantity = parsePositiveIntegerQuantity(quantityCartItem);
  if (!parsedQuantity.valid) {
    throw new ProductHttpError(
      400,
      'INVALID_QUANTITY',
      'quantityCartItem must be a positive integer'
    );
  }

  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { product, variant, imageUrl } = await resolveCartLineContext({
      db: connection,
      productId: normalizedProductId,
      color,
      size,
      languageCode: normalizedLanguageCode,
    });

    const cartId = await getOrCreateActiveCartId({
      connection,
      userId,
    });

    const [existingRows] = await connection.execute(
      `SELECT cart_item_id, quantity
       FROM cart_item
       WHERE cart_id = ?
         AND product_variant_id = ?
       LIMIT 1
       FOR UPDATE`,
      [cartId, variant.productVariantId]
    );

    const existingItem = existingRows[0] || null;
    const existingQuantity = existingItem ? Number(existingItem.quantity) : 0;
    const requestedQuantity = parsedQuantity.value;
    const updatedQuantity = existingQuantity + requestedQuantity;

    if (updatedQuantity > Number(variant.stockQty)) {
      throw new ProductHttpError(
        409,
        'INSUFFICIENT_STOCK',
        'requested quantity exceeds available stock'
      );
    }

    let itemId;

    if (existingItem) {
      itemId = Number(existingItem.cart_item_id);
      await connection.execute(
        `UPDATE cart_item
         SET quantity = ?
         WHERE cart_item_id = ?`,
        [updatedQuantity, itemId]
      );
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO cart_item (cart_id, product_variant_id, quantity)
         VALUES (?, ?, ?)`,
        [cartId, variant.productVariantId, updatedQuantity]
      );
      itemId = Number(insertResult.insertId);
    }

    const cartData = await getUserCart({
      db: connection,
      userId,
      languageCode: normalizedLanguageCode,
    });

    const item =
      cartData.items.find((entry) => entry.itemId === itemId) ||
      mapCartLineToResponse({
        cartItemId: itemId,
        productId: product.productId,
        name: product.name,
        color: variant.colour,
        size: variant.size,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stockQty: variant.stockQty,
        productIsActive: product.isActive,
        variantIsActive: variant.isActive,
        imageUrl,
        quantityCartItem: updatedQuantity,
      });

    await connection.commit();

    return {
      cartId,
      item,
      cartSummary: cartData.cartSummary,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    throw error;
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function updateCartItemQuantity({
  db,
  userId,
  itemId,
  quantityCartItem,
  languageCode = 'EN',
}) {
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new ProductHttpError(
      400,
      'INVALID_ITEM_ID',
      'itemId must be a positive integer'
    );
  }

  const parsedQuantity = parsePositiveIntegerQuantity(quantityCartItem);
  if (!parsedQuantity.valid) {
    throw new ProductHttpError(
      400,
      'INVALID_QUANTITY',
      'quantityCartItem must be a positive integer'
    );
  }

  const normalizedLanguageCode = parseLanguageCode(languageCode).value;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [cartItemRows] = await connection.execute(
      `SELECT
         c.cart_id,
         ci.cart_item_id,
         pv.stock_qty
       FROM cart_item ci
       INNER JOIN cart c
         ON c.cart_id = ci.cart_id
       INNER JOIN product_variant pv
         ON pv.product_variant_id = ci.product_variant_id
       WHERE ci.cart_item_id = ?
         AND c.user_id = ?
         AND c.status = 'ACTIVE'
       LIMIT 1
       FOR UPDATE`,
      [itemId, userId]
    );

    const cartItemRow = cartItemRows[0];
    if (!cartItemRow) {
      throw new ProductHttpError(
        404,
        'CART_ITEM_NOT_FOUND',
        `cart item with id ${itemId} was not found`
      );
    }

    if (parsedQuantity.value > Number(cartItemRow.stock_qty)) {
      throw new ProductHttpError(
        409,
        'INSUFFICIENT_STOCK',
        'requested quantity exceeds available stock'
      );
    }

    await connection.execute(
      `UPDATE cart_item
       SET quantity = ?
       WHERE cart_item_id = ?`,
      [parsedQuantity.value, itemId]
    );

    const cartData = await getUserCart({
      db: connection,
      userId,
      languageCode: normalizedLanguageCode,
    });

    const item = cartData.items.find((entry) => entry.itemId === itemId);
    if (!item) {
      throw new ProductHttpError(
        500,
        'INTERNAL_SERVER_ERROR',
        'internal server error'
      );
    }

    await connection.commit();

    return {
      cartId: Number(cartItemRow.cart_id),
      item,
      cartSummary: cartData.cartSummary,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    throw error;
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function removeCartItem({ db, userId, itemId }) {
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new ProductHttpError(
      400,
      'INVALID_ITEM_ID',
      'itemId must be a positive integer'
    );
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [cartItemRows] = await connection.execute(
      `SELECT
         c.cart_id,
         ci.cart_item_id,
         pv.product_id
       FROM cart_item ci
       INNER JOIN cart c
         ON c.cart_id = ci.cart_id
       INNER JOIN product_variant pv
         ON pv.product_variant_id = ci.product_variant_id
       WHERE ci.cart_item_id = ?
         AND c.user_id = ?
         AND c.status = 'ACTIVE'
       LIMIT 1
       FOR UPDATE`,
      [itemId, userId]
    );

    const cartItemRow = cartItemRows[0];
    if (!cartItemRow) {
      throw new ProductHttpError(
        404,
        'CART_ITEM_NOT_FOUND',
        `cart item with id ${itemId} was not found`
      );
    }

    await connection.execute(
      `DELETE FROM cart_item
       WHERE cart_item_id = ?`,
      [itemId]
    );

    const [summaryRows] = await connection.execute(
      `SELECT
         COALESCE(SUM(ci.quantity), 0) AS total_items,
         COALESCE(SUM(ci.quantity * pv.price), 0) AS subtotal
       FROM cart_item ci
       INNER JOIN product_variant pv
         ON pv.product_variant_id = ci.product_variant_id
       WHERE ci.cart_id = ?`,
      [cartItemRow.cart_id]
    );

    const summaryRow = summaryRows[0] || {};

    await connection.commit();

    return {
      itemId,
      productId: Number(cartItemRow.product_id),
      cartSummary: {
        totalItems: Number(summaryRow.total_items || 0),
        subtotal: Number(summaryRow.subtotal || 0),
      },
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    throw error;
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function getUserCart({ db, userId, languageCode = 'EN' }) {
  const normalizedLanguageCode = parseLanguageCode(languageCode).value;

  const [cartRows] = await db.execute(
    `SELECT cart_id
     FROM cart
     WHERE user_id = ?
       AND status = 'ACTIVE'
     ORDER BY cart_id DESC
     LIMIT 1`,
    [userId]
  );

  const activeCartId = cartRows[0]?.cart_id;

  if (!activeCartId) {
    return buildEmptyCartResponse();
  }

  const [rows] = await db.execute(
    `WITH ranked_translations AS (
       SELECT
         pt.product_id,
         pt.name,
         ROW_NUMBER() OVER (
           PARTITION BY pt.product_id
           ORDER BY
             CASE
               WHEN pt.language_code = ? THEN 0
               WHEN pt.language_code = 'EN' THEN 1
               ELSE 2
             END,
             pt.product_translation_id ASC
         ) AS translation_rank
       FROM product_translation pt
     ),
     ranked_media AS (
       SELECT
         pm.product_id,
         pm.public_url,
         ROW_NUMBER() OVER (
           PARTITION BY pm.product_id
           ORDER BY
             CASE
               WHEN pm.is_hero = 1 THEN 0
               WHEN pm.is_thumbnail = 1 THEN 1
               ELSE 2
             END,
             pm.sort_order ASC,
             pm.product_media_id ASC
         ) AS media_rank
       FROM product_media pm
       WHERE pm.public_url IS NOT NULL
         AND TRIM(pm.public_url) <> ''
     )
     SELECT
       ci.cart_item_id,
       ci.quantity,
       p.product_id,
       rt.name,
       pv.colour,
       pv.size,
       pv.price,
       pv.compare_at_price,
       pv.stock_qty,
       pv.is_active AS variant_is_active,
       p.is_active AS product_is_active,
       rm.public_url AS image_url
     FROM cart_item ci
     INNER JOIN product_variant pv
       ON pv.product_variant_id = ci.product_variant_id
     INNER JOIN products p
       ON p.product_id = pv.product_id
     INNER JOIN ranked_translations rt
       ON rt.product_id = p.product_id
       AND rt.translation_rank = 1
     LEFT JOIN ranked_media rm
       ON rm.product_id = p.product_id
       AND rm.media_rank = 1
     WHERE ci.cart_id = ?
     ORDER BY ci.cart_item_id ASC`,
    [normalizedLanguageCode, activeCartId]
  );

  if (rows.length === 0) {
    return buildEmptyCartResponse();
  }

  const items = rows.map((row) =>
    mapCartLineToResponse({
      cartItemId: row.cart_item_id,
      productId: row.product_id,
      name: row.name,
      color: row.colour,
      size: row.size,
      price: row.price,
      compareAtPrice: row.compare_at_price,
      stockQty: row.stock_qty,
      productIsActive: row.product_is_active,
      variantIsActive: row.variant_is_active,
      imageUrl: row.image_url,
      quantityCartItem: row.quantity,
    })
  );

  return {
    cartId: activeCartId,
    items,
    cartSummary: buildCartSummary(items),
  };
}

async function resolveCartLineContext({ db, productId, color, size, languageCode = 'EN' }) {
  const normalizedColor = normalizeCartOption(color);
  const normalizedSize = normalizeCartOption(size);

  if (!normalizedColor || !normalizedSize) {
    throw new ProductHttpError(
      400,
      'INVALID_REQUEST',
      'productId, color, size, and quantityCartItem are required'
    );
  }

  const product = await getProductDetail({
    db,
    productId,
    languageCode,
    includeInactive: false,
  });

  const normalizedColorKey = normalizedColor.toUpperCase();
  const normalizedSizeKey = normalizedSize.toUpperCase();

  const variant = product.variants.find((entry) => {
    const entryColor = normalizeCartOption(entry.colour);
    const entrySize = normalizeCartOption(entry.size);
    return (
      entry.isActive &&
      entryColor &&
      entrySize &&
      entryColor.toUpperCase() === normalizedColorKey &&
      entrySize.toUpperCase() === normalizedSizeKey
    );
  });

  if (!variant) {
    throw new ProductHttpError(
      400,
      'INVALID_VARIANT_SELECTION',
      'color and size do not match an active variant'
    );
  }

  return {
    product,
    variant,
    imageUrl: pickStorefrontImage(product.media),
  };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  CATEGORY_SORT_OPTIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  NEW_ARRIVALS_LIMIT,
  PRODUCT_TYPES,
  SEARCH_SORT_OPTIONS,
  SUPPORTED_LANGUAGE_CODES,
  ProductHttpError,
  buildStoragePath,
  createProduct,
  completeCheckoutPurchase,
  addCartItem,
  addProductToFavorites,
  deleteAdminProduct,
  ensureProductExists,
  getProductDetail,
  getCheckoutAddress,
  getStorefrontCategoryBySlug,
  getStorefrontProductDetail,
  getUserCart,
  getOrCreateActiveCartId,
  listUserFavorites,
  listAdminProducts,
  listStorefrontProductsByCategory,
  listStorefrontProductRecommendations,
  listStorefrontProductSuggestions,
  listNewArrivals,
  listProductImages,
  listProducts,
  removeCartItem,
  removeProductFromFavorites,
  searchStorefrontProducts,
  upsertCheckoutAddress,
  updateAdminProduct,
  updateCartItemQuantity,
  parseBooleanLike,
  parseLanguageCode,
  parseLimit,
  parseRecommendationsLimit,
  parsePage,
  parsePositiveIntegerQuantity,
  parseSortOrder,
  parseStatus,
  normalizeCartOption,
  normalizeSortOption,
  resolveCartLineContext,
  mapCartLineToResponse,
  buildCartSummary,
  uploadProductImage,
};
