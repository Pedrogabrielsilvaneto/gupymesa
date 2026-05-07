require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT || 4000,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        const [rows] = await connection.query(`
            SELECT id, observacao 
            FROM assertividade 
            WHERE observacao LIKE '%%'
            LIMIT 10
        `);
        console.log("Exemplos encontrados:", rows.length);
        rows.forEach(r => {
            console.log(`Obs: ${r.observacao}`);
        });
    } finally {
        await connection.end();
    }
}
check();
