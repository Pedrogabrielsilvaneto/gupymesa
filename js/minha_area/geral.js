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

        const uidAlvo = MinhaArea.getUsuarioAlvo();
        // Se uidAlvo for 'EQUIPE', tratamos como null para cair na visão da Grade
        const alvoReal = (uidAlvo === 'EQUIPE') ? null : uidAlvo;
        this.renderLoading();

        try {
            await this.buscarUsuarios();

            await Promise.all([
                this.buscarProducao(filtro, alvoReal),
                this.buscarAssertividadeDiariaSQL(filtro, alvoReal),
                this.buscarMetas(filtro, alvoReal)
            ]);

            await this.processarDadosUnificados();

            if (alvoReal) {
                this.renderizarDiario(alvoReal);
            } else {
                this.calcularKpisGlobal();
                this.renderizarGradeEquipe();
            }

        } catch (error) {
            console.error("Erro MA Geral:", error);
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

        if (uid) {
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

        if (uid) {
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

        if (uid) {
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
        const getDU = (contrato) => {
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
                const metaObj = this.state.dadosMetas[0];
                item.meta_velocidade_media = metaObj ? (metaObj.meta_producao || 100) : 100;
            }

            // Pega contrato do usuário
            const uInfo = this.state.mapaUsuarios[item.uid];
            const contratoUser = uInfo ? (uInfo.contrato || 'TERCEIROS').toUpperCase() : 'TERCEIROS';
            const diastUteisUser = getDU(contratoUser);

            const diasUteisLiquidos = Math.max(0, diastUteisUser - item.soma_abono);
            item.meta_total_periodo = Math.round(item.meta_velocidade_media * diasUteisLiquidos);
            item.dias_uteis_liquidos = diasUteisLiquidos;
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
            meta_total_periodo: 0, dias_uteis_liquidos: 0, meta_assert: 97
        });
    },

    renderizarDiario: function (uid) {
        // Remove trava: Gestor pode ver seu diário individual se selecionado
        // if (this.ehGestao(uid)) { this.renderizarDiarioGestor(uid); return; }

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

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                    <td class="px-3 py-2 font-bold text-slate-700">${new Date(d.data_referencia + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td class="px-2 py-2 text-center text-slate-500">${fator.toFixed(2)}</td>
                    <td class="px-2 py-2 text-center text-slate-400">${d.fifo || 0}</td>
                    <td class="px-2 py-2 text-center text-slate-400">${d.gradual_total || 0}</td>
                    <td class="px-2 py-2 text-center text-slate-400">${d.gradual_parcial || 0}</td>
                    <td class="px-2 py-2 text-center font-black text-blue-600">${d.quantidade || 0}</td>
                    <td class="px-2 py-2 text-center text-slate-500">${metaDia}</td>
                    <td class="px-2 py-2 text-center font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${pct}%</td>
                    <td class="px-2 py-2 text-center text-slate-400">${item?.meta_assert || 97}%</td>
                    <td class="px-2 py-2 text-center">${assertHtml}</td>
                    <td class="px-3 py-2 cursor-pointer group" onclick="MinhaArea.Geral.abrirModalObs('${d.usuario_id}', '${d.data_referencia}')">
                        <span class="text-slate-400 group-hover:text-blue-600"><i class="far fa-edit"></i></span>
                    </td>
                </tr>`;
        }).join('');
    },

    renderizarGradeEquipe: function () {
        const headerGrade = `<tr class="divide-x divide-slate-200"><th class="px-3 py-3 text-left bg-slate-50">Assistente</th><th class="px-2 py-3 text-center bg-slate-50">Meta</th><th class="px-2 py-3 text-center bg-blue-50 text-blue-700">Real</th><th class="px-2 py-3 text-center bg-slate-50">Meta Ajust.</th><th class="px-2 py-3 text-center bg-slate-50">%</th><th class="px-2 py-3 text-center bg-slate-50">Assert.</th></tr>`;
        if (this.els.tabelaHeader) this.els.tabelaHeader.innerHTML = headerGrade;

        const listaAssistentes = this.state.listaTabela.filter(row => !this.ehGestao(row.uid));
        if (this.els.totalFooter) this.els.totalFooter.textContent = listaAssistentes.length;

        this.els.tabela.innerHTML = listaAssistentes.map(row => {
            const pct = row.meta_total_periodo > 0 ? Math.round((row.producao / row.meta_total_periodo) * 100) : 0;
            let assertHtml = '<span class="text-slate-300">-</span>';
            if (row.media_final !== null) {
                const cor = row.media_final >= row.meta_assert ? 'text-emerald-600' : 'text-rose-600';
                assertHtml = `<span class="${cor} font-bold">${row.media_final.toFixed(2)}%</span>`;
            }
            return `
                <tr class="hover:bg-blue-50/30 border-b border-slate-200 cursor-pointer" onclick="MinhaArea.mudarUsuarioAlvo('${row.uid}')">
                    <td class="px-3 py-3 font-bold text-slate-700">${row.nome}</td>
                    <td class="px-2 py-3 text-center text-slate-500">${row.meta_velocidade_media}</td>
                    <td class="px-2 py-3 text-center font-black text-blue-700 bg-blue-50/20">${row.producao}</td>
                    <td class="px-2 py-3 text-center text-slate-700">${row.meta_total_periodo}</td>
                    <td class="px-2 py-3 text-center font-bold ${pct >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${pct}%</td>
                    <td class="px-2 py-3 text-center">${assertHtml}</td>
                </tr>`;
        }).join('');
    },

    calcularKpisGlobal: function () {
        let totalProd = 0, totalMeta = 0, somaMediasEquipe = 0, somaMetasEquipe = 0, countUsers = 0;
        let totalDocs = 0, somaAssertGlobal = 0, totalFator = 0, totalUteis = 0;
        let managerMeta = 0;

        this.state.listaTabela.forEach(i => {
            if (this.ehGestao(i.uid)) {
                // Se encontrar um gestor com meta definida, usa ela como Meta Global da Equipe
                if (i.meta_total_periodo > 0) managerMeta = i.meta_total_periodo;
                return;
            }
            totalProd += i.producao;
            totalMeta += i.meta_total_periodo; // Soma das metas individuais (fallback)
            totalFator += i.soma_fator;
            totalUteis += i.dias_uteis_liquidos;

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

        // Se houver meta de gestão definida, ela PREVALECE sobre a soma das metas individuais
        if (managerMeta > 0) {
            totalMeta = managerMeta;
        }

        let kpiDivisor = countUsers;
        let realUserCount = countUsers;

        // Ajuste Headcount Configurado
        if (this.state.headcountConfig && this.state.headcountConfig > 0) {
            kpiDivisor = this.state.headcountConfig;
        }

        // Estima dias úteis totais da equipe (Capacity) baseada na proporção
        const diasUteisTotais = this.state.headcountConfig
            ? (totalUteis / (realUserCount > 0 ? realUserCount : 1) * this.state.headcountConfig)
            : totalUteis;

        this.atualizarCardsKPI({
            prod: { real: totalProd, meta: totalMeta },
            assert: { real: totalDocs > 0 ? (somaAssertGlobal / totalDocs) : 0, meta: 97 },
            capacidade: { diasReal: totalFator, diasTotal: diasUteisTotais },
            velocidade: {
                real: kpiDivisor > 0 ? Math.round(totalProd / kpiDivisor) : 0,
                // Meta por pessoa baseada nos usuários reais, para manter o alvo justo
                meta: realUserCount > 0 ? Math.round(somaMetasEquipe / realUserCount) : 100
            }
        });
    },

    renderizarDiarioGestor: function (uid) {
        // Visão Consolidada da Equipe para o Gestor
        const item = this.state.listaTabela.find(i => String(i.uid) === String(uid));
        if (!item) return;

        // Recalcula totais da equipe (simular calcularKpisGlobal mas focado no contexto do gestor)
        let totalProd = 0;
        let totalDocs = 0, somaAssertGlobal = 0;
        let totalFator = 0, totalUteis = 0;

        // Agrupa produção diária de todos os assistentes
        const diarioAgregado = {};
        let somaMetasAssistentes = 0;

        this.state.listaTabela.forEach(i => {
            if (this.ehGestao(i.uid)) return; // Ignora outros gestores/si mesmo
            totalProd += i.producao;
            somaMetasAssistentes += i.meta_total_periodo;
            totalFator += i.soma_fator;
            totalUteis += i.dias_uteis_liquidos;
            if (i.qtd_assert > 0) {
                somaAssertGlobal += i.soma_notas_bruta;
                totalDocs += i.qtd_assert;
            }
        });

        // Agrega dadosProducao
        this.state.dadosProducao.forEach(d => {
            if (this.ehGestao(d.usuario_id)) return;
            if (!diarioAgregado[d.data_referencia]) {
                diarioAgregado[d.data_referencia] = {
                    data: d.data_referencia,
                    prod: 0,
                    meta: 0, // Dificil calcular meta diária agregada sem iterar users...
                    fator: 0
                };
            }
            diarioAgregado[d.data_referencia].prod += Number(d.quantidade) || 0;
            diarioAgregado[d.data_referencia].fator += (Number(d.fator) || 1); // Soma de dias trabalhados na equipe
        });

        // Meta: Se gestor tem meta definida (>0), usa ela. Senão, soma das metas dos assistentes.
        const metaEquipe = item.meta_total_periodo > 0 ? item.meta_total_periodo : (somaMetasAssistentes || 1);

        // Ajuste Headcount (Gestor View)
        let totalHeadcount = Object.keys(diarioAgregado).length > 0 ? this.state.headcountConfig : null; // Só aplica se tiver dados
        if (this.state.headcountConfig) totalHeadcount = this.state.headcountConfig;

        const countUsersReal = this.state.listaTabela.filter(x => !this.ehGestao(x.uid)).length;
        const denonimador = totalHeadcount || countUsersReal || 1;

        this.atualizarCardsKPI({
            prod: { real: totalProd, meta: metaEquipe },
            assert: { real: totalDocs > 0 ? (somaAssertGlobal / totalDocs) : 0, meta: item.meta_assert || 97 },
            capacidade: { diasReal: totalFator, diasTotal: totalHeadcount ? (totalUteis / (countUsersReal || 1) * totalHeadcount) : totalUteis },
            velocidade: { real: Math.round(totalProd / denonimador), meta: Math.round(metaEquipe / denonimador) }
        });

        if (this.els.totalFooter) this.els.totalFooter.textContent = Object.keys(diarioAgregado).length;

        const listaDias = Object.values(diarioAgregado).sort((a, b) => a.data.localeCompare(b.data));

        if (listaDias.length === 0) {
            this.els.tabela.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-slate-400">Nenhum registro de produção da equipe no período.</td></tr>`;
            return;
        }

        this.els.tabela.innerHTML = listaDias.map(d => {
            // Estimar meta do dia proporcional? 
            // Meta Equipe / Dias Uteis = Meta Dia Média?
            // Vamos simplificar: mostrar apenas produção total
            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs bg-purple-50/10">
                    <td class="px-3 py-2 font-bold text-slate-700">${new Date(d.data + 'T12:00:00').toLocaleDateString('pt-BR')} (Equipe)</td>
                    <td class="px-2 py-2 text-center text-slate-500">-</td>
                    <td class="px-2 py-2 text-center text-slate-400">-</td>
                    <td class="px-2 py-2 text-center text-slate-400">-</td>
                    <td class="px-2 py-2 text-center text-slate-400">-</td>
                    <td class="px-2 py-2 text-center font-black text-blue-600">${d.prod}</td>
                    <td class="px-2 py-2 text-center text-slate-500">-</td>
                    <td class="px-2 py-2 text-center font-bold text-slate-400">-</td>
                    <td class="px-2 py-2 text-center text-slate-400">-</td>
                    <td class="px-2 py-2 text-center">-</td>
                    <td class="px-3 py-2 text-center"></td>
                </tr>`;
        }).join('');
    },

    atualizarCardsKPI: function (kpi) {
        const setVal = (id, val, isPct) => {
            const el = document.getElementById(id);
            if (el) el.textContent = isPct ? val.toFixed(2) + '%' : Math.round(val).toLocaleString('pt-BR');
        };
        const setBar = (idBar, idPct, real, meta) => {
            const bar = document.getElementById(idBar);
            const pctText = document.getElementById(idPct);
            const calculo = meta > 0 ? Math.round((real / meta) * 100) : 0;
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

    contarDiasUteis: function (i, f) {
        let c = 0, cur = new Date(i + 'T12:00:00'), end = new Date(f + 'T12:00:00');
        while (cur <= end) { if (cur.getDay() !== 0 && cur.getDay() !== 6) c++; cur.setDate(cur.getDate() + 1); }
        return c || 1;
    },

    ehGestao: function (uid) {
        const u = this.state.mapaUsuarios[uid];
        if (!u) return false;
        const p = (u.perfil || '').toUpperCase();
        return ['ADMIN', 'GESTOR', 'AUDITOR', 'COORDENADOR', 'LIDER'].some(t => p.includes(t));
    },

    renderLoading: function () { if (this.els.tabela) this.els.tabela.innerHTML = `<tr><td colspan="11" class="text-center py-12"><i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i></td></tr>`; },

    abrirModalObs: function (uid, dataRef) {
        const dadoDia = this.state.dadosProducao.find(d => String(d.usuario_id) === String(uid) && d.data_referencia === dataRef);
        this.state.editando = { uid: uid, data: dataRef };
        const elData = document.getElementById('obs-data-ref');
        const elGestao = document.getElementById('obs-gestao-view');
        const elAssistente = document.getElementById('obs-assistente-text');
        const modal = document.getElementById('modal-obs-assistente');
        if (elData) elData.innerText = new Date(dataRef + 'T12:00:00').toLocaleDateString('pt-BR');
        const justGestao = dadoDia ? dadoDia.justificativa : '';
        const fator = dadoDia ? parseFloat(dadoDia.fator) : 1.0;
        let htmlGestao = '<span class="text-slate-400 italic text-xs">Nenhuma observação da gestão.</span>';
        if (justGestao) {
            htmlGestao = `<span class="text-slate-700 font-medium">${justGestao}</span>`;
            if (fator < 1.0) htmlGestao += `<div class="mt-1"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">Dia Abonado (Fator ${fator})</span></div>`;
        }
        if (elGestao) elGestao.innerHTML = htmlGestao;
        if (elAssistente) elAssistente.value = (dadoDia ? dadoDia.observacao_assistente : '') || '';
        if (modal) { modal.classList.remove('hidden', 'pointer-events-none'); setTimeout(() => modal.classList.add('active'), 10); }
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