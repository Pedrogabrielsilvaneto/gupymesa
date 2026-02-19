/* ARQUIVO: js/minha_area/assertividade.js
   VERSÃO: V2.0 (Restaurado e Corrigido)
   DESCRIÇÃO: Controller da ABA Assertividade (Dashboard)
*/

MinhaArea.Assertividade = {
    chartOfensores: null,
    dadosBrutosCache: [],
    listaErrosCache: [],
    visaoAtual: 'doc',
    mostrarTodos: false,

    // Template HTML (Movido de Metas.js/Comparativo.js)
    HTML_DASHBOARD: `
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

    carregar: async function () {
        // [FIX] Target the container inside 'Meta/OKR' tab (created in Metas.js)
        const container = document.getElementById('container-painel-assertividade');
        if (!container) {
            console.error("Container 'container-painel-assertividade' não encontrado. Certifique-se que a aba Meta/OKR está carregada.");
            return;
        }

        // Renderiza o template se estiver vazio ou com o placeholder
        if (container.innerHTML.includes('Carregando Painel') || container.innerHTML.trim() === '') {
            container.innerHTML = this.HTML_DASHBOARD;
        }

        console.time("PerformanceTotal");
        console.log("🚀 UX Dashboard: Iniciando Carga...");

        const uid = MinhaArea.getUsuarioAlvo();
        if (!uid && typeof MinhaArea.isAdmin === 'function' && !MinhaArea.isAdmin()) return;

        const { inicio, fim } = MinhaArea.getDatasFiltro();
        const containerFeed = document.getElementById('feed-erros-container');

        // Seletores
        const elTotalAuditados = document.getElementById('card-total-auditados');
        const elTotalAcertos = document.getElementById('card-total-acertos');
        const elTotalErros = document.getElementById('card-total-erros');
        const elErrosGupy = document.getElementById('card-erros-gupy');
        const elErrosNdf = document.getElementById('card-erros-ndf');
        const elEmpresaValidar = document.getElementById('card-empresa-validar');
        const btnLimpar = document.getElementById('btn-limpar-filtro');

        if (btnLimpar) btnLimpar.classList.add('hidden');
        if (containerFeed) containerFeed.innerHTML = '<div class="text-center py-12 text-slate-400"><i class="fas fa-circle-notch fa-spin text-2xl mb-2 text-blue-500"></i><br>Analisando auditorias...</div>';

        try {
            console.log("Assertividade: Iniciando buscarTudoPaginado...");
            const dados = await this.buscarTudoPaginado(uid, inicio, fim);
            console.log("Assertividade: buscarTudoPaginado retornou.", dados ? dados.length : "null");
            this.dadosBrutosCache = dados;

            console.log(`📦 Base Total: ${dados.length} registros auditados.`);

            let countTotalAuditados = 0;
            let countErrosGupy = 0;
            let countErrosNdf = 0;
            let countNdfEmpresa = 0;
            const listaErros = [];

            // [DEBUG] Inspect first few records for qtd_nok structure
            if (dados.length > 0) {
                console.log("Amostra de dados (primeiros 3):", dados.slice(0, 3));
            }

            for (let i = 0; i < dados.length; i++) {
                const d = dados[i];
                if (!d.auditora_nome || d.auditora_nome.trim() === '') continue;

                countTotalAuditados++;

                // [DEBUG LOGIC] Check strictly for qtd_nok
                const valNok = d.qtd_nok;
                const isErro = (valNok && Number(valNok) > 0);

                if (i < 5) console.log(`Item ${i}: qtd_nok=${valNok} type=${typeof valNok} isErro=${isErro}`);

                if (isErro) {
                    listaErros.push(d);
                    const tipoDocUpper = (d.tipo_documento || '').toUpperCase();
                    const isNdf = tipoDocUpper.startsWith('DOC_NDF_');

                    if (isNdf) {
                        countErrosNdf++;
                        if (tipoDocUpper === 'DOC_NDF_OUTROS') countNdfEmpresa++;
                    } else {
                        countErrosGupy++;
                    }
                }
            }

            this.listaErrosCache = listaErros;

            // Update Cards
            const totalErrosReais = countErrosGupy + countErrosNdf;
            const totalAcertos = countTotalAuditados - totalErrosReais;

            if (elTotalAuditados) elTotalAuditados.innerText = countTotalAuditados.toLocaleString('pt-BR');
            if (elTotalAcertos) elTotalAcertos.innerText = totalAcertos.toLocaleString('pt-BR');
            if (elTotalErros) elTotalErros.innerText = totalErrosReais.toLocaleString('pt-BR');
            if (elErrosGupy) elErrosGupy.innerText = countErrosGupy.toLocaleString('pt-BR');
            if (elErrosNdf) elErrosNdf.innerText = countErrosNdf.toLocaleString('pt-BR');
            if (elEmpresaValidar) elEmpresaValidar.innerText = countNdfEmpresa.toLocaleString('pt-BR');

            // Render Feed
            if (listaErros.length === 0) {
                this.renderizarVazio(containerFeed);
                this.renderizarGraficoVazio();
                console.timeEnd("PerformanceTotal");
                return;
            }

            this.mudarVisao(this.visaoAtual);
            console.timeEnd("PerformanceTotal");

        } catch (err) {
            console.error("Erro Assertividade:", err);
            if (containerFeed) containerFeed.innerHTML = `<div class="text-rose-500 text-center py-8">Erro ao carregar: ${err.message}</div>`;
        }
    },

    buscarTudoPaginado: async function (uid, inicio, fim) {
        console.log("Assertividade: Contando registros...", { uid, inicio, fim });

        let queryCount = Sistema.supabase.from('assertividade')
            .select('*', { count: 'exact', head: true })
            .gte('data_referencia', inicio)
            .lte('data_referencia', fim)
            .not('auditora_nome', 'is', null);

        if (uid) queryCount = queryCount.eq('usuario_id', uid);

        const { count, error: errCount } = await queryCount;

        if (errCount) {
            console.error("Assertividade: Erro no count", errCount);
            throw errCount;
        }
        console.log("Assertividade: Count total", count);

        if (count === 0) return [];

        const PAGE_SIZE = 1000;
        const totalPages = Math.ceil(count / PAGE_SIZE);
        const promises = [];
        const colunas = 'id, id_ppc, data_referencia, auditora_nome, tipo_documento, doc_name, observacao, status, empresa_nome, assistente_nome, qtd_nok';
        const MAX_PAGES = 300;
        const pagesToFetch = Math.min(totalPages, MAX_PAGES);

        console.log(`Assertividade: Buscando ${pagesToFetch} paginas...`);

        for (let i = 0; i < pagesToFetch; i++) {
            const rangeStart = i * PAGE_SIZE;
            const rangeEnd = (i + 1) * PAGE_SIZE - 1;

            let query = Sistema.supabase.from('assertividade')
                .select(colunas)
                .gte('data_referencia', inicio)
                .lte('data_referencia', fim)
                .not('auditora_nome', 'is', null)
                .range(rangeStart, rangeEnd);

            if (uid) query = query.eq('usuario_id', uid);
            promises.push(query);
        }

        const responses = await Promise.all(promises);
        console.log("Assertividade: Promises resolvidas.");
        let todos = [];
        responses.forEach(({ data, error }) => { if (!error && data) todos = todos.concat(data); });
        console.log("Assertividade: Total registros concatenados", todos.length);
        return todos;
    },

    // --- UTILS & HELPERS ---
    getFriendlyName: function (technicalName) {
        if (!technicalName) return 'Sem Nome';
        const FRIENDLY_NAMES_MAP = {
            'DOC_NDF_100%': 'Empresas 100%',
            'DOC_NDF_CATEGORIA PROFISSIONAL': 'Categoria DIP',
            'DOC_NDF_DEPENDENTE': 'Categoria Dependentes',
            'DOC_NDF_ESTADO CIVIL': 'Categoria Certidão',
            'DOC_NDF_ESTRANGEIRO': 'Categoria Estrangeiro',
            'DOC_NDF_LAUDO': 'Categoria Laudo',
            'DOC_NDF_OUTROS': 'Empresa deveria Validar'
        };
        return FRIENDLY_NAMES_MAP[technicalName] || technicalName;
    },

    isNDF: function (d) {
        return (d.tipo_documento || '').toUpperCase().startsWith('DOC_NDF_');
    },

    getDocType: function (d) {
        if (this.isNDF(d)) return d.tipo_documento || "DOC_NDF_GENERICO";
        return d.doc_name || d.tipo_documento || 'Documento Gupy';
    },

    mudarVisao: function (novaVisao) {
        this.visaoAtual = novaVisao;
        const btnDoc = document.getElementById('btn-view-doc');
        const btnEmpresa = document.getElementById('btn-view-empresa');
        const btnNdf = document.getElementById('btn-view-ndf');
        const baseClass = "px-3 py-1 text-[10px] font-bold rounded transition ";
        const activeClass = "bg-white text-rose-600 shadow-sm";
        const inactiveClass = "text-slate-500 hover:bg-white";

        if (btnDoc) btnDoc.className = baseClass + (novaVisao === 'doc' ? activeClass : inactiveClass);
        if (btnEmpresa) btnEmpresa.className = baseClass + (novaVisao === 'empresa' ? activeClass : inactiveClass);
        if (btnNdf) btnNdf.className = baseClass + (novaVisao === 'ndf' ? activeClass : inactiveClass);

        this.limparFiltro(false);
        const base = this.listaErrosCache;
        let filtrados = (novaVisao === 'ndf') ? base.filter(d => this.isNDF(d)) : base;

        this.atualizarGrafico(filtrados);
        this.renderizarFeed(filtrados, document.getElementById('feed-erros-container'));
    },

    filtrarPorBusca: function (texto) {
        if (!texto || texto.trim() === '') {
            this.limparFiltro(true);
            return;
        }
        const termo = texto.toLowerCase();
        const base = this.listaErrosCache;
        const filtrados = [];
        let matches = 0;

        for (let i = 0; i < base.length; i++) {
            if (matches >= 100) break;
            const d = base[i];
            const nome = (d.doc_name || '').toLowerCase();
            const tipoTecnico = (this.getDocType(d) || '');
            const tipoAmigavel = this.getFriendlyName(tipoTecnico).toLowerCase();
            const obs = (d.observacao || '').toLowerCase();
            const emp = (d.empresa_nome || '').toLowerCase();
            const idppc = (d.id_ppc || '').toLowerCase();

            if (nome.includes(termo) || tipoTecnico.toLowerCase().includes(termo) || tipoAmigavel.includes(termo) || obs.includes(termo) || idppc.includes(termo) || emp.includes(termo)) {
                filtrados.push(d);
                matches++;
            }
        }
        this.renderizarFeed(filtrados, document.getElementById('feed-erros-container'));
        const btn = document.getElementById('btn-limpar-filtro');
        if (btn) { btn.classList.remove('hidden'); btn.innerHTML = `<i class="fas fa-times text-rose-500"></i> Limpar Busca`; }
    },

    filtrarPorSelecao: function (valorAmigavel) {
        const base = this.listaErrosCache;
        const filtrados = [];
        let limit = 0;
        for (let i = 0; i < base.length; i++) {
            if (limit >= 200) break;
            const d = base[i];
            let match = false;
            if (this.visaoAtual === 'empresa') {
                const emp = d.empresa_nome || 'Desconhecida';
                match = (emp === valorAmigavel || emp.includes(valorAmigavel.replace('...', '')));
            } else {
                const tipoTecnico = this.visaoAtual === 'ndf' ? (d.tipo_documento || '') : this.getDocType(d);
                const nomeAmigavelItem = this.getFriendlyName(tipoTecnico);
                match = (nomeAmigavelItem === valorAmigavel || nomeAmigavelItem.includes(valorAmigavel.replace('...', '')));
            }
            if (match) { filtrados.push(d); limit++; }
        }
        this.aplicarFiltroVisual(filtrados, valorAmigavel);
    },

    aplicarFiltroVisual: function (lista, nomeFiltro) {
        const container = document.getElementById('feed-erros-container');
        this.renderizarFeed(lista, container);
        const btn = document.getElementById('btn-limpar-filtro');
        if (btn) { btn.classList.remove('hidden'); btn.innerHTML = `<i class="fas fa-times text-rose-500"></i> Limpar: ${nomeFiltro}`; }
    },

    limparFiltro: function (renderizar = true) {
        const btn = document.getElementById('btn-limpar-filtro');
        if (btn) btn.classList.add('hidden');
        const inputBusca = document.querySelector('#ma-tab-assertividade input');
        if (inputBusca) inputBusca.value = '';
        if (renderizar) this.mudarVisao(this.visaoAtual);
    },

    renderizarFeed: function (lista, container) {
        if (!container) return;
        const LIMITE_RENDER = 100;
        const totalItens = lista.length;
        lista.sort((a, b) => new Date(b.data_referencia || 0) - new Date(a.data_referencia || 0));
        const itensVisiveis = lista.slice(0, LIMITE_RENDER);

        if (totalItens === 0) {
            container.innerHTML = '<div class="text-center py-8 text-slate-400">Nenhum erro encontrado neste filtro.</div>';
            return;
        }

        let html = '';
        if (totalItens > LIMITE_RENDER) {
            html += `<div class="bg-blue-50 text-blue-600 text-[10px] font-bold p-2 rounded mb-2 text-center border border-blue-100"><i class="fas fa-info-circle"></i> Exibindo os ${LIMITE_RENDER} erros mais recentes de um total de ${totalItens.toLocaleString()}.</div>`;
        }

        itensVisiveis.forEach(doc => {
            const data = doc.data_referencia ? new Date(doc.data_referencia).toLocaleDateString('pt-BR') : '-';
            const nomeDocumentoOriginal = doc.doc_name || 'Sem Nome';
            const tipoTecnico = this.getDocType(doc);
            const subtitulo = this.getFriendlyName(tipoTecnico);
            const empresa = doc.empresa_nome || '';
            const obs = doc.observacao || 'Sem observação.';
            const isNdf = this.isNDF(doc);
            const idPPC = doc.id_ppc || '-';

            let badgeClass = 'bg-rose-50 text-rose-600';
            let badgeText = 'NOK';
            let borderClass = 'border-l-rose-500';

            if (isNdf) {
                badgeClass = 'bg-amber-100 text-amber-700';
                badgeText = 'NDF';
                borderClass = 'border-l-amber-500';
            }

            const assistenteInfo = (!MinhaArea.getUsuarioAlvo()) ? `<span class="block text-[9px] text-blue-500 font-bold mt-1">👤 ${doc.assistente_nome || 'Equipe'}</span>` : '';

            html += `
            <div class="bg-white p-3 rounded-lg border-l-4 ${borderClass} shadow-sm hover:shadow-md transition border border-slate-100 group mb-2">
                <div class="flex justify-between items-start mb-1">
                    <div class="overflow-hidden pr-2 w-full">
                        <div class="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                            <span>${data}</span>
                            <span class="text-slate-200">|</span>
                            <span class="text-slate-500 bg-slate-100 px-1 rounded" title="ID da PPC">ID: ${idPPC}</span>
                            <span class="text-slate-200">|</span>
                            <span class="truncate">${subtitulo}</span>
                        </div>
                        <h4 class="font-bold text-slate-700 text-xs leading-tight truncate" title="${nomeDocumentoOriginal}">${nomeDocumentoOriginal}</h4>
                        <div class="text-[9px] text-slate-500 truncate" title="${empresa}">${empresa}</div>
                        ${assistenteInfo}
                    </div>
                    <div class="${badgeClass} text-[9px] font-bold px-1.5 py-0.5 rounded border border-white shadow-sm whitespace-nowrap">${badgeText}</div>
                </div>
                <div class="bg-slate-50 p-2 rounded text-[10px] text-slate-600 italic border border-slate-100 line-clamp-2" title="${obs}"><i class="fas fa-quote-left text-slate-300 mr-1"></i> ${obs}</div>
            </div>`;
        });
        container.innerHTML = html;
    },

    renderizarGraficoOfensores: function (dados) {
        const ctx = document.getElementById('graficoTopOfensores');
        if (!ctx) return;
        if (this.chartOfensores) this.chartOfensores.destroy();

        const labels = dados.map(d => d[0]);
        const values = dados.map(d => d[1]);
        const _this = this;
        let barColor = '#f43f5e';
        if (this.visaoAtual === 'empresa') barColor = '#3b82f6';
        if (this.visaoAtual === 'ndf') barColor = '#d97706';

        this.chartOfensores = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Ocorrências', data: values, backgroundColor: barColor, borderRadius: 4, barThickness: 'flex', maxBarThickness: 30, hoverBackgroundColor: '#1e293b' }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                onClick: (e, elements) => { if (elements.length > 0) { const index = elements[0].index; _this.filtrarPorSelecao(labels[index]); } },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(30, 41, 59, 0.9)', padding: 10 } },
                scales: { x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { autoSkip: true, maxTicksLimit: 8, font: { size: 10 } } }, y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#64748b' } } }
            }
        });
    },

    renderizarVazio: function (container) {
        container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-center p-8"><div class="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4 text-emerald-500"><i class="fas fa-trophy text-3xl"></i></div><h3 class="text-lg font-bold text-slate-700">Parabéns!</h3><p class="text-sm text-slate-500">Nenhum erro encontrado nos registros auditados.</p></div>';
    },

    renderizarGraficoVazio: function () {
        const ctx = document.getElementById('graficoTopOfensores');
        if (ctx && this.chartOfensores) this.chartOfensores.destroy();
    },

    toggleMostrarTodos: function () {
        this.mostrarTodos = !this.mostrarTodos;
        const btn = document.getElementById('btn-ver-todos');
        if (btn) btn.innerText = this.mostrarTodos ? 'Ver Top 5' : 'Ver Todos';
        this.mudarVisao(this.visaoAtual);
    }
};