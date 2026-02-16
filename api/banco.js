// Arquivo: /api/banco.js
import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Configura a conexão com as variáveis que vamos colocar na Vercel
  const dbConfig = {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: 'performance_pro',
    port: 4000,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  };

  let connection;

  try {
    // Cria a conexão
    connection = await mysql.createConnection(dbConfig);
    
    // Pega a query enviada pelo frontend
    const { query, values } = req.body;

    // Executa no banco
    const [rows] = await connection.execute(query, values);
    
    // Retorna o resultado
    res.status(200).json({ data: rows, error: null });

  } catch (error) {
    console.error("Erro na API:", error);
    res.status(500).json({ data: null, error: error.message });
  } finally {
    // Sempre fecha a conexão para não travar o banco
    if (connection) await connection.end();
  }
}