require('dotenv').config();
const mysql = require('mysql2/promise');

async function modifySchema() {
    console.log("🚀 Iniciando alteração de schema (TiDB)...");

    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT || 4000,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        // Altera url_midia para LONGTEXT (permite strings gigantes, aka Base64)
        await connection.query("ALTER TABLE feedbacks MODIFY COLUMN url_midia LONGTEXT");
        console.log("✅ Coluna 'url_midia' alterada para LONGTEXT com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao alterar coluna:", err);
    } finally {
        await connection.end();
        console.log("🔌 Conexão encerrada.");
    }
}

modifySchema();
