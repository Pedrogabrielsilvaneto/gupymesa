
export default async function handler(req, res) {
  const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';

  const { action, table, data, id, queryParams } = req.body;

  try {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    let method = 'GET';
    let headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    if (action === 'select') {
      method = 'GET';
      let params = new URLSearchParams(queryParams || {});
      url += `?${params.toString()}`;
    } else if (action === 'insert') {
      method = 'POST';
    } else if (action === 'update') {
      method = 'PATCH';
      url += `?id=eq.${id}`;
    } else if (action === 'delete') {
      method = 'DELETE';
      url += `?id=eq.${id}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: (method !== 'GET' && method !== 'DELETE') ? JSON.stringify(data) : undefined
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Erro na comunicação com Supabase');
    }

    res.status(200).json({ data: result, error: null });
  } catch (error) {
    console.error("Erro no Proxy Biblioteca:", error);
    res.status(500).json({ data: null, error: error.message });
  }
}
