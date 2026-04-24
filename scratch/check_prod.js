

async function run() {
    const response = await fetch('https://gupymesa.vercel.app/api/banco', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            query: "SELECT data_referencia, SUM(quantidade) as total FROM producao WHERE data_referencia >= '2026-04-06' AND data_referencia <= '2026-04-12' GROUP BY data_referencia ORDER BY data_referencia", 
            values: [] 
        })
    });
    const result = await response.json();
    console.log("DB Result:", result);
}

run();
