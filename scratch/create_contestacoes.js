const mysql = require('mysql2/promise');
require('dotenv').config();

async function createTable() {
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
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contestacoes_assertividade (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        usuario_nome VARCHAR(255),
        data_referencia DATE NOT NULL,
        semana_inicio DATE NOT NULL,
        semana_fim DATE NOT NULL,
        mensagem TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDENTE',
        resposta_auditora TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        respondido_em DATETIME
      )
    `);
    
    console.log("✅ Tabela contestacoes_assertividade criada com sucesso!");
    
    // Verify
    const [rows] = await connection.query('DESCRIBE contestacoes_assertividade');
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    if (connection) await connection.end();
  }
}

createTable();
