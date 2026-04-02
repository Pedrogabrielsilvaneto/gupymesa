// ARQUIVO: js/produtividade/consolidado.js
// V12 — Super Fix: Fuso horário, filtros, cache e totais corrigidos

Produtividade.Consolidado = {
    initialized: false,
    dadosCalculados: null,
    monthToColMap: null,

    // Mapas de dados de usuários (recarregados a cada chamada para evitar cache obsoleto)
    mapaFuncoes: {},
    mapaAtivo: {},
    mapaContrato: {},

    headcountConfig: 0,
    diasUteisConfig: 0,
    configMes: null,

    // ─── Utilitário de Data Local (sem UTC) ────────────────────────────────────
    fmtData: function (d) {
        if (!d) return null;
        const year  = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day   = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    // Alias usado em alguns trechos antigos
    formatDateLocal: function (d) {
        return this.fmtData(d);
    },

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

    // ─── Sempre recarrega os mapas (sem cache obsoleto) ───────────────────────
    carregarMapas: async function () {
        try {
            const data = await Sistema.query('SELECT id, funcao, contrato, ativo FROM usuarios');
            this.mapaFuncoes = {};
            this.mapaAtivo   = {};
            this.mapaContrato = {};
            if (data) {
                data.forEach(u => {
                    this.mapaFuncoes[u.id]  = (u.funcao    || '').toUpperCase();
                    this.mapaAtivo[u.id]    = u.ativo;
                    this.mapaContrato[u.id] = (u.contrato   || '').toUpperCase();
                });
            }
        } catch (e) { console.error('Erro carregando funções:', e); }
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
        if (arrow) arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    },

    // ─── Headcount e Dias Úteis ───────────────────────────────────────────────
    carregarHeadcountConfig: async function () {
        const datas = Produtividade.getDatasFiltro();
        if (!datas.inicio) return;

        const [ano, mes] = datas.inicio.split('-').map(Number);

        try {
            const data = await Sistema.query(
                'SELECT * FROM config_mes WHERE mes = ? AND ano = ?',
                [mes, ano]
            );
            this.configMes = (data && data.length > 0) ? data[0] : null;
        } catch (e) {
            console.error('Erro carregando config_mes:', e);
            this.configMes = null;
        }

        const config = this.configMes;
        const filtroContrato = (Produtividade.Filtros?.estado?.contrato || 'todos').toUpperCase();

        const hcClt  = (config && Number(config.hc_clt)       > 0) ? Number(config.hc_clt)       : 8;
        const hcTerc = (config && Number(config.hc_terceiros)  > 0) ? Number(config.hc_terceiros)  : 9;

        if (filtroContrato === 'CLT') {
            this.headcountConfig = hcClt;
        } else if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') {
            this.headcountConfig = hcTerc;
        } else {
            this.headcountConfig = hcClt + hcTerc;
        }

        this.diasUteisConfig = this.getDiasUteisConfig();
    },

    getDiasUteisConfig: function () {
        const filtroContrato = (Produtividade.Filtros?.estado?.contrato || 'todos').toUpperCase();
        const config = this.configMes;
        const datas  = Produtividade.getDatasFiltro();

        const contarSimples = (ini, fim) => {
            if (!ini || !fim) return 22;
            let d = new Date(ini + 'T12:00:00'), end = new Date(fim + 'T12:00:00'), c = 0;
            while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); }
            return c;
        };

        const diasCalendario = contarSimples(datas.inicio, datas.fim);
        if (!config) {
            return (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ')
                ? diasCalendario
                : Math.max(0, diasCalendario - 1);
        }

        const vTerc = config.dias_uteis_terceiros || config.dias_uteis || diasCalendario;
        const vClt  = config.dias_uteis_clt || Math.max(0, vTerc - 1);

        if (filtroContrato === 'TERCEIROS' || filtroContrato === 'PJ') return vTerc;
        if (filtroContrato === 'CLT') return vClt;
        return vClt;
    },

    contarAssistentesAtivos: function () {
        const GESTAO = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena', 'visitante'];
        const filtros = window.Produtividade.Filtros;

        let users = [];
        for (const uid in this.mapaFuncoes) {
            users.push({
                uid,
                usuario_id: uid,
                nome: (window.Produtividade.Geral?.state?.mapaUsuarios[uid]?.nome || 'ID: ' + uid)
            });
        }

        const assistentes = users.filter(u => {
            const func   = (this.mapaFuncoes[u.uid] || '').toLowerCase();
            const ativo  = this.mapaAtivo[u.uid];
            const gestor = GESTAO.some(t => func.includes(t));
            const ehAtivo = (ativo !== false && ativo !== 0 && ativo !== '0');
            return ehAtivo && !gestor;
        });

        return (filtros && typeof filtros.preFiltrar === 'function')
            ? filtros.preFiltrar(assistentes).length
            : assistentes.length;
    },

    // ─── Carregamento principal ───────────────────────────────────────────────
    carregar: async function (forcar = false) {
        const tbody = document.getElementById('cons-table-body');
        const datas = Produtividade.getDatasFiltro();
        const s = datas.inicio;
        const e = datas.fim;
        let t = Produtividade.filtroPeriodo || 'mes';
        if (t === 'semana') t = 'dia';

        if (tbody) tbody.innerHTML = '<tr><td colspan="15" class="text-center py-10 text-slate-400"><i class="fas fa-circle-notch fa-spin text-2xl text-blue-500"></i></td></tr>';

        try {
            // Sempre recarrega mapas e config juntos
            await Promise.all([this.carregarHeadcountConfig(), this.carregarMapas()]);

            // Busca produção do período completo (inclusive dia 31)
            // Ajuste: usar BETWEEN para garantir inclusão completa do último dia
            const rawData = await Sistema.query(
                `SELECT usuario_id, data_referencia, quantidade, fifo, gradual_total, gradual_parcial, perfil_fc, fator
                 FROM producao
                 WHERE data_referencia BETWEEN ? AND ?
                 ORDER BY data_referencia ASC`,
                [s, e]
            );

            console.log('%c[DEBUG CONS] Período consultado:', 'color:purple;font-weight:bold', s, '→', e);
            console.log('%c[DEBUG CONS] rawData rows →', 'color:purple;font-weight:bold', rawData?.length);
            if (rawData && rawData.length) {
                console.log('%c[DEBUG CONS] Primeiro registro →', 'color:purple;font-weight:bold', rawData[0].data_referencia);
                console.log('%c[DEBUG CONS] Último registro →', 'color:purple;font-weight:bold', rawData[rawData.length - 1].data_referencia);
                const somaQty  = rawData.reduce((a, r) => a + (Number(r.quantidade) || 0), 0);
                const somaFifo = rawData.reduce((a, r) => a + (Number(r.fifo)       || 0), 0);
                console.log('%c[DEBUG CONS] TOTAL (qty+fifo):', 'color:red;font-weight:bold', (somaQty + somaFifo).toLocaleString('pt-BR'));
            }

            if (!rawData) throw new Error('Falha ao buscar dados de produção.');

            this.processarEExibir(rawData, t, s, e);
        } catch (err) {
            console.error(err);
            if (tbody) tbody.innerHTML = `<tr><td colspan="15" class="text-center py-4 text-rose-500">Erro: ${err.message}</td></tr>`;
        }
    },

    // ─── Semanas do mês com data local (Segunda a Domingo) ─────────────────────
    getSemanasDoMes: function (year, month) {
        const self = this;
        const weeks = [];
        const firstDay  = new Date(year, month - 1, 1);
        firstDay.setHours(12, 0, 0, 0);
        const lastDay = new Date(year, month, 0);
        lastDay.setHours(12, 0, 0, 0);
        let currentDay = new Date(firstDay);

        // Ajustar para iniciar na segunda-feira
        const dayOfWeek = currentDay.getDay(); // 0=domingo, 1=segunda...
        if (dayOfWeek !== 1) {
            const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // Se domingo, vai para segunda seguinte
            currentDay.setDate(currentDay.getDate() + daysToMonday);
        }

        while (currentDay <= lastDay) {
            const startOfWeek = new Date(currentDay);
            let endOfWeek = new Date(currentDay);
            endOfWeek.setDate(currentDay.getDate() + 6); // Domingo
            endOfWeek.setHours(12, 0, 0, 0);
            if (endOfWeek > lastDay) endOfWeek = new Date(lastDay);
            weeks.push({ inicio: self.fmtData(startOfWeek), fim: self.fmtData(endOfWeek) });
            currentDay = new Date(endOfWeek);
            currentDay.setDate(currentDay.getDate() + 1);
            currentDay.setHours(12, 0, 0, 0);
        }
        return weeks;
    },

    // ─── Filtro de Contrato local (usando mapaContrato do próprio módulo) ─────
    passaFiltroContrato: function (usuarioId) {
        const filtroContrato = (Produtividade.Filtros?.estado?.contrato || 'todos').toUpperCase();
        if (filtroContrato === 'TODOS' || filtroContrato === '') return true;

        const contrato = (this.mapaContrato[usuarioId] || '').toUpperCase();
        if (filtroContrato === 'TERCEIROS') {
            return contrato.includes('PJ') || contrato.includes('TERCEIRO') || contrato.includes('TER');
        }
        return contrato.includes(filtroContrato);
    },

    passaFiltroNome: function (usuarioId) {
        const filtroNome = (Produtividade.Filtros?.estado?.nome || '').toLowerCase().trim();
        if (!filtroNome) return true;
        const u = window.Produtividade.mapaUsuarios?.[usuarioId] || window.Produtividade.Geral?.state?.mapaUsuarios?.[usuarioId] || {};
        const nome = (u.nome || '').toLowerCase();
        return nome.includes(filtroNome) || String(usuarioId).includes(filtroNome);
    },

    // ─── Processar dados ──────────────────────────────────────────────────────
    processarEExibir: function (rawData, t, s, e) {
        this.dadosCalculados = this.processarDados(rawData, t, s, e);
        this.renderizar(this.dadosCalculados);
    },

    processarDados: function (rawData, t, dataInicio, dataFim) {
        const self = this;
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let cols = []; let datesMap = {}; this.monthToColMap = {};

        const dIni = new Date(dataInicio + 'T12:00:00');
        const currentYear  = dIni.getFullYear();
        const currentMonth = dIni.getMonth() + 1;

        // Montar colunas e intervalos de datas
        if (t === 'dia') {
            let curr = new Date(dataInicio + 'T12:00:00');
            const end = new Date(dataFim + 'T12:00:00');
            let idx = 1;
            while (curr <= end) {
                cols.push(String(curr.getDate()).padStart(2, '0'));
                datesMap[idx] = { ini: self.fmtData(curr), fim: self.fmtData(curr) };
                curr.setDate(curr.getDate() + 1);
                idx++;
            }
        } else if (t === 'mes') {
            this.getSemanasDoMes(currentYear, currentMonth).forEach((s, i) => {
                cols.push(`Sem ${i + 1}`);
                datesMap[i + 1] = { ini: s.inicio, fim: s.fim };
            });
        } else if (t === 'ano') {
            const dFimObj = new Date(dataFim + 'T12:00:00');
            for (let i = dIni.getMonth(); i <= dFimObj.getMonth(); i++) {
                cols.push(mesesNomes[i]);
                this.monthToColMap[i + 1] = cols.length;
                const ultimoDia = new Date(currentYear, i + 1, 0);
                ultimoDia.setHours(12, 0, 0, 0);
                datesMap[cols.length] = {
                    ini: `${currentYear}-${String(i + 1).padStart(2, '0')}-01`,
                    fim: self.fmtData(ultimoDia)
                };
            }
        }

        const numCols = cols.length;
        const mkSt = () => ({ users: new Set(), dias: new Set(), diasFator: 0, qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0 });
        let st = {};
        for (let i = 1; i <= numCols; i++) st[i] = mkSt();
        st[99] = mkSt();

        const GESTAO = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena', 'visitante'];

        if (rawData) {
            rawData.forEach(r => {
                // NÃO aplica filtros aqui - soma TODOS os dados (igual aba Geral/Validação)
                // Os filtros de contrato/nome afetam apenas a renderização individual se necessário

                const funcao    = (self.mapaFuncoes[r.usuario_id] || '').toLowerCase();
                const isGestor  = GESTAO.some(g => funcao.includes(g));
                const ativo     = self.mapaAtivo[r.usuario_id];
                const isInativo = (ativo === false || ativo === 0 || ativo === '0');

                // Encontrar coluna correta para este registro
                let b = -1;
                if (t === 'dia') {
                    for (let k = 1; k <= numCols; k++) {
                        if (datesMap[k].ini === r.data_referencia) { b = k; break; }
                    }
                } else if (t === 'mes') {
                    for (let k = 1; k <= numCols; k++) {
                        if (r.data_referencia >= datesMap[k].ini && r.data_referencia <= datesMap[k].fim) { b = k; break; }
                    }
                } else if (t === 'ano') {
                    const mesData = parseInt(r.data_referencia.split('-')[1]);
                    if (self.monthToColMap[mesData]) b = self.monthToColMap[mesData];
                }

                if (b < 1 || b > numCols) return;

                const rQty  = Number(r.quantidade)       || 0;
                const rFifo = Number(r.fifo)             || 0;
                const rGt   = Number(r.gradual_total)    || 0;
                const rGp   = Number(r.gradual_parcial)  || 0;
                const rFc   = Number(r.perfil_fc)        || 0;

                const totalProd = rQty + rFifo;

                // Soma em todas as colunas incluindo TOTAL (99)
                [b, 99].forEach(k => {
                    st[k].qty  += totalProd;
                    st[k].fifo += rFifo;
                    st[k].gt   += rGt;
                    st[k].gp   += rGp;
                    st[k].fc   += rFc;

                    // Headcount e dias: APENAS para assistentes ativos (não gestores)
                    if (!isGestor && !isInativo) {
                        st[k].users.add(r.usuario_id);
                        st[k].dias.add(r.data_referencia);
                        st[k].diasFator += (r.fator !== undefined && r.fator !== null) ? Number(r.fator) : 1;
                    }
                });
            });
        }

        return { cols, st, numCols, datesMap };
    },

    // ─── Renderização ─────────────────────────────────────────────────────────
    renderizar: function ({ cols, st, numCols, datesMap }) {
        const tbody = document.getElementById('cons-table-body');
        const hRow  = document.getElementById('cons-table-header');
        if (!tbody || !hRow) return;

        const filtrosEstado    = window.Produtividade.Filtros?.estado || {};
        const filtroContratoRaw = (filtrosEstado.contrato || 'todos').toUpperCase();
        const ctrUpper          = filtroContratoRaw;

        const temFiltroIndividual = (
            (filtrosEstado.nome && filtrosEstado.nome !== '') ||
            (filtrosEstado.funcao && filtrosEstado.funcao.toLowerCase() !== 'todos')
        );

        const HC_Real = this.contarAssistentesAtivos();
        const HC_Base = this.headcountConfig;
        const HC      = temFiltroIndividual ? HC_Real : HC_Base;

        // Header da tabela
        let headerHTML = `<tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-6 py-4 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 text-left min-w-[250px]">
                <span class="text-xs font-black text-slate-400 uppercase tracking-widest">Indicador</span>
            </th>`;
        cols.forEach(c => {
            headerHTML += `<th class="px-2 py-3 text-center border-l border-slate-200 min-w-[80px]"><span class="text-xs font-bold text-slate-600 uppercase">${c}</span></th>`;
        });
        headerHTML += `<th class="px-4 py-3 text-center bg-blue-50 border-l border-blue-100 min-w-[100px]"><span class="text-xs font-black text-blue-600 uppercase">TOTAL</span></th></tr>`;
        hRow.innerHTML = headerHTML;

        // Construtor de linha
        const mkRow = (label, icon, color, getter, isCalc = false, isBold = false, rowClass = '', groupId = '', isChild = false) => {
            const bgLabel = rowClass ? rowClass : (isBold ? 'bg-slate-50/50' : '');
            let trClass = `${bgLabel} border-b border-slate-100 hover:bg-slate-50 transition`;
            if (isChild) trClass += ` hidden child-of-${groupId}`;

            let arrow = '';
            if (groupId && !isChild) {
                arrow = `<i class="fas fa-chevron-right text-[10px] text-slate-400 cursor-pointer transition-transform duration-200" id="arrow-${groupId}" onclick="Produtividade.Consolidado.toggleGroup('${groupId}')" style="display:inline-block;"></i>`;
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
                const s    = st[idx];
                const dMap = datesMap[idx] || null;
                const val  = isCalc ? getter(s, HC, idx, dMap) : getter(s);
                let cellHTML = (val !== undefined && val !== null && !isNaN(val))
                    ? Math.round(val).toLocaleString('pt-BR') : '-';
                if (cellHTML === '0' || cellHTML === '-') cellHTML = `<span class="text-slate-300">-</span>`;
                tr += `<td class="px-4 py-3 text-center text-xs ${idx === 99 ? 'bg-blue-50/30 font-bold text-blue-800' : 'text-slate-600'}">${cellHTML}</td>`;
            });
            return tr + '</tr>';
        };

        // Contagem de dias úteis por coluna
        const contarSimples = (ini, fim) => {
            if (!ini || !fim) return 0;
            let d = new Date(ini + 'T12:00:00'), end = new Date(fim + 'T12:00:00'), c = 0;
            while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6) c++; d.setDate(d.getDate() + 1); }
            return c;
        };

        let totalCalendarDays = 0;
        const colDuCalculado    = {};
        const colDiasTrabalhados = {};

        [...Array(numCols).keys()].map(i => i + 1).forEach(idx => {
            const dMap       = datesMap[idx] || null;
            const diasCal    = dMap ? contarSimples(dMap.ini, dMap.fim) : 0;
            totalCalendarDays += diasCal;
            colDuCalculado[idx]    = diasCal;
            colDiasTrabalhados[idx] = st[idx].dias.size;
        });

        // Ajuste de dias configurados vs calendário
        const totalConfigDays = this.diasUteisConfig;
        const diffConfig = totalConfigDays - totalCalendarDays;
        if (diffConfig !== 0) {
            let alloc = 0;
            for (let idx = numCols; idx >= 1; idx--) {
                if (diffConfig > 0) {
                    colDuCalculado[idx] += diffConfig - alloc;
                    alloc = diffConfig;
                } else {
                    const canSub = Math.min(Math.abs(diffConfig) - alloc, colDuCalculado[idx]);
                    colDuCalculado[idx] -= canSub;
                    alloc += canSub;
                }
                if (alloc === Math.abs(diffConfig)) break;
            }
        }
        colDuCalculado[99] = totalConfigDays;

        // Ajuste de dias trabalhados (CLT = -1 dia do total)
        const totalTrabalhadosBruto = st[99].dias.size;
        const totalTrabalhadosFinal = ((ctrUpper === 'CLT' || ctrUpper === 'TODOS') && totalTrabalhadosBruto > 0)
            ? Math.max(0, totalTrabalhadosBruto - 1)
            : totalTrabalhadosBruto;
        const diffTrab = totalTrabalhadosFinal - totalTrabalhadosBruto;

        if (diffTrab !== 0) {
            let allocTrab = 0;
            for (let idx = numCols; idx >= 1; idx--) {
                const canSub = Math.min(Math.abs(diffTrab) - allocTrab, colDiasTrabalhados[idx]);
                colDiasTrabalhados[idx] -= canSub;
                allocTrab += canSub;
                if (allocTrab === Math.abs(diffTrab)) break;
            }
        }
        colDiasTrabalhados[99] = totalTrabalhadosFinal;

        // Meta por assistente
        let targetMeta = 700;
        if (ctrUpper === 'TERCEIROS' || ctrUpper === 'PJ') targetMeta = 750;

        // === Montar linhas ===
        let rows = '';

        // Headcount
        rows += mkRow('Total de assistentes (Configurado)', 'fas fa-users-cog', 'text-indigo-400', () => HC,      false, true, '', 'group-hc', false);
        rows += mkRow('Total de assistentes (Ativos)',      'fas fa-users',     'text-blue-400',   () => HC_Real, false, false, '', 'group-hc', true);

        // Dias
        rows += mkRow('Dias úteis (Configurado)',  'fas fa-calendar-check', 'text-emerald-500', (s, HC, idx) => colDuCalculado[idx],    true, true,  '', 'group-dias', false);
        rows += mkRow('Dias úteis trabalhados',    'fas fa-calendar-day',   'text-cyan-500',    (s, HC, idx) => colDiasTrabalhados[idx], true, false, '', 'group-dias', true);

        // Produção por tipo
        rows += mkRow('Total documentos Fifo',           'fas fa-sort-amount-down', 'text-slate-400',  s => s.fifo);
        rows += mkRow('Total documentos Gradual Parcial','fas fa-chart-area',       'text-teal-500',   s => s.gp);
        rows += mkRow('Total documentos Gradual Total',  'fas fa-chart-line',       'text-emerald-500',s => s.gt);
        rows += mkRow('Total documentos Perfil FC',      'fas fa-id-card',          'text-purple-500', s => s.fc);

        // Total
        rows += mkRow('Total documentos validados', 'fas fa-layer-group', 'text-blue-600', s => s.qty, false, true);

        // Meta
        rows += mkRow('Meta de produção', 'fas fa-bullseye', 'text-rose-500',
            (s, HC, idx) => HC * colDuCalculado[idx] * targetMeta, true);

        rows += mkRow('% Atingimento da Meta', 'fas fa-percentage', 'text-indigo-600', (s, HC, idx) => {
            const meta = HC * colDuCalculado[idx] * targetMeta;
            return meta > 0 ? (s.qty / meta) * 100 : 0;
        }, true, true);

        // Médias
        rows += mkRow('Média por assistente (período)', 'fas fa-users',    'text-orange-600',
            (s, HC) => HC > 0 ? s.qty / HC : 0, true);

        rows += mkRow('Média diária por assistente', 'fas fa-user-tag', 'text-emerald-700', (s, HC, idx) => {
            const divisor = HC * colDuCalculado[idx];
            return divisor > 0 ? s.qty / divisor : 0;
        }, true, true, 'bg-emerald-50 border-emerald-200');

        tbody.innerHTML = rows;
        const footerEl = document.getElementById('total-consolidado-footer');
        if (footerEl) footerEl.innerText = HC;
    }
};