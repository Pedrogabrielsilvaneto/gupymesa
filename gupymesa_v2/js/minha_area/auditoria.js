/* ARQUIVO: js/minha_area/auditoria.js
   VERSÃO: V3.0 (Conexão Direta: Fonte da Verdade)
   DESCRIÇÃO: Consome a tabela 'assertividade' (mesma fonte da Gestão/Produtividade) para garantir consistência total.
*/

MinhaArea.Auditoria = {
    isLocked: false,

    carregar: async function () {
        const container = document.getElementById('ma-tab-auditoria');
        if (!container) return;

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[400px] text-center p-8 animate-fade-in">
                <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <i class="fas fa-tools text-4xl text-slate-400"></i>
                </div>
                <h2 class="text-2xl font-black text-slate-700 mb-2">Em Manutenção</h2>
                <p class="text-slate-500 max-w-md mx-auto">
                    Estamos realizando melhorias na visualização de histórico de auditorias para trazer mais detalhes e precisão. 
                    <br><br>
                    <span class="text-xs font-bold uppercase tracking-wider text-blue-500">Volte em breve!</span>
                </p>
            </div>
        `;
    },

    renderizarGrid: function (lista) {
        const tbody = document.getElementById('auditoria-grid-body');
        const badgeTotal = document.getElementById('auditoria-total-badge');
        const emptyState = document.getElementById('auditoria-empty');

        if (!tbody) return;
        tbody.innerHTML = '';

        // Atualiza contador no cabeçalho
        if (badgeTotal) badgeTotal.innerText = `${lista.length} documentos`;

        // Estado Vazio
        if (lista.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }
        if (emptyState) emptyState.classList.add('hidden');

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
                    valOriginal = parseFloat(valOriginal.replace('%', '').replace(',', '.'));
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

    toggleLoading: function (show) {
        const el = document.getElementById('auditoria-loading');
        if (el) {
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    }
};