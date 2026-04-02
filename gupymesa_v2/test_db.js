import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const dbConfig = {
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: 'GupyMesa',
        port: 4000,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    };

    const c = await mysql.createConnection(dbConfig);
    const [rows] = await c.query("SELECT * FROM metas WHERE usuario_id IN (SELECT id FROM usuarios WHERE nome LIKE '%Pedro Gabriel%')");
    console.log(rows);
    await c.end();
}
run();
