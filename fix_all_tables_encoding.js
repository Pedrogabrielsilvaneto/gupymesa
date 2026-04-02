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
    ['Ã', 'Ç'], // Visual representations from screenshot
    ['Ã\x83', 'Ã'],
    ['Ã\x82', 'Â'],
    ['Ã\x94', 'Ô'],
    ['Ã\xaa', 'ê'],
    ['Ã§Ã£o', 'ção'],
    ['Ãªn', 'ên'],
    ['Ãºm', 'úm'],
    ['Ã§Ãµ', 'çõ']
];

async function main() {
    console.log("🚀 Starting PHASE 2 Global Encoding Fix...");

    for (const [table, columns] of Object.entries(tableColumns)) {
        console.log(`Processing table: ${table}...`);
        for (const col of columns) {
            console.log(`  Updating column: ${col}...`);
            for (const [wrong, right] of replacements) {
                try {
                    // Optimized: only update if the pattern exists
                    const sql = `UPDATE ${table} SET ${col} = REPLACE(${col}, ?, ?) WHERE ${col} LIKE ?`;
                    await runQuery(sql, [wrong, right, `%${wrong}%`]);
                } catch (e) {
                    console.error(`Error updating ${table}.${col} for ${wrong}: ${e.message || e}`);
                }
            }
        }
    }

    console.log("✅ Finished Global Encoding Fix.");
}

main().catch(console.error);
