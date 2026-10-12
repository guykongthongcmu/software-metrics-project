const ADMIN_ORDERS_PAGE_DEFAULT = 1;
const ADMIN_ORDERS_LIMIT_DEFAULT = 20;
const ADMIN_ORDERS_LIMIT_MAX = 100;
const ORDER_STATUS_PURCHASED = 'PURCHASED';
const ORDER_ADDRESS_REQUIRED_MESSAGE =
  'fullName, phoneNumber, addressLine1, district, province, postalCode, and country are required';

class AdminOrderHttpError extends Error {
  constructor(statusCode, errorCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function parseAdminOrdersQuery(query = {}) {
  const pageRaw = query.page;
  const limitRaw = query.limit;

  const page = pageRaw === undefined || pageRaw === null || pageRaw === ''
    ? ADMIN_ORDERS_PAGE_DEFAULT
    : Number.parseInt(pageRaw, 10);
  const limit = limitRaw === undefined || limitRaw === null || limitRaw === ''
    ? ADMIN_ORDERS_LIMIT_DEFAULT
    : Number.parseInt(limitRaw, 10);

  if (!Number.isInteger(page) || page <= 0 || !Number.isInteger(limit) || limit <= 0) {
    throw new AdminOrderHttpError(
      400,
      'INVALID_QUERY',
      'page and limit must be positive integers'
    );
  }

  const statusRaw = query.status;
  let status = null;
  if (!(statusRaw === undefined || statusRaw === null || statusRaw === '')) {
    status = String(statusRaw).trim().toUpperCase();
    if (status !== ORDER_STATUS_PURCHASED) {
      throw new AdminOrderHttpError(400, 'INVALID_QUERY', 'status must be PURCHASED');
    }
  }

  const searchRaw = query.search;
  const search = typeof searchRaw === 'string' && searchRaw.trim() !== ''
    ? searchRaw.trim().toLowerCase()
    : null;

  return {
    page,
    limit: Math.min(limit, ADMIN_ORDERS_LIMIT_MAX),
    status,
    search,
  };
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function formatDateTime(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value == null ? null : String(value);
}

function parseSnapshot(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function composeCustomerName(row) {
  const fullName = [row?.first_name, row?.last_name]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) {
    return fullName;
  }

  if (typeof row?.email === 'string' && row.email.trim() !== '') {
    return row.email.trim();
  }

  return `User #${row?.user_id ?? ''}`.trim();
}

function normalizeAddressField(value, { required = false, maxLength = 255 } = {}) {
  if (value === undefined || value === null) {
    return required ? null : null;
  }

  const normalized = String(value).trim();
  if (normalized === '') {
    return required ? null : null;
  }

  return normalized.slice(0, maxLength);
}

function addValidationError(errors, field, message) {
  if (!errors[field]) {
    errors[field] = message;
  }
}

function validateOrderAddressSnapshot(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AdminOrderHttpError(400, 'VALIDATION_ERROR', 'invalid request data', {
      shippingAddressSnapshot: 'shippingAddressSnapshot must be an object',
    });
  }

  const fullName = normalizeAddressField(payload.fullName, { required: true, maxLength: 150 });
  const phoneNumber = normalizeAddressField(payload.phoneNumber, { required: true, maxLength: 30 });
  const addressLine1 = normalizeAddressField(payload.addressLine1, { required: true, maxLength: 255 });
  const addressLine2 = normalizeAddressField(payload.addressLine2, { maxLength: 255 });
  const district = normalizeAddressField(payload.district, { required: true, maxLength: 120 });
  const province = normalizeAddressField(payload.province, { required: true, maxLength: 120 });
  const postalCode = normalizeAddressField(payload.postalCode, { required: true, maxLength: 20 });
  const country = normalizeAddressField(payload.country, { required: true, maxLength: 100 });

  const errors = {};

  if (!fullName) {
    addValidationError(errors, 'fullName', 'fullName is required');
  }
  if (!phoneNumber) {
    addValidationError(errors, 'phoneNumber', 'phoneNumber is required');
  } else if (!/^[0-9+\-\s()]{7,20}$/.test(phoneNumber)) {
    addValidationError(errors, 'phoneNumber', 'phoneNumber format is invalid');
  }
  if (!addressLine1) {
    addValidationError(errors, 'addressLine1', 'addressLine1 is required');
  }
  if (!district) {
    addValidationError(errors, 'district', 'district is required');
  }
  if (!province) {
    addValidationError(errors, 'province', 'province is required');
  }
  if (!postalCode) {
    addValidationError(errors, 'postalCode', 'postalCode is required');
  } else if (!/^[A-Za-z0-9\- ]{3,12}$/.test(postalCode)) {
    addValidationError(errors, 'postalCode', 'postalCode format is invalid');
  }
  if (!country) {
    addValidationError(errors, 'country', 'country is required');
  }

  if (Object.keys(errors).length > 0) {
    throw new AdminOrderHttpError(400, 'VALIDATION_ERROR', ORDER_ADDRESS_REQUIRED_MESSAGE, errors);
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

function normalizeAdminOrderUpdatePayload(body = {}) {
  const rawSnapshot =
    body.shippingAddressSnapshot && typeof body.shippingAddressSnapshot === 'object'
      ? body.shippingAddressSnapshot
      : body;

  return {
    shippingAddressSnapshot: validateOrderAddressSnapshot(rawSnapshot),
  };
}

async function ensureOrderExists(db, orderId) {
  const [rows] = await db.execute(
    `SELECT order_id
     FROM orders
     WHERE order_id = ?
     LIMIT 1`,
    [orderId]
  );

  return rows.length > 0;
}

function mapAdminOrderDetail(order, itemRows) {
  return {
    orderId: Number(order.order_id),
    userId: Number(order.user_id),
    customer: {
      userId: Number(order.user_id),
      email: order.email,
      name: composeCustomerName(order),
    },
    status: order.status,
    subtotal: normalizeMoney(order.subtotal),
    shippingFee: normalizeMoney(order.shipping_fee),
    vatAmount: normalizeMoney(order.vat_amount),
    total: normalizeMoney(order.total),
    shippingAddressSnapshot: parseSnapshot(order.shipping_address_snapshot),
    billingAddressSnapshot: parseSnapshot(order.billing_address_snapshot),
    items: itemRows.map((row) => ({
      orderItemId: Number(row.order_item_id),
      productVariantId: row.product_variant_id == null ? null : Number(row.product_variant_id),
      snapshotProductName: row.snapshot_product_name,
      snapshotColor: row.snapshot_color,
      snapshotSize: row.snapshot_size,
      snapshotUnitPrice: normalizeMoney(row.snapshot_unit_price),
      snapshotCompareAtPrice:
        row.snapshot_compare_at_price == null
          ? null
          : normalizeMoney(row.snapshot_compare_at_price),
      quantity: Number(row.quantity),
      lineTotal: normalizeMoney(row.line_total),
    })),
    createdAt: formatDateTime(order.created_at),
    updatedAt: formatDateTime(order.updated_at),
  };
}

async function listAdminOrders({ db, query = {} }) {
  const parsedQuery = parseAdminOrdersQuery(query);
  const offset = (parsedQuery.page - 1) * parsedQuery.limit;
  const whereClauses = [];
  const whereParams = [];

  if (parsedQuery.status) {
    whereClauses.push('o.status = ?');
    whereParams.push(parsedQuery.status);
  }

  if (parsedQuery.search) {
    const searchPattern = `%${parsedQuery.search}%`;
    whereClauses.push(
      `(
         LOWER(u.email) LIKE ? OR
         LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE ? OR
         LOWER(COALESCE(o.shipping_address_snapshot, '')) LIKE ?
       )`
    );
    whereParams.push(searchPattern, searchPattern, searchPattern);
  }

  const whereSql = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  const [countRows] = await db.execute(
    `SELECT COUNT(*) AS total_items
     FROM orders o
     INNER JOIN users u
       ON u.user_id = o.user_id
     ${whereSql}`,
    whereParams
  );

  const totalItems = Number(countRows[0]?.total_items || 0);

  const [rows] = await db.execute(
    `SELECT
       o.order_id,
       o.user_id,
       o.status,
       o.subtotal,
       o.shipping_fee,
       o.vat_amount,
       o.total,
       o.created_at
     FROM orders o
     INNER JOIN users u
       ON u.user_id = o.user_id
     ${whereSql}
     ORDER BY o.created_at DESC, o.order_id DESC
     LIMIT ${parsedQuery.limit} OFFSET ${offset}`,
    whereParams
  );

  return {
    page: parsedQuery.page,
    limit: parsedQuery.limit,
    totalItems,
    totalPages: totalItems > 0 ? Math.ceil(totalItems / parsedQuery.limit) : 0,
    items: rows.map((row) => ({
      orderId: Number(row.order_id),
      userId: Number(row.user_id),
      status: row.status,
      subtotal: normalizeMoney(row.subtotal),
      shippingFee: normalizeMoney(row.shipping_fee),
      vatAmount: normalizeMoney(row.vat_amount),
      total: normalizeMoney(row.total),
      createdAt: formatDateTime(row.created_at),
    })),
  };
}

async function getAdminOrderDetail({ db, orderId }) {
  const [orderRows] = await db.execute(
    `SELECT
       o.order_id,
       o.user_id,
       o.status,
       o.subtotal,
       o.shipping_fee,
       o.vat_amount,
       o.total,
       o.shipping_address_snapshot,
       o.billing_address_snapshot,
       o.created_at,
       o.updated_at,
       u.email,
       u.first_name,
       u.last_name
     FROM orders o
     INNER JOIN users u
       ON u.user_id = o.user_id
     WHERE o.order_id = ?
     LIMIT 1`,
    [orderId]
  );

  const order = orderRows[0];
  if (!order) {
    throw new AdminOrderHttpError(404, 'ORDER_NOT_FOUND', `order with id ${orderId} was not found`);
  }

  const [itemRows] = await db.execute(
    `SELECT
       order_item_id,
       product_variant_id,
       snapshot_product_name,
       snapshot_color,
       snapshot_size,
       snapshot_unit_price,
       snapshot_compare_at_price,
       quantity,
       line_total
     FROM order_item
     WHERE order_id = ?
     ORDER BY order_item_id ASC`,
    [orderId]
  );

  return mapAdminOrderDetail(order, itemRows);
}

async function updateAdminOrder({ db, orderId, body = {} }) {
  const normalizedPayload = normalizeAdminOrderUpdatePayload(body);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const orderExists = await ensureOrderExists(connection, orderId);
    if (!orderExists) {
      throw new AdminOrderHttpError(404, 'ORDER_NOT_FOUND', `order with id ${orderId} was not found`);
    }

    const snapshotJson = JSON.stringify(normalizedPayload.shippingAddressSnapshot);
    await connection.execute(
      `UPDATE orders
       SET shipping_address_snapshot = ?,
           billing_address_snapshot = ?
       WHERE order_id = ?`,
      [snapshotJson, snapshotJson, orderId]
    );

    const updatedOrder = await getAdminOrderDetail({
      db: connection,
      orderId,
    });

    await connection.commit();
    return updatedOrder;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteAdminOrder({ db, orderId }) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const orderExists = await ensureOrderExists(connection, orderId);
    if (!orderExists) {
      throw new AdminOrderHttpError(404, 'ORDER_NOT_FOUND', `order with id ${orderId} was not found`);
    }

    await connection.execute(
      `DELETE FROM orders
       WHERE order_id = ?`,
      [orderId]
    );

    await connection.commit();

    return {
      orderId,
      deleted: true,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  AdminOrderHttpError,
  deleteAdminOrder,
  listAdminOrders,
  getAdminOrderDetail,
  updateAdminOrder,
};
