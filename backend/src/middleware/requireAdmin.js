const db = require('../config/db');



function sendUnauthorized(res) {
  return res.status(401).json({
    status: 'error',
    code: 'UNAUTHORIZED',
    message: 'authentication is required',
  });
}

function sendForbidden(res) {
  return res.status(403).json({
    status: 'error',
    code: 'FORBIDDEN',
    message: 'admin access required',
  });
}

function createRequireAdmin({
  dbConnection = db,
} = {}) {
  return async function requireAdmin(req, res, next) {
    try {
      // SECURITY: Rely strictly on req.cookies from cookie-parser
      const sessionToken = req.cookies && typeof req.cookies.session === 'string'
        ? req.cookies.session.trim()
        : '';

      if (!sessionToken) {
        return sendUnauthorized(res);
      }

      const [sessionRows] = await dbConnection.execute(
        `SELECT session_id, subject_type, admin_id, expires_at, revoked_at
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

      if (session.subject_type !== 'ADMIN' || !session.admin_id) {
        return sendForbidden(res);
      }

      req.authAdmin = {
        adminId: Number(session.admin_id),
        sessionId: Number(session.session_id),
        sessionToken,
        role: 'admin',
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

const requireAdmin = createRequireAdmin();

module.exports = requireAdmin;
module.exports.createRequireAdmin = createRequireAdmin;
