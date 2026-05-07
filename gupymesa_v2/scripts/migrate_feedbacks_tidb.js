require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function migrate() {
    console.log("🚀 Iniciando migração para TiDB...");

    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT || 4000,
        ssl: {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        }
    });

    console.log("✅ Conectado ao TiDB!");

    const createTableSQL = `
    CREATE TABLE IF NOT EXISTS feedbacks (
        id CHAR(36) NOT NULL DEFAULT (UUID()),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        remetente_id VARCHAR(255) NOT NULL,
        destinatario_id VARCHAR(255),
        tipo_destinatario ENUM('INDIVIDUAL', 'EQUIPE', 'TODOS') NOT NULL,
        mensagem TEXT,
        tipo_midia ENUM('TEXTO', 'IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO') DEFAULT 'TEXTO',
        url_midia TEXT,
        nome_arquivo TEXT,
        lido TINYINT(1) DEFAULT 0,
        PRIMARY KEY (id),
        INDEX idx_remetente (remetente_id),
        INDEX idx_destinatario (destinatario_id),
        INDEX idx_data (created_at DESC)
    );`;

    try {
        await connection.query(createTableSQL);
        console.log("✅ Tabela 'feedbacks' criada/verificada com sucesso.");
    } catch (err) {
        console.error("❌ Erro ao criar tabela:", err);
    } finally {
        await connection.end();
        console.log("🔌 Conexão encerrada.");
    }
}

migrate();
