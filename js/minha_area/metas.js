/* ARQUIVO: js/minha_area/metas.js
   VERSÃO: V11.5 (Correção Média das Médias - Visão Macro)
   DESCRIÇÃO: 
     - Visão Micro (Mês/Semana): Média = (Total Produção / Dias Trabalhados).
     - Visão Macro (Tri/Sem/Ano): Média = (Soma das Médias Mensais / Quantidade de Meses).
*/

MinhaArea.Metas = {
    isLocked: false,
    cacheUsers: [],
    cacheDados: {},
    cacheColunas: [],
    statsUsers: {},
    isMacroView: false,
    currentFilterContract: 'TODOS',
    viewState: 'GRID',
    activeSubTab: 'PROD',
    selectedUserId: null,

    chartDetailProd: null,
    chartDetailAssert: null,
    chartCompProd: null,
    chartCompAssert: null,

    // --- FUNÇÃO CORE: Normalização de Datas ---
    getKeyFromDate: function (dateInput, isMacro) {
        if (!dateInput) return null;
        let d;
        if (typeof dateInput === 'string') {
            const cleanDate = dateInput.split('T')[0];
            d = new Date(cleanDate + 'T12:00:00');
        } else {
            d = new Date(dateInput);
            d.setHours(12, 0, 0, 0);
        }

        if (isMacro) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
            const ano = d.getFullYear();
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const dia = String(d.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }
    },

    mudarFiltroContrato: function (novoValor) {
        this.currentFilterContract = novoValor;
        this.carregar();
    },

    // [MERGE v4.39] HTML Template for Assertividade Dashboard (Moved from minha_area.html)
    HTML_ASSERTIVIDADE: `
        <div class="flex flex-col lg:flex-row gap-6 h-full">
            <div class="w-full lg:w-1/3 flex flex-col gap-4 h-full">
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-bold text-slate-700 flex items-center gap-2"><i class="fas fa-chart-bar text-rose-500"></i> Onde estou errando?</h3>
                            <p class="text-xs text-slate-400">Clique na barra para filtrar.</p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <div class="flex bg-slate-100 rounded-lg p-1">
                                <button onclick="MinhaArea.Comparativo.mudarVisao('doc')" id="btn-view-doc" class="px-3 py-1 text-[10px] font-bold rounded bg-white text-rose-600 shadow-sm transition">Docs</button>
                                <button onclick="MinhaArea.Comparativo.mudarVisao('empresa')" id="btn-view-empresa" class="px-3 py-1 text-[10px] font-bold rounded text-slate-500 hover:bg-white transition">Empresas</button>
                                <button onclick="MinhaArea.Comparativo.mudarVisao('ndf')" id="btn-view-ndf" class="px-3 py-1 text-[10px] font-bold rounded text-slate-500 hover:bg-white transition">NDF</button>
                            </div>
                            <button id="btn-ver-todos" onclick="MinhaArea.Comparativo.toggleMostrarTodos()" class="text-[10px] font-bold text-blue-500 hover:underline">Ver Todos</button>
                        </div>
                    </div>
                    <div class="flex-1 w-full relative min-h-[200px]"><canvas id="graficoTopOfensores"></canvas></div>
                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Visão Geral</h3>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Total Auditados</span><span id="card-total-auditados" class="text-xs font-black text-blue-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Total de Acertos</span><span id="card-total-acertos" class="text-xs font-black text-emerald-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5"><span class="text-[10px] font-bold text-slate-600">Total de Erros</span><span id="card-total-erros" class="text-xs font-black text-rose-600">--</span></div>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Detalhamento</h3>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Erros Gupy</span><span id="card-erros-gupy" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5"><span class="text-[10px] font-bold text-slate-600">Erros NDF</span><span id="card-erros-ndf" class="text-xs font-black text-amber-600">--</span></div>
                            <div class="flex justify-between items-center pl-2 mt-0.5"><span class="text-[9px] font-bold text-amber-500/80 flex items-center gap-1"><i class="fas fa-level-up-alt rotate-90 text-[8px]"></i> Empresa Valida</span><span id="card-empresa-validar" class="text-[10px] font-bold text-amber-500">--</span></div>
                            <!-- NEW GAP CARD -->
                            <div class="flex justify-between items-center py-1.5 border-t border-slate-100 mt-2">
                                <span class="text-[10px] font-bold text-slate-600">GAP Assistentes</span><span id="card-gap-assistentes" class="text-xs font-black text-blue-600">--</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="w-full lg:w-2/3 flex flex-col h-full"> 
                 <div class="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden relative">
                    <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center z-10 relative">
                        <div>
                            <h3 class="font-bold text-slate-700 flex items-center gap-2"><i class="fas fa-exclamation-triangle text-amber-500"></i> Feed de Atenção</h3>
                            <p class="text-xs text-slate-500">Documentos reprovados (NOK).</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="relative"><input type="text" placeholder="Buscar..." onkeyup="MinhaArea.Comparativo.filtrarPorBusca(this.value)" class="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 w-40 transition"><i class="fas fa-search absolute left-2.5 top-2 text-slate-400 text-xs"></i></div>
                            <button id="btn-limpar-filtro" onclick="MinhaArea.Comparativo.limparFiltro()" class="hidden px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition flex items-center gap-2"><i class="fas fa-times text-rose-500"></i> Limpar</button>
                        </div>
                    </div>
                    <div id="feed-erros-container" class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-slate-50/50">
                        <div class="text-center py-12 text-slate-400"><i class="fas fa-spinner fa-spin text-2xl mb-2"></i><br>Carregando feed de erros...</div>
                    </div>
                </div>
            </div>
        </div>
    `,

    mudarSubAba: function (modo) {
        this.activeSubTab = modo;
        const btnProd = document.getElementById('btn-sub-prod');
        const btnAssert = document.getElementById('btn-sub-assert');
        const btnDash = document.getElementById('btn-sub-dash');

        const styleActive = "px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm bg-blue-600 text-white transition flex items-center gap-2";
        const styleActiveAssert = "px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm bg-emerald-600 text-white transition flex items-center gap-2";
        const styleActiveDash = "px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm bg-indigo-600 text-white transition flex items-center gap-2";
        const styleInactive = "px-4 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-100 text-slate-500 transition flex items-center gap-2";

        // Reset all
        if (btnProd) btnProd.className = styleInactive;
        if (btnAssert) btnAssert.className = styleInactive;
        if (btnDash) btnDash.className = styleInactive;

        if (modo === 'PROD') {
            if (btnProd) btnProd.className = styleActive;
            this.toggleContainerPrincipal(true);
            this.reordenarEExibir();
        } else if (modo === 'ASSERT') {
            if (btnAssert) btnAssert.className = styleActiveAssert;
            this.toggleContainerPrincipal(true); // Show Grid (Qualidade)
            this.reordenarEExibir();
        } else if (modo === 'DASH') {
            if (btnDash) btnDash.className = styleActiveDash;
            this.toggleContainerPrincipal(false); // Hide Grid, Show Dashboard (Assertividade)
            this.carregarDashboardAssertividade();
        }
    },

    toggleContainerPrincipal: function (mostrarGrid) {
        const gridContainer = document.getElementById('metas-grid-container-inner');
        const dashContainer = document.getElementById('container-painel-assertividade');

        if (mostrarGrid) {
            if (gridContainer) gridContainer.classList.remove('hidden');
            if (dashContainer) dashContainer.classList.add('hidden');
        } else {
            if (gridContainer) gridContainer.classList.add('hidden');
            if (dashContainer) dashContainer.classList.remove('hidden');
        }
    },

    carregarDashboardAssertividade: function () {
        if (MinhaArea.Assertividade && typeof MinhaArea.Assertividade.carregar === 'function') {
            MinhaArea.Assertividade.carregar();
        }
    },

    reordenarEExibir: function () {
        if (this.activeSubTab === 'PROD') {
            this.cacheUsers.sort((a, b) => {
                const statA = this.statsUsers[String(a.id)] || { prod: 0 };
                const statB = this.statsUsers[String(b.id)] || { prod: 0 };
                return statB.prod - statA.prod;
            });
        } else {
            this.cacheUsers.sort((a, b) => {
                const statA = this.statsUsers[String(a.id)] || { ok: 0, total: 0 };
                const statB = this.statsUsers[String(b.id)] || { ok: 0, total: 0 };
                const pctA = statA.total > 0 ? (statA.ok / statA.total) : 0;
                const pctB = statB.total > 0 ? (statB.ok / statB.total) : 0;
                return pctB - pctA;
            });
        }
        this.renderizarMatriz();
    },

    prepararContainer: function () {
        const containerPrincipal = document.getElementById('ma-tab-metas');
        if (!containerPrincipal) return;

        if (!document.getElementById('metas-wrapper')) {
            const conteudoTabela = containerPrincipal.innerHTML;
            containerPrincipal.innerHTML = '';

            const wrapper = document.createElement('div');
            wrapper.id = 'metas-wrapper';
            wrapper.className = 'flex flex-col h-full';

            const navHTML = `
                <div class="flex items-center justify-between mb-4 px-1">
                    <div class="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onclick="MinhaArea.Metas.mudarSubAba('PROD')" id="btn-sub-prod" class="px-4 py-1.5 text-xs font-bold rounded-lg shadow-sm bg-blue-600 text-white transition flex items-center gap-2">
                            <i class="fas fa-bolt"></i> Produção
                        </button>
                        <button onclick="MinhaArea.Metas.mudarSubAba('ASSERT')" id="btn-sub-assert" class="px-4 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-100 text-slate-500 transition flex items-center gap-2">
                            <i class="fas fa-check-circle"></i> Qualidade
                        </button>
                         <button onclick="MinhaArea.Metas.mudarSubAba('DASH')" id="btn-sub-dash" class="px-4 py-1.5 text-xs font-bold rounded-lg hover:bg-slate-100 text-slate-500 transition flex items-center gap-2">
                            <i class="fas fa-chart-pie"></i> Assertividade
                        </button>
                    </div>
                    <div class="text-[10px] text-slate-400 font-medium italic">
                        * Dados sincronizados com Dia a Dia
                    </div>
                </div>
            `;

            // Grid Container
            const divGridInner = document.createElement('div');
            divGridInner.id = 'metas-grid-container-inner';
            divGridInner.className = 'flex-1 overflow-hidden flex flex-col relative animate-enter';
            divGridInner.innerHTML = conteudoTabela;

            // Dashboard Container
            const divDash = document.createElement('div');
            divDash.id = 'container-painel-assertividade';
            divDash.className = 'hidden flex-1 overflow-hidden animate-enter';
            divDash.innerHTML = this.HTML_ASSERTIVIDADE;

            // Container for everything
            const contentContainer = document.createElement('div');
            contentContainer.className = 'flex-1 overflow-hidden relative';
            contentContainer.appendChild(divGridInner);
            contentContainer.appendChild(divDash);

            wrapper.innerHTML = navHTML;
            wrapper.appendChild(contentContainer);

            containerPrincipal.appendChild(wrapper);

            const divDetail = document.createElement('div');
            divDetail.id = 'metas-detail-container';
            divDetail.className = 'hidden animate-enter space-y-6 pb-8';
            divDetail.innerHTML = `
                <div class="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200 mt-2">
                    <div class="flex items-center gap-4">
                        <button onclick="MinhaArea.Metas.voltarParaGrade()" class="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition shadow-sm border border-slate-200">
                            <i class="fas fa-arrow-left"></i>
                        </button>
                        <div>
                            <h2 id="detalhe-nome" class="text-xl font-bold text-slate-700 leading-tight">--</h2>
                            <div class="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span id="detalhe-funcao" class="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">--</span>
                                <span id="detalhe-contrato" class="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">--</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-6 text-right">
                         <div>
                            <span class="block text-[10px] uppercase font-bold text-slate-400">Média/Dia</span>
                            <span id="detalhe-kpi-media" class="text-2xl font-black text-blue-600">0</span>
                         </div>
                         <div class="border-l border-slate-200 pl-6">
                            <span class="block text-[10px] uppercase font-bold text-slate-400">Total Período</span>
                            <span id="detalhe-kpi-total" class="text-2xl font-black text-slate-700">0</span>
                         </div>
                         <div class="border-l border-slate-200 pl-6">
                            <span class="block text-[10px] uppercase font-bold text-slate-400">Assertividade</span>
                            <span id="detalhe-kpi-assert" class="text-2xl font-black text-emerald-600">0%</span>
                         </div>
                    </div>
                </div>
                <div id="detalhe-content" class="space-y-6">
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 class="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><i class="fas fa-chart-bar text-blue-500"></i> Evolução Diária de Produção</h3>
                        <div class="h-[300px] w-full relative"><canvas id="canvas-detail-prod"></canvas></div>
                    </div>
                    <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 class="text-sm font-bold text-slate-600 mb-4 flex items-center gap-2"><i class="fas fa-check-circle text-emerald-500"></i> Qualidade e Assertividade</h3>
                        <div class="h-[200px] w-full relative"><canvas id="canvas-detail-assert"></canvas></div>
                    </div>
                </div>
            `;
            containerPrincipal.appendChild(divDetail);
        }
    },

    voltarParaGrade: function () {
        const grid = document.getElementById('metas-grid-container');
        const detail = document.getElementById('metas-detail-container');
        if (detail) detail.classList.add('hidden');
        if (grid) grid.classList.remove('hidden');
        this.viewState = 'GRID';
        this.selectedUserId = null;
        this.atualizarCardsTopo();
    },

    abrirDetalhe: function (uid) {
        // [REF_FIX] Agora abre o modal comparativo ao clicar no nome
        this.abrirComparativoVizinhos(uid);
    },

    // --- HELPER: Gerador de Placeholders SQL ---
    gerarPlaceholders: function (array) {
        if (!array || array.length === 0) return '';
        return array.map(() => '?').join(',');
    },

    carregar: async function () {
        if (this.isLocked) return;
        this.isLocked = true;
        this.toggleLoading(true);

        this.prepararContainer();

        try {
            const datas = MinhaArea.getDatasFiltro();
            if (!datas) throw new Error("Datas do filtro não encontradas.");
            const { inicio, fim } = datas;

            const diffDias = (new Date(fim) - new Date(inicio)) / (1000 * 60 * 60 * 24);
            this.isMacroView = diffDias > 45;

            // [FIX v4.38] Robust Manager Check & Decoupled Global Query
            const uLogado = MinhaArea.usuario || {};
            const pLogado = (uLogado.perfil || '').toLowerCase();
            const fLogado = (uLogado.funcao || '').toLowerCase();
            const uidLogado = parseInt(uLogado.id);

            // Matches Produtividade.ehGestao logic + extra minhare-area keywords
            const isManagerEffective = pLogado === 'admin' || pLogado === 'administrador' ||
                fLogado.includes('gestor') || fLogado.includes('auditor') ||
                fLogado.includes('lider') || fLogado.includes('coordenador') ||
                fLogado.includes('head') || fLogado.includes('diretor') ||
                uidLogado === 1 || MinhaArea.isAdmin();

            const isAdmin = isManagerEffective;
            const myId = MinhaArea.usuario ? MinhaArea.usuario.id : null;
            const filtroContrato = this.currentFilterContract;

            // 1. Buscar Usuários via SQL
            let sqlUsers = `SELECT id, nome, perfil, funcao, contrato FROM usuarios WHERE ativo = TRUE`;
            let paramsUsers = [];

            if (!isAdmin && myId) {
                sqlUsers += ` AND id = ? `;
                paramsUsers.push(myId);
            }

            const users = await Sistema.query(sqlUsers, paramsUsers);
            if (!users) throw new Error("Erro ao buscar usuários.");

            const forbidden = ['GESTOR', 'AUDITOR', 'ADMIN', 'LIDER', 'COORDENADOR'];

            // [SYNC v4.35] Include all active users for volume calculation
            const allActiveUsers = users.map(u => {
                const p = (u.perfil || '').toUpperCase();
                const f = (u.funcao || '').toUpperCase();
                u.isManagement = forbidden.some(word => p.includes(word) || f.includes(word));
                return u;
            });

            // Filter for the RANKING (Grid visibility)
            const assistentes = allActiveUsers.filter(u => {
                if (!isAdmin) return true;

                if (filtroContrato !== 'TODOS') {
                    const userContrato = (u.contrato || 'CLT').trim().toUpperCase();
                    if (filtroContrato === 'PJ' && !userContrato.includes('PJ')) return false;
                    if (filtroContrato === 'CLT' && userContrato.includes('PJ')) return false;
                }
                return true;
            });

            const userIds = allActiveUsers.map(u => u.id);

            if (userIds.length === 0) {
                this.cacheUsers = [];
                this.statsUsers = {};
                this.renderizarMatriz();
                this.atualizarCardsTopo();
                this.toggleLoading(false);
                this.isLocked = false;
                return;
            }

            // Preparar queries de dados
            const placeholders = this.gerarPlaceholders(userIds);

            // Query Produção
            // [FIX v4.38] GLOBAL FETCH for Managers.
            // If Manager: Fetch entire table (includes inactives/auditors) -> Matches Produtividade (234.146)
            // If Individual: Fetch only their ID -> Matches filtered view
            let sqlProd, paramsProd;
            if (isManagerEffective) {
                // Modo GESTÃO Ativo: Buscando Global (Produtividade Logic)
                sqlProd = `SELECT * FROM producao WHERE data_referencia >= ? AND data_referencia <= ? `;
                paramsProd = [inicio, fim];
            } else {
                sqlProd = `SELECT * FROM producao WHERE usuario_id IN(${placeholders}) AND data_referencia >= ? AND data_referencia <= ? `;
                paramsProd = [...userIds, inicio, fim];
            }

            // Query Assertividade
            const sqlAssert = `SELECT usuario_id, data_referencia, qtd_ok, qtd_campos, assertividade_val FROM assertividade WHERE usuario_id IN(${placeholders}) AND data_referencia >= ? AND data_referencia <= ? `;
            const paramsAssert = [...userIds, inicio, fim];

            // Query Metas
            const anoInicio = new Date(inicio).getFullYear();
            const anoFim = new Date(fim).getFullYear();
            const sqlMetas = `SELECT * FROM metas WHERE usuario_id IN(${placeholders}) AND ano >= ? AND ano <= ? `;
            const paramsMetas = [...userIds, anoInicio, anoFim];

            const [dadosProd, dadosAssert, dadosMetas] = await Promise.all([
                Sistema.query(sqlProd, paramsProd),
                Sistema.query(sqlAssert, paramsAssert),
                Sistema.query(sqlMetas, paramsMetas)
            ]);



            this._lastDadosProd = dadosProd || []; // [FIX v4.36] Store raw data for consistent global total

            if (!dadosProd) throw new Error("Erro ao buscar dados de produção.");
            if (!dadosAssert) throw new Error("Erro ao buscar dados de assertividade.");
            // Metas podem vir vazias, ok.

            this.cacheDados = {};
            this.cacheColunas = [];
            this.statsUsers = {};

            userIds.forEach(uid => {
                this.statsUsers[String(uid)] = {
                    prod: 0,
                    dias_efetivos: 0,
                    metaSum: 0,
                    ok: 0,
                    total: 0,
                    somaMediasMensais: 0,
                    somaMetasMensais: 0,
                    countMesesComDados: 0,
                    // [ALIGNMENT v4.34] New counters for average of averages logic
                    acc_assert_ratio: 0,
                    qtd_auditorias: 0,
                    // [SYNC v4.35] Identity flag
                    isManagement: allActiveUsers.find(u => String(u.id) === String(uid))?.isManagement || false
                };
            });

            let curr = new Date(inicio + 'T12:00:00');
            const end = new Date(fim + 'T12:00:00');

            if (this.isMacroView) {
                curr.setDate(1);
                while (curr <= end) {
                    const key = this.getKeyFromDate(curr, true);
                    if (!this.cacheColunas.find(c => c.key === key)) {
                        this.cacheColunas.push({ key, label: curr.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase() });
                        this.cacheDados[key] = {};
                        userIds.forEach(uid => this.cacheDados[key][String(uid)] = this.novoItemVazio());
                    }
                    curr.setMonth(curr.getMonth() + 1);
                }
            } else {
                while (curr <= end) {
                    const diaSemana = curr.getDay();
                    if (diaSemana !== 0 && diaSemana !== 6) {
                        const key = this.getKeyFromDate(curr, false);
                        const label = String(curr.getDate()).padStart(2, '0');
                        this.cacheColunas.push({ key, label });
                        this.cacheDados[key] = {};
                        userIds.forEach(uid => this.cacheDados[key][String(uid)] = this.novoItemVazio());
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            }

            const mapMetas = {};
            (dadosMetas || []).forEach(m => {
                const k = `${m.usuario_id}-${m.ano}-${m.mes}`;
                mapMetas[k] = { p: m.meta_producao || 0, a: m.meta_assertividade || 0 };
            });

            // 1. PRODUÇÃO
            (dadosProd || []).forEach(reg => {
                const uidStr = String(reg.usuario_id);
                const key = this.getKeyFromDate(reg.data_referencia, this.isMacroView);

                if (this.cacheDados[key] && this.cacheDados[key][uidStr]) {
                    const qtd = Number(reg.quantidade || 0);
                    const fator = reg.fator !== null ? Number(reg.fator) : 1.0;

                    // [FIX] Safe Date Parsing (Sanitize T)
                    const cleanDate = String(reg.data_referencia).split('T')[0];
                    const d = new Date(cleanDate + 'T12:00:00');
                    const mKey = `${reg.usuario_id}-${d.getFullYear()}-${d.getMonth() + 1}`;
                    const metaBase = mapMetas[mKey] ? mapMetas[mKey].p : 0;

                    if (qtd > 0) {
                        this.cacheDados[key][uidStr].prod += qtd;
                        this.cacheDados[key][uidStr].dias_efetivos += fator;

                        if (this.statsUsers[uidStr]) {
                            this.statsUsers[uidStr].prod += qtd;
                            this.statsUsers[uidStr].dias_efetivos += fator;
                            this.statsUsers[uidStr].metaSum += (metaBase * fator);
                        }
                    }
                    this.cacheDados[key][uidStr].metaProd = metaBase;
                    if (mapMetas[mKey]) this.cacheDados[key][uidStr].metaAssert = mapMetas[mKey].a;
                }
            });

            // 2. ASSERTIVIDADE
            // [ALIGNMENT v4.34] Logic Aligned with Produtividade (Average of Averages)
            (dadosAssert || []).forEach(reg => {
                const uidStr = String(reg.usuario_id);
                if (!this.statsUsers[uidStr]) return;

                // Alignment Filter: (auditora_nome IS NOT NULL OR assertividade_val IS NOT NULL)
                if (!reg.auditora_nome && !reg.assertividade_val) return;

                const valParsed = this.parseAssertiveness(reg.assertividade_val);
                if (valParsed === null) return; // Skip invalid/empty values

                const ratio = valParsed / 100.0;
                const key = this.getKeyFromDate(reg.data_referencia, this.isMacroView);

                if (this.cacheDados[key] && this.cacheDados[key][uidStr]) {
                    this.cacheDados[key][uidStr].acc_assert_ratio += ratio;
                    this.cacheDados[key][uidStr].qtd_auditorias += 1;

                    this.statsUsers[uidStr].acc_assert_ratio += ratio;
                    this.statsUsers[uidStr].qtd_auditorias += 1;
                }
            });

            // 3. FINALIZAÇÃO E CÁLCULO DA MÉDIA DAS MÉDIAS (MACRO)
            Object.keys(this.cacheDados).forEach(k => {
                Object.keys(this.cacheDados[k]).forEach(uid => {
                    const celula = this.cacheDados[k][uid];
                    // [ALIGNMENT v4.34] Calculate average from ratio sum
                    if (celula.qtd_auditorias > 0) {
                        celula.assert = (celula.acc_assert_ratio / celula.qtd_auditorias);
                    } else {
                        celula.assert = null;
                    }

                    const divisor = celula.dias_efetivos > 0 ? celula.dias_efetivos : 1;
                    if (celula.prod > 0) {
                        celula.velocidade = Math.round(celula.prod / divisor);

                        // SE FOR MACRO, ACUMULA PARA A MÉDIA DAS MÉDIAS DO USUÁRIO
                        if (this.isMacroView && this.statsUsers[uid]) {
                            this.statsUsers[uid].somaMediasMensais += celula.velocidade;
                            this.statsUsers[uid].somaMetasMensais += (celula.metaProd || 0);
                            this.statsUsers[uid].countMesesComDados++;
                        }
                    } else {
                        celula.velocidade = 0;
                    }
                });
            });

            // [SYNC v4.35] Filter cacheUsers for the ranking: Strictly Assistants
            // Exclude Gestora, Auditora, Admin regardless of production
            this.cacheUsers = allActiveUsers.filter(u => {
                const funcao = (u.funcao || '').toUpperCase();
                const perfil = (u.perfil || '').toUpperCase();
                const rolesToExclude = ['GESTORA', 'AUDITORA', 'ADMIN', 'ADMINISTRADOR'];

                if (rolesToExclude.some(r => funcao.includes(r) || perfil.includes(r))) return false;
                if (u.isManagement) return false; // Safety check if isManagement is set

                return true;
            });

            this.atualizarCardsTopo();

            if (this.viewState === 'DETAIL' && this.selectedUserId) {
                this.renderizarDashboardAssistente(this.selectedUserId);
            } else {
                this.reordenarEExibir();
            }

            const elPeriodo = document.getElementById('metas-periodo-label');
            const elTotal = document.getElementById('metas-total-users');
            if (elPeriodo) elPeriodo.innerText = `Período: ${new Date(inicio).toLocaleDateString('pt-BR')} a ${new Date(fim).toLocaleDateString('pt-BR')} `;
            if (elTotal) elTotal.innerText = `${assistentes.length} Assistentes no Ranking(${this.currentFilterContract})`;

        } catch (err) {
            console.error("❌ ERRO MATRIZ:", err);
            const tbody = document.getElementById('grade-equipe-body');
            if (tbody) tbody.innerHTML = `< tr > <td colspan="100" class="p-8 text-center text-rose-500 font-bold">Erro: ${err.message}</td></tr > `;
        } finally {
            this.toggleLoading(false);
            this.isLocked = false;
        }
    },

    // [ALIGNMENT v4.34] Helper for parsing percentage strings
    parseAssertiveness: function (val) {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val === 'number') return val;
        try {
            const clean = String(val).replace('%', '').replace(',', '.').trim();
            const num = parseFloat(clean);
            return isNaN(num) ? null : num;
        } catch (e) { return null; }
    },

    novoItemVazio: function () { return { prod: 0, dias_efetivos: 0, velocidade: 0, acc_assert_ratio: 0, qtd_auditorias: 0, assert: null, metaProd: 0, metaAssert: 0 }; },

    atualizarCardsTopo: function () {
        let rawGlobalProd = 0;
        (this._lastDadosProd || []).forEach(p => rawGlobalProd += (Number(p.quantidade) || 0));

        let globalProd = 0;
        let globalOk = 0;
        let globalTotalAud = 0;

        let somaDasMediasIndividuais = 0;
        let contadorUsuariosComDados = 0;
        let globalDiasEfetivosMicro = 0;

        // For Assertividade Dashboard
        let countTotalAuditados = 0;
        let totalAcertos = 0;
        let totalErrosReais = 0;
        let countErrosGupy = 0;
        let countErrosNdf = 0;
        let countNdfEmpresa = 0;

        Object.values(this.statsUsers).forEach(s => {
            // [SYNC v4.35] Volume is GLOBAL (All production)
            globalProd += s.prod;

            // [ALIGNMENT v4.34] Aggregate Global Assertiveness
            globalOk += s.acc_assert_ratio;
            globalTotalAud += s.qtd_auditorias;

            // For Assertividade Dashboard
            countTotalAuditados += s.qtd_auditorias;
            totalAcertos += (s.acc_assert_ratio * s.qtd_auditorias); // Sum of (ratio * count)
            totalErrosReais += (s.qtd_auditorias - (s.acc_assert_ratio * s.qtd_auditorias)); // Total - Acertos
            // Note: countErrosGupy, countErrosNdf, countNdfEmpresa are calculated in MinhaArea.Comparativo.carregar()

            // [SYNC v4.35] Divisor for Velocity (Effort) is only for ASSISTANTS (Non-Management)
            if (!s.isManagement) {
                if (this.isMacroView) {
                    // Cálculo da Média das Médias para o Card de Equipe
                    const divisor = s.countMesesComDados > 0 ? s.countMesesComDados : 1;
                    const mediaAcumuladaUsuario = s.somaMediasMensais / divisor;
                    if (s.prod > 0) {
                        somaDasMediasIndividuais += mediaAcumuladaUsuario;
                        contadorUsuariosComDados++;
                    }
                } else {
                    globalDiasEfetivosMicro += s.dias_efetivos;
                }
            }
        });

        const kpiVolume = rawGlobalProd;

        // [ALIGNMENT v4.41] Sync Global Velocity Card with Produtividade Dashboard Logic
        let kpiVelocidade = 0;
        if (this.isMacroView) {
            kpiVelocidade = contadorUsuariosComDados > 0 ? Math.round(somaDasMediasIndividuais / contadorUsuariosComDados) : 0;
        } else {
            // Logic: Total Prod / (Assistants count * (Elapsed Days - 1))
            const hoje = new Date().toISOString().split('T')[0];
            const range = MinhaArea.getDatasFiltro();
            let diasContagem = this.cacheColunas.length; // Dias úteis no período selecionado

            if (hoje >= range.inicio && hoje <= range.fim && typeof MinhaArea.Geral?.contarDiasUteis === 'function') {
                diasContagem = MinhaArea.Geral.contarDiasUteis(range.inicio, hoje);
            }

            // Assume CLT rule for global view (-1 day)
            const diasParaVelocidade = Math.max(0, diasContagem - 1);
            const hcParaVelocidade = Object.values(this.statsUsers).filter(s => !s.isManagement).length || 1;
            const divisor = hcParaVelocidade * diasParaVelocidade;

            kpiVelocidade = divisor > 0 ? Math.round(globalProd / divisor) : (globalDiasEfetivosMicro > 0 ? Math.round(globalProd / globalDiasEfetivosMicro) : 0);
        }

        // [ALIGNMENT v4.34] Global Average = Sum(Ratios) / Count(Audits)
        const kpiAssert = globalTotalAud > 0 ? (globalOk / globalTotalAud) * 100 : 0;

        const elProd = document.getElementById('card-ranking-prod');
        const elMedia = document.getElementById('card-ranking-media');
        const elAssert = document.getElementById('card-ranking-assert');

        if (elProd) elProd.innerText = kpiVolume.toLocaleString('pt-BR');
        if (elMedia) elMedia.innerText = kpiVelocidade.toLocaleString('pt-BR');
        if (elAssert) elAssert.innerText = (globalTotalAud > 0) ? kpiAssert.toFixed(2) + '%' : '--%';

        // Update Assertividade Dashboard cards (if they exist)
        const elTotalAuditados = document.getElementById('card-total-auditados');
        const elTotalAcertos = document.getElementById('card-total-acertos');
        const elTotalErros = document.getElementById('card-total-erros');
        const elErrosGupy = document.getElementById('card-erros-gupy');
        const elErrosNdf = document.getElementById('card-erros-ndf');
        const elEmpresaValidar = document.getElementById('card-empresa-validar');

        if (elTotalAuditados) elTotalAuditados.innerText = countTotalAuditados.toLocaleString('pt-BR');
        if (elTotalAcertos) elTotalAcertos.innerText = totalAcertos.toLocaleString('pt-BR');
        if (elTotalErros) elTotalErros.innerText = totalErrosReais.toLocaleString('pt-BR');
        if (elErrosGupy) elErrosGupy.innerText = countErrosGupy.toLocaleString('pt-BR');
        if (elErrosNdf) elErrosNdf.innerText = countErrosNdf.toLocaleString('pt-BR');
        if (elEmpresaValidar) elEmpresaValidar.innerText = countNdfEmpresa.toLocaleString('pt-BR');
        // GAP Assistentes: diferença entre total auditados e total de acertos
        const elGap = document.getElementById('card-gap-assistentes');
        if (elGap) elGap.innerText = (countTotalAuditados - totalAcertos).toLocaleString('pt-BR');
    },

    renderizarMatriz: function () {
        if (this.viewState === 'DETAIL') return;

        const thead = document.getElementById('grade-equipe-header');
        const tbody = document.getElementById('grade-equipe-body');
        if (!thead || !tbody) return;

        const isAssert = this.activeSubTab === 'ASSERT';
        const subLabel = isAssert ? '% Assertividade' : (this.isMacroView ? 'Média/Mês' : 'Média/Dia');
        const bgHeader = isAssert ? 'bg-emerald-50' : 'bg-slate-100';

        let htmlHeader = `<th class="px-4 py-3 ${bgHeader} border-b border-r border-slate-300 min-w-[200px] sticky left-0 top-0 z-[60] text-left text-slate-700 shadow-md">
    <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
            <span>${isAssert ? 'RANKING (QUALIDADE)' : 'RANKING (VELOCIDADE)'}</span>
            <select onchange="MinhaArea.Metas.mudarFiltroContrato(this.value)" class="text-[10px] font-bold text-slate-600 bg-white border border-slate-300 rounded px-1 py-0.5 cursor-pointer">
                <option value="TODOS" ${this.currentFilterContract === 'TODOS' ? 'selected' : ''}>Todos</option>
                <option value="CLT" ${this.currentFilterContract === 'CLT' ? 'selected' : ''}>CLT</option>
                <option value="PJ" ${this.currentFilterContract === 'PJ' ? 'selected' : ''}>PJ</option>
            </select>
        </div>
        <span class="text-[9px] text-slate-400 font-normal">${subLabel}</span>
    </div>
        </th>`;

        const corAcum = isAssert ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200';
        htmlHeader += `<th class="px-2 py-3 bg-white border-b border-r border-slate-200 min-w-[70px] text-center font-bold text-xs text-slate-600 sticky top-0 z-40">PROD.TOTAL</th>`;
        htmlHeader += `<th class="px-2 py-3 ${corAcum} border-b border-r border-slate-200 min-w-[80px] text-center font-bold text-xs sticky top-0 z-40" title="Média das Médias do Período">ACUMULADO</th>`;

        this.cacheColunas.forEach(col => {
            htmlHeader += `<th class="px-1 py-3 bg-slate-50 border-b border-r border-slate-200 min-w-[60px] text-center font-bold text-xs text-slate-600 sticky top-0 z-40">${col.label}</th>`;
        });
        thead.innerHTML = htmlHeader;

        let htmlBody = '';
        this.cacheUsers.forEach((u, index) => {
            const pos = index + 1;
            let medalha = '';
            if (pos === 1) medalha = '🥇'; else if (pos === 2) medalha = '🥈'; else if (pos === 3) medalha = '🥉';

            const stats = this.statsUsers[String(u.id)] || { prod: 0, dias_efetivos: 0, metaSum: 0, ok: 0, total: 0, somaMediasMensais: 0, somaMetasMensais: 0, countMesesComDados: 0 };

            let cellTotal = '<span class="text-slate-300">-</span>';
            let cellMedia = '<span class="text-slate-300">-</span>';

            if (isAssert) {
                // [ALIGNMENT v4.34] Use new counters for display
                if (stats.qtd_auditorias > 0) cellTotal = `<span class="font-bold text-slate-600">${stats.qtd_auditorias}</span>`;

                const assertGeral = stats.qtd_auditorias > 0 ? (stats.acc_assert_ratio / stats.qtd_auditorias) * 100 : 0;

                if (stats.qtd_auditorias > 0) {
                    const corVal = assertGeral >= 97 ? 'text-emerald-700' : 'text-rose-600';
                    cellMedia = `<div class="${corVal} font-black text-sm leading-none">${assertGeral.toFixed(1)}%</div>`;
                }
            } else {
                if (stats.prod > 0) cellTotal = `<span class="font-bold text-slate-700">${stats.prod.toLocaleString('pt-BR')}</span>`;

                // LÓGICA DE MÉDIA ACUMULADA: MÉDIA DAS MÉDIAS (MACRO)
                const divisor = this.isMacroView ? (stats.countMesesComDados || 1) : (stats.dias_efetivos || 1);
                const avgVel = this.isMacroView ? Math.round(stats.somaMediasMensais / divisor) : Math.round(stats.prod / divisor);

                // Meta Média
                const avgMeta = this.isMacroView ? (stats.somaMetasMensais / divisor) : (stats.metaSum / divisor);
                const avgPct = avgMeta > 0 ? (avgVel / avgMeta * 100) : 0;

                if (stats.prod > 0) {
                    const corVal = avgVel >= avgMeta ? 'text-blue-700' : 'text-rose-700';
                    const corBadge = avgPct >= 100 ? 'bg-blue-200 text-blue-800' : 'bg-rose-100 text-rose-700 border border-rose-200';
                    cellMedia = `<div class="${corVal} font-black text-sm leading-none">${avgVel.toLocaleString('pt-BR')}</div>
    <div class="mt-1"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${corBadge}">${avgPct.toFixed(0)}%</span></div>`;
                }
            }

            htmlBody += `<tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-4 py-3 border-b border-r border-slate-300 sticky left-0 bg-white group-hover:bg-slate-50 z-50">
                    <button onclick="MinhaArea.Metas.abrirDetalhe('${u.id}')" class="text-left w-full hover:text-blue-600 font-bold text-slate-700 text-xs transition flex items-center justify-between">
                        <span class="truncate">${pos}. ${u.nome.split(' ')[0]} ${medalha}</span>
                        <i class="fas fa-chart-line opacity-0 group-hover:opacity-100 text-blue-400"></i>
                    </button>
                </td>
                <td class="px-2 py-2 border-b border-r border-slate-100 bg-white text-center align-middle">${cellTotal}</td>
                <td class="px-2 py-2 border-b border-r border-slate-100 bg-slate-50/50 text-center align-middle">${cellMedia}</td>`;

            this.cacheColunas.forEach(col => {
                const dados = this.cacheDados[col.key][String(u.id)];
                let cellHtml = '<span class="text-slate-200">-</span>';
                let subHtml = '';

                if (isAssert) {
                    if (dados && dados.qtd_auditorias > 0 && dados.assert !== null) {
                        const val = dados.assert * 100;
                        const batido = val >= dados.metaAssert;
                        // Color logic: Green if hit target, Yellow/Amber if close (within 5%), Red if far
                        let colorClass = 'text-rose-600';
                        if (batido) colorClass = 'text-emerald-600';
                        else if (val >= (dados.metaAssert - 5)) colorClass = 'text-amber-500';

                        cellHtml = `<div class="${colorClass} font-bold cursor-help" title="${dados.qtd_auditorias} auditados">${val.toFixed(0)}%</div>`;
                    }
                } else {
                    if (dados && dados.velocidade > 0) {
                        const batido = dados.velocidade >= dados.metaProd;
                        cellHtml = `<div class="${batido ? 'text-blue-600' : 'text-rose-600'} font-bold">${dados.velocidade}</div>`;
                        if (dados.metaProd > 0) {
                            const pct = (dados.velocidade / dados.metaProd) * 100;
                            const corBadge = pct >= 100 ? 'bg-blue-100 text-blue-700' : 'bg-rose-50 text-rose-600 border border-rose-200';
                            subHtml = `<div class="mt-1"><span class="px-1 py-0.5 rounded text-[9px] font-bold ${corBadge}">${pct.toFixed(0)}%</span></div>`;
                        }
                    }
                }
                htmlBody += `<td class="px-1 py-2 border-b border-r border-slate-100 text-center align-middle h-12">${cellHtml}${subHtml}</td>`;
            });
            htmlBody += `</tr>`;
        });
        tbody.innerHTML = htmlBody;
    },

    renderizarDashboardAssistente: function (uid) {
        // [REF_FIX] Agora renderiza no Modal de Evolução (Barras + Linha)
        const user = this.cacheUsers.find(u => String(u.id) === String(uid));
        if (!user) return;

        document.getElementById('evolucao-nome').innerText = user.nome;
        document.getElementById('evolucao-funcao').innerText = user.funcao || 'Assistente';

        const labels = [];
        const dataProd = [];
        const dataMetaProd = [];
        const dataAssert = [];
        const dataMetaAssert = [];

        this.cacheColunas.forEach(col => {
            labels.push(col.label);
            const dados = this.cacheDados[col.key]?.[String(uid)] || { velocidade: 0, assert: null, metaProd: 0, metaAssert: 0 };

            dataProd.push(dados.velocidade);
            dataMetaProd.push(dados.metaProd || 0); // Garante que usa a meta individual do cache
            dataAssert.push(dados.assert !== null ? (dados.assert * 100) : null);
            dataMetaAssert.push(dados.metaAssert || 0);
        });

        const stats = this.statsUsers[String(uid)] || { prod: 0, dias_efetivos: 0, somaMediasMensais: 0, countMesesComDados: 0, acc_assert_ratio: 0, qtd_auditorias: 0 };
        const divisor = this.isMacroView ? (stats.countMesesComDados || 1) : (stats.dias_efetivos || 1);
        const media = this.isMacroView ? Math.round(stats.somaMediasMensais / divisor) : Math.round(stats.prod / divisor);

        // Populate KPIs in Modal Header
        document.getElementById('evolucao-kpi-media').innerText = media;
        document.getElementById('evolucao-kpi-total').innerText = stats.prod.toLocaleString('pt-BR');

        // Chart 1: Produção (BARRAS) - Evolution
        if (this.chartDetailProd) this.chartDetailProd.destroy();
        const ctxProd = document.getElementById('canvas-evolucao-prod').getContext('2d');
        this.chartDetailProd = new Chart(ctxProd, {
            type: 'bar', // [REQ] Barras para evolução
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Meta',
                        data: dataMetaProd,
                        type: 'line',
                        borderColor: '#94a3b8',
                        borderWidth: 2,
                        pointRadius: 0,
                        borderDash: [5, 5],
                        order: 1
                    },
                    {
                        label: 'Produção',
                        data: dataProd,
                        backgroundColor: '#2563eb',
                        borderRadius: 4,
                        order: 2
                    }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });

        // Chart 2: Qualidade (LINHA)
        if (this.chartDetailAssert) this.chartDetailAssert.destroy();
        const ctxAssert = document.getElementById('canvas-evolucao-assert').getContext('2d');
        this.chartDetailAssert = new Chart(ctxAssert, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Meta Qualidade', data: dataMetaAssert, borderColor: '#10b981', borderWidth: 2, pointRadius: 0, borderDash: [2, 2], fill: false },
                    { label: 'Real (%)', data: dataAssert, borderColor: '#059669', backgroundColor: '#d1fae5', borderWidth: 3, tension: 0.3, fill: true, spanGaps: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 80, max: 105 } } }
        });
    },

    abrirDetalhe: function (uid) {
        // [REF_FIX] Abre o Modal de Evolução (Individual) em vez do Comparativo
        this.renderizarDashboardAssistente(uid);
        const modal = document.getElementById('modal-evolucao-metas');
        if (modal) {
            modal.classList.remove('hidden', 'pointer-events-none');
            setTimeout(() => modal.classList.add('active'), 10);
        }
    },

    // [NEW] Abre o modal de comparação geral ao clicar nos cards de resumo
    abrirModalGraficosGerais: function () {
        this.popularSelectsManual();

        let id1, id2, id3;
        const total = this.cacheUsers.length;

        // Se for Admin/Gestor, pega o TOP 3 (assumindo que cacheUsers está ordenado pelo ranking ou ordem alfabética)
        // Idealmente deveríamos ordenar por produção aqui, mas usaremos a ordem atual da lista
        if (MinhaArea.isAdmin()) {
            // Ordena temporariamente para pegar os top performance se não estiver ordenado
            // Mas vamos respeitar a ordem visual atual (que deve ser o ranking)
            if (total > 0) id1 = this.cacheUsers[0].id;
            if (total > 1) id2 = this.cacheUsers[1].id;
            if (total > 2) id3 = this.cacheUsers[2].id;
        } else {
            // Se for assistente, pega a si mesmo
            const myId = MinhaArea.usuario.id;
            // Verifica se o usuário está na lista (pode ter sido filtrado)
            const exists = this.cacheUsers.find(u => String(u.id) === String(myId));
            if (exists) {
                id1 = myId;
            } else {
                // Fallback: Se não estiver na lista (ex: filtro ativo), pega o primeiro
                if (total > 0) id1 = this.cacheUsers[0].id;
            }
            id2 = null;
            id3 = null;
        }

        const el1 = document.getElementById('comp-sel-1');
        const el2 = document.getElementById('comp-sel-2');
        const el3 = document.getElementById('comp-sel-3');

        if (el1) el1.value = id1 || '';
        if (el2) el2.value = id2 || '';
        if (el3) el3.value = id3 || '';

        this.atualizarComparativoManual();

        const modal = document.getElementById('modal-comparativo-metas');
        if (modal) {
            modal.classList.remove('hidden', 'pointer-events-none');
            setTimeout(() => modal.classList.add('active'), 10);
        }
    },

    abrirComparativoVizinhos: function (selectedUid) {
        const index = this.cacheUsers.findIndex(u => u.id == selectedUid);
        if (index === -1) return;
        let id1, id2, id3;
        const total = this.cacheUsers.length;
        if (total <= 1) { id1 = selectedUid; id2 = null; id3 = null; }
        else if (total <= 2) { id1 = this.cacheUsers[0].id; id2 = this.cacheUsers[1].id; id3 = null; }
        else {
            if (index === 0) { id1 = this.cacheUsers[0].id; id2 = this.cacheUsers[1].id; id3 = this.cacheUsers[2].id; }
            else if (index === total - 1) { id1 = this.cacheUsers[total - 3].id; id2 = this.cacheUsers[total - 2].id; id3 = this.cacheUsers[total - 1].id; }
            else { id1 = this.cacheUsers[index - 1].id; id2 = this.cacheUsers[index].id; id3 = this.cacheUsers[index + 1].id; }
        }
        this.popularSelectsManual();
        const el1 = document.getElementById('comp-sel-1'); const el2 = document.getElementById('comp-sel-2');
        if (el1) el1.value = id1 || ''; if (el2) el2.value = id2 || '';
        this.atualizarComparativoManual();
        const modal = document.getElementById('modal-comparativo-metas');
        if (modal) { modal.classList.remove('hidden', 'pointer-events-none'); setTimeout(() => modal.classList.add('active'), 10); }
    },

    popularSelectsManual: function () {
        const createOpts = () => '<option value="">(Vazio)</option>' + this.cacheUsers.map(u => `<option value="${u.id}">${u.nome}</option>`).join('');
        ['comp-sel-1', 'comp-sel-2'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = createOpts(); });
    },

    atualizarComparativoManual: function (isManualGran) {
        const id1 = document.getElementById('comp-sel-1')?.value;
        const id2 = document.getElementById('comp-sel-2')?.value;

        const selGran = document.getElementById('comp-granularidade');
        let granularidade;

        if (isManualGran && selGran) {
            granularidade = selGran.value;
        } else {
            // Automático baseado no range de datas
            granularidade = this._granularidadeDoPeriodo();
            if (selGran) selGran.value = granularidade;
        }

        const ids = [id1, id2].filter(id => id);
        this.renderizarGraficosComparativos(ids, granularidade);
    },

    _granularidadeDoPeriodo: function () {
        try {
            const datas = MinhaArea.getDatasFiltro();
            if (!datas) return 'mes';
            const diffDias = (new Date(datas.fim) - new Date(datas.inicio)) / (1000 * 60 * 60 * 24);
            if (diffDias <= 45) return 'dia';
            if (diffDias <= 70) return 'semana';
            if (diffDias <= 400) return 'mes';
            if (diffDias <= 730) return 'trimestre';
            if (diffDias <= 1095) return 'semestre';
            return 'ano';
        } catch (e) { return 'mes'; }
    },

    fecharModalComparativo: function () {
        const modal = document.getElementById('modal-comparativo-metas');
        if (modal) { modal.classList.remove('active'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('pointer-events-none'); }, 300); }
    },

    fecharModalEvolucao: function () {
        const modal = document.getElementById('modal-evolucao-metas');
        if (modal) { modal.classList.remove('active'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('pointer-events-none'); }, 300); }
    },

    // Agrupa dados por granularidade (dia, semana, mês, trimestre, semestre, ano)
    _agruparPorGranularidade: function (uid, granularidade) {
        const grupos = {};

        // Se o usuário escolher Trimestre/Semestre/Ano, mostramos os meses internos dele
        const forceMes = ['trimestre', 'semestre', 'ano'].includes(granularidade);
        const actualGran = forceMes ? 'mes' : granularidade;

        this.cacheColunas.forEach(col => {
            const dados = this.cacheDados[col.key]?.[String(uid)];
            let gKey = col.label;

            // Lógica de agrupamento baseada na granularidade efetiva
            if (actualGran === 'semana') {
                const d = new Date((col.key.length === 7 ? col.key + '-01' : col.key) + 'T12:00:00');
                const datas = MinhaArea.getDatasFiltro();
                let weekNum = 1;
                if (datas) {
                    const start = new Date(datas.inicio + 'T12:00:00');
                    const diff = d - start;
                    weekNum = Math.floor(diff / (7 * 86400000)) + 1;
                }
                gKey = `Sem. ${String(Math.max(1, weekNum)).padStart(2, '0')}`;
            } else if (actualGran === 'trimestre') {
                const partes = col.key.split('-');
                const mes = partes[1] ? parseInt(partes[1]) : 1;
                gKey = `${partes[0]} T${Math.ceil(mes / 3)}`;
            } else if (actualGran === 'semestre') {
                const partes = col.key.split('-');
                const mes = partes[1] ? parseInt(partes[1]) : 1;
                gKey = `${partes[0]} S${mes <= 6 ? 1 : 2}`;
            } else if (actualGran === 'ano') {
                gKey = col.key.split('-')[0];
            } else if (actualGran === 'dia') {
                gKey = col.label; // DD/MM
            } else {
                // Mês: usa o label Jan/24 etc
                gKey = col.label;
            }

            if (!grupos[gKey]) {
                grupos[gKey] = { somaVel: 0, countVel: 0, somaAssert: 0, countAssert: 0, start: col.key, end: col.key };
            }
            const g = grupos[gKey];
            if (col.key < g.start) g.start = col.key;
            if (col.key > g.end) g.end = col.key;

            if (dados) {
                if (dados.velocidade !== null && dados.velocidade !== undefined) { g.somaVel += (dados.velocidade || 0); g.countVel++; }
                if (dados.assert !== null && dados.assert !== undefined && dados.qtd_auditorias > 0) { g.somaAssert += (dados.assert * 100); g.countAssert++; }
            }
        });

        const labels = Object.keys(grupos);
        const prodData = labels.map(k => grupos[k].countVel > 0 ? Math.round(grupos[k].somaVel / grupos[k].countVel) : null);
        const assertData = labels.map(k => grupos[k].countAssert > 0 ? parseFloat((grupos[k].somaAssert / grupos[k].countAssert).toFixed(2)) : null);
        const ranges = labels.map(k => ({ start: grupos[k].start, end: grupos[k].end }));

        return { labels, prodData, assertData, ranges };
    },

    renderizarGraficosComparativos: function (userIds, granularidade) {
        granularidade = granularidade || 'mes';
        const colors = ['#3b82f6', '#10b981'];
        const colorsLight = ['rgba(59,130,246,0.18)', 'rgba(16,185,129,0.18)'];

        // Collect grouped data per user
        const userData = userIds.map((uid, idx) => {
            const user = this.cacheUsers.find(u => String(u.id) === String(uid));
            const grouped = this._agruparPorGranularidade(uid, granularidade);
            return { uid, user, grouped, color: colors[idx] || '#94a3b8', colorLight: colorsLight[idx] || 'rgba(100,100,100,0.1)' };
        });

        // Build common labels (union of all)
        let allLabels = [];
        userData.forEach(d => { d.grouped.labels.forEach(l => { if (!allLabels.includes(l)) allLabels.push(l); }); });

        // Renderiza VS Panel (novo design com mini charts no card central + grids por período)
        this._renderizarVSPanel(userData, allLabels);
    },

    drillDownComparativo: function (label, start, end) {
        // Tenta encontrar os elementos de filtro global
        const elAno = document.getElementById('sel-ano');
        const elMes = document.getElementById('sel-mes');
        const elSemana = document.getElementById('sel-semana');
        const selGran = document.getElementById('comp-granularidade');

        // Se for uma semana específica, tentamos setar o filtro global de semana
        if (label.startsWith('Sem.')) {
            MinhaArea.mudarPeriodo('semana');
            if (elSemana) {
                // Formato do valor no select: "YYYY-MM-DD|YYYY-MM-DD"
                // Se não encontrar o valor exato, usamos o modo 'dia' no modal comparativo mesmo
                const valor = `${start}|${end}`;
                let found = false;
                for (let i = 0; i < elSemana.options.length; i++) {
                    if (elSemana.options[i].value === valor) {
                        elSemana.selectedIndex = i;
                        found = true;
                        break;
                    }
                }
            }
        }
        // Se for mês ou outros, mudamos o range global conforme possível
        // Mas para simplificar o Drill Down imediato sem perder o contexto do modal:
        // Apenas mudamos para a granularidade 'dia' e deixamos o range atual se for macro

        if (selGran) {
            selGran.value = 'dia';
            this.atualizarComparativoManual(true);
        }
    },

    _renderizarVSPanel: function (userData, allLabels) {
        const vsCards = document.getElementById('gap-vs-cards');
        const gridsContainer = document.getElementById('gap-grids-container');

        if (userData.length < 2 || !userData[0].user || !userData[1].user) {
            if (vsCards) vsCards.classList.add('hidden');
            if (gridsContainer) gridsContainer.classList.add('hidden');
            return;
        }

        const nome1 = userData[0].user.nome.split(' ')[0];
        const nome2 = userData[1].user.nome.split(' ')[0];

        // Médias globais
        const prodVals1 = userData[0].grouped.prodData.filter(v => v !== null);
        const prodVals2 = userData[1].grouped.prodData.filter(v => v !== null);
        const assertVals1 = userData[0].grouped.assertData.filter(v => v !== null);
        const assertVals2 = userData[1].grouped.assertData.filter(v => v !== null);

        const med1P = prodVals1.reduce((s, v) => s + v, 0) / (prodVals1.length || 1);
        const med2P = prodVals2.reduce((s, v) => s + v, 0) / (prodVals2.length || 1);
        const med1A = assertVals1.reduce((s, v) => s + v, 0) / (assertVals1.length || 1);
        const med2A = assertVals2.reduce((s, v) => s + v, 0) / (assertVals2.length || 1);

        const gapP = Math.abs(med1P - med2P);
        const gapA = Math.abs(med1A - med2A);
        const liderP = med1P >= med2P ? nome1 : nome2;
        const liderA = med1A >= med2A ? nome1 : nome2;
        const winner = (med1P + med1A) >= (med2P + med2A) ? nome1 : nome2;

        // ── Grids KPIs & Summaries ─────────────────────────────────
        if (vsCards) vsCards.classList.remove('hidden');
        if (gridsContainer) {
            gridsContainer.classList.remove('hidden');

            // Títulos das tabelas
            const elG1Title = document.getElementById('grid-a1-title');
            const elG2Title = document.getElementById('grid-a2-title');
            if (elG1Title) elG1Title.textContent = nome1;
            if (elG2Title) elG2Title.textContent = nome2;

            // Mini resumos nos headers das tabelas
            const elMiniA1P = document.getElementById('mini-a1-prod');
            const elMiniA1A = document.getElementById('mini-a1-assert');
            const elMiniA2P = document.getElementById('mini-a2-prod');
            const elMiniA2A = document.getElementById('mini-a2-assert');

            if (elMiniA1P) elMiniA1P.textContent = `${Math.round(med1P)} pcs`;
            if (elMiniA1A) elMiniA1A.textContent = `${med1A.toFixed(1)}%`;
            if (elMiniA2P) elMiniA2P.textContent = `${Math.round(med2P)} pcs`;
            if (elMiniA2A) elMiniA2A.textContent = `${med2A.toFixed(1)}%`;

            // Badge de Vencedor e GAP Central
            const badge = document.getElementById('gap-winner-badge');
            if (badge) badge.textContent = `🏆 ${winner} é a mais performante`;

            const elGapP = document.getElementById('gap-center-prod');
            const elGapA = document.getElementById('gap-center-assert');
            if (elGapP) elGapP.textContent = `Δ ${Math.round(gapP)}`;
            if (elGapA) elGapA.textContent = `Δ ${gapA.toFixed(1)}pp`;

            const elLiderP = document.getElementById('gap-center-prod-lider');
            const elLiderA = document.getElementById('gap-center-assert-lider');
            if (elLiderP) elLiderP.textContent = `${liderP} produz mais`;
            if (elLiderA) elLiderA.textContent = `${liderA} tem maior qualidade`;

            // Legendas dos gráficos
            const leg1 = document.getElementById('legend-a1-label');
            const leg2 = document.getElementById('legend-a2-label');
            if (leg1) leg1.textContent = `${nome1} (+)`;
            if (leg2) leg2.textContent = `${nome2} (-)`;
        }

        // ── Gráficos Comparativos (Duas Linhas: A1 vs A2) ──────────────────────
        setTimeout(() => {
            if (this.chartGapProd) { this.chartGapProd.destroy(); this.chartGapProd = null; }
            if (this.chartGapAssert) { this.chartGapAssert.destroy(); this.chartGapAssert = null; }

            const getSeries = (userIdx, dataKey) => allLabels.map(l => {
                const i = userData[userIdx].grouped.labels.indexOf(l);
                return i >= 0 ? userData[userIdx].grouped[dataKey][i] : 0;
            });

            const pS1 = getSeries(0, 'prodData');
            const pS2 = getSeries(1, 'prodData');
            const aS1 = getSeries(0, 'assertData');
            const aS2 = getSeries(1, 'assertData');

            const createConfig = (label1, data1, label2, data2, isPct) => {
                return {
                    type: 'line',
                    data: {
                        labels: allLabels,
                        datasets: [
                            {
                                label: label1,
                                data: data1,
                                borderColor: '#3b82f6',
                                backgroundColor: 'rgba(59,130,246,0.1)',
                                fill: true, borderWidth: 3, pointRadius: 3, tension: 0.3
                            },
                            {
                                label: label2,
                                data: data2,
                                borderColor: '#10b981',
                                backgroundColor: 'rgba(16,185,129,0.1)',
                                fill: true, borderWidth: 3, pointRadius: 3, tension: 0.3
                            }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: true, mode: 'index', intersect: false, backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                callbacks: {
                                    label: ctx => {
                                        const val = ctx.parsed.y;
                                        const other = ctx.datasetIndex === 0 ? data2[ctx.dataIndex] : data1[ctx.dataIndex];
                                        const diff = val - (other || 0);
                                        const prefix = diff > 0 ? '+' : '';
                                        const unit = isPct ? '%' : ' pcs';
                                        const dUnit = isPct ? 'pp' : '';
                                        return `${ctx.dataset.label}: ${isPct ? val.toFixed(1) : val}${unit} (${prefix}${isPct ? diff.toFixed(1) : diff}${dUnit})`;
                                    }
                                }
                            }
                        },
                        onClick: (e, elements) => {
                            if (elements.length > 0) {
                                const idx = elements[0].index;
                                const label = allLabels[idx];
                                const range = userData[0].grouped.ranges[idx];
                                if (range) this.drillDownComparativo(label, range.start, range.end);
                            }
                        },
                        scales: {
                            x: { display: true, grid: { display: false }, ticks: { color: 'rgba(71, 85, 105, 0.6)', font: { size: 8 } } },
                            y: { display: true, grid: { color: 'rgba(71, 85, 105, 0.08)' }, ticks: { color: 'rgba(71, 85, 105, 0.6)', font: { size: 8 } } }
                        }
                    }
                };
            };

            const ctxP = document.getElementById('chart-gap-prod');
            if (ctxP) this.chartGapProd = new Chart(ctxP, createConfig(nome1, pS1, nome2, pS2, false));

            const ctxA = document.getElementById('chart-gap-assert');
            if (ctxA) this.chartGapAssert = new Chart(ctxA, createConfig(nome1, aS1, nome2, aS2, true));
        }, 50);

        // ── Grids por período ───────────────────────────────────────
        if (gridsContainer) {
            gridsContainer.classList.remove('hidden');

            const elG1Title = document.getElementById('grid-a1-title');
            const elG2Title = document.getElementById('grid-a2-title');
            const elG1Body = document.getElementById('grid-a1-body');
            const elG2Body = document.getElementById('grid-a2-body');

            if (elG1Title) elG1Title.textContent = nome1;
            if (elG2Title) elG2Title.textContent = nome2;

            const buildGridRow = (label, prodVal, assertVal, isHighlight, range) => {
                const assertStr = assertVal > 0 ? assertVal.toFixed(1) + '%' : '--';
                const assertColor = assertVal >= 97 ? 'text-emerald-600 font-black' : (assertVal > 0 ? 'text-amber-600 font-bold' : 'text-slate-400');
                const prodStr = prodVal > 0 ? prodVal + ' pcs' : '--';
                const bg = isHighlight ? 'bg-slate-50/50' : '';
                const clickAction = range ? `onclick="MinhaArea.Metas.drillDownComparativo('${label}', '${range.start}', '${range.end}')"` : '';
                return `<tr class="${bg} hover:bg-blue-50/30 transition-colors cursor-pointer" ${clickAction}>
                    <td class="px-3 py-2 text-slate-500 font-bold text-[10px]">${label}</td>
                    <td class="px-3 py-2 text-right font-black text-slate-700 text-[11px]">${prodStr}</td>
                    <td class="px-3 py-2 text-right text-[11px] ${assertColor}">${assertStr}</td>
                </tr>`;
            };

            const htmlG1 = allLabels.map((label, idx) => {
                const i = userData[0].grouped.labels.indexOf(label);
                return buildGridRow(label, i >= 0 ? (userData[0].grouped.prodData[i] || 0) : 0, i >= 0 ? (userData[0].grouped.assertData[i] || 0) : 0, idx % 2 !== 0, userData[0].grouped.ranges[idx]);
            }).join('');

            const htmlG2 = allLabels.map((label, idx) => {
                const i = userData[1].grouped.labels.indexOf(label);
                return buildGridRow(label, i >= 0 ? (userData[1].grouped.prodData[i] || 0) : 0, i >= 0 ? (userData[1].grouped.assertData[i] || 0) : 0, idx % 2 !== 0, userData[1].grouped.ranges[idx]);
            }).join('');

            const footerRow = (medP, medA) => `<tr class="bg-slate-50 border-t-2 border-slate-200">
                <td class="px-3 py-2 text-[9px] font-black text-slate-500 uppercase">Média</td>
                <td class="px-3 py-2 text-right font-black text-slate-800 text-[11px]">${Math.round(medP)} pcs</td>
                <td class="px-3 py-2 text-right font-black text-[11px] ${medA >= 97 ? 'text-emerald-600' : 'text-amber-600'}">${medA.toFixed(1)}%</td>
            </tr>`;

            if (elG1Body) elG1Body.innerHTML = (htmlG1 || '<tr><td colspan="3" class="text-center text-slate-400 py-4 text-xs">Sem dados</td></tr>') + footerRow(med1P, med1A);
            if (elG2Body) elG2Body.innerHTML = (htmlG2 || '<tr><td colspan="3" class="text-center text-slate-400 py-4 text-xs">Sem dados</td></tr>') + footerRow(med2P, med2A);
        }
    },

    toggleLoading: function (show) {
        const el = document.getElementById('loading-metas');
        if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
    }
};

