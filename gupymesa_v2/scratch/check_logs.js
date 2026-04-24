
const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

async function checkLogs() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/logs?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    if (response.ok) {
        const data = await response.json();
        console.log('Columns in logs:', Object.keys(data[0] || {}));
    } else {
        console.log('Error querying logs:', await response.text());
    }

    // Check if view_usos_pessoais exists
    const resView = await fetch(`${SUPABASE_URL}/rest/v1/view_usos_pessoais?limit=1`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    console.log('view_usos_pessoais exists?', resView.ok);
    if (resView.ok) {
        const dataView = await resView.json();
        console.log('Columns in view_usos_pessoais:', Object.keys(dataView[0] || {}));
    }
}

checkLogs();
