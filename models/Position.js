const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Position = sequelize.define('Position', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'Positions'
});

module.exports = Position;
