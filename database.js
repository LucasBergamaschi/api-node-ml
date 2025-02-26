require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL 
    ? path.join(__dirname, process.env.DATABASE_URL)
    : path.join(__dirname, 'banco_dados_ml.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados SQLite');
    }
});

module.exports = db;
