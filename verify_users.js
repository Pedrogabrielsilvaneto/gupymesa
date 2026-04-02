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
        const query = `
            SELECT id, nome, perfil, funcao, ativo FROM usuarios 
            WHERE nome LIKE '%Debora Braz%' 
               OR nome LIKE '%Roberta Santos%' 
               OR nome LIKE '%Thayla Hupert%'
        `;
        const [rows] = await connection.execute(query);
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

main();
