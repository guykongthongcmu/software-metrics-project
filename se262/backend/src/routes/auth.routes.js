const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const {
  sendVerificationEmail,
  sendForgotPasswordEmail,
} = require('../services/mail.service');
const { buildVerificationResultPageTemplate } = require('../services/email-template.service');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const verificationExpiryMinutes = Number(process.env.EMAIL_VERIFICATION_EXPIRY_MINUTES);
const EMAIL_VERIFICATION_EXPIRY_MINUTES = Number.isFinite(verificationExpiryMinutes) && verificationExpiryMinutes > 0
  ? verificationExpiryMinutes
  : 5;
const passwordResetExpiryMinutes = Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES);
const PASSWORD_RESET_EXPIRY_MINUTES = Number.isFinite(passwordResetExpiryMinutes) && passwordResetExpiryMinutes > 0
  ? passwordResetExpiryMinutes
  : 15;
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS);
const SESSION_TTL_HOURS = Number.isFinite(sessionTtlHours) && sessionTtlHours > 0
  ? sessionTtlHours
  : 24;

function normalizeSameSite(value) {
  const sameSite = normalizeString(value).toLowerCase();
  if (sameSite === 'strict' || sameSite === 'none') {
    return sameSite;
  }
  return 'lax';
}

function getSessionCookieOptions(expiresAt) {
  // --- Top 0.1% Local Development Fix ---
  // On localhost (HTTP), Secure: true causes the browser to silently REJECT the cookie.
  // We only enable Secure: true in production (HTTPS).
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction, // MUST BE FALSE on localhost HTTP
    sameSite: isProduction ? normalizeSameSite(process.env.SESSION_COOKIE_SAMESITE) : 'lax',
    expires: expiresAt,
    path: '/',
  };
}

function getSessionCookieClearOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? normalizeSameSite(process.env.SESSION_COOKIE_SAMESITE) : 'lax',
    path: '/',
  };
}

function parseCookieHeader(cookieHeader) {
  if (typeof cookieHeader !== 'string' || cookieHeader.trim() === '') {
    return {};
  }

  const cookies = {};
  cookieHeader.split(';').forEach((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      return;
    }

    try {
      cookies[key] = decodeURIComponent(value);
    } catch (error) {
      cookies[key] = value;
    }
  });

  return cookies;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function sendUnauthorized(res) {
  return res.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED',
    message: 'authentication is required',
  });
}

function isMissing(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function requestWantsHtml(req) {
  const format = normalizeString(req.query?.format).toLowerCase();
  if (format === 'json') {
    return false;
  }
  if (format === 'html') {
    return true;
  }
  const acceptHeader = req.get('accept') || '';
  return acceptHeader.includes('text/html');
}

function getVerificationPageLogoSrc() {
  const logoUrl = normalizeString(process.env.MAIL_LOGO_URL);
  if (logoUrl) {
    return logoUrl;
  }
  return '/image-assets/coreandco.png';
}

function sendVerificationResponse(req, res, {
  statusCode,
  jsonBody,
  title,
  subtitle,
  messageLines,
  cta,
}) {
  if (!requestWantsHtml(req)) {
    return res.status(statusCode).json(jsonBody);
  }

  const html = buildVerificationResultPageTemplate({
    brandName: process.env.MAIL_BRAND_NAME || 'Core&Co',
    logoSrc: getVerificationPageLogoSrc(),
    title,
    subtitle,
    messageLines,
    cta,
  });

  return res.status(statusCode).type('html').send(html);
}

function buildWebstoreHomeUrl(req) {
  const configuredHomeUrl = normalizeString(
    process.env.WEBSTORE_BASE_URL || process.env.FRONTEND_BASE_URL
  );

  if (configuredHomeUrl) {
    return configuredHomeUrl;
  }

  const requestProtocol = normalizeString(req.get('x-forwarded-proto')) || req.protocol || 'http';
  const requestHost = normalizeString(req.get('host'));

  if (requestHost) {
    try {
      const inferredUrl = new URL(`${requestProtocol}://${requestHost}`);
      if (inferredUrl.port === '3000') {
        inferredUrl.port = '8080';
      }
      return inferredUrl.toString().replace(/\/$/, '');
    } catch (error) {
      // Fall through to APP_BASE_URL fallback.
    }
  }

  const appBaseUrl = normalizeString(process.env.APP_BASE_URL);
  if (appBaseUrl) {
    try {
      const inferredUrl = new URL(appBaseUrl);
      if (inferredUrl.port === '3000') {
        inferredUrl.port = '8080';
      }
      return inferredUrl.toString().replace(/\/$/, '');
    } catch (error) {
      // Fall through to relative root fallback.
    }
  }

  return '/';
}

router.post('/check-email', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'email is required',
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'email format is invalid',
    });
  }

  try {
    const [rows] = await db.execute(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'email already exists',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'email is valid and available',
      data: {
        email,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  }
});

router.post('/signup', async (req, res) => {
  const payload = {
    email: normalizeEmail(req.body?.email),
    password: req.body?.password,
    first_name: normalizeString(req.body?.first_name),
    last_name: normalizeString(req.body?.last_name),
    DOB: normalizeString(req.body?.DOB),
    phone_number: normalizeString(req.body?.phone_number),
  };

  const missingFields = Object.entries(payload)
    .filter(([, value]) => isMissing(value))
    .map(([field]) => field);

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'missing required fields',
      missingFields,
    });
  }

  if (!EMAIL_REGEX.test(payload.email)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'email format is invalid',
    });
  }

  if (typeof payload.password !== 'string' || payload.password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      status: 'error',
      code: 'PASSWORD_TOO_SHORT',
      message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.execute(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [payload.email]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        status: 'error',
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'email already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(payload.password, 10);

    const [result] = await connection.execute(
      `INSERT INTO users
      (email, password_hash, first_name, last_name, date_of_birth, phone_number)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payload.email,
        hashedPassword,
        payload.first_name,
        payload.last_name,
        payload.DOB,
        payload.phone_number,
      ]
    );

    const verificationToken = crypto
      .randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES)
      .toString('hex');
    const tokenExpiresAt = new Date(
      Date.now() + (EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000)
    );

    await connection.execute(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)`,
      [result.insertId, verificationToken, tokenExpiresAt]
    );

    await connection.commit();

    let verificationEmailSent = false;
    try {
      await sendVerificationEmail({
        to: payload.email,
        token: verificationToken,
        firstName: payload.first_name,
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRY_MINUTES,
      });
      verificationEmailSent = true;
    } catch (mailError) {
      console.error('failed to send verification email:', mailError);
    }

    return res.status(201).json({
      status: 'success',
      message: verificationEmailSent
        ? 'user registered successfully. verification email sent'
        : 'user registered successfully. verification email pending',
      data: {
        user_id: result.insertId,
        email: payload.email,
        first_name: payload.first_name,
        last_name: payload.last_name,
        DOB: payload.DOB,
        phone_number: payload.phone_number,
        email_verified: false,
        verification_email_sent: verificationEmailSent,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('signup rollback failed:', rollbackError);
      }
    }

    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.get('/verify-email', async (req, res) => {
  const token = normalizeString(req.query?.token);
  const homeUrl = buildWebstoreHomeUrl(req);

  if (!token) {
    return sendVerificationResponse(req, res, {
      statusCode: 400,
      title: 'Verification link missing',
      subtitle: 'We could not verify your email just yet.',
      messageLines: [
        'The verification token is missing from the link.',
        'Please request a new verification email and try again.',
      ],
      cta: homeUrl
        ? {
          label: 'Back to store',
          url: homeUrl,
        }
        : null,
      jsonBody: {
        status: 'error',
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'token is required',
      },
    });
  }

  let connection;
  try {
    const [rows] = await db.execute(
      `SELECT
        evt.email_verification_token_id,
        evt.user_id,
        evt.used_at,
        evt.expires_at,
        u.email,
        u.email_verified_at
      FROM email_verification_tokens evt
      JOIN users u ON u.user_id = evt.user_id
      WHERE evt.token = ?
      LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return sendVerificationResponse(req, res, {
        statusCode: 400,
        title: 'Invalid verification link',
        subtitle: 'This link is not valid anymore.',
        messageLines: [
          'Please request a new verification email and use the latest link.',
        ],
        cta: homeUrl
          ? {
            label: 'Back to store',
            url: homeUrl,
          }
          : null,
        jsonBody: {
          status: 'error',
          code: 'INVALID_VERIFICATION_TOKEN',
          message: 'verification token is invalid',
        },
      });
    }

    const record = rows[0];

    if (record.used_at) {
      return sendVerificationResponse(req, res, {
        statusCode: 409,
        title: 'Link already used',
        subtitle: 'Your verification link was already used.',
        messageLines: [
          'If your account is already verified, you can sign in now.',
          'If not, request a fresh verification email.',
        ],
        cta: homeUrl
          ? {
            label: 'Back to store',
            url: homeUrl,
          }
          : null,
        jsonBody: {
          status: 'error',
          code: 'VERIFICATION_TOKEN_ALREADY_USED',
          message: 'verification token has already been used',
        },
      });
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return sendVerificationResponse(req, res, {
        statusCode: 410,
        title: 'Verification link expired',
        subtitle: 'This link has expired.',
        messageLines: [
          'Please request a new verification email and try again.',
        ],
        cta: homeUrl
          ? {
            label: 'Back to store',
            url: homeUrl,
          }
          : null,
        jsonBody: {
          status: 'error',
          code: 'VERIFICATION_TOKEN_EXPIRED',
          message: 'verification token has expired',
        },
      });
    }

    if (record.email_verified_at) {
      return sendVerificationResponse(req, res, {
        statusCode: 409,
        title: 'Email already verified',
        subtitle: 'Your email is already verified.',
        messageLines: [
          'You can sign in to your account now.',
        ],
        cta: homeUrl
          ? {
            label: 'Back to store',
            url: homeUrl,
          }
          : null,
        jsonBody: {
          status: 'error',
          code: 'EMAIL_ALREADY_VERIFIED',
          message: 'email is already verified',
        },
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      'UPDATE users SET email_verified_at = NOW() WHERE user_id = ?',
      [record.user_id]
    );

    await connection.execute(
      'UPDATE email_verification_tokens SET used_at = NOW() WHERE email_verification_token_id = ?',
      [record.email_verification_token_id]
    );

    await connection.commit();

    return sendVerificationResponse(req, res, {
      statusCode: 200,
      title: 'Email verified',
      subtitle: 'Thank you for verifying your email.',
      messageLines: [
        'Your account is now active and ready to use.',
        'You can continue to the webstore and sign in.',
      ],
      cta: homeUrl
        ? {
          label: 'Back to store',
          url: homeUrl,
        }
        : null,
      jsonBody: {
        status: 'success',
        message: 'email verified successfully',
        data: {
          user_id: record.user_id,
          email: record.email,
          email_verified: true,
        },
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('verify-email rollback failed:', rollbackError);
      }
    }

    console.error(error);
    return sendVerificationResponse(req, res, {
      statusCode: 500,
      title: 'Something went wrong',
      subtitle: 'We could not complete email verification.',
      messageLines: [
        'Please try again in a moment.',
      ],
      cta: homeUrl
        ? {
          label: 'Back to store',
          url: homeUrl,
        }
        : null,
      jsonBody: {
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'internal server error',
      },
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/user/signin', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'email is required',
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'email format is invalid',
    });
  }

  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'password is required',
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT user_id, email, first_name, last_name, phone_number, password_hash, email_verified_at
      FROM users
      WHERE email = ?
      LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'invalid email or password',
      });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'invalid email or password',
      });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (SESSION_TTL_HOURS * 60 * 60 * 1000));

    await db.execute(
      `INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at)
      VALUES ('USER', ?, NULL, ?, ?)`,
      [user.user_id, sessionToken, expiresAt]
    );

    res.cookie('session', sessionToken, getSessionCookieOptions(expiresAt));

    return res.status(200).json({
      status: 'success',
      message: 'signed in successfully',
      data: {
        role: 'user',
        user_id: user.user_id,
        email: user.email,
        name: `${normalizeString(user.first_name)} ${normalizeString(user.last_name)}`.trim(),
        phone_number: normalizeString(user.phone_number),
        email_verified: Boolean(user.email_verified_at),
        redirectTo: '/',
        session: {
          expiresAt: expiresAt.toISOString(),
        },
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'internal server error',
      });
    };
});

router.get('/user/profile', async (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sessionToken =
    typeof cookies.session === 'string' ? cookies.session.trim() : '';

  if (!sessionToken) {
    return sendUnauthorized(res);
  }

  try {
    const [sessionRows] = await db.execute(
      `SELECT session_id, user_id, subject_type, expires_at, revoked_at
       FROM sessions
       WHERE session_token = ?
       LIMIT 1`,
      [sessionToken]
    );

    const session = sessionRows[0];
    if (!session || session.subject_type !== 'USER' || session.revoked_at) {
      return sendUnauthorized(res);
    }

    const expiresAt = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return sendUnauthorized(res);
    }

    const [userRows] = await db.execute(
      `SELECT user_id, email, first_name, last_name, phone_number, date_of_birth, email_verified_at, created_at
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [session.user_id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'user was not found',
      });
    }

    const user = userRows[0];
    return res.status(200).json({
      status: 'success',
      message: 'profile retrieved successfully',
      data: {
        user_id: user.user_id,
        email: normalizeEmail(user.email),
        name: `${normalizeString(user.first_name)} ${normalizeString(user.last_name)}`.trim(),
        phone_number: normalizeString(user.phone_number),
        date_of_birth: user.date_of_birth,
        email_verified: Boolean(user.email_verified_at),
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  }
});

router.post('/admin/signin', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'email is required',
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'email format is invalid',
    });
  }

  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'password is required',
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT admin_id, email, password_hash, display_name, is_active
      FROM admin
      WHERE email = ?
      LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'invalid email or password'
      })
    }

    const admin = rows[0]
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'invalid email or password',
      })
    }

    if (!admin.is_active) {
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_INACTIVE',
        message: 'account is inactive, please contact support',
      })
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (SESSION_TTL_HOURS * 60 * 60 * 1000));

    await db.execute(
      `INSERT INTO sessions (subject_type, user_id, admin_id, session_token, expires_at)
      VALUES ('ADMIN', NULL, ?, ?, ?)`,
      [admin.admin_id, sessionToken, expiresAt]
    );

    res.cookie('session', sessionToken, getSessionCookieOptions(expiresAt));

    return res.status(200).json({
      status: 'success',
      message: 'signed in successfully',
      data: {
        role: 'admin',
        admin_id: admin.admin_id,
        email: normalizeEmail(admin.email),
        name: normalizeString(admin.display_name),
        redirectTo: '/dashboard',
        session: {
          expiresAt: expiresAt.toISOString(),
        },
        },
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'internal server error',
      })
    }
});

router.post('/resend-verification', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'email is required',
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'email format is invalid',
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT user_id, email, first_name, email_verified_at
      FROM users
      WHERE email = ?
      LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'user not found',
      });
    }

    const user = rows[0];

    if (user.email_verified_at) {
      await connection.rollback();
      return res.status(409).json({
        status: 'error',
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'email is already verified',
      });
    }

    await connection.execute(
      `UPDATE email_verification_tokens
      SET used_at = NOW()
      WHERE user_id = ? AND used_at IS NULL`,
      [user.user_id]
    );

    const verificationToken = crypto
      .randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES)
      .toString('hex');
    const tokenExpiresAt = new Date(
      Date.now() + (EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000)
    );

    await connection.execute(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)`,
      [user.user_id, verificationToken, tokenExpiresAt]
    );

    await connection.commit();

    let verificationEmailSent = false;
    try {
      await sendVerificationEmail({
        to: user.email,
        token: verificationToken,
        firstName: normalizeString(user.first_name),
        expiresInMinutes: EMAIL_VERIFICATION_EXPIRY_MINUTES,
      });
      verificationEmailSent = true;
    } catch (mailError) {
      console.error('failed to resend verification email:', mailError);
    }

    return res.status(200).json({
      status: 'success',
      message: verificationEmailSent
        ? 'verification email sent successfully'
        : 'verification email pending',
      data: {
        email: user.email,
        verification_email_sent: verificationEmailSent,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('resend-verification rollback failed:', rollbackError);
      }
    }

    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'email is required',
    });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({
      status: 'error',
      code: 'INVALID_EMAIL_FORMAT',
      message: 'email format is invalid',
    });
  }

  const successResponse = {
    status: 'success',
    message: 'if the email exists, a password reset link has been sent',
  };

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT user_id, email, first_name
      FROM users
      WHERE email = ?
      LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(200).json(successResponse);
    }

    const user = rows[0];

    await connection.execute(
      `UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = ? AND used_at IS NULL`,
      [user.user_id]
    );

    const resetToken = crypto
      .randomBytes(PASSWORD_RESET_TOKEN_BYTES)
      .toString('hex');
    const tokenExpiresAt = new Date(
      Date.now() + (PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000)
    );

    await connection.execute(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (?, ?, ?)`,
      [user.user_id, resetToken, tokenExpiresAt]
    );

    try {
      await sendForgotPasswordEmail({
        to: user.email,
        token: resetToken,
        firstName: normalizeString(user.first_name),
        expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
      });
    } catch (mailError) {
      console.error('failed to send password reset email:', mailError);
      await connection.rollback();
      return res.status(500).json({
        status: 'error',
        code: 'PASSWORD_RESET_EMAIL_FAILED',
        message: 'could not send password reset email',
      });
    }

    await connection.commit();

    return res.status(200).json(successResponse);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('forgot-password rollback failed:', rollbackError);
      }
    }
    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/reset-password', async (req, res) => {
  const token = normalizeString(req.body?.token);
  const newPassword = req.body?.new_password;
  const confirmPassword = req.body?.confirm_password;
  const missingFields = [];

  if (!token) {
    missingFields.push('token');
  }
  if (typeof newPassword !== 'string' || newPassword.trim().length === 0) {
    missingFields.push('new_password');
  }
  if (typeof confirmPassword !== 'string' || confirmPassword.trim().length === 0) {
    missingFields.push('confirm_password');
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: 'error',
      code: 'MISSING_REQUIRED_FIELDS',
      message: 'missing required fields',
      missingFields,
    });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      status: 'error',
      code: 'PASSWORD_TOO_SHORT',
      message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      status: 'error',
      code: 'PASSWORD_CONFIRMATION_MISMATCH',
      message: 'new password and confirm password do not match',
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT
        password_reset_token_id,
        user_id,
        used_at,
        expires_at
      FROM password_reset_tokens
      WHERE token = ?
      LIMIT 1
      FOR UPDATE`,
      [token]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PASSWORD_RESET_TOKEN',
        message: 'password reset token is invalid',
      });
    }

    const tokenRecord = rows[0];

    if (tokenRecord.used_at) {
      await connection.rollback();
      return res.status(409).json({
        status: 'error',
        code: 'PASSWORD_RESET_TOKEN_ALREADY_USED',
        message: 'password reset token has already been used',
      });
    }

    if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
      await connection.rollback();
      return res.status(410).json({
        status: 'error',
        code: 'PASSWORD_RESET_TOKEN_EXPIRED',
        message: 'password reset token has expired',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [hashedPassword, tokenRecord.user_id]
    );

    await connection.execute(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE password_reset_token_id = ?',
      [tokenRecord.password_reset_token_id]
    );

    await connection.execute(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE subject_type = 'USER'
         AND user_id = ?
         AND revoked_at IS NULL`,
      [tokenRecord.user_id]
    );

    await connection.commit();

    return res.status(200).json({
      status: 'success',
      message: 'password reset successfully',
      data: {
        password_reset: true,
      },
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('reset-password rollback failed:', rollbackError);
      }
    }
    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

router.post('/logout', async (req, res) => {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sessionToken =
    typeof cookies.session === 'string' ? cookies.session.trim() : '';

  if (!sessionToken) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'authentication is required',
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT session_id, revoked_at, expires_at
       FROM sessions
       WHERE session_token = ?
       LIMIT 1`,
      [sessionToken]
    );

    const session = rows[0];
    if (!session || session.revoked_at) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'authentication is required',
      });
    }

    const expiresAt = new Date(session.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'authentication is required',
      });
    }

    await db.execute(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE session_id = ? AND revoked_at IS NULL`,
      [session.session_id]
    );

    res.clearCookie('session', getSessionCookieClearOptions());

    return res.status(200).json({
      status: 'success',
      message: 'signed out successfully',
      data: {
        sessionRevoked: true,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: 'internal server error',
    });
  }
});

module.exports = router;
