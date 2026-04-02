const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

async function checkData() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/frases?select=motivo`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await response.json();
    const counts = {};
    data.forEach(f => {
        const val = f.motivo || 'null';
        counts[val] = (counts[val] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.table(sorted.map(([motivo, count]) => ({ motivo, count })));
}

checkData();
