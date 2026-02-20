/* ARQUIVO: js/minha_area/geral.js
   VERSÃO: V4.8 (Correção de Somas, Médias e Escopo de Funções)
   DESCRIÇÃO: 
     - Visão Micro (Mês/Semana): Média = (Total Produção / Dias Trabalhados).
     - Visão Macro (Tri/Sem/Ano): Média = (Soma das Médias Mensais / Qtd de Meses).
     - Correção do erro de referência na função renderizarGradeEquipe.
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
        headcountConfig: null
    },

    els: {
        tabelaHeader: document.querySelector('#ma-tab-diario thead'),
        tabela: document.getElementById('tabela-extrato'),
        totalFooter: document.getElementById('total-registros-footer'),

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

        // Identifica se é visão macro (mais de 45 dias)
        const d1 = new Date(filtro.inicio);
        const d2 = new Date(filtro.fim);
        this.state.isMacro = (d2 - d1) / (1000 * 60 * 60 * 24) > 45;

        const alvoReal = MinhaArea.getUsuarioAlvo();
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
            if (alvoReal) {
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

        // [FIX v4.23] Se for gestor, NÃO filtramos pelo ID dele, pegamos TUDO para agregar.
        if (uid && !this.ehGestao(uid)) {
            sql += ' AND usuario_id = ?';
            params.push(uid);
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
        `;
        let params = [range.inicio, range.fim];

        // [FIX v4.23] Se for gestor, pegamos TUDO.
        if (uid && !this.ehGestao(uid)) {
            sql += ' AND usuario_id = ?';
            params.push(uid);
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
        const partes = range.inicio.split('-');
        const anoInicio = parseInt(partes[0]);
        const anoFim = new Date(range.fim).getFullYear();

        let sql = 'SELECT * FROM metas WHERE ano >= ? AND ano <= ?';
        let params = [anoInicio, anoFim];

        // [FIX v4.23] Se for gestor, pegamos TUDO (pois precisamos das metas da equipe para calcular esforço).
        if (uid && !this.ehGestao(uid)) {
            sql += ' AND usuario_id = ?';
            params.push(uid);
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
        const getDU = (contrato, nomeUser) => {
            const diasCal = this.contarDiasUteis(this.state.range.inicio, this.state.range.fim);
            if (!configMes) return diasCal;

            const vTerc = configMes.dias_uteis_terceiros || configMes.dias_uteis || diasCal;
            if (contrato === 'TERCEIROS' || contrato === 'PJ') return vTerc;

            const vClt = configMes.dias_uteis_clt || (vTerc - 1);
            if (contrato === 'CLT') return vClt;

            return vTerc; // Default
        };

        // Se tiver config, define headcount base (embora aqui usemos contagem real)
        if (configMes) {
            const hcTotal = Number(configMes.hc_clt || 0) + Number(configMes.hc_terceiros || 0);
            this.state.headcountConfig = hcTotal > 0 ? hcTotal : 0;
        } else {
            this.state.headcountConfig = null;
        }

        this.state.dadosProducao.forEach(p => {
            const uid = parseInt(p.usuario_id);
            const chave = String(uid);
            if (!mapa.has(chave)) this.iniciarItemMapa(mapa, chave, uid);
            const item = mapa.get(chave);

            const fator = p.fator !== null ? Number(p.fator) : 1.0;
            const dataRef = new Date(p.data_referencia + 'T12:00:00');
            const mesChave = `${dataRef.getFullYear()}-${dataRef.getMonth() + 1}`;

            item.producao += Number(p.quantidade) || 0;
            item.soma_fator += fator;
            item.soma_abono += (1.0 - fator);

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

        for (const item of mapa.values()) {
            item.media_final = item.qtd_assert > 0 ? item.soma_notas_bruta / item.qtd_assert : null;

            if (this.state.isMacro) {
                let somaMedias = 0;
                let somaMetas = 0;
                let qtdMeses = 0;

                Object.keys(item.meses).forEach(mKey => {
                    const m = item.meses[mKey];
                    const [ano, mes] = mKey.split('-');
                    const metaObj = this.state.dadosMetas.find(mt => String(mt.usuario_id) === String(item.uid) && mt.mes == mes && mt.ano == ano);
                    const metaBase = metaObj ? (metaObj.meta_producao || 100) : 100;

                    if (metaObj && metaObj.meta_assertividade) item.meta_assert = metaObj.meta_assertividade;

                    if (m.dias > 0) {
                        somaMedias += (m.prod / m.dias);
                        somaMetas += metaBase;
                        qtdMeses++;
                    }
                });

                item.velocidade_acumulada = qtdMeses > 0 ? Math.round(somaMedias / qtdMeses) : 0;
                item.meta_velocidade_media = qtdMeses > 0 ? Math.round(somaMetas / qtdMeses) : 100;
            } else {
                item.velocidade_acumulada = item.soma_fator > 0 ? Math.round(item.producao / item.soma_fator) : 0;

                // Mapeamento correto da Meta em visão Micro (Pega o mês do início do filtro)
                const d1 = new Date(this.state.range.inicio + 'T12:00:00');
                const mesRef = d1.getMonth() + 1;
                const anoRef = d1.getFullYear();

                // Busca Meta na tabela `metas`
                const metaObj = this.state.dadosMetas.find(mt => String(mt.usuario_id) === String(item.uid) && mt.mes == mesRef && mt.ano == anoRef);

                // [LOGIC] Meta Diária (Velocidade Esperada)
                // Se não houver meta definida, usa 100 como fallback padrão
                const rawMeta = metaObj ? (metaObj.meta_producao || metaObj.meta_prod) : null;
                item.meta_velocidade_media = rawMeta ? Number(rawMeta) : 100;

                if (metaObj && (metaObj.meta_assertividade || metaObj.meta_assert)) {
                    item.meta_assert = Number(metaObj.meta_assertividade || metaObj.meta_assert);
                } else {
                    item.meta_assert = 97; // Default 97%
                }
            }

            // Pega contrato do usuário
            const uInfo = this.state.mapaUsuarios[item.uid];
            const contratoUser = uInfo ? (uInfo.contrato || 'TERCEIROS').toUpperCase() : 'TERCEIROS';
            const diastUteisUser = getDU(contratoUser, item.nome);

            // [LOGIC] Dias Trabalhados (Disponíveis para Meta)
            // Fórmula: Dias Úteis do Período - Dias Abonados (Fator < 1)
            const diasUteisLiquidos = Math.max(0, diastUteisUser - item.soma_abono);



            // [LOGIC] Meta Total do Período = Meta Diária * Dias Trabalhados
            item.meta_total_periodo = Math.round(item.meta_velocidade_media * diasUteisLiquidos);
            item.meta_total_periodo = Math.round(item.meta_velocidade_media * diasUteisLiquidos);
            item.dias_uteis_liquidos = diasUteisLiquidos;
            item.dias_uteis_brutos = diastUteisUser; // [FIX] Salva o dia útil cheio (sem desconto) para KPI Global

            // Debug (remove in prod if needed)
            // console.log(`[MA] User ${item.nome}: Prod=${item.producao}, MetaDia=${item.meta_velocidade_media}, DiasUteis=${diastUteisUser}, Abono=${item.soma_abono}, MetaTotal=${item.meta_total_periodo}`);
        }

        this.state.listaTabela = Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    },

    iniciarItemMapa: function (mapa, chave, uid) {
        const u = this.state.mapaUsuarios[uid];
        mapa.set(chave, {
            uid: uid, nome: u ? u.nome : `ID: ${uid}`,
            producao: 0, soma_fator: 0, soma_abono: 0,
            qtd_assert: 0, soma_notas_bruta: 0, media_final: null,
            meses: {}, velocidade_acumulada: 0, meta_velocidade_media: 100,
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
            this.atualizarCardsKPI({
                prod: { real: item.producao, meta: item.meta_total_periodo },
                assert: { real: item.media_final || 0, meta: item.meta_assert },
                capacidade: { diasReal: item.soma_fator, diasTotal: item.dias_uteis_liquidos },
                velocidade: { real: item.velocidade_acumulada, meta: item.meta_velocidade_media }
            });
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
                        <td class="px-2 py-3 text-center text-slate-700 font-medium bg-slate-50">${row.soma_fator}</td>
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
        let totalProd = 0, totalMeta = 0, somaMediasEquipe = 0, somaMetasEquipe = 0, countUsers = 0;
        let totalDocs = 0, somaAssertGlobal = 0;
        let maxFator = 0; // [FIX] Agora pegamos o MÁXIMO de dias trabalhados por alguém da equipe
        let diasUteisCalendario = 0; // [FIX] Pegamos dias úteis do calendário (do primeiro user válido)
        let managerMeta = 0;
        const loggedInUid = window.MinhaArea?.usuario?.id;

        this.state.listaTabela.forEach(i => {
            // [FIX] Sempre somar produção, inclusive de gestores
            totalProd += i.producao;

            // [FIX] Usar ehLiderancaReal para ignorar Auditoras no cálculo da Meta Global
            if (this.ehLiderancaReal(i.uid)) {
                // Se for o gestor logado, sua meta é prioritária. Senão, pegamos a maior encontrada
                if (String(i.uid) === String(loggedInUid)) {
                    managerMeta = i.meta_total_periodo;
                } else if (i.meta_total_periodo > managerMeta) {
                    managerMeta = i.meta_total_periodo;
                }
                return; // Managers don't contribute to Team Capacity/Average calculation logic below
            }
            totalMeta += i.meta_total_periodo; // Soma das metas individuais (fallback)
            totalMeta += i.meta_total_periodo; // Soma das metas individuais (fallback)
            // totalFator += i.soma_fator; // Removido soma
            maxFator = Math.max(maxFator, i.soma_fator); // [FIX] Pega o maior valor de dias trab. da equipe
            if (i.dias_uteis_brutos > diasUteisCalendario) diasUteisCalendario = i.dias_uteis_brutos; // Pega o maior calendário encontrado

            if (i.producao > 0) {
                somaMediasEquipe += i.velocidade_acumulada;
                somaMetasEquipe += i.meta_velocidade_media;
                countUsers++;
            }
            if (i.qtd_assert > 0) {
                somaAssertGlobal += i.soma_notas_bruta;
                totalDocs += i.qtd_assert;
            }
        });

        // Headcount Configurado ou Real (countUsers)
        // [FIX] Por padrão, usa o countUsers real da tabela. Só usa HC fixo se tiver config explícita E maior que 0.
        // Isso evita que a capacidade "Meta" (diasTotal) fique inflada para 17 quando só tem 5 pessoas na lista.
        let hcFinal = (this.state.headcountConfig && this.state.headcountConfig > 0) ? this.state.headcountConfig : countUsers;

        // Se houver meta de gestão definida, ela PREVALECE e é multiplicada pelo HC
        // Mas se a metaIndependente (calculada dos assistentes) for mais fidedigna, poderíamos usar.
        // A regra diz: Meta Global = Meta Gestor * HC.
        if (managerMeta > 0) {
            totalMeta = managerMeta * hcFinal;
        }




        const realUserCount = countUsers;

        // Cálculo de Dias Médios do Período (para Velocidade Diária)
        // [FIX] Usar ehLiderancaReal para garantir que pegamos os dias da Gestora (Patrícia) e não de uma Auditora (Keila)
        const managerItemForDays = this.state.listaTabela.find(i => String(i.uid) === String(loggedInUid) && this.ehLiderancaReal(i.uid)) || this.state.listaTabela.find(i => this.ehLiderancaReal(i.uid));
        const diasPeriodo = managerItemForDays ? (managerItemForDays.dias_uteis_liquidos || 1) : (diasUteisCalendario || 1);

        this.atualizarCardsKPI({
            prod: { real: totalProd, meta: totalMeta },
            assert: { real: totalDocs > 0 ? (somaAssertGlobal / totalDocs) : 0, meta: 97 },
            capacidade: { diasReal: maxFator, diasTotal: diasUteisCalendario }, // [FIX] Exibe Max Real / Calendário
            velocidade: {
                real: Math.round(totalProd / (diasPeriodo > 0 ? diasPeriodo : 1)), // Usa diasPeriodo calculado antes
                meta: managerMeta > 0
                    ? Math.round((managerMeta / diasPeriodo) * (realUserCount > 0 ? realUserCount : hcFinal)) // Ajuste para meta diária correta
                    : (realUserCount > 0 ? Math.round(somaMetasEquipe / realUserCount) : 100)
            }
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
            this.els.tabelaHeader.innerHTML = `
                <tr class="bg-slate-100 border-b border-slate-300">
                    <td colspan="8" class="px-4 py-2">
                        <button onclick="MinhaArea.mudarUsuarioAlvo('')" class="text-sm text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                            ⬅ Voltar para Visão de Equipe
                        </button>
                    </td>
                </tr>
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

        // Agrupa produção diária de todos os assistentes
        this.state.dadosProducao.forEach(d => {
            if (this.ehGestao(d.usuario_id)) return;

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

        const configHC = this.state.headcountConfig;
        const HC = (configHC && configHC > 0) ? configHC : 17; // Default 17

        const metaIndiv = item.meta_velocidade_media || 0;

        // [LOGIC] Meta Equipe Periodo = Meta Diária Gestor * HC * Dias Úteis Gestor
        const metaEquipePeriodo = metaIndiv * HC * (item.dias_uteis_liquidos || 0);

        this.atualizarCardsKPI({
            prod: { real: totalProd, meta: metaEquipePeriodo },
            assert: { real: totalDocs > 0 ? (somaAssertGlobal / totalDocs) : 0, meta: item.meta_assert || 97 },
            capacidade: { diasReal: maxFator, diasTotal: diasUteisCalendario > 0 ? diasUteisCalendario : (item.dias_uteis_brutos || 21) },
            velocidade: { real: Math.round(totalProd / (HC * (item.dias_uteis_liquidos || 1))), meta: metaIndiv }
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
        const setVal = (id, val, isPct) => {
            const el = document.getElementById(id);
            if (el) {
                const safeVal = (typeof val === 'number' && !isNaN(val)) ? val : 0;
                el.textContent = isPct ? safeVal.toFixed(2) + '%' : Math.round(safeVal).toLocaleString('pt-BR');
            }
        };
        const setBar = (idBar, idPct, real, meta) => {
            const bar = document.getElementById(idBar);
            const pctText = document.getElementById(idPct);
            const r = (typeof real === 'number' && !isNaN(real)) ? real : 0;
            const m = (typeof meta === 'number' && !isNaN(meta)) ? meta : 0;
            const calculo = m > 0 ? Math.round((r / m) * 100) : 0;
            if (bar) bar.style.width = Math.min(calculo, 100) + '%';
            if (pctText) pctText.textContent = calculo + '%';
        };

        setVal('kpi-prod-real', kpi.prod.real);
        setVal('kpi-prod-meta', kpi.prod.meta);
        setBar('bar-prod', 'pct-prod', kpi.prod.real, kpi.prod.meta);

        setVal('kpi-assert-real', kpi.assert.real, true);
        setVal('kpi-assert-meta', kpi.assert.meta, true);
        setBar('bar-assert', 'pct-assert', kpi.assert.real, kpi.assert.meta);

        setVal('kpi-dias-trab', kpi.capacidade.diasReal);
        setVal('kpi-dias-uteis', kpi.capacidade.diasTotal);
        setBar('bar-dias', 'pct-dias', kpi.capacidade.diasReal, kpi.capacidade.diasTotal);

        setVal('kpi-dia-media', kpi.velocidade.real);
        setVal('kpi-dia-meta', kpi.velocidade.meta);
        setBar('bar-dia', 'pct-dia', kpi.velocidade.real, kpi.velocidade.meta);
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

        feriados.push(addDias(dataPascoa, -47)); // Carnaval (Terça)
        feriados.push(addDias(dataPascoa, -2));  // Sexta-feira Santa
        feriados.push(addDias(dataPascoa, 60));  // Corpus Christi

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

    ehGestao: function (uid) {
        const u = this.state.mapaUsuarios[uid];
        if (!u) return false;

        const p = (u.perfil || '').toUpperCase();
        const f = (u.funcao || '').toUpperCase();
        const id = parseInt(u.id);

        // Verifica Perfil, Função e IDs Administrativos (mesma lógica do main.js)
        return ['ADMIN', 'GESTOR', 'AUDITOR', 'COORDENADOR', 'LIDER'].some(t => p.includes(t) || f.includes(t)) || id === 1 || id === 1000;
    },

    ehLiderancaReal: function (uid) {
        const u = this.state.mapaUsuarios[uid];
        if (!u) return false;
        const p = (u.perfil || '').toUpperCase();
        const f = (u.funcao || '').toUpperCase();
        // Exclui Auditores explicitamente da definição de "Liderança" para fins de Meta Global
        const isAuditor = f.includes('AUDITOR') || p.includes('AUDITOR');
        return !isAuditor && (['ADMIN', 'GESTOR', 'COORDENADOR', 'LIDER'].some(t => p.includes(t) || f.includes(t)) || parseInt(u.id) === 1 || parseInt(u.id) === 1000);
    },

    renderLoading: function () { if (this.els.tabela) this.els.tabela.innerHTML = `<tr><td colspan="11" class="text-center py-12"><i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i></td></tr>`; },

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
    }
};