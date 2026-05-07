const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    port: process.env.TIDB_PORT || 4000,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
};

async function inspect() {
    console.log('🔍 Inspecionando tabela metas...');
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await conn.execute('DESCRIBE metas');
        console.table(rows);
    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await conn.end();
    }
}

inspect();
