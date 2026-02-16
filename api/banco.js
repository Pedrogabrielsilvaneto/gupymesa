import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  const dbConfig = {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: 'GupyMesa', // <--- AQUI ESTAVA O ERRO
    port: 4000,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  };

  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);
    const { query, values } = req.body;
    const [rows] = await connection.execute(query, values);
    res.status(200).json({ data: rows, error: null });
  } catch (error) {
    console.error("Erro na API:", error);
    res.status(500).json({ data: null, error: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
