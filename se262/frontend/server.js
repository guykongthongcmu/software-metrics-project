require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const { withFormatted, searchProducts } = require('./public/js/client-searchService');
const multer = require('multer');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const app = express();
const port = 8080;
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000';
const LOCAL_API_PASSTHROUGH_PREFIXES = ['/cart/items', '/auth/logout'];
const STOREFRONT_CATEGORY_CONFIG = {
    men: { label: 'Men', path: '/men' },
    women: { label: 'Women', path: '/women' },
    kids: { label: 'Kids', path: '/kids' },
    baby: { label: 'Baby', path: '/baby' },
    unisex: { label: 'Unisex', path: '/unisex' },
};
const STOREFRONT_CATEGORY_ORDER = ['men', 'women', 'kids', 'baby', 'unisex'];
const STOREFRONT_CATEGORY_ALIAS = {
    kid: 'kids',
};
const STOREFRONT_CATEGORY_PARENTS = {
    men: ['men'],
    women: ['women'],
    kids: ['kids', 'kid'],
    baby: ['baby'],
    unisex: ['unisex'],
};

function normalizeStorefrontCategorySlug(rawSlug) {
    const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
    return STOREFRONT_CATEGORY_ALIAS[slug] || slug;
}

function getDefaultStorefrontCategories() {
    return STOREFRONT_CATEGORY_ORDER.map((slug) => ({
        slug,
        label: STOREFRONT_CATEGORY_CONFIG[slug].label,
        path: STOREFRONT_CATEGORY_CONFIG[slug].path,
    }));
}

function mapVisibleStorefrontCategories(rawCategories = []) {
    const visibleSlugs = new Set();

    for (const category of rawCategories) {
        const normalizedSlug = normalizeStorefrontCategorySlug(category?.slug);
        if (STOREFRONT_CATEGORY_CONFIG[normalizedSlug]) {
            visibleSlugs.add(normalizedSlug);
        }
    }

    return STOREFRONT_CATEGORY_ORDER
        .filter((slug) => visibleSlugs.has(slug))
        .map((slug) => ({
            slug,
            label: STOREFRONT_CATEGORY_CONFIG[slug].label,
            path: STOREFRONT_CATEGORY_CONFIG[slug].path,
        }));
}

function buildStorefrontCategoryVisibility(categories = []) {
    const visibleSlugSet = new Set((categories || []).map((category) => category.slug));
    return STOREFRONT_CATEGORY_ORDER.reduce((acc, slug) => {
        acc[slug] = visibleSlugSet.has(slug);
        return acc;
    }, {});
}

function createCategoryCounts(categories = []) {
    const counts = { all: 0 };
    for (const category of categories) {
        counts[category.slug] = 0;
    }
    return counts;
}

function createSearchCategoryChips(categories = []) {
    return [
        { key: 'all', label: 'All' },
        ...categories.map((category) => ({
            key: category.slug,
            label: category.label,
        })),
    ];
}

function categoryNameMatchesSlug(categoryName, slug) {
    const normalizedSlug = normalizeStorefrontCategorySlug(slug);
    const value = typeof categoryName === 'string' ? categoryName.toLowerCase() : '';
    const parentSlugs = STOREFRONT_CATEGORY_PARENTS[normalizedSlug] || [normalizedSlug];
    return parentSlugs.some((parentSlug) => value.includes(parentSlug));
}

async function fetchVisibleStorefrontCategories() {
    const response = await fetch(`${API_BASE}/api/client/categories?sort=category_name&order=asc`);
    if (!response.ok) {
        throw new Error(`failed to fetch categories with status ${response.status}`);
    }

    const payload = await response.json();
    return mapVisibleStorefrontCategories(payload?.data?.categories || []);
}

async function readProxyRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];

        req.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        req.on('end', () => {
            if (chunks.length === 0) {
                resolve(null);
                return;
            }

            resolve(Buffer.concat(chunks));
        });

        req.on('error', reject);
    });
}

async function readJsonSafely(response) {
    return response.json().catch(() => null);
}

function responseLooksJson(response) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    return contentType.includes('application/json') || contentType.includes('+json');
}

function mapStorefrontSessionUser(profileData = {}) {
    const name = typeof profileData.name === 'string'
        ? profileData.name.trim()
        : [profileData.firstName, profileData.lastName]
            .filter((value) => typeof value === 'string' && value.trim() !== '')
            .join(' ')
            .trim();

    return {
        name: name || '',
        email: typeof profileData.email === 'string' ? profileData.email.trim() : '',
        phone: typeof profileData.phone_number === 'string'
            ? profileData.phone_number.trim()
            : (typeof profileData.phone === 'string' ? profileData.phone.trim() : ''),
    };
}

async function resolveStorefrontSessionUser(req, res) {
    const backendSessionToken = typeof req.cookies?.session === 'string'
        ? req.cookies.session.trim()
        : '';

    if (!backendSessionToken) {
        if (req.session?.user) {
            req.session.user = null;
        }
        return null;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/user/profile`, {
            headers: {
                cookie: req.headers.cookie || `session=${backendSessionToken}`
            }
        });

        const json = await readJsonSafely(response);

        if (response.status === 401 || !response.ok || !json?.data) {
            if (req.session?.user) {
                req.session.user = null;
            }
            if (response.status === 401) {
                res.clearCookie('session');
            }
            return null;
        }

        const user = mapStorefrontSessionUser(json.data);
        if (req.session) {
            req.session.user = user;
        }
        return user;
    } catch (error) {
        console.error('Failed to resolve storefront session user:', error.message);
        return req.session?.user || null;
    }
}

// Proxy all /api requests to the backend (MUST BE FIRST)
app.use('/api', async (req, res, next) => {
    const shouldUseLocalApiRoute = LOCAL_API_PASSTHROUGH_PREFIXES.some((prefix) => {
        return req.path === prefix || req.path.startsWith(`${prefix}/`);
    });

    if (shouldUseLocalApiRoute) {
        return next();
    }

    const targetUrl = `${API_BASE}${req.originalUrl}`;
    try {
        const proxyHeaders = { ...req.headers };
        delete proxyHeaders['host'];
        delete proxyHeaders['content-length']; // Let fetch recalculate this
        
        const fetchOptions = {
            method: req.method,
            headers: {
                ...proxyHeaders,
                // THE CRITICAL NODESJS PROXY FIX: 
                // We MUST manually pass the 'Cookie' header from the browser to the backend.
                // Standard fetch in Node does NOT automatically manage this.
                'cookie': req.headers.cookie || ''
            }
        };

        // --- THE CRITICAL MULTIPART FIX ---
        // If we have a body (POST/PUT), we must forward it correctly.
        // For JSON/URLencoded, Express might have already parsed it into req.body.
        // For Multipart (Campaign Launch), we want the raw stream if possible.
        if (!['GET', 'HEAD'].includes(req.method)) {
            const rawBody = await readProxyRequestBody(req);
            if (rawBody && rawBody.length > 0) {
                fetchOptions.body = rawBody;
            }
        }

        delete fetchOptions.headers['content-length'];

        const response = await fetch(targetUrl, fetchOptions);
        const setCookie = typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : response.headers.get('set-cookie');

        if (setCookie && setCookie.length > 0) {
            const forwardedCookies = Array.isArray(setCookie)
                ? setCookie.map((cookie) => cookie.replace(/;\s*Secure/gi, ''))
                : setCookie.replace(/;\s*Secure/gi, '');

            res.setHeader('Set-Cookie', forwardedCookies);
        }

        response.headers.forEach((v, k) => {
            if (k !== 'content-encoding' && k !== 'set-cookie') {
                res.setHeader(k, v);
            }
        });

        if (responseLooksJson(response)) {
            const data = await readJsonSafely(response);
            return res.status(response.status).json(data || { status: 'error', message: 'Backend Response failure' });
        }

        const body = await response.text();
        return res.status(response.status).send(body);
        
    } catch (error) {
        console.error('--- PROXY ERROR ---', error);
        res.status(502).json({ status: 'error', message: 'Auth Proxy Error', details: error.message });
    }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('view cache');
app.use(cookieParser());
app.use(expressLayouts);
app.set('layout', false);


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'coreco-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 วัน
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

const adminRouter = express.Router();
const webstoreRouter = express.Router();

// Multer Config for Product Images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public/uploads/products');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'prod-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const products = [
    {
        id: 'P001',
        name: 'Linen Shirt',
        category: 'men',
        color: ['Beige', 'Dark Grey', 'Brown'],
        colors: [
            { hex: '#e5e5e5', border: true },
            { hex: '#3b3a36', border: false },
            { hex: '#9c8a74', border: false }
        ],
        price: 80,
        originalPrice: null,
        discount: null,
        size: ['S', 'M', 'L', 'XL'],
        image: '/images/linen_shirt.jpg',
        imageStyle: null,
        inStock: true,
        createdAt: new Date('2026-03-01T10:00:00Z')
    },
    {
        id: 'P002',
        name: 'Classic Tee',
        category: 'women',
        color: ['White', 'Black'],
        colors: [
            { hex: '#ffffff', border: true },
            { hex: '#222222', border: false }
        ],
        price: 45,
        originalPrice: null,
        discount: null,
        size: ['XS', 'S', 'M', 'L', 'XL'],
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        imageStyle: 'object-fit: contain; padding: 20px; background-color: white;',
        inStock: true,
        createdAt: new Date('2026-03-02T10:00:00Z')
    },
    {
        id: 'P003',
        name: 'Knit Sweater',
        category: 'women',
        color: ['Brown', 'Cream'],
        colors: [
            { hex: '#ab8e76', border: false },
            { hex: '#e5dac9', border: false }
        ],
        price: 120,
        originalPrice: 150,
        discount: 20,
        size: ['S', 'M', 'L'],
        image: '/images/knitted_sweater.png',
        imageStyle: null,
        inStock: true,
        createdAt: new Date('2026-03-03T10:00:00Z')
    },
    {
        id: 'P004',
        name: 'Silk Blouse',
        category: 'kids',
        color: ['Cream', 'Black'],
        colors: [
            { hex: '#e5dac9', border: false },
            { hex: '#111111', border: false }
        ],
        price: 168,
        originalPrice: null,
        discount: null,
        size: ['S', 'M', 'L'],
        image: 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
        imageStyle: null,
        inStock: false,
        createdAt: new Date('2026-02-28T10:00:00Z')
    }
];

const adminMockData = {
    user: { name: 'Admin User', avatar: 'A', role: 'Administrator' },
    stats: {
        revenue: { total: 284750, growth: 24 },
        orders: { total: 2543 },
        productsSold: 4280
    },
    dailyLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dailyRevenue: [12000, 19000, 15000, 22000, 18000, 25000, 21000],
    recentActivity: [
        { type: 'order', text: 'New order #1024 from John D.', time: '10 mins ago' },
        { type: 'review', text: '5-star review on Classic White Tee', time: '1 hour ago' },
        { type: 'product', text: 'Low stock: Denim Jacket (Size M)', time: '3 hours ago' }
    ],
    topProducts: [
        { name: 'Classic White Tee', views: 1245, wishlists: 342, sales: 856 },
        { name: 'Denim Jacket', views: 980, wishlists: 215, sales: 432 },
        { name: 'Linen Shirt', views: 854, wishlists: 189, sales: 321 }
    ],
    categoryPerformance: [
        { name: 'Men', revenue: 45000 },
        { name: 'Women', revenue: 38000 },
        { name: 'Kids', revenue: 25000 },
        { name: 'Infant', revenue: 15000 },
        { name: 'Unisex', revenue: 22000 }
    ],
    orderStatuses: ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
    orders: [
        {
            id: 1,
            order_id: 'ORD-1024',
            created_at: '2026-03-09 10:00',
            customer_name: 'John Doe',
            customer_avatar: 'J',
            customer_email: 'john@ext.com',
            shipping_address: '123 Main St, City, ST 12345',
            items: [{ product_name: 'Classic White Tee', sku: 'TSH-WHT-M', size: 'M', quantity: 2, price: 25.0 }],
            items_count: 2,
            total: 50.0,
            status: 'DELIVERED'
        },
        {
            id: 2,
            order_id: 'ORD-1025',
            created_at: '2026-03-09 11:30',
            customer_name: 'Jane Smith',
            customer_avatar: 'S',
            customer_email: 'jane@ext.com',
            shipping_address: '456 Oak Ave, Town, TX 54321',
            items: [{ product_name: 'Denim Jacket', sku: 'JAC-DEN-L', size: 'L', quantity: 1, price: 85.0 }],
            items_count: 1,
            total: 85.0,
            status: 'PENDING'
        }
    ]
};

// Auto-generate more orders for pagination demo
const statuses = ['PENDING', 'SHIPPED', 'DELIVERED', 'PAID', 'CANCELLED'];
for (let i = 3; i <= 35; i++) {
    adminMockData.orders.push({
        id: i, order_id: `ORD-${1025 + i}`, created_at: `2026-03-${String((i % 20) + 1).padStart(2, '0')} 14:00`,
        customer_name: `Customer ${i}`, customer_avatar: `C${i}`, customer_email: `user${i}@example.com`,
        shipping_address: `${i} Admin St, Shopward, NY`, items: [{ product_name: 'Twill Trousers', sku: 'PNT-TW-3', size: 'L', quantity: 1, price: 120.0 }],
        items_count: 1, total: 120.00, status: statuses[i % statuses.length]
    });
}

const userFavorites = [];

const adminCategories = [
    {
        id: 1,
        name: 'Men',
        is_hidden: false,
        sub_types: [
            { name: 'T-Shirts & Sweatshirts', is_hidden: false },
            { name: 'Shirts & Polo Shirts', is_hidden: false },
            { name: 'Knitwear & Sweaters', is_hidden: false },
            { name: 'Outerwear', is_hidden: false },
            { name: 'Pants', is_hidden: false },
            { name: 'Innerwear & Socks', is_hidden: false },
            { name: 'Loungewear', is_hidden: false },
            { name: 'Accessories', is_hidden: false },
            { name: 'Sport Utility Wear', is_hidden: false },
            { name: 'UV Protection Collection', is_hidden: false },
            { name: 'AIRism', is_hidden: false },
            { name: 'HEATTECH', is_hidden: false },
            { name: 'Linen', is_hidden: false },
            { name: 'Special Collaborations', is_hidden: false },
            { name: 'New Arrivals', is_hidden: false },
            { name: 'Price Down', is_hidden: false }
        ]
    },
    {
        id: 2,
        name: 'Women',
        is_hidden: false,
        sub_types: [
            { name: 'T-Shirts & Sweats & Bra Tops', is_hidden: false },
            { name: 'Shirts & Polo Shirts', is_hidden: false },
            { name: 'Knitwear & Cardigans', is_hidden: false },
            { name: 'Outerwear', is_hidden: false },
            { name: 'Bottoms', is_hidden: false },
            { name: 'Dresses & Skirts', is_hidden: false },
            { name: 'Innerwear & Socks', is_hidden: false },
            { name: 'Loungewear', is_hidden: false },
            { name: 'Linen', is_hidden: false },
            { name: 'Accessories', is_hidden: false },
            { name: 'Sport Utility Wear', is_hidden: false },
            { name: 'UV Protection Collection', is_hidden: false },
            { name: 'AIRism', is_hidden: false },
            { name: 'HEATTECH', is_hidden: false },
            { name: 'Maternity', is_hidden: false },
            { name: 'New Arrivals', is_hidden: false }
        ]
    },
    {
        id: 3,
        name: 'Kids',
        is_hidden: false,
        sub_types: [
            { name: 'T-Shirts & Sweatshirts', is_hidden: false },
            { name: 'Shirts & Blouses', is_hidden: false },
            { name: 'Outerwear', is_hidden: false },
            { name: 'Bottoms', is_hidden: false },
            { name: 'Dresses & Skirts', is_hidden: false },
            { name: 'Activewear', is_hidden: false },
            { name: 'Pajamas', is_hidden: false },
            { name: 'Innerwear & Socks', is_hidden: false },
            { name: 'AIRism', is_hidden: false },
            { name: 'HEATTECH', is_hidden: false },
            { name: 'Special Collaborations', is_hidden: false },
            { name: 'Accessories', is_hidden: false }
        ]
    },
    {
        id: 4,
        name: 'Baby',
        is_hidden: false,
        sub_types: [
            { name: 'Bodysuits & Rompers', is_hidden: false },
            { name: 'Tops & T-Shirts', is_hidden: false },
            { name: 'Outerwear', is_hidden: false },
            { name: 'Bottoms & Leggings', is_hidden: false },
            { name: 'Dresses & Skirts', is_hidden: false },
            { name: 'Pajamas & Sleepwear', is_hidden: false },
            { name: 'Innerwear & Socks', is_hidden: false },
            { name: 'AIRism', is_hidden: false },
            { name: 'HEATTECH', is_hidden: false },
            { name: 'Special Collaborations', is_hidden: false },
            { name: 'Accessories', is_hidden: false },
            { name: 'Maternity & Newborn', is_hidden: false }
        ]
    },
    {
        id: 5,
        name: 'Unisex',
        is_hidden: false,
        sub_types: [
            { name: 'T-Shirts', is_hidden: false },
            { name: 'Sweatshirts & Hoodies', is_hidden: false },
            { name: 'Outerwear', is_hidden: false },
            { name: 'Bottoms', is_hidden: false },
            { name: 'Activewear', is_hidden: false },
            { name: 'Loungewear', is_hidden: false },
            { name: 'Accessories', is_hidden: false },
            { name: 'Bags', is_hidden: false },
            { name: 'Shoes', is_hidden: false },
            { name: 'Sunglasses', is_hidden: false },
            { name: 'AIRism', is_hidden: false },
            { name: 'Special Collaborations', is_hidden: false }
        ]
    }
];

const adminProducts = [
    // MEN - 12 Products
    { id: 1, name: 'Premium Oxford Shirt', wishlists: 124, price: 39.9, status: 'active', category_name: 'Men', sub_type: 'Shirts & Polo Shirts', stock: 85, items_sold: 45, engagement: 820, images: ['https://images.unsplash.com/photo-1598033129183-c4f50c717658?w=400'], variants: [{ size: 'M', color: 'Blue', stock: 40 }, { size: 'L', color: 'Blue', stock: 45 }], sku: 'PROD-MN-1' },
    { id: 2, name: 'Crew Neck T-Shirt', wishlists: 342, price: 19.9, status: 'active', category_name: 'Men', sub_type: 'T-Shirts & Sweatshirts', stock: 120, items_sold: 156, engagement: 1200, images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'], variants: [{ size: 'M', color: 'White', stock: 60 }, { size: 'L', color: 'White', stock: 60 }], sku: 'PROD-MN-2' },
    { id: 3, name: 'Slim Fit Chino Pants', wishlists: 89, price: 49.9, status: 'active', category_name: 'Men', sub_type: 'Pants', stock: 45, items_sold: 22, engagement: 450, images: ['https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400'], variants: [{ size: '32', color: 'Beige', stock: 20 }, { size: '34', color: 'Beige', stock: 25 }], sku: 'PROD-MN-3' },
    { id: 4, name: 'Ultra Light Down Jacket', wishlists: 567, price: 79.9, status: 'active', category_name: 'Men', sub_type: 'Outerwear', stock: 30, items_sold: 88, engagement: 2100, images: ['https://images.unsplash.com/photo-1544923246-77307dd654ca?w=400'], variants: [{ size: 'L', color: 'Navy', stock: 15 }, { size: 'XL', color: 'Navy', stock: 15 }], sku: 'PROD-MN-4' },
    { id: 5, name: 'AIRism Pique Polo Shirt', wishlists: 215, price: 29.9, status: 'active', category_name: 'Men', sub_type: 'Shirts & Polo Shirts', stock: 95, items_sold: 67, engagement: 940, images: ['https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400'], variants: [{ size: 'M', color: 'Black', stock: 45 }, { size: 'L', color: 'Black', stock: 50 }], sku: 'PROD-MN-5' },
    { id: 6, name: 'Stretch Slim Fit Jeans', wishlists: 178, price: 59.9, status: 'active', category_name: 'Men', sub_type: 'Pants', stock: 60, items_sold: 34, engagement: 680, images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400'], variants: [{ size: '30', color: 'Blue', stock: 30 }, { size: '32', color: 'Blue', stock: 30 }], sku: 'PROD-MN-6' },
    { id: 7, name: 'Supima Cotton Tee', wishlists: 290, price: 14.9, status: 'active', category_name: 'Men', sub_type: 'T-Shirts & Sweatshirts', stock: 200, items_sold: 312, engagement: 1500, images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'], variants: [{ size: 'M', color: 'Grey', stock: 100 }, { size: 'L', color: 'Grey', stock: 100 }], sku: 'PROD-MN-7' },
    { id: 8, name: 'Linen Blend Short Sleeve Shirt', wishlists: 143, price: 34.9, status: 'active', category_name: 'Men', sub_type: 'Linen', stock: 40, items_sold: 15, engagement: 320, images: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400'], variants: [{ size: 'M', color: 'White', stock: 20 }, { size: 'L', color: 'White', stock: 20 }], sku: 'PROD-MN-8' },
    { id: 9, name: 'Dry-EX Active Shorts', wishlists: 98, price: 24.9, status: 'active', category_name: 'Men', sub_type: 'Sport Utility Wear', stock: 55, items_sold: 42, engagement: 510, images: ['https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400'], variants: [{ size: 'M', color: 'Black', stock: 25 }, { size: 'L', color: 'Black', stock: 30 }], sku: 'PROD-MN-9' },
    { id: 10, name: 'Cashmere V-Neck Sweater', wishlists: 412, price: 99.9, status: 'active', category_name: 'Men', sub_type: 'Knitwear & Sweaters', stock: 20, items_sold: 12, engagement: 780, images: ['https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?w=400'], variants: [{ size: 'M', color: 'Camel', stock: 10 }, { size: 'L', color: 'Camel', stock: 10 }], sku: 'PROD-MN-10' },
    { id: 11, name: 'Dry Sweatpants', wishlists: 156, price: 39.9, status: 'active', category_name: 'Men', sub_type: 'Loungewear', stock: 80, items_sold: 55, engagement: 620, images: ['https://images.unsplash.com/photo-1552632204-6f0275817fc1?w=400'], variants: [{ size: 'M', color: 'Grey', stock: 40 }, { size: 'L', color: 'Grey', stock: 40 }], sku: 'PROD-MN-11' },
    { id: 12, name: 'Flannel Checked Shirt', wishlists: 231, price: 29.9, status: 'active', category_name: 'Men', sub_type: 'Shirts & Polo Shirts', stock: 50, items_sold: 89, engagement: 890, images: ['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400'], variants: [{ size: 'M', color: 'Red', stock: 25 }, { size: 'L', color: 'Red', stock: 25 }], sku: 'PROD-MN-12' },

    // WOMEN - 12 Products
    { id: 13, name: 'Rayon Long Sleeve Blouse', wishlists: 289, price: 29.9, status: 'active', category_name: 'Women', sub_type: 'Shirts & Polo Shirts', stock: 110, items_sold: 76, engagement: 950, images: ['https://images.unsplash.com/photo-1582533081064-0752f99f1fa0?w=400'], variants: [{ size: 'S', color: 'Pink', stock: 50 }, { size: 'M', color: 'Pink', stock: 60 }], sku: 'PROD-WM-13' },
    { id: 14, name: 'Pleated Midi Skirt', wishlists: 456, price: 39.9, status: 'active', category_name: 'Women', sub_type: 'Dresses & Skirts', stock: 45, items_sold: 124, engagement: 1800, images: ['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400'], variants: [{ size: 'S', color: 'Beige', stock: 20 }, { size: 'M', color: 'Beige', stock: 25 }], sku: 'PROD-WM-14' },
    { id: 15, name: 'High Rise Skinny Jeans', wishlists: 234, price: 49.9, status: 'active', category_name: 'Women', sub_type: 'Bottoms', stock: 75, items_sold: 45, engagement: 880, images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400'], variants: [{ size: '26', color: 'Blue', stock: 35 }, { size: '28', color: 'Blue', stock: 40 }], sku: 'PROD-WM-15' },
    { id: 16, name: 'Ultra Stretch Leggings', wishlists: 678, price: 24.9, status: 'active', category_name: 'Women', sub_type: 'Bottoms', stock: 300, items_sold: 945, engagement: 3200, images: ['https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400'], variants: [{ size: 'M', color: 'Black', stock: 150 }, { size: 'L', color: 'Black', stock: 150 }], sku: 'PROD-WM-16' },
    { id: 17, name: 'Wireless Bra (Relax)', wishlists: 512, price: 19.9, status: 'active', category_name: 'Women', sub_type: 'Innerwear & Socks', stock: 150, items_sold: 412, engagement: 2100, images: ['https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?w=400'], variants: [{ size: 'M', color: 'Nude', stock: 75 }, { size: 'L', color: 'Nude', stock: 75 }], sku: 'PROD-WM-17' },
    { id: 18, name: 'Cashmere Cardigan', wishlists: 321, price: 89.9, status: 'active', category_name: 'Women', sub_type: 'Knitwear & Cardigans', stock: 25, items_sold: 18, engagement: 920, images: ['https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?w=400'], variants: [{ size: 'S', color: 'Grey', stock: 12 }, { size: 'M', color: 'Grey', stock: 13 }], sku: 'PROD-WM-18' },
    { id: 19, name: 'Linen Blend A-Line Dress', wishlists: 198, price: 49.9, status: 'active', category_name: 'Women', sub_type: 'Linen', stock: 40, items_sold: 32, engagement: 740, images: ['https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=400'], variants: [{ size: 'S', color: 'White', stock: 20 }, { size: 'M', color: 'White', stock: 20 }], sku: 'PROD-WM-19' },
    { id: 20, name: 'AIRism Mesh Hoodie', wishlists: 345, price: 29.9, status: 'active', category_name: 'Women', sub_type: 'UV Protection Collection', stock: 100, items_sold: 215, engagement: 1400, images: ['https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400'], variants: [{ size: 'M', color: 'Light Blue', stock: 50 }, { size: 'L', color: 'Light Blue', stock: 50 }], sku: 'PROD-WM-20' },
    { id: 21, name: 'Seamless Down Parka', wishlists: 890, price: 129.9, status: 'active', category_name: 'Women', sub_type: 'Outerwear', stock: 15, items_sold: 64, engagement: 2800, images: ['https://images.unsplash.com/photo-1544923246-77307dd654ca?w=400'], variants: [{ size: 'M', color: 'Dark Green', stock: 7 }, { size: 'L', color: 'Dark Green', stock: 8 }], sku: 'PROD-WM-21' },
    { id: 22, name: 'Merino Wool Crew Sweater', wishlists: 267, price: 39.9, status: 'active', category_name: 'Women', sub_type: 'Knitwear & Cardigans', stock: 65, items_sold: 92, engagement: 1100, images: ['https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?w=400'], variants: [{ size: 'S', color: 'Red', stock: 30 }, { size: 'M', color: 'Red', stock: 35 }], sku: 'PROD-WM-22' },
    { id: 23, name: 'Wide Straight Pants', wishlists: 187, price: 39.9, status: 'active', category_name: 'Women', sub_type: 'Bottoms', stock: 50, items_sold: 28, engagement: 610, images: ['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400'], variants: [{ size: 'M', color: 'Khaki', stock: 25 }, { size: 'L', color: 'Khaki', stock: 25 }], sku: 'PROD-WM-23' },
    { id: 24, name: 'Satin Tie-Neck Blouse', wishlists: 145, price: 34.9, status: 'active', category_name: 'Women', sub_type: 'Shirts & Polo Shirts', stock: 35, items_sold: 14, engagement: 420, images: ['https://images.unsplash.com/photo-1582533081064-0752f99f1fa0?w=400'], variants: [{ size: 'S', color: 'Ivory', stock: 15 }, { size: 'M', color: 'Ivory', stock: 20 }], sku: 'PROD-WM-24' },

    // KIDS - 12 Products
    { id: 25, name: 'Graphic T-Shirt (UT)', wishlists: 112, price: 14.9, status: 'active', category_name: 'Kids', sub_type: 'T-Shirts & Sweatshirts', stock: 200, items_sold: 512, engagement: 1100, images: ['https://images.unsplash.com/photo-1519235108632-401669476020?w=400'], variants: [{ size: '130', color: 'Yellow', stock: 100 }, { size: '150', color: 'Yellow', stock: 100 }], sku: 'PROD-KD-25' },
    { id: 26, name: 'Warm Padded Parka', wishlists: 345, price: 49.9, status: 'active', category_name: 'Kids', sub_type: 'Outerwear', stock: 40, items_sold: 89, engagement: 1400, images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400'], variants: [{ size: '120', color: 'Blue', stock: 20 }, { size: '140', color: 'Blue', stock: 20 }], sku: 'PROD-KD-26' },
    { id: 27, name: 'Ultra Stretch Pants', wishlists: 67, price: 19.9, status: 'active', category_name: 'Kids', sub_type: 'Bottoms', stock: 150, items_sold: 342, engagement: 920, images: ['https://images.unsplash.com/photo-1519457431-75514e715d91?w=400'], variants: [{ size: '130', color: 'Navy', stock: 75 }, { size: '150', color: 'Navy', stock: 75 }], sku: 'PROD-KD-27' },
    { id: 28, name: 'Soft Touch Crew Tee', wishlists: 89, price: 9.9, status: 'active', category_name: 'Kids', sub_type: 'T-Shirts & Sweatshirts', stock: 250, items_sold: 678, engagement: 1300, images: ['https://images.unsplash.com/photo-1519235108632-401669476020?w=400'], variants: [{ size: '120', color: 'Grey', stock: 125 }, { size: '140', color: 'Grey', stock: 125 }], sku: 'PROD-KD-28' },
    { id: 30, name: 'Dry Sweat Pullover Hoodie', wishlists: 123, price: 24.9, status: 'active', category_name: 'Kids', sub_type: 'Activewear', stock: 85, items_sold: 45, engagement: 680, images: ['https://images.unsplash.com/photo-1519235108632-401669476020?w=400'], variants: [{ size: '130', color: 'Black', stock: 40 }, { size: '150', color: 'Black', stock: 45 }], sku: 'PROD-KD-30' },
    { id: 31, name: 'Easy Shorts (Denim)', wishlists: 45, price: 14.9, status: 'active', category_name: 'Kids', sub_type: 'Bottoms', stock: 120, items_sold: 56, engagement: 340, images: ['https://images.unsplash.com/photo-1519457431-75514e715d91?w=400'], variants: [{ size: '120', color: 'Blue', stock: 60 }, { size: '140', color: 'Blue', stock: 60 }], sku: 'PROD-KD-31' },
    { id: 32, name: 'Leggings (Full Length)', wishlists: 78, price: 9.9, status: 'active', category_name: 'Kids', sub_type: 'Innerwear & Socks', stock: 180, items_sold: 890, engagement: 1500, images: ['https://images.unsplash.com/photo-1519457431-75514e715d91?w=400'], variants: [{ size: '130', color: 'Black', stock: 90 }, { size: '150', color: 'Black', stock: 90 }], sku: 'PROD-KD-32' },
    { id: 33, name: 'Girls Tulle Skirt', wishlists: 167, price: 24.9, status: 'active', category_name: 'Kids', sub_type: 'Dresses & Skirts', stock: 35, items_sold: 89, engagement: 1100, images: ['https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=400'], variants: [{ size: '120', color: 'Lavender', stock: 15 }, { size: '140', color: 'Lavender', stock: 20 }], sku: 'PROD-KD-33' },
    { id: 34, name: 'Boys Broadcloth Shirt', wishlists: 54, price: 19.9, status: 'active', category_name: 'Kids', sub_type: 'Shirts & Blouses', stock: 50, items_sold: 12, engagement: 290, images: ['https://images.unsplash.com/photo-1519235108632-401669476020?w=400'], variants: [{ size: '130', color: 'White', stock: 25 }, { size: '150', color: 'White', stock: 25 }], sku: 'PROD-KD-34' },
    { id: 35, name: 'Cotton Pajamas', wishlists: 231, price: 19.9, status: 'active', category_name: 'Kids', sub_type: 'Pajamas', stock: 45, items_sold: 134, engagement: 980, images: ['https://images.unsplash.com/photo-1519235108632-401669476020?w=400'], variants: [{ size: '120', color: 'Star Print', stock: 20 }, { size: '140', color: 'Star Print', stock: 25 }], sku: 'PROD-KD-35' },
    { id: 36, name: 'Cable Knit Sweater', wishlists: 145, price: 29.9, status: 'active', category_name: 'Kids', sub_type: 'Knitwear & Sweaters', stock: 30, items_sold: 42, engagement: 620, images: ['https://images.unsplash.com/photo-1519235108632-401669476020?w=400'], variants: [{ size: '130', color: 'Grey', stock: 15 }, { size: '150', color: 'Grey', stock: 15 }], sku: 'PROD-KD-36' },
    { id: 37, name: 'Quilted Vest', wishlists: 95, price: 34.9, status: 'active', category_name: 'Kids', sub_type: 'Outerwear', stock: 25, items_sold: 14, engagement: 420, images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400'], variants: [{ size: '130', color: 'Green', stock: 12 }, { size: '150', color: 'Green', stock: 13 }], sku: 'PROD-KD-37' },

    // BABY - 12 Products
    { id: 38, name: 'Joy of Print Bodysuit', wishlists: 212, price: 9.9, status: 'active', category_name: 'Baby', sub_type: 'Bodysuits', stock: 150, items_sold: 845, engagement: 2300, images: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'], variants: [{ size: '70', color: 'Flower', stock: 75 }, { size: '80', color: 'Flower', stock: 75 }], sku: 'PROD-BB-38' },
    { id: 39, name: 'Quilted One-Piece', wishlists: 123, price: 24.9, status: 'active', category_name: 'Baby', sub_type: 'Bodysuits', stock: 40, items_sold: 156, engagement: 980, images: ['https://images.unsplash.com/photo-1544126592-807daa2b56fd?w=400'], variants: [{ size: '80', color: 'Pink', stock: 20 }, { size: '90', color: 'Pink', stock: 20 }], sku: 'PROD-BB-39' },
    { id: 40, name: 'Cotton Mesh Inner Suit', wishlists: 89, price: 14.9, status: 'active', category_name: 'Baby', sub_type: 'Innerwear & Socks', stock: 200, items_sold: 1200, engagement: 3100, images: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'], variants: [{ size: '70', color: 'White', stock: 100 }, { size: '80', color: 'White', stock: 100 }], sku: 'PROD-BB-40' },
    { id: 41, name: 'Warm Padded Jumpsuit', wishlists: 567, price: 59.9, status: 'active', category_name: 'Baby', sub_type: 'Outerwear', stock: 20, items_sold: 45, engagement: 1200, images: ['https://images.unsplash.com/photo-1544126592-807daa2b56fd?w=400'], variants: [{ size: '80', color: 'Navy', stock: 10 }, { size: '90', color: 'Navy', stock: 10 }], sku: 'PROD-BB-41' },
    { id: 42, name: 'Gauze One-Piece', wishlists: 45, price: 19.9, status: 'active', category_name: 'Baby', sub_type: 'Bodysuits', stock: 60, items_sold: 34, engagement: 410, images: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'], variants: [{ size: '70', color: 'Yellow', stock: 30 }, { size: '80', color: 'Yellow', stock: 30 }], sku: 'PROD-BB-42' },
    { id: 43, name: 'Baby Pile Socks', wishlists: 34, price: 4.9, status: 'active', category_name: 'Baby', sub_type: 'Innerwear & Socks', stock: 150, items_sold: 2100, engagement: 1800, images: ['https://images.unsplash.com/photo-1544126592-807daa2b56fd?w=400'], variants: [{ size: '9-12cm', color: 'Multi', stock: 75 }, { size: '12-15cm', color: 'Multi', stock: 75 }], sku: 'PROD-BB-43' },
    { id: 44, name: 'Cotton Bib Set', wishlists: 78, price: 12.9, status: 'active', category_name: 'Baby', sub_type: 'Accessories', stock: 100, items_sold: 456, engagement: 890, images: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'], variants: [{ size: 'One Size', color: 'Bear', stock: 50 }, { size: 'One Size', color: 'Rabbit', stock: 50 }], sku: 'PROD-BB-44' },
    { id: 45, name: 'Reversible Fleece Jacket', wishlists: 231, price: 29.9, status: 'active', category_name: 'Baby', sub_type: 'Outerwear', stock: 35, items_sold: 67, engagement: 1100, images: ['https://images.unsplash.com/photo-1544126592-807daa2b56fd?w=400'], variants: [{ size: '80', color: 'Grey', stock: 15 }, { size: '90', color: 'Grey', stock: 20 }], sku: 'PROD-BB-45' },
    { id: 46, name: 'Full Length Leggings', wishlists: 56, price: 7.9, status: 'active', category_name: 'Baby', sub_type: 'Bottoms', stock: 200, items_sold: 912, engagement: 1600, images: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'], variants: [{ size: '80', color: 'Black', stock: 100 }, { size: '90', color: 'Black', stock: 100 }], sku: 'PROD-BB-46' },
    { id: 47, name: 'Knitted Ear Cap', wishlists: 142, price: 9.9, status: 'active', category_name: 'Baby', sub_type: 'Accessories', stock: 45, items_sold: 123, engagement: 670, images: ['https://images.unsplash.com/photo-1544126592-807daa2b56fd?w=400'], variants: [{ size: 'One Size', color: 'White', stock: 20 }, { size: 'One Size', color: 'Beige', stock: 25 }], sku: 'PROD-BB-47' },
    { id: 48, name: 'Cotton Crew Neck T-Shirt', wishlists: 67, price: 7.9, status: 'active', category_name: 'Baby', sub_type: 'T-Shirts', stock: 120, items_sold: 215, engagement: 820, images: ['https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'], variants: [{ size: '80', color: 'Blue', stock: 60 }, { size: '90', color: 'Blue', stock: 60 }], sku: 'PROD-BB-48' },
    { id: 49, name: 'Padding Sleep Bag', wishlists: 345, price: 39.9, status: 'active', category_name: 'Baby', sub_type: 'Pajamas', stock: 25, items_sold: 42, engagement: 1400, images: ['https://images.unsplash.com/photo-1544126592-807daa2b56fd?w=400'], variants: [{ size: 'One Size', color: 'Star Print', stock: 12 }, { size: 'One Size', color: 'Dot Print', stock: 13 }], sku: 'PROD-BB-49' },

    // UNISEX - 12 Products
    { id: 50, name: 'UT Graphic Tee (Artists)', wishlists: 1200, price: 19.9, status: 'active', category_name: 'Unisex', sub_type: 'UT (Graphic T-Shirts)', stock: 500, items_sold: 2314, engagement: 8900, images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400'], variants: [{ size: 'M', color: 'White', stock: 250 }, { size: 'L', color: 'White', stock: 250 }], sku: 'PROD-UX-50' },
    { id: 51, name: 'Pocketable UV Parka', wishlists: 456, price: 39.9, status: 'active', category_name: 'Unisex', sub_type: 'UV Protection', stock: 120, items_sold: 678, engagement: 2100, images: ['https://images.unsplash.com/photo-1556906781-9a412961c28c?w=400'], variants: [{ size: 'M', color: 'Grey', stock: 60 }, { size: 'L', color: 'Grey', stock: 60 }], sku: 'PROD-UX-51' },
    { id: 52, name: 'Cotton Eco-Friendly Bag', wishlists: 890, price: 4.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 1000, items_sold: 5412, engagement: 4500, images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?w=400'], variants: [{ size: 'One Size', color: 'Natural', stock: 500 }, { size: 'One Size', color: 'Black', stock: 500 }], sku: 'PROD-UX-52' },
    { id: 53, name: 'UV Protection Hat', wishlists: 234, price: 24.9, status: 'active', category_name: 'Unisex', sub_type: 'UV Protection', stock: 80, items_sold: 145, engagement: 880, images: ['https://images.unsplash.com/photo-1521369909029-2afed882baee?w=400'], variants: [{ size: 'One Size', color: 'Khaki', stock: 40 }, { size: 'One Size', color: 'Navy', stock: 40 }], sku: 'PROD-UX-53' },
    { id: 54, name: 'AIRism Face Mask (3-Pack)', wishlists: 1567, price: 14.9, status: 'active', category_name: 'Unisex', sub_type: 'AIRism', stock: 2000, items_sold: 12450, engagement: 15000, images: ['https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400'], variants: [{ size: 'M', color: 'White', stock: 1000 }, { size: 'L', color: 'White', stock: 1000 }], sku: 'PROD-UX-54' },
    { id: 55, name: 'Canvas Tote Bag XL', wishlists: 341, price: 19.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 150, items_sold: 89, engagement: 1200, images: ['https://images.unsplash.com/photo-1544816155-12df9643f363?w=400'], variants: [{ size: 'One Size', color: 'Black', stock: 75 }, { size: 'One Size', color: 'Off White', stock: 75 }], sku: 'PROD-UX-55' },
    { id: 56, name: 'Ribbed Beanie', wishlists: 189, price: 12.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 250, items_sold: 412, engagement: 950, images: ['https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=400'], variants: [{ size: 'One Size', color: 'Dark Grey', stock: 125 }, { size: 'One Size', color: 'Wine', stock: 125 }], sku: 'PROD-UX-56' },
    { id: 57, name: 'Socks (3-Pack Color)', wishlists: 456, price: 12.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 500, items_sold: 1890, engagement: 2300, images: ['https://images.unsplash.com/photo-1582967788606-a171c1080cb0?w=400'], variants: [{ size: 'One Size', color: 'Multi A', stock: 250 }, { size: 'One Size', color: 'Multi B', stock: 250 }], sku: 'PROD-UX-57' },
    { id: 58, name: 'Low Cut Canvas Sneakers', wishlists: 231, price: 34.9, status: 'active', category_name: 'Unisex', sub_type: 'Special Collaborations', stock: 65, items_sold: 34, engagement: 780, images: ['https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=400'], variants: [{ size: '24cm', color: 'White', stock: 30 }, { size: '27cm', color: 'White', stock: 35 }], sku: 'PROD-UX-58' },
    { id: 59, name: 'Wellington Sunglasses', wishlists: 678, price: 19.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 100, items_sold: 234, engagement: 1600, images: ['https://images.unsplash.com/photo-1511499767350-a1590fdb2e17?w=400'], variants: [{ size: 'One Size', color: 'Black', stock: 50 }, { size: 'One Size', color: 'Brown', stock: 50 }], sku: 'PROD-UX-59' },
    { id: 60, name: 'Leather Mesh Belt', wishlists: 123, price: 29.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 45, items_sold: 12, engagement: 450, images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400'], variants: [{ size: 'M', color: 'Dark Brown', stock: 20 }, { size: 'L', color: 'Dark Brown', stock: 25 }], sku: 'PROD-UX-60' },
    { id: 61, name: 'Cashmere Blend Scarf', wishlists: 567, price: 39.9, status: 'active', category_name: 'Unisex', sub_type: 'Accessories', stock: 30, items_sold: 89, engagement: 1900, images: ['https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400'], variants: [{ size: 'One Size', color: 'Navy', stock: 15 }, { size: 'One Size', color: 'Red', stock: 15 }], sku: 'PROD-UX-61' }
];

const adminReviews = [
    {
        id: 1,
        customer_name: 'Sarah Johnson',
        product_name: 'Classic White Tee',
        rating: 5,
        comment: 'Absolutely love this tee! The fabric is so soft and the fit is perfect. I have already ordered two more in different colors. Highly recommend!',
        image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop',
        created_at: '2026-03-10 14:30',
        is_liked: true,
        admin_reply: 'Thank you so much, Sarah! We are glad you love it. Enjoy your new tees!'
    },
    {
        id: 2,
        customer_name: 'Mike Chen',
        product_name: 'Denim Jacket',
        rating: 4,
        comment: 'Great quality denim jacket. The stitching is solid and it looks amazing. Only giving 4 stars because the sizing runs a bit large.',
        image_url: null,
        created_at: '2026-03-09 09:15',
        is_liked: false,
        admin_reply: null
    },
    {
        id: 3,
        customer_name: 'Emily Davis',
        product_name: 'Linen Shirt',
        rating: 5,
        comment: 'This linen shirt is perfect for summer. Breathable, lightweight, and looks very elegant. Will definitely be a staple in my wardrobe.',
        image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&h=200&fit=crop',
        created_at: '2026-03-08 16:45',
        is_liked: true,
        admin_reply: null
    },
    {
        id: 4,
        customer_name: 'Alex Turner',
        product_name: 'Knit Sweater',
        rating: 3,
        comment: 'The sweater looks nice but the material feels a bit rough. Expected better quality for the price. Color was accurate though.',
        image_url: null,
        created_at: '2026-03-07 11:20',
        is_liked: false,
        admin_reply: 'Hi Alex, we appreciate your honest feedback. We are working on improving the fabric blend for our next batch. Please reach out to our support if you would like an exchange.'
    },
    {
        id: 5,
        customer_name: 'Jessica Park',
        product_name: 'Silk Blouse',
        rating: 5,
        comment: 'Stunning blouse! The silk feels luxurious and the drape is beautiful. Got so many compliments wearing this to dinner.',
        image_url: 'https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=300&h=200&fit=crop',
        created_at: '2026-03-06 20:00',
        is_liked: false,
        admin_reply: null
    },
    {
        id: 6,
        customer_name: 'David Wilson',
        product_name: 'Classic White Tee',
        rating: 4,
        comment: 'Solid basic tee. Good quality cotton and holds up well after washing. Nothing groundbreaking but does its job well.',
        image_url: null,
        created_at: '2026-03-05 08:30',
        is_liked: false,
        admin_reply: null
    }
];

const adminNotifications = [
    {
        id: 1,
        type: 'stock',
        title: 'Low Stock Alert',
        message: 'Stock is low for "Denim Jacket" (only 3 units remaining).',
        priority: 'high',
        is_read: false,
        created_at: '2026-03-19 14:20'
    },
    {
        id: 2,
        type: 'payment',
        title: 'Payment Failed',
        message: 'AWS Infrastructure Subscription charge of $320.00 failed.',
        priority: 'high',
        is_read: false,
        created_at: '2026-03-19 10:45'
    },
    {
        id: 3,
        type: 'stock',
        title: 'Out of Stock',
        message: 'Product "Linen Casual Shirt" (Beige, M) is completely out of stock.',
        priority: 'high',
        is_read: true,
        created_at: '2026-03-18 16:30'
    },
    {
        id: 4,
        type: 'payment',
        title: 'Invoice Overdue',
        message: 'Domain & SSL Security Renewal invoice is overdue by 3 days.',
        priority: 'medium',
        is_read: false,
        created_at: '2026-03-17 09:00'
    }
];

const adminCampaigns = [
    {
        id: 1,
        name: 'Summer Flash Sale',
        type: 'Percentage Discount',
        start_date: '2026-06-01',
        end_date: '2026-06-07',
        channels: ['Web Banner', 'Email'],
        status: 'active'
    }
];

const adminBillingData = [
    {
        id: 'REC-2026-001',
        date: 'Mar 05, 2026 - 17:00',
        description: 'Monthly Cloud Suite Subscription',
        amount: 1200.00,
        status: 'Paid'
    },
    {
        id: 'REC-2026-002',
        date: 'Mar 08, 2026 - 10:30',
        description: 'Premium Ad Placement - Summer Flash Sale',
        amount: 850.50,
        status: 'Paid'
    },
    {
        id: 'REC-2026-003',
        date: 'Mar 12, 2026 - 14:15',
        description: 'Inventory Management Tools Update',
        amount: 250.00,
        status: 'Unpaid'
    },
    {
        id: 'REC-2026-004',
        date: 'Mar 13, 2026 - 09:00',
        description: 'Logistics Partnership Fee',
        amount: 1500.00,
        status: 'Paid'
    },
    {
        id: 'REC-2026-005',
        date: 'Mar 13, 2026 - 16:45',
        description: 'Domain & SSL Security Renewal',
        amount: 45.00,
        status: 'Unpaid'
    },
    {
        id: 'REC-2026-006',
        date: 'Mar 14, 2026 - 08:30',
        description: 'AWS Infrastructure Subscription',
        amount: 320.00,
        status: 'Paid'
    }
];

const getNewArrivals = () => [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);

const notificationStates = {}; // Map of id -> { is_read: bool, is_dismissed: bool }

const renderAdmin = (res, view, locals = {}) => {
    // Requirements: Refactor Notifications to only focus on:
    // 1. New Product Added (Type 1)
    // 2. Low/Out of Stock (Type 2)
    // 3. Paid Orders (Type 3)

    const now = new Date();
    const fmt = (d) => {
        if (!d) return '';
        const date = new Date(d);
        return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    // 1. New Product Added (last 3)
    const productAddedAlerts = adminProducts.slice(-3).reverse().map((p, i) => ({
        id: 1000 + p.id,
        type: 'product',
        icon: 'bi-plus-circle',
        title: 'New Product Added',
        message: `Product "${p.name}" (ID: ${p.id}) has been added to the catalog.`,
        priority: 'neutral',
        is_read: notificationStates[1000 + p.id]?.is_read || false,
        is_dismissed: notificationStates[1000 + p.id]?.is_dismissed || false,
        created_at: fmt(new Date(now.getTime() - (i * 3600000)))
    }));

    // 2. Stock Alerts (Low < 10, Out = 0)
    const stockAlerts = adminProducts.filter(p => p.stock !== undefined && p.stock <= 10).map((p, i) => ({
        id: 2000 + p.id,
        type: 'stock',
        icon: 'bi-exclamation-triangle',
        title: p.stock === 0 ? 'Out of Stock' : 'Low Stock Alert',
        message: p.stock === 0
            ? `Product "${p.name}" is completely out of stock.`
            : `Product "${p.name}" only has ${p.stock} units left.`,
        priority: p.stock === 0 ? 'high' : 'medium',
        is_read: notificationStates[2000 + p.id]?.is_read || false,
        is_dismissed: notificationStates[2000 + p.id]?.is_dismissed || false,
        created_at: fmt(new Date(now.getTime() - (i * 1800000)))
    }));

    // 3. Paid Orders
    const orderAlerts = adminMockData.orders.filter(o => o.status === 'PAID').slice(-5).reverse().map((o, i) => ({
        id: 3000 + o.id,
        type: 'order',
        icon: 'bi-check2-circle',
        title: 'Order Paid & Confirmed',
        message: `Customer "${o.customer_name}" placed order ${o.order_id} — payment received.`,
        priority: 'neutral',
        is_read: notificationStates[3000 + o.id]?.is_read || false,
        is_dismissed: notificationStates[3000 + o.id]?.is_dismissed || false,
        created_at: o.created_at || fmt(new Date(now.getTime() - (i * 7200000)))
    }));

    // Merge and filter dismissed
    const allNotifications = [...stockAlerts, ...productAddedAlerts, ...orderAlerts]
        .filter(n => !n.is_dismissed);

    const hasUnread = allNotifications.some(n => !n.is_read);

    // Billing Stats Calculation
    const paidOrders = adminMockData.orders.filter(o => o.status === 'PAID' || o.status === 'DELIVERED');
    const pendingOrders = adminMockData.orders.filter(o => o.status === 'PENDING' || o.status === 'SHIPPED');
    const billingStats = {
        totalPaid: paidOrders.reduce((sum, o) => sum + o.total, 0),
        outstanding: pendingOrders.reduce((sum, o) => sum + o.total, 0),
        receiptsGenerated: paidOrders.length
    };

    res.render(`pages/admin/${view}`, {
        layout: 'layouts/admin',
        notifications: allNotifications,
        hasUnread,
        billingStats,
        ...locals
    });
};

adminRouter.post('/api/notifications/read/:id', (req, res) => {
    const id = req.params.id;
    if (!notificationStates[id]) notificationStates[id] = {};
    notificationStates[id].is_read = true;
    res.json({ success: true });
});

adminRouter.post('/api/notifications/delete/:id', (req, res) => {
    const id = req.params.id;
    if (!notificationStates[id]) notificationStates[id] = {};
    notificationStates[id].is_dismissed = true;
    res.json({ success: true });
});

const renderWebstore = (res, view, locals = {}) => {
    const storefrontCategoryVisibility =
        locals.storefrontCategoryVisibility || res.locals?.storefrontCategoryVisibility || buildStorefrontCategoryVisibility(getDefaultStorefrontCategories());
    const hiddenCategories = new Set(
        STOREFRONT_CATEGORY_ORDER.filter((slug) => storefrontCategoryVisibility[slug] === false)
    );
    const hiddenSubCategories = new Set();
    adminCategories.forEach(cat => {
        (cat.sub_types || []).forEach(sub => {
            if (sub.is_hidden) {
                hiddenSubCategories.add(`${cat.name}:${sub.name}`);
            }
        });
    });
    res.render(`pages/webstore/${view}`, {
        layout: 'layouts/webstore',
        favoritesCount: locals.favoritesCount || 0,
        cartCount: locals.cartCount || 0,
        user: locals.user ?? res.locals?.user ?? null,
        storefrontCategoryVisibility,
        hiddenCategories,
        hiddenSubCategories,
        ...locals
    });
};


adminRouter.get('/login', (req, res) => {
    renderAdmin(res, 'auth/login', {
        title: 'Sign In',
        adminAuthPage: true,
        error: null
    });
});

adminRouter.get('/categories', (req, res) => {
    // Sort categories A-Z by name
    const sortedCategories = [...adminCategories].sort((a, b) => a.name.localeCompare(b.name));
    renderAdmin(res, 'categories/index', {
        title: 'Category Management',
        ...adminMockData,
        currentPath: '/admin/categories',
        categories: sortedCategories
    });
});

adminRouter.get('/dashboard', (req, res) => {
    const selectedDate = req.query.date || '';
    let filteredOrders = adminMockData.orders;

    if (selectedDate) {
        // Filter orders by YYYY-MM-DD
        filteredOrders = adminMockData.orders.filter(o => o.created_at.startsWith(selectedDate));
    }

    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
    const totalOrders = filteredOrders.length;
    const productsSold = filteredOrders.reduce((sum, o) => sum + o.items_count, 0);

    // Dynamic stats for the view
    const stats = {
        revenue: { total: totalRevenue, growth: selectedDate ? 0 : 24 },
        orders: { total: totalOrders },
        productsSold: productsSold
    };

    renderAdmin(res, 'dashboard/index', {
        title: 'Dashboard',
        ...adminMockData,
        stats,
        currentPath: '/admin/dashboard',
        selectedDate,
        today: new Date().toISOString().split('T')[0]
    });
});

adminRouter.get('/orders', (req, res) => {
    renderAdmin(res, 'orders/index', {
        title: 'Orders',
        ...adminMockData,
        currentPath: '/admin/orders'
    });
});

adminRouter.get('/orders/:id', (req, res) => {
    const orderId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
        return res.status(404).send('Order not found');
    }

    renderAdmin(res, 'orders/details', {
        title: `Order ${orderId}`,
        ...adminMockData,
        currentPath: '/admin/orders',
        orderId
    });
});

adminRouter.get('/categories', (req, res) => {
    // Requirements: Sort A-Z (Ascending)
    const sortedCategories = [...adminCategories].sort((a, b) => a.name.localeCompare(b.name));

    renderAdmin(res, 'categories/index', {
        title: 'Category Management',
        ...adminMockData,
        currentPath: '/admin/categories',
        categories: sortedCategories
    });
});

adminRouter.post('/categories/create', (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const newCat = {
        id: adminCategories.length > 0 ? Math.max(...adminCategories.map(c => c.id)) + 1 : 1,
        name,
        is_hidden: false,
        sub_types: [] // New categories start with no sub-types for now
    };
    adminCategories.push(newCat);
    res.json({ success: true, category: newCat });
});

adminRouter.post('/categories/edit/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { name } = req.body;
    const cat = adminCategories.find(c => c.id === id);
    if (!cat) return res.status(404).json({ success: false, error: 'Category not found' });

    if (name) cat.name = name;
    res.json({ success: true, category: cat });
});

adminRouter.post('/categories/toggle/:id', (req, res) => {
    const { id } = req.params;
    const cat = adminCategories.find(c => c.id == id);
    if (!cat) return res.status(404).json({ error: 'not found' });
    cat.is_hidden = !cat.is_hidden;
    res.json({ success: true, is_hidden: cat.is_hidden });
});

adminRouter.post('/categories/delete/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = adminCategories.findIndex(c => c.id === id);
    if (index === -1) return res.status(404).json({ success: false, error: 'Category not found' });

    adminCategories.splice(index, 1);
    res.json({ success: true });
});

adminRouter.get('/products', (req, res) => {
    const query = {
        search: typeof req.query.search === 'string' ? req.query.search.trim() : '',
        category: typeof req.query.category === 'string' ? req.query.category.trim() : '',
        stock_filter: typeof req.query.stock_filter === 'string' ? req.query.stock_filter.trim() : '',
        page: Number.parseInt(req.query.page, 10) || 1
    };

    let filtered = [...adminProducts];

    // Requirement: Sort Z-A (Descending) if category is selected
    if (query.category) {
        filtered.sort((a, b) => b.name.localeCompare(a.name));
    }

    if (query.search) {
        const keyword = query.search.toLowerCase();
        filtered = filtered.filter((product) => product.name.toLowerCase().includes(keyword));
    }

    if (query.category) {
        const category = adminCategories.find((entry) => String(entry.id) === query.category);
        if (category) {
            filtered = filtered.filter((product) => product.category_name === category.name);
        }
    }

    if (query.stock_filter) {
        if (query.stock_filter === 'high') {
            filtered = filtered.filter(p => p.stock > 50);
        } else if (query.stock_filter === 'low') {
            filtered = filtered.filter(p => p.stock >= 1 && p.stock <= 50);
        } else if (query.stock_filter === 'out') {
            filtered = filtered.filter(p => p.stock === 0 || p.stock === undefined);
        }
    }

    renderAdmin(res, 'products/index', {
        title: 'Products',
        ...adminMockData,
        currentPath: '/admin/products',
        categories: adminCategories,
        products: filtered,
        totalProducts: filtered.length,
        totalPages: 1,
        currentPage: 1,
        query
    });
});

adminRouter.get('/products/create', (req, res) => {
    renderAdmin(res, 'products/form', {
        title: 'Create Product',
        ...adminMockData,
        currentPath: '/admin/products',
        categories: adminCategories,
        editing: false,
        product: {}
    });
});

adminRouter.get('/products/edit/:id', (req, res) => {
    const productId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(404).send('Product not found');
    }

    renderAdmin(res, 'products/form', {
        title: 'Edit Product',
        ...adminMockData,
        currentPath: '/admin/products',
        categories: adminCategories,
        editing: true,
        product: {
            id: productId,
            status: 'active',
            images: [],
            variants: []
        }
    });
});

adminRouter.post('/products/create', upload.array('images', 5), (req, res) => {
    try {
        const { id, name, category_id, price, discount_price, stock, status, sku, description, sub_type, variants } = req.body;

        // Handle variants if sent as JSON string
        let processedVariants = [];
        if (typeof variants === 'string') {
            try { processedVariants = JSON.parse(variants); } catch (e) { }
        } else if (Array.isArray(variants)) {
            processedVariants = variants;
        }

        // Handle uploaded images
        const uploadedImages = (req.files || []).map(file => `/uploads/products/${file.filename}`);
        const defaultImage = uploadedImages.length > 0 ? uploadedImages[0] : '/images/linen_shirt.jpg';

        // Ensure uniqueness
        const requestedId = id ? parseInt(id) : null;
        if (requestedId && adminProducts.some(p => p.id === requestedId)) {
            return res.status(400).json({ success: false, error: 'Product ID already exists. Please use a unique ID.' });
        }

        const nextId = adminProducts.length > 0 ? Math.max(...adminProducts.map(p => p.id)) + 1 : 1;
        const finalId = requestedId || nextId;

        const cat = adminCategories.find(c => c.id == category_id);
        const newProduct = {
            id: finalId,
            name: name || 'New Product',
            category_id: parseInt(category_id),
            category_name: cat ? cat.name : 'All',
            price: parseFloat(price) || 0,
            discount_price: discount_price ? parseFloat(discount_price) : null,
            stock: parseInt(stock) || 0,
            status: status || 'draft',
            sku: sku || `SKU-${finalId}`,
            description: description || '',
            sub_type: sub_type || '',
            variants: processedVariants,
            images: uploadedImages.length > 0 ? uploadedImages : ['/images/linen_shirt.jpg'],
            views: 0,
            sales: 0,
            conversion: '0%',
            wishlists: 0
        };
        adminProducts.push(newProduct);
        res.json({ success: true, product: newProduct });
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({ success: false, error: 'Server error while creating product' });
    }
});

adminRouter.post('/products/edit/:id', upload.array('images', 5), (req, res) => {
    try {
        const productId = Number(req.params.id);
        const product = adminProducts.find(p => p.id === productId);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const { name, category_id, price, discount_price, stock, status, sku, description, sub_type, variants, existingImages } = req.body;
        const cat = adminCategories.find(c => c.id == category_id);

        // Handle variants
        if (variants) {
            try {
                product.variants = typeof variants === 'string' ? JSON.parse(variants) : variants;
            } catch (e) { }
        }

        // --- Image CRUD Logic ---
        let keptImages = [];
        if (existingImages) {
            try { keptImages = JSON.parse(existingImages); } catch (e) { keptImages = []; }
        } else {
            keptImages = product.images;
        }

        const newlyUploaded = (req.files || []).map(file => `/uploads/products/${file.filename}`);
        const newImagesList = [...keptImages, ...newlyUploaded];

        // Filesystem Cleanup
        const imagesToRemove = product.images.filter(img => !newImagesList.includes(img));
        imagesToRemove.forEach(img => {
            if (img.startsWith('/uploads/products/')) {
                const fullPath = path.join(__dirname, 'public', img);
                if (fs.existsSync(fullPath)) {
                    try { fs.unlinkSync(fullPath); } catch (e) { }
                }
            }
        });

        product.images = newImagesList;

        product.name = name || product.name;
        if (cat) {
            product.category_id = parseInt(category_id);
            product.category_name = cat.name;
        }
        product.price = parseFloat(price) || product.price;
        product.discount_price = discount_price ? parseFloat(discount_price) : null;
        product.stock = stock !== undefined ? parseInt(stock) : product.stock;
        product.status = status || product.status;
        product.sku = sku || product.sku;
        product.description = description || product.description;
        product.sub_type = sub_type || product.sub_type;

        res.json({ success: true, product });
    } catch (err) {
        console.error('Error editing product:', err);
        res.status(500).json({ success: false, error: 'Server error while updating product' });
    }
});

// Product images mapped per item
const productImages = {
    1: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop',
    2: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop',
    3: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop'
};

// Extended Product Performance Mock Data
const productPerformanceData = adminProducts.map(p => ({
    id: 'PRD-' + String(p.id).padStart(3, '0'),
    name: p.name,
    category: p.category_name,
    price: p.price,
    stock: p.stock !== undefined ? p.stock : 15,
    likes: Math.floor(Math.random() * 2000) + 100,
    views: Math.floor(Math.random() * 5000) + 500,
    img: productImages[p.id] || 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=400&fit=crop',
    highVelocity: Math.random() > 0.5,
    performance: {
        barLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        barData: Array.from({ length: 6 }, () => Math.floor(Math.random() * 100) + 10),
        lineLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        lineData: Array.from({ length: 7 }, () => Math.floor(Math.random() * 500) + 50),
        engagementData: [
            Math.floor(Math.random() * 80) + 20,
            Math.floor(Math.random() * 15),
            Math.floor(Math.random() * 5)
        ]
    },
    reviews: [
        { user: 'Customer ' + Math.floor(Math.random() * 100), date: 'Oct 12, 2026', comment: 'Great product overall!', rating: 5 }
    ]
}));

adminRouter.get('/analytics/product', (req, res) => {
    renderAdmin(res, 'analytics/product', {
        title: 'Product Performance',
        ...adminMockData,
        currentPath: '/admin/analytics/product',
        allProducts: productPerformanceData
    });
});

// Logout route
adminRouter.get('/logout', (req, res) => {
    // In production, destroy session here
    res.redirect('/admin/login');
});

adminRouter.get('/reviews', (req, res) => {
    const query = {
        rating: typeof req.query.rating === 'string' ? req.query.rating.trim() : '',
        media: req.query.media === '1' ? true : false
    };

    let filtered = [...adminReviews];

    if (query.rating) {
        const ratingNum = parseInt(query.rating, 10);
        if (!isNaN(ratingNum)) {
            filtered = filtered.filter((r) => r.rating === ratingNum);
        }
    }

    if (query.media) {
        filtered = filtered.filter((r) => r.image_url);
    }

    renderAdmin(res, 'reviews/index', {
        title: 'Reviews',
        ...adminMockData,
        currentPath: '/admin/reviews',
        reviews: filtered,
        query
    });
});

adminRouter.get('/notifications', (req, res) => {
    renderAdmin(res, 'notifications/index', {
        title: 'Notifications',
        currentPath: '/admin/notifications'
    });
});

adminRouter.get('/campaigns/builder', (req, res) => {
    res.locals.categories = adminCategories;
    res.locals.products = adminProducts;
    renderAdmin(res, 'campaigns/builder', {
        title: 'Campaign Builder',
        ...adminMockData,
        currentPath: '/admin/campaigns',
        categories: adminCategories,
        products: adminProducts,
        campaigns: adminCampaigns
    });
});

// Campaign POST API - creates campaigns
const adminCampaignsStore = [];

/**
 * Requirement: The Real-Time File Patcher (CRITICAL)
 * Handles Multipart Campaign Launch and EJS Patching
 */
const bannerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Explicitly overwrite the current banner
        cb(null, 'current_banner.jpg');
    }
});
const bannerUpload = multer({ storage: bannerStorage });

adminRouter.post('/api/launch-campaign', bannerUpload.single('mediaFile'), (req, res) => {
    try {
        const campaignData = JSON.parse(req.body.campaignData);
        const { name, type, discountValue, startDate, endDate } = campaignData;
        
        // --- Part 3: Dynamically Patch banner.ejs ---
        const bannerPath = path.join(__dirname, 'views/partials/webstore/banner.ejs');
        
        // Define the formatted discount for display
        let displayDiscount = '';
        if (type === 'PERCENTAGE_DISCOUNT') displayDiscount = `${discountValue}% OFF`;
        else if (type === 'FIXED_AMOUNT_DISCOUNT') displayDiscount = `$${discountValue} OFF`;
        else displayDiscount = 'Special Offer';

        const newBannerEJS = `<!-- DYNAMICALLY PATCHED BY CAMPAIGN BUILDER -->
<section class="hero-section" id="hero-section">
  <div class="hero-bg" id="hero-bg" style="background-image: url('/images/current_banner.jpg'); background-size: cover; background-position: center;">
    <!-- Overlay filter baked into CSS or via inline below -->
    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); z-index: 1;"></div>
  </div>
  <div class="hero-content" style="position: relative; z-index: 2; color: white;">
    <h1 id="hero-title">${name.toUpperCase()}</h1>
    <p id="hero-subtitle">${displayDiscount} | Valid ${startDate} to ${endDate}</p>
    <a href="/search?campaign=active" class="btn btn-primary hero-btn" id="hero-cta">Explore Collection</a>
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
    transition: opacity 1.5s ease-in-out;
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

        // Execute the Patch
        fs.writeFileSync(bannerPath, newBannerEJS, 'utf8');

        // Store internally for reference
        adminCampaignsStore.push({
            ...campaignData,
            id: 'CMP-' + Date.now(),
            status: 'active',
            patchedAt: new Date()
        });

        res.status(201).json({
            status: 'success',
            message: 'Campaign launched and Banner partial patched successfully.',
            campaign: campaignData
        });

    } catch (error) {
        console.error('Launch API Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error during file patching', details: error.message });
    }
});

adminRouter.post('/api/campaigns', (req, res) => {
    const { name, type, startDate, endDate } = req.body;
    const campaign = {
        id: 'CMP-' + String(adminCampaignsStore.length + 1).padStart(3, '0'),
        name: name || 'Untitled Campaign',
        type: type || 'percentage',
        startDate, endDate,
        status: 'active',
        createdAt: new Date().toISOString()
    };
    adminCampaignsStore.push(campaign);
    console.log('Campaign created:', campaign);
    res.json({ success: true, ...campaign });
});

// Product DELETE route
adminRouter.post('/products/delete/:id', (req, res) => {
    const productId = Number(req.params.id);
    const idx = adminProducts.findIndex(p => p.id === productId);
    if (idx === -1) return res.status(404).json({ error: 'Product not found' });
    adminProducts.splice(idx, 1);
    res.json({ success: true, message: 'Product deleted' });
});

adminRouter.get('/billing', (req, res) => {
    console.log('--- ADMIN BILLING ROUTE HIT ---');
    renderAdmin(res, 'billing/index', {
        title: 'Billing & Receipts',
        ...adminMockData,
        currentPath: '/admin/billing',
        billingData: adminBillingData,
        orders: adminMockData.orders
    });
});

webstoreRouter.use(async (req, res, next) => {
    res.locals.user = await resolveStorefrontSessionUser(req, res);

    try {
        const storefrontCategories = await fetchVisibleStorefrontCategories();
        res.locals.storefrontCategories = storefrontCategories;
        res.locals.storefrontCategoryVisibility = buildStorefrontCategoryVisibility(storefrontCategories);
    } catch (error) {
        console.error('Failed to fetch visible storefront categories:', error.message);
        const fallbackCategories = getDefaultStorefrontCategories();
        res.locals.storefrontCategories = fallbackCategories;
        res.locals.storefrontCategoryVisibility = buildStorefrontCategoryVisibility(fallbackCategories);
    }

    next();
});
webstoreRouter.get('/', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}/api/client/products/new-arrivals?lang=EN`);
        const json = await response.json();

        if (!response.ok) {
            const code = json.error || json.code || response.status;
            const message = json.message || 'Failed to load new arrivals';
            console.error(`API Error [${code}]:`, message);
            return renderWebstore(res, 'home/index', {
                pageTitle: 'Core & Co',
                newProducts: [],
                alertError: `[${code}] ${message}`
            });
        }

        const newProducts = (json.data || []).map(p => ({
            id: p.productId,
            name: p.name,
            image: p.imageUrl,
            imageStyle: null,
            price: p.price,
            originalPrice: p.compareAtPrice,
            discount: p.discountPercent,
            inStock: p.inStock,
            colors: [],
        }));
        renderWebstore(res, 'home/index', {
            pageTitle: 'Core & Co',
            newProducts,
            exploreUrl: '/products', 
            alertError: null
        });
    } catch (err) {
        console.error('Failed to fetch new arrivals:', err.message);
        renderWebstore(res, 'home/index', {
            pageTitle: 'Core & Co',
            newProducts: [],
            alertError: 'Could not connect to server'
        });
    }
});

function mapNewArrival(p) {
    return {
        id:            p.productId,
        name:          p.name,
        image:         p.imageUrl || p.image,
        price:         p.price,
        originalPrice: p.compareAtPrice  || p.originalPrice  || null,
        discount:      p.discountPercent || p.discount?.value || null,
        inStock:       p.inStock,
        colors:        p.color           || [],
    };
}

function mapRecommended(p) {
    return {
        id:            p.productId,
        name:          p.name,
        image:         p.image,  
        price:         p.price,
        originalPrice: p.compareAtPrice  || p.originalPrice  || null,
        discount:      p.discountPercent || p.discount?.value || null,
        inStock:       p.inStock,
        colors:        p.color           || [],
    };
}

async function fetchCategoryPage(slug) {
    // fetch new arrivals ก่อน
    const newArrivalsRes = await fetch(
        `${API_BASE}/api/client/products/category/${slug}?sort=newest&limit=8&lang=EN`
    );

    let newArrivals = [];
    if (newArrivalsRes.ok) {
        const json = await newArrivalsRes.json();
        newArrivals = (json.data?.products || []).map(mapNewArrival);
    }

    const excludeIds = newArrivals.map(p => p.id).join(',');
    const recommendedRes = await fetch(
        `${API_BASE}/api/client/products/recommendations?category=${slug}&limit=8&context=category&lang=EN${excludeIds ? `&excludeProductIds=${excludeIds}` : ''}`
    );

    let recommendedProducts = [];
    if (recommendedRes.ok) {
        const json = await recommendedRes.json();
        recommendedProducts = (json.data?.products || []).map(mapRecommended);
    }

    return { newArrivals, recommendedProducts };
}

function isStorefrontCategoryVisible(res, slug) {
    const visibility = res.locals.storefrontCategoryVisibility || buildStorefrontCategoryVisibility(getDefaultStorefrontCategories());
    return visibility[slug] === true;
}

webstoreRouter.get('/men', async (req, res) => {
    const SLUG = 'men';
    if (!isStorefrontCategoryVisible(res, SLUG)) {
        return res.redirect('/products');
    }
    try {
        const { newArrivals, recommendedProducts } = await fetchCategoryPage(SLUG);
        renderWebstore(res, 'men/index', {
            title:              'Men - Core & Co',
            activeNav:          'men',
            exploreUrl:         '/search?q=men', 
            newArrivals,
            bestSellers:        recommendedProducts,
            recommendedProducts: [],
        });
    } catch (err) {
        console.error('Men page error:', err.message);
        renderWebstore(res, 'men/index', {
            title:              'Men - Core & Co',
            activeNav:          'men',
            exploreUrl:         '/search?q=men', 
            newArrivals:        [],
            bestSellers:        [],
            recommendedProducts: [],
        });
    }
});

webstoreRouter.get('/women', async (req, res) => {
    const SLUG = 'women';
    if (!isStorefrontCategoryVisible(res, SLUG)) {
        return res.redirect('/products');
    }
    try {
        const { newArrivals, recommendedProducts } = await fetchCategoryPage(SLUG);
        renderWebstore(res, 'women/women', {
            title:              'Women - Core & Co',
            activeNav:          'women',
            exploreUrl:         '/search?q=women',
            newArrivals,
            bestSellers:        recommendedProducts,
            recommendedProducts: [],
        });
    } catch (err) {
        console.error('Women page error:', err.message);
        renderWebstore(res, 'women/women', {
            title:              'Women - Core & Co',
            activeNav:          'women',
            exploreUrl:         '/search?q=women',
            newArrivals:        [],
            bestSellers:        [],
            recommendedProducts: [],
        });
    }
});

webstoreRouter.get('/kids', async (req, res) => {
    const SLUG = 'kids';
    if (!isStorefrontCategoryVisible(res, SLUG)) {
        return res.redirect('/products');
    }
    try {
        const { newArrivals, recommendedProducts } = await fetchCategoryPage(SLUG);
        renderWebstore(res, 'kids/index', {
            title:              'Kids - Core & Co',
            activeNav:          'kids',
            exploreUrl:         '/search?q=kids',
            newArrivals,
            bestSellers:        recommendedProducts,
            recommendedProducts: [],
        });
    } catch (err) {
        console.error('Kids page error:', err.message);
        renderWebstore(res, 'kids/index', {
            title:              'Kids - Core & Co',
            activeNav:          'kids',
            exploreUrl:         '/search?q=kids',
            newArrivals:        [],
            bestSellers:        [],
            recommendedProducts: [],
        });
    }
});

webstoreRouter.get('/baby', async (req, res) => {
    const SLUG = 'baby';
    if (!isStorefrontCategoryVisible(res, SLUG)) {
        return res.redirect('/products');
    }
    try {
        const { newArrivals, recommendedProducts } = await fetchCategoryPage(SLUG);
        renderWebstore(res, 'baby/index', {
            title:              'Baby - Core & Co',
            activeNav:          'baby',
            exploreUrl:         '/search?q=baby',
            newArrivals,
            bestSellers:        recommendedProducts,
            recommendedProducts: [],
        });
    } catch (err) {
        console.error('Baby page error:', err.message);
        renderWebstore(res, 'baby/index', {
            title:              'Baby - Core & Co',
            activeNav:          'baby',
            exploreUrl:         '/search?q=baby',
            newArrivals:        [],
            bestSellers:        [],
            recommendedProducts: [],
        });
    }
});

webstoreRouter.get('/unisex', async (req, res) => {
    const SLUG = 'unisex';
    if (!isStorefrontCategoryVisible(res, SLUG)) {
        return res.redirect('/products');
    }
    try {
        const { newArrivals, recommendedProducts } = await fetchCategoryPage(SLUG);
        renderWebstore(res, 'unisex/index', {
            title:              'Unisex - Core & Co',
            activeNav:          'unisex',
            exploreUrl:         '/search?q=unisex', 
            newArrivals,
            bestSellers:        recommendedProducts,
            recommendedProducts: [],
        });
    } catch (err) {
        console.error('Unisex page error:', err.message);
        renderWebstore(res, 'unisex/index', {
            title:              'Unisex - Core & Co',
            activeNav:          'unisex',
            exploreUrl:         '/search?q=unisex',
            newArrivals:        [],
            bestSellers:        [],
            recommendedProducts: [],
        });
    }
});

webstoreRouter.get('/login', (req, res) => {
    renderWebstore(res, 'auth/login', {
        title: 'Sign In - Core & Co',
        bodyClass: 'login-page',
        showFooter: false,
        error: null,
        formData: null,
    });
});

webstoreRouter.post('/auth/user/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const response = await fetch(`${API_BASE}/api/auth/user/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const json = await response.json();

        console.log('SIGNIN STATUS:', response.status);
        

        if (!response.ok) {
            let errorMessage = 'Sign in failed. Please try again.';
            if (json.code === 'INVALID_CREDENTIALS') errorMessage = 'Invalid email or password.';
            else if (json.code === 'MISSING_REQUIRED_FIELDS') errorMessage = 'Please fill in all required fields.';
            else if (json.code === 'INVALID_EMAIL_FORMAT') errorMessage = 'Please enter a valid email address.';
            
            return renderWebstore(res, 'auth/login', {
                title: 'Sign In - Core & Co',
                bodyClass: 'login-page',
                showFooter: false,
                error: errorMessage,
                formData: { email },
            });
        }

req.session.user = {
    name:  json.data?.name  || '',
    email: json.data?.email || '',
    phone: json.data?.phone_number || '',
};
        
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            const cookieWithoutSecure = setCookie.replace(/;\s*Secure/gi, '');
            res.setHeader('Set-Cookie', cookieWithoutSecure);
        }
        
        return res.redirect('/');

        // Set session cookie from API response
        const token = json.data?.token || json.token;
        if (token) {
            res.cookie('session', token, {
                httpOnly: true,
                secure: false,
                maxAge: 30 * 24 * 60 * 60 * 1000
            });
        }
        return res.redirect('/');
    } catch (err) {
        console.error('Signin error:', err.message);
        renderWebstore(res, 'auth/login', {
            title: 'Sign In - Core & Co',
            bodyClass: 'login-page',
            showFooter: false,
            error: 'Could not connect to server',
            formData: { email: req.body?.email || '' },
        });
    }
});

webstoreRouter.get('/logout', (req, res) => {
    res.clearCookie('session');
    res.redirect('/');
});

webstoreRouter.get('/auth/signup', (req, res) => {
    renderWebstore(res, 'auth/signup', {
        title: 'Sign Up - Core & Co',
        bodyClass: 'signup-page',
        showFooter: false
    });
});

webstoreRouter.post('/auth/signup', async (req, res) => {
    try {
        const { email, name, surname, password, dob, mobile } = req.body;
        const [day, month, year] = (dob || '').split('/');
        const formattedDob = year && month && day ? `${year}-${month}-${day}` : dob;

        const response = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                first_name: name,
                last_name: surname,
                DOB: formattedDob,
                phone_number: mobile,
            }),
        });

        const json = await response.json();

        if (!response.ok) {
            return renderWebstore(res, 'auth/signup-info', {
                title: 'Sign Up - Core & Co',
                bodyClass: 'signup-page',
                showFooter: false,
                error: json.message || 'Signup failed',
                formData: req.body,
            });
        }

        res.redirect('/auth/signup-confirm');

    } catch (err) {
        console.error('Signup error:', err.message);
        renderWebstore(res, 'auth/signup-info', {
            title: 'Sign Up - Core & Co',
            bodyClass: 'signup-page',
            showFooter: false,
            error: 'Could not connect to server',
            formData: req.body,
        });
    }
});

webstoreRouter.get('/auth/signup-info', (req, res) => {
    renderWebstore(res, 'auth/signup-info', {
        title: 'Sign Up - Core & Co',
        bodyClass: 'signup-page',
        showFooter: false,
        query: req.query,
        error: null,
        formData: null,
    });
});

webstoreRouter.get('/auth/signup-confirm', (req, res) => {
    renderWebstore(res, 'auth/signup-confirm', {
        title: 'Sign Up Confirmation - Core & Co',
        bodyClass: 'signup-page',
        showFooter: false
    });
});

webstoreRouter.get('/forgot-password', (req, res) => {
    renderWebstore(res, 'auth/forgot-password', {
        title: 'Forgot Password - Core & Co',
        bodyClass: 'forgot-pwd-page',
        showFooter: false,
        error: null,
        email: '',
    });
});

webstoreRouter.post('/auth/forgot-password', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';

    try {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });

        const json = await response.json().catch(() => null);

        if (!response.ok) {
            return renderWebstore(res, 'auth/forgot-password', {
                title: 'Forgot Password - Core & Co',
                bodyClass: 'forgot-pwd-page',
                showFooter: false,
                error: json?.message || 'Could not process forgot password request',
                email,
            });
        }

        return res.redirect('/forgot-password-success');
    } catch (err) {
        console.error('Forgot password error:', err.message);
        return renderWebstore(res, 'auth/forgot-password', {
            title: 'Forgot Password - Core & Co',
            bodyClass: 'forgot-pwd-page',
            showFooter: false,
            error: 'Could not connect to server',
            email,
        });
    }
});

webstoreRouter.get('/forgot-password-success', (req, res) => {
    renderWebstore(res, 'auth/forgot-password-success', {
        title: 'Forgot Password Success - Core & Co',
        bodyClass: 'forgot-success-page',
        showFooter: false
    });
});

webstoreRouter.get('/auth/reset-password', (req, res) => {
    renderWebstore(res, 'auth/reset-password', {
        title: 'Reset Password - Core & Co',
        bodyClass: 'reset-pwd-page',
        showFooter: false,
        token: typeof req.query?.token === 'string' ? req.query.token.trim() : '',
        error: null,
    });
});

webstoreRouter.post('/auth/reset-password', async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = req.body?.new_password || '';
    const confirmPassword = req.body?.confirm_password || '';

    try {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                new_password: newPassword,
                confirm_password: confirmPassword,
            }),
        });

        const json = await response.json().catch(() => null);

        if (!response.ok) {
            return renderWebstore(res, 'auth/reset-password', {
                title: 'Reset Password - Core & Co',
                bodyClass: 'reset-pwd-page',
                showFooter: false,
                token,
                error: json?.message || 'Could not reset password',
            });
        }

        return res.redirect('/login');
    } catch (err) {
        console.error('Reset password error:', err.message);
        return renderWebstore(res, 'auth/reset-password', {
            title: 'Reset Password - Core & Co',
            bodyClass: 'reset-pwd-page',
            showFooter: false,
            token,
            error: 'Could not connect to server',
        });
    }
});

webstoreRouter.get('/profile', (req, res) => res.redirect('/account/profile'));

webstoreRouter.get('/account/profile', async (req, res) => {
    if (!req.session?.user) return res.redirect('/login');

    const fallbackProfile = {
        name: req.session.user.name || '',
        email: req.session.user.email || '',
        phone: req.session.user.phone || '',
        initials: (req.session.user.name || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || '')
            .join('') || 'CC',
        emailVerified: false,
        joinedAt: null,
        birthday: null,
    };

    try {
        const response = await fetch(`${API_BASE}/api/auth/user/profile`, {
            headers: {
                cookie: req.headers.cookie || ''
            }
        });
        const json = await readJsonSafely(response);

        if (response.status === 401) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }

        if (!response.ok || !json?.data) {
            return renderWebstore(res, 'account/profile', {
                title: 'My Profile - Core & Co',
                user: req.session.user,
                profile: fallbackProfile,
            });
        }

        const name = json.data.name || fallbackProfile.name;
        const profile = {
            name,
            email: json.data.email || fallbackProfile.email,
            phone: json.data.phone_number || fallbackProfile.phone,
            initials: name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase() || '')
                .join('') || fallbackProfile.initials,
            emailVerified: Boolean(json.data.email_verified),
            joinedAt: json.data.created_at || null,
            birthday: json.data.date_of_birth || null,
        };

        req.session.user = {
            ...req.session.user,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
        };

        renderWebstore(res, 'account/profile', {
            title: 'My Profile - Core & Co',
            user: req.session.user,
            profile,
        });
    } catch (error) {
        console.error('Profile page error:', error.message);
        renderWebstore(res, 'account/profile', {
            title: 'My Profile - Core & Co',
            user: req.session.user,
            profile: fallbackProfile,
        });
    }
});
const CATEGORY_SLUGS = {
    ...Object.fromEntries(STOREFRONT_CATEGORY_ORDER.map((slug) => [slug, slug])),
    ...STOREFRONT_CATEGORY_ALIAS,
};
webstoreRouter.get('/products', async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 100;
    const defaultSort = req.query.sort === 'newest' ? 'newest' : 'recommended';
    const perPage = 8;

    try {
        const response = await fetch(
            `${API_BASE}/api/client/products?page=${page}&limit=${limit}&lang=EN`
        );
        const json = await response.json();

        const products = (json.data || []).map(p => ({
    id: p.productId,
    name: p.name,
    image: p.thumbnailUrl,
    price: p.priceFrom,
    originalPrice: p.compareAtPriceFrom || null,
    discount: null,
    inStock: p.totalStock > 0,
    colors: [],
    category: p.primaryCategoryName,
    priceFormatted: '$' + Number(p.priceFrom).toLocaleString(),
    originalFormatted: p.compareAtPriceFrom ? '$' + Number(p.compareAtPriceFrom).toLocaleString() : null,
    badge: p.compareAtPriceFrom ? 'SALE' : null,
}));
const totalItems = products.length;
const totalPages = totalItems > 0 ? Math.ceil(totalItems / perPage) : 1;

        renderWebstore(res, 'home/all-products', {
            title: 'All Products | Core & Co',
            activeNav: 'products',
            products,
            currentPage: page,
            defaultSort,
            perPage,
            totalPages,
            totalItems,
        });
    } catch (err) {
        renderWebstore(res, 'home/all-products', {
            title: 'All Products | Core & Co',
            products: [],
            currentPage: 1,
            defaultSort,
            perPage,
            totalPages: 1,
            totalItems: 0,
        });
    }
});
webstoreRouter.get('/search', async (req, res) => {
    const storefrontCategories = Array.isArray(res.locals.storefrontCategories) && res.locals.storefrontCategories.length > 0
        ? res.locals.storefrontCategories
        : getDefaultStorefrontCategories();
    const visibleCategorySlugSet = new Set(storefrontCategories.map((entry) => entry.slug));
    const query = (req.query.q || '').trim();
    const requestedCategory = normalizeStorefrontCategorySlug(req.query.cat || 'all');
    const category = requestedCategory !== 'all' && !visibleCategorySlugSet.has(requestedCategory)
        ? 'all'
        : requestedCategory;
    const sort = req.query.sort || 'relevance';
    const page = Number.parseInt(req.query.page, 10) || 1;
    const categoryChips = createSearchCategoryChips(storefrontCategories);

    const sortMap = {
        featured:   'relevance',
        relevance:  'relevance',
        price_asc:  'price_asc',
        price_desc: 'price_desc',
        newest:     'newest',
    };
    const apiSort = sortMap[sort] || 'relevance';

    try {
        if (!query) {
            const sugRes  = await fetch(`${API_BASE}/api/client/products/search/suggestions?q=a&lang=EN`);
            const sugJson = await sugRes.json();
            const suggestions = (sugJson.data?.suggestions || []).slice(0, 4) .map(p => ({
                name:              p.name,
                image:             p.image,
                category:          p.category?.name || '',
                priceFormatted:    '$' + Number(p.price).toLocaleString(),
                originalFormatted: p.originalPrice ? '$' + Number(p.originalPrice).toLocaleString() : null,
            }));

            const counts = createCategoryCounts(storefrontCategories);
            return renderWebstore(res, 'home/search', {
                title: 'Search', query, category, sort, page,
                products: [], suggestions,
                categoryChips,
                counts,
                totalResults: 0, totalPages: 0,
            });
        }

        const queryLower   = query.toLowerCase();
        const categorySlug = CATEGORY_SLUGS[queryLower];

        let apiProducts   = [];
        let totalResults  = 0;
        let totalPages    = 0;
        let returnedPage  = page;

        if (categorySlug) {
            const catRes  = await fetch(
                `${API_BASE}/api/client/products/category/${categorySlug}?page=${page}&limit=12&sort=${apiSort === 'relevance' ? 'newest' : apiSort}&lang=EN`
            );
            const catJson = await catRes.json();
            const data    = catJson.data || {};

            apiProducts  = (data.products || []).map(mapSearchProduct);
            totalResults = data.pagination?.totalItems  || 0;
            totalPages   = data.pagination?.totalPages  || 0;
            returnedPage = data.pagination?.page        || page;

        } else {
            const searchRes  = await fetch(
                `${API_BASE}/api/client/products/search?q=${encodeURIComponent(query)}&page=${page}&limit=12&sort=${apiSort}&lang=EN`
            );
            const searchJson = await searchRes.json();
            const data       = searchJson.data || {};

            apiProducts  = (data.products || []).map(mapSearchProduct);
            totalResults = data.pagination?.totalItems  || 0;
            totalPages   = data.pagination?.totalPages  || 0;
            returnedPage = data.pagination?.page        || page;
        }

        const filtered = (categorySlug && category === categorySlug)
            ? apiProducts
            : category === 'all'
            ? apiProducts
            : apiProducts.filter((p) => categoryNameMatchesSlug(p.category, category));

        const counts = createCategoryCounts(storefrontCategories);
        counts.all = totalResults;
        if (categorySlug && counts[categorySlug] !== undefined) {
            counts[categorySlug] = totalResults;
        } else {
            for (const storefrontCategory of storefrontCategories) {
                counts[storefrontCategory.slug] = apiProducts.filter((p) =>
                    categoryNameMatchesSlug(p.category, storefrontCategory.slug)
                ).length;
            }
        }

        renderWebstore(res, 'home/search', {
            title:        `${query} - Search`,
            query, category, sort,
            page:         returnedPage,
            products:     filtered,
            suggestions:  [],
            categoryChips,
            counts,
            totalResults,
            totalPages,
        });

    } catch (err) {
        console.error('Search error:', err.message);
        const counts = createCategoryCounts(storefrontCategories);
        renderWebstore(res, 'home/search', {
            title: 'Search', query, category, sort, page,
            products: [], suggestions: [],
            categoryChips,
            counts,
            totalResults: 0, totalPages: 0,
        });
    }
});

function mapSearchProduct(p) {
    return {
        id:                p.productId,
        name:              p.name,
        image:             p.image || p.imageUrl,
        price:             p.price,
        originalPrice:     p.originalPrice  || null,
        discount:          p.discount?.value || null,
        inStock:           p.inStock,
        colors:            p.color          || [],
        category:          p.category?.name || '',
        priceFormatted:    '$' + Number(p.price).toLocaleString(),
        priceFormatted:    '$' + Number(p.price).toLocaleString(),
        originalFormatted: p.originalPrice ? '$' + Number(p.originalPrice).toLocaleString() : null,
        badge:             p.discount ? `-${p.discount.value}%` : null,
    };
}

webstoreRouter.get('/products/:id', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}/api/client/products/${req.params.id}?lang=EN`, {
            headers: {
                cookie: req.headers.cookie || '',
                'x-forwarded-for': req.headers['x-forwarded-for'] || req.ip || '',
                'user-agent': req.headers['user-agent'] || '',
            }
        });

        const setCookie = typeof response.headers.getSetCookie === 'function'
            ? response.headers.getSetCookie()
            : response.headers.get('set-cookie');

        if (setCookie && setCookie.length > 0) {
            const forwardedCookies = Array.isArray(setCookie)
                ? setCookie.map((cookie) => cookie.replace(/;\s*Secure/gi, ''))
                : setCookie.replace(/;\s*Secure/gi, '');

            res.setHeader('Set-Cookie', forwardedCookies);
        }

        if (!response.ok) {
            return res.status(404).send(`<script>alert('404 - Product not found'); history.back();</script>`);
        }

        const json = await response.json();
        const p = json.data;
        let variants = [];
        try {
            const varRes = await fetch(`${API_BASE}/api/client/products/${req.params.id}/variants?lang=EN`);
            if (varRes.ok) {
                const varJson = await varRes.json();
                variants = varJson.data || [];
            }
        } catch (e) {}

        if (variants.length === 0 && p.color && p.size) {
            const fallbackColors = Array.from(new Set(p.color || []));
            const fallbackSizes = Array.from(new Set(p.size || []));
            variants = fallbackColors.flatMap((color) =>
                fallbackSizes.map((size) => ({
                    color,
                    size
                }))
            );
        }

        variants = variants
            .map((variant) => ({
                ...variant,
                color: variant.color || variant.colour || ''
            }))
            .filter((variant) => variant.color && variant.size);

        const product = {
            id: p.productId,
            name: p.name,
            description: p.detail,
            category: p.category?.name || '',
            color: p.color || [],
            size: p.size || [],
            variants, 
            price: p.price,
            originalPrice: p.originalPrice,
            discount: p.discount?.value || null,
            image: p.image,
            images: [p.image, p.image, p.image],
            imageStyle: null,
            inStock: p.inStock,
            details: p.detail,
        };
        const recResponse = await fetch(
            `${API_BASE}/api/client/products/recommendations?limit=4&excludeProductIds=${req.params.id}`
        );
        const recJson = await recResponse.json();
        const recommendations = (recJson.data?.products || []).map(r => ({
            id: r.productId,
            name: r.name,
            image: r.image,
            price: r.price || 0,
        }));

        renderWebstore(res, 'home/client-productDetail', {
            title: `${product.name} | Core & Co`,
            product,
            recommendations,
            completeLook: [],
        });
    } catch (err) {
        console.error('Failed to fetch product:', err.message);
        res.status(500).send('Error loading product');
    }
});
webstoreRouter.get('/cart', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}/api/client/cart?lang=EN`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.cookie || ''
            }
        });

        const json = await response.json();

        if (response.status === 401) {
            return res.redirect('/login');
        }

        if (!response.ok) {
            return renderWebstore(res, 'home/client-cart', {
                title: 'Your Cart | Core & Co',
                recommendations: [],
                error: json.message || 'Could not load cart',
                cart: [],
                cartSummary: { totalItems: 0, subtotal: 0 },
                cartCount: 0
            });
        }

        const mappedCart = json.data?.items?.map(item => ({
            itemId: item.itemId,
            id: item.productId,
            name: item.name,
            color: item.color,
            size: item.size,
            image: item.image,
            price: item.price,
            originalPrice: item.originalPrice,
            qty: item.quantityCartItem,
            colorHex: '#ccc'
        })) || [];

        let recommendations = [];
        try {
            const recRes = await fetch(`${API_BASE}/api/client/products/recommendations?limit=4&context=cart&lang=EN`);
            if (recRes.ok) {
                const recJson = await recRes.json();
                recommendations = (recJson.data?.products || []).map(p => ({
                    id: p.productId,
                    name: p.name,
                    image: p.image,
                    price: p.price,
                    colors: []
                }));
            }
        } catch (err) {
            console.error('Failed to fetch recommendations:', err.message);
        }

        renderWebstore(res, 'home/client-cart', {
            title: 'Your Cart | Core & Co',
            recommendations,
            cart: mappedCart,
            cartSummary: json.data?.cartSummary || { totalItems: 0, subtotal: 0 },
            cartCount: Number(json.data?.cartSummary?.totalItems || 0)
        });

    } catch (err) {
        console.error('Cart error:', err.message);
        renderWebstore(res, 'home/client-cart', {
            title: 'Your Cart | Core & Co',
            recommendations: [],
            error: 'Could not connect to server',
            cart: [],
            cartSummary: { totalItems: 0, subtotal: 0 },
            cartCount: 0
        });
    }
});

// DELETE /api/cart/items/:itemId
webstoreRouter.delete('/api/cart/items/:itemId', async (req, res) => {
    try {
        const apiRes = await fetch(`${API_BASE}/api/client/cart/items/${req.params.itemId}`, {
            method: 'DELETE',
            headers: { cookie: req.headers.cookie || '' }
        });
        const json = await readJsonSafely(apiRes);
        res.status(apiRes.status).json(json || { status: 'error', message: 'Could not remove item' });
    } catch (err) {
        res.status(502).json({ status: 'error', message: 'Could not remove item' });
    }
});
webstoreRouter.post('/api/cart/items', async (req, res) => {
    try {
        const apiRes = await fetch(`${API_BASE}/api/client/cart/items?lang=EN`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.cookie || ''
            },
            body: JSON.stringify(req.body)
        });

        const json = await readJsonSafely(apiRes);
        res.status(apiRes.status).json(json || { status: 'error', message: 'Could not add item' });
    } catch (err) {
        res.status(502).json({ status: 'error', message: 'Could not add item' });
    }
});
// PUT /api/cart/items/:itemId
webstoreRouter.put('/api/cart/items/:itemId', async (req, res) => {
    try {
        const apiRes = await fetch(`${API_BASE}/api/client/cart/items/${req.params.itemId}?lang=EN`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.cookie || ''
            },
            body: JSON.stringify(req.body)
        });
        const json = await readJsonSafely(apiRes);
        res.status(apiRes.status).json(json || { status: 'error', message: 'Could not update quantity' });
    } catch (err) {
        res.status(502).json({ status: 'error', message: 'Could not update quantity' });
    }
});

webstoreRouter.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Proxy for Backend Logout
webstoreRouter.post('/api/auth/logout', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.cookie || ''
            }
        });
        
        const json = await response.json();
        
        if (response.ok) {
            // Also destroy the frontend session if it exists
            if (req.session) {
                req.session.destroy();
            }
            res.clearCookie('session');
            res.status(200).json(json);
        } else {
            res.status(response.status).json(json);
        }
    } catch (err) {
        console.error('Logout proxy error:', err.message);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

// Proxy for Backend Logout
webstoreRouter.post('/api/auth/logout', async (req, res) => {
    try {
        const response = await fetch(`${API_BASE}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                cookie: req.headers.cookie || ''
            }
        });
        
        const json = await response.json();
        
        if (response.ok) {
            // Also destroy the frontend session if it exists
            if (req.session) {
                req.session.destroy();
            }
            res.clearCookie('session');
            res.status(200).json(json);
        } else {
            res.status(response.status).json(json);
        }
    } catch (err) {
        console.error('Logout proxy error:', err.message);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});
webstoreRouter.get('/products/new-arrivals', (req, res) => {
    res.json(getNewArrivals());
});


webstoreRouter.get('/checkout', (req, res) => {
    renderWebstore(res, 'home/client-checkout', {
        title: 'Checkout | Core & Co',
    });
});
webstoreRouter.get('/checkout/success', (req, res) => {
    renderWebstore(res, 'home/client-checkout-success', {
        title: 'Order Confirmed | Core & Co',
    });
});

webstoreRouter.get('/contact', (req, res) => {
    renderWebstore(res, 'contact/index', {
        title: 'Contact Us | Core & Co',
        activeNav: 'contact'
    });
});

webstoreRouter.get('/about', (req, res) => {
    renderWebstore(res, 'about/index', {
        title: 'About Us | Core & Co',
        activeNav: 'about'
    });
});
// Favorites Routes
webstoreRouter.get('/favorites', async (req, res) => {
    try {
        const favRes = await fetch(`${API_BASE}/api/client/favorites?lang=EN`, {
            headers: { cookie: req.headers.cookie || '' }
        });

        if (favRes.status === 401) {
            return res.redirect('/login');
        }

        const favJson = await favRes.json();
        const favoriteItems = (favJson.data?.products || []).map(p => ({
            id:            p.productId,
            name:          p.name,
            image:         p.image,
            price:         p.price,
            originalPrice: p.originalPrice || null,
            discount:      p.discount?.value || null,
            inStock:       p.inStock,
            colors:        p.color || [],
            size:          p.size || [],
            priceFormatted: '$' + Number(p.price).toLocaleString(),
            originalFormatted: p.originalPrice ? '$' + Number(p.originalPrice).toLocaleString() : null,
        }));

        let recommendations = [];
        try {
            const recRes = await fetch(`${API_BASE}/api/client/products/recommendations?limit=4&context=favorites&lang=EN`);
            if (recRes.ok) {
                const recJson = await recRes.json();
                recommendations = (recJson.data?.products || []).map(p => ({
                    id:    p.productId,
                    name:  p.name,
                    image: p.image,
                    price: p.price,
                    colors: p.color || [],
                }));
            }
        } catch (e) { }

        renderWebstore(res, 'auth/favorites', {
            title:        'Your Favorites - Core & Co',
            bodyClass:    'favorites-page',
            favoriteItems,
            recommendations,
            favoritesCount: favJson.data?.favoritesCount || 0,
        });

    } catch (err) {
        console.error('Favorites error:', err.message);
        renderWebstore(res, 'auth/favorites', {
            title:         'Your Favorites - Core & Co',
            bodyClass:     'favorites-page',
            favoriteItems: [],
            recommendations: [],
            favoritesCount: 0,
        });
    }
});

webstoreRouter.get('/favorites/ids', async (req, res) => {
    try {
        const favRes = await fetch(`${API_BASE}/api/client/favorites?lang=EN`, {
            headers: { cookie: req.headers.cookie || '' }
        });
        if (!favRes.ok) return res.json({ ids: [], favoritesCount: 0 });
        const favJson = await favRes.json();
        const ids = (favJson.data?.products || []).map(p => p.productId);
        res.json({
            ids,
            favoritesCount: Number(favJson.data?.favoritesCount || 0)
        });
    } catch (err) {
        res.json({ ids: [], favoritesCount: 0 });
    }
});

webstoreRouter.post('/favorites/:productId', async (req, res) => {
    const { productId } = req.params;
    const apiRes = await fetch(`${API_BASE}/api/client/favorites/${productId}`, {
        method:  'POST',
        headers: { cookie: req.headers.cookie || '' }
    });
    const json = await apiRes.json();
    res.status(apiRes.status).json(json);
});

webstoreRouter.delete('/favorites/:productId', async (req, res) => {
    const { productId } = req.params;
    const apiRes = await fetch(`${API_BASE}/api/client/favorites/${productId}`, {
        method:  'DELETE',
        headers: { cookie: req.headers.cookie || '' }
    });
    const json = await apiRes.json();
    res.status(apiRes.status).json(json);
});

app.get('/dashboard', (req, res) => {
    res.redirect('/admin/dashboard');
});

app.get('/orders', (req, res) => {
    res.redirect('/admin/orders');
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/dashboard');
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server);

// Mock Chat Data
const chatConversations = [
    {
        id: 'user-001',
        name: 'Sarah Jenkins',
        avatar: 'SJ',
        img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        status: 'online',
        lastMessage: 'I haven\'t received my tracking number yet.',
        timestamp: '10:45 AM',
        unread: 0,
        history: [
            { sender: 'customer', text: 'Hi! I placed an order three days ago (Order #8291) but I still haven\'t received a tracking number in my email. Could you check the status for me?', time: '10:45 AM' },
            { sender: 'admin', text: 'Hello Sarah! I\'d be happy to help you with that. Let me look into your order details right away.', time: '10:46 AM' },
            { sender: 'admin', text: 'I see your order. It\'s actually currently being processed at our warehouse and is scheduled to be picked up by the courier this afternoon. You should receive the tracking link via email by 5:00 PM today.', time: '10:47 AM' },
            { sender: 'customer', text: 'Oh, that\'s great! I was worried it might have been delayed. Thank you so much for the quick response!', time: '10:48 AM' }
        ]
    },
    {
        id: 'user-002',
        name: 'Michael Chen',
        avatar: 'MC',
        img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        status: 'online',
        lastMessage: 'Do you have this in size Large?',
        timestamp: '09:30 AM',
        unread: 1,
        history: [
            { sender: 'customer', text: 'Hi, I saw the Linen Shirt.', time: '09:28 AM' },
            { sender: 'customer', text: 'Do you have this in size Large?', time: '09:30 AM' }
        ]
    },
    {
        id: 'user-003',
        name: 'Emma Watson',
        avatar: 'EW',
        img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
        status: 'offline',
        lastMessage: 'Thank you for the quick refund!',
        timestamp: 'YESTERDAY',
        unread: 0,
        history: [
            { sender: 'admin', text: 'Your refund for order #1011 has been processed.', time: 'Yesterday' },
            { sender: 'customer', text: 'Thank you for the quick refund!', time: 'Yesterday' }
        ]
    },
    {
        id: 'user-004',
        name: 'David Miller',
        avatar: 'DM',
        img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
        status: 'offline',
        lastMessage: 'The blue jacket is out of stock.',
        timestamp: 'OCT 12',
        unread: 0,
        history: [
            { sender: 'customer', text: 'The blue jacket is out of stock.', time: 'Oct 12' }
        ]
    }
];

// Socket Logic
io.on('connection', (socket) => {
    console.log('A user connected to the admin chat');

    socket.on('admin_send_message', (data) => {
        // In a real app, save to DB
        // Broadcast to customer (if they were connected)
        console.log('Admin sent message:', data);

        // Echo back for demo if it's the right conversation
        // (Just a placeholder for real-time logic)
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

adminRouter.get('/chats', (req, res) => {
    renderAdmin(res, 'chats/index', {
        title: 'Customer Chats',
        ...adminMockData,
        currentPath: '/admin/chats',
        conversations: chatConversations
    });
});

adminRouter.get('/logout', (req, res) => {
    res.redirect('/admin/login');
});

adminRouter.post('/api/campaigns', (req, res) => {
    // Mock save to DB
    const newCampaign = req.body;
    console.log('New Campaign Launched:', newCampaign);
    res.status(201).json({ success: true, ...newCampaign });
});

app.use('/admin', adminRouter);
app.use('/', webstoreRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <script>
            alert('404 - Page not found');
            history.back();
        </script>
    `);
});

// 500 handler - server error
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send(`Server Error: ${err.message}\n${err.stack}`);
});

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
