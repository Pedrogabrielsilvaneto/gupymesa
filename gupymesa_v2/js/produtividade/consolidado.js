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
            this.headcountConfig = null; // Reset Headcount para forçar recálculo a cada filtro

            if (config) {
                // Checa se há alteração manual baseada no filtro para exibir a linha depois
                if (filtroContrato === 'CLT') {
                    if (config.dias_uteis_clt !== null) this.hasManualDU = true;
                } else if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') {
                    if (config.dias_uteis_terceiros !== null) this.hasManualDU = true;
                } else {
                    if (config.dias_uteis_clt !== null || config.dias_uteis_terceiros !== null || config.dias_uteis !== null) {
                        this.hasManualDU = true;
                    }
                }

                if (filtroContrato === 'CLT' && Number(config.hc_clt) > 0) {
                    this.headcountConfig = Number(config.hc_clt);
                } else if ((filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') && Number(config.hc_terceiros) > 0) {
                    this.headcountConfig = Number(config.hc_terceiros);
                } else if (filtroContrato === 'TODOS' || filtroContrato === '') {
                    const total = Number(config.hc_clt || 0) + Number(config.hc_terceiros || 0);
                    this.headcountConfig = total > 0 ? total : 0;
                }
            }

            // Fallback Headcount
            if (!this.headcountConfig || this.headcountConfig <= 0) {
                if (filtroContrato === 'CLT') this.headcountConfig = 8;
                else if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') this.headcountConfig = 9;
                else this.headcountConfig = 17;
            }

            // Resolve Dias Úteis Configurados
            this.diasUteisConfig = this.getDiasUteisConfig();

        } catch (e) {
            console.error("Erro carregando config_mes:", e);
            this.headcountConfig = 17;
            this.diasUteisConfig = 22; // Fallback genérico
        }
    },

    contarDiasUteis: function (ini, fim, capHoje = false) {
        if (!ini || !fim) return 0;
        let d = new Date(ini + 'T12:00:00'), end = new Date(fim + 'T12:00:00');
        
        if (capHoje) {
            const hoje = new Date();
            hoje.setHours(12, 0, 0, 0);
            if (end > hoje) end = hoje;
        }
        
        if (d > end) return 0;

        let c = 0;
        while (d <= end) { 
            if (d.getDay() !== 0 && d.getDay() !== 6) c++; 
            d.setDate(d.getDate() + 1); 
        }
        return c;
    },

    getDiasUteisConfig: function () {
        const filtroContrato = (Produtividade.Filtros && Produtividade.Filtros.estado) ? (Produtividade.Filtros.estado.contrato || 'todos').toUpperCase() : 'TODOS';
        const config = this.configMes;
        const datas = Produtividade.getDatasFiltro();
        const hoje = new Date().toISOString().split('T')[0];

        // Regra Especial: Se estamos no mês atual, o divisor deve capar em hoje
        const isCurrentRange = (hoje >= datas.inicio && hoje <= datas.fim);
        
        // Se estiver no mês atual, contamos até hoje. Se for mês passado, conta tudo.
        const diasCalendario = this.contarDiasUteis(datas.inicio, datas.fim, true); 
        const diasTotaisDoMes = this.contarDiasUteis(datas.inicio, datas.fim, false); // Para referência do -1 mensal
        
        const hasCustomConfig = config && (Number(config.dias_uteis_clt) > 0 || Number(config.dias_uteis_terceiros) > 0 || Number(config.dias_uteis) > 0);

        let vTerc = diasCalendario;
        // CLT: -1 apenas se o mês já passou ou se o -1 não vai zerar o divisor atual
        let vClt = isCurrentRange ? Math.max(1, diasCalendario) : Math.max(1, diasCalendario - 1);

        if (hasCustomConfig) {
            vTerc = Number(config.dias_uteis_terceiros) || Number(config.dias_uteis) || diasCalendario;
            vClt = Number(config.dias_uteis_clt) || Number(config.dias_uteis) || Math.max(1, vTerc - 1);
        }

        if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') return Math.max(1, vTerc);
        if (filtroContrato === 'CLT') return Math.max(1, vClt);

        return Math.max(1, vClt); 
    },

    contarAssistentesAtivos: function () {
        const termosExcluidos = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];
        let count = 0;
        for (const uid in this.mapaFuncoes) {
            const funcao = (this.mapaFuncoes[uid] || '').toLowerCase();
            const ativo = this.mapaAtivo[uid];
            if (ativo === false || ativo === 0 || ativo === '0') continue;
            if (termosExcluidos.some(t => funcao.includes(t))) continue;
            count++;
        }
        return count || 17;
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
        while (currentDay <= lastDay) {
            const startOfWeek = new Date(currentDay);
            const dayOfWeek = currentDay.getDay();
            const daysToSaturday = 6 - dayOfWeek;
            let endOfWeek = new Date(currentDay);
            endOfWeek.setDate(currentDay.getDate() + daysToSaturday);
            if (endOfWeek > lastDay) endOfWeek = lastDay;
            weeks.push({ inicio: startOfWeek.toISOString().split('T')[0], fim: endOfWeek.toISOString().split('T')[0] });
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

        if (t === 'dia') {
            let curr = new Date(dataInicio + 'T12:00:00'); const end = new Date(dataFim + 'T12:00:00'); let idx = 1;
            while (curr <= end) {
                cols.push(String(curr.getDate()).padStart(2, '0'));
                datesMap[idx] = { ini: curr.toISOString().split('T')[0], fim: curr.toISOString().split('T')[0] };
                curr.setDate(curr.getDate() + 1); idx++;
            }
        } else if (t === 'mes') {
            this.getSemanasDoMes(currentYear, currentMonth).forEach((s, i) => { cols.push(`Sem ${i + 1}`); datesMap[i + 1] = { ini: s.inicio, fim: s.fim }; });
        } else if (t === 'ano') {
            const dFimObj = new Date(dataFim + 'T12:00:00');
            for (let i = dIni.getMonth(); i <= dFimObj.getMonth(); i++) {
                cols.push(mesesNomes[i]); this.monthToColMap[i + 1] = cols.length;
                datesMap[cols.length] = { ini: `${currentYear}-${String(i + 1).padStart(2, '0')}-01`, fim: `${currentYear}-${String(i + 1).padStart(2, '0')}-${new Date(currentYear, i + 1, 0).getDate()}` };
            }
        }

        const numCols = cols.length;
        let st = {};
        for (let i = 1; i <= numCols; i++) {
            st[i] = { users: new Set(), dias: new Set(), diasFator: 0, qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0 };
            // [FIX] Calcula dias úteis já trabalhados (capado em hoje) para a coluna
            st[i].diasUteis = this.contarDiasUteis(datesMap[i].ini, datesMap[i].fim, true);
        }
        // TOTAL (99) usa o valor configurado capado em hoje (definido em getDiasUteisConfig)
        st[99] = { users: new Set(), dias: new Set(), diasFator: 0, qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0, diasUteis: this.diasUteisConfig };

        if (rawData) {
            // Filtro local de Contrato e Função (Consolidado tem os mapas cacheados da DB inteira)
            const filtroContrato = (Produtividade.Filtros && Produtividade.Filtros.estado)
                ? (Produtividade.Filtros.estado.contrato || 'todos').toUpperCase()
                : 'TODOS';
            const filtroFuncao = (Produtividade.Filtros && Produtividade.Filtros.estado)
                ? (Produtividade.Filtros.estado.funcao || 'todos').toUpperCase()
                : 'TODOS';

            rawData.forEach(r => {
                const uid = String(r.usuario_id);
                const contrato = this.mapaContrato[uid] || '';
                const funcao = this.mapaFuncoes[uid] || '';

                // Filtra por contrato
                if (filtroContrato !== 'TODOS') {
                    if (filtroContrato === 'CLT' && contrato !== 'CLT') return;
                    if ((filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') && !contrato.includes('PJ') && !contrato.includes('TERCEIRO')) return;
                }

                // Filtra por Função HUD
                if (filtroFuncao !== 'TODOS' && funcao !== filtroFuncao) {
                    return; // Skip if it doesn't match the selected HUD combo
                }

                // Exclui gestão estrita (AUDITORA, GESTORA)
                const isManager = ['AUDITORA', 'GESTORA'].includes(funcao);

                // Exclui inativos
                const ativo = this.mapaAtivo[uid];
                const isInativo = (ativo === false || ativo === 0 || ativo === '0');

                let b = -1;
                if (t === 'dia') { for (let k = 1; k <= numCols; k++) if (datesMap[k].ini === r.data_referencia) b = k; }
                else if (t === 'mes') { for (let k = 1; k <= numCols; k++) if (r.data_referencia >= datesMap[k].ini && r.data_referencia <= datesMap[k].fim) b = k; }
                else if (t === 'ano') { const mesData = parseInt(r.data_referencia.split('-')[1]); if (this.monthToColMap[mesData]) b = this.monthToColMap[mesData]; }

                if (b >= 1 && b <= numCols) {
                    [b, 99].forEach(k => {
                        // Produção: soma SEMPRE (inclusive gestão, porque elas produziram)
                        st[k].qty += Number(r.quantidade) || 0;
                        st[k].fifo += Number(r.fifo) || 0;
                        st[k].gt += Number(r.gradual_total) || 0;
                        st[k].gp += Number(r.gradual_parcial) || 0;
                        st[k].fc += Number(r.perfil_fc) || 0;

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
        return { cols, st, numCols };
    },

    processarEExibir: function (rawData, t, s, e) {
        // [FIX] Consolidado performs its own local mapping for all HUD filters, ignoring `preFiltrar`
        this.dadosCalculados = this.processarDados(rawData, t, s, e);
        this.renderizar(this.dadosCalculados);
    },

    renderizar: function ({ cols, st, numCols }) {
        const tbody = document.getElementById('cons-table-body');
        const hRow = document.getElementById('cons-table-header');
        if (!tbody || !hRow) return;

        const HC = this.headcountConfig;

        let headerHTML = `<tr class="bg-slate-50 border-b border-slate-200"><th class="px-6 py-4 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 text-left min-w-[250px]"><span class="text-xs font-black text-slate-400 uppercase tracking-widest">Indicador</span></th>`;

        cols.forEach((c) => {
            headerHTML += `<th class="px-2 py-3 text-center border-l border-slate-200 min-w-[80px]"><span class="text-xs font-bold text-slate-600 uppercase">${c}</span></th>`;
        });

        headerHTML += `<th class="px-4 py-3 text-center bg-blue-50 border-l border-blue-100 min-w-[100px]"><span class="text-xs font-black text-blue-600 uppercase">TOTAL</span></th></tr>`;
        hRow.innerHTML = headerHTML;

        const mkRow = (label, icon, color, getter, isCalc = false, isBold = false, rowClass = '', rowId = '') => {
            const bgLabel = rowClass ? rowClass : (isBold ? 'bg-slate-50/50' : '');
            const idAttr = rowId ? `id="${rowId}"` : '';
            let tr = `<tr ${idAttr} class="${bgLabel} border-b border-slate-100 hover:bg-slate-50 transition"><td class="px-6 py-3 sticky left-0 ${rowClass && !rowClass.includes('hidden') ? rowClass : 'bg-white'} z-10 border-r border-slate-200"><div class="flex items-center gap-3"><i class="${icon} ${color} text-sm w-4 text-center"></i><span class="text-xs uppercase ${isBold ? 'font-black' : 'font-medium'} text-slate-600">${label}</span></div></td>`;

            [...Array(numCols).keys()].map(i => i + 1).concat(99).forEach(i => {
                const s = st[i];

                const val = isCalc ? getter(s, HC) : getter(s);
                let cellHTML = (val !== undefined && !isNaN(val)) ? Math.round(val).toLocaleString('pt-BR') : '-';

                if (cellHTML === '0' || cellHTML === '-') cellHTML = `<span class="text-slate-300">-</span>`;

                tr += `<td class="px-4 py-3 text-center text-xs ${i === 99 ? 'bg-blue-50/30 font-bold text-blue-800' : 'text-slate-600'}">${cellHTML}</td>`;
            });
            return tr + '</tr>';
        };

        // === LINHAS DA TABELA ===
        // 1. HC: Definido pela gestora
        let rows = mkRow('Total de assistentes', 'fas fa-users-cog', 'text-indigo-400', (s, HC) => HC, true);

        // 2. Dias úteis trabalhados: dias únicos com produção (não soma de fator) (Oculto por Padrão)
        rows += mkRow('Dias úteis trabalhados', 'fas fa-calendar-day', 'text-cyan-500', s => s.dias.size, false, false, 'hidden hidden-row-dias bg-white', 'linha-dias-uteis-trab');

        // 2.1 Dias úteis configurados (V38 - Sempre Mostrar para transparência)
        const toggleBtnHtml = `<span class="ml-2 text-[10px] text-blue-500 cursor-pointer font-bold select-none hover:text-blue-700 hover:underline" onclick="document.getElementById('linha-dias-uteis-trab').classList.toggle('hidden')">(Ver Prod / Dia)</span>`;
        rows += mkRow(`Dias úteis (Período) ${toggleBtnHtml}`, 'fas fa-calendar-check', 'text-emerald-500', (s, HC) => s.diasUteis, true, false, 'bg-emerald-50/30');

        // 3-6. Produção por tipo
        rows += mkRow('Total documentos Fifo', 'fas fa-sort-amount-down', 'text-slate-400', s => s.fifo);
        rows += mkRow('Total documentos Gradual Parcial', 'fas fa-chart-area', 'text-teal-500', s => s.gp);
        rows += mkRow('Total documentos Gradual Total', 'fas fa-chart-line', 'text-emerald-500', s => s.gt);
        rows += mkRow('Total documentos Perfil FC', 'fas fa-id-card', 'text-purple-500', s => s.fc);

        // 7. Total geral de documentos
        rows += mkRow('Total documentos validados', 'fas fa-layer-group', 'text-emerald-700', s => s.qty, false, true, 'bg-emerald-100/60 border-emerald-200');

        // 8. Média de produção por dia útil trabalhado: total / dias configurado ou calendário
        rows += mkRow('Média diária (por dia útil)', 'fas fa-calendar-check', 'text-amber-600',
            (s, HC) => (s.diasUteis > 0) ? s.qty / s.diasUteis : 0, true);

        // 9. Média de produção por assistente (período inteiro): total / HC
        rows += mkRow('Média por assistente (período)', 'fas fa-users', 'text-orange-600',
            (s, HC) => (HC > 0) ? s.qty / HC : 0, true);

        // 10. Média diária por assistente: total / dias / HC
        rows += mkRow('Média diária por assistente', 'fas fa-user-tag', 'text-emerald-700',
            (s, HC) => (s.diasUteis > 0 && HC > 0) ? s.qty / s.diasUteis / HC : 0, true, true, 'bg-emerald-100/60 border-emerald-200');

        tbody.innerHTML = rows;
        const footerEl = document.getElementById('total-consolidado-footer');
        if (footerEl) footerEl.innerText = HC;
    }
};