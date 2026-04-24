
const SUPABASE_URL = 'https://btzdlrjqdzisvyskskeb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0emRscmpxZHppc3Z5c2tza2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzIzNDEsImV4cCI6MjA4MjcwODM0MX0.k49GeqGXUP2c3wR9Jo0vJgTdYl1DZumi7s17sGArIQE';

async function checkFrases() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/frases?limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    console.log('Result from btzdlrjqdzisvyskskeb:', res.status, res.ok ? 'OK' : 'FAIL');
}

checkFrases();
