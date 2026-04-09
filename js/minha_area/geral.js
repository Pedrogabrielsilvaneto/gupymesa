/* ARQUIVO: js/minha_area/geral.js
   VERSÃO: V5.0 (Capacidade Operativa Fix)
   DESCRIÇÃO: Ajuste na lógica de Capacidade Operativa (CLT vs Terceiros) e filtros de período.
*/
window.MinhaArea = window.MinhaArea || {};

MinhaArea.Geral = {
    state: {
        loading: false,
        dadosProducao: [],
        dadosAssertividadeDiaria: [],
        dadosMetas: [],
        mapaUsuarios: {},
        listaTabela: [],
        range: { inicio: null, fim: null },
        headerOriginal: null,
        editando: { uid: null, data: null },
        isMacro: false,
        headcountConfig: null,
        metaDiariaRestante: null // [NEW] Store calculated daily target
    },

    els: {
        tabelaHeader: document.querySelector('#ma-tab-diario thead'),
        tabela: document.getElementById('tabela-extrato'),
        totalFooter: document.getElementById('total-registros-footer'),
        containerAlert: document.getElementById('container-checkin-alert'), // [NEW] Alert Container

        kpiVolume: document.getElementById('kpi-prod-real'),
        kpiMetaVolume: document.getElementById('kpi-prod-meta'),
        kpiVolumePct: document.getElementById('pct-prod'),
        barVolume: document.getElementById('bar-prod'),
        kpiAssertReal: document.getElementById('kpi-assert-real'),
        kpiAssertTarget: document.getElementById('kpi-assert-meta'),
        kpiAssertPct: document.getElementById('pct-assert'),
        barAssert: document.getElementById('bar-assert'),
        kpiDiasTrabalhados: document.getElementById('kpi-dias-trab'),
        kpiDiasUteis: document.getElementById('kpi-dias-uteis'),
        kpiDiasPct: document.getElementById('pct-dias'),
        barDias: document.getElementById('bar-dias'),
        kpiVelocReal: document.getElementById('kpi-dia-media'),
        kpiVelocEsperada: document.getElementById('kpi-dia-meta'),
        kpiVelocPct: document.getElementById('pct-dia'),
        barVeloc: document.getElementById('bar-dia')
    },

    carregar: async function () {
        if (!this.state.headerOriginal && this.els.tabelaHeader) {
            this.state.headerOriginal = this.els.tabelaHeader.innerHTML;
        }

        const filtro = MinhaArea.getDatasFiltro();
        if (!filtro) return;
        this.state.range = filtro;
        this.state.listaTabela = []; // Reset visual
        this.renderLoading(); // Mostra spinner e limpa cards

        // Identifica se é visão macro (mais de 45 dias)
        const d1 = new Date(filtro.inicio);
        const d2 = new Date(filtro.fim);
        this.state.isMacro = (d2 - d1) / (1000 * 60 * 60 * 24) > 45;

        let alvoReal = MinhaArea.getUsuarioAlvo();
        this.renderLoading();

        try {
            await this.buscarUsuarios();

            // Migração Automática: Garantir coluna observacao_assistente
            try {
                const cols = await Sistema.query("SHOW COLUMNS FROM producao LIKE 'observacao_assistente'");
                if (!cols || cols.length === 0) {
                    await Sistema.query("ALTER TABLE producao ADD COLUMN observacao_assistente TEXT");
                    console.log("Coluna 'observacao_assistente' criada com sucesso.");
                }
            } catch (e) {
                console.warn("Erro ao verificar/criar coluna observacao_assistente:", e);
            }

            await Promise.all([
                this.buscarProducao(filtro, alvoReal),
                this.buscarAssertividadeDiariaSQL(filtro, alvoReal),
                this.buscarMetas(filtro, alvoReal)
            ]);

            await this.processarDadosUnificados();

            // Renderiza Diário (Se for Gestor, o renderizarDiario detecta e chama renderizarDiarioGestor internamente ou a própria lógica se adapta)
            // Como alvoReal agora sempre existe, ele sempre cairá no renderizarDiario
            // Security Fallback: Se não for admin, força o alvo ser o próprio usuário
            if (window.MinhaArea && !window.MinhaArea.isAdmin() && (!alvoReal || String(alvoReal) !== String(MinhaArea.usuario.id))) {
                console.warn("🔒 [SEGURANÇA] Forçando visão para o usuário logado.");
                alvoReal = MinhaArea.usuario.id;
            }

            if (alvoReal && alvoReal !== 'GRUPO_CLT' && alvoReal !== 'GRUPO_TERCEIROS') {
                this.renderizarDiario(alvoReal);
            } else {
                this.calcularKpisGlobal();
                this.renderizarGradeEquipe();
            }
        } catch (error) {
            console.error("❌ [Geral.js] Erro MA Geral:", error);
            if (this.els.tabela) {
                this.els.tabela.innerHTML = `<tr><td colspan="12" class="text-center py-4 text-rose-500">Erro: ${error.message}</td></tr>`;
            }
        }
    },

    buscarUsuarios: async function () {
        if (Object.keys(this.state.mapaUsuarios).length > 0) return;
        try {
            const data = await Sistema.query('SELECT id, nome, perfil, funcao, contrato, ativo FROM usuarios');
            if (data) data.forEach(u => this.state.mapaUsuarios[u.id] = u);
        } catch (e) {
            console.error("Erro ao buscar usuários:", e);
        }
    },

    buscarProducao: async function (range, uid) {
        let sql = 'SELECT * FROM producao WHERE data_referencia >= ? AND data_referencia <= ?';
        let params = [range.inicio, range.fim];

        // [FIX v4.23] Se for gestor ou grupos, pegamos TUDO para agregar.
        if (uid && uid !== 'GRUPO_CLT' && uid !== 'GRUPO_TERCEIROS' && !this.ehGestao(uid)) {
            sql += ' AND (usuario_id = ? OR CAST(usuario_id AS CHAR) = ?)';
            params.push(parseInt(uid), String(uid));
        }

        try {
            const data = await Sistema.query(sql, params);
            this.state.dadosProducao = data || [];
        } catch (error) {
            console.error("Erro Prod:", error);
            throw new Error("Erro Prod: " + error.message);
        }
    },

    buscarAssertividadeDiariaSQL: async function (range, uid) {
        let sql = `
            SELECT usuario_id, data_referencia, COUNT(*) as qtd_auditorias, AVG(assertividade_val) as media_assertividade 
            FROM assertividade 
            WHERE data_referencia >= ? AND data_referencia <= ?
            AND assertividade_val IS NOT NULL
        `;
        let params = [range.inicio, range.fim];

        // [FIX v4.23] Se for gestor ou grupos virtuais, pegamos TUDO.
        if (uid && uid !== 'GRUPO_CLT' && uid !== 'GRUPO_TERCEIROS' && !this.ehGestao(uid)) {
            sql += ' AND (usuario_id = ? OR CAST(usuario_id AS CHAR) = ?)';
            params.push(parseInt(uid), String(uid));
        }

        sql += ' GROUP BY usuario_id, data_referencia';

        try {
            const data = await Sistema.query(sql, params);
            let res = data || [];
            // O filtro de UID já foi feito no SQL, mas mantemos a logica original se necessario (aqui nao precisa mais filtrar de novo)
            this.state.dadosAssertividadeDiaria = res;
        } catch (error) {
            console.error("Erro Assertividade SQL:", error);
            this.state.dadosAssertividadeDiaria = [];
        }
    },

    buscarMetas: async function (range, uid) {
        if (!range.inicio) return;

        let sql = 'SELECT * FROM metas';
        let params = [];

        // [FIX v4.23] Se for gestor ou grupo, pegamos TUDO (pois precisamos das metas da equipe para calcular esforço).
        if (uid && uid !== 'GRUPO_CLT' && uid !== 'GRUPO_TERCEIROS' && !this.ehGestao(uid)) {
            sql += ' WHERE usuario_id = ? OR CAST(usuario_id AS CHAR) = ?';
            params.push(parseInt(uid), String(uid));
        }

        try {
            const data = await Sistema.query(sql, params);
            this.state.dadosMetas = data || [];
        } catch (e) {
            console.error("Erro Metas:", e);
            this.state.dadosMetas = [];
        }
    },

    processarDadosUnificados: async function () {
        const mapa = new Map();

        // Lógica de Dias Úteis Diferenciada (CLT vs Terc)
        const d1 = new Date(this.state.range.inicio + 'T12:00:00');
        const d2 = new Date(this.state.range.fim + 'T12:00:00');

        let configMes = null;

        // Tenta carregar config se for mes cheio
        if (this.state.range.inicio.endsWith('01') && this.state.range.fim === new Date(d1.getFullYear(), d1.getMonth() + 1, 0).toISOString().split('T')[0]) {
            configMes = await Gestao.ConfigMes.obter(d1.getMonth() + 1, d1.getFullYear());
        }

        // Helper para Dias Uteis
        const diasCal = this.contarDiasUteis(this.state.range.inicio, this.state.range.fim);
        
        // [FIX] dBase deve ser o calendário se for período curto, senão usa configMes
        let dBase = (configMes && (configMes.dias_uteis || configMes.dias_uteis_terceiros)) || diasCal;
        if (diasCal < (dBase * 0.8)) dBase = diasCal; 

        this.state.configMesLocal = configMes;

        const getDU = (contrato, nomeUser) => {
            const hasCustomDU = configMes && (Number(configMes.dias_uteis_terceiros) > 0 || Number(configMes.dias_uteis_clt) > 0 || Number(configMes.dias_uteis) > 0);

            // [FIX] Se for um período curto (semana/dia), ignoramos a config mensal de dias úteis e usamos o calendário real
            const isShortPeriod = diasCal < (dBase * 0.8) || !configMes;

            if (!hasCustomDU || isShortPeriod) {
                if (contrato === 'TERCEIROS' || contrato === 'PJ') return diasCal;
                if (contrato === 'CLT') return Math.max(0, diasCal - 1);
                return diasCal;
            }

            const vTerc = Number(configMes.dias_uteis_terceiros) || Number(configMes.dias_uteis) || diasCal;
            if (contrato === 'TERCEIROS' || contrato === 'PJ') return vTerc;

            const vClt = Number(configMes.dias_uteis_clt) || Number(configMes.dias_uteis) || Math.max(0, vTerc - 1);
            if (contrato === 'CLT') return vClt;

            return vTerc; // Default
        };

        // Se tiver config, define headcount base (embora aqui usemos contagem real)
        if (configMes) {
            const hcTotal = Number(configMes.hc_clt || 0) + Number(configMes.hc_terceiros || 0);
            this.state.headcountConfig = hcTotal > 0 ? hcTotal : 0;
            this.state.hcClt = Number(configMes.hc_clt || 0);
            this.state.hcTerc = Number(configMes.hc_terceiros || 0);
        } else {
            this.state.headcountConfig = null;
            this.state.hcClt = null;
            this.state.hcTerc = null;
        }

        this.state.dadosProducao.forEach(p => {
            const uid = parseInt(p.usuario_id);
            const chave = String(uid);
            if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uid);
            const item = mapa.get(chave);

            const fator = p.fator !== null ? Number(p.fator) : 1.0;
            const dataRefStr = p.data_referencia ? p.data_referencia.split('T')[0] : null;
            const dataRef = new Date(dataRefStr + 'T12:00:00');
            const mesChave = `${dataRef.getFullYear()}-${dataRef.getMonth() + 1}`;

            item.producao += Number(p.quantidade) || 0;
            item.soma_fator += fator;
            item.soma_abono += (1.0 - fator);
            if (dataRefStr) item.distinct_months.add(dataRefStr.substring(0, 7)); // YYYY-MM

            if (!item.meses[mesChave]) item.meses[mesChave] = { prod: 0, dias: 0 };
            item.meses[mesChave].prod += Number(p.quantidade) || 0;
            item.meses[mesChave].dias += fator;
        });

        this.state.dadosAssertividadeDiaria.forEach(a => {
            const uid = parseInt(a.usuario_id);
            const chave = String(uid);
            if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uid);
            const item = mapa.get(chave);
            const qtd = Number(a.qtd_auditorias || 0);
            if (qtd > 0) {
                item.qtd_assert += qtd;
                item.soma_notas_bruta += (Number(a.media_assertividade) * qtd);
            }
        });

        // [LOGIC] Garante que gestores com meta definida sejam processados
        // Mesmo que não tenham produção ou assertividade no período, precisamos da meta deles para o Dashboard Global
        this.state.dadosMetas.forEach(m => {
            const uid = parseInt(m.usuario_id);
            if (this.ehGestao(uid)) {
                const chave = String(uid);
                if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uid);
            }
        });

        // [LOGIC] Garante que o usuário alvo visualizado sempre exista (mesmo sem produção) para renderizar a meta
        const alvoId = MinhaArea.getUsuarioAlvo();
        if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
            const chAlvo = String(alvoId);
            if (!mapa.has(chAlvo) && this.state.mapaUsuarios[alvoId]) {
                this.iniciarItemMapa(mapa, chAlvo, alvoId);
            }
        }

        for (const item of mapa.values()) {
            item.media_final = item.qtd_assert > 0 ? item.soma_notas_bruta / item.qtd_assert : null;

            // [LOGIC] Meta Diária (Velocidade Esperada) Fallback
            const uInfo = this.state.mapaUsuarios[item.uid];
            const contratoUser = uInfo ? (uInfo.contrato || 'TERCEIROS').toUpperCase() : 'TERCEIROS';
            const isTerceiro = contratoUser.includes('PJ') || contratoUser.includes('TERCEIR') || contratoUser.includes('PREST');
            const defaultMeta = isTerceiro ? 100 : 650;
            const isPeriodo = this.state.range.inicio !== this.state.range.fim;
            const ehCLTVel = !isTerceiro;

            // [FIX] Base real previstando descontar CLT (-1 dia/mês), em seguida abater abonos explícitos
            const mesesNoPeriodo = this._getMesesNoPeriodo(this.state.range.inicio, this.state.range.fim);
            let diasPrevistos = this.contarDiasUteis(this.state.range.inicio, this.state.range.fim);
            if (ehCLTVel && isPeriodo) diasPrevistos = Math.max(0, diasPrevistos - (mesesNoPeriodo.length || 1));
            
            const diasEfetivosVel = Math.max(1, diasPrevistos - item.soma_abono);
            item.dias_efetivos_kpi = diasEfetivosVel;

            if (this.state.isMacro) {
                // ---- VISÃO MACRO (Trimestre / Semestre / Ano) ----
                // Acumula meta totalperiodo mes a mes (mesma logica do Mes/Semana)
                let metaTotalAcumulada = 0;
                let somaMetaDiaria = 0;
                let qtdMeses = 0;

                const mesesNoPeriodo = this._getMesesNoPeriodo(this.state.range.inicio, this.state.range.fim);

                for (const { ano, mes, inicio, fim } of mesesNoPeriodo) {
                    const userMetas = this.state.dadosMetas.filter(mt => String(mt.usuario_id) === String(item.uid));
                    let metaObj = userMetas.find(mt => mt.mes == mes && mt.ano == ano);
                    if (!metaObj) {
                        const metasAnteriores = userMetas
                            .filter(mt => (mt.ano < ano || (mt.ano == ano && mt.mes < mes)) && (mt.meta_producao !== null || mt.meta_prod !== null))
                            .sort((a, b) => b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes);
                        if (metasAnteriores.length > 0) metaObj = metasAnteriores[0];
                    }

                    const rawMeta = metaObj ? (metaObj.meta_producao !== null && metaObj.meta_producao !== undefined ? metaObj.meta_producao : (metaObj.meta_prod !== null && metaObj.meta_prod !== undefined ? metaObj.meta_prod : null)) : null;
                    const metaBase = rawMeta !== null ? Number(rawMeta) : defaultMeta;

                    const rawAssert = metaObj ? (metaObj.meta_assertividade !== null && metaObj.meta_assertividade !== undefined ? metaObj.meta_assertividade : (metaObj.meta_assert !== null && metaObj.meta_assert !== undefined ? metaObj.meta_assert : null)) : null;
                    if (rawAssert !== null) item.meta_assert = Number(rawAssert);

                    // Dias uteis deste mes respeitando regra CLT (-1/mes) vs Terceiros
                    const hojeStr = new Date().toISOString().split('T')[0];
                    const fimRealMeta = (hojeStr < fim) ? hojeStr : fim;
                    
                    const diasCalMes = this.contarDiasUteis(inicio, fimRealMeta);
                    const jaPassouOuEstaNoMes = (hojeStr >= inicio);
                    const duMes = (ehCLTVel && jaPassouOuEstaNoMes) ? Math.max(0, diasCalMes - 1) : diasCalMes;

                    metaTotalAcumulada += metaBase * duMes;
                    somaMetaDiaria += metaBase;
                    qtdMeses++;
                }

                item.meta_total_periodo = Math.round(metaTotalAcumulada);
                item.meta_velocidade_media = qtdMeses > 0 ? Math.round(somaMetaDiaria / qtdMeses) : defaultMeta;

                const numMesesAtivos = item.distinct_months ? item.distinct_months.size : 1;
                const diasBrutosMacro = this.contarDiasUteis(this.state.range.inicio, this.state.range.fim);
                item.dias_uteis_brutos = ehCLTVel ? Math.max(0, diasBrutosMacro - numMesesAtivos) : diasBrutosMacro;
                item.dias_uteis_liquidos = Math.max(0, item.dias_uteis_brutos - item.soma_abono);
                
                item.velocidade_acumulada = item.dias_uteis_liquidos > 0 ? Math.round(item.producao / item.dias_uteis_liquidos) : 0;
            } else {
                // ---- VISÃO MICRO (Mês / Semana / Dia) ----
                item.velocidade_acumulada = diasEfetivosVel > 0 ? Math.round(item.producao / diasEfetivosVel) : 0;

                // Mapeamento correto da Meta em visão Micro (Pega o mês do início do filtro)
                const d1 = new Date(this.state.range.inicio + 'T12:00:00');
                const mesRef = d1.getMonth() + 1;
                const anoRef = d1.getFullYear();

                // Busca Meta na tabela `metas`
                const userMetas = this.state.dadosMetas.filter(mt => String(mt.usuario_id) === String(item.uid));
                let metasDoMes = userMetas.filter(mt => mt.mes == mesRef && mt.ano == anoRef);
                let metaObj = null;

                if (metasDoMes.length > 0) {
                    metaObj = metasDoMes.reverse().find(m => m.meta_producao !== null && m.meta_producao !== undefined) || metasDoMes[0];
                }

                if (!metaObj || (metaObj.meta_producao === null && metaObj.meta_prod === null)) {
                    const metasAnteriores = userMetas
                        .filter(mt => (mt.ano < anoRef || (mt.ano === anoRef && mt.mes < mesRef)) && (mt.meta_producao !== null || mt.meta_prod !== null))
                        .sort((a, b) => (b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes));

                    if (metasAnteriores.length > 0) {
                        metaObj = metasAnteriores[0];
                    }
                }

                const rawMeta = metaObj ? (metaObj.meta_producao !== null && metaObj.meta_producao !== undefined ? metaObj.meta_producao : (metaObj.meta_prod !== null && metaObj.meta_prod !== undefined ? metaObj.meta_prod : null)) : null;
                item.meta_velocidade_media = (rawMeta !== null && rawMeta !== undefined) ? Number(rawMeta) : defaultMeta;

                const rawAssert = metaObj ? (metaObj.meta_assertividade !== null && metaObj.meta_assertividade !== undefined ? metaObj.meta_assertividade : (metaObj.meta_assert !== null && metaObj.meta_assert !== undefined ? metaObj.meta_assert : null)) : null;
                if (rawAssert !== null && rawAssert !== undefined) {
                    item.meta_assert = Number(rawAssert);
                } else {
                    item.meta_assert = 97; // Default 97%
                }

                // Pega contrato do usuário
                const diastUteisUser = getDU(contratoUser, item.nome);

                // [LOGIC] Dias Trabalhados (Disponíveis para Meta)
                const diasUteisLiquidos = Math.max(0, diastUteisUser - item.soma_abono);

                // [LOGIC] Meta Total do Período = Meta Diária * Dias Trabalhados
                item.meta_total_periodo = Math.round(item.meta_velocidade_media * diasUteisLiquidos);
                item.dias_uteis_liquidos = diasUteisLiquidos;
                item.dias_uteis_brutos = dBase;
            }
        }

        let listaBase = Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
        const alvoReal = MinhaArea.getUsuarioAlvo();

        // Se um grupo específico for selecionado, esconde assistentes não pertencentes da Grade de Equipe e dos KPIs globais
        if (alvoReal === 'GRUPO_CLT') {
            listaBase = listaBase.filter(i => {
                const uInfo = this.state.mapaUsuarios[i.uid];
                return uInfo && (uInfo.contrato || '').toUpperCase().includes('CLT');
            });
        } else if (alvoReal === 'GRUPO_TERCEIROS') {
            listaBase = listaBase.filter(i => {
                const uInfo = this.state.mapaUsuarios[i.uid];
                const c = (uInfo.contrato || '').toUpperCase();
                return c.includes('TERCEIR') || c.includes('PJ') || c.includes('PREST');
            });
        }

        this.state.listaTabela = listaBase;
    },

    iniciarItemMapa: function (mapa, chave, uid) {
        const u = this.state.mapaUsuarios[uid];
        const contrato = (u?.contrato || '').toUpperCase();
        const isTerceiro = contrato.includes('PJ') || contrato.includes('TERCEIR') || contrato.includes('PREST');
        const dMeta = isTerceiro ? 100 : 650;

        mapa.set(chave, {
            uid: uid, nome: u ? u.nome : `ID: ${uid}`,
            producao: 0, soma_fator: 0, soma_abono: 0, distinct_months: new Set(),
            qtd_assert: 0, soma_notas_bruta: 0, media_final: null,
            meses: {}, velocidade_acumulada: 0, meta_velocidade_media: dMeta,
            meta_total_periodo: 0, dias_uteis_liquidos: 0, meta_assert: 97,
            justificativa_gestao: '', observacao_assistente: ''
        });
    },

    renderizarDiario: function (uid) {
        // Redireciona para visão consolidada se for gestor logado vendo sua visão ou se for selecionado 'EQUIPE' (caso ainda exista no state)
        if (this.ehGestao(uid)) { this.renderizarDiarioGestor(uid); return; }

        if (this.state.headerOriginal && this.els.tabelaHeader) {
            this.els.tabelaHeader.innerHTML = this.state.headerOriginal;
        }

        const item = this.state.listaTabela.find(i => String(i.uid) === String(uid));
        if (item) {
            const uInfo = this.state.mapaUsuarios[uid];
            const contratoUser = uInfo ? (uInfo.contrato || 'TERCEIROS').toUpperCase() : 'TERCEIROS';
            const ehCLT = contratoUser.includes('CLT');
            const isPeriodo = this.state.range.inicio !== this.state.range.fim;

            this.atualizarCardsKPI({
                prod: { real: item.producao, meta: item.meta_total_periodo },
                assert: { real: item.media_final || 0, meta: item.meta_assert },
                capacidade: {
                    diasReal: item.dias_efetivos_kpi,
                    diasTotal: item.dias_uteis_brutos
                },
                velocidade: { real: item.velocidade_acumulada, meta: item.meta_velocidade_media }
            });

            // [NEW] Calcular e Exibir Alerta de Meta Diária Restante
            this.calcularMetaDiariaRestante(item);
        }

        const dadosFiltrados = this.state.dadosProducao
            .filter(d => String(d.usuario_id) === String(uid))
            .sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));

        if (this.els.totalFooter) this.els.totalFooter.textContent = dadosFiltrados.length;

        if (dadosFiltrados.length === 0) {
            this.els.tabela.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-slate-400">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        const assertMap = {};
        this.state.dadosAssertividadeDiaria.forEach(a => assertMap[a.data_referencia] = a);

        this.els.tabela.innerHTML = dadosFiltrados.map(d => {
            const fator = d.fator !== null ? Number(d.fator) : 1.0;
            const metaBase = item ? item.meta_velocidade_media : 100;
            const metaDia = Math.round(metaBase * fator);
            const pct = metaDia > 0 ? Math.round((d.quantidade / metaDia) * 100) : 0;
            const assertDia = assertMap[d.data_referencia];

            let assertHtml = '<span class="text-slate-300">-</span>';
            if (assertDia && assertDia.qtd_auditorias > 0) {
                const cor = assertDia.media_assertividade >= (item?.meta_assert || 97) ? 'text-emerald-600' : 'text-rose-600';
                assertHtml = `<span class="${cor} font-bold">${Number(assertDia.media_assertividade).toFixed(2)}%</span>`;
            }

            // Lógica de Observação em duas partes
            const justGestao = d.justificativa ? `<span class="text-amber-600 font-bold">[Gestão]: ${d.justificativa}</span>` : '';
            const obsAssis = d.observacao_assistente ? `<span class="text-slate-600"> | [Eu]: ${d.observacao_assistente}</span>` : '';
            const obsHtml = justGestao || obsAssis ? (justGestao + obsAssis) : '<span class="text-slate-300">-</span>';

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                    <td class="px-3 py-2 font-bold text-slate-700">${this.formatarDataSegura(d.data_referencia)}</td>
                    <td class="px-2 py-2 text-center text-slate-500">${metaBase}</td>
                    <td class="px-2 py-2 text-center text-slate-700 font-bold">${metaDia}</td>
                    <td class="px-2 py-2 text-center font-black text-blue-600 bg-blue-50/20">${d.quantidade || 0}</td>
                    <td class="px-2 py-2 text-center font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${pct}%</td>
                    <td class="px-2 py-2 text-center">${assertHtml}</td>
                    <td class="px-3 py-2 cursor-pointer group hover:bg-white truncate max-w-[300px]" onclick="MinhaArea.Geral.abrirModalObs('${d.usuario_id}', '${d.data_referencia}')" title="Clique para editar observação">
                        <div class="flex items-center gap-2">
                             <span class="text-slate-400 group-hover:text-blue-600"><i class="far fa-edit"></i></span>
                             <div class="truncate">${obsHtml}</div>
                        </div>
                    </td>
                </tr>`;
        }).join('');
    },

    renderizarGradeEquipe: function () {
        const headerGrade = `<tr class="divide-x divide-slate-200"><th class="px-3 py-3 text-left bg-slate-50">Assistente</th><th class="px-2 py-3 text-center bg-slate-50">Dias Trab.</th><th class="px-2 py-3 text-center bg-slate-50">Meta (Gestão)</th><th class="px-2 py-3 text-center bg-blue-50 text-blue-700">Produção Total</th><th class="px-2 py-3 text-center bg-slate-50">Meta Real</th><th class="px-2 py-3 text-center bg-slate-50">%</th><th class="px-2 py-3 text-center bg-slate-50">Assertividade</th><th class="px-3 py-3 text-left bg-slate-50">Observação</th></tr>`;
        if (this.els.tabelaHeader) this.els.tabelaHeader.innerHTML = headerGrade;

        const listaAssistentes = this.state.listaTabela.filter(row => !this.ehGestao(row.uid));
        if (this.els.totalFooter) this.els.totalFooter.textContent = listaAssistentes.length;

        this.els.tabela.innerHTML = listaAssistentes.map(row => {
            try {
                const pct = row.meta_total_periodo > 0 ? Math.round((row.producao / row.meta_total_periodo) * 100) : 0;
                let assertHtml = '<span class="text-slate-300">-</span>';

                // Safety check for media_final
                if (row.media_final !== null && typeof row.media_final === 'number' && !isNaN(row.media_final)) {
                    const cor = row.media_final >= row.meta_assert ? 'text-emerald-600' : 'text-rose-600';
                    assertHtml = `<span class="${cor} font-bold">${row.media_final.toFixed(2)}%</span>`;
                }

                const obsText = row.justificativa_gestao || row.observacao_assistente ? 'Sim' : '-';

                return `
                    <tr class="hover:bg-blue-50/30 border-b border-slate-200 cursor-pointer" onclick="MinhaArea.mudarUsuarioAlvo('${row.uid}')">
                        <td class="px-3 py-3 font-bold text-slate-700">${row.nome}</td>
                        <td class="px-2 py-3 text-center text-slate-700 font-medium bg-slate-50">${row.dias_efetivos_kpi}</td>
                        <td class="px-2 py-3 text-center text-slate-500">${row.meta_velocidade_media}</td>
                        <td class="px-2 py-3 text-center font-black text-blue-700 bg-blue-50/20">${row.producao}</td>
                        <td class="px-2 py-3 text-center text-slate-700">${row.meta_total_periodo}</td>
                        <td class="px-2 py-3 text-center font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${pct}%</td>
                        <td class="px-2 py-3 text-center">${assertHtml}</td>
                        <td class="px-3 py-3 text-slate-400 text-xs">${obsText}</td>
                    </tr>`;
            } catch (e) {
                console.error("Erro ao renderizar linha de assistente:", row, e);
                return `<tr><td colspan="7" class="text-rose-500 text-xs p-2">Erro ao renderizar ${row.nome}</td></tr>`;
            }
        }).join('');
    },

    calcularKpisGlobal: function () {
        let totalProd = 0;
        let totalMeta = 0;
        let somaPontosAssert = 0, totalDocsAssert = 0;
        let somaMetaAssert = 0, countUsersMeta = 0;
        let totalAbonoEquipe = 0;
        let countUsersEquipe = 0;

        const loggedInUid = window.MinhaArea?.usuario?.id;
        const configMesParaMeta = this.state.configMesLocal || {};
        const alvoReal = MinhaArea.getUsuarioAlvo();

        // Define Filtro Equivalente ao de Produtividade
        let filtroContrato = 'TODOS';
        if (alvoReal === 'GRUPO_CLT') filtroContrato = 'CLT';
        else if (alvoReal === 'GRUPO_TERCEIROS') filtroContrato = 'TERCEIROS';

        let metaDiariaGestor = 0;
        let abonoManualGestora = 0;
        const uidsVisiveis = new Set();

        let maxMetaProducao = 0;
        let assistentesReaisComProducao = 0;
        let totalAbonoParticipante = 0; // Abono apenas de quem teve produção > 0

        const forbidden = ['ADMIN', 'GESTOR', 'AUDITOR', 'LIDER', 'LÍDER', 'COORDENA', 'HEAD', 'DIRETOR'];
        const currentLoggedInUid = String(window.MinhaArea?.usuario?.id || '');

        this.state.listaTabela.forEach(i => {
            const u = this.state.mapaUsuarios[i.uid] || {};
            const fCaps = (u.funcao || '').toUpperCase();
            const pCaps = (u.perfil || '').toUpperCase();
            const ehGestaoLoop = forbidden.some(t => fCaps.includes(t) || pCaps.includes(t)) || i.uid == 1 || i.uid == 1000;

            if (ehGestaoLoop) {
                if (String(i.uid) === currentLoggedInUid) {
                    metaDiariaGestor = i.meta_velocidade_media || 0;
                    abonoManualGestora = i.soma_abono || 0;
                } else if (!metaDiariaGestor && i.meta_velocidade_media > 0) {
                    metaDiariaGestor = i.meta_velocidade_media;
                    abonoManualGestora = i.soma_abono || 0;
                }
                totalProd += (i.producao || 0);
                return;
            }

            uidsVisiveis.add(String(i.uid));
            totalProd += (i.producao || 0);

            if (i.producao > 0) {
                assistentesReaisComProducao++;
                if (i.soma_abono > 0) totalAbonoParticipante += i.soma_abono;
            }

            if (i.meta_assert > 0) { somaMetaAssert += i.meta_assert; countUsersMeta++; }
            if (i.qtd_assert > 0 && i.media_final !== null) {
                somaPontosAssert += (i.media_final * i.qtd_assert);
                totalDocsAssert += i.qtd_assert;
            }

            totalAbonoEquipe += (i.soma_abono || 0);
            countUsersEquipe++;

            const contratoUser = u ? (u.contrato || '').toUpperCase() : '';
            const isTerceiro = contratoUser.includes('PJ') || contratoUser.includes('TERCEIR') || contratoUser.includes('PREST');
            const metaVal = Number(i.meta_velocidade_media) || (isTerceiro ? 100 : 650);
            if (metaVal > maxMetaProducao) maxMetaProducao = metaVal;
        });

        const targetMetaFallback = (filtroContrato === 'TERCEIROS') ? 100 : 650;
        if (maxMetaProducao === 0) maxMetaProducao = targetMetaFallback;

        // ------------------ MESMA LÓGICA DE PRODUTIVIDADE ---------------------
        const rangeSel = this.state.range || {};
        const isPeriodo = rangeSel.inicio !== rangeSel.fim;
        const diasMetaCal = this.contarDiasUteis(rangeSel.inicio, rangeSel.fim);

        // Pega dias da configuração customizada se houver, ou pura do calendário
        const hasCustomConfigDias = configMesParaMeta && (Number(configMesParaMeta.dias_uteis_clt) > 0 || Number(configMesParaMeta.dias_uteis_terceiros) > 0 || Number(configMesParaMeta.dias_uteis) > 0);

        let targetDiasCal = hasCustomConfigDias
            ? (Number(configMesParaMeta.dias_uteis_clt) || Number(configMesParaMeta.dias_uteis_terceiros) || Number(configMesParaMeta.dias_uteis) || diasMetaCal)
            : Math.max(0, diasMetaCal - 1); // A regra -1 entra pro GERAL se estiver sem configuração (herdando lógica de CLT)

        let targetDiasClt = hasCustomConfigDias
            ? (Number(configMesParaMeta.dias_uteis_clt) || targetDiasCal)
            : Math.max(0, diasMetaCal - 1);

        let targetDiasTerc = hasCustomConfigDias
            ? (Number(configMesParaMeta.dias_uteis_terceiros) || diasMetaCal)
            : diasMetaCal; // Terceiro puro, nunca subtrai 1

        let dBase = targetDiasCal;
        let dCltMeta = targetDiasClt;
        let dTercMeta = targetDiasTerc;

        // [FIX] Se for um filtro de período curto (não o mês todo), forçamos o uso do calendário real para dBase também
        if (diasMetaCal < (dBase * 0.8)) {
            dBase = diasMetaCal;
            dCltMeta = diasMetaCal;
            dTercMeta = diasMetaCal;
        }

        // Lógica HC Custom:
        const hasConfigHC = configMesParaMeta && (Number(configMesParaMeta.hc_clt) > 0 || Number(configMesParaMeta.hc_terceiros) > 0);
        const hClt = hasConfigHC ? Number(configMesParaMeta.hc_clt || 0) : 8;
        const hTerc = hasConfigHC ? Number(configMesParaMeta.hc_terceiros || 0) : 9;

        if (maxMetaProducao === 0) maxMetaProducao = 650;
        let targetVelocidade = (filtroContrato === 'TODOS' && metaDiariaGestor > 0) ? metaDiariaGestor : maxMetaProducao;

        // --- LÓGICA CLT ---
        const mClt = targetVelocidade > 0 ? targetVelocidade : 650;
        const multCltMeta = isPeriodo ? Math.max(0, dCltMeta - 1 - abonoManualGestora) : dCltMeta;
        const valorMetaCLT = mClt * hClt * multCltMeta;

        // --- LÓGICA TERCEIROS ---
        const mTerc = targetVelocidade > 0 ? targetVelocidade : 100;
        const multTercMeta = isPeriodo ? Math.max(0, dTercMeta) : dTercMeta;
        const valorMetaTerc = mTerc * hTerc * multTercMeta;

        // --- LÓGICA GERAL ---
        const hGeral = hClt + hTerc;
        let totalMetaAjustada = 0;

        if (filtroContrato === 'CLT') {
            totalMetaAjustada = valorMetaCLT;
        } else if (filtroContrato === 'TERCEIROS') {
            totalMetaAjustada = valorMetaTerc;
        } else {
            const multGeral = isPeriodo ? Math.max(0, dBase - abonoManualGestora) : dBase;
            const metaBaseGeral = targetVelocidade > 0 ? targetVelocidade : 650;
            totalMetaAjustada = hGeral * metaBaseGeral * multGeral;
        }

        totalMeta = Math.max(0, Math.round(totalMetaAjustada));

        // Dados Restantes (Produção / Dias Trabalhados / Velocidade)
        const mediaAssert = totalDocsAssert > 0 ? (somaPontosAssert / totalDocsAssert) : 0;
        const metaGlobalAssert = countUsersMeta > 0 ? (somaMetaAssert / countUsersMeta) : 97;

        let datasComProducao = new Set();
        this.state.dadosProducao.forEach(p => {
            if (p.quantidade > 0 && uidsVisiveis.has(String(p.usuario_id))) {
                datasComProducao.add(p.data_referencia);
            }
        });

        // HC p/ Capacidade
        let hcParaVelocidade = hGeral;
        if (filtroContrato === 'CLT') hcParaVelocidade = hClt;
        else if (filtroContrato === 'TERCEIROS') hcParaVelocidade = hTerc;

        // Se HC for detectado como 0, fallback o headcount de quem tem produção (igual à Produtividade)
        if (hcParaVelocidade <= 0) {
            hcParaVelocidade = uidsVisiveis.size || (filtroContrato === 'CLT' ? 8 : (filtroContrato === 'TERCEIROS' ? 9 : 17));
        }

        const diasCalendarioEfetivos = this.contarDiasUteis(rangeSel.inicio, rangeSel.fim);

        // [FIX] dBaseReferencia deve ser o calendário PURO para evitar dupla subtração
        let diasDivisorReal = diasCalendarioEfetivos;

        const hoje = new Date().toISOString().split('T')[0];
        if (hoje >= rangeSel.inicio && hoje <= rangeSel.fim) {
            diasDivisorReal = this.contarDiasUteis(rangeSel.inicio, hoje);
        }

        const diasParaVelocidade = (filtroContrato === 'CLT' || filtroContrato === 'TODOS')
            ? Math.max(1, (isPeriodo ? (diasDivisorReal - 1 - abonoManualGestora) : diasDivisorReal))
            : Math.max(1, diasDivisorReal); // Terceiro puro, nunca desconta abono da gestora

        const divisorVelocidade = hcParaVelocidade * diasParaVelocidade;
        const mediaVelocidadeReal = divisorVelocidade > 0 ? Math.round(totalProd / divisorVelocidade) : 0;

        const assisRealFinal = Math.max(0, assistentesReaisComProducao - Math.floor(totalAbonoParticipante + 0.001));

        this.atualizarCardsKPI({
            prod: { real: totalProd, meta: totalMeta },
            assert: { real: mediaAssert, meta: metaGlobalAssert },
            capacidade: {
                diasReal: (filtroContrato === 'CLT' && isPeriodo && datasComProducao.size > 0) ? Math.max(0, datasComProducao.size - 1) : datasComProducao.size,
                diasTotal: (filtroContrato === 'TERCEIROS') ? dTercMeta : dBase,
                assisReal: assisRealFinal,
                assisTotal: (filtroContrato === 'CLT') ? hClt : (filtroContrato === 'TERCEIROS' ? hTerc : hGeral)
            },
            velocidade: {
                real: mediaVelocidadeReal,
                meta: targetVelocidade
            }
        });

        // Alerta
        this.calcularMetaDiariaRestante({
            producao: totalProd,
            meta_total_periodo: totalMeta
        });
    },

    renderizarDiarioGestor: function (uid) {
        // Visão Consolidada da Equipe para o Gestor
        let item = this.state.listaTabela.find(i => String(i.uid) === String(uid));

        // [FIX] Se o gestor não tiver produção própria, cria um item dummy para não travar a renderização
        if (!item) {
            item = {
                uid: uid,
                nome: this.state.mapaUsuarios[uid]?.nome || 'Gestor',
                meta_velocidade_media: 100,
                meta_assert: 97,
                dias_uteis_liquidos: 0
            };
        }

        // Força o cabeçalho idêntico à visão do assistente (v4.22)
        if (this.els.tabelaHeader) {
            const btnVoltar = (window.MinhaArea && window.MinhaArea.isAdmin()) ? `
                <tr class="bg-slate-100 border-b border-slate-300">
                    <td colspan="8" class="px-4 py-2">
                        <button onclick="MinhaArea.mudarUsuarioAlvo('')" class="text-sm text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            ⬅ Voltar para Visão de Equipe
                        </button>
                    </td>
                </tr>` : '';

            this.els.tabelaHeader.innerHTML = `
                ${btnVoltar}
                <tr class="divide-x divide-slate-200 border-b border-slate-300">
                    <th class="px-3 py-3 text-left bg-slate-50">Data</th>
                    <th class="px-2 py-3 text-center bg-slate-50">Meta (Gestão)</th>
                    <th class="px-2 py-3 text-center bg-slate-50">Meta Real</th>
                    <th class="px-2 py-3 text-center bg-blue-50 text-blue-700">Produção</th>
                    <th class="px-2 py-3 text-center bg-slate-50">% Prod.</th>
                    <th class="px-2 py-3 text-center bg-slate-50">Assertividade</th>
                    <th class="px-3 py-3 text-left bg-slate-50">Observação</th>
                </tr>`;
        }

        let totalProd = 0, totalDocs = 0, somaAssertGlobal = 0;
        let maxFator = 0;
        let diasUteisCalendario = 0;
        const diarioAgregado = {};

        // Agrupa produção diária apenas dos assistentes presentes na lista (respeita filtros)
        const uidsEquipe = new Set(this.state.listaTabela.map(i => String(i.uid)));
        this.state.dadosProducao.forEach(d => {
            if (this.ehGestao(d.usuario_id)) return;
            if (!uidsEquipe.has(String(d.usuario_id))) return;

            if (!diarioAgregado[d.data_referencia]) {
                diarioAgregado[d.data_referencia] = {
                    data: d.data_referencia,
                    prod: 0,
                    fator: 0,
                    somaAssert: 0,
                    countAssert: 0
                };
            }
            diarioAgregado[d.data_referencia].prod += Number(d.quantidade) || 0;
            diarioAgregado[d.data_referencia].fator += (d.fator !== null ? Number(d.fator) : 1.0);
        });

        // Agrega Assertividade Diária (média SIMPLES da equipe por dia - conforme regra de negócio)
        this.state.dadosAssertividadeDiaria.forEach(a => {
            const dataRef = a.data_referencia;
            // Só considera se houver produção/registro naquele dia (ou se quisermos considerar assertividade mesmo sem produção, mas o diário é guiado pela produção)
            // A lógica anterior ligava ao diarioAgregado que é montado via produção.
            if (diarioAgregado[dataRef] && a.qtd_auditorias > 0) {
                // Média Simples: Soma as médias dos assistentes e divide pelo número de assistentes
                diarioAgregado[dataRef].somaAssert += Number(a.media_assertividade);
                diarioAgregado[dataRef].countAssert += 1; // Conta +1 colaborador
            }
        });

        // Calcula Totais Período (KPI Cards)
        this.state.listaTabela.forEach(i => {
            if (this.ehGestao(i.uid)) return;
            totalProd += i.producao;
            maxFator = Math.max(maxFator, i.soma_fator);
            if (i.dias_uteis_brutos > diasUteisCalendario) diasUteisCalendario = i.dias_uteis_brutos;

            if (i.qtd_assert > 0) {
                somaAssertGlobal += i.soma_notas_bruta;
                totalDocs += i.qtd_assert;
            }
        });

        const HC = (this.state.headcountConfig && this.state.headcountConfig > 0) ? this.state.headcountConfig : 17; // Default 17
        const baseItem = this.state.listaTabela.find(i => !this.ehGestao(i.uid)) || {};
        const metaIndiv = baseItem.meta_velocidade_media || 650;
        
        const dCalendario = this.contarDiasUteis(this.state.range.inicio, this.state.range.fim);
        const diasUteisEquipe = baseItem.dias_uteis_liquidos || dCalendario || 0;
        const metaEquipePeriodo = metaIndiv * HC * diasUteisEquipe;

        const diasRealAgregado = Object.keys(diarioAgregado).length;
        const diasTotalAgregado = diasUteisCalendario > 0 ? diasUteisCalendario : (dCalendario || 21);

        this.atualizarCardsKPI({
            prod: { real: totalProd, meta: metaEquipePeriodo },
            assert: { real: totalDocs > 0 ? (somaAssertGlobal / totalDocs) : 0, meta: baseItem.meta_assert || 97 },
            capacidade: { diasReal: diasRealAgregado, diasTotal: diasTotalAgregado },
            velocidade: { real: Math.round(totalProd / (HC * (diasUteisEquipe || 1))), meta: metaIndiv }
        });

        // [NEW] Alerta Global (Visão Diária Consolidada)
        this.calcularMetaDiariaRestante({
            producao: totalProd,
            meta_total_periodo: metaEquipePeriodo
        });

        if (this.els.totalFooter) this.els.totalFooter.textContent = Object.keys(diarioAgregado).length;

        const listaDias = Object.values(diarioAgregado).sort((a, b) => a.data.localeCompare(b.data));

        if (listaDias.length === 0) {
            this.els.tabela.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-slate-400">Nenhum registro de produção da equipe no período.</td></tr>`;
            return;
        }

        this.els.tabela.innerHTML = listaDias.map(d => {
            const metaDia = Math.round(metaIndiv * HC * (d.fator / HC)); // Meta proporcional ao esforço da equipe no dia
            const pct = metaDia > 0 ? Math.round((d.prod / metaDia) * 100) : 0;
            const mediaAssertDia = d.countAssert > 0 ? (d.somaAssert / d.countAssert) : null;

            let assertHtml = '<span class="text-slate-300">-</span>';
            if (mediaAssertDia !== null) {
                const cor = mediaAssertDia >= (item.meta_assert || 97) ? 'text-emerald-600' : 'text-rose-600';
                assertHtml = `<span class="${cor} font-bold">${mediaAssertDia.toFixed(2)}%</span>`;
            }

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                    <td class="px-3 py-2 font-bold text-slate-700">${this.formatarDataSegura(d.data)}</td>
                    <td class="px-2 py-2 text-center text-slate-500">${metaIndiv * HC}</td>
                    <td class="px-2 py-2 text-center text-slate-700 font-bold">${metaDia}</td>
                    <td class="px-2 py-2 text-center font-black text-blue-600 bg-blue-50/20">${d.prod}</td>
                    <td class="px-2 py-2 text-center font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${pct}%</td>
                    <td class="px-2 py-2 text-center">${assertHtml}</td>
                    <td class="px-3 py-2 text-slate-400 text-[10px] italic">Visão Agregada (${HC} Assistentes)</td>
                </tr>`;
        }).join('');
    },

    atualizarCardsKPI: function (kpi) {
        const updateBar = (elText, elBar, elPct, val, target, isPct = false, colorClass = 'blue') => {
            const safeTarget = target === 0 ? 1 : target;
            const pct = Math.round((val / safeTarget) * 100);
            const width = Math.min(pct, 100);
            if (elText) elText.textContent = isPct ? (typeof val === 'number' && !isNaN(val) ? val.toFixed(2) : '0.00') + '%' : Math.round((typeof val === 'number' && !isNaN(val)) ? val : 0).toLocaleString('pt-BR');
            if (elPct) { elPct.textContent = pct + '%'; elPct.className = `font-bold ${isPct ? 'text-xs' : 'text-sm'} text-${colorClass}-600 ${isPct ? 'text-right' : ''}`; }
            if (elBar) { elBar.style.width = width + '%'; elBar.className = `h-full rounded-full transition-all duration-1000 bg-${colorClass}-${pct >= 100 ? '500' : '500'}`; }
        };

        if (this.els.kpiVolume) this.els.kpiVolume.textContent = (kpi.prod.real || 0).toLocaleString('pt-BR');
        if (this.els.kpiMetaVolume) this.els.kpiMetaVolume.textContent = (kpi.prod.meta || 0).toLocaleString('pt-BR');
        updateBar(null, this.els.barVolume, this.els.kpiVolumePct, kpi.prod.real, kpi.prod.meta, false, 'blue');

        // [NEW] Exibe "Faltam X" no card de Produtividade
        const elRestante = document.getElementById('kpi-prod-restante');
        if (elRestante) {
            const falta = (kpi.prod.meta || 0) - (kpi.prod.real || 0);
            if (falta > 0) {
                elRestante.textContent = `Faltam: ${falta.toLocaleString('pt-BR')}`;
                elRestante.className = 'text-[9px] font-bold text-slate-400 block mt-0.5';
            } else if (kpi.prod.meta > 0) {
                elRestante.textContent = 'Meta Batida!';
                elRestante.className = 'text-[9px] font-bold text-emerald-500 block mt-0.5';
            } else {
                elRestante.textContent = '';
            }
        }

        if (this.els.kpiAssertTarget) {
            const valAssertMeta = Number(kpi.assert.meta || 0);
            this.els.kpiAssertTarget.textContent = valAssertMeta.toFixed(0) + '%';
        }
        updateBar(this.els.kpiAssertReal, this.els.barAssert, this.els.kpiAssertPct, kpi.assert.real, kpi.assert.meta, true, 'emerald');

        if (this.els.kpiDiasTrabalhados) this.els.kpiDiasTrabalhados.textContent = kpi.capacidade.diasReal || 0;
        if (this.els.kpiDiasUteis) this.els.kpiDiasUteis.textContent = kpi.capacidade.diasTotal || 1;
        updateBar(null, this.els.barDias, this.els.kpiDiasPct, kpi.capacidade.diasReal, kpi.capacidade.diasTotal, false, 'purple');

        if (this.els.kpiVelocReal) this.els.kpiVelocReal.textContent = (kpi.velocidade.real || 0).toLocaleString('pt-BR');
        if (this.els.kpiVelocEsperada) this.els.kpiVelocEsperada.textContent = (kpi.velocidade.meta || 100).toLocaleString('pt-BR');
        updateBar(null, this.els.barVeloc, this.els.kpiVelocPct, kpi.velocidade.real, kpi.velocidade.meta, false, 'amber');
    },

    obterFeriados: function (ano) {
        // Feriados Nacionais Fixos
        const feriados = [
            `${ano}-01-01`, // Confraternização Universal
            `${ano}-04-21`, // Tiradentes
            `${ano}-05-01`, // Dia do Trabalho
            `${ano}-09-07`, // Independência
            `${ano}-10-12`, // Nossa Senhora Aparecida
            `${ano}-11-02`, // Finados
            `${ano}-11-15`, // Proclamação da República
            `${ano}-11-20`, // Consciência Negra
            `${ano}-12-25`  // Natal
        ];

        // Cálculo da Páscoa (Algoritmo de Meeus/Jones/Butcher)
        const a = ano % 19;
        const b = Math.floor(ano / 100);
        const c = ano % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const mesPascoa = Math.floor((h + l - 7 * m + 114) / 31);
        const diaPascoa = ((h + l - 7 * m + 114) % 31) + 1;

        const dataPascoa = new Date(ano, mesPascoa - 1, diaPascoa);

        // Feriados Móveis
        const addDias = (data, dias) => {
            const d = new Date(data);
            d.setDate(d.getDate() + dias);
            return d.toISOString().split('T')[0];
        };

        feriados.push(addDias(dataPascoa, -48), addDias(dataPascoa, -47), addDias(dataPascoa, -2), addDias(dataPascoa, 60)); // -48: Mon, -47: Tue (Carnival)

        return new Set(feriados);
    },

    contarDiasUteis: function (i, f) {
        let c = 0;
        const cur = new Date(i + 'T12:00:00');
        const end = new Date(f + 'T12:00:00');

        // Cache simples de feriados por ano
        const cacheFeriados = {};

        while (cur <= end) {
            const diaSemana = cur.getDay();
            // Ignora Sábado (6) e Domingo (0)
            if (diaSemana !== 0 && diaSemana !== 6) {
                const ano = cur.getFullYear();
                if (!cacheFeriados[ano]) {
                    cacheFeriados[ano] = this.obterFeriados(ano);
                }

                const dataStr = cur.toISOString().split('T')[0];
                // Se NÃO for feriado, conta
                if (!cacheFeriados[ano].has(dataStr)) {
                    c++;
                }
            }
            cur.setDate(cur.getDate() + 1);
        }
        return c > 0 ? c : 0; // Retorna 0 se não tiver dias úteis, validando lógica anterior que usava fallback 1
    },

    // Helper: retorna lista de meses no período com suas datas de início/fim reais
    _getMesesNoPeriodo: function (inicio, fim) {
        const meses = [];
        const d = new Date(inicio + 'T12:00:00');
        const fimDate = new Date(fim + 'T12:00:00');
        const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

        while (d <= fimDate) {
            const ano = d.getFullYear();
            const mes = d.getMonth() + 1;
            const inicioMes = new Date(ano, mes - 1, 1);
            const fimMes = new Date(ano, mes, 0);

            const inicioReal = d < inicioMes ? inicioMes : new Date(d);
            const fimReal = fimMes > fimDate ? new Date(fimDate) : fimMes;

            meses.push({ ano, mes, inicio: fmt(inicioReal), fim: fmt(fimReal) });

            d.setDate(1);
            d.setMonth(d.getMonth() + 1);
        }
        return meses;
    },

    ehGestao: function (userOrId) {
        const u = (typeof userOrId === 'object') ? userOrId : this.state.mapaUsuarios[userOrId];
        if (!u) return false;

        const p = (u.perfil || '').toUpperCase();
        const f = (u.funcao || '').toUpperCase();
        const id = parseInt(u.id);

        const forbidden = ['ADMIN', 'GESTOR', 'AUDITOR', 'LIDER', 'LÍDER', 'COORDENA', 'HEAD', 'DIRETOR'];
        return forbidden.some(t => p.includes(t) || f.includes(t)) || id === 1 || id === 1000;
    },

    ehLiderancaReal: function (uid) {
        const u = this.state.mapaUsuarios[uid];
        if (!u) return false;
        const p = (u.perfil || '').toUpperCase();
        const f = (u.funcao || '').toUpperCase();
        const isAuditor = f.includes('AUDITOR') || p.includes('AUDITOR');
        const forbidden = ['ADMIN', 'GESTOR', 'LIDER', 'LÍDER', 'COORDENA', 'HEAD', 'DIRETOR'];
        return !isAuditor && (forbidden.some(t => p.includes(t) || f.includes(t)) || parseInt(u.id) === 1 || parseInt(u.id) === 1000);
    },

    renderLoading: function () { 
        if (this.els.tabela) this.els.tabela.innerHTML = `<tr><td colspan="11" class="text-center py-12"><i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i></td></tr>`; 
        
        // Limpa os cards de KPI para não mostrar dados "presos" do filtro anterior
        const elsParaLimpar = [
            this.els.kpiVolume, this.els.kpiMetaVolume, this.els.kpiAssertReal, 
            this.els.kpiAssertTarget, this.els.kpiDiasTrabalhados, this.els.kpiDiasUteis,
            this.els.kpiVelocReal, this.els.kpiVelocEsperada
        ];
        elsParaLimpar.forEach(el => { if (el) el.textContent = '--'; });
        
        // Zera as barras de progresso
        [this.els.barVolume, this.els.barAssert, this.els.barDias, this.els.barVeloc].forEach(el => {
            if (el) el.style.width = '0%';
        });
        
        // Zera percentuais
        [this.els.kpiVolumePct, this.els.kpiAssertPct, this.els.kpiDiasPct, this.els.kpiVelocPct].forEach(el => {
            if (el) el.textContent = '0%';
        });

        // Limpa alerta de meta diária
        if (this.els.containerAlert) {
            this.els.containerAlert.innerHTML = '';
            this.els.containerAlert.classList.add('hidden');
        }
    },

    abrirModalObs: function (uid, dataRef) {
        const dadoDia = this.state.dadosProducao.find(d => String(d.usuario_id) === String(uid) && d.data_referencia === dataRef);
        this.state.editando = { uid: uid, data: dataRef };
        const elData = document.getElementById('obs-data-ref');
        const elGestao = document.getElementById('obs-gestao-view');
        const elAssistente = document.getElementById('obs-assistente-text');
        const modal = document.getElementById('modal-obs-assistente');

        if (elData) elData.innerText = this.formatarDataSegura(dataRef);
        const justGestao = dadoDia ? dadoDia.justificativa : '';
        const fator = dadoDia ? parseFloat(dadoDia.fator) : 1.0;
        if (elGestao) {
            elGestao.innerHTML = justGestao
                ? `<div class="bg-amber-50 border border-amber-200 p-2 rounded text-xs text-amber-800 mb-2"><strong>[Gestão]:</strong> ${justGestao}</div>`
                : '<div class="text-xs text-slate-400 mb-2 italic">Nenhuma observação da gestão.</div>';
        }
        if (elAssistente) elAssistente.value = dadoDia ? (dadoDia.observacao_assistente || '') : '';
        if (modal) { modal.classList.remove('hidden', 'pointer-events-none'); setTimeout(() => modal.classList.add('active'), 10); }
    },

    formatarDataSegura: function (dataRaw) {
        if (!dataRaw) return '-';
        // Se já for DD/MM/YYYY
        if (dataRaw.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dataRaw;

        // Tenta processar YYYY-MM-DD
        const partes = dataRaw.split('T')[0].split('-');
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        return dataRaw; // Fallback
    },

    fecharModalObs: function () {
        const modal = document.getElementById('modal-obs-assistente');
        if (modal) { modal.classList.remove('active'); setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('pointer-events-none'); }, 300); }
    },

    salvarObsAssistente: async function () {
        const { uid, data } = this.state.editando;
        const texto = document.getElementById('obs-assistente-text').value;
        const btn = document.getElementById('btn-salvar-obs');
        if (!uid || !data) return;
        const originalText = btn.innerHTML; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;

        try {
            // Verifica se existe registro
            const existenteRows = await Sistema.query('SELECT * FROM producao WHERE usuario_id = ? AND data_referencia = ?', [uid, data]);
            const existente = (existenteRows && existenteRows.length > 0) ? existenteRows[0] : null;

            if (existente) {
                // Update
                await Sistema.query('UPDATE producao SET observacao_assistente = ? WHERE id = ?', [texto, existente.id]);
            } else {
                // Insert novo (quantidade 0, fator 1.0)
                const uuid = Sistema.gerarUUID ? Sistema.gerarUUID() : crypto.randomUUID();
                await Sistema.query(
                    'INSERT INTO producao (id, usuario_id, data_referencia, quantidade, fator, observacao_assistente) VALUES (?, ?, ?, 0, 1.0, ?)',
                    [uuid, uid, data, texto]
                );
            }

            this.fecharModalObs();
            this.carregar();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar observação: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    init: async function () {
        try {
            // carregar() é chamado pelo Main.js após configurar filtros
            // await this.carregar();
            // this.configurarAbas(); // Removido pois é gerido pelo Main
            // ... existing code ...

            // [NEW] Verifica Check-in Diário
            setTimeout(() => this.verificarCheckinDiario(), 1500);

        } catch (error) {
            console.error('Erro ao inicializar:', error);
        }
    },

    // --- LÓGICA DE CHECK-IN DIÁRIO ---
    verificarCheckinDiario: async function () {
        const uid = (window.MinhaArea.usuario && window.MinhaArea.usuario.id) ? window.MinhaArea.usuario.id : (Sistema.lerSessao() ? Sistema.lerSessao().id : null);

        // [SYNC v4.38] Ignora check-in para Gestores, Auditoras e Administradores (User Request)
        if (!uid || this.ehGestao(uid)) {
            console.log("[CHECKIN DEBUG] Usuário de Gestão/Auditoria. Check-in dispensado.");
            return;
        }

        // Regra: Assistentes confirmam o dia anterior
        const hoje = new Date();
        const diaSemanaHoje = hoje.getDay(); // 0=Dom, 1=Seg...

        console.log(`[CHECKIN DEBUG] Hoje: ${hoje.toLocaleDateString()} (Dia ${diaSemanaHoje})`);

        // Se hoje for Sábado (6) ou Domingo (0), não pede checkin
        if (diaSemanaHoje === 0 || diaSemanaHoje === 6) {
            console.log("[CHECKIN DEBUG] Fim de semana. Check-in dispensado.");
            return;
        }

        let dataAlvo = new Date(hoje);

        // Se hoje for Segunda (1), o "ontem" útil foi Sexta (-3 dias)
        // [FIX] User Request: Checking referente a sexta-feira na segunda.
        if (diaSemanaHoje === 1) {
            dataAlvo.setDate(hoje.getDate() - 3);
        } else {
            // Dias normais (Ter-Sex), cobra o dia anterior (-1)
            dataAlvo.setDate(hoje.getDate() - 1);
        }

        const dataRef = dataAlvo.toISOString().split('T')[0];

        if (!uid) {
            console.warn("[CHECKIN DEBUG] Usuario nao autenticado (UID null).");
            return;
        }

        console.log(`[CHECKIN DEBUG] Verificando check-in para UID: ${uid} | Data Ref: ${dataRef}`);

        try {
            // Verifica se já existe check-in para a data
            const rows = await Sistema.query(`
                SELECT id FROM checkin_diario 
                WHERE usuario_uid = ? AND data_referencia = ?
            `, [uid, dataRef]);

            console.log(`[CHECKIN DEBUG] Resultado query:`, rows);

            if (!rows || rows.length === 0) {
                console.log("[CHECKIN DEBUG] Check-in pendente. Exibindo modal...");
                this.exibirModalCheckin(dataRef);
            } else {
                console.log("[CHECKIN DEBUG] Check-in já realizado.");
            }
        } catch (e) {
            console.error("[CHECKIN DEBUG] Erro ao verificar check-in:", e);
        }
    },

    exibirModalCheckin: function (dataRef) {
        if (document.getElementById('modal-checkin-diario')) return;

        // Formata data para exibição (PT-BR)
        const [ano, mes, dia] = dataRef.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;

        const html = `
            <div id="modal-checkin-diario" class="fixed bottom-6 right-6 z-[200] animate-slide-up">
                <div class="bg-white rounded-xl shadow-2xl w-80 overflow-hidden border border-blue-100 ring-1 ring-black/5">
                    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white flex items-center gap-3">
                        <i class="fas fa-clipboard-check text-2xl opacity-90"></i>
                        <div>
                            <h3 class="font-bold text-sm leading-tight">Check-in Pendente</h3>
                            <p class="text-blue-100 text-[10px]">Confirme os dados de: <strong>${dataFormatada}</strong></p>
                        </div>
                    </div>
                    
                    <div class="p-4 bg-slate-50/50">
                        <p class="text-slate-600 text-xs mb-3 text-justify leading-snug">
                            Por favor, verifique seus números no painel antes de confirmar.
                        </p>
                        
                        <button onclick="MinhaArea.Geral.confirmarCheckin('${dataRef}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-md shadow-blue-200 transition transform hover:scale-[1.02] flex items-center justify-center gap-2">
                            <i class="fas fa-check-circle"></i> Confirmar Leitura
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    confirmarCheckin: async function (dataRef) {
        const btn = document.querySelector('#modal-checkin-diario button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            const uid = (window.MinhaArea.usuario && window.MinhaArea.usuario.id) ? window.MinhaArea.usuario.id : Sistema.lerSessao().id;

            await Sistema.query(`
                INSERT INTO checkin_diario (usuario_uid, data_referencia, status)
                VALUES (?, ?, 'CONFIRMADO')
            `, [uid, dataRef]);

            // Sucesso
            btn.innerHTML = '<i class="fas fa-check"></i> Prontinho!';
            btn.classList.add('bg-green-600', 'hover:bg-green-700');
            btn.classList.remove('bg-blue-600', 'hover:bg-blue-700');

            setTimeout(() => {
                const modal = document.getElementById('modal-checkin-diario');
                modal.classList.add('opacity-0', 'scale-90'); // Animação de saída
                setTimeout(() => modal.remove(), 300);
            }, 1000);

        } catch (e) {
            console.error(e);
            alert("Erro ao confirmar check-in. Tente novamente.");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    // [NEW] Cálculo de Meta Diária Restante (Dias Úteis)
    calcularMetaDiariaRestante: function (item) {
        if (!this.els.containerAlert) return;

        // Limpa alerta anterior
        this.els.containerAlert.innerHTML = '';
        this.els.containerAlert.className = 'hidden mb-4';

        if (!item) return; // Removido this.state.isMacro check para permitir em Visão Semestral (User Request)

        const hoje = new Date();
        const hojeStr = hoje.toISOString().split('T')[0];

        // Verifica se hoje está dentro do range
        // Se estiver no passado, não mostra. Se estiver no futuro, mostra tudo.
        if (hojeStr > this.state.range.fim) return;

        // Meta Mensal Total (ou do período)
        const metaTotal = item.meta_total_periodo || 0;
        const producaoAtual = item.producao !== undefined ? item.producao : (item.producao_real || 0);
        const faltaProduzir = Math.max(0, metaTotal - producaoAtual);

        // Se já bateu a meta, mostra Parabéns!
        if (faltaProduzir <= 0) {
            this.els.containerAlert.innerHTML = `
                <div class="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r shadow-sm flex items-center justify-between animate-enter">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-emerald-100 text-emerald-600 rounded-full"><i class="fas fa-check-double"></i></div>
                        <div>
                            <p class="text-xs font-bold text-emerald-600 uppercase">Meta Batida!</p>
                            <p class="text-sm text-emerald-900 font-bold">Parabéns! Você já atingiu sua meta para o período.</p>
                        </div>
                    </div>
                </div>`;
            this.els.containerAlert.classList.remove('hidden');
            return;
        }

        // Dias Úteis Restantes (de HOJE até FIM do Range)
        // Se hoje já teve produção (check no banco?), talvez devesse contar amanha. 
        // Mas por simplicidade, vamos contar HOJE como dia util disponivel (se for < 18h ou algo assim? nao vamos complicar).
        const inicioContagem = hojeStr < this.state.range.inicio ? this.state.range.inicio : hojeStr;
        const diasUteisRestantes = this.contarDiasUteis(inicioContagem, this.state.range.fim);

        if (diasUteisRestantes <= 0) return;

        const metaDiariaNecessaria = Math.ceil(faltaProduzir / diasUteisRestantes);

        this.els.containerAlert.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-sm flex items-center justify-between animate-enter">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-blue-100 text-blue-600 rounded-full"><i class="fas fa-bullseye"></i></div>
                    <div>
                        <p class="text-xs font-bold text-blue-500 uppercase">Foco na Meta</p>
                        <p class="text-sm text-blue-900 font-bold">Para bater a meta, você precisa de <span class="text-lg text-blue-700">${metaDiariaNecessaria}</span> por dia.</p>
                    </div>
                </div>
                <div class="text-right hidden sm:block">
                    <p class="text-xs text-slate-500">Faltam: <strong class="text-slate-700">${faltaProduzir}</strong> itens</p>
                    <p class="text-xs text-slate-500">Dias úteis restantes: <strong class="text-slate-700">${diasUteisRestantes}</strong></p>
                </div>
            </div>`;
        this.els.containerAlert.classList.remove('hidden');
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.MinhaArea && window.MinhaArea.Geral) MinhaArea.Geral.init();
    });
} else {
    if (window.MinhaArea && window.MinhaArea.Geral) MinhaArea.Geral.init();
}