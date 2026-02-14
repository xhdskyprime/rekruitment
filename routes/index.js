const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const { Op } = require('sequelize');
const Applicant = require('../models/Applicant');
const Position = require('../models/Position');
const SystemSetting = require('../models/SystemSetting');

const driveService = require('../services/driveService');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

const fs = require('fs');

// Configure Multer for disk storage (Local Storage)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads');
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp-fieldname-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Limit 2MB
    fileFilter: (req, file, cb) => {
        const filetypes = /pdf|doc|docx|jpg|jpeg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb('Error: File upload only supports the following filetypes - ' + filetypes);
        }
    }
});

// Home Page - Registration Form
// Removed to allow React frontend to handle root route
// router.get('/', (req, res) => {
//     res.json({ message: 'Welcome to Recruitment API' });
// });

// Get Public System Settings
router.get('/settings', async (req, res) => {
    try {
        const setting = await SystemSetting.findByPk('recruitmentPhase');
        res.json({ 
            recruitmentPhase: setting ? setting.value : 'registration' 
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Handle Registration
const uploadFields = upload.fields([
    { name: 'suratLamaran', maxCount: 1 },
    { name: 'ktp', maxCount: 1 },
    { name: 'ijazah', maxCount: 1 },
    { name: 'str', maxCount: 1 },
    { name: 'sertifikat', maxCount: 1 },
    { name: 'suratPernyataan', maxCount: 1 },
    { name: 'pasFoto', maxCount: 1 }
]);

const APPLICANTS_UPLOAD_DIR = path.join(__dirname, '../public/uploads/applicants');

router.post('/register', (req, res, next) => {
    console.log('Request received at /register');
    uploadFields(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            // Handle Multer string errors or Error objects
            const errorMessage = typeof err === 'string' ? err : err.message;
            if (errorMessage === 'File too large') {
                return res.status(400).json({ error: 'Ukuran file maksimal 2MB.' });
            }
            return res.status(400).json({ error: errorMessage });
        }
        console.log('Multer processing done');
        console.log('req.body:', req.body);
        console.log('req.files keys:', req.files ? Object.keys(req.files) : 'No files');

        // --- Backend Validation ---
        const errors = [];
        const { name, nik, gender, birthPlace, birthDate, education, institution, major, gpa, email, phoneNumber, position, 'cf-turnstile-response': turnstileToken } = req.body;
        
        // --- Turnstile Verification (WAF) ---
        if (!turnstileToken) {
            console.error('Turnstile token missing');
            return res.status(400).json({ error: 'Harap selesaikan verifikasi keamanan (Turnstile).' });
        }

        try {
            const params = new URLSearchParams();
            params.append('secret', process.env.TURNSTILE_SECRET_KEY);
            params.append('response', turnstileToken);
            params.append('remoteip', req.ip);

            const turnstileResponse = await axios.post(
                'https://challenges.cloudflare.com/turnstile/v0/siteverify',
                params.toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (!turnstileResponse.data.success) {
                console.error('Turnstile verification failed. Error codes:', turnstileResponse.data['error-codes']);
                return res.status(400).json({ error: 'Verifikasi keamanan gagal. Silakan coba lagi.' });
            }
        } catch (error) {
            console.error('Turnstile error:', error);
            // Don't block registration if Turnstile service is down (optional strategy)
            // For now, we block it as it's a security requirement
            return res.status(500).json({ error: 'Gagal memverifikasi keamanan. Silakan coba lagi nanti.' });
        }

        console.log('Validating NIK:', nik, 'Length:', nik ? nik.length : 'null');

        if (!name) errors.push('Nama wajib diisi');
        if (!nik || nik.length !== 16 || !/^\d+$/.test(nik)) {
            console.log('NIK validation failed for:', nik);
            errors.push('NIK harus 16 digit angka');
        }
        if (!gender) errors.push('Jenis kelamin wajib diisi');
        if (!birthPlace) errors.push('Tempat lahir wajib diisi');
        if (!birthDate) errors.push('Tanggal lahir wajib diisi');
        if (!education) errors.push('Pendidikan wajib diisi');
        if (!institution) errors.push('Institusi pendidikan wajib diisi');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Format email tidak valid');
        if (!phoneNumber || phoneNumber.length < 10) errors.push('Nomor HP minimal 10 digit');
        if (!position) errors.push('Posisi wajib dipilih');

        // Age Validation (18-35 years)
        if (birthDate) {
            const bDate = new Date(birthDate);
            bDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const minAgeDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
            const maxAgeDate = new Date(today.getFullYear() - 35, today.getMonth(), today.getDate());

            if (bDate > minAgeDate) errors.push('Usia minimal adalah 18 tahun');
            if (bDate < maxAgeDate) errors.push('Usia maksimal adalah 35 tahun');
        }

        if (education !== 'SMA/SMK') {
            if (!major) errors.push('Jurusan wajib diisi');
            if (!gpa) errors.push('IPK wajib diisi');
        }

        if (errors.length > 0) {
            console.log('Validation errors:', errors);
            // Cleanup temp files on validation error
            if (req.files) {
                Object.values(req.files).forEach(fileArray => {
                    fileArray.forEach(file => {
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    });
                });
            }
            return res.status(400).json({ error: errors.join(', ') });
        }

        // --- Early Duplicate Check ---
        try {
            const existing = await Applicant.findOne({
                where: {
                    [Op.or]: [{ nik }, { email }]
                }
            });
            if (existing) {
                if (req.files) {
                    Object.values(req.files).forEach(fileArray => {
                        fileArray.forEach(file => {
                            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                        });
                    });
                }
                const field = existing.nik === nik ? 'NIK' : 'Email';
                return res.status(400).json({ error: `${field} sudah terdaftar.` });
            }
        } catch (dbErr) {
            console.error('Duplicate check error:', dbErr);
        }
        // --------------------------

        next();
    });
}, async (req, res) => {
    let applicantFolderPath = null;
    try {
        const files = req.files || {};
        if (!files.suratLamaran || !files.ktp || !files.ijazah || !files.str || !files.suratPernyataan || !files.pasFoto) {
            if (req.files) {
                Object.values(req.files).forEach(fileArray => {
                    fileArray.forEach(file => {
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    });
                });
            }
            return res.status(400).json({ error: 'Harap upload semua dokumen wajib (Surat Lamaran & CV, KTP, Ijazah, STR, Surat Pernyataan, Pas Foto).' });
        }

        const { name, nik, gender, birthPlace, birthDate, education, institution, major, gpa, email, phoneNumber, position } = req.body;
        
        // Create applicant folder
        const initFolderName = `${nik}-${name.replace(/\s+/g, '_')}`;
        applicantFolderPath = path.join(APPLICANTS_UPLOAD_DIR, initFolderName);
        
        if (!fs.existsSync(applicantFolderPath)) {
            fs.mkdirSync(applicantFolderPath, { recursive: true });
        }

        // Helper to move file locally and return path
        const processFileLocally = async (fileArray, label) => {
             if (fileArray && fileArray.length > 0) {
                 const file = fileArray[0];
                 const ext = path.extname(file.originalname);
                 const customName = `${label}_${nik}${ext}`;
                 const destPath = path.join(applicantFolderPath, customName);
                 
                 try {
                     console.log(`Moving ${label} to local storage as ${customName}...`);
                     fs.renameSync(file.path, destPath);
                     
                     // Return relative path for database storage
                     const relativePath = path.posix.join('/uploads/applicants', initFolderName, customName);
                     return relativePath;
                 } catch (err) {
                     console.error(`Failed to move ${label} to local storage:`, err);
                     throw new Error(`Gagal menyimpan berkas ${label} secara lokal: ${err.message || 'Unknown error'}`);
                 }
             }
             return null;
        };

        const ktpPath = await processFileLocally(files.ktp, 'KTP');
        const ijazahPath = await processFileLocally(files.ijazah, 'Ijazah & Nilai Terakhir');
        const strPath = await processFileLocally(files.str, 'STR');
        const sertifikatPath = await processFileLocally(files.sertifikat, 'Sertifikat');
        const suratPernyataanPath = await processFileLocally(files.suratPernyataan, 'Surat Pernyataan');
        const pasFotoPath = await processFileLocally(files.pasFoto, 'Pas Foto');
        const suratLamaranPath = await processFileLocally(files.suratLamaran, 'Surat Lamaran & CV');

        const applicant = await Applicant.create({
            name,
            nik,
            gender,
            birthPlace,
            birthDate,
            education,
            institution,
            major,
            gpa: gpa ? parseFloat(gpa) : null,
            email,
            phoneNumber,
            position,
            ktpPath,
            ijazahPath,
            strPath,
            sertifikatPath,
            suratPernyataanPath,
            pasFotoPath,
            suratLamaranPath
        });

        try {
            const createdAt = applicant.createdAt ? new Date(applicant.createdAt) : new Date();
            const yy = String(createdAt.getFullYear()).slice(-2);
            const mm = String(createdAt.getMonth() + 1).padStart(2, '0');
            const dd = String(createdAt.getDate()).padStart(2, '0');
            const pos = await Position.findOne({ where: { name: position } });
            const posCode = (pos?.code || '00').padStart(2, '0').slice(-2);
            const seq = String(applicant.id % 1000).padStart(3, '0');
            applicant.participantNumber = `${yy}${mm}${dd}${posCode}${seq}`;
            await applicant.save();
            
            // Rename folder to include participantNumber (format: nomorpeserta_namapeserta)
            const finalFolderName = `${applicant.participantNumber}_${name.replace(/\s+/g, '_')}`;
            const finalFolderPath = path.join(APPLICANTS_UPLOAD_DIR, finalFolderName);
            
            if (fs.existsSync(applicantFolderPath)) {
                fs.renameSync(applicantFolderPath, finalFolderPath);
                
                // Update paths in database to the new folder name
                const updatePath = (p) => p ? p.replace(initFolderName, finalFolderName) : p;
                applicant.ktpPath = updatePath(applicant.ktpPath);
                applicant.ijazahPath = updatePath(applicant.ijazahPath);
                applicant.strPath = updatePath(applicant.strPath);
                applicant.sertifikatPath = updatePath(applicant.sertifikatPath);
                applicant.suratPernyataanPath = updatePath(applicant.suratPernyataanPath);
                applicant.pasFotoPath = updatePath(applicant.pasFotoPath);
                applicant.suratLamaranPath = updatePath(applicant.suratLamaranPath);
                await applicant.save();
            }
        } catch (genErr) {
            console.error('Generate participantNumber or folder rename error:', genErr);
        }

        res.status(201).json({ success: true, applicant });
    } catch (error) {
        console.error('Registration Error:', error);
        
        // Cleanup applicant folder if anything fails
        if (applicantFolderPath && fs.existsSync(applicantFolderPath)) {
            try {
                fs.rmSync(applicantFolderPath, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.error(`Failed to cleanup folder ${applicantFolderPath}:`, cleanupErr);
            }
        }

        // Cleanup any remaining temp files
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            });
        }
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'NIK atau Email sudah terdaftar.' });
        }
        
        res.status(400).json({ error: error.message });
    }
});

// Public: List Positions (for registration form)
router.get('/positions', async (req, res) => {
    try {
        const positions = await Position.findAll({ order: [['name', 'ASC']] });
        res.json({ positions });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Download Exam Card (On-the-fly generation)
router.get('/api/applicant/:id/exam-card', async (req, res) => {
    try {
        const { id } = req.params;
        const { nik } = req.query;

        if (!nik) {
            return res.status(400).json({ error: 'NIK is required for verification' });
        }

        const applicant = await Applicant.findOne({ 
            where: { id, nik },
            include: [{ model: require('../models/Session'), attributes: ['id', 'name', 'date', 'startTime', 'endTime', 'location'] }]
        });

        if (!applicant) {
            return res.status(404).json({ error: 'Applicant not found or NIK mismatch' });
        }

        if (applicant.status !== 'verified') {
            return res.status(403).json({ error: 'Applicant is not verified yet' });
        }

        // Generate PDF
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filename = `Kartu_Ujian_${applicant.name.replace(/\s+/g, '_')}.pdf`;

        res.setHeader('Content-disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // Card Layout Constants
        const cardX = 50;
        const cardY = 50;
        const cardWidth = 500;
        const cardHeight = 650;

        // Draw Card Border
        doc.rect(cardX, cardY, cardWidth, cardHeight).lineWidth(1).strokeColor('#dddddd').stroke();

        // Watermark (Background)
        doc.save();
        // Center on A4 Page (A4 size is approx 595 x 842)
        doc.translate(doc.page.width / 2, doc.page.height / 2);
        doc.rotate(-45);
        doc.opacity(0.1); // Add opacity for better subtlety
        doc.fontSize(40).fillColor('#4c1d95').text('RSUD TIGARAKSA', -200, 0, { align: 'center', width: 400, baseline: 'middle' }); // Centered text
        doc.restore();

        // Logo
        const logoPath = path.join(__dirname, '../client/public/logo-rsud.png');
        if (fs.existsSync(logoPath)) {
             try {
                doc.image(logoPath, cardX + 20, cardY + 15, { height: 50 }); // Adjusted Left Logo Position
             } catch (e) {
                console.error('Error embedding logo:', e);
             }
        }

        // Header
        // Center the text in the available space between logo and barcode
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#4c1d95')
           .text('KARTU PESERTA UJIAN', cardX, cardY + 20, { width: cardWidth, align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('#666666')
           .text('REKRUTMEN PEGAWAI RSUD TIGARAKSA', cardX, cardY + 45, { width: cardWidth, align: 'center' });

        const regDate = applicant.createdAt ? new Date(applicant.createdAt) : new Date();
        const yy = String(regDate.getFullYear()).slice(-2);
        const mm = String(regDate.getMonth() + 1).padStart(2, '0');
        const dd = String(regDate.getDate()).padStart(2, '0');
        let participantNumber = applicant.participantNumber;
        if (!participantNumber) {
            try {
                const pos = await Position.findOne({ where: { name: applicant.position } });
                const posCode = (pos?.code || '00').padStart(2, '0').slice(-2);
                const seq = String(applicant.id % 1000).padStart(3, '0');
                participantNumber = `${yy}${mm}${dd}${posCode}${seq}`;
            } catch {}
        }

        // Barcode (Top Right)
        try {
            const barcodeBuffer = await bwipjs.toBuffer({
                bcid:        'code128',       // Barcode type
                text:        participantNumber,    // Text to encode
                scale:       2,               // 3x scaling factor
                height:      10,              // Bar height, in millimeters
                includetext: true,            // Show human-readable text
                textxalign:  'center',        // Always good to set this
            });
            // Align barcode with the header text - moved down slightly as requested
            doc.image(barcodeBuffer, cardX + cardWidth - 120, cardY + 25, { width: 100, height: 40 });
        } catch (e) {
            console.error("Barcode generation error:", e);
        }

        // Divider
        const dividerY = cardY + 75;
        doc.moveTo(cardX + 40, dividerY).lineTo(cardX + cardWidth - 40, dividerY)
           .lineWidth(3).strokeColor('#4c1d95').stroke();
        doc.moveTo(cardX + 40, dividerY + 4).lineTo(cardX + cardWidth - 40, dividerY + 4)
           .lineWidth(1).strokeColor('#4c1d95').stroke();

        // Content Area
        const contentY = dividerY + 30;
        const photoX = cardX + 40;
        const photoWidth = 120;
        const photoHeight = 160;
        const detailsX = photoX + photoWidth + 40;

        // Photo Handling
        try {
            let photoLoaded = false;
            
            if (applicant.pasFotoPath) {
                // Ensure photo is contained within its bounds (Prevent overflow)
                doc.save();
                doc.rect(photoX, contentY, photoWidth, photoHeight).clip();

                if (applicant.pasFotoPath.includes('/file/proxy/')) {
                    try {
                        const fileId = applicant.pasFotoPath.split('/file/proxy/')[1];
                        const photoBuffer = await driveService.getFileBuffer(fileId);
                        doc.image(photoBuffer, photoX, contentY, { 
                            width: photoWidth, 
                            height: photoHeight, 
                            fit: [photoWidth, photoHeight],
                            align: 'center',
                            valign: 'center'
                        });
                        photoLoaded = true;
                    } catch (err) {
                        console.error("Error loading drive photo:", err);
                    }
                } else {
                    // Local File: path stored as /uploads/filename
                    const localPath = path.join(__dirname, '../public', applicant.pasFotoPath);
                    if (fs.existsSync(localPath)) {
                        doc.image(localPath, photoX, contentY, { 
                            width: photoWidth, 
                            height: photoHeight, 
                            fit: [photoWidth, photoHeight],
                            align: 'center',
                            valign: 'center'
                        });
                        photoLoaded = true;
                    } else {
                        console.error("Local photo not found at:", localPath);
                    }
                }
                doc.restore();
            }

            // Draw border around photo (always) - REMOVED as requested
            // doc.rect(photoX, contentY, photoWidth, photoHeight).lineWidth(2).strokeColor('#4c1d95').stroke(); 

            if (!photoLoaded) {
                 doc.fontSize(10).fillColor('#999999').text('No Photo', photoX, contentY + 70, { width: photoWidth, align: 'center' });
            }

            // Draw Logo Overlay (Bottom Right, overlapping)
            if (fs.existsSync(logoPath)) {
                const logoSize = 35; // Slightly smaller for better proportion
                // Bottom Right coordinates: photoX + photoWidth - logoSize - 5 (moved left), photoY + photoHeight - 25
                const overlayX = photoX + photoWidth - logoSize - 5;
                const overlayY = contentY + photoHeight - 25;
                
                // Draw Shadow
                doc.save();
                doc.circle(overlayX + logoSize/2 + 1, overlayY + logoSize/2 + 1, logoSize/2 + 1)
                   .fillColor('black')
                   .opacity(0.1) // Reduced opacity
                   .fill();
                doc.restore();

                // Draw white circular background for logo (optional, to make it pop)
                doc.circle(overlayX + logoSize/2, overlayY + logoSize/2, logoSize/2 + 2)
                   .fillColor('white').fill();

                doc.image(logoPath, overlayX, overlayY, { width: logoSize, height: logoSize });
            }

        } catch (e) {
             console.error("Failed to load photo for PDF:", e);
             // Draw placeholder on error
            doc.rect(photoX, contentY, photoWidth, photoHeight).lineWidth(1).strokeColor('#dddddd').stroke();
             doc.fontSize(10).fillColor('#999999').text('Photo Error', photoX, contentY + 70, { width: photoWidth, align: 'center' });
        }

        // Details
        let currentY = contentY;
        const labelWidth = 110;

        const drawRow = (label, value, color = 'black', bold = false) => {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#555555').text(label, detailsX, currentY);
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(color).text(': ' + value, detailsX + labelWidth, currentY);
            currentY += 20;
        };

        drawRow('Nomor Peserta', participantNumber);
        drawRow('Nama Lengkap', applicant.name);
        drawRow('NIK', applicant.nik);
        
        const birthDate = applicant.birthDate ? new Date(applicant.birthDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
        const birthPlace = applicant.birthPlace || '-';
        drawRow('TTL', `${birthPlace}, ${birthDate}`);
        
        drawRow('Institusi', applicant.institution || '-');
        drawRow('Pendidikan', applicant.major || applicant.education);
        drawRow('Posisi Dilamar', applicant.position);

        // Session Information
        let location = 'RSUD Tigaraksa (Gedung Utama)';
        let schedule = 'Menunggu Informasi Selanjutnya';

        if (applicant.Session) {
            location = applicant.Session.location || location;
            const date = applicant.Session.date ? new Date(applicant.Session.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
            const startTime = applicant.Session.startTime ? applicant.Session.startTime.substring(0, 5) : '';
            const endTime = applicant.Session.endTime ? applicant.Session.endTime.substring(0, 5) : '';
            
            if (date) {
                schedule = `${date}`;
                if (startTime) {
                    schedule += ` (${startTime}${endTime ? ' - ' + endTime : ''})`;
                }
            }
        }

        drawRow('Lokasi Ujian', location);
        drawRow('Jadwal Ujian', schedule);
        drawRow('Status', 'TERVERIFIKASI', '#16a34a', true); // Green-600

        // New Layout: QR Code (Left) and Table (Right)
        // Ensure spacing is relative to the bottom of the photo or details, whichever is lower
        const contentBottomY = Math.max(currentY, contentY + photoHeight);
        const newSectionY = contentBottomY + 40; // Increased spacing (was 30 from currentY)
        
        // 1. QR Code (Left side)
        try {
            const qrBuffer = await bwipjs.toBuffer({
                bcid:        'qrcode',
                text:        participantNumber,
                scale:       3,
                padding:     1,
                includetext: false,
            });
            
            // Draw QR Code - Aligned with Photo X position (cardX + 40)
            doc.image(qrBuffer, cardX + 40, newSectionY, { width: 100, height: 100 });
        } catch (e) {
            console.error("QR Code generation error:", e);
        }

        // 2. Table (Right side)
        const tableX = cardX + 150;
        const tableY = newSectionY + 10; // Moved down to align with QR code visual center
        const tableWidth = cardWidth - 170; // Remaining width
        const rowHeight1 = 25; // Reduced height
        const rowHeight2 = 60; // Increased height to prevent text overlap

        // Table Border
        doc.rect(tableX, tableY, tableWidth, rowHeight1 + rowHeight2).strokeColor('#000000').stroke();
        
        // Horizontal Divider
        doc.moveTo(tableX, tableY + rowHeight1).lineTo(tableX + tableWidth, tableY + rowHeight1).stroke();
        
        // Vertical Divider
        const col1Width = tableWidth * 0.4;
        doc.moveTo(tableX + col1Width, tableY).lineTo(tableX + col1Width, tableY + rowHeight1 + rowHeight2).stroke();
        
        // Table Content
        // Row 1
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
           .text('Tanggal Daftar', tableX + 5, tableY + 8, { width: col1Width - 10 });
        
        const tanggalDaftar = applicant.createdAt ? new Date(applicant.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
        
        doc.font('Helvetica').fontSize(10)
           .text(tanggalDaftar, tableX + col1Width + 5, tableY + 8, { width: tableWidth - col1Width - 10 });
        
        // Row 2
        doc.font('Helvetica-Bold').fontSize(10)
           .text('PIN UJIAN', tableX + 5, tableY + rowHeight1 + 10, { width: col1Width - 10 });
        doc.font('Helvetica-Oblique').fontSize(8)
           .text('* ditulis / diberikan oleh Panitia ujian seleksi pada saat registrasi', 
                 tableX + col1Width + 5, 
                 tableY + rowHeight1 + rowHeight2 - 25, // Adjusted Y position (moved up slightly from bottom)
                 { width: tableWidth - col1Width - 10, align: 'right' });


        // Footer: PERHATIAN Section
        const attentionY = newSectionY + 110; // Adjusted based on reduced table height
        
        // Divider line for footer
        doc.moveTo(cardX, attentionY).lineTo(cardX + cardWidth, attentionY).lineWidth(2).strokeColor('#000000').stroke();

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
           .text('PERHATIAN', cardX + 10, attentionY + 10, { characterSpacing: 1 }); // Increased spacing for header too
        
        const points = [
            '1. Peserta WAJIB datang 90 menit sebelum Sesi ujian',
            '2. Kartu Peserta Ujian CASN ini wajib dibawa saat pelaksanaan Ujian dalam bentuk fisik.',
            '3. Peserta wajib membawa Kartu/ Bukti Identitas Diri (Asli) yang sesuai tercantum pada Kartu ini, jika terdapat ketidaksesuaian, maka Instansi berhak untuk tidak mengikutsertakan peserta untuk mengikuti Ujian.',
            '4. Kelalaian peserta dalam membaca dan memahami pengumuman Instansi menjadi tanggung jawab peserta.',
            '5. Peserta wajib mematuhi peraturan yang berlaku pada saat pelaksanaan ujian.'
        ];

        let pointY = attentionY + 25;
        doc.font('Helvetica').fontSize(9);
        
        points.forEach(point => {
            const number = point.substring(0, 3).trim(); // "1.", "2.", etc.
            const text = point.substring(3).trim(); // The rest of the text

            const numberX = cardX + 10;
            const textX = cardX + 25; // Indent for text
            const textWidth = cardWidth - 35; // Adjust width

            // Print Number
            doc.text(number, numberX, pointY);
            
            // Print Text (Justified and hanging indent)
            // Use same Y, let pdfkit wrap text
            doc.text(text, textX, pointY, { width: textWidth, align: 'justify' });
            
            // Update Y for next point (doc.y is updated by the last text call)
            pointY = doc.y + 4; // Add small gap between points
        });

        // Print Date at very bottom
        const footerBottomY = cardY + cardHeight - 20;
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#888888')
           .text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, cardX, footerBottomY, { width: cardWidth, align: 'center' });
        
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Check Status Page
router.get('/api/status', async (req, res) => {
    const { nik } = req.query;
    try {
        if (!nik) {
            return res.status(400).json({ error: 'NIK is required' });
        }
        const applicant = await Applicant.findOne({ where: { nik } });
        if (!applicant) {
            return res.status(404).json({ error: 'Applicant not found' });
        }
        res.json({ applicant });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Download Registration Card (PDF)
router.get('/api/print-registration-card/:id', async (req, res) => {
    try {
        const applicant = await Applicant.findByPk(req.params.id);

        if (!applicant) {
            return res.status(404).json({ error: 'Applicant not found' });
        }

        // --- Custom Page Size Configuration (Matches Card Size) ---
        // Width: 600, Height: 500 (As requested "segini saja")
        // No large margins needed since the page IS the card
        const pageWidth = 600;
        const pageHeight = 500;
        
        const doc = new PDFDocument({ 
            size: [pageWidth, pageHeight], 
            margin: 0,
            autoFirstPage: true
        });

        // Determine disposition based on query param
        // If ?download=true -> attachment (Force download)
        // Default -> inline (Preview)
        const disposition = req.query.download === 'true' ? 'attachment' : 'inline';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${disposition}; filename=Kartu_Pendaftaran_${applicant.id}.pdf`);

        doc.pipe(res);

        // Layout Configuration
        // Since page size matches card, we use small padding
        const margin = 20; 
        const cardWidth = pageWidth - (2 * margin);
        const cardHeight = pageHeight - (2 * margin); 
        const cardX = margin;
        const cardY = margin;

        // Draw Card Border (Gray thin border)
        doc.rect(cardX, cardY, cardWidth, cardHeight).lineWidth(1).strokeColor('#808080').stroke(); 

        // Watermark (Background - Centered in Card)
        doc.save();
        doc.translate(pageWidth / 2, pageHeight / 2); // Center of page
        doc.rotate(-45);
        doc.opacity(0.05); 
        doc.fontSize(60).fillColor('#000000').text('RSUD TIGARAKSA', -300, 0, { align: 'center', width: 600, baseline: 'middle' }); 
        doc.restore();

        // Content Positioning
        const contentMargin = 20;
        const startX = cardX + contentMargin;
        const startY = cardY + contentMargin;
        const contentWidth = cardWidth - (2 * contentMargin);

        // --- Header ---
        // Logo (Left)
        const logoPath = path.join(__dirname, '../client/public/logo-rsud.png');
        if (fs.existsSync(logoPath)) {
             try {
                doc.image(logoPath, startX, startY, { height: 50 });
             } catch (e) {
                console.error('Error embedding logo:', e);
             }
        }

        const createdAt2 = applicant.createdAt ? new Date(applicant.createdAt) : new Date();
        const yy2 = String(createdAt2.getFullYear()).slice(-2);
        const mm2 = String(createdAt2.getMonth() + 1).padStart(2, '0');
        const dd2 = String(createdAt2.getDate()).padStart(2, '0');
        let participantNumber2 = applicant.participantNumber;
        if (!participantNumber2) {
            try {
                const pos = await Position.findOne({ where: { name: applicant.position } });
                const posCode = (pos?.code || '00').padStart(2, '0').slice(-2);
                const seq2 = String(applicant.id % 1000).padStart(3, '0');
                participantNumber2 = `${yy2}${mm2}${dd2}${posCode}${seq2}`;
            } catch {}
        }

        // Barcode (Top Right - Lowered Position)
        try {
            const barcodeBuffer = await bwipjs.toBuffer({
                bcid:        'code128',
                text:        participantNumber2, 
                scale:       2,          
                height:      6,          
                includetext: false,      
                textxalign:  'center',   
                textsize:    11,         
                paddingheight: 2         
            });
            
            const barcodeWidth = 90; 
            const barcodeX = startX + contentWidth - barcodeWidth;
            // Lower the barcode by 10 points to align better
            const barcodeY = startY + 10; 
            
            doc.image(barcodeBuffer, barcodeX, barcodeY, { width: barcodeWidth }); 
        } catch (e) {
            console.error("Barcode generation error:", e);
        }

        // Title (Center - Perfectly centered)
        const titleY = startY + 10;
        
        doc.font('Helvetica-Bold').fontSize(14).fillColor('#4B0082') 
           .text('KARTU PENDAFTARAN REKRUTMEN', startX, titleY, { width: contentWidth, align: 'center' });
        doc.text('PEGAWAI RSUD TIGARAKSA', startX, doc.y, { width: contentWidth, align: 'center' });
        doc.fontSize(14).text('2026', startX, doc.y, { width: contentWidth, align: 'center' });

        // Line Separator
        const headerBottom = startY + 80;
        doc.moveTo(startX, headerBottom).lineTo(startX + contentWidth, headerBottom).lineWidth(3).strokeColor('#4B0082').stroke();
        doc.strokeColor('#000000'); // Reset color
        
        // Subheader
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000').text('RSUD Tigaraksa', startX, headerBottom + 10);

        // --- Data Fields & Photo (Original Layout) ---
        let currentY = headerBottom + 40;
        
        // Revised Column Configuration to shift data left
        const col1X = startX;
        const col2X = startX + 140; // Shifted left from 200 to 140
        const col3X = col2X + 10;   // Value starts here
        
        const photoX = startX + contentWidth - 90; // Right aligned
        const photoY = headerBottom + 20;
        const photoWidth = 90;
        const photoHeight = 120; 
        
        // Calculate max width for value to avoid hitting photo
        // Gap between value start and photo start
        const valueMaxWidth = photoX - col3X - 10; // 10px buffer

        // Photo
        try {
            if (applicant.pasFotoPath) {
                // Ensure photo is contained within its bounds (Prevent overflow)
                doc.save();
                doc.rect(photoX, photoY, photoWidth, photoHeight).clip();

                if (applicant.pasFotoPath.includes('/file/proxy/')) {
                    const fileId = applicant.pasFotoPath.split('/file/proxy/')[1];
                    const photoBuffer = await driveService.getFileBuffer(fileId);
                    doc.image(photoBuffer, photoX, photoY, { 
                        width: photoWidth, 
                        height: photoHeight, 
                        cover: [photoWidth, photoHeight], 
                        align: 'center', 
                        valign: 'center' 
                    });
                } else {
                    const localPath = path.join(__dirname, '../public', applicant.pasFotoPath);
                    if (fs.existsSync(localPath)) {
                        doc.image(localPath, photoX, photoY, { 
                            width: photoWidth, 
                            height: photoHeight, 
                            cover: [photoWidth, photoHeight], 
                            align: 'center', 
                            valign: 'center' 
                        });
                    }
                }
                doc.restore();
            } else {
                // Placeholder
                doc.rect(photoX, photoY, photoWidth, photoHeight).stroke();
                doc.fontSize(10).text('Foto', photoX, photoY + 50, { width: photoWidth, align: 'center' });
            }
        } catch (e) {
            console.error('Photo load error:', e);
        }

        // Helper for rows with wrapping
        const drawRow = (label, value) => {
            const textValue = value || '-';
            
            // Draw Label
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text(label, col1X, currentY);
            
            // Draw Colon
            doc.text(':', col2X, currentY);
            
            // Draw Value with Wrapping
            // Measure height first to see if it wraps
            const textOptions = { width: valueMaxWidth, align: 'left' };
            const textHeight = doc.heightOfString(textValue, textOptions);
            
            doc.text(textValue, col3X, currentY, textOptions);
            
            // Calculate next Y based on whichever is taller: single row (18) or wrapped text
            const rowHeight = Math.max(18, textHeight + 5); // +5 for padding
            currentY += rowHeight;
        };

        // Fields
        drawRow('Jenis Seleksi', 'Pegawai BLUD');
        drawRow('Nomor Peserta', participantNumber2); 
        currentY += 5; // Small spacer

        drawRow('No. Identitas KTP', applicant.nik);
        drawRow('Nama', applicant.name.toUpperCase());
        
        const birthDate = applicant.birthDate ? new Date(applicant.birthDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
        const birthPlace = applicant.birthPlace || '-';
        drawRow('Tempat / Tanggal Lahir', `${birthPlace} / ${birthDate}`);
        
        drawRow('Jenis Kelamin', applicant.gender);
        drawRow('Institusi Pendidikan', applicant.institution || '-'); 
        drawRow('Kualifikasi Pendidikan', applicant.major || applicant.education);
        drawRow('Posisi Dilamar', applicant.position.toUpperCase());
        
        const regDate = applicant.createdAt ? new Date(applicant.createdAt).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':') : '-';
        drawRow('Tgl / Jam Pendaftaran', regDate);

        // Divider
        currentY = Math.max(currentY, photoY + photoHeight + 10); // Ensure below photo
        currentY += 10;

        doc.moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).lineWidth(1).strokeColor('#000000').stroke(); 
        currentY += 2;
        doc.moveTo(startX, currentY).lineTo(startX + contentWidth, currentY).lineWidth(2).stroke(); 
        
        currentY += 30;

        // Footer Text
        doc.font('Helvetica-BoldOblique').fontSize(9).fillColor('black')
           .text('"Demikian data pribadi ini saya buat dengan sebenarnya dan bila ternyata isian yang dibuat tidak benar, saya bersedia menanggung akibat hukum yang ditimbulkannya"', startX + 20, currentY, { width: contentWidth - 40, align: 'center' });
        
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
