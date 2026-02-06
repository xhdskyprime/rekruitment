const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Applicant = sequelize.define('Applicant', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nik: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    gender: {
        type: DataTypes.ENUM('Laki-laki', 'Perempuan'),
        allowNull: false
    },
    birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true // Allow null for existing records temporarily
    },
    education: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isEmail: true
        }
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true // Changed to allow null for existing records
    },
    position: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // File Paths
    pasFotoPath: { type: DataTypes.STRING, allowNull: true }, 
    ktpPath: { type: DataTypes.STRING, allowNull: false },
    ijazahPath: { type: DataTypes.STRING, allowNull: false },
    strPath: { type: DataTypes.STRING, allowNull: false },
    sertifikatPath: { type: DataTypes.STRING, allowNull: false },
    suratPernyataanPath: { type: DataTypes.STRING, allowNull: true },
    
    // Verification Status per File
    // Values: 'pending', 'valid' (Sesuai), 'invalid' (Tidak Sesuai)
    ktpStatus: { 
        type: DataTypes.ENUM('pending', 'valid', 'invalid'), 
        defaultValue: 'pending' 
    },
    ktpRejectReason: { type: DataTypes.STRING, allowNull: true },
    ktpVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    ktpVerifiedBy: { type: DataTypes.STRING, allowNull: true },

    ijazahStatus: { 
        type: DataTypes.ENUM('pending', 'valid', 'invalid'), 
        defaultValue: 'pending' 
    },
    ijazahRejectReason: { type: DataTypes.STRING, allowNull: true },
    ijazahVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    ijazahVerifiedBy: { type: DataTypes.STRING, allowNull: true },

    strStatus: { 
        type: DataTypes.ENUM('pending', 'valid', 'invalid'), 
        defaultValue: 'pending' 
    },
    strRejectReason: { type: DataTypes.STRING, allowNull: true },
    strVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    strVerifiedBy: { type: DataTypes.STRING, allowNull: true },

    sertifikatStatus: { 
        type: DataTypes.ENUM('pending', 'valid', 'invalid'), 
        defaultValue: 'pending' 
    },
    sertifikatRejectReason: { type: DataTypes.STRING, allowNull: true },
    sertifikatVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    sertifikatVerifiedBy: { type: DataTypes.STRING, allowNull: true },

    suratPernyataanStatus: { 
        type: DataTypes.ENUM('pending', 'valid', 'invalid'), 
        defaultValue: 'pending' 
    },
    suratPernyataanRejectReason: { type: DataTypes.STRING, allowNull: true },
    suratPernyataanVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    suratPernyataanVerifiedBy: { type: DataTypes.STRING, allowNull: true },

    // Global Status
    status: {
        type: DataTypes.ENUM('pending', 'verified', 'rejected'),
        defaultValue: 'pending'
    },
    examCardPath: {
        type: DataTypes.STRING,
        allowNull: true
    },
    
    // Attendance
    attendanceStatus: {
        type: DataTypes.ENUM('absent', 'present'),
        defaultValue: 'absent'
    },
    attendanceTime: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    indexes: [
        { fields: ['status'] },
        { fields: ['nik'] },
        { fields: ['name'] },
        { fields: ['attendanceStatus'] },
        { fields: ['createdAt'] }
    ]
});

module.exports = Applicant;
