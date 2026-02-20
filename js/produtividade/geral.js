/* ARQUIVO: js/produtividade/geral.js
   VERSÃO: V4.1 (Fix Abono)
   DESCRIÇÃO: Correção na lógica de salvar abono para garantir persistência no Supabase.
*/
window.Produtividade = window.Produtividade || {};

Produtividade.Geral = {
    state: {
        loading: false,
        modoDetalhe: false,
        usuarioDetalhe: null,
        headerOriginal: null,

        dadosProducao: [],
        dadosKPIAssertividade: [],
        dadosMetas: [],
        mapaUsuarios: {},
        listaTabela: [],
        range: { inicio: null, fim: null },
        selecionados: new Set(),
        abonoAlvo: null,
        configMes: null
    },

    init: function () {
        console.log("Produtividade Geral V5 carregada.");
        this.cacheSelectors();

        if (document.querySelector('#tab-geral thead')) {
            this.state.headerOriginal = document.querySelector('#tab-geral thead').innerHTML;
        }

        this.injetarModalAbono();
        if (this.els.tabela) this.renderLoading();
    },

    carregarTela: function () {
        if (!this.els || !this.els.tabela) this.cacheSelectors();
        this.injetarModalAbono();
        return this.atualizarDados();
    },

    cacheSelectors: function () {
        this.els = {
            tabelaHeader: document.querySelector('#tab-geral thead'),
            tabela: document.getElementById('tabela-corpo'),
            totalFooter: document.getElementById('total-registros-footer'),
            // ... (KPIs mantidos igual ao original) ...
            kpiVolume: document.getElementById('kpi-validacao-real'),
            kpiMetaVolume: document.getElementById('kpi-validacao-esperado'),
            kpiVolumePct: document.getElementById('kpi-volume-pct'),
            barVolume: document.getElementById('bar-volume'),
            kpiAssertReal: document.getElementById('kpi-meta-assertividade-val'),
            kpiAssertTarget: document.getElementById('kpi-meta-assertividade-target'),
            kpiAssertPct: document.getElementById('kpi-assertividade-pct'),
            barAssert: document.getElementById('bar-assertividade'),
            kpiDiasTrabalhados: document.getElementById('kpi-dias-trabalhados'),
            kpiDiasUteis: document.getElementById('kpi-dias-uteis'),
            kpiDiasPct: document.getElementById('kpi-dias-pct'),
            barDias: document.getElementById('bar-dias'),
            kpiAssisAtivos: document.getElementById('kpi-assistentes-ativos'),
            kpiAssisTotal: document.getElementById('kpi-assistentes-total'),
            kpiAssisPct: document.getElementById('kpi-assistentes-pct'),
            barAssis: document.getElementById('bar-assistentes'),
            kpiVelocReal: document.getElementById('kpi-media-real'),
            kpiVelocEsperada: document.getElementById('kpi-media-esperada'),
            kpiVelocPct: document.getElementById('kpi-velocidade-pct'),
            barVeloc: document.getElementById('bar-velocidade'),
            selectionHeader: document.getElementById('selection-header')
        };
    },

    atualizarDados: async function () {
        if (!window.Produtividade || !window.Produtividade.getDatasFiltro) return;

        const range = window.Produtividade.getDatasFiltro();
        this.state.range = range;
        this.state.selecionados.clear();
        this.atualizarBarraFlutuante();

        this.state.loading = true;
        this.renderLoading();

        try {
            await this.buscarUsuarios();

            await Promise.all([
                this.buscarProducao(range),
                this.buscarAssertividadeUnificada(range),
                this.buscarMetas(range)
            ]);

            this.processarDadosUnificados();

            if (this.state.modoDetalhe && this.state.usuarioDetalhe) {
                this.renderizarDetalhes(this.state.usuarioDetalhe);
            } else {
                this.calcularKpisGlobal();
                this.renderizarTabela();
            }

        } catch (error) {
            console.error("Erro Geral:", error);
            if (this.els.tabela) this.els.tabela.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-rose-500">Erro: ${error.message}</td></tr>`;
        } finally {
            this.state.loading = false;
        }
    },

    // ... (buscarUsuarios, buscarProducao, buscarAssertividadeUnificada, buscarMetas mantidos igual) ...
    buscarUsuarios: async function () {
        if (Object.keys(this.state.mapaUsuarios).length > 0) return;
        try {
            const data = await Sistema.query('SELECT id, nome, perfil, funcao, contrato, ativo FROM usuarios');
            if (data) data.forEach(u => this.state.mapaUsuarios[u.id] = u);
        } catch (e) {
            console.error("Erro ao buscar usuários:", e);
        }
    },

    buscarProducao: async function (range) {
        let sql = 'SELECT * FROM producao WHERE data_referencia >= ? AND data_referencia <= ?';
        let params = [range.inicio, range.fim];

        // Simula o filtro de permissão (aplicarFiltroPermissao)
        // Se aplicarFiltroPermissao só adiciona WHERE usuario_id = ?, podemos fazer aqui

        const user = window.Produtividade.usuario || {};
        if (!this.ehGestao(user) && user.id) {
            sql += ' AND usuario_id = ?';
            params.push(user.id);
        }


        try {
            const data = await Sistema.query(sql, params);
            this.state.dadosProducao = data || [];
        } catch (error) {
            console.error("Erro Prod:", error);
            throw new Error("Erro Prod: " + error.message);
        }
    },

    buscarAssertividadeUnificada: async function (range) {
        // Alinhado com o "Cérebro" da Gestão > Assertividade
        // Usamos CAST para garantir que o ID seja tratado de forma consistente (TiDB pode oscilar entre Int/String)
        let sql = `
        SELECT CAST(usuario_id AS CHAR) as usuario_id, 
               COUNT(*) as qtd_auditorias, 
               AVG(assertividade_val) as media_assertividade
        FROM assertividade
        WHERE data_referencia >= ? AND data_referencia <= ?
          AND (auditora_nome IS NOT NULL OR assertividade_val IS NOT NULL)
        GROUP BY usuario_id
    `;
        let params = [range.inicio, range.fim];

        try {
            const data = await Sistema.query(sql, params);
            // Filtragem de permissão: assistentes veem apenas o seu, gestores tudo
            this.state.dadosKPIAssertividade = this.filtrarDadosPermissao(data || []);
        } catch (e) {
            console.error("Erro Assertividade:", e);
            this.state.dadosKPIAssertividade = [];
        }
    },

    buscarMetas: async function (range) {
        if (!range.inicio) return;
        const partes = range.inicio.split('-');
        const mes = parseInt(partes[1]);
        const ano = parseInt(partes[0]);

        try {
            // Busca metas individuais
            const dataMetas = await Sistema.query(
                'SELECT usuario_id, meta_producao, meta_assertividade FROM metas WHERE mes = ? AND ano = ?',
                [mes, ano]
            );
            this.state.dadosMetas = dataMetas || [];

            // Busca configuração global do mês (Dias Úteis e Headcount)
            const dataConfig = await Sistema.query(
                'SELECT * FROM config_mes WHERE mes = ? AND ano = ?',
                [mes, ano]
            );
            this.state.configMes = (dataConfig && dataConfig.length > 0) ? dataConfig[0] : null;

        } catch (e) {
            console.error("Erro Metas/Config:", e);
            this.state.dadosMetas = [];
            this.state.configMes = null;
        }
    },

    aplicarFiltroPermissao: async function (query) {
        const user = window.Produtividade.usuario || {};
        if (!this.ehGestao(user) && user.id) return query.eq('usuario_id', user.id);
        return query;
    },

    filtrarDadosPermissao: function (lista) {
        const user = window.Produtividade.usuario || {};
        if (this.ehGestao(user)) return lista;
        return lista.filter(d => String(d.usuario_id) === String(user.id));
    },

    ehGestao: function (user) {
        const perfil = (user.perfil || '').toLowerCase();
        const funcao = (user.funcao || '').toLowerCase();
        const uid = parseInt(user.id);
        return perfil === 'admin' || perfil === 'administrador' || funcao.includes('gestor') || funcao.includes('auditor') || uid === 1 || uid === 1000;
    },

    normalizarData: function (d) {
        if (!d) return null;
        const str = String(d).trim();
        return str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
    },

    // Helper centralizado para Headcount
    getHeadcountConfig: function () {
        // [FIX v4.31] Use centralized HUD filter state
        const filtroContrato = (window.Produtividade.Filtros?.estado?.contrato || 'todos').toUpperCase();

        const config = this.state.configMes;
        let hc = 17; // Padrão fixo

        if (config) {
            if (filtroContrato === 'CLT' && Number(config.hc_clt) > 0) {
                hc = Number(config.hc_clt);
            } else if ((filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') && Number(config.hc_terceiros) > 0) {
                hc = Number(config.hc_terceiros);
            } else if (filtroContrato === 'TODOS') {
                const total = Number(config.hc_clt || 0) + Number(config.hc_terceiros || 0);
                if (total > 0) hc = total;
            }
        }
        return hc;
    },

    // Helper centralizado para Dias Úteis
    // Helper centralizado para Dias Úteis
    getDiasUteisConfig: function () {
        // [FIX v4.31] Use centralized HUD filter state
        const filtroContrato = (window.Produtividade.Filtros?.estado?.contrato || 'todos').toUpperCase();

        const config = this.state.configMes;
        const range = this.state.range;
        const diasCalendario = this.contarDiasUteis(range.inicio, range.fim);

        if (!config) return diasCalendario;

        const vTerc = config.dias_uteis_terceiros || config.dias_uteis || diasCalendario;
        if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') return vTerc;

        const vClt = config.dias_uteis_clt || (vTerc - 1);
        if (filtroContrato === 'CLT') return vClt;

        // Se "Tudo", exibe Terceiros no KPI de topo por padrão
        return vTerc;

        return vTerc;
    },

    // ... (processarDadosUnificados, renderizarTabela, calcularKpisGlobal e auxiliares mantidos, foco na lógica de Abono abaixo) ...
    processarDadosUnificados: function () {
        const mapa = new Map();
        const range = this.state.range;
        const isPeriodo = range.inicio !== range.fim;
        const diasUteisPeriodo = this.contarDiasUteis(range.inicio, range.fim);
        const HC = this.getHeadcountConfig();

        const getChave = (uid, dataRaw) => {
            const date = this.normalizarData(dataRaw);
            return isPeriodo ? String(uid) : `${uid}_${date}`;
        };

        // 1. Inicializar mapa com TODOS os assistentes elegíveis E GESTÃO (Auditores/Líderes para soma)
        const termosExcluidos = ['admin']; // Apenas admin é excluído rigidamente
        for (const uid in this.state.mapaUsuarios) {
            const u = this.state.mapaUsuarios[uid];
            if (this.ehAdmin(uid) && u.perfil === 'admin') continue; // Filtra apenas se for perfil admin
            if (u.ativo === false || u.ativo === 0 || u.ativo === '0') continue;

            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            // Mantém filtragem básica de termos se necessário, mas permite auditores/lideres
            if (perfil === 'admin' || perfil === 'administrador') continue;

            // Chave padrão
            const chave = isPeriodo ? String(uid) : `${uid}_${range.inicio}`;
            if (!mapa.has(chave)) {
                this.iniciarItemMapa(mapa, chave, uid, isPeriodo ? 'Período' : range.inicio);
            }
        }

        // 2. Processar Produção (Individual)
        this.state.dadosProducao.forEach(p => {
            const uidStr = String(p.usuario_id);
            // Permite produção de gestores/auditores/lidere, ignora apenas Admin Sistema
            const uProd = this.state.mapaUsuarios[uidStr];
            if (uProd && (uProd.perfil === 'admin' || uidStr === '1' || uidStr === '1000')) return;

            const chave = getChave(uidStr, p.data_referencia);
            if (!isPeriodo && this.normalizarData(p.data_referencia) !== range.inicio) return;
            if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uidStr, isPeriodo ? 'Período' : this.normalizarData(p.data_referencia));

            const item = mapa.get(chave);
            item.producao += Number(p.quantidade) || 0;
            item.fifo += Number(p.fifo) || 0;
            item.gt += Number(p.gradual_total) || 0;
            item.gp += Number(p.gradual_parcial) || 0;
            item.soma_fator += (p.fator !== null ? Number(p.fator) : 1.0);
            item.count_fator++;
            if (p.justificativa) item.justificativa = isPeriodo ? "Vários..." : p.justificativa;
            if (p.observacao_assistente) item.observacao_assistente = isPeriodo ? "Vários..." : p.observacao_assistente;
            if (!isPeriodo) item.id_prod = p.id;
        });

        // 3. Processar Assertividade (Individual)
        this.state.dadosKPIAssertividade.forEach(kpi => {
            const uidStr = String(kpi.usuario_id);
            const uAssert = this.state.mapaUsuarios[uidStr];
            if (uidStr && !(uAssert && uAssert.perfil === 'admin')) {
                const chave = isPeriodo ? uidStr : `${uidStr}_${range.inicio}`;
                if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uidStr, isPeriodo ? 'Período' : range.inicio);

                const item = mapa.get(chave);
                item.qtd_assert = Number(kpi.qtd_auditorias || 0);
                item.media_final = Number(kpi.media_assertividade || 0);
            }
        });

        // 4. Calcular Metas Individuais e Identificar Gestora
        let gestoraItem = null;
        let somaEquipe = { producao: 0, fifo: 0, gt: 0, gp: 0, qtd_assert: 0, soma_media_assert: 0 };
        let countEquipeAssert = 0;

        for (const item of mapa.values()) {
            const u = this.state.mapaUsuarios[item.uid] || {};
            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            const isGestor = funcao.includes('gestor') || perfil.includes('gestor');

            if (isGestor) {
                gestoraItem = item;
                item.isAggregatedManager = true; // Marca para renderização
                // REMOVIDO CONTINUE para permitir cálculo de Meta Zero abaixo
            } else {
                // Somatória da Equipe apenas se não for gestor (para legacy, mas aggregation real é no renderizarTabela)
                somaEquipe.producao += item.producao;
                somaEquipe.fifo += item.fifo;
                somaEquipe.gt += item.gt;
                somaEquipe.gp += item.gp;
                somaEquipe.qtd_assert += item.qtd_assert;
                if (item.media_final > 0) {
                    somaEquipe.soma_media_assert += (item.media_final * item.qtd_assert);
                    countEquipeAssert += item.qtd_assert;
                }
            }

            // Meta Individual sensível ao tipo de contrato (CLT vs Terc)
            item.fator = item.count_fator > 0 ? (item.soma_fator / item.count_fator) : 1.0;
            const metaObj = this.state.dadosMetas.find(m => String(m.usuario_id) === String(item.uid));

            // Meta Padrão: 100 para Assistentes, 0 para Gestão (Auditores/Líderes/Gestora)
            // [MODIFIED] Permitimos que Gestores tenham meta base (ex: 650) gravada no objeto para uso posterior
            const termosGestao = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];
            const ehGestao = termosGestao.some(t => funcao.includes(t) || perfil.includes(t));
            const defaultMeta = 100; // Base para assistentes

            // [MODIFIED] Se for Gestão, define meta zero PARA O INDIVIDUO (na lista), mas guarda a meta base
            if (ehGestao) {
                item.meta_base_diaria = 0;
                item._meta_gestor_base = Number(metaObj ? (metaObj.meta_producao || 0) : 0); // Guarda meta do gestor (ex 650)
                item.meta_assert = 0;
            } else {
                item.meta_base_diaria = Number(metaObj ? (metaObj.meta_producao || defaultMeta) : defaultMeta);
                item.meta_assert = Number(metaObj ? (metaObj.meta_assertividade || 97) : 97);
            }

            // Cálculo de Dias Úteis individuais para a meta
            let diasUsuario = diasUteisPeriodo;
            if (this.state.configMes) {
                const c = this.state.configMes;
                const vTerc = c.dias_uteis_terceiros || c.dias_uteis || diasUteisPeriodo;
                const vClt = c.dias_uteis_clt || (vTerc - 1);
                const contrato = (u.contrato || '').toUpperCase();
                diasUsuario = (contrato === 'CLT') ? vClt : vTerc;
            }

            const multiplicador = isPeriodo ? diasUsuario : 1;
            item.meta_real_calculada = Math.round(item.meta_base_diaria * multiplicador * item.fator);
        }

        // 5. Agregação da Gestora
        // (Movida para renderizarTabela para suportar filtros dinâmicos)

        // 6. Gerar Lista
        this.state.listaTabela = Array.from(mapa.values())
            .sort((a, b) => {
                if (a.isAggregatedManager) return -1; // Gestora sempre no topo
                if (b.isAggregatedManager) return 1;
                return b.producao - a.producao; // Melhores (maior produção) primeiro
            });
    },

    renderizarTabela: function () {
        if (!this.els.tabela) return;

        // Aplica filtros e agrega Gestora dinamicamente
        const listaOriginal = this.state.listaTabela || [];

        // 1. Separa Gestora
        // 1. Separa Gestora
        let gestoraItem = listaOriginal.find(i => i.isAggregatedManager);
        let listaStaff = listaOriginal.filter(i => !i.isAggregatedManager);

        const filtroContrato = (window.Produtividade.Filtros?.estado?.contrato || 'todos').toUpperCase();

        // 2. Filtra Staff Base (Contrato, Nome)
        // [FIX v4.31] Rely on centralized preFiltrar (which handles contract filtering via HUD)
        let listaBase = (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.preFiltrar === 'function')
            ? window.Produtividade.Filtros.preFiltrar(listaStaff)
            : listaStaff;

        // 3. Filtro de Produção > 0 (Para listas de Soma)
        // Lista Full = Inclui Auditores/Gestores/Coord (Para Soma de Produção)
        let listaParaSomaProducao = listaBase.filter(item => item.producao > 0);

        // 4. Filtro de Gestão (Para Grid e Soma de Assertividade)
        // Lista Grid = Apenas Assistentes (Para visualização e Média Assertividade)
        const filtroFuncao = window.Produtividade.Filtros?.estado?.funcao || 'todos';
        let listaParaGrid = listaParaSomaProducao.filter(item => {
            const u = this.state.mapaUsuarios[item.uid] || {};
            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            const termosGestao = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];

            if (filtroFuncao === 'todos') {
                const ehGestao = termosGestao.some(t => funcao.includes(t) || perfil.includes(t));
                if (ehGestao) return false;
            }
            return true;
        });

        // 5. Agrega Staff na Gestora
        if (gestoraItem) {
            // Preserva valores originais da gestora (Cache) para evitar acumulo infinito no re-render
            if (gestoraItem._ownProd === undefined) gestoraItem._ownProd = gestoraItem.producao || 0;
            if (gestoraItem._ownFifo === undefined) gestoraItem._ownFifo = gestoraItem.fifo || 0;
            if (gestoraItem._ownGt === undefined) gestoraItem._ownGt = gestoraItem.gt || 0;
            if (gestoraItem._ownGp === undefined) gestoraItem._ownGp = gestoraItem.gp || 0;
            if (gestoraItem._ownQtdAssert === undefined) gestoraItem._ownQtdAssert = gestoraItem.qtd_assert || 0;
            if (gestoraItem._ownMedia === undefined) gestoraItem._ownMedia = gestoraItem.media_final || 0;
            if (gestoraItem._ownMeta === undefined) gestoraItem._ownMeta = gestoraItem.meta_base_diaria || 0;
            if (gestoraItem._rawBaseMeta === undefined) gestoraItem._rawBaseMeta = gestoraItem._meta_gestor_base || 0;

            let soma = { prod: 0, fifo: 0, gt: 0, gp: 0, qtd_assert: 0, soma_media: 0, count_assert: 0 };

            // A) Produção: Soma TODOS (Assistentes + Auditores + Própria Gestora)
            // Soma da lista completa filtrada por produção
            listaParaSomaProducao.forEach(i => {
                soma.prod += i.producao;
                soma.fifo += i.fifo;
                soma.gt += i.gt;
                soma.gp += i.gp;
            });
            // Adiciona produção própria da gestora
            soma.prod += gestoraItem._ownProd;
            soma.fifo += gestoraItem._ownFifo;
            soma.gt += gestoraItem._ownGt;
            soma.gp += gestoraItem._ownGp;

            // B) Assertividade: Soma APENAS Grid (Assistentes)
            listaParaGrid.forEach(i => {
                soma.qtd_assert += i.qtd_assert;
                if (i.media_final > 0) {
                    soma.soma_media += (i.media_final * i.qtd_assert);
                    soma.count_assert += i.qtd_assert;
                }
            });
            // NOTA: Assertividade própria da gestora NÃO entra na média ("somente na média que não conta")

            gestoraItem.producao = soma.prod;
            gestoraItem.fifo = soma.fifo;
            gestoraItem.gt = soma.gt;
            gestoraItem.gp = soma.gp;
            gestoraItem.qtd_assert = soma.qtd_assert;
            gestoraItem.media_final = soma.count_assert > 0 ? (soma.soma_media / soma.count_assert) : 0;
            gestoraItem.fator = 1.0;

            // [MODIFIED] Recalculo Dinâmico da Meta da Gestora com base no Filtro de Headcount
            const HC = this.getHeadcountConfig();
            const isPeriodo = this.state.range.inicio !== this.state.range.fim;
            const diasUteisEquipe = this.getDiasUteisConfig();

            // Usa a meta base que guardamos em `_meta_gestor_base` (ex: 650)
            const metaBaseGestor = gestoraItem._rawBaseMeta || 650;

            gestoraItem.meta_base_diaria = metaBaseGestor; // Para exibição no grid na coluna Meta (Gestão)
            gestoraItem.meta_real_calculada = Math.round(metaBaseGestor * HC * (isPeriodo ? diasUteisEquipe : 1.0));
            gestoraItem.justificativa = `Equipe Filtrada (${filtroContrato === 'todos' ? 'Total' : filtroContrato}) - HC: ${HC}, DU: ${diasUteisEquipe}`;

            // Reinsere a Gestora no topo da lista final
            listaParaGrid.unshift(gestoraItem);
        }

        // Define a lista final de exibição
        const listaExibicao = listaParaGrid;

        if (this.els.tabelaHeader && this.state.headerOriginal) {
            this.els.tabelaHeader.innerHTML = this.state.headerOriginal;
            if (this.els.selectionHeader) this.els.selectionHeader.classList.add('hidden');
        }
        this.els.tabela.innerHTML = '';

        if (listaExibicao.length === 0) {
            this.els.tabela.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400">Nenhum dado encontrado com os filtros atuais.</td></tr>`;
            if (this.els.totalFooter) this.els.totalFooter.textContent = '0';
            return;
        }

        if (this.els.totalFooter) this.els.totalFooter.textContent = listaExibicao.length;

        const html = listaExibicao.map(row => {
            const mediaAssert = row.media_final;
            const metaParaCalculo = row.meta_real_calculada;
            const pctProd = metaParaCalculo > 0 ? Math.round((row.producao / metaParaCalculo) * 100) : 0;
            const isAbonado = row.fator < 1.0;
            const isChecked = this.state.selecionados.has(String(row.uid));

            // Estilo da linha: Gestora (Verde), Abonado (Amarelo), Selecionado (Azul)
            let rowClass = 'hover:bg-slate-50';
            if (row.isAggregatedManager) rowClass = 'bg-emerald-100 border-b-2 border-emerald-200';
            else if (isAbonado) rowClass = 'bg-amber-50/40';
            else if (isChecked) rowClass = 'bg-blue-50';

            let assertHtml = '<span class="text-slate-300">-</span>';
            if (mediaAssert !== null && row.qtd_assert > 0) {
                const cor = mediaAssert >= row.meta_assert ? 'text-emerald-600' : 'text-rose-600';
                assertHtml = `<div class="flex flex-col items-center leading-tight">
                    <span class="${cor} font-bold">${mediaAssert.toFixed(2)}%</span>
                    <span class="text-[9px] text-slate-400">(${row.qtd_assert} docs)</span>
                </div>`;
            }

            return `
                <tr class="${rowClass} border-b border-slate-200 text-xs transition-colors group">
                    <td class="px-2 py-3 text-center w-[40px]"><input type="checkbox" class="rounded border-slate-300 cursor-pointer" value="${row.uid}" ${isChecked ? 'checked' : ''} onclick="Produtividade.Geral.toggleSelecionar('${row.uid}')" ${row.isAggregatedManager ? 'disabled' : ''}></td>
                    <td class="px-2 py-3 text-center w-[50px]"><button onclick="Produtividade.Geral.abrirModalAbono('${row.uid}')" class="w-8 h-8 rounded flex items-center justify-center border transition ${isAbonado ? 'text-amber-500 bg-amber-100 border-amber-200' : (row.isAggregatedManager ? 'hidden' : 'text-slate-300 bg-slate-50 border-slate-200 hover:text-blue-500')}" title="${isAbonado ? 'Editar Abono' : 'Abonar'}"><i class="fas ${isAbonado ? 'fa-check-square' : 'fa-square'} text-sm"></i></button></td>
                    <td class="px-3 py-3 w-[200px] truncate cursor-pointer group-hover:bg-white" onclick="Produtividade.Geral.abrirDetalhes('${row.uid}')" title="Clique para ver Análise Individual">
                        <div class="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                            <i class="fas fa-search text-slate-300 group-hover:text-blue-500 text-[10px]"></i>
                            <span class="font-bold text-slate-700 group-hover:text-blue-700 group-hover:underline">${row.nome}</span>
                        </div>
                    </td>
                    <td class="px-2 py-3 text-center text-slate-500 font-mono bg-slate-50 border-x border-slate-100">${row.meta_base_diaria}</td>
                    <td class="px-2 py-3 text-center font-mono text-slate-400">${row.fifo}</td>
                    <td class="px-2 py-3 text-center font-mono text-slate-400">${row.gt}</td>
                    <td class="px-2 py-3 text-center font-mono text-slate-400">${row.gp}</td>
                    <td class="px-2 py-3 text-center font-black text-blue-700 bg-blue-50/20 border-x border-slate-100">${row.producao}</td>
                    <td class="px-2 py-3 text-center text-slate-700 font-bold bg-slate-50">${metaParaCalculo}</td>
                    <td class="px-2 py-3 text-center"><span class="font-bold ${pctProd >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${pctProd}%</span></td>
                    <td class="px-2 py-3 text-center bg-emerald-50/20 border-x border-slate-100">${assertHtml}</td>
                    <td class="px-2 py-3 min-w-[200px]">
                        <div class="flex flex-col gap-1">
                            <input type="text" placeholder="${isAbonado ? 'Justificativa...' : 'Observação Gestão...'}" value="${row.justificativa}" class="w-full border-b border-transparent bg-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition text-xs truncate px-1 py-1" onchange="Produtividade.Geral.atualizarLinha('${row.uid}', '${row.data}', 'justificativa', this.value)">
                            ${row.observacao_assistente ? `<div class="bg-blue-50/50 p-1 rounded text-[10px] text-blue-800 italic border border-blue-100 flex items-center gap-1" title="Observação do Assistente"><i class="fas fa-comment-dots text-blue-400"></i> ${row.observacao_assistente}</div>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        this.els.tabela.innerHTML = html;
        this.atualizarBarraFlutuante();
        this.atualizarDestaques(listaExibicao);
    },

    calcularKpisGlobal: function () {
        // Aplica filtros se a engine estiver carregada
        const listaOriginal = this.state.listaTabela || [];
        const listaExibicao = (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.preFiltrar === 'function')
            ? window.Produtividade.Filtros.preFiltrar(listaOriginal)
            : listaOriginal;

        // [FIX v4.36] Sum directly from raw production array to avoid missing filtered individuals (managers/auditors)
        let totalProd = this.state.dadosProducao.reduce((acc, p) => acc + (Number(p.quantidade) || 0), 0);
        let totalMeta = 0;
        let somaPontosAssert = 0, totalDocsAssert = 0;
        let somaMetaAssert = 0, countUsersMeta = 0;
        let assistentesComProducao = new Set();
        let datasComProducao = new Set();
        let totalDiasUteis = this.getDiasUteisConfig();
        let totalAbonoEquipe = 0;

        // Adiciona Meta da Gestora Explicitamente
        const gestoraItem = listaOriginal.find(i => i.isAggregatedManager);
        let metaDiariaGestor = 0;

        if (gestoraItem) {
            // Usa Meta Individual (_ownMeta) se existir (geralmente 0 para gestores), senão fallback seguro
            metaDiariaGestor = (gestoraItem._ownMeta !== undefined) ? gestoraItem._ownMeta : (gestoraItem.meta_base_diaria || 0);
            if (metaDiariaGestor === 0 && gestoraItem._rawBaseMeta > 0) metaDiariaGestor = gestoraItem._rawBaseMeta; // Fallback para meta base crua
            console.log(`[DEBUG PROD] Gestora Encontrada: ${gestoraItem.nome} | MetaDiaria: ${metaDiariaGestor} | RawBase: ${gestoraItem._rawBaseMeta}`);
        } else {
            console.log(`[DEBUG PROD] NENHUMA GESTORA ENCONTRADA NA LISTA DE 0 A ${listaOriginal.length}`);
            listaOriginal.forEach(i => { if (i.isAggregatedManager) console.log(">> Achei flag isAggregatedManager em:", i.nome); });
        }

        // [FIX] Meta Total Padronizada: MetaDiariaGestor * HC * DiasUteis
        // Se não tiver gestor definido, usa defaults (100 * 17 * Dias)?? Não, só se tiver gestor.
        if (metaDiariaGestor > 0) {
            totalMeta = metaDiariaGestor * this.getHeadcountConfig() * totalDiasUteis;
            console.log(`[DEBUG PROD] Meta Padronizada: Base(${metaDiariaGestor}) * HC(${this.getHeadcountConfig()}) * Dias(${totalDiasUteis}) = ${totalMeta}`);
        } else {
            // Fallback se não tiver meta de gestor definida: usa soma das metas individuais?
            // O user pediu padronização. Se for 0, fica 0 ou soma. Vamos manter 0 para forçar configuração correta ou somar como fallback?
            // Vamos zerar aqui e deixar o loop abaixo somar SE não tiver meta definida.
            totalMeta = 0;
        }

        const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena'];

        listaExibicao.forEach(i => {
            if (i.isAggregatedManager) return; // Gestora já foi somada acima (explicitamente)

            // [FIX] Só soma meta individual se NÃO tivermos calculado a meta global via Formula da Gestora
            if (metaDiariaGestor === 0) {
                totalMeta += i.meta_real_calculada;
            }

            if (i.meta_assert > 0) { somaMetaAssert += i.meta_assert; countUsersMeta++; }
            if (i.producao > 0) assistentesComProducao.add(i.uid);
            if (i.qtd_assert > 0 && i.media_final !== null) {
                somaPontosAssert += (i.media_final * i.qtd_assert);
                totalDocsAssert += i.qtd_assert;
            }

            // Cálculo para redução de HC por Abono (Apenas Equipe)
            const u = this.state.mapaUsuarios[i.uid] || {};
            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            const ehGestao = termosExcluidos.some(t => funcao.includes(t) || perfil.includes(t));

            if (!ehGestao && !this.ehAdmin(i.uid)) {
                if (i.fator < 1.0) {
                    totalAbonoEquipe += (1.0 - i.fator);
                }
            }
        });

        this.state.dadosProducao.forEach(p => { if (p.quantidade > 0) datasComProducao.add(p.data_referencia); });

        const mediaAssert = totalDocsAssert > 0 ? (somaPontosAssert / totalDocsAssert) : 0;

        let totalHeadcountDefinido = this.getHeadcountConfig();

        // Aplica Redução Efetiva de Abonos (Regra: soma abonos e tira o floor)
        const reducaoHcAbono = Math.floor(totalAbonoEquipe + 0.001); // 0.001 evita problemas de float (ex: 0.99999)
        const headcountEfetivo = Math.max(1, totalHeadcountDefinido - reducaoHcAbono);

        const metaGlobalAssert = countUsersMeta > 0 ? (somaMetaAssert / countUsersMeta) : 97;

        let maxMetaProducao = 0;
        let assistentesReaisComProducao = 0;
        let totalAbonoParticipante = 0; // Abono apenas de quem teve produção > 0

        // Reprocessa para contar assistentes e achar a MAIOR META (Velocity Target)
        listaExibicao.forEach(i => {
            const u = this.state.mapaUsuarios[i.uid] || {};
            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            const ehGestao = termosExcluidos.some(t => funcao.includes(t) || perfil.includes(t));

            if (!ehGestao && !this.ehAdmin(i.uid)) {
                if (i.producao > 0) {
                    assistentesReaisComProducao++;
                    // Se teve produção mas teve abono (ex: meio dia), soma para abater do count real
                    if (i.fator < 1.0) totalAbonoParticipante += (1.0 - i.fator);
                }

                const metaObj = this.state.dadosMetas.find(m => m.usuario_id == i.uid);
                const metaVal = metaObj ? Number(metaObj.meta_producao) : 100;
                if (metaVal > maxMetaProducao) maxMetaProducao = metaVal;
            }
        });

        if (maxMetaProducao === 0) maxMetaProducao = 100;

        // Numerador da Capacidade: Quem trabalhou (excluindo pedaços abonados)
        const assisRealFinal = Math.max(0, assistentesReaisComProducao - Math.floor(totalAbonoParticipante + 0.001));

        const mediaProducaoDiariaGlobal = totalDiasUteis > 0 ? (totalProd / totalDiasUteis) : 0;
        const denominadorVelocidade = headcountEfetivo;
        const mediaVelocidadeReal = Math.round(mediaProducaoDiariaGlobal / denominadorVelocidade);

        const dadosKPI = {
            prod: { real: totalProd, meta: totalMeta },
            assert: { real: mediaAssert, meta: metaGlobalAssert },
            capacidade: {
                diasReal: datasComProducao.size,
                diasTotal: totalDiasUteis,
                assisReal: assisRealFinal,
                assisTotal: totalHeadcountDefinido // Mantém o headcount original como meta (ex: 17)
            },
            velocidade: { real: mediaVelocidadeReal, meta: maxMetaProducao }
        };

        this.state.totalDiasUteisConfig = totalDiasUteis;
        this.state.totalHeadcountConfig = totalHeadcountDefinido;
        this.atualizarCardsKPI(dadosKPI);
    },

    // Funções Auxiliares
    ehAdmin: function (id) { return id == 1 || id == 1000; },
    iniciarItemMapa: function (mapa, chave, uid, dataLabel) {
        const u = this.state.mapaUsuarios[uid];
        const nomeUser = u ? u.nome : 'ID: ' + uid;
        mapa.set(chave, {
            chave: chave, uid: uid, data: dataLabel, nome: nomeUser,
            fator: 1.0, soma_fator: 0, count_fator: 0,
            fifo: 0, gt: 0, gp: 0, producao: 0, justificativa: '', observacao_assistente: '',
            soma_notas_bruta: 0, qtd_assert: 0, media_final: null,
            meta_base_diaria: 100, meta_real_calculada: 100, meta_assert: 97, id_prod: null
        });
    },
    contarDiasUteis: function (inicio, fim) {
        let count = 0; let cur = new Date(inicio + 'T12:00:00'); let end = new Date(fim + 'T12:00:00');
        while (cur <= end) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
        return count || 1;
    },
    contarAssistentesElegiveis: function (filtroContrato = 'todos', filtroFuncao = 'todos') {
        let count = 0;
        const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena'];
        for (const uid in this.state.mapaUsuarios) {
            const u = this.state.mapaUsuarios[uid];
            if (this.ehAdmin(uid)) continue;
            if (u.ativo === false || u.ativo === 0 || u.ativo === '0') continue;

            const contratoUser = (u.contrato || '').toUpperCase();

            // Regra Estrita: Só conta se for explicitamente CLT ou TERCEIROS (Antiga PJ)
            // Se o contrato for vazio ou outro tipo, não entra na conta de Capacidade.
            const ehCLT = contratoUser.includes('CLT');
            const ehTerceiro = contratoUser.includes('TERCEIRO') || contratoUser.includes('PJ') || contratoUser.includes('PRESTADOR');

            if (!ehCLT && !ehTerceiro) continue;

            if (filtroContrato === 'CLT' && !ehCLT) continue;
            if (filtroContrato === 'TERCEIROS' && !ehTerceiro) continue;

            const cargo = (u.funcao || '').toUpperCase();
            if (filtroFuncao !== 'todos' && cargo !== filtroFuncao.toUpperCase()) continue;

            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            if (!termosExcluidos.some(t => funcao.includes(t) || perfil.includes(t))) count++;
        }
        return count || 0;
    },
    renderLoading: function () {
        if (this.els.tabela) this.els.tabela.innerHTML = `<tr><td colspan="12" class="text-center py-12 text-blue-600"><i class="fas fa-circle-notch fa-spin text-2xl"></i><p class="text-xs mt-2 text-slate-500">Calculando no banco de dados...</p></td></tr>`;
    },
    toggleSelecionar: function (uid) {
        if (this.state.selecionados.has(uid)) this.state.selecionados.delete(uid); else this.state.selecionados.add(uid);
        this.renderizarTabela();
    },
    toggleAll: function (checked) {
        if (checked) this.state.listaTabela.forEach(r => this.state.selecionados.add(String(r.uid))); else this.state.selecionados.clear();
        this.renderizarTabela();
    },
    atualizarBarraFlutuante: function () {
        let bar = document.getElementById('floating-action-bar');
        if (this.state.selecionados.size === 0) { if (bar) bar.remove(); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'floating-action-bar';
            bar.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-6 animate-fade-in-up';
            document.body.appendChild(bar);
        }
        bar.innerHTML = `<span class="font-bold text-sm"><span class="text-blue-400">${this.state.selecionados.size}</span> selecionados</span><div class="h-4 w-px bg-slate-600"></div><button onclick="Produtividade.Geral.abrirModalAbono('mass')" class="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2"><i class="fas fa-user-clock"></i> Abonar Selecionados</button><button onclick="Produtividade.Geral.toggleAll(false)" class="text-slate-400 hover:text-white text-xs ml-2"><i class="fas fa-times"></i></button>`;
    },
    injetarModalAbono: function () {
        if (document.getElementById('modal-abono-geral')) return;
        const html = `<div id="modal-abono-geral" class="fixed inset-0 z-[100] hidden items-center justify-center bg-slate-900/60 backdrop-blur-sm"><div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform scale-95 transition-all"><div class="bg-amber-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center"><h3 class="font-bold text-amber-800 flex items-center gap-2"><i class="fas fa-user-clock"></i> Registrar Abono</h3><button onclick="document.getElementById('modal-abono-geral').classList.add('hidden')" class="text-amber-400 hover:text-amber-700"><i class="fas fa-times"></i></button></div><div class="p-6 space-y-4"><div id="modal-abono-msg" class="text-sm text-slate-600"></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de Abono</label><select id="modal-abono-fator" class="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-amber-500 bg-white"><option value="0.0">Abono Total (Dia não conta)</option><option value="0.5">Meio Período (0.5)</option><option value="1.0">Remover Abono (Dia Normal)</option></select></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Justificativa (Obrigatória)</label><textarea id="modal-abono-just" rows="3" class="w-full border border-slate-300 rounded px-3 py-2 text-sm outline-none focus:border-amber-500" placeholder="Ex: Atestado médico, Folga compensatória..."></textarea></div></div><div class="bg-slate-50 px-6 py-3 flex justify-end gap-3 border-t border-slate-100"><button onclick="document.getElementById('modal-abono-geral').classList.add('hidden')" class="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">Cancelar</button><button onclick="Produtividade.Geral.salvarAbonoModal()" class="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded shadow-sm">Confirmar</button></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    // --- LÓGICA DE ABONO REVISADA E CORRIGIDA ---
    abrirModalAbono: function (alvo) {
        this.state.abonoAlvo = alvo;
        const modal = document.getElementById('modal-abono-geral');
        const msg = document.getElementById('modal-abono-msg');
        const just = document.getElementById('modal-abono-just');
        just.value = '';
        document.getElementById('modal-abono-fator').value = '0.0';

        if (alvo === 'mass') {
            msg.innerHTML = `Aplicando para <strong>${this.state.selecionados.size} assistentes</strong> selecionados no período.`;
        } else {
            const item = this.state.listaTabela.find(i => String(i.uid) === String(alvo));
            msg.innerHTML = `Editando abono de <strong>${item ? item.nome : 'Assistente'}</strong>.`;
            if (item && item.fator < 1) {
                document.getElementById('modal-abono-fator').value = String(item.fator);
                just.value = item.justificativa || '';
            }
        }
        modal.classList.remove('hidden'); modal.classList.add('flex');
    },

    salvarAbonoModal: async function () {
        const fator = parseFloat(document.getElementById('modal-abono-fator').value);
        const just = document.getElementById('modal-abono-just').value.trim();

        if (fator < 1.0 && !just) {
            alert("Para abonar, a justificativa é obrigatória.");
            return;
        }

        document.getElementById('modal-abono-geral').classList.add('hidden');
        this.renderLoading(); // Feedback imediato

        try {
            const listaUids = (this.state.abonoAlvo === 'mass') ? Array.from(this.state.selecionados) : [this.state.abonoAlvo];
            const isPeriodo = this.state.range.inicio !== this.state.range.fim;

            for (const uid of listaUids) {
                await this.executarAbono(uid, isPeriodo, fator, just);
            }

            // Recarrega TUDO para garantir que o estado visual (cores amarelas) corresponda ao banco
            this.atualizarDados();
            alert("✅ Abono aplicado com sucesso!");

        } catch (e) {
            console.error(e);
            alert("Erro ao salvar abono: " + e.message);
            this.atualizarDados();
        }
    },

    executarAbono: async function (uid, isPeriodo, novoFator, justificativa) {
        const { inicio, fim } = this.state.range;

        if (isPeriodo) {
            let datas = [];
            let cur = new Date(inicio + 'T12:00:00');
            let end = new Date(fim + 'T12:00:00');

            while (cur <= end) {
                const d = cur.getDay();
                if (d !== 0 && d !== 6) datas.push(cur.toISOString().split('T')[0]);
                cur.setDate(cur.getDate() + 1);
            }

            for (const dia of datas) {
                const checkSql = 'SELECT quantidade, fifo, gradual_total, gradual_parcial FROM producao WHERE usuario_id = ? AND data_referencia = ?';
                const existingRows = await Sistema.query(checkSql, [uid, dia]);
                const existente = (existingRows && existingRows.length > 0) ? existingRows[0] : null;

                const uuid = Sistema.gerarUUID ? Sistema.gerarUUID() : crypto.randomUUID();
                const quantidade = existente ? existente.quantidade : 0;
                const fifo = existente ? existente.fifo : 0;
                const gt = existente ? existente.gradual_total : 0;
                const gp = existente ? existente.gradual_parcial : 0;

                const partesData = dia.split('-');
                const anoRef = parseInt(partesData[0]);
                const mesRef = parseInt(partesData[1]);

                // Upsert logic with INSERT ... ON DUPLICATE KEY UPDATE
                await Sistema.query(
                    `INSERT INTO producao (id, usuario_id, data_referencia, mes_referencia, ano_referencia, fator, justificativa, quantidade, fifo, gradual_total, gradual_parcial) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE fator = VALUES(fator), justificativa = VALUES(justificativa)`,
                    [uuid, uid, dia, mesRef, anoRef, novoFator, justificativa, quantidade, fifo, gt, gp]
                );
            }
        } else {
            await this.atualizarLinha(uid, this.state.range.inicio, 'abono_total', { fator: novoFator, just: justificativa });
        }
    },

    atualizarLinha: async function (uid, dataRef, campo, valor) {
        try {
            // Busca dados atuais
            const existingRows = await Sistema.query('SELECT * FROM producao WHERE usuario_id = ? AND data_referencia = ?', [uid, dataRef]);
            const existente = (existingRows && existingRows.length > 0) ? existingRows[0] : null;

            let payload = {};
            if (existente) {
                payload = { ...existente };
            } else {
                payload = {
                    usuario_id: uid,
                    data_referencia: dataRef,
                    quantidade: 0, fifo: 0, gradual_total: 0, gradual_parcial: 0,
                    fator: 1.0, justificativa: ''
                };
            }

            if (campo === 'abono_total') {
                payload.fator = valor.fator;
                payload.justificativa = valor.just;
            } else if (campo === 'justificativa') {
                payload.justificativa = valor;
            }

            const uuid = existente ? existente.id : (Sistema.gerarUUID ? Sistema.gerarUUID() : crypto.randomUUID());
            const partesData = dataRef.split('-');
            const anoRef = parseInt(partesData[0]);
            const mesRef = parseInt(partesData[1]);

            // Upsert / Insert Update
            await Sistema.query(
                `INSERT INTO producao (id, usuario_id, data_referencia, mes_referencia, ano_referencia, quantidade, fifo, gradual_total, gradual_parcial, fator, justificativa, perfil_fc, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'OK')
                 ON DUPLICATE KEY UPDATE 
                    fator = VALUES(fator), 
                    justificativa = VALUES(justificativa)`,
                [uuid, uid, dataRef, mesRef, anoRef, payload.quantidade, payload.fifo, payload.gradual_total, payload.gradual_parcial, payload.fator, payload.justificativa]
            );

            if (campo === 'justificativa') {
                console.log("Justificativa salva.");
            }

        } catch (e) {
            console.error(e);
            alert("Erro ao salvar linha: " + e.message);
        }
    },

    atualizarCardsKPI: function (kpi) {
        const updateBar = (elText, elBar, elPct, val, target, isPct = false, colorClass = 'blue') => {
            const safeTarget = target === 0 ? 1 : target;
            const pct = Math.round((val / safeTarget) * 100);
            const width = Math.min(pct, 100);
            if (elText) elText.textContent = isPct ? val.toFixed(2) + '%' : val.toLocaleString('pt-BR');
            if (elPct) { elPct.textContent = pct + '%'; elPct.className = `font-bold ${isPct ? 'text-xs' : 'text-sm'} text-${colorClass}-600 ${isPct ? 'text-right' : ''}`; }
            if (elBar) { elBar.style.width = width + '%'; elBar.className = `h-full rounded-full transition-all duration-1000 bg-${colorClass}-${pct >= 100 ? '500' : '500'}`; }
        };
        if (this.els.kpiVolume) this.els.kpiVolume.textContent = kpi.prod.real.toLocaleString('pt-BR');
        if (this.els.kpiMetaVolume) this.els.kpiMetaVolume.textContent = kpi.prod.meta.toLocaleString('pt-BR');
        updateBar(null, this.els.barVolume, this.els.kpiVolumePct, kpi.prod.real, kpi.prod.meta, false, 'blue');
        if (this.els.kpiAssertTarget) {
            const valAssertMeta = Number(kpi.assert.meta || 0);
            this.els.kpiAssertTarget.textContent = valAssertMeta.toFixed(0) + '%';
        }
        updateBar(this.els.kpiAssertReal, this.els.barAssert, this.els.kpiAssertPct, kpi.assert.real, kpi.assert.meta, true, 'emerald');
        if (this.els.kpiDiasTrabalhados) this.els.kpiDiasTrabalhados.textContent = kpi.capacidade.diasReal;
        if (this.els.kpiDiasUteis) this.els.kpiDiasUteis.textContent = kpi.capacidade.diasTotal;
        updateBar(null, this.els.barDias, this.els.kpiDiasPct, kpi.capacidade.diasReal, kpi.capacidade.diasTotal, false, 'purple');
        if (this.els.kpiAssisAtivos) this.els.kpiAssisAtivos.textContent = kpi.capacidade.assisReal;
        if (this.els.kpiAssisTotal) this.els.kpiAssisTotal.textContent = kpi.capacidade.assisTotal;
        updateBar(this.els.kpiAssisAtivos, this.els.barAssis, this.els.kpiAssisPct, kpi.capacidade.assisReal, kpi.capacidade.assisTotal, false, 'purple');
        if (this.els.kpiVelocReal) this.els.kpiVelocReal.textContent = kpi.velocidade.real.toLocaleString('pt-BR');
        if (this.els.kpiVelocEsperada) this.els.kpiVelocEsperada.textContent = kpi.velocidade.meta.toLocaleString('pt-BR');
        updateBar(null, this.els.barVeloc, this.els.kpiVelocPct, kpi.velocidade.real, kpi.velocidade.meta, false, 'amber');
    },
    atualizarDestaques: function (listaCustom) {
        // Se não passar lista, usa a da tabela (filtrando a Gestora Agregada)
        const base = listaCustom || (this.state.listaTabela || []);
        const listaEquipe = base.filter(i => !i.isAggregatedManager);

        const topProd = [...listaEquipe].sort((a, b) => b.producao - a.producao).slice(0, 3);
        const topAssert = [...listaEquipe].filter(i => (i.qtd_assert || 0) >= 5).sort((a, b) => (b.media_final || 0) - (a.media_final || 0)).slice(0, 3);

        const renderItem = (list, elId, isPct) => {
            const el = document.getElementById(elId); if (!el) return;
            if (list.length === 0) { el.innerHTML = '<span class="text-[7px] text-slate-300 block text-center italic">Sem dados</span>'; return; }
            el.innerHTML = list.map(i => `<div class="flex justify-between items-center bg-slate-50/50 px-1 py-0.5 rounded border border-slate-100 shadow-sm"><span class="text-[9px] truncate w-[70%] font-bold text-slate-600 tracking-tight leading-tight" title="${i.nome}">${i.nome.split(' ')[0]} ${i.nome.split(' ')[1] ? i.nome.split(' ')[1].charAt(0) + '.' : ''}</span><span class="text-[9px] font-black ${isPct ? 'text-emerald-600' : 'text-blue-600'} leading-tight">${isPct ? (i.media_final || 0).toFixed(1) + '%' : i.producao}</span></div>`).join('');
        };
        renderItem(topProd, 'top-prod-list', false); renderItem(topAssert, 'top-assert-list', true);
    },
    excluirDadosDia: async function () {
        if (!this.ehGestao(window.Produtividade.usuario || {})) {
            alert("Apenas gestores podem excluir dados.");
            return;
        }

        const range = this.state.range;
        if (!range.inicio || range.inicio !== range.fim) {
            alert("⚠️ Selecione um dia específico no filtro 'Dia' para excluir.");
            return;
        }

        if (!confirm(`🔴 PERIGO: Você está prestes a excluir TODOS os dados de produção do dia ${range.inicio}.\n\nIsso não pode ser desfeito.\n\nDeseja continuar?`)) return;

        this.renderLoading();

        try {
            await Sistema.query("DELETE FROM producao WHERE data_referencia = ?", [range.inicio]);
            alert("✅ Dados excluídos com sucesso!");
            this.atualizarDados();
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir: " + e.message);
            this.state.loading = false;
            this.renderizarTabela(); // Restaura tabela
        }
    },

    abrirDetalhes: function (uid) { this.state.modoDetalhe = true; this.state.usuarioDetalhe = uid; this.renderizarDetalhes(uid); },
    voltarParaGrade: function () {
        this.state.modoDetalhe = false; this.state.usuarioDetalhe = null;
        if (this.els.tabelaHeader && this.state.headerOriginal) this.els.tabelaHeader.innerHTML = this.state.headerOriginal;
        if (this.els.selectionHeader) { this.els.selectionHeader.classList.add('hidden'); this.els.selectionHeader.innerHTML = ''; }
        this.calcularKpisGlobal(); this.renderizarTabela();
    },
    renderizarDetalhes: function (uid) {
        const itemConsolidado = this.state.listaTabela.find(i => String(i.uid) === String(uid));
        const u = this.state.mapaUsuarios[uid]; const nomeUsuario = itemConsolidado ? itemConsolidado.nome : (u ? u.nome : 'Usuário');
        if (itemConsolidado) {
            this.atualizarCardsKPI({
                prod: { real: itemConsolidado.producao, meta: itemConsolidado.meta_real_calculada },
                assert: { real: itemConsolidado.media_final || 0, meta: itemConsolidado.meta_assert },
                capacidade: { diasReal: itemConsolidado.count_fator || 0, diasTotal: this.state.totalDiasUteisConfig || this.contarDiasUteis(this.state.range.inicio, this.state.range.fim), assisReal: 1, assisTotal: 1 },
                velocidade: { real: Math.round(itemConsolidado.producao / (itemConsolidado.count_fator || 1)), meta: itemConsolidado.meta_base_diaria }
            });
        }
        if (this.els.selectionHeader) {
            this.els.selectionHeader.classList.remove('hidden');
            this.els.selectionHeader.className = "bg-blue-50 border border-blue-100 p-2 rounded-lg flex justify-between items-center animate-fade-in mb-4";
            this.els.selectionHeader.innerHTML = `<div class="flex items-center gap-3"><button onclick="Produtividade.Geral.voltarParaGrade()" class="bg-white hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-bold transition shadow-sm flex items-center gap-2"><i class="fas fa-arrow-left"></i> Voltar</button><div class="h-6 w-px bg-blue-200"></div><span class="text-sm font-bold text-blue-900 flex items-center gap-2"><i class="fas fa-user-circle text-blue-500 text-lg"></i> Análise Individual: <span class="uppercase tracking-wide text-blue-700 underline">${nomeUsuario}</span></span></div>`;
        }
        this.renderizarTabelaDetalhe(uid);
    },
    renderizarTabelaDetalhe: function (uid) {
        if (this.els.tabelaHeader) this.els.tabelaHeader.innerHTML = `<tr class="divide-x divide-slate-200 border-b border-slate-300"><th class="px-4 py-3 text-left bg-slate-50 text-slate-600">Data</th><th class="px-4 py-3 text-center bg-slate-50 text-slate-600">Dia</th><th class="px-4 py-3 text-center bg-slate-100 text-slate-600">Meta</th><th class="px-4 py-3 text-center bg-slate-50 text-slate-600">Realizado</th><th class="px-4 py-3 text-center bg-slate-50 text-slate-600">%</th><th class="px-4 py-3 text-center bg-slate-50 text-slate-600">Abono/Fator</th><th class="px-4 py-3 text-left bg-slate-50 text-slate-600">Justificativa / Obs</th></tr>`;
        const dadosUser = this.state.dadosProducao.filter(d => String(d.usuario_id) === String(uid)).sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
        if (dadosUser.length === 0) { this.els.tabela.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">Nenhum registro encontrado neste período.</td></tr>`; return; }
        this.els.tabela.innerHTML = dadosUser.map(d => {
            const dateObj = new Date(this.normalizarData(d.data_referencia) + 'T12:00:00');
            const metaObj = this.state.dadosMetas.find(m => String(m.usuario_id) === String(uid));
            const fator = d.fator !== null ? Number(d.fator) : 1.0;
            const metaDia = Math.round((metaObj ? (metaObj.meta_producao || 100) : 100) * fator);
            const pct = metaDia > 0 ? Math.round((d.quantidade / metaDia) * 100) : 0;
            const obsHtml = `
                <div class="flex flex-col gap-1">
                    ${d.justificativa ? `<span class="text-amber-800 bg-amber-50 px-1 rounded border border-amber-100">[Gestão]: ${d.justificativa}</span>` : ''}
                    ${d.observacao_assistente ? `<span class="text-blue-800 bg-blue-50 px-1 rounded border border-blue-100">[Eu]: ${d.observacao_assistente}</span>` : ''}
                    ${!d.justificativa && !d.observacao_assistente ? '-' : ''}
                </div>
            `;
            return `<tr class="hover:bg-slate-50 border-b border-slate-100 text-xs ${fator < 1.0 ? 'bg-amber-50/30' : ''}"><td class="px-4 py-3 font-bold text-slate-700">${dateObj.toLocaleDateString('pt-BR')}</td><td class="px-4 py-3 text-center uppercase text-[10px] text-slate-400 font-bold">${dateObj.toLocaleDateString('pt-BR', { weekday: 'short' })}</td><td class="px-4 py-3 text-center font-mono text-slate-500">${metaDia}</td><td class="px-4 py-3 text-center font-black text-blue-600">${d.quantidade}</td><td class="px-4 py-3 text-center"><span class="${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'} font-bold">${pct}%</span></td><td class="px-4 py-3 text-center text-slate-500">${fator.toFixed(1)}</td><td class="px-4 py-3 text-slate-500 italic truncate max-w-[300px]" title="${d.justificativa || ''} | ${d.observacao_assistente || ''}">${obsHtml}</td></tr>`;
        }).join('');
    }
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { if (!window.Produtividade || !window.Produtividade.Main) Produtividade.Geral.init(); }); } else { if (window.Produtividade) Produtividade.Geral.init(); }