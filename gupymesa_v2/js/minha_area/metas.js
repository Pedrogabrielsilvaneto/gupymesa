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
    rawDataCache: null,   // [PERF] Cache de dados brutos por período
    lastPeriodKey: null,  // [PERF] Chave do período atual em cache

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
        // [PERF] Apenas re-processa com cache - não busca do banco novamente
        if (this.rawDataCache) { this.reaplicarFiltros(); } else { this.carregar(); }
    },

    getLookupAtingimentoQualidade: function (val) {
        if (val < 90) return "Abaixo de 90% = 0% de atingimento";
        if (val < 94) return "Entre 90% e 93% = 50% de atingimento";
        if (val < 95) return "Entre 94% e 95% = 70% de atingimento";
        if (val < 96) return "Entre 95 e 96% = 80% de atingimento";
        if (val <= 97) return "Entre 96 e 97% = 90% de atingimento";
        return "Acima de 97% = 100% de atingimento";
    },

    getPercentualAtingimentoQualidade: function (val) {
        if (val < 90) return 0;
        if (val < 94) return 50;
        if (val < 95) return 70;
        if (val < 96) return 80;
        if (val <= 97) return 90;
        return 100;
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
                                <button onclick="MinhaArea.Assertividade.mudarVisao('doc')" id="btn-view-doc" class="px-3 py-1 text-[10px] font-bold rounded bg-white text-rose-600 shadow-sm transition">Docs</button>
                                <button onclick="MinhaArea.Assertividade.mudarVisao('empresa')" id="btn-view-empresa" class="px-3 py-1 text-[10px] font-bold rounded text-slate-500 hover:bg-white transition">Empresas</button>
                                <button onclick="MinhaArea.Assertividade.mudarVisao('ndf')" id="btn-view-ndf" class="px-3 py-1 text-[10px] font-bold rounded text-slate-500 hover:bg-white transition">NDF</button>
                            </div>
                            <button id="btn-ver-todos" onclick="MinhaArea.Assertividade.toggleMostrarTodos()" class="text-[10px] font-bold text-blue-500 hover:underline">Ver Todos</button>
                        </div>
                    </div>
                    <div class="flex-1 w-full relative min-h-[200px]"><canvas id="graficoTopOfensores"></canvas></div>
                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Visão Geral</h3>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Docs Validados</span><span id="card-total-auditados" class="text-xs font-black text-blue-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Total de Acertos</span><span id="card-total-acertos" class="text-xs font-black text-emerald-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Total Docs NOK</span><span id="card-total-docs-nok" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5"><span class="text-[10px] font-bold text-slate-600">Campos NOK</span><span id="card-total-erros" class="text-xs font-black text-rose-600">--</span></div>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Detalhamento</h3>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed">
                                <span class="text-[10px] font-bold text-slate-600">Erros Gupy</span><span id="card-erros-gupy" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5"><span class="text-[10px] font-bold text-slate-600">Erros NDF</span><span id="card-erros-ndf" class="text-xs font-black text-amber-600">--</span></div>
                            <div class="flex justify-between items-center pl-2 mt-0.5"><span class="text-[9px] font-bold text-amber-500/80 flex items-center gap-1"><i class="fas fa-level-up-alt rotate-90 text-[8px]"></i> Empresa Valida</span><span id="card-empresa-validar" class="text-[10px] font-bold text-amber-500">--</span></div>
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
                            <div class="relative"><input type="text" placeholder="Buscar..." onkeyup="MinhaArea.Assertividade.filtrarPorBusca(this.value)" class="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-blue-500 w-40 transition"><i class="fas fa-search absolute left-2.5 top-2 text-slate-400 text-xs"></i></div>
                            <button id="btn-limpar-filtro" onclick="MinhaArea.Assertividade.limparFiltro()" class="hidden px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition flex items-center gap-2"><i class="fas fa-times text-rose-500"></i> Limpar</button>
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
            this.atualizarCardsTopo();
        } else if (modo === 'ASSERT') {
            if (btnAssert) btnAssert.className = styleActiveAssert;
            this.toggleContainerPrincipal(true); // Show Grid (Qualidade)
            this.reordenarEExibir();
            this.atualizarCardsTopo();
        } else if (modo === 'DASH') {
            if (btnDash) btnDash.className = styleActiveDash;
            this.toggleContainerPrincipal(false); // Hide Grid, Show Dashboard (Assertividade)
            this.carregarDashboardAssertividade();
            this.atualizarCardsTopo();
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
            this.currentRange = { inicio, fim }; // Store for background calculations


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

            // 1. Buscar Usuários via SQL (Remove filtro ativo = TRUE para somar ex-colaboradores que tiveram produção no mês)
            let sqlUsers = `SELECT id, nome, perfil, funcao, contrato, ativo FROM usuarios WHERE 1=1`;
            let paramsUsers = [];

            if (!isAdmin && myId) {
                sqlUsers += ` AND id = ? `;
                paramsUsers.push(myId);
            }

            const users = await Sistema.query(sqlUsers, paramsUsers);
            if (!users) throw new Error("Erro ao buscar usuários.");

            const forbidden = ['GESTOR', 'AUDITOR', 'LIDER', 'LÍDER', 'COORDENADOR', 'COORDENA', 'HEAD', 'DIRETOR'];
            // Para ADMIN, checamos apenas no PERFIL ou se for a palavra exata na FUNÇÃO para não travar 'Assistente Administrativo'

            const myAlvoReal = (typeof MinhaArea.getUsuarioAlvo === 'function') ? MinhaArea.getUsuarioAlvo() : null;

            // [SYNC v4.35] Include all active users for volume calculation
            const allActiveUsers = users.map(u => {
                const p = (u.perfil || '').toUpperCase();
                const f = (u.funcao || '').toUpperCase();
                const isAdminRole = forbidden.some(word => p.includes(word) || f.includes(word));
                const isAdminExact = p === 'ADMIN' || p === 'ADMINISTRADOR' || f === 'ADMIN' || f === 'ADMINISTRADOR';
                u.isManagement = isAdminRole || isAdminExact;
                return u;
            });
            this.allActiveUsers = allActiveUsers;

            // [SYNC v4.41] Filter for ranking but keep Roberta (Special Case)
            // AND Apply User Selection Filter (Team Selector)
            const rankingUsers = allActiveUsers.filter(u => {
                const isActive = u.ativo !== false && u.ativo !== 0 && u.ativo !== '0';
                if (!isActive && String(u.id).trim() !== '1074356') return false;

                // Restringe ao alvo selecionado no seletor Admin (Se houver)
                if (myAlvoReal && myAlvoReal !== 'EQUIPE' && myAlvoReal !== 'GRUPO_CLT' && myAlvoReal !== 'GRUPO_TERCEIROS') {
                    if (String(u.id) !== String(myAlvoReal)) return false;
                } else if (myAlvoReal === 'GRUPO_CLT') {
                    const c = (u.contrato || 'CLT').toUpperCase();
                    if (c.includes('PJ') || c.includes('TERCEIROS')) return false;
                } else if (myAlvoReal === 'GRUPO_TERCEIROS') {
                    const c = (u.contrato || 'CLT').toUpperCase();
                    if (!c.includes('PJ') && !c.includes('TERCEIROS')) return false;
                }
                return true;
            });

            const userIds = rankingUsers.map(u => u.id);

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
            const isTargetedSearch = myAlvoReal && myAlvoReal !== 'EQUIPE';

            if (isManagerEffective && !isTargetedSearch) {
                console.log("🔍 [v4.38] Modo GESTÃO Ativo: Buscando Global (Produtividade Logic)");
                sqlProd = `SELECT * FROM producao WHERE data_referencia >= ? AND data_referencia <= ? `;
                paramsProd = [inicio, fim];
            } else {
                sqlProd = `SELECT * FROM producao WHERE usuario_id IN(${placeholders}) AND data_referencia >= ? AND data_referencia <= ? `;
                paramsProd = [...userIds, inicio, fim];
            }

            // Query Assertividade
            const sqlAssert = `SELECT usuario_id, data_referencia, qtd_ok, qtd_campos, qtd_nok, assertividade_val, auditora_nome FROM assertividade WHERE usuario_id IN(${placeholders}) AND data_referencia >= ? AND data_referencia <= ? `;
            const paramsAssert = [...userIds, inicio, fim];

            // Query Metas
            const anoInicio = new Date(inicio).getFullYear();
            const anoFim = new Date(fim).getFullYear();
            const sqlMetas = `SELECT * FROM metas WHERE usuario_id IN(${placeholders}) AND ano >= ? AND ano <= ? `;
            const paramsMetas = [...userIds, anoInicio, anoFim];

            // Extrair mês e ano da data de início para a chamada correta do ConfigMes.obter(mes, ano)
            const dInicioConfig = new Date(inicio + 'T12:00:00');
            const mesConfig = dInicioConfig.getMonth() + 1;
            const anoConfig = dInicioConfig.getFullYear();

            // [PERF] Usa cache de dados se o período e o escopo (global/individual) não mudaram
            // [FIX] 'GLOBAL' só quando myAlvoReal é null/vazio. Se for grupo ou id, é uma busca alvo.
            const targetKey = (myAlvoReal && myAlvoReal !== 'EQUIPE') ? String(myAlvoReal) : 'GLOBAL';
            const periodKey = `${inicio}|${fim}|${targetKey}`;
            
            const lastTargetKey = this.lastPeriodKey ? this.lastPeriodKey.split('|')[2] : null;
            const isGlobalCache = lastTargetKey === 'GLOBAL';
            const isSamePeriod = this.lastPeriodKey && this.lastPeriodKey.startsWith(`${inicio}|${fim}`);
            
            let dadosProd, dadosAssert, dadosMetas, configMesParaMeta;

            // Pode usar o cache se for o MESMO período E (o mesmo alvo OU se tivermos cache GLOBAL e estivermos buscando um alvo específico)
            if (this.rawDataCache && isSamePeriod && (targetKey === lastTargetKey || (isGlobalCache && targetKey !== 'GLOBAL'))) {
                console.log(`⚡ [PERF] Período em cache (${targetKey}): pulando requisições ao banco`);
                dadosProd = this.rawDataCache.dadosProd;
                dadosAssert = this.rawDataCache.dadosAssert;
                dadosMetas = this.rawDataCache.dadosMetas;
                configMesParaMeta = this.rawDataCache.configMesParaMeta;
                this.configMesParaMeta = configMesParaMeta;
                this._lastDadosProd = dadosProd || [];
            } else {
                console.log(`🔍 [FETCH] Novo período ou alvo (${targetKey}): buscando no banco...`);
                [dadosProd, dadosAssert, dadosMetas, configMesParaMeta] = await Promise.all([
                    Sistema.query(sqlProd, paramsProd),
                    Sistema.query(sqlAssert, paramsAssert),
                    Sistema.query(sqlMetas, paramsMetas),
                    (window.Gestao && window.Gestao.ConfigMes) ? window.Gestao.ConfigMes.obter(mesConfig, anoConfig) : null
                ]);
                this.configMesParaMeta = configMesParaMeta;
                this._lastDadosProd = dadosProd || [];
                // [PERF] Salva cache
                this.rawDataCache = { dadosProd, dadosAssert, dadosMetas, configMesParaMeta };
                this.lastPeriodKey = periodKey;
            }


            console.log('--- DEBUG DADOS METAS (TIDB) ---', dadosMetas);

            this._lastDadosProd = dadosProd || []; // [FIX v4.36] Store raw data for consistent global total

            if (!dadosProd) throw new Error("Erro ao buscar dados de produção.");
            if (!dadosAssert) throw new Error("Erro ao buscar dados de assertividade.");
            // Metas podem vir vazias, ok.

            this.cacheDados = {};
            this.cacheColunas = [];
            this.statsUsers = {};

            userIds.forEach(uid => {
                const uidStr = String(uid).trim();
                const userObj = allActiveUsers.find(u => String(u.id).trim() === uidStr);
                this.statsUsers[uidStr] = {
                    prod: 0,
                    dias_efetivos: 0,
                    metaSum: 0,
                    ok: 0,
                    total: 0,
                    somaMediasMensais: 0,
                    somaMetasMensais: 0,
                    countMesesComDados: 0,
                    acc_assert_ratio: 0,
                    qtd_auditorias: 0,
                    acc_nok: 0, // [NEW] Accumulator for Fields NOK
                    contrato: (userObj?.contrato || 'CLT').trim().toUpperCase(),
                    isManagement: userObj?.isManagement || false
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
                const k = `${String(m.usuario_id).trim()}-${m.ano}-${m.mes}`;
                mapMetas[k] = { p: m.meta_producao || 0, a: m.meta_assertividade || 0 };
            });

            // [FIX] Pre-inicializar Metas para TODOS os usuários em TODAS as colunas do período
            // Isso garante que mesmo quem não produziu nada seja contado no atingimento médio
            Object.keys(this.cacheDados).forEach(key => {
                const parts = key.split('-');
                const dAux = new Date(parts[0], parseInt(parts[1]) - 1, 15);
                const mKeyBase = `-${dAux.getFullYear()}-${dAux.getMonth() + 1}`;

                userIds.forEach(uid => {
                    const mKey = String(uid).trim() + mKeyBase;
                    if (mapMetas[mKey]) {
                        const m = mapMetas[mKey];
                        const uidStr = String(uid).trim();
                        this.cacheDados[key][uidStr].metaProd = m.p;
                        this.cacheDados[key][uidStr].metaAssert = m.a;
                    }

                    // Encontrar a Maior Meta do período para esse usuário
                    const uidStr = String(uid).trim();
                    if (this.statsUsers[uidStr]) {
                        const pValue = mapMetas[mKey] ? mapMetas[mKey].p : 0;
                        this.statsUsers[uidStr].maxMetaPeriodo = Math.max(this.statsUsers[uidStr].maxMetaPeriodo || 0, pValue);
                    }
                });
            });

            // 1. PRODUÇÃO
            (dadosProd || []).forEach(reg => {
                const uidStr = String(reg.usuario_id).trim();
                const key = this.getKeyFromDate(reg.data_referencia, this.isMacroView);

                if (this.cacheDados[key] && this.cacheDados[key][uidStr]) {
                    const qtd = Number(reg.quantidade || 0);
                    const fator = reg.fator !== null ? Number(reg.fator) : 1.0;

                    if (qtd > 0) {
                        this.cacheDados[key][uidStr].prod += qtd;
                        this.cacheDados[key][uidStr].dias_efetivos += fator;

                        if (this.statsUsers[uidStr]) {
                            this.statsUsers[uidStr].prod += qtd;
                            this.statsUsers[uidStr].dias_efetivos += fator;
                            // metaSum continua sendo baseado na produção real (proporcional aos dias trabalhados)
                            this.statsUsers[uidStr].metaSum += (this.cacheDados[key][uidStr].metaProd * fator);
                        }
                    }
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

                const key = this.getKeyFromDate(reg.data_referencia, this.isMacroView);
                const nokValue = Number(reg.qtd_nok || 0);

                if (this.cacheDados[key] && this.cacheDados[key][uidStr]) {
                    // [FIX v4.52] Strict validation: Contar % Assert apenas nos dados válidos (0 a 100)
                    if (valParsed !== null && valParsed >= 0 && valParsed <= 100) {
                        const ratio = valParsed / 100.0;
                        this.cacheDados[key][uidStr].acc_assert_ratio += ratio;
                        this.cacheDados[key][uidStr].qtd_auditorias += 1;
                        this.statsUsers[uidStr].acc_assert_ratio += ratio;
                        this.statsUsers[uidStr].qtd_auditorias += 1;
                    }

                    // A soma de NOK (Campos) pode ser preservada para todos os registros vinculados
                    this.cacheDados[key][uidStr].acc_nok = (this.cacheDados[key][uidStr].acc_nok || 0) + nokValue;
                    this.statsUsers[uidStr].acc_nok += nokValue;
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

                    let diasDivisorMes = celula.dias_efetivos;
                    if (this.isMacroView && this.statsUsers[uid]) {
                        const isCLT = !(this.statsUsers[uid].contrato || '').toUpperCase().includes('PJ') && !(this.statsUsers[uid].contrato || '').toUpperCase().includes('TERCEIRO');
                        if (isCLT && diasDivisorMes > 0) {
                            diasDivisorMes = Math.max(0, diasDivisorMes - 1);
                        }
                    }
                    const divisor = diasDivisorMes > 0 ? diasDivisorMes : 1;

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

            // [FIX] Roberta/Assistente Missing: Garantir que metaSum seja povoado para todos no período
            // Mesmo sem produção, se o usuário tem meta definida no banco, ele deve contar no atingimento (como 0%)
            Object.keys(this.statsUsers).forEach(uid => {
                const s = this.statsUsers[uid];
                if (s.metaSum === 0 && !s.isManagement) {
                    let totalMetaPeriodo = 0;
                    Object.values(this.cacheDados).forEach(col => {
                        const uidStr = String(uid).trim();
                        if (col[uidStr] && col[uidStr].metaProd) totalMetaPeriodo += col[uidStr].metaProd;
                    });
                    s.metaSum = totalMetaPeriodo;
                }
            });

            // [SYNC v4.41] Show only active assistants in the final Ranking Grid
            const assistentes = allActiveUsers.filter(u => {
                const funcao = (u.funcao || '').toUpperCase();
                const perfil = (u.perfil || '').toUpperCase();
                const rolesToExclude = ['GESTORA', 'AUDITORA', 'ADMIN', 'ADMINISTRADOR'];

                const terms = ['GESTORA', 'AUDITORA', 'COORDENADORA', 'LIDER'];
                const isExcludedRole = terms.some(r => funcao.includes(r) || perfil.includes(r));
                const isExcludedAdmin = perfil === 'ADMIN' || perfil === 'ADMINISTRADOR';

                if (isExcludedRole || isExcludedAdmin) return false;
                if (u.isManagement) return false;

                let myAlvoReal = null;
                if (typeof MinhaArea.getUsuarioAlvo === 'function') {
                    myAlvoReal = MinhaArea.getUsuarioAlvo();
                }

                if (myAlvoReal && myAlvoReal !== 'EQUIPE' && myAlvoReal !== 'GRUPO_CLT' && myAlvoReal !== 'GRUPO_TERCEIROS') {
                    if (String(u.id) !== String(myAlvoReal)) return false;
                } else if (myAlvoReal === 'GRUPO_CLT') {
                    const userContrato = (u.contrato || 'CLT').trim().toUpperCase();
                    if (userContrato.includes('PJ') || userContrato.includes('TERCEIROS')) return false;
                } else if (myAlvoReal === 'GRUPO_TERCEIROS') {
                    const userContrato = (u.contrato || 'CLT').trim().toUpperCase();
                    if (!userContrato.includes('PJ') && !userContrato.includes('TERCEIROS')) return false;
                }

                // Restore active filter for ranking grid
                const isActive = u.ativo !== false && u.ativo !== 0 && u.ativo !== '0';
                if (!isActive && String(u.id).trim() !== '1074356') return false;

                return true;
            });

            this.cacheUsers = assistentes;

            this.atualizarCardsTopo();

            if (this.viewState === 'DETAIL' && this.selectedUserId) {
                this.renderizarDashboardAssistente(this.selectedUserId);
            } else {
                this.reordenarEExibir();
                // [FIX] Resenha filters: Refresh Dashboard if active
                if (this.activeSubTab === 'DASH') {
                    this.carregarDashboardAssertividade();
                }
            }

            const elPeriodo = document.getElementById('metas-periodo-label');
            const elTotal = document.getElementById('metas-total-users');
            if (elPeriodo) elPeriodo.innerText = `Período: ${new Date(inicio).toLocaleDateString('pt-BR')} a ${new Date(fim).toLocaleDateString('pt-BR')} `;
            if (elTotal) elTotal.innerText = `${assistentes.length} Assistentes no Ranking(${this.currentFilterContract})`;

        } catch (err) {
            console.error("❌ ERRO MATRIZ:", err);
            const tbody = document.getElementById('grade-equipe-body');
            if (tbody) tbody.innerHTML = `<tr><td colspan="100" class="p-8 text-center text-rose-500 font-bold">Erro: ${err.message}</td></tr>`;
        } finally {
            this.toggleLoading(false);
            this.isLocked = false;
        }
    },

    // [PERF] Reaplicar filtros sem ir ao banco - aproveita rawDataCache em carregar()
    reaplicarFiltros: function () {
        if (!this.rawDataCache || !this.currentRange) {
            this.carregar();
            return;
        }
        // Desbloqueia e chama carregar() que detectará o período igual e usará o cache
        this.isLocked = false;
        this.carregar();
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

    obterFeriados: function (ano) {
        const feriados = [
            `${ano}-01-01`, // Ano Novo
            `${ano}-04-21`, // Tiradentes
            `${ano}-05-01`, // Dia do Trabalho
            `${ano}-09-07`, // Independência
            `${ano}-10-12`, // Padroeira
            `${ano}-11-02`, // Finados
            `${ano}-11-15`, // Proclamação da República
            `${ano}-11-20`, // Consciência Negra
            `${ano}-12-25`  // Natal
        ];
        // Cálculos Páscoa
        const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mesPascoa = Math.floor((h + l - 7 * m + 114) / 31), diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;
        const dataPascoa = new Date(ano, mesPascoa - 1, diaPascoa);
        const addDias = (data, dias) => { const d = new Date(data); d.setDate(d.getDate() + dias); return d.toISOString().split('T')[0]; };
        feriados.push(addDias(dataPascoa, -48), addDias(dataPascoa, -47), addDias(dataPascoa, -2), addDias(dataPascoa, 60)); // -48: Seg, -47: Ter (Carnaval)
        return new Set(feriados);
    },

    contarDiasUteis: function (inicio, fim) {
        let count = 0;
        let cur = new Date(inicio + 'T12:00:00');
        let end = new Date(fim + 'T12:00:00');
        const cacheFeriados = {};

        while (cur <= end) {
            let day = cur.getDay();
            if (day !== 0 && day !== 6) {
                const ano = cur.getFullYear();
                if (!cacheFeriados[ano]) cacheFeriados[ano] = this.obterFeriados(ano);
                const dataStr = cur.toISOString().split('T')[0];
                if (!cacheFeriados[ano].has(dataStr)) count++;
            }
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    },


    novoItemVazio: function () { return { prod: 0, dias_efetivos: 0, velocidade: 0, acc_assert_ratio: 0, qtd_auditorias: 0, assert: null, metaProd: 0, metaAssert: 0 }; },

    atualizarCardsTopo: function () {
        const range = this.currentRange || { inicio: '', fim: '' };
        const config = this.configMesParaMeta;
        let subAba = this.currentFilterContract; // 'TODOS', 'CLT', 'PJ'
        const loggedInUid = MinhaArea.usuario ? MinhaArea.usuario.id : null;

        let alvoReal = null;
        if (typeof MinhaArea.getUsuarioAlvo === 'function') {
            alvoReal = MinhaArea.getUsuarioAlvo();
        }

        if (alvoReal === 'GRUPO_CLT') subAba = 'CLT';
        if (alvoReal === 'GRUPO_TERCEIROS') subAba = 'PJ';

        let rawGlobalProd = 0;
        let globalOk = 0;
        let globalTotalAud = 0;

        // [ALIGN] Sum production and assertiveness based on subAba (CLT/PJ/TODOS)
        Object.entries(this.statsUsers).forEach(([uid, s]) => {
            if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
                if (String(uid) !== String(alvoReal)) return;
            } else {
                // Apply contract filter
                if (subAba !== 'TODOS') {
                    const c = s.contrato || 'CLT';
                    if (subAba === 'PJ' && !(c.includes('PJ') || c.includes('TERCEIROS'))) return;
                    if (subAba === 'CLT' && (c.includes('PJ') || c.includes('TERCEIROS'))) return;
                }
            }

            rawGlobalProd += s.prod;
            globalOk += s.acc_assert_ratio;
            globalTotalAud += s.qtd_auditorias;
        });

        let globalProdAssistentes = rawGlobalProd;

        const diasUteisRef = this.contarDiasUteis(range.inicio, range.fim);
        let abonoManualGestora = 0;
        let metaDiariaGestor = 0;

        // Identificar Gestor Logado para abono e meta
        Object.entries(this.statsUsers).forEach(([uid, s]) => {
            const isManager = s.isManagement || (uid == '1' || uid == '1000');
            if (isManager && String(uid) === String(loggedInUid)) {
                abonoManualGestora = Math.max(0, diasUteisRef - s.dias_efetivos);
                for (let k in this.cacheDados) {
                    if (this.cacheDados[k][uid] && this.cacheDados[k][uid].metaProd > 0) {
                        metaDiariaGestor = this.cacheDados[k][uid].metaProd;
                        break;
                    }
                }
            }
        });

        // ------------------ LÓGICA DE VELOCIDADE (PRODUTIVIDADE) ---------------------
        const hasCustomConfig = config && (Number(config.dias_uteis_clt) > 0 || Number(config.dias_uteis_terceiros) > 0 || Number(config.dias_uteis) > 0);

        const diasCalendario = diasUteisRef;
        let vTerc = diasCalendario;
        let vClt = Math.max(0, diasCalendario - 1);
        let vGeral = Math.max(0, diasCalendario - 1);

        if (hasCustomConfig) {
            vTerc = Number(config.dias_uteis_terceiros) || Number(config.dias_uteis) || diasCalendario;
            vClt = Number(config.dias_uteis_clt) || Number(config.dias_uteis) || Math.max(0, vTerc - 1);
            vGeral = Number(config.dias_uteis_clt) || Number(config.dias_uteis_terceiros) || Number(config.dias_uteis) || Math.max(0, vTerc - 1);
        }

        let dBase = vGeral;
        if (subAba === 'CLT') dBase = vClt;
        else if (subAba === 'PJ') dBase = vTerc;

        const hClt = (config && Number(config.hc_clt) > 0) ? Number(config.hc_clt) : 8;
        const hTerc = (config && Number(config.hc_terceiros) > 0) ? Number(config.hc_terceiros) : 9;
        const hGeral = hClt + hTerc;

        let numAssistentesFiltrados = 0;
        Object.entries(this.statsUsers).forEach(([uid, s]) => {
            if (!s.isManagement) {
                // Remove Inativos reais, igual a Produtividade (já que agora temos users inativos na memoria para somar global)
                const u = (this.allActiveUsers || []).find(x => String(x.id) === String(uid));
                if (u && (u.ativo === false || u.ativo === 0 || u.ativo === '0') && String(uid).trim() !== '1074356') return;

                if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
                    if (String(uid) !== String(alvoReal)) return;
                } else if (subAba !== 'TODOS') {
                    const c = s.contrato || 'CLT';
                    if (subAba === 'PJ' && !(c.includes('PJ') || c.includes('TERCEIROS'))) return;
                    if (subAba === 'CLT' && (c.includes('PJ') || c.includes('TERCEIROS'))) return;
                }
                numAssistentesFiltrados++;
            }
        });

        // Use head count filtrado se > 0, senão o hardcoded do config
        let hcParaVelocidade = numAssistentesFiltrados > 0 ? numAssistentesFiltrados : hGeral;
        if (numAssistentesFiltrados === 0) {
            if (subAba === 'CLT') hcParaVelocidade = hClt;
            if (subAba === 'PJ') hcParaVelocidade = hTerc;
        }

        // Determinar Meta Base (Maior meta entre assistentes)
        let maxMetaAssistente = 0;
        Object.values(this.cacheDados).forEach(col => {
            Object.entries(col).forEach(([uid, cel]) => {
                const s = this.statsUsers[uid];
                if (s && !s.isManagement && cel.metaProd > maxMetaAssistente) {
                    maxMetaAssistente = cel.metaProd;
                }
            });
        });
        if (maxMetaAssistente === 0) maxMetaAssistente = 650;

        let targetVelocidade = (subAba === 'TODOS' && metaDiariaGestor > 0) ? metaDiariaGestor : maxMetaAssistente;

        // Dias para divisor (hoje se estiver no range)
        const hojeStr = new Date().toISOString().split('T')[0];
        const isPeriodo = range.inicio !== range.fim;

        // [FIX] dBaseReferencia deve ser o calendário PURO para evitar dupla subtração no diasParaVelocidade
        const diasCalendarioEfetivos = this.contarDiasUteis(range.inicio, range.fim);
        let diasDivisorReal = diasCalendarioEfetivos;

        if (hojeStr >= range.inicio && hojeStr <= range.fim) {
            diasDivisorReal = this.contarDiasUteis(range.inicio, hojeStr);
        }

        // Regra Central: CLT e TODOS (Geral) subtraem 1 dia no período. PJ não subtrai.
        let descontarDia = false;
        if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
            const uInfo = this.statsUsers[alvoReal] || {};
            const isTargetTerceiro = ((uInfo.contrato || '').includes('PJ') || (uInfo.contrato || '').includes('TERCEIRO'));
            if (!isTargetTerceiro) descontarDia = true;
        } else if (subAba === 'CLT' || subAba === 'TODOS') {
            descontarDia = true;
        }

        const diasParaVelocidade = descontarDia
            ? Math.max(1, (isPeriodo ? (diasDivisorReal - 1 - abonoManualGestora) : diasDivisorReal))
            : Math.max(1, diasDivisorReal);

        const divisorVelocidade = hcParaVelocidade * diasParaVelocidade;

        let kpiVelocidade = 0;
        if (this.isMacroView) {
            // No modo Macro (Tri/Ano), mantemos a média das médias para não distorcer pelo HC fixo do mês
            let somaDasMediasIndividuais = 0;
            let contadorUsuariosComDados = 0;
            Object.entries(this.statsUsers).forEach(([uid, s]) => {
                if (!s.isManagement && s.prod > 0) {
                    if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
                        if (String(uid) !== String(alvoReal)) return;
                    } else if (subAba !== 'TODOS') {
                        const c = s.contrato || 'CLT';
                        if (subAba === 'PJ' && !(c.includes('PJ') || c.includes('TERCEIROS'))) return;
                        if (subAba === 'CLT' && (c.includes('PJ') || c.includes('TERCEIROS'))) return;
                    }

                    const divisor = s.countMesesComDados > 0 ? s.countMesesComDados : 1;
                    somaDasMediasIndividuais += (s.somaMediasMensais / divisor);
                    contadorUsuariosComDados++;
                }
            });
            kpiVelocidade = contadorUsuariosComDados > 0 ? Math.round(somaDasMediasIndividuais / contadorUsuariosComDados) : 0;
        } else {
            if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
                const s = this.statsUsers[alvoReal] || { dias_efetivos: 1 };
                const uInfo = this.statsUsers[alvoReal] || {};
                const isTargetTerceiro = ((uInfo.contrato || '').includes('PJ') || (uInfo.contrato || '').includes('TERCEIRO'));

                let div = s.dias_efetivos;
                if (!isTargetTerceiro && isPeriodo && s.dias_efetivos > 0) {
                    div = Math.max(0, s.dias_efetivos - 1);
                }

                div = div > 0 ? div : 1;
                kpiVelocidade = Math.round(rawGlobalProd / div);
            } else {
                kpiVelocidade = divisorVelocidade > 0 ? Math.round(rawGlobalProd / divisorVelocidade) : 0;
            }
        }

        const kpiAssert = globalTotalAud > 0 ? (globalOk / globalTotalAud) * 100 : 0;

        // [NEW] Calcular Atingimento (Média dos Atingimentos quando for Visão de Grupo)
        let atingimentoFinalVal = 0;

        // Se for um usuário único selecionado
        if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
            if (this.activeSubTab === 'PROD') {
                atingimentoFinalVal = targetVelocidade > 0 ? (kpiVelocidade / targetVelocidade) * 100 : 0;
            } else {
                // [FIX] Atingimento de Qualidade segue a Regra de Faixas (OKR) para o indivíduo
                atingimentoFinalVal = this.getPercentualAtingimentoQualidade(kpiAssert);
            }
        } else {
            // Se for VISÃO DE GRUPO (CLT, TERCEIROS, GERAL) -> Média dos Atingimentos Individuais
            let somaAtingimentos = 0;
            let contadorAtingimentos = 0;

            Object.entries(this.statsUsers).forEach(([uid, s]) => {
                if (s.isManagement) return;

                // Aplicar filtros de contrato/grupo
                if (alvoReal === 'GRUPO_CLT') {
                    if (s.contrato.includes('PJ') || s.contrato.includes('TERCEIROS')) return;
                } else if (alvoReal === 'GRUPO_TERCEIROS') {
                    if (!(s.contrato.includes('PJ') || s.contrato.includes('TERCEIROS'))) return;
                } else {
                    // subAba filter if no global group filter
                    if (subAba !== 'TODOS') {
                        const c = s.contrato || 'CLT';
                        if (subAba === 'PJ' && !(c.includes('PJ') || c.includes('TERCEIROS'))) return;
                        if (subAba === 'CLT' && (c.includes('PJ') || c.includes('TERCEIROS'))) return;
                    }
                }

                if (this.activeSubTab === 'PROD') {
                    // Atingimento Prod Individual
                    const divisor = this.isMacroView ? (s.countMesesComDados || 1) : (s.dias_efetivos || 1);
                    const avgVel = this.isMacroView ? (s.somaMediasMensais / divisor) : (s.prod / divisor);
                    const avgMeta = this.isMacroView ? (s.maxMetaPeriodo > 0 ? s.maxMetaPeriodo : 650) : (s.metaSum / divisor);

                    // Só conta no atingimento médio se tiver Meta definida > 0 (ou seja, se for assistente com meta)
                    if (avgMeta > 0) {
                        somaAtingimentos += (avgVel / avgMeta) * 100;
                        contadorAtingimentos++;
                    } else if (s.prod > 0) {
                        // Fallback caso tenha produção mas sem meta explicitamente no banco
                        somaAtingimentos += 100;
                        contadorAtingimentos++;
                    }
                } else {
                    // Atingimento Qualidade Individual (OKR)
                    // Busca a meta de assertividade para ver se esse usuário deve ser contado (assistentes ativos)
                    let maxMetaA = 0;
                    Object.values(this.cacheDados).forEach(col => {
                        const cel = col[String(uid).trim()];
                        if (cel && cel.metaAssert > maxMetaA) maxMetaA = cel.metaAssert;
                    });

                    // Se tem meta de qualidade (tipicamente 97%), conta no atingimento médio mesmo com 0 auditorias
                    if (maxMetaA > 0) {
                        const assertIndiv = s.qtd_auditorias > 0 ? (s.acc_assert_ratio / s.qtd_auditorias) * 100 : 0;
                        somaAtingimentos += this.getPercentualAtingimentoQualidade(assertIndiv);
                        contadorAtingimentos++;
                    }
                }
            });

            atingimentoFinalVal = contadorAtingimentos > 0 ? (somaAtingimentos / contadorAtingimentos) : 0;
        }

        const elProd = document.getElementById('card-ranking-prod');
        const elMedia = document.getElementById('card-ranking-media');
        const elAtingimento = document.getElementById('card-ranking-assert');
        const elLabelAtingimento = document.getElementById('card-label-atingimento');
        const elSubLabelAtingimento = document.getElementById('card-sublabel-atingimento');

        const elHeaderTitle = document.getElementById('metas-ranking-title');
        const elHeaderSubtitle = document.getElementById('metas-ranking-subtitle');

        if (elProd) elProd.innerText = rawGlobalProd.toLocaleString('pt-BR');
        if (elMedia) elMedia.innerText = kpiVelocidade.toLocaleString('pt-BR');

        if (elLabelAtingimento) elLabelAtingimento.innerText = 'Atingimento';
        if (elSubLabelAtingimento) {
            if (this.activeSubTab === 'PROD') {
                elSubLabelAtingimento.innerText = 'Atingimento da produção (acumulado)';
                // [RESTORE] Restore Header
                if (elHeaderTitle) elHeaderTitle.innerHTML = '<i class="fas fa-list-ol text-blue-600"></i> Ranking & Evolução';
                if (elHeaderSubtitle) elHeaderSubtitle.innerHTML = 'Visualize a performance dia a dia ou mês a mês. Valores em <span class="text-rose-600 font-bold">vermelho</span> estão abaixo da meta.<br>Clique no nome para abrir o comparativo.';
            } else {
                const msgLookup = this.getLookupAtingimentoQualidade(kpiAssert);
                elSubLabelAtingimento.innerHTML = `Atingimento da qualidade (acumulado)<br><strong class="text-blue-600">${msgLookup}</strong>`;

                // [HIGHLIGHT] Replace Header with OKR attainment
                if (elHeaderTitle) {
                    elHeaderTitle.innerHTML = `<i class="fas fa-star text-amber-500 animate-pulse"></i> <span class="text-blue-700">Atingimento OKR:</span> <span class="text-emerald-600">${msgLookup.split('=')[1] || msgLookup}</span>`;
                }
                if (elHeaderSubtitle) {
                    elHeaderSubtitle.innerHTML = `Mensagem baseada na assertividade bruta acumulada de <strong>${kpiAssert.toFixed(2)}%</strong>. <br>Clique no assistente para ver detalhes.`;
                }
            }
        }
        if (elAtingimento) elAtingimento.innerText = atingimentoFinalVal.toFixed(1) + '%';

        // [NEW] Calcular quanto falta no Total
        const elTotalRestante = document.getElementById('card-ranking-prod-restante');
        if (elTotalRestante) {
            let totalMetaGeral = 0;
            Object.entries(this.statsUsers).forEach(([uid, s]) => {
                if (s.isManagement) return;
                // Filtros de contrato/grupo (Mesmos de cima)
                if (alvoReal && alvoReal !== 'EQUIPE' && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
                    if (String(uid) !== String(alvoReal)) return;
                } else {
                    if (subAba !== 'TODOS') {
                        const c = s.contrato || 'CLT';
                        if (subAba === 'PJ' && !(c.includes('PJ') || c.includes('TERCEIROS'))) return;
                        if (subAba === 'CLT' && (c.includes('PJ') || c.includes('TERCEIROS'))) return;
                    }
                }
                totalMetaGeral += (s.metaSum || 0);
            });

            const faltaTotal = Math.max(0, Math.round(totalMetaGeral) - rawGlobalProd);
            if (faltaTotal > 0 && totalMetaGeral > 0) {
                elTotalRestante.textContent = `Faltam: ${faltaTotal.toLocaleString('pt-BR')}`;
                elTotalRestante.className = "text-[10px] font-bold text-blue-600/70 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 block";
                elTotalRestante.classList.remove('hidden');
            } else if (totalMetaGeral > 0 && rawGlobalProd >= totalMetaGeral) {
                elTotalRestante.textContent = "Meta Batida!";
                elTotalRestante.className = "text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 block";
                elTotalRestante.classList.remove('hidden');
            } else {
                elTotalRestante.classList.add('hidden');
            }
        }
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
        <span>${isAssert ? 'RANKING (QUALIDADE)' : 'RANKING (VELOCIDADE)'}</span>
        <span class="text-[9px] text-slate-400 font-normal">${subLabel}</span>
    </div>
        </th>`;

        const corAcum = isAssert ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200';
        htmlHeader += `<th class="px-2 py-3 bg-white border-b border-r border-slate-200 min-w-[70px] text-center font-bold text-xs text-slate-600 sticky top-0 z-40">${isAssert ? "TOTAL VALIDADOS" : "PROD.TOTAL"}</th>`;
        htmlHeader += `<th class="px-2 py-3 ${corAcum} border-b border-r border-slate-200 min-w-[80px] text-center font-bold text-xs sticky top-0 z-40" title="Média das Médias do Período">${isAssert ? "% ASSERTIVID." : "ACUMULADO"}</th>`;

        // CAMPOS NOK removido a pedido do usuário

        this.cacheColunas.forEach(col => {
            htmlHeader += `<th class="px-1 py-3 bg-slate-50 border-b border-r border-slate-200 min-w-[60px] text-center font-bold text-xs text-slate-600 sticky top-0 z-40">${col.label}</th>`;
        });
        thead.innerHTML = htmlHeader;
        let htmlBody = '';

        // [FEATURE] Add "Acumulado da Equipe" row
        let totalEquipeProd = 0;
        let totalEquipeNok = 0;
        let totalEquipeAuditorias = 0;
        let totalEquipeAssertRatio = 0;

        this.cacheUsers.forEach(u => {
            const s = this.statsUsers[String(u.id)];
            if (s) {
                totalEquipeProd += s.prod || 0;
                totalEquipeNok += s.acc_nok || 0;
                totalEquipeAuditorias += s.qtd_auditorias || 0;
                totalEquipeAssertRatio += s.acc_assert_ratio || 0;
            }
        });

        let cellsDiarias = '';
        this.cacheColunas.forEach(col => {
            let somaDia = 0;
            this.cacheUsers.forEach(u => {
                const d = this.cacheDados[col.key][String(u.id)];
                if (d) {
                    somaDia += d.velocidade || 0;
                }
            });
            cellsDiarias += `<td class="px-1 py-2 border-b border-r border-slate-100 text-center align-middle h-12 bg-slate-50/50 font-bold text-slate-700">${somaDia}</td>`;
        });

        const globalAssert = totalEquipeAuditorias > 0 ? (totalEquipeAssertRatio / totalEquipeAuditorias) * 100 : 0;
        const cellAcumuladoEquipe = isAssert
            ? `<div class="${globalAssert >= 97 ? 'text-emerald-700' : 'text-rose-600'} font-black text-sm leading-none">${globalAssert.toFixed(2).replace('.', ',')}%</div>`
            : '-';

        htmlBody += `<tr class="bg-blue-50/20 border-b-2 border-slate-300">
            <td class="px-4 py-3 border-r border-slate-300 sticky left-0 font-black text-slate-800 text-xs shadow-[1px_0_3px_rgba(0,0,0,0.05)] bg-slate-50 z-50">
                <i class="fas fa-users text-blue-600 w-4"></i> Acumulado da Equipe
            </td>
            <td class="px-2 py-2 border-r border-slate-200 bg-white text-center align-middle font-black text-slate-800 text-sm">${totalEquipeProd.toLocaleString('pt-BR')}</td>
            <td class="px-2 py-2 border-r border-slate-200 bg-white text-center align-middle font-black text-slate-800 text-sm">${cellAcumuladoEquipe}</td>
            ${cellsDiarias}
        </tr>`;
        this.cacheUsers.forEach((u, index) => {
            const pos = index + 1;
            let medalha = '';
            if (pos === 1) medalha = '🥇'; else if (pos === 2) medalha = '🥈'; else if (pos === 3) medalha = '🥉';

            const stats = this.statsUsers[String(u.id).trim()] || { prod: 0, dias_efetivos: 0, metaSum: 0, ok: 0, total: 0, somaMediasMensais: 0, somaMetasMensais: 0, countMesesComDados: 0 };

            let cellTotal = '<span class="text-slate-300">-</span>';
            let cellMedia = '<span class="text-slate-300">-</span>';
            let cellNok = '';

            if (isAssert) {
                // [ASSERT_FIX] First column is production volume, not audits count
                if (stats.prod > 0) cellTotal = `<span class="font-bold text-slate-700">${stats.prod.toLocaleString('pt-BR')}</span>`;

                const assertGeral = stats.qtd_auditorias > 0 ? (stats.acc_assert_ratio / stats.qtd_auditorias) * 100 : 0;

                if (stats.qtd_auditorias > 0) {
                    const corVal = assertGeral >= 97 ? 'text-emerald-700' : 'text-rose-600';
                    cellMedia = `<div class="${corVal} font-black text-sm leading-none">${assertGeral.toFixed(1)}%</div>`;
                }

                // CAMPOS NOK removido
                cellNok = '';
            } else {
                if (stats.prod > 0) cellTotal = `<span class="font-bold text-slate-700">${stats.prod.toLocaleString('pt-BR')}</span>`;
                cellNok = ''; // Hide when not in assert mode

                // LÓGICA DE MÉDIA ACUMULADA: MÉDIA DAS MÉDIAS (MACRO)
                // [FIX] Apply CLT Rule: Days - 1 if period
                const range = this.currentRange || { inicio: '', fim: '' };
                const isPeriodo = range.inicio !== range.fim;
                let diasDivisor = stats.dias_efetivos;
                const isCLT = !(stats.contrato || '').toUpperCase().includes('PJ') && !(stats.contrato || '').toUpperCase().includes('TERCEIRO');
                if (isCLT && isPeriodo && diasDivisor > 0) {
                    diasDivisor = Math.max(0, diasDivisor - 1);
                }
                diasDivisor = diasDivisor > 0 ? diasDivisor : 1;

                const divisor = this.isMacroView ? (stats.countMesesComDados || 1) : diasDivisor;
                const avgVel = this.isMacroView ? Math.round(stats.somaMediasMensais / divisor) : Math.round(stats.prod / divisor);

                // Meta Média
                const avgMeta = this.isMacroView ? (stats.maxMetaPeriodo > 0 ? stats.maxMetaPeriodo : 650) : (stats.metaSum / (stats.dias_efetivos || 1));
                const avgPct = avgMeta > 0 ? (avgVel / avgMeta * 100) : 0;

                if (stats.prod > 0) {
                    const corVal = avgVel >= avgMeta ? 'text-blue-700' : 'text-rose-700';
                    const corBadge = avgPct >= 100 ? 'bg-blue-200 text-blue-800' : 'bg-rose-100 text-rose-700 border border-rose-200';
                    cellMedia = `<div class="${corVal} font-black text-sm leading-none">${avgVel.toLocaleString('pt-BR')}</div>
    <div class="mt-1"><span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${corBadge}">${avgPct.toFixed(2).replace('.', ',')}%</span></div>`;
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
                <td class="px-2 py-2 border-b border-r border-slate-100 bg-slate-50/50 text-center align-middle">${cellMedia}</td>
                `;

            this.cacheColunas.forEach(col => {
                const dados = this.cacheDados[col.key][String(u.id).trim()];
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
            const dados = this.cacheDados[col.key][String(uid)] || { velocidade: 0, assert: null, metaProd: 0, metaAssert: 0 };

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
        const el1 = document.getElementById('comp-sel-1'); const el2 = document.getElementById('comp-sel-2'); const el3 = document.getElementById('comp-sel-3');
        if (el1) el1.value = id1 || ''; if (el2) el2.value = id2 || ''; if (el3) el3.value = id3 || '';
        this.atualizarComparativoManual();
        const modal = document.getElementById('modal-comparativo-metas');
        if (modal) { modal.classList.remove('hidden', 'pointer-events-none'); setTimeout(() => modal.classList.add('active'), 10); }
    },

    popularSelectsManual: function () {
        const createOpts = () => '<option value="">(Vazio)</option>' + this.cacheUsers.map(u => `<option value="${u.id}">${u.nome}</option>`).join('');
        ['comp-sel-1', 'comp-sel-2', 'comp-sel-3'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = createOpts(); });
    },

    atualizarComparativoManual: function () {
        const id1 = document.getElementById('comp-sel-1')?.value;
        const id2 = document.getElementById('comp-sel-2')?.value;
        const id3 = document.getElementById('comp-sel-3')?.value;
        const ids = [id1, id2, id3].filter(id => id);
        this.renderizarGraficosComparativos(ids);
    },

    fecharModalComparativo: function () {
        const modal = document.getElementById('modal-comparativo-metas');
        if (modal) { modal.classList.remove('active'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('pointer-events-none'); }, 300); }
    },

    fecharModalEvolucao: function () {
        const modal = document.getElementById('modal-evolucao-metas');
        if (modal) { modal.classList.remove('active'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('pointer-events-none'); }, 300); }
    },

    renderizarGraficosComparativos: function (userIds) {
        const labels = this.cacheColunas.map(c => c.label);
        const slotColors = ['#3b82f6', '#10b981', '#f59e0b'];
        const datasetsProd = []; const datasetsAssert = [];

        // [NEW] Linhas de Meta (Referência)
        const metaProd = [];
        const metaAssert = [];
        // Usa o primeiro usuário como referência para as metas (assumindo metas iguais para o grupo comparado)
        const referenceUid = userIds[0] || (this.cacheUsers[0] ? this.cacheUsers[0].id : null);

        this.cacheColunas.forEach(col => {
            let mp = 0;
            let ma = 0;
            if (referenceUid) {
                const d = this.cacheDados[col.key][String(referenceUid)];
                if (d) { mp = d.metaProd || 0; ma = d.metaAssert || 0; }
            }
            metaProd.push(mp);
            metaAssert.push(ma);
        });

        // Adiciona datasets de Meta primeiro (back layer)
        datasetsProd.push({
            label: 'Meta',
            data: metaProd,
            borderColor: '#94a3b8',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [5, 5],
            fill: false,
            order: 1
        });

        datasetsAssert.push({
            label: 'Meta Qualidade',
            data: metaAssert,
            borderColor: '#10b981',
            borderWidth: 2,
            pointRadius: 0,
            borderDash: [2, 2],
            fill: false,
            order: 1
        });

        // Adiciona datasets dos usuários
        userIds.forEach((uid, idx) => {
            const user = this.cacheUsers.find(u => String(u.id) === String(uid));
            if (!user) return;
            const color = slotColors[idx % 3];
            const dataProd = []; const dataAssert = [];
            this.cacheColunas.forEach(col => {
                const dados = this.cacheDados[col.key][String(uid)] || { velocidade: null, assert: null };
                dataProd.push(dados.velocidade);
                dataAssert.push(dados.assert !== null ? (dados.assert * 100) : null);
            });
            const dsBase = {
                label: user.nome.split(' ')[0],
                borderColor: color,
                backgroundColor: color,
                borderWidth: 3,
                pointRadius: 4,
                tension: 0.2,
                fill: false,
                order: 2
            };
            datasetsProd.push({ ...dsBase, data: dataProd });
            datasetsAssert.push({ ...dsBase, data: dataAssert });
        });

        this.createChartComp('chart-comp-prod', labels, datasetsProd, false);
        this.createChartComp('chart-comp-assert', labels, datasetsAssert, true);
    },

    createChartComp: function (canvasId, labels, datasets, isPct) {
        const ctx = document.getElementById(canvasId); if (!ctx) return;
        if (canvasId === 'chart-comp-prod') { if (this.chartCompProd) this.chartCompProd.destroy(); } else { if (this.chartCompAssert) this.chartCompAssert.destroy(); }
        const chart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true } }
            }
        });
        if (canvasId === 'chart-comp-prod') this.chartCompProd = chart; else this.chartCompAssert = chart;
    },

    toggleLoading: function (show) {
        const el = document.getElementById('loading-metas');
        if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
    }
};