import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const dbConfig = {
    host: process.env.TIDB_HOST?.trim(),
    user: process.env.TIDB_USER?.trim(),
    password: process.env.TIDB_PASSWORD?.trim(),
    database: (process.env.TIDB_DATABASE || 'GupyMesa').trim(),
    port: parseInt((process.env.TIDB_PORT || '4000').trim()),
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  };

  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const { query, values } = req.body;
    const [rows] = await connection.query(query, values);
    res.status(200).json({ data: rows, error: null });
  } catch (error) {
    console.error("Erro na API:", error);
    res.status(500).json({ data: null, error: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
