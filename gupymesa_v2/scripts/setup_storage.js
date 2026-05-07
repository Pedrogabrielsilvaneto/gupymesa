const SUPABASE_URL = "https://btzdlrjqdzisvyskskeb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0emRscmpxZHppc3Z5c2tza2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzIzNDEsImV4cCI6MjA4MjcwODM0MX0.k49GeqGXUP2c3wR9Jo0vJgTdYl1DZumi7s17sGArIQE"; // Anon Key

async function checkStorage() {
    console.log("📦 Verificando Storage Bucket 'chat-files' (via REST API)...");

    try {
        // Tenta listar arquivos no bucket 'chat-files' para ver se existe/é acessível
        const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket/chat-files`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY
            }
        });

        if (response.ok) {
            console.log("✅ Bucket 'chat-files' encontrado e acessível!");
            const data = await response.json();
            console.log("ℹ️ Info:", data);
        } else {
            console.error(`❌ Erro ao acessar bucket: ${response.status} ${response.statusText}`);
            const err = await response.json();
            console.error("Detalhes:", err);

            if (response.status === 404 || (err.message && err.message.includes('not found'))) {
                console.log("\n⚠️ O bucket 'chat-files' NÃO EXISTE.");
                console.log("➡️ Ação Necessária: Crie o bucket 'chat-files' no painel do Supabase e marque como 'Public'.");
            }

            // Tentativa de criação (provavelmente falhará com Anon Key)
            console.log("Tentando criar bucket...");
            const createResp = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: 'chat-files',
                    name: 'chat-files',
                    public: true,
                    file_size_limit: 10485760,
                    allowed_mime_types: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'text/plain']
                })
            });

            if (createResp.ok) {
                console.log("🎉 SUCESSO! Bucket criado automaticamente via API.");
            } else {
                console.error("❌ Falha na criação automática (Permissão insuficiente?). Você precisa criar manualmente.");
            }
        }

    } catch (err) {
        console.error("❌ Erro de conexão:", err);
    }
}

checkStorage();
