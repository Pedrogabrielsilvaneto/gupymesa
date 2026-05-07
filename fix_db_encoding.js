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
                'Content-Length': data.length
            }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => { body += d; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve(parsed.data);
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

const map = {
    'á': 'á', 'é': 'é', 'Ã\xad': 'í', 'ó³': 'ó', 'úº': 'ú',
    'ã£': 'ã', 'õµ': 'õ', 'ç§': 'ç', 'êª': 'ê', 'ô´': 'ô',
    'Ã\x81': 'Á', 'Ã\x89': 'É', 'Ã\x8d': 'Í', 'Ã\x93': 'Ó', 'Ã\x9a': 'Ú',
    'Ã\x83': 'Ã', 'Ã\x95': 'Õ', 'Ã\x87': 'Ç',
    '': 'ã', // This is common in double-broken
};

// Actually, in the DB result, we saw "Peas".
// The safest way to fix the DB is to use Latin1 interpreted as UTF8 if TiDB supports it, 
// but since we are using an API, we can do it in Node.

async function main() {
    console.log("Fetching all companies...");
    const companies = await runQuery("SELECT id, nome FROM empresas");
    
    for (const c of companies) {
        if (!c.nome) continue;
        
        let newName = c.nome;
        // Fix common Latin-1 characters that were stored as invalid UTF-8 bytes
        // These often appear as '' in the terminal but we need to know the raw byte.
        // Since we can't easily see the raw byte here, we'll try common replacements.
        
        // Convert the string to a Buffer and back if it's actually Latin-1
        // (Actually, Node's "utf8" reading might have already replaced them with U+FFFD)
        // If it replaced them with U+FFFD (), we lost the data.
        // Let's check if the API returns them as escaped or something.
        
        // Wait, if it shows "", it might be that the API is sending invalid UTF-8 and the browser/node is replacing it.
        
        // Let's try a different approach: SQL REPLACE for the most common ones.
        // In TiDB/MySQL: REPLACE(nome, CHAR(0xC7), 'Ç') etc.
    }
    
    console.log("Fixing common patterns in DB via SQL...");
    const fixes = [
        ['ç', 0xC7], ['Ç', 0xC7], // Wait, check case
        ['ã', 0xE3], ['Ã', 0xC3],
        ['õ', 0xF5], ['Õ', 0xD5],
        ['á', 0xE1], ['Á', 0xC1],
        ['é', 0xE9], ['É', 0xC9],
        ['í', 0xED], ['Í', 0xCD],
        ['ó', 0xF3], ['Ó', 0xD3],
        ['ú', 0xFA], ['Ú', 0xDA],
        ['ê', 0xEA], ['Ê', 0xCA],
        ['ô', 0xF4], ['Ô', 0xD4],
        ['à', 0xE0], ['À', 0xC0],
    ];

    // Some systems store "ã£" as two bytes which is actually "ã" in UTF-8
    // If the DB has literally "á", then it's double encoded.
    
    // Let's fix DOUBLE ENCODING in the DB first (Usuários -> Usuários)
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'á', 'á')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'é', 'é')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'Ã\xad', 'í')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'ó³', 'ó')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'úº', 'ú')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'ã£', 'ã')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'õµ', 'õ')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'ç§', 'ç')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'êª', 'ê')`);
    await runQuery(`UPDATE empresas SET nome = REPLACE(nome, 'ô´', 'ô')`);
    
    console.log("DB fixes applied.");
}

main();
