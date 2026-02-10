const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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
        if (!files.ktp || !files.ijazah || !files.str || !files.suratPernyataan || !files.pasFoto) {
            return res.status(400).json({ error: 'Harap upload semua dokumen yang diminta (KTP, Ijazah, STR, Surat Pernyataan, Pas Foto).' });
        }

        const { name, nik, gender, birthDate, education, major, gpa, email, phoneNumber, position } = req.body;
        console.log('Received body:', req.body); // Debugging
        
        // Helper to upload to Drive and return proxy path
        const processFile = async (fileArray, label) => {
             if (fileArray && fileArray.length > 0) {
                 const file = fileArray[0];
                 const ext = path.extname(file.originalname);
                 // Format: Label_NIK.ext (e.g., Surat Lamaran & CV_1809011908000007.pdf)
                 const customName = `${label}_${nik}${ext}`;
                 
                 try {
                     console.log(`Uploading ${label} to Drive as ${customName}...`);
                     const driveFile = await driveService.uploadFile(file, null, customName);
                     
                     // Delete local file after successful upload
                     if (fs.existsSync(file.path)) {
                         fs.unlinkSync(file.path);
                     }
                     
                     // Return proxy path
                     return `/file/proxy/${driveFile.id}`;
                 } catch (err) {
                     console.error(`Failed to upload ${label} to Drive:`, err);
                     // Fallback to local path if Drive upload fails (optional, but good for robustness)
                     // But user specifically asked for Drive upload. If it fails, we should probably throw or keep local.
                     // For now, let's keep local if Drive fails, but log error.
                     return '/uploads/' + file.filename;
                 }
             }
             return null;
        };

        const ktpPath = await processFile(files.ktp, 'KTP');
        const ijazahPath = await processFile(files.ijazah, 'Ijazah & Nilai Terakhir');
        const strPath = await processFile(files.str, 'STR');
        const sertifikatPath = await processFile(files.sertifikat, 'Sertifikat');
        const suratPernyataanPath = await processFile(files.suratPernyataan, 'Surat Pernyataan');
        const pasFotoPath = await processFile(files.pasFoto, 'Pas Foto');
        const suratLamaranPath = await processFile(files.suratLamaran, 'Surat Lamaran & CV');

        const applicant = await Applicant.create({
            name,
            nik,
            gender,
            birthDate,
            education,
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

        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
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

        // Barcode (Top Right)
        try {
            const barcodeBuffer = await bwipjs.toBuffer({
                bcid:        'code128',       // Barcode type
                text:        applicant.id.toString().padStart(6, '0'),    // Text to encode
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
                if (applicant.pasFotoPath.includes('/file/proxy/')) {
                    try {
                        const fileId = applicant.pasFotoPath.split('/file/proxy/')[1];
                        const photoBuffer = await driveService.getFileBuffer(fileId);
                        doc.image(photoBuffer, photoX, contentY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight] });
                        photoLoaded = true;
                    } catch (err) {
                        console.error("Error loading drive photo:", err);
                    }
                } else {
                    // Local File: path stored as /uploads/filename
                    const localPath = path.join(__dirname, '../public', applicant.pasFotoPath);
                    if (fs.existsSync(localPath)) {
                        doc.image(localPath, photoX, contentY, { width: photoWidth, height: photoHeight, fit: [photoWidth, photoHeight] });
                        photoLoaded = true;
                    } else {
                        console.error("Local photo not found at:", localPath);
                    }
                }
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

        drawRow('Nomor Peserta', applicant.id.toString().padStart(6, '0'));
        drawRow('Nama Lengkap', applicant.name);
        drawRow('NIK', applicant.nik);
        drawRow('Posisi Dilamar', applicant.position);
        drawRow('Lokasi Ujian', 'RSUD Tigaraksa (Gedung Utama)');
        drawRow('Jadwal Ujian', 'Menunggu Informasi Selanjutnya');
        drawRow('Status', 'TERVERIFIKASI', '#16a34a', true); // Green-600

        // New Layout: QR Code (Left) and Table (Right)
        // Ensure spacing is relative to the bottom of the photo or details, whichever is lower
        const contentBottomY = Math.max(currentY, contentY + photoHeight);
        const newSectionY = contentBottomY + 40; // Increased spacing (was 30 from currentY)
        
        // 1. QR Code (Left side)
        try {
            const qrBuffer = await bwipjs.toBuffer({
                bcid:        'qrcode',
                text:        applicant.id.toString(),
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
           .text('Tanggal Melamar', tableX + 5, tableY + 8, { width: col1Width - 10 });
        doc.font('Helvetica').fontSize(10)
           .text('5 September 2024', tableX + col1Width + 5, tableY + 8, { width: tableWidth - col1Width - 10 });
        
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

module.exports = router;
