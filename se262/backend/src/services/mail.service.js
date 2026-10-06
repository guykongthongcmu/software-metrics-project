const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const {
  buildVerificationEmailTemplate,
  buildReceiptEmailTemplate,
  buildOrderUpdateEmailTemplate,
  buildForgotPasswordEmailTemplate,
  buildCampaignBlastEmailTemplate,
} = require('./email-template.service');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeEnvString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function inferWebstoreBaseUrl(rawBaseUrl) {
  const trimmedBaseUrl = normalizeEnvString(rawBaseUrl);
  if (!trimmedBaseUrl) {
    return '';
  }

  try {
    const inferredUrl = new URL(trimmedBaseUrl);
    if (inferredUrl.port === '3000') {
      inferredUrl.port = '8080';
    }
    return inferredUrl.toString().replace(/\/$/, '');
  } catch (error) {
    return trimmedBaseUrl.replace(/\/$/, '');
  }
}

function resolveWebstoreBaseUrl() {
  const webstoreBaseUrl = inferWebstoreBaseUrl(
    process.env.WEBSTORE_BASE_URL ||
      process.env.FRONTEND_BASE_URL ||
      process.env.APP_BASE_URL
  );

  if (!webstoreBaseUrl) {
    throw new Error(
      'Missing required environment variable: WEBSTORE_BASE_URL or FRONTEND_BASE_URL or APP_BASE_URL'
    );
  }

  return webstoreBaseUrl;
}

function buildSafeMailFrom({ smtpHost, smtpUser, mailFrom }) {
  const normalizedMailFrom = normalizeEnvString(mailFrom);
  if (!normalizedMailFrom) {
    return smtpUser;
  }

  const isGmailTransport = /gmail\.com|googlemail\.com/i.test(normalizeEnvString(smtpHost));
  if (!isGmailTransport) {
    return normalizedMailFrom;
  }

  const addressMatch = normalizedMailFrom.match(/<([^>]+)>/);
  const senderAddress = normalizeEnvString(addressMatch ? addressMatch[1] : normalizedMailFrom);

  if (!senderAddress || /@(coreco\.local|localhost)$/i.test(senderAddress)) {
    const displayNameMatch = normalizedMailFrom.match(/^(.*?)\s*<[^>]+>$/);
    const displayName = normalizeEnvString(displayNameMatch ? displayNameMatch[1] : '');
    return displayName ? `${displayName} <${smtpUser}>` : smtpUser;
  }

  return normalizedMailFrom;
}

const logoCid = 'mail-logo';
const defaultLogoPath = path.join(__dirname, '../../image-assets/coreandco.png');

let transporter = null;

function getMailConfig() {
  const smtpHost = requireEnv('SMTP_HOST');
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = requireEnv('SMTP_USER');
  const rawSmtpPass = requireEnv('SMTP_PASS');
  const smtpPass = /gmail\.com|googlemail\.com/i.test(normalizeEnvString(smtpHost))
    ? rawSmtpPass.replace(/\s+/g, '')
    : rawSmtpPass;
  const mailFrom = buildSafeMailFrom({
    smtpHost,
    smtpUser,
    mailFrom: process.env.MAIL_FROM || smtpUser,
  });

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    mailFrom,
    brandName: process.env.MAIL_BRAND_NAME || 'Core&Co',
    supportEmail: process.env.SUPPORT_EMAIL || '',
    logoUrl: process.env.MAIL_LOGO_URL || '',
    logoPath: process.env.MAIL_LOGO_PATH || '',
  };
}

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const { smtpHost, smtpPort, smtpUser, smtpPass } = getMailConfig();
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  return transporter;
}

function buildVerificationUrl(token) {
  const baseUrl = resolveWebstoreBaseUrl();
  return `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
}

function buildPasswordResetUrl(token) {
  const webstoreBaseUrl = resolveWebstoreBaseUrl();
  return `${webstoreBaseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
}

function buildWebstoreHomeUrl() {
  return resolveWebstoreBaseUrl();
}

function getLogoAsset() {
  const { logoUrl, logoPath } = getMailConfig();

  if (logoUrl) {
    return {
      logoSrc: logoUrl,
      attachments: [],
    };
  }

  const resolvedLogoPath = logoPath
    ? (path.isAbsolute(logoPath) ? logoPath : path.join(__dirname, '../../', logoPath))
    : '';
  const candidatePath = [resolvedLogoPath, defaultLogoPath]
    .filter(Boolean)
    .find((logoFilePath) => fs.existsSync(logoFilePath));

  if (candidatePath) {
    return {
      logoSrc: `cid:${logoCid}`,
      attachments: [
        {
          filename: path.basename(candidatePath),
          path: candidatePath,
          cid: logoCid,
        },
      ],
    };
  }

  return {
    logoSrc: '',
    attachments: [],
  };
}

async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const { mailFrom } = getMailConfig();
  const client = getTransporter();

  return client.sendMail({
    from: mailFrom,
    to,
    subject,
    html,
    text,
    attachments,
  });
}

async function sendVerificationEmail({ to, token, firstName, expiresInMinutes = 5 }) {
  const verificationUrl = buildVerificationUrl(token);
  const { brandName, supportEmail } = getMailConfig();
  const { logoSrc, attachments } = getLogoAsset();
  const { html, text } = buildVerificationEmailTemplate({
    brandName,
    logoSrc,
    verificationUrl,
    firstName,
    expiresInMinutes,
    supportEmail,
  });

  return sendEmail({
    to,
    subject: `Verify your ${brandName} account`,
    html,
    text,
    attachments,
  });
}

async function sendReceiptEmail({
  to,
  firstName,
  orderNumber,
  orderDate,
  items,
  subtotal,
  shippingFee,
  tax,
  total,
  currency,
  receiptUrl,
}) {
  const { brandName, supportEmail } = getMailConfig();
  const { logoSrc, attachments } = getLogoAsset();
  const { html, text } = buildReceiptEmailTemplate({
    brandName,
    logoSrc,
    firstName,
    orderNumber,
    orderDate,
    items,
    subtotal,
    shippingFee,
    tax,
    total,
    currency,
    receiptUrl,
    supportEmail,
  });

  return sendEmail({
    to,
    subject: `Receipt for order ${orderNumber || ''}`.trim(),
    html,
    text,
    attachments,
  });
}

async function sendOrderUpdateEmail({
  to,
  firstName,
  orderNumber,
  orderStatus,
  trackingNumber,
  estimatedDeliveryDate,
  detailsUrl,
}) {
  const { brandName, supportEmail } = getMailConfig();
  const { logoSrc, attachments } = getLogoAsset();
  const { html, text } = buildOrderUpdateEmailTemplate({
    brandName,
    logoSrc,
    firstName,
    orderNumber,
    orderStatus,
    trackingNumber,
    estimatedDeliveryDate,
    detailsUrl,
    supportEmail,
  });

  return sendEmail({
    to,
    subject: `Order update: ${orderStatus || 'status changed'}`,
    html,
    text,
    attachments,
  });
}

async function sendForgotPasswordEmail({
  to,
  token,
  firstName,
  expiresInMinutes = 5,
}) {
  const resetUrl = buildPasswordResetUrl(token);
  const { brandName, supportEmail } = getMailConfig();
  const { logoSrc, attachments } = getLogoAsset();
  const { html, text } = buildForgotPasswordEmailTemplate({
    brandName,
    logoSrc,
    resetUrl,
    firstName,
    expiresInMinutes,
    supportEmail,
  });

  return sendEmail({
    to,
    subject: `Reset your ${brandName} account password`,
    html,
    text,
    attachments,
  });
}

async function sendCampaignBlastEmail({
  to,
  firstName,
  campaignName,
  campaignTypeLabel,
  offerLabel,
  startDate,
  endDate,
  shopUrl,
}) {
  const resolvedShopUrl = shopUrl || buildWebstoreHomeUrl();
  const { brandName, supportEmail } = getMailConfig();
  const { logoSrc, attachments } = getLogoAsset();
  const { html, text } = buildCampaignBlastEmailTemplate({
    brandName,
    logoSrc,
    firstName,
    campaignName,
    campaignTypeLabel,
    offerLabel,
    startDate,
    endDate,
    shopUrl: resolvedShopUrl,
    supportEmail,
  });

  return sendEmail({
    to,
    subject: campaignName
      ? `${campaignName} is now live at ${brandName}`
      : `A new offer is live at ${brandName}`,
    html,
    text,
    attachments,
  });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendForgotPasswordEmail,
  sendCampaignBlastEmail,
  sendReceiptEmail,
  sendOrderUpdateEmail,
  buildVerificationUrl,
  buildPasswordResetUrl,
  buildWebstoreHomeUrl,
};
