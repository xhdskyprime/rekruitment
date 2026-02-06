const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Applicant = require('../models/Applicant');
const Position = require('../models/Position');

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

// Handle Registration
const uploadFields = upload.fields([
    { name: 'ktp', maxCount: 1 },
    { name: 'ijazah', maxCount: 1 },
    { name: 'str', maxCount: 1 },
    { name: 'sertifikat', maxCount: 1 },
    { name: 'suratPernyataan', maxCount: 1 },
    { name: 'pasFoto', maxCount: 1 }
]);

router.post('/register', (req, res, next) => {
    console.log('Request received at /register');
    uploadFields(req, res, (err) => {
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
        next();
    });
}, async (req, res) => {
    try {
        const files = req.files || {};
        if (!files.ktp || !files.ijazah || !files.str || !files.sertifikat || !files.suratPernyataan || !files.pasFoto) {
            return res.status(400).json({ error: 'Harap upload semua dokumen yang diminta (KTP, Ijazah, STR, Sertifikat, Surat Pernyataan, Pas Foto).' });
        }

        const { name, nik, gender, birthDate, education, email, phoneNumber, position } = req.body;
        console.log('Received body:', req.body); // Debugging
        
        // Helper to get local path
        const getLocalPath = (fileArray) => {
             if (fileArray && fileArray.length > 0) {
                 // Return relative path for frontend access
                 return '/uploads/' + fileArray[0].filename;
             }
             return null;
        };

        const ktpPath = getLocalPath(files.ktp);
        const ijazahPath = getLocalPath(files.ijazah);
        const strPath = getLocalPath(files.str);
        const sertifikatPath = getLocalPath(files.sertifikat);
        const suratPernyataanPath = getLocalPath(files.suratPernyataan);
        const pasFotoPath = getLocalPath(files.pasFoto);

        const applicant = await Applicant.create({
            name,
            nik,
            gender,
            birthDate,
            education,
            email,
            phoneNumber,
            position,
            ktpPath,
            ijazahPath,
            strPath,
            sertifikatPath,
            suratPernyataanPath,
            pasFotoPath
        });

        res.status(201).json({ success: true, applicant });
    } catch (error) {
        console.error('Registration Error:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'NIK atau Email sudah terdaftar.' });
        }
        
        res.status(500).json({ error: 'Terjadi kesalahan saat menyimpan data: ' + error.message });
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

        const applicant = await Applicant.findOne({ where: { id, nik } });

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
        const cardHeight = 350;

        // Draw Card Border
        doc.rect(cardX, cardY, cardWidth, cardHeight).lineWidth(1).strokeColor('#dddddd').stroke();

        // Watermark (Background)
        doc.save();
        doc.translate(cardX + cardWidth/2, cardY + cardHeight/2);
        doc.rotate(-45);
        doc.fontSize(60).fillColor('#f0f0f0').text('RSUD', 0, 0, { align: 'center' });
        doc.restore();

        // Header
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#4c1d95')
           .text('KARTU PESERTA UJIAN', cardX, cardY + 25, { width: cardWidth, align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('#666666')
           .text('REKRUTMEN PEGAWAI RSUD TIGARAKSA', cardX, cardY + 50, { width: cardWidth, align: 'center' });

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
            if (applicant.pasFotoPath && applicant.pasFotoPath.includes('/file/proxy/')) {
                const fileId = applicant.pasFotoPath.split('/file/proxy/')[1];
                const photoBuffer = await driveService.getFileBuffer(fileId);
                doc.image(photoBuffer, photoX, contentY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight] });
                // Draw border around photo
                doc.rect(photoX, contentY, photoWidth, photoHeight).lineWidth(1).strokeColor('#dddddd').stroke();
            } else {
                 // Draw placeholder
                 doc.rect(photoX, contentY, photoWidth, photoHeight).lineWidth(1).strokeColor('#dddddd').stroke();
                 doc.fontSize(10).fillColor('#999999').text('No Photo', photoX, contentY + 70, { width: photoWidth, align: 'center' });
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

        drawRow('Nomor Peserta', applicant.id.toString().padStart(6, '0'));
        drawRow('Nama Lengkap', applicant.name);
        drawRow('NIK', applicant.nik);
        drawRow('Posisi Dilamar', applicant.position);
        drawRow('Lokasi Ujian', 'RSUD Tigaraksa (Gedung Utama)');
        drawRow('Jadwal Ujian', 'Menunggu Informasi Selanjutnya');
        drawRow('Status', 'TERVERIFIKASI', '#16a34a', true); // Green-600

        // QR Code
        try {
            const qrBuffer = await bwipjs.toBuffer({
                bcid:        'qrcode',
                text:        applicant.id.toString(),
                scale:       3,
                padding:     1,
                includetext: false,
            });
            
            // Draw Label
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#555555').text('Scan QR Code', detailsX, currentY + 10);
            
            // Draw Image
            doc.image(qrBuffer, detailsX + labelWidth, currentY, { width: 80, height: 80 });
        } catch (e) {
            console.error("QR Code generation error:", e);
        }

        // Footer
        const footerY = cardY + cardHeight - 50;
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#888888')
           .text('Kartu ini adalah bukti sah kepesertaan ujian.', cardX, footerY, { width: cardWidth, align: 'center' });
        doc.text('Wajib dibawa beserta KTP asli saat pelaksanaan ujian.', cardX, footerY + 12, { width: cardWidth, align: 'center' });
        doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, cardX, footerY + 24, { width: cardWidth, align: 'center' });
        
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

module.exports = router;
