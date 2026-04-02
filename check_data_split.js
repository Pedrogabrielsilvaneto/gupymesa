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
        const ids = ['1074356', '980580', '1157276', '980578', '1157277', '980577'];
        
        console.log("--- PRODUCAO ---");
        const [prod] = await connection.execute(`
            SELECT usuario_id, SUM(quantidade) as total 
            FROM producao 
            WHERE usuario_id IN (${ids.map(id => `'${id}'`).join(',')})
            GROUP BY usuario_id
        `);
        console.log(JSON.stringify(prod, null, 2));

        console.log("--- ASSERTIVIDADE ---");
        const [assert] = await connection.execute(`
            SELECT usuario_id, COUNT(*) as count 
            FROM assertividade 
            WHERE usuario_id IN (${ids.map(id => `'${id}'`).join(',')})
            GROUP BY usuario_id
        `);
        console.log(JSON.stringify(assert, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
