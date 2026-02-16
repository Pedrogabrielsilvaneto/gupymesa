/* ARQUIVO: js/minha_area/auditoria.js
   VERSÃO: V3.0 (Conexão Direta: Fonte da Verdade)
   DESCRIÇÃO: Consome a tabela 'assertividade' (mesma fonte da Gestão/Produtividade) para garantir consistência total.
*/

MinhaArea.Auditoria = {
    isLocked: false,

    carregar: async function() {
        if (this.isLocked) return;
        this.isLocked = true;
        this.toggleLoading(true);

        console.log("🚀 [Auditoria] Acessando Cérebro de Dados (assertividade)...");

        try {
            // 1. Obtém Filtros (Data e Usuário)
            const datas = MinhaArea.getDatasFiltro();
            if (!datas) throw new Error("Datas do filtro não encontradas.");
            const { inicio, fim } = datas;
            
            // Define o alvo: Se for Admin vendo alguém, ou o próprio usuário logado
            const uidAlvo = MinhaArea.getUsuarioAlvo() || (MinhaArea.usuario ? MinhaArea.usuario.id : null);

            // 2. QUERY OTIMIZADA NO SUPABASE
            // Buscamos apenas as colunas estritamente necessárias para a grade solicitada.
            // Isso torna a consulta muito mais rápida do que trazer "tudo".
            let query = Sistema.supabase
                .from('assertividade')
                .select('doc_name, assertividade_val, observacao, status, empresa_nome, tipo_documento, qtd_ok, qtd_campos, data_referencia')
                .gte('data_referencia', inicio)
                .lte('data_referencia', fim)
                .order('data_referencia', { ascending: false }); // Mais recentes no topo

            // Aplica filtro de usuário se necessário
            if (uidAlvo) {
                query = query.eq('usuario_id', uidAlvo);
            }

            const { data, error } = await query;

            if (error) throw new Error("Falha na conexão com a base de assertividade: " + error.message);

            // 3. RENDERIZAÇÃO
            this.renderizarGrid(data || []);

        } catch (err) {
            console.error("❌ Erro Auditoria:", err);
            const tbody = document.getElementById('auditoria-grid-body');
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-rose-500 font-bold">Erro ao sincronizar: ${err.message}</td></tr>`;
        } finally {
            this.toggleLoading(false);
            this.isLocked = false;
        }
    },

    renderizarGrid: function(lista) {
        const tbody = document.getElementById('auditoria-grid-body');
        const badgeTotal = document.getElementById('auditoria-total-badge');
        const emptyState = document.getElementById('auditoria-empty');
        
        if (!tbody) return;
        tbody.innerHTML = '';

        // Atualiza contador no cabeçalho
        if (badgeTotal) badgeTotal.innerText = `${lista.length} documentos`;

        // Estado Vazio
        if (lista.length === 0) {
            if(emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if(emptyState) emptyState.classList.add('hidden');

        // Renderiza Linhas
        const html = lista.map(row => {
            // Dados Brutos
            const docName = row.doc_name || 'Sem nome';
            const empresa = row.empresa_nome || '-';
            const tipoDoc = row.tipo_documento || '-';
            const obs = row.observacao || '-';
            const statusRaw = (row.status || '').toUpperCase();
            
            // Cálculo de Assertividade (Mesma lógica da Gestão)
            let pct = 0;
            let valOriginal = row.assertividade_val;
            
            if (valOriginal !== null && valOriginal !== undefined) {
                if (typeof valOriginal === 'string') {
                    valOriginal = parseFloat(valOriginal.replace('%','').replace(',','.'));
                }
                pct = Number(valOriginal);
            } else if (row.qtd_campos > 0) {
                pct = (row.qtd_ok / row.qtd_campos) * 100;
            }

            // Definição Visual (Cores e Badges)
            let statusBadge = '';
            let rowClass = 'hover:bg-slate-50';
            const isOk = (statusRaw === 'OK' || statusRaw === 'VALIDADO' || pct >= 99.9);

            if (isOk) {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200"><i class="fas fa-check"></i> OK</span>`;
            } else {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200"><i class="fas fa-times"></i> NOK</span>`;
                rowClass = 'bg-rose-50/20 hover:bg-rose-50/40'; // Destaque suave para erros
            }

            const corPct = pct >= 97 ? 'text-emerald-600' : 'text-rose-600';

            return `
                <tr class="${rowClass} border-b border-slate-100 transition-colors group">
                    <td class="px-4 py-3 font-medium text-slate-700 truncate max-w-[250px]" title="${docName}">
                        ${docName}
                    </td>
                    
                    <td class="px-2 py-3 text-center font-bold ${corPct}">
                        ${pct.toFixed(2)}%
                    </td>
                    
                    <td class="px-4 py-3 text-slate-500 text-[11px] truncate max-w-[250px]" title="${obs}">
                        ${obs}
                    </td>
                    
                    <td class="px-2 py-3 text-center">
                        ${statusBadge}
                    </td>
                    
                    <td class="px-4 py-3 text-slate-600 truncate max-w-[150px]" title="${empresa}">
                        ${empresa}
                    </td>
                    
                    <td class="px-4 py-3 text-slate-500 truncate max-w-[150px]" title="${tipoDoc}">
                        ${tipoDoc}
                    </td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = html;
    },

    toggleLoading: function(show) {
        const el = document.getElementById('auditoria-loading');
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    }
};