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
                if (res.statusCode !== 200) return reject(body);
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

async function main() {
    console.log("Applying SQL fixes to Empresas table...");
    
    // Using CONCAT(CHAR(0xC3), CHAR(0xA1)) instead of 'Ã¡' to avoid JSON encoding issues
    const fixes = [
        ['á', 0xC3, 0xA1],
        ['é', 0xC3, 0xA9],
        ['í', 0xC3, 0xAD],
        ['ó', 0xC3, 0xB3],
        ['ú', 0xC3, 0xBA],
        ['ã', 0xC3, 0xA3],
        ['õ', 0xC3, 0xB5],
        ['ç', 0xC3, 0xA7],
        ['ê', 0xC3, 0xAA],
        ['ô', 0xC3, 0xB4],
    ];

    for (const [char, b1, b2] of fixes) {
        const sql = `UPDATE empresas SET nome = REPLACE(nome, CONCAT(CHAR(${b1}), CHAR(${b2})), ?)`;
        try {
            await runQuery(sql, [char]);
            console.log(`Fixed ${char} (double encoded)`);
        } catch (e) {
            console.error(`Error fixing ${char}:`, e);
        }
    }

    // Now fix individual Latin-1 bytes stored in UTF-8 table (shows as replacement char)
    // This is harder because MySQL/TiDB might not allow finding them easily with CHAR() if collation is utf8mb4.
    // However, if they are stored as invalid bytes, we can try to binary match them.
}

main();
