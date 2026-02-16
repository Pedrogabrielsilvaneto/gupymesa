// Usando fetch nativo do Node 18+

const API_URL = 'https://gupymesa.vercel.app/api/banco';

async function query(sql, params = []) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, values: params })
        });
        const result = await response.json();
        return result.data;
    } catch (e) {
        console.error("Error:", e.message);
        return null;
    }
}

async function run() {
    console.log("🔍 DIAGNÓSTICO DE DADOS ASSERTIVIDADE 🔍");

    const users = await query("SELECT id, nome FROM usuarios LIMIT 5");
    console.log("\n--- AMOSTRA USUÁRIOS (Tabela usuarios) ---");
    console.table(users);

    const assertSample = await query("SELECT usuario_id, assistente_nome, assertividade_val, porcentagem_assertividade, data_referencia FROM assertividade WHERE assertividade_val IS NOT NULL LIMIT 5");
    console.log("\n--- AMOSTRA ASSERTIVIDADE (Com valor preenchido) ---");
    console.table(assertSample);

    const assertNulls = await query("SELECT COUNT(*) as qtd FROM assertividade WHERE assertividade_val IS NULL");
    const assertTotal = await query("SELECT COUNT(*) as qtd FROM assertividade");
    console.log(`\n--- ESTATÍSTICAS ---`);
    console.log(`Total de registros: ${assertTotal[0].qtd}`);
    console.log(`Registros com assertividade_val NULL: ${assertNulls[0].qtd}`);

    const range = { inicio: '2026-01-01', fim: '2026-01-31' };
    const appSql = `
        SELECT CAST(usuario_id AS CHAR) as usuario_id, 
               COUNT(*) as qtd_auditorias, 
               AVG(assertividade_val) as media_assertividade
        FROM assertividade
        WHERE data_referencia >= ? AND data_referencia <= ?
          AND (auditora_nome IS NOT NULL OR assertividade_val IS NOT NULL)
        GROUP BY usuario_id
    `;
    const appResult = await query(appSql, [range.inicio, range.fim]);
    console.log("\n--- RESULTADO DA QUERY DO APP (Janeiro/2026) ---");
    console.table(appResult);

    const totalAssertJan = await query(`
        SELECT COUNT(*) as qtd FROM assertividade 
        WHERE data_referencia >= '2026-01-01' AND data_referencia <= '2026-01-31'
    `);
    console.log(`Total de registros assertividade em Janeiro: ${totalAssertJan[0].qtd}`);
}

run();
