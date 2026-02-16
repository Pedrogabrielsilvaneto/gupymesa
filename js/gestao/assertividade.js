/* ARQUIVO: js/gestao/assertividade.js */
window.Gestao = window.Gestao || {};

Gestao.Assertividade = {
    state: {
        page: 1, pageSize: 50, total: 0,
        filtros: { data: '', id_emp: '', empresa: '', assistente: '', doc_name: '', status: '', obs: '', auditora: '', contrato: '', funcao: '' },
        loading: false
    },

    init: function () {
        console.log("🚀 Gestão Assertividade (V121 - Fix SQL Error) carregada.");
        const barrasAntigas = document.querySelectorAll('#barra-filtros-v61, #toolbar-assertividade-v7, .barra-busca-geral');
        barrasAntigas.forEach(el => el.remove());

        this.cacheSelectors();
        this.renderHeaders();
        this.bindEvents();
        this.injetarModalSimulador();
    },

    carregar: function () { this.carregarDados(); },

    cacheSelectors: function () {
        this.els = {
            tbody: document.getElementById('lista-assertividade'),
            thead: document.querySelector('#lista-assertividade')?.previousElementSibling || document.querySelector('thead'),
            totalBadges: document.getElementById('total-registros-assertividade'),
            btnAnt: document.getElementById('btn-pag-ant-assert'),
            btnProx: document.getElementById('btn-pag-prox-assert'),
            spanPag: document.getElementById('span-pag-assert')
        };
    },

    renderHeaders: function () {
        if (!this.els.thead) return;
        this.els.thead.innerHTML = `
            <tr class="bg-slate-50 text-slate-500 text-xs uppercase font-bold tracking-wider">
                <th class="px-2 py-3 text-center border-b min-w-[100px]">Data</th>
                <th class="px-2 py-3 text-center border-b w-[80px]">ID Emp</th>
                <th class="px-2 py-3 text-left border-b min-w-[150px]">Empresa</th>
                <th class="px-2 py-3 text-left border-b min-w-[150px]">Assistente</th>
                <th class="px-2 py-3 text-left border-b min-w-[150px]">Doc Name</th>
                <th class="px-2 py-3 text-center border-b w-[100px]">Status</th>
                <th class="px-2 py-3 text-left border-b min-w-[150px]">Obs</th>
                <th class="px-2 py-3 text-center border-b w-[50px]">Cmp</th>
                <th class="px-2 py-3 text-center border-b w-[50px] text-emerald-600">OK</th>
                <th class="px-2 py-3 text-center border-b w-[50px] text-rose-600">NOK</th>
                <th class="px-2 py-3 text-center border-b w-[60px]">%</th>
                <th class="px-2 py-3 text-center border-b min-w-[100px]">Auditora</th>
            </tr>
            <tr class="bg-white text-slate-600 text-xs">
                <th class="p-1 border-b"><input type="date" data-filter="data" class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b"><input type="text" data-filter="id_emp" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b"><input type="text" data-filter="empresa" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b"><input type="text" data-filter="assistente" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b"><input type="text" data-filter="doc_name" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b"><input type="text" data-filter="status" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b"><input type="text" data-filter="obs" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
                <th class="p-1 border-b bg-slate-50"></th>
                <th class="p-1 border-b bg-slate-50"></th>
                <th class="p-1 border-b bg-slate-50"></th>
                <th class="p-1 border-b bg-slate-50"></th>
                <th class="p-1 border-b"><input type="text" data-filter="auditora" placeholder="..." class="w-full border rounded px-1 py-1 outline-none focus:border-blue-500"></th>
            </tr>
        `;
    },

    bindEvents: function () {
        if (this.els.btnAnt) this.els.btnAnt.addEventListener('click', () => this.mudarPagina(-1));
        if (this.els.btnProx) this.els.btnProx.addEventListener('click', () => this.mudarPagina(1));

        const inputs = this.els.thead.querySelectorAll('input[data-filter]');

        // Debounce para não buscar a cada tecla
        const debounce = (func, wait) => {
            let timeout;
            return function (...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        inputs.forEach(input => {
            const acao = () => {
                this.state.filtros[input.dataset.filter] = input.value.trim();
                this.state.page = 1;
                this.carregarDados();
            };

            // Busca ao digitar (com delay)
            input.addEventListener('input', debounce(acao, 600));

            // Para datas, mantém o change imediato também
            if (input.type === 'date') input.addEventListener('change', acao);
        });
    },

    aplicarFiltrosHeader: function () {
        this.state.filtros.contrato = (document.getElementById('filtro-contrato-assert')?.value || '').toUpperCase();
        this.state.filtros.funcao = (document.getElementById('filtro-funcao-assert')?.value || '').toUpperCase();
        this.state.page = 1;
        this.carregarDados();
    },

    mudarPagina: function (delta) {
        const maxPages = Math.ceil(this.state.total / this.state.pageSize);
        const novaPagina = this.state.page + delta;
        if (novaPagina >= 1 && novaPagina <= maxPages) {
            this.state.page = novaPagina;
            this.carregarDados();
        }
    },

    carregarDados: async function () {
        if (this.state.loading) return;
        this.state.loading = true;
        this.renderLoading();
        try {
            const resultado = await Sistema.Assertividade.buscarPaginado(this.state.filtros, this.state.page, this.state.pageSize);
            this.state.total = resultado.total;
            this.renderTabela(resultado.data);
            this.atualizarControlesPaginacao();
        } catch (error) {
            if (this.els.tbody) this.els.tbody.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-rose-500">Erro: ${error.message}</td></tr>`;
        } finally { this.state.loading = false; }
    },

    renderLoading: function () {
        if (this.els.tbody) this.els.tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-blue-600"><i class="fas fa-circle-notch fa-spin text-2xl"></i></td></tr>`;
    },

    renderTabela: function (dados) {
        if (!this.els.tbody) return;
        this.els.tbody.innerHTML = '';
        if (dados.length === 0) {
            this.els.tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400">Nenhum registro encontrado.</td></tr>`;
            return;
        }
        const html = dados.map(d => {
            let dataF = d.data_referencia ? d.data_referencia.split('-').reverse().slice(0, 2).join('/') : '-';
            const st = (d.status || '').toUpperCase();
            let classeStatus = ['OK', 'APROVADO'].includes(st) ? 'bg-emerald-100 text-emerald-700' : (['NOK', 'REPROVADO'].includes(st) ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500');

            let notaNum = d.assertividade_val;
            if (notaNum === null || notaNum === undefined) notaNum = Sistema.Assertividade._extrairValorPorcentagem(d.porcentagem_assertividade);
            const nota = notaNum !== null ? notaNum.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '-';
            const corNota = (notaNum >= 98) ? 'text-emerald-600' : (notaNum >= 95 ? 'text-amber-600' : 'text-rose-600');

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-[11px] text-slate-600">
                    <td class="px-2 py-2 text-center font-mono">${dataF}</td>
                    <td class="px-2 py-2 text-center text-slate-400">${d.company_id || '-'}</td>
                    <td class="px-2 py-2 truncate max-w-[120px]">${d.empresa_nome || '-'}</td>
                    <td class="px-2 py-2 font-bold text-slate-700 truncate max-w-[120px]">${d.assistente_nome || '-'}</td>
                    <td class="px-2 py-2 text-slate-500 truncate max-w-[150px]">${d.doc_name || '-'}</td>
                    <td class="px-2 py-2 text-center"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${classeStatus}">${st || 'ND'}</span></td>
                    <td class="px-2 py-2 text-slate-400 truncate max-w-[100px]" title="${d.observacao || ''}">${d.observacao || ''}</td>
                    <td class="px-2 py-2 text-center font-mono">${d.qtd_campos ?? '-'}</td>
                    <td class="px-2 py-2 text-center font-mono text-emerald-600">${d.qtd_ok ?? '-'}</td>
                    <td class="px-2 py-2 text-center font-mono text-rose-600">${d.qtd_nok ?? '-'}</td>
                    <td class="px-2 py-2 text-center font-bold ${corNota}">${nota}</td>
                    <td class="px-2 py-2 text-center text-slate-500">${d.auditora_nome || '-'}</td>
                </tr>`;
        }).join('');
        this.els.tbody.innerHTML = html;
        if (this.els.totalBadges) this.els.totalBadges.textContent = `${this.state.total.toLocaleString()} registros`;
    },

    atualizarControlesPaginacao: function () {
        if (!this.els.spanPag) return;
        const maxPages = Math.ceil(this.state.total / this.state.pageSize) || 1;
        this.els.spanPag.textContent = `Página ${this.state.page} de ${maxPages}`;
        if (this.els.btnAnt) this.els.btnAnt.disabled = (this.state.page <= 1);
        if (this.els.btnProx) this.els.btnProx.disabled = (this.state.page >= maxPages);
    },

    injetarModalSimulador: function () {
        if (document.getElementById('modal-simulador-assertividade')) return;
        const htmlModal = `
        <div id="modal-simulador-assertividade" class="fixed inset-0 bg-slate-900/90 hidden items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-down border border-slate-200">
                <div class="bg-indigo-700 text-white px-6 py-4 flex-none flex justify-between items-center shadow-md z-10">
                    <div>
                        <h3 class="text-xl font-bold flex items-center"><i class="fas fa-microscope mr-2"></i>Sala de Teste (Dados Reais)</h3>
                        <p class="text-indigo-200 text-xs mt-1">Fonte: Tabela Assertividade (IDs do CSV)</p>
                    </div>
                    <button onclick="document.getElementById('modal-simulador-assertividade').classList.add('hidden')" class="text-white hover:text-indigo-200 p-2 text-3xl">&times;</button>
                </div>
                <div class="flex-1 overflow-y-auto p-6 bg-slate-50">
                    <div class="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-6 flex gap-4 items-end flex-wrap">
                        <div class="flex-1 min-w-[200px]">
                            <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Assistente (CSV)</label>
                            <select id="sim-assistente" class="w-full border rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none bg-slate-50 shadow-inner font-mono text-slate-700"></select>
                            <p class="text-[10px] text-slate-400 mt-1">Carregado dos dados importados</p>
                        </div>
                        <div class="w-[200px]">
                            <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Auditora</label>
                            <select id="sim-auditora" class="w-full border rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none bg-slate-50 shadow-inner text-slate-600"></select>
                        </div>
                        <div class="w-[140px]">
                            <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Início</label>
                            <input type="date" id="sim-inicio" class="w-full border rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none shadow-sm text-slate-600">
                        </div>
                        <div class="w-[140px]">
                            <label class="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Fim</label>
                            <input type="date" id="sim-fim" class="w-full border rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none shadow-sm text-slate-600">
                        </div>
                        <button onclick="Gestao.Assertividade.executarSimulacao()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg transition transform hover:-translate-y-0.5 w-full md:w-auto"><i class="fas fa-search mr-2"></i> CALCULAR</button>
                    </div>
                    <div id="sim-loading" class="hidden flex items-center justify-center flex-col text-indigo-500 py-12">
                        <i class="fas fa-circle-notch fa-spin text-4xl mb-4"></i>
                        <span class="text-sm font-bold animate-pulse">Analisando Dados Brutos...</span>
                    </div>
                    <div id="sim-resultados" class="hidden">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm text-center relative overflow-hidden">
                                <div class="absolute top-0 left-0 w-1 h-full bg-slate-500"></div>
                                <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Total Auditado (Filtro Excel)</div>
                                <div id="res-total" class="text-4xl font-bold text-slate-700">-</div>
                            </div>
                            <div class="bg-indigo-50 p-6 rounded-xl border border-indigo-100 shadow-inner text-center relative">
                                <div class="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mb-1">Média Assertividade</div>
                                <div id="res-media" class="text-5xl font-black text-indigo-700">-</div>
                            </div>
                        </div>
                        <h4 class="font-bold text-slate-700 mb-3 text-sm flex items-center"><i class="fas fa-list-alt mr-2 text-indigo-500"></i> Detalhamento Diário</h4>
                        <div class="overflow-x-auto border rounded-lg shadow-sm bg-white">
                            <table class="w-full text-xs text-left min-w-[400px]">
                                <thead class="bg-slate-100 text-slate-500 font-bold uppercase">
                                    <tr>
                                        <th class="px-4 py-3 border-b">Data</th>
                                        <th class="px-4 py-3 border-b text-center">Docs Válidos</th>
                                        <th class="px-4 py-3 border-b text-center text-indigo-700">Média</th>
                                    </tr>
                                </thead>
                                <tbody id="lista-simulacao" class="divide-y divide-slate-100"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', htmlModal);
    },

    abrirSimulador: async function () {
        const modal = document.getElementById('modal-simulador-assertividade');
        if (modal) {
            modal.classList.remove('hidden'); modal.classList.add('flex');
            const hoje = new Date();
            if (!document.getElementById('sim-inicio').value) {
                document.getElementById('sim-inicio').value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
                document.getElementById('sim-fim').value = hoje.toISOString().split('T')[0];
            }
            await this.carregarOpcoesSimulacao();
        }
    },

    carregarOpcoesSimulacao: async function () {
        const selectAssistente = document.getElementById('sim-assistente');
        const selectAuditora = document.getElementById('sim-auditora');
        selectAssistente.innerHTML = '<option value="">Carregando...</option>';
        selectAuditora.innerHTML = '<option value="">Carregando...</option>';

        try {
            // Busca assistentes via TiDB (exclui gestão/admin)
            const sql = `
                SELECT id, nome
                FROM usuarios
                WHERE situacao = 'ATIVO'
                  AND (funcao IS NULL OR UPPER(funcao) NOT LIKE '%GESTOR%' AND UPPER(funcao) NOT LIKE '%AUDITOR%' AND UPPER(funcao) NOT LIKE '%ADMIN%')
                ORDER BY nome
            `;
            const data = await Sistema.query(sql);

            if (!data) throw new Error("Falha ao carregar assistentes.");

            selectAssistente.innerHTML = '<option value="">Todos</option>' +
                (data || []).map(u => `<option value="${u.id}">${u.nome} (ID: ${u.id})</option>`).join('');

            selectAuditora.innerHTML = '<option value="">Qualquer Auditora (Preenchida)</option>';
            ['Keila', 'Vanessa', 'Samaria', 'Qualidade', 'Auditoria', 'Brenda'].forEach(nome => {
                selectAuditora.innerHTML += `<option value="${nome}">${nome}</option>`;
            });
        } catch (e) {
            console.error("Erro ao carregar opções:", e);
            selectAssistente.innerHTML = '<option value="">Erro de conexão</option>';
        }
    },

    executarSimulacao: async function () {
        const assistenteId = document.getElementById('sim-assistente').value;
        const auditora = document.getElementById('sim-auditora').value;
        const inicio = document.getElementById('sim-inicio').value;
        const fim = document.getElementById('sim-fim').value;
        if (!inicio || !fim) { alert("Preencha o período."); return; }

        document.getElementById('sim-resultados').classList.add('hidden');
        document.getElementById('sim-loading').classList.remove('hidden');
        document.getElementById('sim-loading').classList.add('flex');

        try {
            const pId = assistenteId ? parseInt(assistenteId) : null;
            const dados = await Sistema.Assertividade.buscarAnaliseCentralizada({ assistente_id: pId, auditora, inicio, fim });

            document.getElementById('res-total').innerText = (dados.total_docs || 0).toLocaleString();
            document.getElementById('res-media').innerText = Sistema.Assertividade.formatarPorcentagem(dados.media_assertividade);

            const tbody = document.getElementById('lista-simulacao');
            if (dados.detalhe_diario && dados.detalhe_diario.length > 0) {
                tbody.innerHTML = dados.detalhe_diario.map(dia => `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-slate-600">
                        <td class="px-4 py-3 font-mono font-bold">${dia.data.split('-').reverse().slice(0, 2).join('/')}</td>
                        <td class="px-4 py-3 text-center text-lg font-bold text-slate-700">${dia.docs}</td>
                        <td class="px-4 py-3 text-center text-lg font-bold text-indigo-700 bg-indigo-50">${Sistema.Assertividade.formatarPorcentagem(dia.media)}</td>
                    </tr>`).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center py-8 text-slate-400">Sem dados válidos para este filtro.</td></tr>';
            }
        } catch (e) {
            console.error(e); alert("Erro: " + e.message);
        } finally {
            document.getElementById('sim-loading').classList.add('hidden');
            document.getElementById('sim-loading').classList.remove('flex');
            document.getElementById('sim-resultados').classList.remove('hidden');
        }
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.Gestao && !window.Gestao.Assertividade) Gestao.Assertividade = {};
        Gestao.Assertividade.init();
    });
} else {
    Gestao.Assertividade.init();
}