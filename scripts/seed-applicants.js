require('dotenv').config();
const sequelize = require('../models/database');
const Applicant = require('../models/Applicant');

const seedApplicants = async () => {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        console.log('Database connected.');
        
        console.log('Syncing Applicant model...');
        await Applicant.sync({ alter: true });
        console.log('Applicant model synced.');

        // Dummy Data 1
        const applicant1 = {
            name: 'Budi Santoso',
            nik: '3201010101010001',
            gender: 'Laki-laki',
            birthDate: '1995-05-15',
            education: 'S1 Keperawatan',
            email: 'budi.santoso@example.com',
            phoneNumber: '081234567890',
            position: 'Perawat',
            ktpPath: 'dummy_ktp_budi.jpg',
            ijazahPath: 'dummy_ijazah_budi.pdf',
            strPath: 'dummy_str_budi.pdf',
            sertifikatPath: 'dummy_sertifikat_budi.pdf',
            suratPernyataanPath: 'dummy_surat_budi.pdf',
            pasFotoPath: 'dummy_foto_budi.jpg',
            status: 'pending'
        };

        // Dummy Data 2
        const applicant2 = {
            name: 'Siti Aminah',
            nik: '3201010101010002',
            gender: 'Perempuan',
            birthDate: '1998-10-20',
            education: 'D3 Kebidanan',
            email: 'siti.aminah@example.com',
            phoneNumber: '081987654321',
            position: 'Bidan',
            ktpPath: 'dummy_ktp_siti.jpg',
            ijazahPath: 'dummy_ijazah_siti.pdf',
            strPath: 'dummy_str_siti.pdf',
            sertifikatPath: 'dummy_sertifikat_siti.pdf',
            suratPernyataanPath: 'dummy_surat_siti.pdf',
            pasFotoPath: 'dummy_foto_siti.jpg',
            status: 'pending'
        };

        console.log('Creating Applicant 1...');
        try {
            const app1 = await Applicant.create(applicant1);
            console.log('Created Applicant 1:', app1.name);
        } catch (e) {
            if (e.name === 'SequelizeUniqueConstraintError') {
                console.log('Applicant 1 already exists');
            } else {
                throw e;
            }
        }

        console.log('Creating Applicant 2...');
        try {
            const app2 = await Applicant.create(applicant2);
            console.log('Created Applicant 2:', app2.name);
        } catch (e) {
            if (e.name === 'SequelizeUniqueConstraintError') {
                console.log('Applicant 2 already exists');
            } else {
                throw e;
            }
        }

    } catch (error) {
        console.error('Error seeding applicants:', error);
        if (error.errors) {
            error.errors.forEach(e => console.error(`- ${e.message}`));
        }
    } finally {
        console.log('Closing connection...');
        await sequelize.close();
    }
};

seedApplicants();
