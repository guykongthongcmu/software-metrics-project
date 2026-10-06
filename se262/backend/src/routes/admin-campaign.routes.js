const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const db = require('../config/db');
const {
  CampaignHttpError,
  createCampaign,
} = require('../services/campaign.service');
const {
  sendCampaignBlastEmail,
  buildWebstoreHomeUrl,
} = require('../services/mail.service');

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

  console.error('--- CAMPAIGN API ERROR ---', error);
  return sendCampaignError(res, 500, 'INTERNAL_SERVER_ERROR', 'internal server error');
}

function normalizeCampaignType(rawType) {
  const normalized = typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
  if (normalized === 'FIXED_AMOUNT_DISCOUNT') {
    return 'FIXED_DISCOUNT';
  }
  return normalized;
}

function formatCampaignTypeLabel(type) {
  switch (normalizeCampaignType(type)) {
    case 'PERCENTAGE_DISCOUNT':
      return 'Percentage Discount';
    case 'FIXED_DISCOUNT':
      return 'Fixed Discount';
    case 'BEST_SELLER':
      return 'Best Seller Spotlight';
    default:
      return 'Special Offer';
  }
}

function formatCampaignOfferLabel(type, discountValue) {
  const normalizedType = normalizeCampaignType(type);
  const parsedDiscountValue = Number(discountValue);

  if (normalizedType === 'PERCENTAGE_DISCOUNT' && Number.isFinite(parsedDiscountValue)) {
    return `${parsedDiscountValue}% off`;
  }

  if (normalizedType === 'FIXED_DISCOUNT' && Number.isFinite(parsedDiscountValue)) {
    return `${parsedDiscountValue} off`;
  }

  if (normalizedType === 'BEST_SELLER') {
    return 'our best seller spotlight';
  }

  return 'a special offer';
}

function normalizeChannels(rawChannels) {
  return {
    web: Boolean(rawChannels?.web),
    email: Boolean(rawChannels?.email),
  };
}

async function sendCampaignBlastToVerifiedUsers({ dbConnection, campaignData }) {
  const channels = normalizeChannels(campaignData?.channels);
  if (!channels.email) {
    return {
      enabled: false,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  const [recipientRows] = await dbConnection.execute(
    `SELECT user_id, email, first_name
     FROM users
     WHERE email_verified_at IS NOT NULL
     ORDER BY user_id ASC`
  );

  if (recipientRows.length === 0) {
    return {
      enabled: true,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  const shopUrl = buildWebstoreHomeUrl();
  const campaignTypeLabel = formatCampaignTypeLabel(campaignData?.type);
  const offerLabel = formatCampaignOfferLabel(campaignData?.type, campaignData?.discountValue);

  const settledResults = await Promise.allSettled(
    recipientRows.map((recipient) =>
      sendCampaignBlastEmail({
        to: recipient.email,
        firstName: recipient.first_name,
        campaignName: campaignData?.name,
        campaignTypeLabel,
        offerLabel,
        startDate: campaignData?.startDate,
        endDate: campaignData?.endDate,
        shopUrl,
      })
    )
  );

  const failedRecipients = [];
  settledResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      failedRecipients.push({
        email: recipientRows[index].email,
        error: result.reason?.message || 'unknown mail error',
      });
      console.error('failed to send campaign blast email:', recipientRows[index].email, result.reason);
    }
  });

  return {
    enabled: true,
    totalRecipients: recipientRows.length,
    sentCount: recipientRows.length - failedRecipients.length,
    failedCount: failedRecipients.length,
    failedRecipients,
  };
}

function buildLaunchResponseMessage(emailBlastSummary) {
  if (!emailBlastSummary?.enabled) {
    return 'Campaign launched and Frontend banner patched successfully.';
  }

  if (emailBlastSummary.totalRecipients === 0) {
    return 'Campaign launched successfully. No verified customer emails were available for the email blast.';
  }

  if (emailBlastSummary.failedCount === 0) {
    return `Campaign launched successfully. Email blast sent to ${emailBlastSummary.sentCount} customers.`;
  }

  if (emailBlastSummary.sentCount === 0) {
    return 'Campaign launched, but the email blast could not be delivered to any verified customers.';
  }

  return `Campaign launched. Email blast sent to ${emailBlastSummary.sentCount} customers; ${emailBlastSummary.failedCount} deliveries failed.`;
}

function buildEmailBlastFailureSummary(error) {
  return {
    enabled: true,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 1,
    failedRecipients: [],
    error: error?.message || 'unknown mail error',
  };
}

/**
 * Requirement: The Real-Time File Patcher (CRITICAL)
 * Handles Multipart Campaign Launch and EJS Patching for the Frontend
 */
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Point to the frontend's public images directory
    const dir = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Explicitly overwrite the current banner image
    cb(null, 'current_banner.jpg');
  }
});
const bannerUpload = multer({ storage: bannerStorage });

function createAdminCampaignRouter({ dbConnection = db } = {}) {
  const router = express.Router();

  router.post('/campaigns', async (req, res) => {
    try {
      const data = await createCampaign({
        db: dbConnection,
        adminId: req.authAdmin?.adminId,
        payload: req.body,
      });

      return res.status(201).json({
        status: 'success',
        message: 'campaign created successfully',
        data,
      });
    } catch (error) {
      return handleCampaignError(res, error);
    }
  });

  /**
   * Part 3: Backend Node.js API Logic (The Real-Time File Patcher)
   */
  router.post('/launch-campaign', bannerUpload.single('mediaFile'), async (req, res) => {
    try {
      let campaignData;
      try {
        campaignData = JSON.parse(req.body.campaignData);
      } catch (parseError) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_CAMPAIGN_PAYLOAD',
          message: 'campaignData must be a valid JSON object',
        });
      }

      const { name, type, discountValue, startDate, endDate } = campaignData;

      // --- The Goal: Dynamically Patch banner.ejs in the Frontend ---
      const bannerPath = path.join(__dirname, '..', '..', '..', 'frontend', 'views', 'partials', 'webstore', 'banner.ejs');

      // Define formatted discount display logic
      let displayDiscount = '';
      if (type === 'PERCENTAGE_DISCOUNT') displayDiscount = `${discountValue}% OFF`;
      else if (type === 'FIXED_AMOUNT_DISCOUNT') displayDiscount = `$${discountValue} OFF`;
      else displayDiscount = 'Special Offer';

      const newBannerEJS = `<% 
  // Prefer variables passed from category templates, fall back to defaults (home page/campaign)
  const image = locals.bannerImage || '/images/current_banner.jpg';
  const title = locals.bannerTitle || '${name.toUpperCase()}';
  const subtitle = locals.bannerSubtitle || '${displayDiscount} | Valid ${startDate} to ${endDate}';
  const ctaUrl = locals.exploreUrl || '/search?campaign=active';
%>
<!-- DYNAMICALLY PATCHED BY CAMPAIGN BUILDER -->
<section class="hero-section" id="hero-section">
  <div class="hero-bg" id="hero-bg" style="background-image: url('<%= image %>'); background-size: cover; background-position: center;">
    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); z-index: 1;"></div>
  </div>
  <div class="hero-content" style="position: relative; z-index: 2; color: white;">
    <h1 id="hero-title"><%= title %></h1>
    <p id="hero-subtitle"><%= subtitle %></p>
    <a href="<%= ctaUrl %>" class="btn btn-primary hero-btn" id="hero-cta">Explore Collection</a>
  </div>
</section>

<style>
  .hero-section {
    position: relative;
    height: 90vh;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    overflow: hidden;
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    z-index: -1;
  }
  .hero-content h1 {
    font-size: 5rem;
    font-weight: 700;
    letter-spacing: -2px;
    margin-bottom: 1rem;
    text-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }
  .hero-content p {
    font-size: 1.2rem;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 2.5rem;
    opacity: 0.9;
  }
</style>
`;

      // Explicitly OVERWRITE the frontend file
      fs.writeFileSync(bannerPath, newBannerEJS, 'utf8');

      let emailBlast;
      try {
        emailBlast = await sendCampaignBlastToVerifiedUsers({
          dbConnection,
          campaignData,
        });
      } catch (mailError) {
        console.error('campaign launch email blast failed:', mailError);
        emailBlast = buildEmailBlastFailureSummary(mailError);
      }

      res.status(201).json({
        status: 'success',
        message: buildLaunchResponseMessage(emailBlast),
        data: {
          ...campaignData,
          emailBlast,
        }
      });

    } catch (error) {
      console.error('--- ARCHITECT ERROR: LAUNCH FAILED ---', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal Server Error during file patching',
        details: error.message
      });
    }
  });

  return router;
}

module.exports = createAdminCampaignRouter();
module.exports.createAdminCampaignRouter = createAdminCampaignRouter;
