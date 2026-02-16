/* ARQUIVO: js/sistema/assertividade.js */
window.Sistema = window.Sistema || {};

Sistema.Assertividade = {
    
    buscarPaginado: async function(filtros, pagina = 1, tamanho = 50) {
        let query = Sistema.supabase
            .from('assertividade')
            .select('*', { count: 'exact' });

        if (filtros.data) query = query.eq('data_referencia', filtros.data);
        if (filtros.id_emp) query = query.ilike('company_id', `%${filtros.id_emp}%`);
        if (filtros.empresa) query = query.ilike('empresa_nome', `%${filtros.empresa}%`);
        if (filtros.assistente) query = query.ilike('assistente_nome', `%${filtros.assistente}%`);
        if (filtros.doc_name) query = query.ilike('doc_name', `%${filtros.doc_name}%`);
        if (filtros.status) query = query.ilike('status', `%${filtros.status}%`);
        if (filtros.obs) query = query.ilike('observacao', `%${filtros.obs}%`);
        if (filtros.auditora) query = query.ilike('auditora_nome', `%${filtros.auditora}%`);

        const inicio = (pagina - 1) * tamanho;
        const fim = inicio + tamanho - 1;

        const { data, error, count } = await query
            .range(inicio, fim)
            .order('data_referencia', { ascending: false });

        if (error) throw new Error(error.message);
        return { data, total: count };
    },

    buscarAnaliseCentralizada: async function(params) {
        console.log("🧠 Enviando para o Banco (RPC V9):", params);

        const assistenteId = params.assistente_id ? parseInt(params.assistente_id) : null;

        const { data, error } = await Sistema.supabase.rpc('rpc_analise_assertividade', {
            p_inicio: params.inicio,
            p_fim: params.fim,
            p_assistente_id: assistenteId,
            p_auditora: params.auditora || null
        });

        if (error) {
            console.error("Erro RPC:", error);
            throw new Error(`Erro no cálculo: ${error.message}`);
        }

        if (data && data.length > 0) {
            return data[0];
        } else {
            return { 
                total_docs: 0, 
                qtd_auditorias: 0,
                soma_assertividade: 0,
                media_assertividade: 0, 
                detalhe_diario: [] 
            };
        }
    },

    _extrairValorPorcentagem: function(valorStr) {
        if (valorStr === null || valorStr === undefined || valorStr === '') return null;
        if (typeof valorStr === 'number') return valorStr;
        const limpo = String(valorStr).replace('%', '').replace(',', '.').trim();
        const num = parseFloat(limpo);
        return isNaN(num) ? null : num;
    },

    formatarPorcentagem: function(valor) {
        if (valor === null || valor === undefined) return '-';
        return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
};