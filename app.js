require('dotenv').config();
const express = require('express');
const path = require('path');
const sequelize = require('./models/database');
const Applicant = require('./models/Applicant');
const Admin = require('./models/Admin');
const Position = require('./models/Position');
const methodOverride = require('method-override');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const driveService = require('./services/driveService');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Proxy (Required for Cloudflare/Railway)
// This ensures we get the real client IP instead of Cloudflare's IP
app.set('trust proxy', 1);

// Proxy route for Google Drive files
app.get('/file/proxy/:id', async (req, res) => {
    const fileId = req.params.id;
    await driveService.getFileStream(fileId, res);
});

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for simple dev setup, enable in prod
    crossOriginResourcePolicy: false,
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Increased limit for launch (was 100)
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', process.env.CLIENT_URL || '*'], // Allow production domain
    credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static Files Optimization (Basic CDN-like behavior)
// 1. Serve assets (hashed files) with long cache
app.use('/assets', express.static(path.join(__dirname, 'client/dist/assets'), {
    maxAge: '1y', // Cache for 1 year
    immutable: true // Content never changes
}));

// 2. Serve other static files with normal cache
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'client/dist'), {
    maxAge: '1h', // Cache index.html etc for 1 hour
}));
// app.use('/uploads', express.static(process.env.UPLOAD_DIR || path.join(__dirname, 'data/uploads')));

app.use(methodOverride('_method'));

// Session Store
const sessionStore = new SequelizeStore({
    db: sequelize,
    checkExpirationInterval: 15 * 60 * 1000, // The interval at which to cleanup expired sessions in milliseconds.
    expiration: 24 * 60 * 60 * 1000  // The maximum age (in milliseconds) of a valid session.
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'rahasia_default_dev',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for Railway (behind load balancer)
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// View Engine
app.set('view engine', 'ejs');

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

app.use('/', indexRoutes);
app.use('/admin', adminRoutes);

// Catch-all handler for React
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Sync Database and Start Server
sequelize.sync({ alter: true }).then(async () => {
    console.log('Database synced');
    
    // Ensure session table is created
    if (sessionStore.sync) {
        await sessionStore.sync();
        console.log('Session table synced');
    }
    
    // Seed default admin
    const adminCount = await Admin.count();
    if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await Admin.create({
            username: 'admin',
            password: hashedPassword,
            role: 'superadmin'
        });
        console.log('Default admin created: admin / password123 (superadmin)');
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Database sync error:', err);
});
