const db = require('../config/db');

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

function sendUnauthorized(res) {
  return res.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED',
    message: 'authentication is required',
  });
}

function createRequireUserSession({ dbConnection = db } = {}) {
  return async function requireUserSession(req, res, next) {
    try {
      const cookies = parseCookieHeader(req.headers.cookie);
      const sessionToken =
        typeof cookies.session === 'string' ? cookies.session.trim() : '';

      if (!sessionToken) {
        return sendUnauthorized(res);
      }

      const [sessionRows] = await dbConnection.execute(
        `SELECT session_id, subject_type, user_id, expires_at, revoked_at
         FROM sessions
         WHERE session_token = ?
         LIMIT 1`,
        [sessionToken]
      );

      const session = sessionRows[0];
      if (!session || session.revoked_at) {
        return sendUnauthorized(res);
      }

      const expiresAt = new Date(session.expires_at).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return sendUnauthorized(res);
      }

      if (session.subject_type !== 'USER' || !session.user_id) {
        return sendUnauthorized(res);
      }

      req.authUser = {
        userId: Number(session.user_id),
        sessionId: Number(session.session_id),
        sessionToken,
        role: 'user',
      };

      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        status: 'error',
        code: 'INTERNAL_SERVER_ERROR',
        message: 'internal server error',
      });
    }
  };
}

const requireUserSession = createRequireUserSession();

module.exports = requireUserSession;
module.exports.createRequireUserSession = createRequireUserSession;
