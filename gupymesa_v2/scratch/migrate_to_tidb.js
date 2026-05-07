
const mysql = require('mysql2/promise');
const fs = require('fs');

const dbConfig = {
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    user: '3CmQF29BCKpLVQv.root',
    password: 'NjiqHJc2ojeBJEqt',
    database: 'GupyMesa',
    port: 4000,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
};

async function migrateToTiDB() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to TiDB.');

        // 1. Create Tables
        await connection.query(`
            CREATE TABLE IF NOT EXISTS frases (
                id INT AUTO_INCREMENT PRIMARY KEY,
                conteudo TEXT NOT NULL,
                empresa VARCHAR(255),
                documento VARCHAR(255),
                motivo VARCHAR(255),
                usos INT DEFAULT 0,
                ultimo_uso DATETIME,
                revisado_por VARCHAR(255),
                data_revisao DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS frases_favoritas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario_id VARCHAR(255) NOT NULL,
                frase_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_fav (usuario_id, frase_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                usuario VARCHAR(255) NOT NULL,
                acao VARCHAR(255) NOT NULL,
                detalhe TEXT,
                data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log('Tables created or already exist.');

        // 2. Load Phrases
        const backupPath = 'c:/Users/Pedro Neto/Desktop/APLICATIVOS/GupyMesa/gupymesa/gupymesa_v2/scratch/frases_backup.json';
        if (!fs.existsSync(backupPath)) {
            console.error('Backup file not found!');
            return;
        }
        const phrases = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        console.log(`Migrating ${phrases.length} phrases...`);

        // 3. Clear and Insert Phrases
        // (Better not to clear if we want to avoid downtime, but since we are migrating, we should probably start fresh or use INSERT IGNORE)
        // For safety, let's use INSERT INTO and check for duplicates by content if needed, 
        // but since this is a migration, I'll clear first.
        await connection.query('TRUNCATE TABLE frases');

        for (const f of phrases) {
            await connection.query(
                'INSERT INTO frases (id, conteudo, empresa, documento, motivo, usos, ultimo_uso, revisado_por, data_revisao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [f.id, f.conteudo, f.empresa, f.documento, f.motivo, f.usos || 0, f.ultimo_uso, f.revisado_por, f.data_revisao]
            );
        }

        console.log('Migration complete!');

    } catch (e) {
        console.error('Error during migration:', e);
    } finally {
        if (connection) await connection.end();
    }
}

migrateToTiDB();
