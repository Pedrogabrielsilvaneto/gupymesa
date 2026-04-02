const https = require('https');

async function runQuery(sql, values = []) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query: sql, values });
        const options = {
            hostname: 'gupymesa.vercel.app', port: 443, path: '/api/banco', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
        };
        const req = https.request(options, (res) => {
            let b = ''; res.on('data', (d) => { b += d; });
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(b);
                try { resolve(JSON.parse(b).data); } catch (e) { reject(b); }
            });
        });
        req.on('error', reject); req.write(data); req.end();
    });
}

async function main() {
    console.log("Fixing ARTVEL specifically...");
    // 67390: 0001 - ARTVEL VEICULOS PEÇAS E SERVIÇOS
    await runQuery("UPDATE empresas SET nome = '0001 - ARTVEL VEICULOS PEÇAS E SERVIÇOS' WHERE id = 67390");
    console.log("Fixed ARTVEL.");
}
main();
