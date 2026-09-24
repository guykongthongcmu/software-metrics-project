const express = require('express');
const requireAdmin = require('./middleware/requireAdmin');
const path = require('path');
const cookieParser = require('cookie-parser');

// Import Admin Services (Standard Architect Practice)
const adminCategoryRouter = require('./routes/admin-category.routes');
const adminDashboardRouter = require('./routes/admin-dashboard.routes');
const adminProductRouter = require('./routes/admin-product.routes');
const adminCampaignRouter = require('./routes/admin-campaign.routes');
const adminOrderRouter = require('./routes/admin-order.routes');

const app = express();

app.use(express.json());
app.use(cookieParser()); // Enable Cookie Parsing for req.cookies
app.disable('view cache');
app.use('/image-assets', express.static(path.join(__dirname, '../image-assets')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const { parseAllowedOrigins, createCorsMiddleware } = require('./middleware/cors');

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
app.use(createCorsMiddleware({ allowedOrigins }));

// --- API Routes Orchestration (Architect-Grade Mounting) ---

// 1. Authentication Dispatcher
app.use('/api/auth', require('./routes/auth.routes'));

// 2. Client-Facing Discovery Namespace
const clientRouter = express.Router();
clientRouter.use(require('./routes/client-category.routes')); 
clientRouter.use(require('./routes/client-campaign.routes'));
clientRouter.use(require('./routes/product.routes'));
app.use('/api/client', clientRouter);

// 3. SECURE Admin Infrastructure (Flat-Path Architecture)
const adminPath = '/api/admin';

// Dashboard development bypass (Temporary fallback)
app.use(`${adminPath}/dashboard`, adminDashboardRouter);

// Protected Admin Services (Authenticated Domain Orchestration)
// Architect Note: All routers here prefixed internally (e.g., /categories, /products)
app.use(adminPath, requireAdmin, adminCategoryRouter);
app.use(adminPath, requireAdmin, adminDashboardRouter); 
app.use(adminPath, requireAdmin, adminProductRouter);
app.use(adminPath, requireAdmin, adminCampaignRouter);
app.use(adminPath, requireAdmin, adminOrderRouter);

// --- Error Lifecycle Management ---

app.use((req, res) => {
  console.log('--- 404 NOT FOUND --- Path:', req.originalUrl);
  res.status(404).json({ 
    status: 'error', 
    code: 'NOT_FOUND', 
    message: `Backend caught this 404: ${req.originalUrl}` 
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    status: 'Internal Server Error',
    code: "INTERNAL_SERVER_ERROR",
    message: "internal server error" 
  });
});

module.exports = app;
