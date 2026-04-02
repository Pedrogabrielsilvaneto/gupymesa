const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    port: process.env.TIDB_PORT || 4000,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
};

async function debug() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const ids = ['1074356', '446934', '446949', '432243'];
        console.log('--- Status dos Usuários Críticos ---');
        const [users] = await conn.execute(`SELECT id, nome, perfil, funcao, ativo FROM usuarios WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
        console.table(users);

        console.log('\n--- Produção Mensal (Jan 2026) ---');
        const [prod] = await conn.execute(`
            SELECT usuario_id, SUM(quantidade) as total 
            FROM producao 
            WHERE data_referencia >= '2026-01-01' AND data_referencia <= '2026-01-31' 
            AND usuario_id IN (${ids.map(() => '?').join(',')})
            GROUP BY usuario_id
        `, ids);
        console.table(prod);

        console.log('\n--- Configuração de Config_Mes (Jan 2026) ---');
        const [config] = await conn.execute('SELECT * FROM config_mes WHERE mes = 1 AND ano = 2026');
        console.table(config);

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await conn.end();
    }
}

debug();
