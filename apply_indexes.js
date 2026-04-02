const fs = require('fs');
const path = require('path');

async function run() {
    const sqlFile = path.join(__dirname, 'migrations', '006_optimize_indexes.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Split by ; and filter valid statements
    const statements = sql
        .split(';')
        .map(s => s.replace(/--.*$/gm, '').trim()) // Remove comments and trim
        .filter(s => s.length > 5); // Ignore very short/empty statements

    console.log(`Starting execution of ${statements.length} statements...`);

    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`[${i+1}/${statements.length}] Executing: ${statement.substring(0, 100)}...`);
        try {
            const response = await fetch('https://gupymesa.vercel.app/api/banco', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: statement, values: [] })
            });
            const result = await response.json();
            if (result.error) {
                console.error(`  ❌ Error: ${result.error}`);
            } else {
                console.log(`  ✅ Success`);
            }
        } catch (e) {
            console.error(`  ❌ Fetch error: ${e.message}`);
        }
    }
}

run();
