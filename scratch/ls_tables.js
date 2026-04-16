const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(tables);
    await connection.end();
})();
