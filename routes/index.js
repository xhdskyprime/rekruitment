const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Applicant = require('../models/Applicant');

const driveService = require('../services/driveService');

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
        if (!files.ktp || !files.ijazah || !files.str || !files.sertifikat || !files.pasFoto) {
            return res.status(400).json({ error: 'Harap upload semua dokumen yang diminta (KTP, Ijazah, STR, Sertifikat, Pas Foto).' });
        }

        const { name, nik, gender, birthDate, education, email, phoneNumber, position } = req.body;
        console.log('Received body:', req.body); // Debugging
        
        // Helper to upload to Drive and get ID
        const uploadToDrive = async (file) => {
             const driveFile = await driveService.uploadFile(file);
             return '/file/proxy/' + driveFile.id; // Return proxy URL
        };

        // Upload files in parallel for better performance
        const [ktpPath, ijazahPath, strPath, sertifikatPath, pasFotoPath] = await Promise.all([
            uploadToDrive(files.ktp[0]),
            uploadToDrive(files.ijazah[0]),
            uploadToDrive(files.str[0]),
            uploadToDrive(files.sertifikat[0]),
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
