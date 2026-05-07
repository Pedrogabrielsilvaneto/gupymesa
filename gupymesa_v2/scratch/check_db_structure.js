
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

async function listTables() {
    // There isn't a direct public API to list tables without admin privileges, 
    // but we can try to query some common tables or check if we can get information_schema (unlikely via anon key)
    // Alternatively, we can try to query 'frases' to see its columns.
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/frases?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Range-Unit': 'items'
        }
    });

    if (response.ok) {
        const data = await response.json();
        console.log('Columns in frases:', Object.keys(data[0] || {}));
    } else {
        console.log('Error querying frases:', await response.text());
    }

    // Try to see if there is a 'favoritos' table
    const resFav = await fetch(`${SUPABASE_URL}/rest/v1/favoritos?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    console.log('Favoritos table exists?', resFav.ok);
    if (resFav.ok) {
        const dataFav = await resFav.json();
        console.log('Columns in favoritos:', Object.keys(dataFav[0] || {}));
    }

    // Try to see if there is a 'frases_usos' table
    const resUsos = await fetch(`${SUPABASE_URL}/rest/v1/frases_usos?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    console.log('Frases_usos table exists?', resUsos.ok);
}

listTables();
