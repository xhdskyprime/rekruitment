require('dotenv').config();
const express = require('express');
const path = require('path');
const sequelize = require('./models/database');
const { DataTypes } = require('sequelize');
const Applicant = require('./models/Applicant');
const Admin = require('./models/Admin');
const Position = require('./models/Position');
const SystemSetting = require('./models/SystemSetting');
const Session = require('./models/Session');

// Define Associations
Session.hasMany(Applicant, { foreignKey: 'sessionId' });
Applicant.belongsTo(Session, { foreignKey: 'sessionId' });

const methodOverride = require('method-override');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const driveService = require('./services/driveService');

const app = express();
const PORT = process.env.PORT || 3000;

// Health Check Endpoint (Critical for Railway/Deployment)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Trust Proxy (Required for Cloudflare/Railway)
// This ensures we get the real client IP instead of Cloudflare's IP
app.set('trust proxy', 1);

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
    origin: ['http://localhost:5174', 'http://localhost:5173', process.env.CLIENT_URL || '*'],
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
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, 'data/uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}
app.use('/uploads', express.static(uploadsDir));

app.use(methodOverride('_method'));

// Session Store
const sessionStore = new SequelizeStore({
    db: sequelize,
    tableName: 'SessionStore',
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 24 * 60 * 60 * 1000
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

// Proxy route for Google Drive files - Protected (Admin only)
app.get('/file/proxy/:id', async (req, res) => {
    if (!req.session || !req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = req.params.id;
    await driveService.getFileStream(fileId, res);
});
app.get('/file/meta/:id', async (req, res) => {
    if (!req.session || !req.session.adminId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const meta = await driveService.getFileMeta(req.params.id);
        res.json({ 
            id: meta.id, 
            name: meta.name, 
            mimeType: meta.mimeType, 
            webViewLink: meta.webViewLink, 
            webContentLink: meta.webContentLink 
        });
    } catch (e) {
        res.status(404).json({ error: 'File not found' });
    }
});

// Routes
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

app.use('/', indexRoutes);
app.use('/api', indexRoutes); // Enable /api prefix for all index routes
app.use('/admin', adminRoutes);

// Catch-all handler for React
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Sync Database and Start Server (ordered to avoid FK issues on Railway)
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
 
    // Ensure Sessions table exists with primary key 'id' BEFORE altering Applicants (FK)
    const qi = sequelize.getQueryInterface();
    let desc = {};
    try {
      desc = await qi.describeTable('Sessions');
    } catch {
      desc = {};
    }
    if (!desc.id) {
      console.warn('Sessions table missing primary key "id" — recreating...');
      await qi.dropTable('Sessions').catch(() => {});
      await Session.sync({ force: true });
      console.log('Sessions table recreated with primary key id');
    } else {
      await Session.sync({ alter: true });
    }
 
    // Sync other tables (safe alter)
    await Admin.sync({ alter: true });
    try {
      const positionsDesc = await qi.describeTable('Positions').catch(() => ({}));
      if (!positionsDesc.code) {
        await qi.dropTable('Positions').catch(() => {});
        await Position.sync({ force: true });
      } else {
        await Position.sync({ alter: true });
      }
    } catch (e) {
      await Position.sync();
    }
    await SystemSetting.sync({ alter: true });
    await Applicant.sync({ alter: true }); // Now FK to Sessions(id) can be created safely
 
    // Ensure session store table exists
    if (sessionStore.sync) {
      await sessionStore.sync();
      console.log('Session store table synced');
    }
 
    // Seed default admin
    console.log('Checking Admin count...');
    const adminCount = await Admin.count();
    console.log('Admin count:', adminCount);
    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword,
        role: 'superadmin'
      });
      console.log('Default admin created: admin / password123 (superadmin)');
    }
 
    // Seed default settings
    console.log('Seeding default settings...');
    try {
      console.log('Finding existing settings...');
      const existing = await SystemSetting.findOne({ where: { key: 'recruitmentPhase' } });
      if (!existing) {
        console.log('Creating default setting...');
        await SystemSetting.create({
          key: 'recruitmentPhase',
          value: 'registration',
          description: 'Current phase of recruitment: registration, verification, announcement'
        });
        console.log('System settings created');
      } else {
        console.log('System settings loaded:', existing.value);
      }
    } catch (error) {
      console.error('Error seeding SystemSetting:', error);
    }
 
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Database sync error:', err);
  }
})();
