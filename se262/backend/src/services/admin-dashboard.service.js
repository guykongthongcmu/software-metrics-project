const DAY_MS = 24 * 60 * 60 * 1000;
const ALLOWED_PERIODS = new Set(['7d', '30d', 'custom']);
const CURRENCY = 'THB';
const COUNTED_ORDER_STATUSES = ['PURCHASED'];
const ORDER_STATUS_PLACEHOLDERS = COUNTED_ORDER_STATUSES.map(() => '?').join(', ');

class DashboardHttpError extends Error {
  constructor(statusCode, errorCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateOnly(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  return new Date(date.getTime() + (days * DAY_MS));
}

function getTodayDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toSqlDayStart(date) {
  return `${formatDateOnly(date)} 00:00:00`;
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeCount(value) {
  return Number.parseInt(value || 0, 10) || 0;
}

function calculateGrowth(current, previous) {
  if (previous === 0) {
    return 0;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function createInvalidDateRangeError() {
  return new DashboardHttpError(
    400,
    'INVALID_DATE_RANGE',
    'from and to must be valid dates, and from must be earlier than or equal to to'
  );
}

function buildWindow(fromDate, toDate) {
  return {
    fromDate,
    toDate,
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
    startAt: toSqlDayStart(fromDate),
    endExclusive: toSqlDayStart(addDays(toDate, 1)),
  };
}

function parseDashboardRange(query = {}, { now = new Date() } = {}) {
  const hasCustomDates = query.from !== undefined || query.to !== undefined;
  const rawPeriod = typeof query.period === 'string' ? query.period.trim() : '';
  const period = rawPeriod || (hasCustomDates ? 'custom' : '7d');

  if (!ALLOWED_PERIODS.has(period)) {
    throw new DashboardHttpError(
      400,
      'INVALID_QUERY',
      'period must be one of: 7d, 30d, custom'
    );
  }

  let fromDate;
  let toDate;

  if (period === 'custom') {
    fromDate = parseDateOnly(query.from);
    toDate = parseDateOnly(query.to);

    if (!fromDate || !toDate || fromDate.getTime() > toDate.getTime()) {
      throw createInvalidDateRangeError();
    }
  } else {
    const today = getTodayDate(now);
    const days = period === '30d' ? 30 : 7;
    toDate = today;
    fromDate = addDays(today, -(days - 1));
  }

  const selectedDays = Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  const previousToDate = addDays(fromDate, -1);
  const previousFromDate = addDays(previousToDate, -(selectedDays - 1));

  return {
    period,
    granularity: 'day',
    selectedDays,
    current: buildWindow(fromDate, toDate),
    previous: buildWindow(previousFromDate, previousToDate),
  };
}

async function fetchRevenueAndOrdersTotals(db, window) {
  const [rows] = await db.execute(
    `SELECT
       COALESCE(SUM(total), 0) AS revenue_total,
       COUNT(*) AS orders_total
     FROM orders
     WHERE status IN (${ORDER_STATUS_PLACEHOLDERS})
       AND created_at >= ?
       AND created_at < ?`,
    [...COUNTED_ORDER_STATUSES, window.startAt, window.endExclusive]
  );

  const row = rows[0] || {};

  return {
    revenueTotal: normalizeMoney(row.revenue_total),
    ordersTotal: normalizeCount(row.orders_total),
  };
}

async function fetchProductsSoldTotal(db, window) {
  const [rows] = await db.execute(
    `SELECT
       COALESCE(SUM(oi.quantity), 0) AS products_sold_total
     FROM orders o
     INNER JOIN order_item oi
       ON oi.order_id = o.order_id
     WHERE o.status IN (${ORDER_STATUS_PLACEHOLDERS})
       AND o.created_at >= ?
       AND o.created_at < ?`,
    [...COUNTED_ORDER_STATUSES, window.startAt, window.endExclusive]
  );

  const row = rows[0] || {};
  return normalizeCount(row.products_sold_total);
}

async function fetchRevenueAndOrdersChartRows(db, window) {
  const [rows] = await db.execute(
    `SELECT
       DATE_FORMAT(created_at, '%Y-%m-%d') AS bucket,
       COALESCE(SUM(total), 0) AS revenue_total,
       COUNT(*) AS orders_total
     FROM orders
     WHERE status IN (${ORDER_STATUS_PLACEHOLDERS})
       AND created_at >= ?
       AND created_at < ?
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [...COUNTED_ORDER_STATUSES, window.startAt, window.endExclusive]
  );

  return rows;
}

async function fetchProductsSoldChartRows(db, window) {
  const [rows] = await db.execute(
    `SELECT
       DATE_FORMAT(o.created_at, '%Y-%m-%d') AS bucket,
       COALESCE(SUM(oi.quantity), 0) AS products_sold_total
     FROM orders o
     INNER JOIN order_item oi
       ON oi.order_id = o.order_id
     WHERE o.status IN (${ORDER_STATUS_PLACEHOLDERS})
       AND o.created_at >= ?
       AND o.created_at < ?
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [...COUNTED_ORDER_STATUSES, window.startAt, window.endExclusive]
  );

  return rows;
}

function buildDailyBuckets(fromDate, toDate) {
  const labels = [];
  const buckets = new Map();

  for (let cursor = new Date(fromDate); cursor.getTime() <= toDate.getTime(); cursor = addDays(cursor, 1)) {
    const key = formatDateOnly(cursor);
    labels.push(key);
    buckets.set(key, {
      revenue: 0,
      orders: 0,
      productsSold: 0,
    });
  }

  return { labels, buckets };
}

function applyRevenueAndOrdersChartRows(buckets, rows) {
  for (const row of rows) {
    const point = buckets.get(row.bucket);
    if (!point) {
      continue;
    }

    point.revenue = normalizeMoney(row.revenue_total);
    point.orders = normalizeCount(row.orders_total);
  }
}

function applyProductsSoldChartRows(buckets, rows) {
  for (const row of rows) {
    const point = buckets.get(row.bucket);
    if (!point) {
      continue;
    }

    point.productsSold = normalizeCount(row.products_sold_total);
  }
}

function buildChartPayload(labels, buckets) {
  return {
    labels,
    revenue: labels.map((label) => buckets.get(label).revenue),
    orders: labels.map((label) => buckets.get(label).orders),
    productsSold: labels.map((label) => buckets.get(label).productsSold),
  };
}

async function getDashboardSummary({ db, query = {}, now = new Date() }) {
  if (!db || typeof db.execute !== 'function') {
    throw new Error('db connection with execute() is required');
  }

  const range = parseDashboardRange(query, { now });

  const [
    currentRevenueAndOrders,
    previousRevenueAndOrders,
    currentProductsSold,
    previousProductsSold,
    revenueAndOrdersChartRows,
    productsSoldChartRows,
  ] = await Promise.all([
    fetchRevenueAndOrdersTotals(db, range.current),
    fetchRevenueAndOrdersTotals(db, range.previous),
    fetchProductsSoldTotal(db, range.current),
    fetchProductsSoldTotal(db, range.previous),
    fetchRevenueAndOrdersChartRows(db, range.current),
    fetchProductsSoldChartRows(db, range.current),
  ]);

  const { labels, buckets } = buildDailyBuckets(range.current.fromDate, range.current.toDate);
  applyRevenueAndOrdersChartRows(buckets, revenueAndOrdersChartRows);
  applyProductsSoldChartRows(buckets, productsSoldChartRows);

  return {
    period: {
      from: range.current.from,
      to: range.current.to,
      granularity: range.granularity,
    },
    revenue: {
      total: currentRevenueAndOrders.revenueTotal,
      growth: calculateGrowth(
        currentRevenueAndOrders.revenueTotal,
        previousRevenueAndOrders.revenueTotal
      ),
      currency: CURRENCY,
    },
    orders: {
      total: currentRevenueAndOrders.ordersTotal,
      growth: calculateGrowth(
        currentRevenueAndOrders.ordersTotal,
        previousRevenueAndOrders.ordersTotal
      ),
    },
    productsSold: {
      total: currentProductsSold,
      growth: calculateGrowth(currentProductsSold, previousProductsSold),
    },
    charts: buildChartPayload(labels, buckets),
  };
}

module.exports = {
  ALLOWED_PERIODS,
  COUNTED_ORDER_STATUSES,
  DashboardHttpError,
  calculateGrowth,
  getDashboardSummary,
  parseDashboardRange,
};
