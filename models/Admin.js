const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.ENUM('superadmin', 'verificator'),
        defaultValue: 'verificator',
        allowNull: false
    }
});

module.exports = Admin;
