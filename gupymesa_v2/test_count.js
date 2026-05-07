import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const c = await mysql.createConnection({
        host: process.env.TIDB_HOST, user: process.env.TIDB_USER, password: process.env.TIDB_PASSWORD,
        database: 'GupyMesa', port: 4000, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });
    const [r1] = await c.query("SELECT COUNT(*) as c FROM metas");
    console.log('Metas total rows:', r1[0].c);
    await c.end();
}
run();
