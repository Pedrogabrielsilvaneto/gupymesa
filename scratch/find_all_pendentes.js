const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        const [abonos] = await connection.query("SELECT p.*, u.nome FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.status = 'PENDENTE_ABONO'");
        console.log('All Pending abonos:', abonos);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

run();
