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

        // Identificando registros de MARÇO (conforme screenshots do usuário)
        const [abonos] = await c.query(
            "SELECT id, data_referencia, quantidade FROM producao WHERE usuario_id = ? AND mes_referencia = 3 AND ano_referencia = 2026 AND (fator < 1.0 OR status = 'PENDENTE_ABONO')",
            [userId]
        );

        if (abonos.length === 0) {
            console.log("Nenhum abono encontrado em Março/2026 para Pedro Gabriel.");
        } else {
            console.log(`Encontrados ${abonos.length} registros em Março.`);
            for (const a of abonos) {
                if (parseInt(a.quantidade) === 0) {
                    await c.query("DELETE FROM producao WHERE id = ?", [a.id]);
                    console.log(`Deletado registro de ${a.data_referencia}`);
                } else {
                    await c.query("UPDATE producao SET fator = 1.0, status = 'OK', justificativa = NULL WHERE id = ?", [a.id]);
                    console.log(`Resetado fator para 1.0 no dia ${a.data_referencia} (possuía produção: ${a.quantidade})`);
                }
            }
            console.log("Operação em Março concluída.");
        }
        
        await c.end();
    } catch (e) {
        console.error("Erro:", e.message);
    }
}

run();
