/**
 * SISTEMA: Performance Pro - TiDB Adapter
 * Arquitetura: Frontend -> Vercel API -> TiDB
 */

const Sistema = {
    usuarioLogado: null,

    // Função que conversa com nossa API na Vercel
    async query(sql, params = []) {
        try {
            const response = await fetch('/api/banco', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: sql, values: params })
            });
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            return result.data;
        } catch (erro) {
            console.error("Erro SQL:", erro);
            // Mostra erro na tela de forma amigável
            this.exibirNotificacao("Erro de conexão: " + erro.message, "erro");
            return null;
        }
    },

    // Gera ID único (UUID) para os registros
    gerarUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    exibirNotificacao(msg, tipo = 'sucesso') {
        const toast = document.createElement('div');
        toast.className = `fixed bottom-5 right-5 text-white p-4 rounded shadow-lg z-50 animate-bounce ${tipo === 'erro' ? 'bg-red-600' : 'bg-green-600'}`;
        toast.innerHTML = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    },

    // --- MÉTODOS DE NEGÓCIO ---

    async buscarProducao(mes, ano) {
        // Exemplo: Busca produção do mês
        const sql = `SELECT * FROM producao WHERE mes_referencia = ? AND ano_referencia = ?`;
        return await this.query(sql, [mes, ano]);
    },

    async salvarProducao(dados) {
        const id = this.gerarUUID();
        const sql = `
            INSERT INTO producao (id, usuario_id, data_referencia, mes_referencia, ano_referencia, tarefa, quantidade, tempo_gasto_minutos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        return await this.query(sql, [
            id, 
            this.usuarioLogado?.id || 'ANONIMO', // fallback se não tiver login ainda
            dados.data, 
            dados.mes, 
            dados.ano, 
            dados.tarefa, 
            dados.qtd,
            dados.tempo || 0
        ]);
    },

    // Atualiza interface (Regra de Ouro)
    atualizarTodasAbas() {
        if (typeof atualizarGeral === 'function') atualizarGeral();
        if (typeof atualizarPerformance === 'function') atualizarPerformance();
        if (typeof atualizarMatriz === 'function') atualizarMatriz();
        if (typeof atualizarConsolidado === 'function') atualizarConsolidado();
    }
};

// Exporta globalmente para outros arquivos usarem
window.Sistema = Sistema;