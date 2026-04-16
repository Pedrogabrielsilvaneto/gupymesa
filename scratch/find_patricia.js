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
        const [users] = await connection.execute("SELECT id, nome FROM usuarios WHERE nome LIKE '%Patricia%'");
        console.log('Users found:', users);

        if (users.length > 0) {
            const userIds = users.map(u => u.id);
            const [abonos] = await connection.query("SELECT * FROM producao WHERE usuario_id IN (?) AND status = 'PENDENTE_ABONO'", [userIds]);
            console.log('Pending abonos for these users:', abonos);
        }
    } catch (err) {
        console.error(err);
    } finally {
        await connection.end();
    }
}

run();
