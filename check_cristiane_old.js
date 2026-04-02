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
        const id = '1074361';
        
        const [prod] = await connection.execute(`SELECT COUNT(*) as c FROM producao WHERE usuario_id = ?`, [id]);
        const [asrt] = await connection.execute(`SELECT COUNT(*) as c FROM assertividade WHERE usuario_id = ?`, [id]);
        
        console.log(`ID ${id} (Cristiane old): Prod=${prod[0].c}, Asrt=${asrt[0].c}`);
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
