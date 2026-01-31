const Sequelize = require('sequelize');

const path = require('path');
const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {
        // WAL mode for better concurrency
        mode: 'WAL' 
    }
});

// Enable WAL mode explicitly
sequelize.query("PRAGMA journal_mode = WAL;").then(() => {
    console.log("Database WAL Mode enabled for better concurrency.");
});

module.exports = sequelize;
