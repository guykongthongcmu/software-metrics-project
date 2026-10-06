const express = require('express');

const db = require('../config/db');
const {
  CampaignHttpError,
  listActiveCampaigns,
} = require('../services/campaign.service');

function sendCampaignError(res, statusCode, errorCode, message) {
  return res.status(statusCode).json({
    status: 'error',
    code: errorCode,
    message,
  });
}

function handleCampaignError(res, error) {
  if (error instanceof CampaignHttpError) {
    return sendCampaignError(res, error.statusCode, error.errorCode, error.message);
  }

  console.error(error);
  return sendCampaignError(res, 500, 'INTERNAL_SERVER_ERROR', 'internal server error');
}

function createClientCampaignRouter({ dbConnection = db } = {}) {
  const router = express.Router();

  router.get('/campaigns', async (req, res) => {
    try {
      const data = await listActiveCampaigns({
        db: dbConnection,
        languageCode: req.query.lang,
      });

      return res.status(200).json({
        status: 'success',
        message: 'campaigns retrieved successfully',
        data,
      });
    } catch (error) {
      return handleCampaignError(res, error);
    }
  });

  return router;
}

module.exports = createClientCampaignRouter();
module.exports.createClientCampaignRouter = createClientCampaignRouter;
