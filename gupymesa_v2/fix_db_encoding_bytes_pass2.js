const https = require('https');

async function runQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ query: sql, values });
        const options = {
            hostname: 'gupymesa.vercel.app',
            port: 443,
            path: '/api/banco',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };
        const req = https.request(options, (res) => {
            let resBody = '';
            res.on('data', (d) => { resBody += d; });
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(`Error ${res.statusCode}: ${resBody}`);
                try {
                    const parsed = JSON.parse(resBody);
                    resolve(parsed.data);
                } catch (e) {
                    reject(`Invalid JSON: ${resBody}`);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    console.log("Applying pass 2 (Latin1 bytes) SQL fixes to Empresas table...");
    
    // Using CAST(X AS BINARY) can help find those specific broken bytes.
    // e.g., UPDATE empresas SET nome = REPLACE(nome, CHAR(0xC7), 'Ç')
    
    const fixes = [
        ['á', 0xE1], ['Á', 0xC1],
        ['é', 0xE9], ['É', 0xC9],
        ['í', 0xED], ['Í', 0xCD],
        ['ó', 0xF3], ['Ó', 0xD3],
        ['ú', 0xFA], ['Ú', 0xDA],
        ['ã', 0xE3], ['Ã', 0xC3],
        ['õ', 0xF5], ['Õ', 0xD5],
        ['ç', 0xE7], ['Ç', 0xC7],
        ['ê', 0xEA], ['Ê', 0xCA],
        ['ô', 0xF4], ['Ô', 0xD4],
        ['à', 0xE0], ['À', 0xC0]
    ];

    for (const [char, byte] of fixes) {
        // TiDB handles CHAR(X) as bytes.
        const sql = `UPDATE empresas SET nome = REPLACE(nome, CHAR(${byte}), ?)`;
        try {
            await runQuery(sql, [char]);
            console.log(`Success fixing Latin-1 byte for: ${char}`);
        } catch (e) {
            console.error(`Error fixing byte for: ${char}`, e);
        }
    }
}

main();
