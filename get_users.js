import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const c = await mysql.createConnection({
        host: process.env.TIDB_HOST, user: process.env.TIDB_USER, password: process.env.TIDB_PASSWORD,
        database: 'GupyMesa', port: 4000, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    const [rows] = await c.query('SELECT id, nome, perfil, funcao, senha FROM usuarios WHERE perfil = "ADMIN" OR perfil = "GESTORA" LIMIT 5');
    console.log(rows);

    await c.end();
}
run();
