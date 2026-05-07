
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

async function backupFrases() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/frases?select=*`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    console.log(`Found ${data.length} phrases.`);
    require('fs').writeFileSync('c:/Users/Pedro Neto/Desktop/APLICATIVOS/GupyMesa/gupymesa/gupymesa_v2/scratch/frases_backup.json', JSON.stringify(data, null, 2));
}

backupFrases();
