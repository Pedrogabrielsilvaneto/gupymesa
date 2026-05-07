
// Script de Correção Remota via Node.js
// Executa os comandos SQL na API de produção

async function query(sql, params = []) {
    try {
        const response = await fetch('https://gupymesa.vercel.app/api/banco', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: sql, values: params })
        });

        const result = await response.json();

        if (result.error) {
            console.error("❌ Erro SQL:", result.error);
            // Se o erro for "Duplicate column", podemos ignorar
            if (result.error.includes("Duplicate column")) return { status: 'ignored' };
            throw new Error(result.error);
        }

        return result.data;
    } catch (erro) {
        console.error("❌ Falha na comunicação com API:", erro.message);
        return null; // Retorna null para indicar falha de rede/parse
    }
}

async function run() {
    console.log("🚀 Iniciando correção remota do esquema...");

    const commands = [
        // Tabela USUARIOS
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil VARCHAR(50)",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE",
        "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS funcao VARCHAR(100)",

        // Tabela PRODUCAO
        "ALTER TABLE producao ADD COLUMN IF NOT EXISTS fifo INT DEFAULT 0",
        "ALTER TABLE producao ADD COLUMN IF NOT EXISTS gradual_total INT DEFAULT 0",
        "ALTER TABLE producao ADD COLUMN IF NOT EXISTS gradual_parcial INT DEFAULT 0",
        "ALTER TABLE producao ADD COLUMN IF NOT EXISTS perfil_fc INT DEFAULT 0",
        "ALTER TABLE producao ADD COLUMN IF NOT EXISTS fator DECIMAL(5,2) DEFAULT 1.00",
        "ALTER TABLE producao ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'OK'"
    ];

    for (const sql of commands) {
        console.log(`⏳ Executando: ${sql}`);
        try {
            await query(sql);
            console.log("✅ Sucesso/Ignorado (Já existe)");
        } catch (e) {
            console.log("⚠️ Erro (pode ser ignorado se for duplicado):", e.message);
        }
    }

    console.log("🏁 Processo finalizado.");
}

run();
