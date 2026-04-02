import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.TIDB_HOST,
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE || 'GupyMesa',
  port: parseInt(process.env.TIDB_PORT) || 4000,
  charset: 'utf8mb4',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Singleton pool
let pool;

export async function executeQuery(sql, values = []) {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  
  try {
    const [rows] = await pool.query(sql, values);
    return rows;
  } catch (error) {
    console.error("DB Execute Error:", error);
    throw error;
  }
}
