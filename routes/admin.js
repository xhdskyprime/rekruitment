const express = require('express');
const router = express.Router();
const Applicant = require('../models/Applicant');
const Admin = require('../models/Admin');
const SystemSetting = require('../models/SystemSetting');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Position = require('../models/Position');
const Session = require('../models/Session');
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
    console.log(`[Login] Attempt for username: ${username}`);
    try {
        const admin = await Admin.findOne({ where: { username } });
        if (!admin) {
            console.warn(`[Login] User not found: ${username}`);
            return res.status(401).json({ error: 'Username atau Password salah' });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (isMatch) { 
            req.session.adminId = admin.id;
            console.log(`[Login] Success for user: ${username}, Session ID: ${req.sessionID}`);
            res.json({ success: true, message: 'Login successful', role: admin.role });
        } else {
            console.warn(`[Login] Password mismatch for user: ${username}`);
            res.status(401).json({ error: 'Username atau Password salah' });
        }
    } catch (error) {
        console.error('[Login] Server error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan server' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true, message: 'Logged out' });
    });
});

// Update System Settings
router.put('/settings', isAuthenticated, async (req, res) => {
    console.log('[API] PUT /settings called with:', req.body);
    try {
        const { recruitmentPhase } = req.body;
        if (!['registration', 'verification', 'announcement'].includes(recruitmentPhase)) {
            console.warn('[API] Invalid phase:', recruitmentPhase);
            return res.status(400).json({ error: 'Invalid phase' });
        }

        console.log('[API] Finding/Creating SystemSetting...');
        // Use upsert for atomic update/insert to avoid race conditions/locks
        await SystemSetting.upsert({
            key: 'recruitmentPhase',
            value: recruitmentPhase
        });
        
        console.log('[API] Settings updated successfully');

        res.json({ success: true, recruitmentPhase });
    } catch (error) {
        console.error('[API] Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
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
            order: [['createdAt', 'DESC']],
            include: [{ model: Session, attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'location'] }]
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
        let applicant = await Applicant.findOne({ where: { participantNumber: applicantId } });
        if (!applicant) {
            applicant = await Applicant.findByPk(applicantId);
        }
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

// Reset Attendance Data
router.post('/reset-attendance', isAuthenticated, async (req, res) => {
    try {
        await Applicant.update(
            { 
                attendanceStatus: 'absent',
                attendanceTime: null
            },
            { 
                where: { 
                    attendanceStatus: 'present' 
                } 
            }
        );

        res.json({ success: true, message: 'Data absensi berhasil direset' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Verification Status Per File
router.post('/verify-file/:id', isAuthenticated, async (req, res) => {
    console.log(`[Verify] Request received for ID: ${req.params.id}, Body:`, req.body);
    try {
        const { fileType, status, rejectReason, sessionId } = req.body; // fileType: 'ktp', status: 'valid' | 'invalid'
        const applicant = await Applicant.findByPk(req.params.id);
        
        if (!applicant) {
            console.error(`[Verify] Applicant not found: ${req.params.id}`);
            return res.status(404).json({ error: 'Applicant not found' });
        }

        // If sessionId is provided, update it
        if (sessionId !== undefined) {
            applicant.sessionId = sessionId || null;
        }

        // Update specific file status
        if (['ktp', 'ijazah', 'str', 'sertifikat', 'suratPernyataan', 'suratLamaran'].includes(fileType)) {
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
            
            console.log(`[Verify] Updating ${fileType} for applicant ${applicant.id} by ${applicant[`${fileType}VerifiedBy`]} to ${status}`);
            // DO NOT SAVE HERE, wait until global status is calculated
        }

        // Logic:
        // 1. If ANY mandatory file is 'invalid' (Tidak Sesuai) -> Global status = 'rejected'
        // 2. If ALL mandatory files are 'valid' (Sesuai) -> Global status = 'verified'
        // 3. Sertifikat is OPTIONAL: 
        //    - If 'invalid', it doesn't cause auto-reject (unless other mandatory files are invalid).
        //    - If 'pending' or 'invalid', it doesn't block 'verified' status.
        // 4. Otherwise -> Global status = 'pending'

        const mandatoryStatuses = [
            applicant.suratLamaranStatus,
            applicant.ktpStatus,
            applicant.ijazahStatus, 
            applicant.strStatus, 
            applicant.suratPernyataanStatus
        ];

        console.log(`[Verify] Mandatory statuses for applicant ${applicant.id}:`, mandatoryStatuses);
        console.log(`[Verify] Optional status (sertifikat) for applicant ${applicant.id}:`, applicant.sertifikatStatus);

        if (mandatoryStatuses.includes('invalid')) {
            // Auto Reject if any mandatory file is invalid
            applicant.status = 'rejected';
            applicant.examCardPath = null;
        } else if (mandatoryStatuses.every(s => s === 'valid')) {
            // Auto Verify if all mandatory files are valid (Sertifikat is ignored for 'verified' status)
            if (applicant.status !== 'verified') {
                console.log(`[Verify] All mandatory files valid. Current global status: ${applicant.status}. Upgrading to verified...`);
                applicant.status = 'verified';
                
                // Switch to On-the-fly Generation (Stateless)
                // We no longer generate file on disk. 
                // Instead, we point examCardPath to the dynamic endpoint.
                applicant.examCardPath = `/api/applicant/${applicant.id}/exam-card?nik=${applicant.nik}`;
                console.log(`[Verify] Exam card path set to dynamic URL: ${applicant.examCardPath}`);
            }
        } else {
            // Still pending
            console.log(`[Verify] Not all mandatory files are valid yet. Status remains pending.`);
            applicant.status = 'pending';
            applicant.examCardPath = null;
        }
        
        console.log(`[Verify] Final state before save - ID: ${applicant.id}, Status: ${applicant.status}, Files:`, {
            lamaran: applicant.suratLamaranStatus,
            ktp: applicant.ktpStatus,
            ijazah: applicant.ijazahStatus,
            str: applicant.strStatus,
            pernyataan: applicant.suratPernyataanStatus,
            sertifikat: applicant.sertifikatStatus
        });

        await applicant.save();
        console.log(`[Verify] Applicant ${applicant.id} saved successfully. New global status: ${applicant.status}`);

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

// Delete Applicant (Protected - Superadmin Only)
router.delete('/applicant/:id', isSuperAdmin, async (req, res) => {
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
        const { name, code } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Nama posisi wajib diisi' });
        }
        const normalizedCode = String(code || '').trim();
        if (!/^\d{2}$/.test(normalizedCode)) {
            return res.status(400).json({ error: 'Kode posisi harus 2 digit angka (01-99)' });
        }
        const pos = await Position.create({ name: name.trim(), code: normalizedCode });
        res.status(201).json({ success: true, position: pos });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Nama atau Kode posisi sudah ada' });
        }
        res.status(500).json({ error: 'Server Error' });
    }
});

router.put('/positions/:id', isSuperAdmin, async (req, res) => {
    try {
        const { name, code } = req.body;
        const pos = await Position.findByPk(req.params.id);
        if (!pos) return res.status(404).json({ error: 'Posisi tidak ditemukan' });
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nama posisi wajib diisi' });
        const normalizedCode = String(code || '').trim();
        if (!/^\d{2}$/.test(normalizedCode)) {
            return res.status(400).json({ error: 'Kode posisi harus 2 digit angka (01-99)' });
        }
        pos.name = name.trim();
        pos.code = normalizedCode;
        await pos.save();
        res.json({ success: true, position: pos });
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Nama atau Kode posisi sudah ada' });
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

// Master Sessions (Superadmin Only)
router.get('/sessions', isAuthenticated, async (req, res) => {
    try {
        const sessions = await Session.findAll({ order: [['date', 'ASC'], ['startTime', 'ASC']] });
        res.json({ sessions });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

router.post('/sessions', isSuperAdmin, async (req, res) => {
    try {
        const { name, date, startTime, endTime, location, capacity } = req.body;
        if (!name || !date || !startTime || !endTime || !location) {
            return res.status(400).json({ error: 'Semua field wajib diisi' });
        }

        let normalizedDate = date;
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) {
            normalizedDate = parsed.toISOString().slice(0, 10);
        }

        const session = await Session.create({ 
            name: name.trim(), 
            date: normalizedDate, 
            startTime, 
            endTime, 
            location: location.trim(), 
            capacity: parseInt(capacity) || 0 
        });
        res.status(201).json({ success: true, session });
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({ error: error.message || 'Server Error' });
    }
});

router.put('/sessions/:id', isSuperAdmin, async (req, res) => {
    try {
        const { name, date, startTime, endTime, location, capacity } = req.body;
        const session = await Session.findByPk(req.params.id);
        if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });

        await session.update({
            name: name?.trim() || session.name,
            date: date || session.date,
            startTime: startTime || session.startTime,
            endTime: endTime || session.endTime,
            location: location?.trim() || session.location,
            capacity: capacity !== undefined ? parseInt(capacity) : session.capacity
        });

        res.json({ success: true, session });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

router.delete('/sessions/:id', isSuperAdmin, async (req, res) => {
    try {
        const session = await Session.findByPk(req.params.id);
        if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
        await session.destroy();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Assign Session to Applicant
router.post('/applicants/:id/session', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const applicant = await Applicant.findByPk(req.params.id);
        if (!applicant) return res.status(404).json({ error: 'Applicant tidak ditemukan' });
        
        applicant.sessionId = sessionId || null;
        await applicant.save();
        
        const updated = await Applicant.findByPk(applicant.id, {
            include: [{ model: Session, attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'location'] }]
        });
        
        res.json({ success: true, applicant: updated });
    } catch (error) {
        console.error('Assign session error:', error);
        res.status(500).json({ error: error.message || 'Server Error' });
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

// Update User (username and role) - Superadmin Only
router.put('/users/:id', isSuperAdmin, async (req, res) => {
    const { username, role, password } = req.body;
    try {
        const admin = await Admin.findByPk(req.params.id);
        if (!admin) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (username && username.trim() !== admin.username) {
            const existing = await Admin.findOne({ where: { username: username.trim() } });
            if (existing) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            admin.username = username.trim();
        }
        if (role) {
            if (!['superadmin', 'verificator'].includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            if (parseInt(req.params.id) === req.session.adminId && role !== admin.role) {
                return res.status(400).json({ error: 'Cannot change your own role' });
            }
            admin.role = role;
        }
        if (typeof password === 'string' && password.trim().length > 0) {
            const hashedPassword = await bcrypt.hash(password.trim(), 10);
            admin.password = hashedPassword;
        }
        await admin.save();
        res.json({ success: true, admin: { id: admin.id, username: admin.username, role: admin.role } });
    } catch (error) {
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
