
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

async function listAllTables() {
    // Try to use a common trick: query a non-existent table and hope the error message or some RPC gives us info
    // Or just try to query information_schema (usually blocked for anon)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_KEY}`);
    if (res.ok) {
        const data = await res.json();
        console.log('Tables found in OpenAPI spec:', data.definitions ? Object.keys(data.definitions) : 'none');
    } else {
        console.log('Error getting OpenAPI spec');
    }
}

listAllTables();
