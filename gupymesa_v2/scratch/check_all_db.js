
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24pLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

async function checkAllColumns() {
    // Try to get one row and see all keys
    const resLogs = await fetch(`${SUPABASE_URL}/rest/v1/logs?limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (resLogs.ok) {
        const data = await resLogs.json();
        console.log('Logs columns:', data[0] ? Object.keys(data[0]) : 'no data');
    }

    const resFrases = await fetch(`${SUPABASE_URL}/rest/v1/frases?limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    if (resFrases.ok) {
        const data = await resFrases.json();
        console.log('Frases columns:', data[0] ? Object.keys(data[0]) : 'no data');
    }
    
    // Check if there is a 'frases_favoritas' table or similar by trying to query it
    const tablesToTry = ['frases_favoritas', 'biblioteca_favoritos', 'user_favorites', 'favoritos_frases'];
    for (const table of tablesToTry) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        console.log(`Table ${table} exists?`, res.ok);
        if (res.ok) {
            const data = await res.json();
            console.log(`${table} columns:`, data[0] ? Object.keys(data[0]) : 'no data');
        }
    }
}

checkAllColumns();
