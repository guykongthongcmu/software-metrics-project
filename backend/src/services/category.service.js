const CATEGORY_SORT_FIELD_DEFAULT = 'category_name';
const CATEGORY_SORT_ORDER_DEFAULT = 'ASC';
const CATEGORY_NAME_MAX_LENGTH = 100;

class CategoryHttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function normalizeCategoryId(rawValue) {
  const categoryId = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new CategoryHttpError(400, 'INVALID_CATEGORY_ID', 'category id must be a positive integer');
  }

  return categoryId;
}

function normalizeVisibilityValue(rawValue) {
  if (typeof rawValue !== 'boolean') {
    throw new CategoryHttpError(400, 'INVALID_VISIBILITY_VALUE', 'isHidden must be a boolean');
  }

  return rawValue;
}

function parseCategoryListQuery(query = {}) {
  const sortRaw =
    typeof query.sort === 'string' && query.sort.trim()
      ? query.sort.trim().toLowerCase()
      : CATEGORY_SORT_FIELD_DEFAULT;
  const orderRaw =
    typeof query.order === 'string' && query.order.trim()
      ? query.order.trim().toLowerCase()
      : CATEGORY_SORT_ORDER_DEFAULT.toLowerCase();

  if (sortRaw !== 'category_name') {
    throw new CategoryHttpError(400, 'INVALID_QUERY', 'sort must be category_name');
  }

  if (orderRaw !== 'asc' && orderRaw !== 'desc') {
    throw new CategoryHttpError(400, 'INVALID_QUERY', 'order must be asc or desc');
  }

  return {
    sort: sortRaw,
    order: orderRaw.toUpperCase(),
  };
}

function normalizeCategoryName(rawValue) {
  if (typeof rawValue !== 'string') {
    throw new CategoryHttpError(400, 'VALIDATION_ERROR', 'categoryName is required');
  }

  const normalized = rawValue.trim();
  if (!normalized) {
    throw new CategoryHttpError(400, 'VALIDATION_ERROR', 'categoryName is required');
  }

  if (normalized.length > CATEGORY_NAME_MAX_LENGTH) {
    throw new CategoryHttpError(
      400,
      'VALIDATION_ERROR',
      `categoryName must be ${CATEGORY_NAME_MAX_LENGTH} characters or fewer`
    );
  }

  return normalized;
}

function slugifyCategoryName(name) {
  const slug = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'category';
}

async function ensureUniqueCategorySlug({ db, baseSlug, excludeCategoryId = null }) {
  let candidateSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const query = excludeCategoryId == null
      ? `SELECT category_id
         FROM category
         WHERE slug = ?
         LIMIT 1`
      : `SELECT category_id
         FROM category
         WHERE slug = ?
           AND category_id <> ?
         LIMIT 1`;
    const params = excludeCategoryId == null ? [candidateSlug] : [candidateSlug, excludeCategoryId];
    const [rows] = await db.execute(query, params);

    if (rows.length === 0) {
      return candidateSlug;
    }

    candidateSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function mapCategoryRowToAdminApi(row) {
  return {
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    slug: row.slug,
    isHidden: row.is_hidden === 1 || row.is_hidden === true,
    parentCategoryId:
      row.parent_category_id == null ? null : Number(row.parent_category_id),
  };
}

function mapCategoryRowToClientApi(row) {
  return {
    categoryId: Number(row.category_id),
    categoryName: row.category_name,
    slug: row.slug,
    isHidden: false,
  };
}

function buildCategoryListOrderBy(parsedQuery) {
  if (parsedQuery.sort === 'category_name') {
    return `c.category_name ${parsedQuery.order}, c.category_id ASC`;
  }

  return `c.category_name ${CATEGORY_SORT_ORDER_DEFAULT}, c.category_id ASC`;
}

async function listAdminCategories({ db, query = {} }) {
  const parsedQuery = parseCategoryListQuery(query);
  const orderBy = buildCategoryListOrderBy(parsedQuery);
  const [rows] = await db.query(
    `SELECT
       c.category_id,
       c.category_name,
       c.slug,
       c.is_hidden,
       c.parent_category_id
     FROM category c
     ORDER BY ${orderBy}`
  );

  return {
    categories: rows.map((row) => mapCategoryRowToAdminApi(row)),
  };
}

async function listVisibleCategories({ db, query = {} }) {
  const parsedQuery = parseCategoryListQuery(query);
  const orderBy = buildCategoryListOrderBy(parsedQuery);
  const [rows] = await db.query(
    `SELECT
       c.category_id,
       c.category_name,
       c.slug
     FROM category c
     WHERE c.is_hidden = 0
     ORDER BY ${orderBy}`
  );

  return {
    categories: rows.map((row) => mapCategoryRowToClientApi(row)),
  };
}

async function createCategory({ db, categoryName }) {
  const normalizedCategoryName = normalizeCategoryName(categoryName);
  const baseSlug = slugifyCategoryName(normalizedCategoryName);
  const slug = await ensureUniqueCategorySlug({ db, baseSlug });

  const connection = typeof db.getConnection === 'function' ? await db.getConnection() : null;
  const executor = connection || db;

  try {
    if (connection) {
      await connection.beginTransaction();
    }

    const [insertResult] = await executor.execute(
      `INSERT INTO category (parent_category_id, category_name, slug, is_hidden)
       VALUES (NULL, ?, ?, 0)`,
      [normalizedCategoryName, slug]
    );

    const categoryId = Number(insertResult.insertId);

    await executor.execute(
      `INSERT INTO category_translation (category_id, language_code, name)
       VALUES (?, 'EN', ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [categoryId, normalizedCategoryName]
    );

    if (connection) {
      await connection.commit();
    }

    return {
      categoryId,
      categoryName: normalizedCategoryName,
      slug,
      isHidden: false,
      parentCategoryId: null,
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    if (error?.code === 'ER_DUP_ENTRY') {
      throw new CategoryHttpError(409, 'CATEGORY_SLUG_CONFLICT', 'category slug already exists');
    }

    throw error;
  } finally {
    if (connection && typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function updateCategory({ db, categoryId, categoryName }) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const normalizedCategoryName = normalizeCategoryName(categoryName);

  const [existingRows] = await db.execute(
    `SELECT category_id, category_name, is_hidden, parent_category_id
     FROM category
     WHERE category_id = ?
     LIMIT 1`,
    [normalizedCategoryId]
  );

  const existingCategory = existingRows[0];
  if (!existingCategory) {
    throw new CategoryHttpError(
      404,
      'CATEGORY_NOT_FOUND',
      `category with id ${normalizedCategoryId} was not found`
    );
  }

  const baseSlug = slugifyCategoryName(normalizedCategoryName);
  const slug = await ensureUniqueCategorySlug({
    db,
    baseSlug,
    excludeCategoryId: normalizedCategoryId,
  });

  const connection = typeof db.getConnection === 'function' ? await db.getConnection() : null;
  const executor = connection || db;

  try {
    if (connection) {
      await connection.beginTransaction();
    }

    await executor.execute(
      `UPDATE category
       SET category_name = ?, slug = ?
       WHERE category_id = ?`,
      [normalizedCategoryName, slug, normalizedCategoryId]
    );

    await executor.execute(
      `INSERT INTO category_translation (category_id, language_code, name)
       VALUES (?, 'EN', ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [normalizedCategoryId, normalizedCategoryName]
    );

    if (connection) {
      await connection.commit();
    }

    return {
      categoryId: normalizedCategoryId,
      categoryName: normalizedCategoryName,
      slug,
      isHidden: existingCategory.is_hidden === 1 || existingCategory.is_hidden === true,
      parentCategoryId:
        existingCategory.parent_category_id == null
          ? null
          : Number(existingCategory.parent_category_id),
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    if (error?.code === 'ER_DUP_ENTRY') {
      throw new CategoryHttpError(409, 'CATEGORY_SLUG_CONFLICT', 'category slug already exists');
    }

    throw error;
  } finally {
    if (connection && typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function updateCategoryVisibility({ db, categoryId, isHidden }) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const normalizedIsHidden = normalizeVisibilityValue(isHidden);

  const [existingRows] = await db.execute(
    `SELECT
       category_id,
       category_name,
       slug
     FROM category
     WHERE category_id = ?
     LIMIT 1`,
    [normalizedCategoryId]
  );

  const category = existingRows[0];
  if (!category) {
    throw new CategoryHttpError(
      404,
      'CATEGORY_NOT_FOUND',
      `category with id ${normalizedCategoryId} was not found`
    );
  }

  await db.execute(
    `UPDATE category
     SET is_hidden = ?
     WHERE category_id = ?`,
    [normalizedIsHidden ? 1 : 0, normalizedCategoryId]
  );

  return {
    categoryId: Number(category.category_id),
    categoryName: category.category_name,
    slug: category.slug,
    isHidden: normalizedIsHidden,
  };
}

async function deleteCategory({ db, categoryId }) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);

  const [existingRows] = await db.execute(
    `SELECT
       category_id,
       category_name
     FROM category
     WHERE category_id = ?
     LIMIT 1`,
    [normalizedCategoryId]
  );

  if (existingRows.length === 0) {
    throw new CategoryHttpError(
      404,
      'CATEGORY_NOT_FOUND',
      `category with id ${normalizedCategoryId} was not found`
    );
  }

  await db.execute(
    `DELETE FROM category
     WHERE category_id = ?`,
    [normalizedCategoryId]
  );

  return {
    categoryId: normalizedCategoryId,
    success: true,
  };
}

module.exports = {
  CategoryHttpError,
  createCategory,
  updateCategory,
  listAdminCategories,
  listVisibleCategories,
  normalizeCategoryId,
  normalizeCategoryName,
  normalizeVisibilityValue,
  parseCategoryListQuery,
  updateCategoryVisibility,
  deleteCategory,
};
