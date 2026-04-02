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

async function main() {
    try {
        console.log("Adding trocar_senha column...");
        // TiDB usually supports ADD COLUMN IF NOT EXISTS in newer versions, 
        // but if it fails we'll know it already exists.
        try {
            await runQuery("ALTER TABLE usuarios ADD COLUMN trocar_senha TINYINT(1) DEFAULT 0");
            console.log("Column added.");
        } catch (e) {
            console.log("Column might already exist or error adding it.");
        }

        const defaultHash = '5288ecc080289ccf2779024341ec7572a4f46e12523a6e1d6be74cba5ea83aa7';
        console.log(`Setting trocar_senha = 1 for users with password = ${defaultHash}...`);
        await runQuery("UPDATE usuarios SET trocar_senha = 1 WHERE senha = ?", [defaultHash]);
        console.log("Updated users with default password.");

        // Also check if there's an OLD default password or unencrypted ones
        await runQuery("UPDATE usuarios SET trocar_senha = 1 WHERE senha = 'gupy123' OR senha IS NULL OR senha = ''");
        console.log("Updated users with missing or plain text default password.");

    } catch (e) {
        console.error("Migration failed:", e);
    }
}

main();
