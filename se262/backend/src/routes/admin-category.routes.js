const express = require('express');

const db = require('../config/db');
const {
  CategoryHttpError,
  createCategory,
  listAdminCategories,
  updateCategory,
  updateCategoryVisibility,
  deleteCategory,
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

function createAdminCategoryRouter({ dbConnection = db } = {}) {
  const router = express.Router();

  router.get('/categories', async (req, res) => {
    try {
      const data = await listAdminCategories({
        db: dbConnection,
        query: req.query,
      });

      return res.status(200).json({
        status: 'success',
        message: 'categories retrieved successfully',
        data,
      });
    } catch (error) {
      return handleCategoryError(res, error);
    }
  });

  router.post('/categories', async (req, res) => {
    try {
      const data = await createCategory({
        db: dbConnection,
        categoryName: req.body?.categoryName ?? req.body?.name,
      });

      return res.status(201).json({
        status: 'success',
        message: 'category created successfully',
        data,
      });
    } catch (error) {
      return handleCategoryError(res, error);
    }
  });

  router.put('/categories/:id', async (req, res) => {
    try {
      const data = await updateCategory({
        db: dbConnection,
        categoryId: req.params.id,
        categoryName: req.body?.categoryName ?? req.body?.name,
      });

      return res.status(200).json({
        status: 'success',
        message: 'category updated successfully',
        data,
      });
    } catch (error) {
      return handleCategoryError(res, error);
    }
  });

  router.patch('/categories/:id/visibility', async (req, res) => {
    try {
      const data = await updateCategoryVisibility({
        db: dbConnection,
        categoryId: req.params.id,
        isHidden: req.body?.isHidden,
      });

      return res.status(200).json({
        status: 'success',
        message: 'category visibility updated successfully',
        data,
      });
    } catch (error) {
      return handleCategoryError(res, error);
    }
  });

  router.delete('/categories/:id', async (req, res) => {
    try {
      const data = await deleteCategory({
        db: dbConnection,
        categoryId: req.params.id,
      });

      return res.status(200).json({
        status: 'success',
        message: 'category deleted successfully',
        data,
      });
    } catch (error) {
      return handleCategoryError(res, error);
    }
  });

  return router;
}

module.exports = createAdminCategoryRouter();
module.exports.createAdminCategoryRouter = createAdminCategoryRouter;
