require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrateAvatar() {
    console.log("🚀 Iniciando migração para adicionar avatar_url...");

    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT || 4000,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        await connection.query("ALTER TABLE usuarios ADD COLUMN avatar_url TEXT");
        console.log("✅ Coluna 'avatar_url' adicionada com sucesso!");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            console.log("⚠️ Coluna 'avatar_url' já existe.");
        } else {
            console.error("❌ Erro ao adicionar coluna:", err);
        }
    } finally {
        await connection.end();
        console.log("🔌 Conexão encerrada.");
    }
}

migrateAvatar();
