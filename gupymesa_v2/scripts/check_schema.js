require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkSchema() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT || 4000,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        const [rows] = await connection.query("SHOW COLUMNS FROM usuarios");
        console.log("Colunas da tabela 'usuarios':");
        console.table(rows);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

checkSchema();
