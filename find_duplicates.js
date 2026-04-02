const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/Users/Pedro Neto/.gemini/antigravity/scratch/gupymesa_deploy/.env' });

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        const [rows] = await connection.execute(`
            SELECT nome, COUNT(*) as count, GROUP_CONCAT(id) as ids, GROUP_CONCAT(ativo) as ativos
            FROM usuarios 
            GROUP BY nome 
            HAVING count > 1
        `);
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
