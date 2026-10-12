const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization';

function parseAllowedOrigins(rawValue) {
  return new Set(
    String(rawValue || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
  );
}

function createCorsMiddleware({ allowedOrigins }) {
  return function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;

    if (!origin) {
      return next();
    }

    if (!allowedOrigins.has(origin)) {
      return res.status(403).json({
        status: 'error',
        code: 'CORS_ORIGIN_NOT_ALLOWED',
        message: 'origin is not allowed',
      });
    }

    // --- Top 0.1% CORS Security Fix ---
    // For cookies to work across ports (8080 <-> 3000), 
    // we MUST reflect the origin and set Allow-Credentials: true.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    
    const reqHeaders = req.headers['access-control-request-headers'];
    res.setHeader(
      'Access-Control-Allow-Headers',
      reqHeaders || DEFAULT_ALLOWED_HEADERS
    );
    // Ensure browsers understand this response varies by origin (CORS Cache Safety)
    res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    return next();
  };
}

module.exports = {
  parseAllowedOrigins,
  createCorsMiddleware,
};
