const Sequelize = require('sequelize');
const path = require('path');

let sequelize;

if (process.env.DATABASE_URL) {
    // Production (Railway/PostgreSQL)
    console.log("Using PostgreSQL Database (DATABASE_URL detected)");
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Required for Railway
            }
        }
    });
} else {
    // Development (Local/SQLite)
    console.log("Using SQLite Database (Local)");
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/database.sqlite');
    sequelize = new Sequelize({
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
            mode: 'WAL' 
        }
    });

    // Enable WAL mode explicitly for SQLite
    sequelize.query("PRAGMA journal_mode = WAL;").catch(err => {
        console.log("WAL mode config skipped/error (normal if file is locked or first run)");
    });
}

module.exports = sequelize;
