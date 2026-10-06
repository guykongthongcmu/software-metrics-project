const express = require('express');

const db = require('../config/db');
const {
  AdminOrderHttpError,
  deleteAdminOrder,
  getAdminOrderDetail,
  listAdminOrders,
  updateAdminOrder,
} = require('../services/admin-order.service');

function sendOrderError(res, statusCode, errorCode, message, details) {
  const payload = {
    status: 'error',
    code: errorCode,
    message,
  };

  if (details) {
    payload.details = details;
  }

  return res.status(statusCode).json(payload);
}

function handleOrderError(res, error) {
  if (error instanceof AdminOrderHttpError) {
    return sendOrderError(res, error.statusCode, error.errorCode, error.message, error.details);
  }

  console.error(error);
  return sendOrderError(res, 500, 'INTERNAL_SERVER_ERROR', 'internal server error');
}

function normalizeOrderId(rawValue) {
  const orderId = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new AdminOrderHttpError(400, 'INVALID_ORDER_ID', 'orderId must be a positive integer');
  }

  return orderId;
}

function createAdminOrderRouter({ dbConnection = db } = {}) {
  const router = express.Router();

  router.get('/orders', async (req, res) => {
    try {
      const data = await listAdminOrders({
        db: dbConnection,
        query: req.query,
      });

      return res.status(200).json({
        status: 'success',
        message: 'orders retrieved successfully',
        data,
      });
    } catch (error) {
      return handleOrderError(res, error);
    }
  });

  router.get('/orders/:orderId', async (req, res) => {
    try {
      const orderId = normalizeOrderId(req.params.orderId);
      const data = await getAdminOrderDetail({
        db: dbConnection,
        orderId,
      });

      return res.status(200).json({
        status: 'success',
        message: 'order retrieved successfully',
        data,
      });
    } catch (error) {
      return handleOrderError(res, error);
    }
  });

  router.patch('/orders/:orderId', async (req, res) => {
    try {
      const orderId = normalizeOrderId(req.params.orderId);
      const data = await updateAdminOrder({
        db: dbConnection,
        orderId,
        body: req.body,
      });

      return res.status(200).json({
        status: 'success',
        message: 'order updated successfully',
        data,
      });
    } catch (error) {
      return handleOrderError(res, error);
    }
  });

  router.delete('/orders/:orderId', async (req, res) => {
    try {
      const orderId = normalizeOrderId(req.params.orderId);
      const data = await deleteAdminOrder({
        db: dbConnection,
        orderId,
      });

      return res.status(200).json({
        status: 'success',
        message: 'order deleted successfully',
        data,
      });
    } catch (error) {
      return handleOrderError(res, error);
    }
  });

  return router;
}

module.exports = createAdminOrderRouter();
module.exports.createAdminOrderRouter = createAdminOrderRouter;
