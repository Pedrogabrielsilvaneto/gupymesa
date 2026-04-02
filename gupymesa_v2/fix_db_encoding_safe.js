const https = require('https');

async function runQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
        // Explicitly stringify and ensure UTF-8
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
    console.log("Applying byte-safe SQL fixes to Empresas table...");
    
    // Instead of sending the character in the values, we can use CHAR() for everything.
    // e.g., UPDATE empresas SET nome = REPLACE(nome, CONCAT(CHAR(0xC3), CHAR(0xA1)), CHAR(0xE1))
    // Actually CHAR(0xE1) in a utf8mb4 table might fail if not cast to binary.
    
    const fixes = [
        ['á', 0xC3, 0xA1, 0xE1],
        ['é', 0xC3, 0xA9, 0xE9],
        ['í', 0xC3, 0xAD, 0xED],
        ['ó', 0xC3, 0xB3, 0xF3],
        ['ú', 0xC3, 0xBA, 0xFA],
        ['ã', 0xC3, 0xA3, 0xE3],
        ['õ', 0xC3, 0xB5, 0xF5],
        ['ç', 0xC3, 0xA7, 0xE7],
        ['ê', 0xC3, 0xAA, 0xEA],
        ['ô', 0xC3, 0xB4, 0xF4],
    ];

    for (const [char, b1, b2, targetByte] of fixes) {
        // We'll use CAST(CHAR(...) AS CHAR CHARACTER SET utf8mb4) to be safe
        const sql = `UPDATE empresas SET nome = REPLACE(nome, CONCAT(CHAR(${b1}), CHAR(${b2})), ?)`;
        try {
            await runQuery(sql, [char]);
            console.log(`Success fixing double-encoded character: ${char}`);
        } catch (e) {
            console.error(`Error fixing character: ${char}`, e);
        }
    }
}

main();
