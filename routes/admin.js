const express = require('express');
const router = express.Router();
const Applicant = require('../models/Applicant');
const Admin = require('../models/Admin');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Position = require('../models/Position');
const { Op } = require('sequelize');

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    console.log(`[Auth] Checking auth for ${req.method} ${req.originalUrl}. Session ID: ${req.sessionID}, Admin ID: ${req.session.adminId}`);
    // For API, we might want to check session or token. 
    // Since we're using session based auth for now, this works if cookies are passed.
    if (req.session.adminId) {
        return next();
    }
    console.warn(`[Auth] Unauthorized access attempt to ${req.originalUrl}`);
    res.status(401).json({ error: 'Unauthorized' });
};

// Superadmin Middleware
const isSuperAdmin = async (req, res, next) => {
    if (!req.session.adminId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const admin = await Admin.findByPk(req.session.adminId);
        if (admin && admin.role === 'superadmin') {
            return next();
        }
        res.status(403).json({ error: 'Forbidden: Superadmin access required' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Check Auth Status
router.get('/check-auth', async (req, res) => {
    if (req.session.adminId) {
        try {
            const admin = await Admin.findByPk(req.session.adminId);
            res.json({ 
                authenticated: true, 
                role: admin ? admin.role : null, 
                username: admin ? admin.username : null,
                // Add DB Info for debugging (only visible to authenticated admins)
                dbType: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite (Ephemeral)'
            });
        } catch (error) {
            res.json({ authenticated: false });
        }
    } else {
        res.json({ authenticated: false });
    }
});

// Login Page - NOT NEEDED for API, handled by frontend

// Handle Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ where: { username } });
        if (!admin) {
            return res.status(401).json({ error: 'Username atau Password salah' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (isMatch) { 
            req.session.adminId = admin.id;
            res.json({ success: true, message: 'Login successful', role: admin.role });
        } else {
            res.status(401).json({ error: 'Username atau Password salah' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Logged out' });
    });
});

// Admin Dashboard - List Applicants (Protected)
router.get('/', isAuthenticated, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; // Default 20 per page
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        const where = {};
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { position: { [Op.like]: `%${search}%` } },
                { nik: { [Op.like]: `%${search}%` } }
            ];
        }

        if (req.query.status) {
            where.status = req.query.status;
        }

        if (req.query.attendanceStatus) {
            where.attendanceStatus = req.query.attendanceStatus;
        }

        // Fetch paginated data
        const { count, rows } = await Applicant.findAndCountAll({
            where,
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });

        // Fetch global stats (efficient counts with parallel execution)
        const [total, pending, verified, rejected, present, absent] = await Promise.all([
            Applicant.count(),
            Applicant.count({ where: { status: 'pending' } }),
            Applicant.count({ where: { status: 'verified' } }),
            Applicant.count({ where: { status: 'rejected' } }),
            Applicant.count({ where: { attendanceStatus: 'present' } }),
            Applicant.count({ where: { status: 'verified', attendanceStatus: { [Op.ne]: 'present' } } })
        ]);

        const stats = { total, pending, verified, rejected, present, absent };

        res.json({ 
            applicants: rows,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / limit),
                currentPage: page,
                limit
            },
            stats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Mark Attendance
router.post('/attendance', isAuthenticated, async (req, res) => {
    const { applicantId } = req.body;
    try {
        const applicant = await Applicant.findByPk(applicantId);
        if (!applicant) {
            return res.status(404).json({ error: 'Peserta tidak ditemukan' });
        }
        
        if (applicant.status !== 'verified') {
            return res.status(400).json({ error: 'Peserta belum lolos verifikasi berkas' });
        }

        if (applicant.attendanceStatus === 'present') {
             return res.json({ 
                success: true, 
                message: 'Peserta sudah melakukan absensi sebelumnya', 
                applicant,
                alreadyPresent: true 
            });
        }

        applicant.attendanceStatus = 'present';
        applicant.attendanceTime = new Date();
        await applicant.save();

        res.json({ success: true, message: 'Absensi berhasil dicatat', applicant });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Verification Status Per File
router.post('/verify-file/:id', isAuthenticated, async (req, res) => {
    console.log(`[Verify] Request received for ID: ${req.params.id}, Body:`, req.body);
    try {
        const { fileType, status, rejectReason } = req.body; // fileType: 'ktp', status: 'valid' | 'invalid'
        const applicant = await Applicant.findByPk(req.params.id);
        
        if (!applicant) {
            console.error(`[Verify] Applicant not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Applicant not found' });
        }

        // Update specific file status
        if (['ktp', 'ijazah', 'str', 'sertifikat', 'suratPernyataan'].includes(fileType)) {
            applicant[`${fileType}Status`] = status;
            
            // Handle Reject Reason
            if (status === 'invalid') {
                applicant[`${fileType}RejectReason`] = rejectReason || 'Dokumen tidak sesuai';
            } else {
                applicant[`${fileType}RejectReason`] = null;
            }
            
            // Log verification details
            const admin = await Admin.findByPk(req.session.adminId);
            if (!admin) console.warn(`[Verify] Admin not found for session ID: ${req.session.adminId}`);
            
            applicant[`${fileType}VerifiedAt`] = new Date();
            applicant[`${fileType}VerifiedBy`] = admin ? admin.username : 'Unknown';
            
            console.log(`[Verify] Updating ${fileType} for applicant ${applicant.id} by ${applicant[`${fileType}VerifiedBy`]}`);
            await applicant.save();
        }

        // Logic:
        // 1. If ANY file is 'invalid' (Tidak Sesuai) -> Global status = 'rejected'
        // 2. If ALL files are 'valid' (Sesuai) -> Global status = 'verified'
        // 3. Otherwise -> Global status = 'pending'

        const statuses = [
            applicant.ktpStatus, 
            applicant.ijazahStatus, 
            applicant.strStatus, 
            applicant.sertifikatStatus,
            applicant.suratPernyataanStatus
        ];

        console.log(`[Verify] Statuses for applicant ${applicant.id}:`, statuses);

        if (statuses.includes('invalid')) {
            // Auto Reject
            applicant.status = 'rejected';
            applicant.examCardPath = null;
        } else if (statuses.every(s => s === 'valid')) {
            // Auto Verify & Generate PDF
            if (applicant.status !== 'verified') {
                console.log(`[Verify] All files valid. Generating exam card...`);
                applicant.status = 'verified';
                
                // Switch to On-the-fly Generation (Stateless)
                // We no longer generate file on disk. 
                // Instead, we point examCardPath to the dynamic endpoint.
                applicant.examCardPath = `/api/applicant/${applicant.id}/exam-card?nik=${applicant.nik}`;
                console.log(`[Verify] Exam card path set to dynamic URL: ${applicant.examCardPath}`);

                /* Deprecated: File-based generation
                // Generate PDF
                try {
                    const doc = new PDFDocument();
                    const filename = `exam_card_${applicant.id}_${Date.now()}.pdf`;
                    const uploadDir = path.join(__dirname, '../public/uploads');
                    
                    // Ensure directory exists
                    if (!fs.existsSync(uploadDir)){
                        fs.mkdirSync(uploadDir, { recursive: true });
                    }

                    const filePath = path.join(uploadDir, filename);
                    const writeStream = fs.createWriteStream(filePath);

                    doc.pipe(writeStream);
                    doc.fontSize(25).text('KARTU UJIAN', { align: 'center' });
                    doc.moveDown();
                    doc.fontSize(14).text(`Nama: ${applicant.name}`);
                    doc.text(`Email: ${applicant.email}`);
                    doc.text(`Posisi: ${applicant.position}`);
                    doc.text(`ID Peserta: ${applicant.id}`);
                    doc.text(`Tanggal Ujian: ${new Date().toLocaleDateString()}`); 
                    doc.moveDown();
                    
                    // Generate QR Code
                    try {
                        const qrBuffer = await bwipjs.toBuffer({
                            bcid:        'qrcode',       // QR Code type
                            text:        applicant.id.toString(),    // Text to encode
                            scale:       3,               // 3x scaling factor
                            padding:     1,               // Padding around QR Code
                            includetext: false,            // QR Code doesn't usually show text
                        });
                        
                        doc.moveDown();
                        doc.image(qrBuffer, {
                            fit: [100, 100], // QR Code is square
                            align: 'center'
                        });
                    } catch (e) {
                        console.error("QR Code generation error:", e);
                    }

                    doc.moveDown();
                    doc.text('Harap bawa kartu ini saat ujian.', { align: 'center' });
                    doc.end();

                    await new Promise((resolve, reject) => {
                        writeStream.on('finish', resolve);
                        writeStream.on('error', reject);
                    });
                    
                    applicant.examCardPath = '/uploads/' + filename;
                    console.log(`[Verify] Exam card generated at: ${applicant.examCardPath}`);
                } catch (pdfError) {
                    console.error('[Verify] PDF Generation Error:', pdfError);
                    // Don't fail the whole request, just log it? Or maybe fail?
                    // For now, let's just log and continue, maybe user can retry
                }
                */
            }
        } else {
            // Still pending
            applicant.status = 'pending';
            applicant.examCardPath = null;
        }
        
        await applicant.save();
        console.log(`[Verify] Applicant ${applicant.id} updated successfully. Global status: ${applicant.status}`);

        res.json({ success: true, applicant });
    } catch (error) {
        console.error('[Verify] Critical Error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Reject Applicant (Protected)
router.post('/reject/:id', isAuthenticated, async (req, res) => {
    try {
        const applicant = await Applicant.findByPk(req.params.id);
        if (!applicant) return res.status(404).json({ error: 'Applicant not found' });
        
        applicant.status = 'rejected';
        applicant.examCardPath = null;
        await applicant.save();
        
        res.json({ success: true, message: 'Applicant rejected', applicant });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Applicant (Protected)
router.delete('/applicant/:id', isAuthenticated, async (req, res) => {
    try {
        const applicant = await Applicant.findByPk(req.params.id);
        if (!applicant) return res.status(404).json({ error: 'Pelamar tidak ditemukan' });
        
        // Optional: Delete associated files if needed, but for now just delete the record
        await applicant.destroy();
        
        res.json({ success: true, message: 'Data pelamar berhasil dihapus' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Gagal menghapus data pelamar' });
    }
});

// Master Positions (Superadmin Only)
router.get('/positions', isAuthenticated, async (req, res) => {
    try {
        const positions = await Position.findAll({ order: [['createdAt', 'DESC']] });
        res.json({ positions });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/positions', isSuperAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nama posisi wajib diisi' });
        }
        const pos = await Position.create({ name: name.trim() });
        res.status(201).json({ success: true, position: pos });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Posisi sudah ada' });
        }
        res.status(500).json({ error: 'Server Error' });
    }
});

router.delete('/positions/:id', isSuperAdmin, async (req, res) => {
    try {
        const pos = await Position.findByPk(req.params.id);
        if (!pos) return res.status(404).json({ error: 'Posisi tidak ditemukan' });
        await pos.destroy();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// User Management Routes (Superadmin Only)
router.get('/users', isSuperAdmin, async (req, res) => {
    try {
        const admins = await Admin.findAll({ 
            attributes: ['id', 'username', 'role', 'createdAt'] 
        });
        res.json({ admins });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/users', isSuperAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    try {
        // Simple validation
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Check existing
        const existing = await Admin.findOne({ where: { username } });
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = await Admin.create({ username, password: hashedPassword, role });
        res.json({ success: true, admin: { id: newAdmin.id, username: newAdmin.username, role: newAdmin.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});

router.delete('/users/:id', isSuperAdmin, async (req, res) => {
    try {
        // Prevent deleting self
        if (parseInt(req.params.id) === req.session.adminId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const admin = await Admin.findByPk(req.params.id);
        if (!admin) {
            return res.status(404).json({ error: 'User not found' });
        }

        await admin.destroy();
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Update User Role (Superadmin Only)
router.put('/users/:id/role', isSuperAdmin, async (req, res) => {
    const { role } = req.body;
    try {
        if (!['superadmin', 'verificator'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Prevent updating self role to avoid locking yourself out (optional but good practice)
        if (parseInt(req.params.id) === req.session.adminId) {
             return res.status(400).json({ error: 'Cannot change your own role' });
        }

        const admin = await Admin.findByPk(req.params.id);
        if (!admin) {
            return res.status(404).json({ error: 'User not found' });
        }

        admin.role = role;
        await admin.save();

        res.json({ success: true, message: 'Role updated', admin: { id: admin.id, username: admin.username, role: admin.role } });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
