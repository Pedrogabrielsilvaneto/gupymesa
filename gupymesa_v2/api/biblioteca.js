import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  // Limpando possíveis espaços ou quebras de linha nas variáveis de ambiente
  const dbConfig = {
    host: (process.env.TIDB_HOST || '').trim(),
    user: (process.env.TIDB_USER || '').trim(),
    password: (process.env.TIDB_PASSWORD || '').trim(),
    database: (process.env.TIDB_DATABASE || 'GupyMesa').trim(),
    port: parseInt(process.env.TIDB_PORT || '4000'),
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  };

  const { action, table, data, id, queryParams } = req.body;
  let connection;

  try {
    connection = await mysql.createConnection(dbConfig);

    if (table === 'frases') {
      if (action === 'select') {
        const [rows] = await connection.query('SELECT * FROM frases');
        return res.status(200).json({ data: rows, error: null });
      } 
      
      if (action === 'update') {
        const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(data), id];
        await connection.query(`UPDATE frases SET ${fields} WHERE id = ?`, values);
        return res.status(200).json({ data: { id }, error: null });
      }

      if (action === 'insert') {
        const fields = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const [result] = await connection.query(`INSERT INTO frases (${fields}) VALUES (${placeholders})`, Object.values(data));
        return res.status(200).json({ data: { id: result.insertId }, error: null });
      }

      if (action === 'delete') {
        await connection.query('DELETE FROM frases WHERE id = ?', [id]);
        return res.status(200).json({ data: { success: true }, error: null });
      }
    }

    if (table === 'frases_favoritas') {
      if (action === 'select') {
        const { usuario_id } = queryParams;
        const [rows] = await connection.query('SELECT frase_id FROM frases_favoritas WHERE usuario_id = ?', [usuario_id]);
        return res.status(200).json({ data: rows, error: null });
      }

      if (action === 'insert') {
        await connection.query('INSERT IGNORE INTO frases_favoritas (usuario_id, frase_id) VALUES (?, ?)', [data.usuario_id, data.frase_id]);
        return res.status(200).json({ data: { success: true }, error: null });
      }

      if (action === 'delete') {
        const { usuario_id, frase_id } = queryParams;
        await connection.query('DELETE FROM frases_favoritas WHERE usuario_id = ? AND frase_id = ?', [usuario_id, frase_id]);
        return res.status(200).json({ data: { success: true }, error: null });
      }
    }

    if (table === 'logs') {
      if (action === 'insert') {
        await connection.query('INSERT INTO logs (usuario, acao, detalhe, data_hora) VALUES (?, ?, ?, ?)', [data.usuario, data.acao, data.detalhe, data.data_hora]);
        return res.status(200).json({ data: { success: true }, error: null });
      }
    }

    if (table === 'view_usos_pessoais') {
      if (action === 'select') {
        const { usuario } = queryParams;
        const [rows] = await connection.query('SELECT detalhe as frase_id, COUNT(*) as qtd_uso FROM logs WHERE acao = "COPIAR" AND usuario = ? GROUP BY detalhe', [usuario]);
        return res.status(200).json({ data: rows, error: null });
      }
    }

    if (table === 'empresas') {
      if (action === 'select') {
        const [rows] = await connection.query('SELECT * FROM empresas');
        return res.status(200).json({ data: rows, error: null });
      }
    }

    res.status(400).json({ data: null, error: 'Ação ou tabela inválida' });

  } catch (error) {
    console.error("Erro na API Biblioteca (TiDB):", error);
    res.status(500).json({ data: null, error: error.message });
  } finally {
    if (connection) await connection.end();
  }
}
