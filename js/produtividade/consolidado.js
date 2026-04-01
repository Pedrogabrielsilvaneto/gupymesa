// ARQUIVO: js/produtividade/consolidado.js
// V11 — Audit completo: filtros corrigidos, inativos excluídos, fórmulas revisadas

Produtividade.Consolidado = {
    initialized: false,
    ultimoCache: { key: null, data: null },
    dadosCalculados: null,
    monthToColMap: null,

    // Cache de dados de usuários (ID -> info)
    mapaFuncoes: {},
    mapaAtivo: {},
    mapaContrato: {},

    // Configuração vinda da config_mes (definida pela gestora)
    headcountConfig: 0,
    diasUteisConfig: 0,
    hasManualDU: false,
    configMes: null,

    init: async function () {
        if (!this.initialized) { this.initialized = true; }
        this.carregar();
    },

    getContextKey: function () {
        const datas = Produtividade.getDatasFiltro();
        let t = Produtividade.filtroPeriodo || 'mes';
        if (t === 'semana') t = 'dia';
        return `${t}_${datas.inicio}_${datas.fim}`;
    },

    carregarMapas: async function () {
        if (Object.keys(this.mapaFuncoes).length > 0) return;
        try {
            const data = await Sistema.query('SELECT id, funcao, contrato, ativo FROM usuarios');
            if (data) {
                data.forEach(u => {
                    this.mapaFuncoes[u.id] = (u.funcao || '').toUpperCase();
                    this.mapaAtivo[u.id] = u.ativo;
                    this.mapaContrato[u.id] = (u.contrato || '').toUpperCase();
                });
            }
        } catch (e) { console.error("Erro carregando funções:", e); }
    },

    toggleGroup: function (groupId) {
        const children = document.querySelectorAll(`.child-of-${groupId}`);
        const arrow = document.getElementById(`arrow-${groupId}`);
        if (!children.length) return;

        const isHidden = children[0].classList.contains('hidden');
        children.forEach(el => {
            if (isHidden) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });

        if (arrow) {
            arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
        }
    },


    carregarHeadcountConfig: async function () {
        const datas = Produtividade.getDatasFiltro();
        if (!datas.inicio) return;

        const partes = datas.inicio.split('-');
        const mes = parseInt(partes[1]);
        const ano = parseInt(partes[0]);

        try {
            const data = await Sistema.query(
                'SELECT * FROM config_mes WHERE mes = ? AND ano = ?',
                [mes, ano]
            );

            this.configMes = (data && data.length > 0) ? data[0] : null;
            const config = this.configMes;

            // Resolve Headcount
            const filtroContrato = (Produtividade.Filtros && Produtividade.Filtros.estado)
                ? (Produtividade.Filtros.estado.contrato || 'todos').toUpperCase()
                : 'TODOS';

            this.hasManualDU = false; // Reset

            const hcClt = (config && Number(config.hc_clt) > 0) ? Number(config.hc_clt) : 8;
            const hcTerc = (config && Number(config.hc_terceiros) > 0) ? Number(config.hc_terceiros) : 9;

            if (filtroContrato === 'CLT') {
                this.headcountConfig = hcClt;
            } else if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') {
                this.headcountConfig = hcTerc;
            } else {
                this.headcountConfig = hcClt + hcTerc;
            }

            // Resolve Dias Úteis Configurados
            this.diasUteisConfig = this.getDiasUteisConfig();

        } catch (e) {
            console.error("Erro carregando config_mes:", e);
            this.headcountConfig = 17;
            this.diasUteisConfig = 22; // Fallback genérico
        }
    },

    getDiasUteisConfig: function () {
        const filtroContrato = (Produtividade.Filtros && Produtividade.Filtros.estado) ? (Produtividade.Filtros.estado.contrato || 'todos').toUpperCase() : 'TODOS';
        const config = this.configMes;
        const datas = Produtividade.getDatasFiltro();

        // Função local para contar dias úteis (Seg-Sex)
        const contarSimples = (ini, fim) => {
            if (!ini || !fim) return 22;
            let d = new Date(ini + 'T12:00:00'), end = new Date(fim + 'T12:00:00'), c = 0;
            while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); }
            return c;
        };

        const diasCalendario = contarSimples(datas.inicio, datas.fim);
        if (!config) {
            if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') return diasCalendario;
            return Math.max(0, diasCalendario - 1);
        }

        const vTerc = config.dias_uteis_terceiros || config.dias_uteis || diasCalendario;
        const vClt = config.dias_uteis_clt || (vTerc > 0 ? Math.max(0, vTerc - 1) : 0);

        if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') return vTerc;
        if (filtroContrato === 'CLT') return vClt;

        return vClt; // Padrão Geral agora é CLT (-1 dia)
    },

    contarAssistentesAtivos: function () {
        const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena', 'visitante'];
        const filtros = window.Produtividade.Filtros;

        // Criamos uma lista de "usuários candidatos" para o preFiltrar
        let users = [];
        for (const uid in this.mapaFuncoes) {
            users.push({
                uid: uid,
                usuario_id: uid,
                nome: (window.Produtividade.Geral?.state?.mapaUsuarios[uid]?.nome || 'ID: ' + uid)
            });
        }

        // Filtra apenas ativos e não gestão para o count base
        const assistentesApenas = users.filter(u => {
            const func = (this.mapaFuncoes[u.uid] || '').toLowerCase();
            const ativo = this.mapaAtivo[u.uid];
            const ehGestao = termosExcluidos.some(t => func.includes(t));
            const ehAtivo = (ativo !== false && ativo !== 0 && ativo !== '0');
            return ehAtivo && !ehGestao;
        });

        // Aplica os filtros atuais do HUD (Nome, Função, Contrato)
        const candidatosFiltrados = filtros && typeof filtros.preFiltrar === 'function'
            ? filtros.preFiltrar(assistentesApenas)
            : assistentesApenas;

        return candidatosFiltrados.length;
    },

    carregar: async function (forcar = false) {
        const tbody = document.getElementById('cons-table-body');
        const datas = Produtividade.getDatasFiltro();
        const s = datas.inicio; const e = datas.fim;
        let t = Produtividade.filtroPeriodo || 'mes'; if (t === 'semana') t = 'dia';

        if (tbody) tbody.innerHTML = '<tr><td colspan="15" class="text-center py-10 text-slate-400"><i class="fas fa-circle-notch fa-spin text-2xl text-blue-500"></i></td></tr>';

        try {
            await Promise.all([this.carregarHeadcountConfig(), this.carregarMapas()]);

            const rawData = await Sistema.query(
                `SELECT usuario_id, data_referencia, quantidade, fifo, gradual_total, gradual_parcial, perfil_fc, fator
                 FROM producao
                 WHERE data_referencia >= ? AND data_referencia <= ?`,
                [s, e]
            );

            if (!rawData) throw new Error("Falha ao buscar dados de produção.");

            this.ultimoCache = { key: this.getContextKey(), data: rawData, tipo: t };
            this.processarEExibir(rawData, t, s, e);
        } catch (e) {
            console.error(e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="15" class="text-center py-4 text-rose-500">Erro: ${e.message}</td></tr>`;
        }
    },

    getSemanasDoMes: function (year, month) {
        const weeks = [];
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        let currentDay = firstDay;
        const formatDateLocal = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        while (currentDay <= lastDay) {
            const startOfWeek = new Date(currentDay);
            const dayOfWeek = currentDay.getDay();
            const daysToSaturday = 6 - dayOfWeek;
            let endOfWeek = new Date(currentDay);
            endOfWeek.setDate(currentDay.getDate() + daysToSaturday);
            if (endOfWeek > lastDay) endOfWeek = lastDay;
            weeks.push({ inicio: formatDateLocal(startOfWeek), fim: formatDateLocal(endOfWeek) });
            currentDay = new Date(endOfWeek);
            currentDay.setDate(currentDay.getDate() + 1);
        }
        return weeks;
    },

    processarDados: function (rawData, t, dataInicio, dataFim) {
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let cols = []; let datesMap = {}; this.monthToColMap = {};

        const dIni = new Date(dataInicio + 'T12:00:00');
        const currentYear = dIni.getFullYear();
        const currentMonth = dIni.getMonth() + 1;

        const formatDateLocal = (d) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        if (t === 'dia') {
            let curr = new Date(dataInicio + 'T12:00:00'); const end = new Date(dataFim + 'T12:00:00'); let idx = 1;
            while (curr <= end) {
                cols.push(String(curr.getDate()).padStart(2, '0'));
                datesMap[idx] = { ini: formatDateLocal(curr), fim: formatDateLocal(curr) };
                curr.setDate(curr.getDate() + 1); idx++;
            }
        } else if (t === 'mes') {
            this.getSemanasDoMes(currentYear, currentMonth).forEach((s, i) => { cols.push(`Sem ${i + 1}`); datesMap[i + 1] = { ini: s.inicio, fim: s.fim }; });
        } else if (t === 'ano') {
            const dFimObj = new Date(dataFim + 'T12:00:00');
            for (let i = dIni.getMonth(); i <= dFimObj.getMonth(); i++) {
                cols.push(mesesNomes[i]); this.monthToColMap[i + 1] = cols.length;
                datesMap[cols.length] = { ini: `${currentYear}-${String(i + 1).padStart(2, '0')}-01`, fim: formatDateLocal(new Date(currentYear, i + 1, 0)) };
            }
        }

        const numCols = cols.length;
        let st = {};
        for (let i = 1; i <= numCols; i++) st[i] = { users: new Set(), dias: new Set(), diasFator: 0, qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0 };
        st[99] = { users: new Set(), dias: new Set(), diasFator: 0, qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0 };

        if (rawData) {
            const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena', 'visitante'];

            rawData.forEach(r => {
                // [NOTE] Filtro de contrato, nome e função já aplicados no preFiltrar (processarEExibir)

                // Exclui gestão (Seguindo a regra do Card Geral)
                const funcao = (this.mapaFuncoes[r.usuario_id] || '').toLowerCase();
                const isManager = termosExcluidos.some(t => funcao.includes(t));


                // Exclui inativos
                const ativo = this.mapaAtivo[r.usuario_id];
                const isInativo = (ativo === false || ativo === 0 || ativo === '0');

                let b = -1;
                if (t === 'dia') { for (let k = 1; k <= numCols; k++) if (datesMap[k].ini === r.data_referencia) b = k; }
                else if (t === 'mes') { for (let k = 1; k <= numCols; k++) if (r.data_referencia >= datesMap[k].ini && r.data_referencia <= datesMap[k].fim) b = k; }
                else if (t === 'ano') { const mesData = parseInt(r.data_referencia.split('-')[1]); if (this.monthToColMap[mesData]) b = this.monthToColMap[mesData]; }

                if (b >= 1 && b <= numCols) {
                    const rQty = Number(r.quantidade) || 0;
                    const rFifo = Number(r.fifo) || 0;
                    const rGt = Number(r.gradual_total) || 0;
                    const rGp = Number(r.gradual_parcial) || 0;
                    const rFc = Number(r.perfil_fc) || 0;

                    [b, 99].forEach(k => {
                        // [FIX] rQty já contém (GT + GP + FC). Somamos apenas o FIFO para chegar no total real (257k)
                        st[k].qty += (rQty + rFifo);
                        
                        st[k].fifo += rFifo;
                        st[k].gt += rGt;
                        st[k].gp += rGp;
                        st[k].fc += rFc;

                        // Headcount e dias: só assistentes ativos
                        if (!isManager && !isInativo) {
                            st[k].users.add(r.usuario_id);
                            st[k].dias.add(r.data_referencia);
                            const fatorDb = (r.fator !== undefined && r.fator !== null) ? Number(r.fator) : 1;
                            st[k].diasFator += fatorDb;
                        }
                    });
                }
            });
        }
        return { cols, st, numCols, datesMap };
    },

    processarEExibir: function (rawData, t, s, e) {
        // [FIX] Para a soma de QTY total (257k), precisamos incluir todos os cargos (ignorando filtro de função do HUD)
        const dadosFiltrados = (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.preFiltrar === 'function')
            ? window.Produtividade.Filtros.preFiltrar(rawData, true) 
            : rawData;

        this.dadosCalculados = this.processarDados(dadosFiltrados, t, s, e);
        this.renderizar(this.dadosCalculados);
    },

    renderizar: function ({ cols, st, numCols, datesMap }) {
        const tbody = document.getElementById('cons-table-body');
        const hRow = document.getElementById('cons-table-header');
        if (!tbody || !hRow) return;

        const filtrosEstado = window.Produtividade.Filtros?.estado || {};
        const filtroContratoRaw = (filtrosEstado.contrato || 'todos').toUpperCase();

        // [FIX] CLT/TODOS vs todos case mixed checks
        const temFiltroContrato = (filtroContratoRaw !== 'TODOS');
        const temFiltroIndividual = (filtrosEstado.nome !== '' || (filtrosEstado.funcao && filtrosEstado.funcao.toLowerCase() !== 'todos'));

        const HC_Real = this.contarAssistentesAtivos();
        const HC_Base = this.headcountConfig;

        // [FIX] Se for um filtro individual (Nome/Função), usa o HC Real.
        // Se for filtro macro (Contrato ou Geral), usa o HC Base (Configurado/Fallback) para orçar a meta.
        const HC = temFiltroIndividual ? HC_Real : HC_Base;

        let headerHTML = `<tr class="bg-slate-50 border-b border-slate-200"><th class="px-6 py-4 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 text-left min-w-[250px]"><span class="text-xs font-black text-slate-400 uppercase tracking-widest">Indicador</span></th>`;

        cols.forEach((c) => {
            headerHTML += `<th class="px-2 py-3 text-center border-l border-slate-200 min-w-[80px]"><span class="text-xs font-bold text-slate-600 uppercase">${c}</span></th>`;
        });

        headerHTML += `<th class="px-4 py-3 text-center bg-blue-50 border-l border-blue-100 min-w-[100px]"><span class="text-xs font-black text-blue-600 uppercase">TOTAL</span></th></tr>`;
        hRow.innerHTML = headerHTML;

        const mkRow = (label, icon, color, getter, isCalc = false, isBold = false, rowClass = '', groupId = '', isChild = false) => {
            const bgLabel = rowClass ? rowClass : (isBold ? 'bg-slate-50/50' : '');
            let trClass = `${bgLabel} border-b border-slate-100 hover:bg-slate-50 transition`;
            if (isChild) trClass += ` hidden child-of-${groupId}`;

            let arrow = '';
            if (groupId && !isChild) {
                arrow = `<i class="fas fa-chevron-right text-[10px] text-slate-400 cursor-pointer transition-transform duration-200" id="arrow-${groupId}" onclick="Produtividade.Consolidado.toggleGroup('${groupId}')" style="display: inline-block;"></i>`;
            }

            let tr = `<tr class="${trClass}" ${isChild ? `data-parent="${groupId}"` : ''}>
                <td class="px-6 py-3 sticky left-0 ${(isChild || rowClass) ? (rowClass || 'bg-slate-50/20') : 'bg-white'} z-10 border-r border-slate-200">
                    <div class="flex items-center gap-3">
                        <div class="w-3 flex justify-center">${arrow}</div>
                        <i class="${icon} ${color} text-sm w-4 text-center"></i>
                        <span class="text-xs uppercase ${isBold ? 'font-black' : 'font-medium'} text-slate-600">${label}</span>
                    </div>
                </td>`;

            [...Array(numCols).keys()].map(i => i + 1).concat(99).forEach(idx => {
                const s = st[idx];
                const dMap = datesMap[idx] || null;

                const val = isCalc ? getter(s, HC, idx, dMap) : getter(s);
                let cellHTML = (val !== undefined && !isNaN(val)) ? Math.round(val).toLocaleString('pt-BR') : '-';

                if (cellHTML === '0' || cellHTML === '-') cellHTML = `<span class="text-slate-300">-</span>`;

                tr += `<td class="px-4 py-3 text-center text-xs ${idx === 99 ? 'bg-blue-50/30 font-bold text-blue-800' : 'text-slate-600'}">${cellHTML}</td>`;
            });
            return tr + '</tr>';
        };


        // Função auxiliar para contar dias úteis entre datas para as colunas
        const contarSimples = (ini, fim) => {
            if (!ini || !fim) return 0;
            let d = new Date(ini + 'T12:00:00'), end = new Date(fim + 'T12:00:00'), c = 0;
            while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); }
            return c;
        };

        const filtroContrato = (Produtividade.Filtros && Produtividade.Filtros.estado) ? Produtividade.Filtros.estado.contrato || 'todos' : 'todos';

        // --- Cálculo de Dias Ponderados para Fechar com o Total ---
        let totalCalendarDays = 0;
        const colDuCalculado = {};
        const colDiasTrabalhados = {};
        
        [...Array(numCols).keys()].map(i => i + 1).forEach(idx => {
            const dMap = datesMap[idx] || null;
            const diasCalendar = dMap ? contarSimples(dMap.ini, dMap.fim) : 0;
            totalCalendarDays += diasCalendar;
            colDuCalculado[idx] = diasCalendar;
            colDiasTrabalhados[idx] = st[idx].dias.size;
        });

        // Distribui a diferença de Configurados (Total Configurado - Total Calendário)
        const totalConfigDays = this.diasUteisConfig;
        const diffConfig = totalConfigDays - totalCalendarDays;
        
        if (diffConfig !== 0) {
            let alloc = 0;
            for(let idx = numCols; idx >= 1; idx--) {
                if (diffConfig > 0) {
                    const toAdd = diffConfig - alloc;
                    colDuCalculado[idx] += toAdd;
                    alloc += toAdd;
                } else if (diffConfig < 0) {
                    const neededToSub = Math.abs(diffConfig) - alloc;
                    const canSub = Math.min(neededToSub, colDuCalculado[idx]);
                    colDuCalculado[idx] -= canSub;
                    alloc += canSub;
                }
                if (alloc === Math.abs(diffConfig)) break;
            }
        }
        colDuCalculado[99] = totalConfigDays;

        // Distribui a diferença de Trabalhados
        const totalTrabalhadosBruto = st[99].dias.size;
        const ctrUpper = filtroContrato.toUpperCase();
        const totalTrabalhadosFinal = ((ctrUpper === 'CLT' || ctrUpper === 'TODOS') && totalTrabalhadosBruto > 0)
            ? Math.max(0, totalTrabalhadosBruto - 1) 
            : totalTrabalhadosBruto;
        const diffTrab = totalTrabalhadosFinal - totalTrabalhadosBruto;
        
        if (diffTrab !== 0) {
            let allocTrab = 0;
            for(let idx = numCols; idx >= 1; idx--) {
                if (diffTrab < 0) {
                    const neededToSub = Math.abs(diffTrab) - allocTrab;
                    const canSub = Math.min(neededToSub, colDiasTrabalhados[idx]);
                    colDiasTrabalhados[idx] -= canSub;
                    allocTrab += canSub;
                }
                if (allocTrab === Math.abs(diffTrab)) break;
            }
        }
        colDiasTrabalhados[99] = totalTrabalhadosFinal;

        // === LINHAS DA TABELA ===
        // 1. HC Group
        let rows = mkRow('Total de assistentes (Configurado)', 'fas fa-users-cog', 'text-indigo-400', (s) => HC, false, true, '', 'group-hc', false);
        rows += mkRow('Total de assistentes (Ativos)', 'fas fa-users', 'text-blue-400', (s) => HC_Real, false, false, '', 'group-hc', true);

        // 2. Dias Group (V39 - Agora colapsável)
        rows += mkRow('Dias úteis (Configurado)', 'fas fa-calendar-check', 'text-emerald-500', (s, HC, idx) => colDuCalculado[idx], true, true, '', 'group-dias', false);
        rows += mkRow('Dias úteis trabalhados', 'fas fa-calendar-day', 'text-cyan-500', (s, HC, idx) => colDiasTrabalhados[idx], true, false, '', 'group-dias', true);

        // 3-6. Produção por tipo
        rows += mkRow('Total documentos Fifo', 'fas fa-sort-amount-down', 'text-slate-400', s => s.fifo);
        rows += mkRow('Total documentos Gradual Parcial', 'fas fa-chart-area', 'text-teal-500', s => s.gp);
        rows += mkRow('Total documentos Gradual Total', 'fas fa-chart-line', 'text-emerald-500', s => s.gt);
        rows += mkRow('Total documentos Perfil FC', 'fas fa-id-card', 'text-purple-500', s => s.fc);

        // 7. Total geral de documentos
        rows += mkRow('Total documentos validados', 'fas fa-layer-group', 'text-blue-600', s => s.qty, false, true);

        // [FIX] Meta de Produção (Sincronizada com Dashboard Geral)
        let targetMeta = 700;
        if (ctrUpper === 'TERCEIROS' || ctrUpper === 'PJ') targetMeta = 750;

        rows += mkRow('Meta de produção', 'fas fa-bullseye', 'text-rose-500', (s, HC, idx) => {
            return HC * colDuCalculado[idx] * targetMeta;
        }, true);

        rows += mkRow('% Atingimento da Meta', 'fas fa-percentage', 'text-indigo-600', (s, HC, idx) => {
            const meta = (HC * colDuCalculado[idx] * targetMeta);
            return meta > 0 ? (s.qty / meta) * 100 : 0;
        }, true, true);

        // 8. Média de produção por assistente (período inteiro): total / HC
        rows += mkRow('Média por assistente (período)', 'fas fa-users', 'text-orange-600',
            (s, HC) => (HC > 0) ? s.qty / HC : 0, true);

        // 9. Média diária por assistente (LAST)
        // [FIX] Seguindo a lógica do card produtividade: (Quantidade / (Headcount * Dias Úteis))
        rows += mkRow('Média diária por assistente', 'fas fa-user-tag', 'text-emerald-700', (s, HC, idx) => {
            const divisor = (HC * colDuCalculado[idx]);
            return divisor > 0 ? s.qty / divisor : 0;
        }, true, true, 'bg-emerald-50 border-emerald-200');

        tbody.innerHTML = rows;
        const footerEl = document.getElementById('total-consolidado-footer');
        if (footerEl) footerEl.innerText = HC;
    }
};