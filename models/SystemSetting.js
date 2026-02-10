const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const SystemSetting = sequelize.define('SystemSetting', {
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true
    },
    value: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

module.exports = SystemSetting;
