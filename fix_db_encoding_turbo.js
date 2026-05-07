const https = require('https');

async function runQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query: sql, values });
        const options = {
            hostname: 'gupymesa.vercel.app',
            port: 443,
            path: '/api/banco',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => { body += d; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed.data || parsed);
                } catch (e) {
                    reject(body);
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

const tableColumns = {
    'assertividade': [
        'empresa_nome', 'assistente_nome', 'auditora_nome', 'doc_name',
        'status', 'nome_ppc', 'observacao', 'fila', 'revalidacao',
        'tipo_documento'
    ],
    'empresas': ['nome'],
    'usuarios': ['nome', 'login', 'perfil', 'funcao', 'contrato', 'situacao'],
    'feedbacks': ['mensagem', 'nome_arquivo']
};

const replacements = [
    // Double byte patterns (UTF-8 read as ISO-8859-1)
    ['Ãº', 'ú'],
    ['Ãª', 'ê'],
    ['Ã§', 'ç'],
    ['Ã£', 'ã'],
    ['Ã¡', 'á'],
    ['Ã©', 'é'],
    ['Ã\xad', 'í'],
    ['Ã³', 'ó'],
    ['Ãµ', 'õ'],
    ['Ã¢', 'â'],
    ['Ã´', 'ô'],
    ['Ã ', 'à'],
    ['Ã\x87', 'Ç'],
    ['Ã\x8a', 'Ê'],
    ['Ã\x93', 'Ó'],
    ['Ã\x9a', 'Ú'],
    ['Ã\x81', 'Á'],
    ['Ã\x89', 'É'],
    ['Ã\x83', 'Ã'],
    ['NÃ\xba', 'Nú'],
    ['Ã‡', 'Ç'],
    ['Ã\x8a', 'Ê']
];

async function main() {
    console.log("🚀 Starting TURBO PHASE Global Encoding Fix (570k rows optimization)...");

    for (const [table, columns] of Object.entries(tableColumns)) {
        console.log(`Processing table: ${table}...`);
        for (const col of columns) {
            console.log(`  Fixing column: ${col}...`);
            
            // Build nested REPLACE query
            let queryText = col;
            for (const [wrong, right] of replacements) {
                // escape single quotes for SQL
                const w = wrong.replace(/'/g, "''");
                const r = right.replace(/'/g, "''");
                queryText = `REPLACE(${queryText}, '${w}', '${r}')`;
            }

            // TiDB supports REGEXP
            // Or just USE THE NESTED REPLACE globally for rows that match any bad char
            // For 570k rows, we must ensure we only update what's necessary to avoid redo log bloat
            
            const regex = replacements.map(r => r[0]).join('|').replace(/'/g, "''");
            const sql = `UPDATE ${table} SET ${col} = ${queryText} WHERE ${col} REGEXP '${regex}'`;
            
            try {
                console.time(`Column ${col}`);
                const res = await runQuery(sql);
                console.timeEnd(`Column ${col}`);
                console.log(`    Result: ${res.affectedRows || 'OK'}`);
            } catch (e) {
                console.error(`    Error fixing ${table}.${col}: ${e.message || e}`);
            }
        }
    }

    console.log("✅ TURBO Global Encoding Fix Finished.");
}

main().catch(console.error);
