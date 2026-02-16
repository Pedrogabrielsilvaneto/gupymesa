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
        abonoAlvo: null
    },

    init: function () {
        console.log("🚀 Produtividade Geral V4.1 (Fix Abono) carregada.");
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

        console.log("📅 Geral V4.1: Filtro", range);
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
                this.atualizarDestaques();
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
            const data = await Sistema.query('SELECT id, nome, perfil, funcao, ativo FROM usuarios');
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

        console.log("🔍 [DEBUG] Buscando produção SQL:", sql, params);

        try {
            const data = await Sistema.query(sql, params);
            console.log("🔍 [DEBUG] Produção retornada:", data ? data.length : 0, "registros.");
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
            const data = await Sistema.query(
                'SELECT usuario_id, meta_producao, meta_assertividade FROM metas WHERE mes = ? AND ano = ?',
                [mes, ano]
            );
            this.state.dadosMetas = data || [];
        } catch (e) { console.error("Erro Metas:", e); this.state.dadosMetas = []; }
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
        console.log(`🔍 [DEBUG] Check Permissão: ID=${uid}, Perfil=${perfil}, Funcao=${funcao}`);
        return perfil === 'admin' || perfil === 'administrador' || funcao.includes('gestor') || funcao.includes('auditor') || uid === 1 || uid === 1000;
    },

    normalizarData: function (d) {
        if (!d) return null;
        const str = String(d).trim();
        return str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
    },

    // ... (processarDadosUnificados, renderizarTabela, calcularKpisGlobal e auxiliares mantidos, foco na lógica de Abono abaixo) ...
    processarDadosUnificados: function () {
        const mapa = new Map();
        const range = this.state.range;
        const isPeriodo = range.inicio !== range.fim;
        const diasUteisPeriodo = this.contarDiasUteis(range.inicio, range.fim);

        const getChave = (uid, dataRaw) => {
            const date = this.normalizarData(dataRaw);
            return isPeriodo ? String(uid) : `${uid}_${date}`;
        };

        this.state.dadosProducao.forEach(p => {
            const uidStr = String(p.usuario_id);
            if (this.ehAdmin(uidStr)) return;

            const chave = getChave(uidStr, p.data_referencia);
            if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uidStr, isPeriodo ? 'Período' : this.normalizarData(p.data_referencia));

            const item = mapa.get(chave);
            item.producao += Number(p.quantidade) || 0;
            item.fifo += Number(p.fifo) || 0;
            item.gt += Number(p.gradual_total) || 0;
            item.gp += Number(p.gradual_parcial) || 0;
            item.soma_fator += (p.fator !== null ? Number(p.fator) : 1.0);
            item.count_fator++;
            if (p.justificativa) item.justificativa = isPeriodo ? "Vários..." : p.justificativa;
            if (!isPeriodo) item.id_prod = p.id;
        });

        this.state.dadosKPIAssertividade.forEach(kpi => {
            const uidStr = String(kpi.usuario_id);
            if (uidStr && !this.ehAdmin(uidStr)) {
                // Para assertividade, se for período o mapa usa apenas UID. 
                // Se for dia único, usamos a data do filtro (inicio) pois o query já filtrou por ela
                const chave = isPeriodo ? uidStr : `${uidStr}_${range.inicio}`;

                if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uidStr, isPeriodo ? 'Período' : range.inicio);

                const item = mapa.get(chave);
                item.qtd_assert = Number(kpi.qtd_auditorias || 0);
                item.media_final = Number(kpi.media_assertividade || 0);
            }
        });

        for (const item of mapa.values()) {
            item.fator = item.count_fator > 0 ? (item.soma_fator / item.count_fator) : 1.0;
            const metaObj = this.state.dadosMetas.find(m => String(m.usuario_id) === String(item.uid));

            // Garantir que metas sejam números para evitar erro .toFixed()
            item.meta_base_diaria = Number(metaObj ? (metaObj.meta_producao || 100) : 100);
            item.meta_assert = Number(metaObj ? (metaObj.meta_assertividade || 97) : 97);

            const multiplicador = isPeriodo ? diasUteisPeriodo : 1;
            item.meta_real_calculada = Math.round(item.meta_base_diaria * multiplicador * item.fator);
        }

        this.state.listaTabela = Array.from(mapa.values())
            .filter(r => !this.ehAdmin(r.uid) && !r.nome.toLowerCase().includes('admin'))
            .filter(r => r.producao > 0)
            .sort((a, b) => a.nome.localeCompare(b.nome));
    },

    renderizarTabela: function () {
        if (!this.els.tabela) return;

        // Aplica filtros se a engine estiver carregada
        const listaOriginal = this.state.listaTabela || [];
        const listaExibicao = (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.preFiltrar === 'function')
            ? window.Produtividade.Filtros.preFiltrar(listaOriginal)
            : listaOriginal;

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

            let assertHtml = '<span class="text-slate-300">-</span>';
            if (mediaAssert !== null && row.qtd_assert > 0) {
                const cor = mediaAssert >= row.meta_assert ? 'text-emerald-600' : 'text-rose-600';
                assertHtml = `<div class="flex flex-col items-center leading-tight">
                    <span class="${cor} font-bold">${mediaAssert.toFixed(2)}%</span>
                    <span class="text-[9px] text-slate-400">(${row.qtd_assert} docs)</span>
                </div>`;
            }

            return `
                <tr class="${isAbonado ? 'bg-amber-50/40' : (isChecked ? 'bg-blue-50' : 'hover:bg-slate-50')} border-b border-slate-200 text-xs transition-colors group">
                    <td class="px-2 py-3 text-center w-[40px]"><input type="checkbox" class="rounded border-slate-300 cursor-pointer" value="${row.uid}" ${isChecked ? 'checked' : ''} onclick="Produtividade.Geral.toggleSelecionar('${row.uid}')"></td>
                    <td class="px-2 py-3 text-center w-[50px]"><button onclick="Produtividade.Geral.abrirModalAbono('${row.uid}')" class="w-8 h-8 rounded flex items-center justify-center border transition ${isAbonado ? 'text-amber-500 bg-amber-100 border-amber-200' : 'text-slate-300 bg-slate-50 border-slate-200 hover:text-blue-500'}" title="${isAbonado ? 'Editar Abono' : 'Abonar'}"><i class="fas ${isAbonado ? 'fa-check-square' : 'fa-square'} text-sm"></i></button></td>
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
                        <input type="text" placeholder="${isAbonado ? 'Justificativa...' : 'Observação...'}" value="${row.justificativa}" class="w-full border-b border-transparent bg-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition text-xs truncate px-1 py-1" onchange="Produtividade.Geral.atualizarLinha('${row.uid}', '${row.data}', 'justificativa', this.value)">
                    </td>
                </tr>
            `;
        }).join('');

        this.els.tabela.innerHTML = html;
        this.atualizarBarraFlutuante();
    },

    calcularKpisGlobal: function () {
        // Aplica filtros se a engine estiver carregada
        const listaOriginal = this.state.listaTabela || [];
        const listaExibicao = (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.preFiltrar === 'function')
            ? window.Produtividade.Filtros.preFiltrar(listaOriginal)
            : listaOriginal;

        let totalProd = 0, totalMeta = 0;
        let somaPontosAssert = 0, totalDocsAssert = 0;
        let somaMetaAssert = 0, countUsersMeta = 0;
        let assistentesComProducao = new Set();
        let datasComProducao = new Set();
        let totalDiasUteis = this.contarDiasUteis(this.state.range.inicio, this.state.range.fim);

        listaExibicao.forEach(i => {
            totalProd += i.producao;
            totalMeta += i.meta_real_calculada;
            if (i.meta_assert > 0) { somaMetaAssert += i.meta_assert; countUsersMeta++; }
            if (i.producao > 0) assistentesComProducao.add(i.uid);
            if (i.qtd_assert > 0 && i.media_final !== null) {
                somaPontosAssert += (i.media_final * i.qtd_assert);
                totalDocsAssert += i.qtd_assert;
            }
        });

        this.state.dadosProducao.forEach(p => { if (p.quantidade > 0) datasComProducao.add(p.data_referencia); });

        const mediaAssert = totalDocsAssert > 0 ? (somaPontosAssert / totalDocsAssert) : 0;
        const totalAssistentesElegiveis = this.contarAssistentesElegiveis();
        const metaGlobalAssert = countUsersMeta > 0 ? (somaMetaAssert / countUsersMeta) : 97;

        let somaMetasConfiguradas = 0;
        let countMetasConfiguradas = 0;
        const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];

        for (const uid in this.state.mapaUsuarios) {
            const u = this.state.mapaUsuarios[uid];
            if (this.ehAdmin(parseInt(uid))) continue;
            if (u.ativo === false) continue;
            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            if (termosExcluidos.some(t => funcao.includes(t) || perfil.includes(t))) continue;

            const metaObj = this.state.dadosMetas.find(m => m.usuario_id == uid);
            somaMetasConfiguradas += metaObj ? Number(metaObj.meta_producao) : 100;
            countMetasConfiguradas++;
        }

        const safeCount = countMetasConfiguradas || 1;
        const mediaMetaVelocidade = Math.round(somaMetasConfiguradas / safeCount);
        const mediaProducaoDiariaGlobal = totalDiasUteis > 0 ? (totalProd / totalDiasUteis) : 0;
        const mediaVelocidadeReal = Math.round(mediaProducaoDiariaGlobal / safeCount);

        const dadosKPI = {
            prod: { real: totalProd, meta: totalMeta },
            assert: { real: mediaAssert, meta: metaGlobalAssert },
            capacidade: { diasReal: datasComProducao.size, diasTotal: totalDiasUteis, assisReal: assistentesComProducao.size, assisTotal: totalAssistentesElegiveis },
            velocidade: { real: mediaVelocidadeReal, meta: mediaMetaVelocidade }
        };

        this.atualizarCardsKPI(dadosKPI);
    },

    // Funções Auxiliares
    ehAdmin: function (id) { return id === 1 || id === 1000; },
    iniciarItemMapa: function (mapa, chave, uid, dataLabel) {
        const u = this.state.mapaUsuarios[uid];
        const nomeUser = u ? u.nome : 'ID: ' + uid;
        mapa.set(chave, {
            chave: chave, uid: uid, data: dataLabel, nome: nomeUser,
            fator: 1.0, soma_fator: 0, count_fator: 0,
            fifo: 0, gt: 0, gp: 0, producao: 0, justificativa: '', obs_assistente: '',
            soma_notas_bruta: 0, qtd_assert: 0, media_final: null,
            meta_base_diaria: 100, meta_real_calculada: 100, meta_assert: 97, id_prod: null
        });
    },
    contarDiasUteis: function (inicio, fim) {
        let count = 0; let cur = new Date(inicio + 'T12:00:00'); let end = new Date(fim + 'T12:00:00');
        while (cur <= end) { const day = cur.getDay(); if (day !== 0 && day !== 6) count++; cur.setDate(cur.getDate() + 1); }
        return count || 1;
    },
    contarAssistentesElegiveis: function () {
        let count = 0;
        const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];
        for (const uid in this.state.mapaUsuarios) {
            const u = this.state.mapaUsuarios[uid];
            if (this.ehAdmin(parseInt(uid))) continue;
            if (u.ativo === false) continue;
            const funcao = (u.funcao || '').toLowerCase();
            const perfil = (u.perfil || '').toLowerCase();
            if (!termosExcluidos.some(t => funcao.includes(t) || perfil.includes(t))) count++;
        }
        return count || 1;
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
        updateBar(null, this.els.barAssis, this.els.kpiAssisPct, kpi.capacidade.assisReal, kpi.capacidade.assisTotal, false, 'purple');
        if (this.els.kpiVelocReal) this.els.kpiVelocReal.textContent = kpi.velocidade.real.toLocaleString('pt-BR');
        if (this.els.kpiVelocEsperada) this.els.kpiVelocEsperada.textContent = kpi.velocidade.meta.toLocaleString('pt-BR');
        updateBar(null, this.els.barVeloc, this.els.kpiVelocPct, kpi.velocidade.real, kpi.velocidade.meta, false, 'amber');
    },
    atualizarDestaques: function () {
        const topProd = [...this.state.listaTabela].sort((a, b) => b.producao - a.producao).slice(0, 3);
        const topAssert = [...this.state.listaTabela].filter(i => i.qtd_assert >= 10).sort((a, b) => b.media_final - a.media_final).slice(0, 3);
        const renderItem = (list, elId, isPct) => {
            const el = document.getElementById(elId); if (!el) return;
            if (list.length === 0) { el.innerHTML = '<span class="text-[7px] text-slate-300 block text-center italic">Sem dados</span>'; return; }
            el.innerHTML = list.map(i => `<div class="flex justify-between items-center bg-slate-50/50 px-1 py-0.5 rounded border border-slate-100 shadow-sm"><span class="text-[9px] truncate w-[70%] font-bold text-slate-600 tracking-tight leading-tight" title="${i.nome}">${i.nome.split(' ')[0]} ${i.nome.split(' ')[1] ? i.nome.split(' ')[1].charAt(0) + '.' : ''}</span><span class="text-[9px] font-black ${isPct ? 'text-emerald-600' : 'text-blue-600'} leading-tight">${isPct ? i.media_final.toFixed(1) + '%' : i.producao}</span></div>`).join('');
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
        this.calcularKpisGlobal(); this.renderizarTabela(); this.atualizarDestaques();
    },
    renderizarDetalhes: function (uid) {
        const itemConsolidado = this.state.listaTabela.find(i => String(i.uid) === String(uid));
        const u = this.state.mapaUsuarios[uid]; const nomeUsuario = itemConsolidado ? itemConsolidado.nome : (u ? u.nome : 'Usuário');
        if (itemConsolidado) {
            this.atualizarCardsKPI({
                prod: { real: itemConsolidado.producao, meta: itemConsolidado.meta_real_calculada },
                assert: { real: itemConsolidado.media_final || 0, meta: itemConsolidado.meta_assert },
                capacidade: { diasReal: itemConsolidado.count_fator || 0, diasTotal: this.contarDiasUteis(this.state.range.inicio, this.state.range.fim), assisReal: 1, assisTotal: 1 },
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
            return `<tr class="hover:bg-slate-50 border-b border-slate-100 text-xs ${fator < 1.0 ? 'bg-amber-50/30' : ''}"><td class="px-4 py-3 font-bold text-slate-700">${dateObj.toLocaleDateString('pt-BR')}</td><td class="px-4 py-3 text-center uppercase text-[10px] text-slate-400 font-bold">${dateObj.toLocaleDateString('pt-BR', { weekday: 'short' })}</td><td class="px-4 py-3 text-center font-mono text-slate-500">${metaDia}</td><td class="px-4 py-3 text-center font-black text-blue-600">${d.quantidade}</td><td class="px-4 py-3 text-center"><span class="${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'} font-bold">${pct}%</span></td><td class="px-4 py-3 text-center text-slate-500">${fator.toFixed(1)}</td><td class="px-4 py-3 text-slate-500 italic truncate max-w-[200px]" title="${d.justificativa || ''}">${d.justificativa || '-'}</td></tr>`;
        }).join('');
    }
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => { if (!window.Produtividade || !window.Produtividade.Main) Produtividade.Geral.init(); }); } else { if (window.Produtividade) Produtividade.Geral.init(); }