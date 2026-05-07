
async function query(sql, params = []) {
    try {
        const response = await fetch('https://gupymesa.vercel.app/api/banco', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, values: params })
        });
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result.data;
    } catch (erro) {
        console.error("❌ Erro:", erro.message);
        return null;
    }
}

async function run() {
    console.log("🔍 Verificando se as tabelas respondem...");

    try {
        // Teste Usuario (coluna perfil)
        const users = await query("SELECT id, nome, perfil, ativo, funcao FROM usuarios LIMIT 1");
        console.log("✅ Tabela USUARIOS OK. Retorno:", users ? users.length : 0);

        // Teste Producao (coluna fifo)
        const prods = await query("SELECT id, fifo, gradual_total FROM producao LIMIT 1");
        console.log("✅ Tabela PRODUCAO OK. Retorno:", prods ? prods.length : 0);

    } catch (e) {
        console.error("🔥 Ainda com erro:", e.message);
    }
}

run();
