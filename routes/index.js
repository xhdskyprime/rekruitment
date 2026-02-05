const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Applicant = require('../models/Applicant');
const Position = require('../models/Position');

const driveService = require('../services/driveService');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

// Configure Multer for memory storage (for Google Drive upload)
const storage = multer.memoryStorage();

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
        
        // Helper to upload to Drive and get ID
        const uploadToDrive = async (file) => {
             const driveFile = await driveService.uploadFile(file);
             return '/file/proxy/' + driveFile.id; // Return proxy URL
        };

        // Upload files in parallel for better performance
        const [ktpPath, ijazahPath, strPath, sertifikatPath, suratPernyataanPath, pasFotoPath] = await Promise.all([
            uploadToDrive(files.ktp[0]),
            uploadToDrive(files.ijazah[0]),
            uploadToDrive(files.str[0]),
            uploadToDrive(files.sertifikat[0]),
            uploadToDrive(files.suratPernyataan[0]),
            uploadToDrive(files.pasFoto[0])
        ]);

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
        const doc = new PDFDocument();
        const filename = `Kartu_Ujian_${applicant.name.replace(/\s+/g, '_')}.pdf`;

        res.setHeader('Content-disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        // Header
        doc.fontSize(25).text('KARTU UJIAN', { align: 'center' });
        doc.moveDown();
        
        // Info
        doc.fontSize(14).text(`Nama: ${applicant.name}`);
        doc.text(`NIK: ${applicant.nik}`);
        doc.text(`Email: ${applicant.email}`);
        doc.text(`Posisi: ${applicant.position}`);
        doc.text(`ID Peserta: ${applicant.id}`);
        doc.text(`Tanggal Ujian: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`); 
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
                fit: [100, 100],
                align: 'center'
            });
        } catch (e) {
            console.error("QR Code generation error:", e);
        }

        doc.moveDown();
        doc.fontSize(12).text('Harap bawa kartu ini dan KTP asli saat pelaksanaan ujian.', { align: 'center' });
        doc.text('Tunjukkan QR Code ini kepada petugas saat absensi.', { align: 'center' });
        
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
