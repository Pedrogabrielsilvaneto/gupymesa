const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkColumns() {
  const dbConfig = {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE || 'GupyMesa',
    port: parseInt(process.env.TIDB_PORT || '4000'),
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.query('DESCRIBE frases');
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    if (connection) await connection.end();
  }
}

checkColumns();
