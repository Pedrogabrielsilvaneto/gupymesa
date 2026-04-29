import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const dbConfig = {
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE || 'GupyMesa',
        port: parseInt(process.env.TIDB_PORT || '4000'),
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    };

    try {
        const c = await mysql.createConnection(dbConfig);
        const userId = '1185327'; // Pedro Gabriel Silva Neto

        console.log("--- ABONOS EM MARÇO ---");
        const [marzo] = await c.query(
            "SELECT id, data_referencia, status, fator, justificativa, observacao_assistente FROM producao WHERE usuario_id = ? AND mes_referencia = 3 AND ano_referencia = 2026 AND (fator < 1.0 OR status = 'PENDENTE_ABONO')",
            [userId]
        );
        console.log(marzo);

        console.log("\n--- ABONOS EM ABRIL ---");
        const [abril] = await c.query(
            "SELECT id, data_referencia, status, fator, justificativa, observacao_assistente FROM producao WHERE usuario_id = ? AND mes_referencia = 4 AND ano_referencia = 2026 AND (fator < 1.0 OR status = 'PENDENTE_ABONO')",
            [userId]
        );
        console.log(abril);
        
        await c.end();
    } catch (e) {
        console.error("Erro:", e.message);
    }
}

run();
