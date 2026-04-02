const mysql = require('mysql2/promise');
require('dotenv').config({ path: 'c:/Users/Pedro Neto/.gemini/antigravity/scratch/gupymesa_deploy/.env' });

async function main() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    try {
        const merges = [
            { keepId: '1074356', oldId: '980580', nome: 'Roberta Santos' },
            { keepId: '1157276', oldId: '980578', nome: 'Debora Braz' },
            { keepId: '1157277', oldId: '980577', nome: 'Thayla Hupert' }
        ];

        console.log("Iniciando Merge de Dados...");

        for (const m of merges) {
            console.log(`Processando ${m.nome} (Transferindo ${m.oldId} -> ${m.keepId})...`);

            // 1. Move Produção (se houver alguma no antigo)
            const [rp] = await connection.execute(
                `UPDATE producao SET usuario_id = ? WHERE usuario_id = ?`,
                [m.keepId, m.oldId]
            );
            console.log(` - Produção: ${rp.affectedRows} registros movidos.`);

            // 2. Move Assertividade
            const [ra] = await connection.execute(
                `UPDATE assertividade SET usuario_id = ? WHERE usuario_id = ?`,
                [m.keepId, m.oldId]
            );
            console.log(` - Assertividade: ${ra.affectedRows} registros movidos.`);

            // 3. Move Metas
            const [rm] = await connection.execute(
                `UPDATE metas SET usuario_id = ? WHERE usuario_id = ?`,
                [m.keepId, m.oldId]
            );
            console.log(` - Metas: ${rm.affectedRows} registros movidos.`);
            
            // 4. Move Checkins
            const [rc] = await connection.execute(
                `UPDATE checkin_diario SET usuario_uid = ? WHERE usuario_uid = ?`,
                [m.keepId, m.oldId]
            );
            console.log(` - Checkins: ${rc.affectedRows} registros movidos.`);

            // 5. Ajusta status na tabela usuarios
            // Set correct to Ativo
            await connection.execute(
                `UPDATE usuarios SET ativo = 1 WHERE id = ?`,
                [m.keepId]
            );
            // Set old to Inativo and rename to avoid confusion in cache
            await connection.execute(
                `UPDATE usuarios SET ativo = 0, nome = CONCAT('DUP - ', nome) WHERE id = ?`,
                [m.oldId]
            );
            console.log(` - Status de usuários atualizado.`);
        }

        console.log("Merge concluído com sucesso!");
    } catch (err) {
        console.error("Erro durante o merge:", err);
    } finally {
        await connection.end();
    }
}

main();
