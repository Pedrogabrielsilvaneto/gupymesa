import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const c = await mysql.createConnection({
        host: process.env.TIDB_HOST, user: process.env.TIDB_USER, password: process.env.TIDB_PASSWORD,
        database: 'GupyMesa', port: 4000, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    // mock the query
    const [dataMetas] = await c.query('SELECT usuario_id, mes, ano, meta_producao, meta_assertividade FROM metas');

    const item = { uid: '1185327' }; // Pedro
    const reqMes = 1;
    const reqAno = 2026;

    const userMetas = dataMetas.filter(m => String(m.usuario_id) === String(item.uid));
    let metasDoMes = userMetas.filter(m => m.mes == reqMes && m.ano == reqAno);
    let metaObj = null;

    if (metasDoMes.length > 0) {
        metaObj = metasDoMes.reverse().find(m => m.meta_producao !== null && m.meta_producao !== undefined) || metasDoMes[0];
    }

    if (!metaObj || (metaObj.meta_producao === null && metaObj.meta_prod === null)) {
        const metasAnteriores = userMetas
            .filter(m => (m.ano < reqAno || (m.ano === reqAno && m.mes < reqMes)) && (m.meta_producao !== null || m.meta_prod !== null))
            .sort((a, b) => (b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes));

        if (metasAnteriores.length > 0) {
            metaObj = metasAnteriores[0];
        }
    }

    const safeMetaProd = metaObj ? (metaObj.meta_producao !== null && metaObj.meta_producao !== undefined ? Number(metaObj.meta_producao) : (metaObj.meta_prod !== null && metaObj.meta_prod !== undefined ? Number(metaObj.meta_prod) : null)) : null;

    console.log('Result for Pedro:', { safeMetaProd, metaObj });

    await c.end();
}
run();
