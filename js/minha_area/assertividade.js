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
                            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Documentos</h3>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('auditados')">
                                <span class="text-[10px] font-bold text-slate-600">Auditados</span><span id="card-total-auditados" class="text-xs font-black text-blue-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('ok')">
                                <span class="text-[10px] font-bold text-slate-600">Total com OK</span><span id="card-total-acertos" class="text-xs font-black text-emerald-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('erros_doc')">
                                <span class="text-[10px] font-bold text-slate-600">Total com Erros</span><span id="card-total-docs-nok" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('indevidos')">
                                <span class="text-[10px] font-bold text-slate-600">Total Documentos Aceitos Indevidos</span><span id="card-docs-aceitos-indevidos" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center pl-2 mt-0.5 cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('ndf_empresa')">
                                <span class="text-[9px] font-bold text-rose-600 flex items-center gap-1">
                                    <i class="fas fa-level-up-alt rotate-90 text-[8px]"></i> Total NOK (empresa Válida)
                                </span>
                                <span id="card-empresa-validar" class="text-[10px] font-bold text-rose-600">--</span>
                            </div>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">Campos</h3>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('erros_campo')">
                                <span class="text-[10px] font-bold text-slate-600">Total com Erros</span><span id="card-total-erros" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 border-b border-slate-100 dashed cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('erros_gupy')">
                                <span class="text-[10px] font-bold text-slate-600">Total com erros Gupy</span><span id="card-erros-gupy" class="text-xs font-black text-rose-600">--</span>
                            </div>
                            <div class="flex justify-between items-center py-1.5 cursor-pointer hover:bg-slate-50 transition px-1 rounded" onclick="MinhaArea.Assertividade.filtrarPorCards('erros_ndf')">
                                <span class="text-[10px] font-bold text-slate-600">Total com erros NDF</span><span id="card-erros-ndf" class="text-xs font-black text-amber-600">--</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="w-full lg:w-2/3 flex flex-col h-full"> 
                 <div class="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden relative">
                    <div class="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center z-10 relative">
                        <div>
                            <h3 class="font-bold text-slate-700 flex items-center gap-2" id="feed-erros-titulo">
                                <i class="fas fa-exclamation-triangle text-amber-500"></i> Feed de Atenção
                            </h3>
                            <p class="text-xs text-slate-500" id="feed-erros-subtitulo">Documentos reprovados (NOK).</p>
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

        // Renderiza o template se estiver vazio, com o placeholder ou com versão antiga (sem novos IDs)
        if (container.innerHTML.includes('Carregando Painel') || container.innerHTML.trim() === '' ||
            !container.querySelector('#card-docs-aceitos-indevidos')) {
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
        const elTotalDocsNok = document.getElementById('card-total-docs-nok');
        const elErrosGupy = document.getElementById('card-erros-gupy');
        const elErrosNdf = document.getElementById('card-erros-ndf');
        const elEmpresaValidar = document.getElementById('card-empresa-validar');
        const elDocsAceitosIndevidos = document.getElementById('card-docs-aceitos-indevidos');
        const btnLimpar = document.getElementById('btn-limpar-filtro');

        if (btnLimpar) btnLimpar.classList.add('hidden');
        if (containerFeed) containerFeed.innerHTML = '<div class="text-center py-12 text-slate-400"><i class="fas fa-circle-notch fa-spin text-2xl mb-2 text-blue-500"></i><br>Analisando auditorias...</div>';

        try {
            console.log("Assertividade: Iniciando buscarTudoPaginado...");
            const resData = await this.buscarTudoPaginado(uid, inicio, fim);
            const dados = resData.dados;
            const totalProducaoNoPeriodo = resData.totalProducao || 0;

            console.log("Assertividade: buscarTudoPaginado retornou.", dados ? dados.length : "null");
            this.dadosBrutosCache = dados;

            console.log(`📦 Base Total: ${totalProducaoNoPeriodo} docs (Produção) / ${dados.length} registros (Auditoria/Erros).`);

            let countTotalAuditados = 0;
            let countTotalAcertos = 0;
            let countTotalNok = 0;
            let countTotalDocsNok = 0;
            let countErrosGupy = 0;
            let countErrosNdf = 0;
            let countNdfEmpresa = 0;
            let countDocsAceitosIndevidos = 0;
            const listaErros = [];

            for (let i = 0; i < dados.length; i++) {
                const d = dados[i];
                const nokVal = Number(d.qtd_nok || 0);
                const assertVal = d.assertividade_val !== null ? Number(d.assertividade_val) : null;
                const status = (d.status || '').toUpperCase();
                
                const tipoDocUpper = (d.tipo_documento || '').toUpperCase();
                const isNdf = tipoDocUpper.startsWith('DOC_NDF_');
                const isAceitoIndevido = (tipoDocUpper === 'DOC_NDF_EMPRESA');
                const isNokReal = nokVal > 0 || status === 'NOK';

                // [REGRA] Auditados: Contar Doc_name onde % ASSERT é de 0% a 100%
                if (d.doc_name && assertVal !== null && assertVal >= 0 && assertVal <= 100) {
                    countTotalAuditados++;
                }

                // [REGRA] Total com OK: Contar Doc_name onde % ASSERT >= 100% (Exceto se for Aceito Indevido)
                if (d.doc_name && assertVal !== null && assertVal >= 100 && !isAceitoIndevido) {
                    countTotalAcertos++;
                }

                // [REGRA] DOCUMENTOS com ERRO: Consideramos erro se for Gupy < 100% OU se for um Aceito Indevido que seja de fato NOK.
                const isGupyErrorDoc = d.doc_name && assertVal !== null && assertVal < 100 && assertVal >= 0;
                if (isGupyErrorDoc || (isAceitoIndevido && isNokReal)) {
                    countTotalDocsNok++;
                }

                // [REGRA] CAMPOS com NOK: Somatória total de falhas identificadas
                if (isNokReal) {
                    countTotalNok += nokVal || (status === 'NOK' ? 1 : 0); // Soma os campos ou garante 1 se for status NOK
                    if (isNdf) {
                        countErrosNdf += nokVal || (status === 'NOK' ? 1 : 0);
                        // [FIX] Total NOK (empresa Válida): Contador de DOCUMENTOS (Indivíduos) que falharam
                        if (isAceitoIndevido) {
                            countNdfEmpresa++; 
                        }
                    } else {
                        countErrosGupy += nokVal;
                    }
                }

                // [REGRA] Aceitos Indevidos: Contador TOTAL de documentos do grupo (Independente de NOK ou não)
                if (isAceitoIndevido) {
                    countDocsAceitosIndevidos++;
                }

                // Feed continua mostrando qualquer linha com NOK real OU se for um Aceito Indevido para revisão
                if (isNokReal || isAceitoIndevido) {
                    listaErros.push(d);
                }
            }

            this.listaErrosCache = listaErros;

            // [FIX] Agora usamos countTotalAcertos calculado no loop conforme regra nova
            const totalAcertos = countTotalAcertos;

            if (elTotalAuditados) elTotalAuditados.innerText = countTotalAuditados.toLocaleString('pt-BR');
            if (elTotalAcertos) elTotalAcertos.innerText = totalAcertos.toLocaleString('pt-BR');
            if (elTotalDocsNok) elTotalDocsNok.innerText = countTotalDocsNok.toLocaleString('pt-BR');
            if (elTotalErros) elTotalErros.innerText = countTotalNok.toLocaleString('pt-BR');
            if (elErrosGupy) elErrosGupy.innerText = countErrosGupy.toLocaleString('pt-BR');
            if (elErrosNdf) elErrosNdf.innerText = countErrosNdf.toLocaleString('pt-BR');
            if (elEmpresaValidar) elEmpresaValidar.innerText = countNdfEmpresa.toLocaleString('pt-BR');
            if (elDocsAceitosIndevidos) elDocsAceitosIndevidos.innerText = countDocsAceitosIndevidos.toLocaleString('pt-BR');

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
        console.log("Assertividade: Buscando registros no TiDB...", { uid, inicio, fim });

        const colunas = 'id, id_ppc, data_referencia, auditora_nome, tipo_documento, doc_name, observacao, status, empresa_nome, assistente_nome, qtd_nok, qtd_campos, qtd_ok, assertividade_val, usuario_id';

        // [FIX v4.50] Busca auditados + qualquer registro que tenha marcação de falha (mesmo sem auditor)
        let sql = `SELECT ${colunas} FROM assertividade WHERE data_referencia >= ? AND data_referencia <= ? 
                   AND (auditora_nome IS NOT NULL OR assertividade_val IS NOT NULL OR status = 'NOK' OR doc_name = 'nok' OR qtd_nok > 0 OR tipo_documento = 'DOC_NDF_EMPRESA')`;

        // [FIX v4.51] O Total de Produção (Auditados) deve seguir o mesmo filtro dos registros mostrados
        let sqlTotal = `SELECT COUNT(*) as total FROM assertividade WHERE data_referencia >= ? AND data_referencia <= ?
                        AND (auditora_nome IS NOT NULL OR assertividade_val IS NOT NULL OR status = 'NOK' OR doc_name = 'nok' OR qtd_nok > 0 OR tipo_documento = 'DOC_NDF_EMPRESA')`;

        let params = [inicio, fim];
        let paramsTotal = [inicio, fim];

        if (uid && uid !== 'GRUPO_CLT' && uid !== 'GRUPO_TERCEIROS') {
            sql += ` AND usuario_id = ?`;
            sqlTotal += ` AND usuario_id = ?`;
            params.push(uid);
            paramsTotal.push(uid);
        }

        const [data, dataTotal] = await Promise.all([
            Sistema.query(sql, params),
            Sistema.query(sqlTotal, paramsTotal)
        ]);

        if (!data) return { dados: [], totalProducao: 0 };
        let todos = data;

        // Aplica filtro local para Grupos Virtuais / Filtro do Topo
        const filtroContrato = (MinhaArea.Metas && MinhaArea.Metas.currentFilterContract) ? MinhaArea.Metas.currentFilterContract : 'TODOS';

        if (filtroContrato !== 'TODOS' || uid === 'GRUPO_CLT' || uid === 'GRUPO_TERCEIROS') {
            const mapa = (MinhaArea.Metas && MinhaArea.Metas.allActiveUsers)
                ? MinhaArea.Metas.allActiveUsers.reduce((acc, u) => { acc[u.id] = u.contrato || ''; return acc; }, {})
                : {};

            todos = todos.filter(d => {
                const c = (mapa[d.usuario_id] || '').toUpperCase();
                const isPJ = c.includes('TERCEI') || c.includes('PJ') || c.includes('PREST');

                if (filtroContrato === 'CLT' || uid === 'GRUPO_CLT') return !isPJ;
                if (filtroContrato === 'PJ' || uid === 'GRUPO_TERCEIROS') return isPJ;
                return true;
            });
        }

        const totalFinal = dataTotal ? (dataTotal[0]?.total || 0) : todos.length;
        console.log("Assertividade: Total registros carregados", todos.length, "Total Produção:", totalFinal);
        return { dados: todos, totalProducao: totalFinal };
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

    fixText: function (str) {
        if (!str) return '';
        // [FIX] Limpeza de caracteres corrompidos U+FFFD (Diamante com ?)
        // Tenta recuperar padrões comuns se ainda existirem no banco ou virem de fontes legadas
        return str
            .replace(/\uFFFDo/g, 'ão').replace(/\uFFFD o/g, 'ão')
            .replace(/\uFFFDO/g, 'ÃO').replace(/\uFFFD O/g, 'ÃO')
            .replace(/\uFFFDe/g, 'ê').replace(/\uFFFD e/g, 'ê')
            .replace(/\uFFFDE/g, 'Ê').replace(/\uFFFD E/g, 'Ê')
            .replace(/\uFFFDa/g, 'á').replace(/\uFFFD a/g, 'á')
            .replace(/\uFFFDA/g, 'Á').replace(/\uFFFD A/g, 'Á')
            .replace(/\uFFFDi/g, 'í').replace(/\uFFFD i/g, 'í')
            .replace(/\uFFFDI/g, 'Í').replace(/\uFFFD I/g, 'Í')
            .replace(/\uFFFDu/g, 'ú').replace(/\uFFFD u/g, 'ú')
            .replace(/\uFFFDU/g, 'Ú').replace(/\uFFFD U/g, 'Ú')
            .replace(/\uFFFDS/g, 'ÓS').replace(/\uFFFD S/g, 'ÓS')
            .replace(/\uFFFD/g, ''); // Remove qualquer outro diamante remanescente
    },

    isNDF: function (d) {
        return (d.tipo_documento || '').toUpperCase().startsWith('DOC_NDF_');
    },

    getDocType: function (d) {
        if (this.isNDF(d)) return this.fixText(d.tipo_documento || "DOC_NDF_GENERICO");
        return this.fixText(d.doc_name || d.tipo_documento || 'Documento Gupy');
    },

    atualizarGrafico: function (dadosFiltrados) {
        const agrupaPor = this.visaoAtual; // 'doc', 'empresa', 'ndf'
        const contagem = {};

        dadosFiltrados.forEach(d => {
            let chave = '';
            if (agrupaPor === 'empresa') {
                chave = d.empresa_nome || 'Sem Empresa';
            } else if (agrupaPor === 'ndf') {
                // [FIX v4.43] Para DOC_NDF_EMPRESA: detalha por nome do documento
                // Para outros NDF: agrupa pelo tipo técnico
                const tipo = (d.tipo_documento || '').toUpperCase();
                if (tipo === 'DOC_NDF_EMPRESA') {
                    chave = d.doc_name || 'Empresa (sem nome)';
                } else {
                    chave = this.getFriendlyName(d.tipo_documento) || 'Outros NDF';
                }
            } else {
                // Visão DOC (Padrão)
                chave = this.getFriendlyName(this.getDocType(d));
            }

            if (!contagem[chave]) contagem[chave] = 0;
            contagem[chave]++;
        });

        // Converter para array e ordenar
        let arrayDados = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

        // Top 5 ou Todos
        if (!this.mostrarTodos) {
            arrayDados = arrayDados.slice(0, 5);
        }

        this.renderizarGraficoOfensores(arrayDados);
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

            if (nome.includes(termo) || tipoTecnico.toLowerCase().includes(termo) || tipoAmigavel.includes(termo) || obs.includes(termo) || idppc.includes(termo) || emp.includes(termo) || (d.status || '').toLowerCase().includes(termo)) {
                filtrados.push(d);
                matches++;
            }
        }
        this.renderizarFeed(filtrados, document.getElementById('feed-erros-container'));
        const btn = document.getElementById('btn-limpar-filtro');
        if (btn) { btn.classList.remove('hidden'); btn.innerHTML = `<i class="fas fa-times text-rose-500"></i> Limpar Busca`; }
    },

    filtrarPorSelecao: function (valorAmigavel) {
        let base = this.listaErrosCache;
        if (this.visaoAtual === 'ndf') {
            base = base.filter(d => this.isNDF(d));
        }

        const filtrados = [];
        let limit = 0;
        for (let i = 0; i < base.length; i++) {
            if (limit >= 200) break;
            const d = base[i];
            let match = false;
            if (this.visaoAtual === 'empresa') {
                const emp = d.empresa_nome || 'Desconhecida';
                match = (emp === valorAmigavel || emp.includes(valorAmigavel.replace('...', '')));
            } else if (this.visaoAtual === 'ndf') {
                const tipo = (d.tipo_documento || '').toUpperCase();
                if (tipo === 'DOC_NDF_EMPRESA') {
                    // [FIX v4.43] Filtra pelo nome do documento para DOC_NDF_EMPRESA
                    const docNome = d.doc_name || 'Empresa (sem nome)';
                    match = (docNome === valorAmigavel || docNome.includes(valorAmigavel.replace('...', '')));
                } else {
                    const nomeAmigavelItem = this.getFriendlyName(d.tipo_documento || 'Outros NDF');
                    match = (nomeAmigavelItem === valorAmigavel || nomeAmigavelItem.includes(valorAmigavel.replace('...', '')));
                }
            } else {
                // Visão DOC
                const tipoTecnico = this.getDocType(d);
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
        const inputBusca = document.querySelector('#container-painel-assertividade input');
        if (inputBusca) inputBusca.value = '';

        const titulo = document.getElementById('feed-erros-titulo');
        const subtitulo = document.getElementById('feed-erros-subtitulo');
        if (titulo) titulo.innerHTML = `<i class="fas fa-exclamation-triangle text-amber-500"></i> Feed de Atenção`;
        if (subtitulo) subtitulo.innerText = `Documentos reprovados (NOK).`;

        if (renderizar) this.mudarVisao(this.visaoAtual);
    },

    filtrarPorCards: function (tipo) {
        const base = this.dadosBrutosCache || [];
        let filtrados = [];
        let label = '';
        let sub = '';

        switch (tipo) {
            case 'auditados':
                filtrados = base.filter(d => d.doc_name && d.assertividade_val !== null);
                label = 'Auditorias Realizadas';
                sub = 'Todos os documentos auditados no período.';
                break;
            case 'ok':
                filtrados = base.filter(d => d.doc_name && d.assertividade_val !== null && Number(d.assertividade_val) >= 100 && (d.tipo_documento || '').toUpperCase() !== 'DOC_NDF_EMPRESA');
                label = 'Documentos Aprovados';
                sub = 'Auditorias com 100% de assertividade.';
                break;
            case 'erros_doc':
                filtrados = base.filter(d => {
                    const assertVal = d.assertividade_val !== null ? Number(d.assertividade_val) : null;
                    const isAceitoIndevido = (d.tipo_documento || '').toUpperCase().trim() === 'DOC_NDF_EMPRESA';
                    const isNokReal = (Number(d.qtd_nok) > 0) || (d.status || '').toUpperCase() === 'NOK';
                    return (d.doc_name && assertVal !== null && assertVal < 100) || (isAceitoIndevido && isNokReal);
                });
                label = 'Documentos Reprovados';
                sub = 'Auditorias com falhas confirmadas.';
                break;
            case 'indevidos':
                filtrados = base.filter(d => (d.tipo_documento || '').toUpperCase().trim() === 'DOC_NDF_EMPRESA');
                label = 'Aceitos Indevidos';
                sub = 'Listagem de documentos que a empresa deveria ter validado.';
                break;
            case 'ndf_empresa':
                // Mostra apenas os documentos NOK (contribuem para o sub-total vermelho)
                filtrados = base.filter(d => (d.tipo_documento || '').toUpperCase().trim() === 'DOC_NDF_EMPRESA' && ((Number(d.qtd_nok) > 0) || (d.status || '').toUpperCase() === 'NOK'));
                label = 'Total NOK (empresa Válida)';
                sub = 'Documentos pendentes de validação correta pela empresa.';
                break;
            case 'erros_campo':
                filtrados = base.filter(d => (d.qtd_nok || 0) > 0);
                label = 'Campos com Erro';
                sub = 'Registros que possuem campos NOK.';
                break;
            case 'erros_gupy':
                filtrados = base.filter(d => (d.qtd_nok || 0) > 0 && !this.isNDF(d));
                label = 'Erros Gupy';
                sub = 'Erros em campos padrão do sistema (Gupy).';
                break;
            case 'erros_ndf':
                filtrados = base.filter(d => (d.qtd_nok || 0) > 0 && this.isNDF(d));
                label = 'Erros NDF';
                sub = 'Erros capturados em Notas de Falta (NDF).';
                break;
        }

        const titulo = document.getElementById('feed-erros-titulo');
        const subtitulo = document.getElementById('feed-erros-subtitulo');
        if (titulo) titulo.innerHTML = `<i class="fas fa-filter text-blue-500"></i> ${label}`;
        if (subtitulo) subtitulo.innerText = sub;

        this.renderizarFeed(filtrados, document.getElementById('feed-erros-container'));

        const btn = document.getElementById('btn-limpar-filtro');
        if (btn) {
            btn.classList.remove('hidden');
            btn.innerHTML = `<i class="fas fa-times text-rose-500"></i> Limpar Filtro`;
        }
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
            const nomeDocumentoOriginal = this.fixText(doc.doc_name || 'Sem Nome');
            const tipoTecnico = this.getDocType(doc);
            const subtitulo = this.getFriendlyName(tipoTecnico);
            const empresa = doc.empresa_nome || '';
            const obs = this.fixText(doc.observacao || 'Sem observação.');
            const isNdf = this.isNDF(doc);
            const idPPC = doc.id_ppc || '-';

            let badgeClass = 'bg-rose-50 text-rose-600';
            let badgeText = 'NOK';
            let borderClass = 'border-l-rose-500';

            const assertVal = doc.assertividade_val !== null ? Number(doc.assertividade_val) : null;
            const isOk = assertVal !== null && assertVal >= 100 && (doc.qtd_nok || 0) === 0;

            if (isOk) {
                badgeClass = 'bg-emerald-50 text-emerald-600';
                badgeText = 'OK';
                borderClass = 'border-l-emerald-500';
            } else if (isNdf) {
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
                <div class="bg-slate-50 p-2 rounded text-[10px] text-slate-600 italic border border-slate-100 cursor-pointer overflow-hidden transition-all duration-200" style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" onclick="this.style.webkitLineClamp = this.style.webkitLineClamp === '2' ? 'unset' : '2';" title="Clique para expandir/recolher observação"><i class="fas fa-quote-left text-slate-300 mr-1"></i> ${obs}</div>
            </div>`;
        });
        container.innerHTML = html;
    },

    renderizarGraficoOfensores: function (dados) {
        const ctx = document.getElementById('graficoTopOfensores');
        if (!ctx) return;
        if (this.chartOfensores) this.chartOfensores.destroy();

        const labels = dados.map(d => {
            const label = d[0] || '';
            // Se o nome for muito grande, coloca reticências para o gráfico não encavalar
            return label.length > 35 ? label.substring(0, 32) + '...' : label;
        });
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
                onClick: (e, elements, chart) => {
                    try {
                        if (elements && elements.length > 0) {
                            const index = elements[0].index;
                            _this.filtrarPorSelecao(chart.data.labels[index]);
                        } else if (chart) {
                            const points = chart.getElementsAtEventForMode(e, 'y', { intersect: false }, true);
                            if (points && points.length > 0) {
                                _this.filtrarPorSelecao(chart.data.labels[points[0].index]);
                            }
                        }
                    } catch (err) {
                        console.error('Erro no clique Chart:', err);
                    }
                },
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