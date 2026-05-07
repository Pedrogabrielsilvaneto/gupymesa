const https = require('https');

const data = JSON.stringify({
    query: "SHOW COLUMNS FROM usuarios",
    values: []
});

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
            console.log(JSON.stringify(parsed.data, null, 2));
        } catch (e) {
            console.error(body);
        }
    });
});

req.on('error', (e) => { console.error(e); });
req.write(data);
req.end();
