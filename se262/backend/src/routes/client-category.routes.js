const express = require('express');

const db = require('../config/db');
const {
  CategoryHttpError,
  listVisibleCategories,
} = require('../services/category.service');

function sendCategoryError(res, statusCode, errorCode, message) {
  return res.status(statusCode).json({
    status: 'error',
    code: errorCode,
    message,
  });
}

function handleCategoryError(res, error) {
  if (error instanceof CategoryHttpError) {
    return sendCategoryError(res, error.statusCode, error.errorCode, error.message);
  }

  console.error(error);
  return sendCategoryError(res, 500, 'INTERNAL_SERVER_ERROR', 'internal server error');
}

function createClientCategoryRouter({ dbConnection = db } = {}) {
  const router = express.Router();

  router.get('/categories', async (req, res) => {
    try {
      const data = await listVisibleCategories({
        db: dbConnection,
        query: req.query,
      });

      return res.status(200).json({
        status: 'success',
        message: 'visible categories retrieved successfully',
        data,
      });
    } catch (error) {
      return handleCategoryError(res, error);
    }
  });

  return router;
}

module.exports = createClientCategoryRouter();
module.exports.createClientCategoryRouter = createClientCategoryRouter;
