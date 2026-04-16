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
        const idToDelete = 'a4d1fe80-b6fa-4ada-a488-2c17545bf6e7';
        const [result] = await connection.execute("DELETE FROM producao WHERE id = ?", [idToDelete]);
        console.log('Delete result:', result);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

run();
