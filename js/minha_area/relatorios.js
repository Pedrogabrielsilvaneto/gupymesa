/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área - V6.4.0 (Gráfico Comparativo)
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,
    ID_LIDERANCA: '1074356', 
    VISITANTE_IDS: ['2026', '200601'],
    _gapData: null,
    _selectedGapUsers: new Set(),
    _gapBenchmarkId: null,

    init: function() {
        console.log("📊 Relatórios da Minha Área Inicializado.");
        if (MinhaArea.isAdmin()) {
            const btnGap = document.getElementById('btn-rel-gap');
            if (btnGap) btnGap.classList.remove('hidden');
        }
    },

    mudarRelatorio: function(id) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;
        if (this.relatorioAtivo === id) { this.relatorioAtivo = null; container.innerHTML = `<div class="text-center py-20 text-slate-300 italic"><i class="fas fa-chart-line mb-3 text-4xl opacity-20"></i><br>Selecione um relatório acima para visualizar os dados.</div>`; return; }
        this.relatorioAtivo = id;
        container.innerHTML = `<div class="flex items-center justify-center py-20 text-blue-600"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`;
        if (id === 'metas_okr') this.carregarMetasOKR();
        else if (id === 'gap') this.carregarGAP();
    },

    carregarMetasOKR: async function() {
        try {
            const datas = MinhaArea.getDatasFiltro();
            if (!datas) return;
            const alvoId = MinhaArea.getUsuarioAlvo();
            const isAdmin = MinhaArea.isAdmin();
            const { inicio, fim } = datas;
            const dHoje = new Date();
            const hojeStr = dHoje.toISOString().split('T')[0];
            const dI = new Date(inicio + 'T12:00:00'); const dF = new Date(fim + 'T12:00:00');
            const ano = dI.getFullYear(); const mesIni = dI.getMonth() + 1; const mesFim = dF.getMonth() + 1;

            // [FIX] Busca usuários ativos para HC dinâmico (igual ao Dash)
            let filtroGrupo = '';
            if (alvoId === 'GRUPO_CLT') filtroGrupo = ' AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE "%pj%" AND LOWER(u.contrato) NOT LIKE "%terceiro%")) ';
            else if (alvoId === 'GRUPO_TERCEIROS') filtroGrupo = ' AND (LOWER(u.contrato) LIKE "%pj%" OR LOWER(u.contrato) LIKE "%terceiro%") ';
            
            const sqlUsers = `SELECT id, nome, perfil, funcao, contrato FROM usuarios u WHERE u.ativo = 1 AND u.id NOT IN (2026, 200601) AND (LOWER(u.funcao) NOT LIKE "%auditor%" AND LOWER(u.funcao) NOT LIKE "%gestor%" AND LOWER(u.funcao) NOT LIKE "%coordena%" AND LOWER(u.funcao) NOT LIKE "%lider%") ${filtroGrupo}`;
            const assistentes = await Sistema.query(sqlUsers);
            const hcEquipe = assistentes.length || 17;

            // [FIX] Busca a Meta correta (Liderança ou Individual)
            let metasRes = [];
            if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') {
                // Busca metas de qualquer GESTOR no período e pega a maior (igual Dash)
                const sqlMetaGroup = `SELECT mes, meta_producao FROM metas m JOIN usuarios u ON m.usuario_id = u.id WHERE m.ano = ? AND m.mes >= ? AND m.mes <= ? AND (LOWER(u.perfil) LIKE "%gestor%" OR LOWER(u.perfil) LIKE "%coordena%" OR u.id = 1074356)`;
                metasRes = await Sistema.query(sqlMetaGroup, [ano, mesIni, mesFim]);
            } else {
                metasRes = await Sistema.query(`SELECT mes, meta_producao FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`, [ano, mesIni, mesFim, alvoId]);
            }

            const prodR = await Sistema.query(`SELECT MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, SUM(COALESCE(p.fator, 1.0)) as soma_fator, COUNT(p.fator) as count_fator FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) ${alvoId && alvoId.length > 10 ? ' AND p.usuario_id = ? ' : filtroGrupo} GROUP BY mes`, alvoId && alvoId.length > 10 ? [inicio, fim, alvoId] : [inicio, fim]);

            const configMes = await Sistema.query(`SELECT * FROM config_mes WHERE ano = ?`, [ano]);

            const dataF = [];
            for (let m = mesIni; m <= mesFim; m++) {
                const c = (configMes || []).find(x => Number(x.mes) === m);
                const p = (prodR || []).find(x => Number(x.mes) === m);
                
                let dUteisBase = (c && c.dias_uteis) ? Number(c.dias_uteis) : this.calcularDiasUteisCalendario(m, ano);
                
                // [FIX] Lógica de 'Dias Decorridos' (idêntica ao DASH)
                const inicioMes = `${ano}-${String(m).padStart(2, '0')}-01`;
                const fimMes = new Date(ano, m, 0).toISOString().split('T')[0];
                let dReferencia = dUteisBase;
                if (hojeStr >= inicioMes && hojeStr <= fimMes) dReferencia = this.contarDiasUteis(inicioMes, hojeStr);
                else if (hojeStr < inicioMes) dReferencia = 0;

                const metaM = (metasRes || []).filter(x => Number(x.mes) === m);
                const metaVal = metaM.length > 0 ? Math.max(...metaM.map(x => Number(x.meta_producao || 0))) : 650;

                let denV = 1;
                if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') {
                    // Visão Grupo: HC * (Dias - 1)
                    denV = hcEquipe * (dReferencia > 0 ? Math.max(1, dReferencia - 1) : 0);
                } else {
                    // Visão Individual: (Dias - 1) - Abonos Reais do período
                    const cFator = p ? Number(p.count_fator || 0) : 0;
                    const sFator = p ? Number(p.soma_fator || 0) : 0;
                    const abonoManual = Math.max(0, cFator - sFator);
                    denV = Math.max(0, dReferencia - 1) - abonoManual;
                }

                dataF.push({ mes: m, total_prod: p ? Number(p.total_prod) : 0, denominador: denV > 0 ? denV : 0, meta_meta: metaVal });
            }
            this.renderizarMetasOKR(dataF, ano, mesIni, mesFim);
        } catch (e) { console.error(e); }
    },

    renderizarMetasOKR: function(producao, ano, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        const mS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let hIdx = `<div class="grid grid-cols-1 xl:grid-cols-2 gap-8"><div class="space-y-4">
            <div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Produção (Velocidade)</h3></div>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] font-bold"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th></tr></thead><tbody class="divide-y">`;
        let sM = 0, cM = 0, sR = 0, cR = 0;
        producao.forEach(p => {
            const mVal = p.meta_meta;
            const r = p.denominador > 0 ? (p.total_prod / p.denominador) : 0; const pct = mVal > 0 ? (r / mVal) * 100 : 0;
            const cl = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : (pct >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            if (p.total_prod > 0) { if (mVal > 0) { sM += mVal; cM++; } sR += r; cR++; }
            hIdx += `<tr><td class="px-4 py-2.5 font-bold">${mS[p.mes-1]}</td><td class="px-4 py-2.5 text-right text-slate-600">${mVal || '--'}</td><td class="px-4 py-2.5 text-right font-black text-blue-600">${r > 0 ? Math.round(r).toLocaleString() : '--'}</td><td class="px-4 py-2.5 text-center"><span class="px-1.5 py-0.5 rounded font-black text-[10px] ${cl}">${pct.toFixed(1)}%</span></td></tr>`;
        });
        const aM = cM > 0 ? sM / cM : 0; const aR = cR > 0 ? sR / cR : 0; const aP = aM > 0 ? (aR / aM * 100) : 0;
        hIdx += `</tbody><tfoot class="bg-slate-50 border-t-2 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right">${Math.round(aM).toLocaleString()}</td><td class="px-4 py-3 text-right text-blue-700 bg-blue-50/50">${Math.round(aR).toLocaleString()}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-amber-500 text-white">${aP.toFixed(1)}%</span></td></tr></tfoot></table></div></div>`;
        
        let hAs = `<div class="space-y-4"><div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Assertividade</h3></div>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] font-bold"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th></tr></thead><tbody class="divide-y">`;
        
        let sRA = 0, cRA = 0;
        producao.forEach(p => {
            const mVal = 97; // Meta padrão assertividade
            const rV = p.assert || 0;
            if (rV > 0) { sRA += rV; cRA++; }
            let at = 0; if (rV > 0) { if (rV < 90) at = 0; else if (rV < 94) at = 50; else if (rV < 95) at = 70; else if (rV < 96) at = 80; else if (rV <= 97) at = 90; else at = 100; }
            const cl = rV >= mVal ? 'text-emerald-600 bg-emerald-50' : (rV >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            hAs += `<tr><td class="px-4 py-2.5 font-bold">${mS[p.mes-1]}</td><td class="px-4 py-2.5 text-right text-slate-600">${mVal}%</td><td class="px-4 py-2.5 text-right font-black text-emerald-600">${rV > 0 ? rV.toFixed(2) + '%' : '--'}</td><td class="px-4 py-2.5 text-center"><span class="px-1.5 py-0.5 rounded font-black text-[10px] ${cl}">${at}%</span></td></tr>`;
        });
        const aRA = cRA > 0 ? sRA / cRA : 0;
        let aAt = 0; if (aRA > 0) { if (aRA < 90) aAt = 0; else if (aRA < 94) aAt = 50; else if (aRA < 95) aAt = 70; else if (aRA < 96) aAt = 80; else if (aRA <= 97) aAt = 90; else aAt = 100; }
        hAs += `</tbody><tfoot class="bg-slate-50 border-t-2 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right">97%</td><td class="px-4 py-3 text-right text-emerald-700 bg-emerald-50/50">${aRA.toFixed(2)}%</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-amber-500 text-white">${aAt}%</span></td></tr></tfoot></table></div></div></div>`;
        
        container.innerHTML = hIdx + hAs;
        this._lastMetas = metas; this._lastProd = producao; this._lastAssert = assertividade; this._lastMesRange = { mesIni, mesFim };
    },

    contarDiasUteis: function (inicio, fim) {
        let cnt = 0; let cur = new Date(inicio + 'T12:00:00'); let end = new Date(fim + 'T12:00:00');
        while (cur <= end) { if (cur.getDay() !== 0 && cur.getDay() !== 6) cnt++; cur.setDate(cur.getDate() + 1); }
        return cnt || 1;
    },

    calcularDiasUteisCalendario: function (mes, ano) {
        const i = new Date(ano, mes - 1, 1); const f = new Date(ano, mes, 0);
        let c = 0; let cur = new Date(i);
        while (cur <= f) { if (cur.getDay() !== 0 && cur.getDay() !== 6) c++; cur.setDate(cur.getDate() + 1); }
        return c;
    },

    carregarGAP: async function() {
        try {
            if (!MinhaArea.isAdmin()) return;
            const datas = MinhaArea.getDatasFiltro();
            const { inicio, fim } = datas;
            const alvoId = MinhaArea.getUsuarioAlvo();
            let filtroGrupo = '';
            if (alvoId === 'GRUPO_CLT') filtroGrupo = ' AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE "%pj%" AND LOWER(u.contrato) NOT LIKE "%terceiro%")) ';
            else if (alvoId === 'GRUPO_TERCEIROS') filtroGrupo = ' AND (LOWER(u.contrato) LIKE "%pj%" OR LOWER(u.contrato) LIKE "%terceiro%") ';
            const sql = `SELECT p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, COUNT(DISTINCT p.data_referencia) as dias_trab FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND u.ativo = 1 AND p.usuario_id NOT IN (2026, 200601) AND (LOWER(u.funcao) NOT LIKE '%auditor%' AND LOWER(u.funcao) NOT LIKE '%lider%' AND LOWER(u.funcao) NOT LIKE '%gestor%' AND LOWER(u.funcao) NOT LIKE '%coordena%') ${filtroGrupo} GROUP BY p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, mes ORDER BY u.nome, mes`;
            const data = await Sistema.query(sql, [inicio, fim]);
            const roadmap = {};
            data.forEach(row => {
                const uid = String(row.usuario_id);
                if (!roadmap[uid]) roadmap[uid] = { id: uid, nome: row.nome, meses: {} };
                roadmap[uid].meses[row.mes] = row.dias_trab > 0 ? (row.total_prod / row.dias_trab) : 0;
            });
            this._gapData = { roadmap, mesIni: new Date(inicio+'T12:00:00').getMonth() + 1, mesFim: new Date(fim+'T12:00:00').getMonth() + 1 };
            if (!this._gapBenchmarkId && Object.keys(roadmap).length > 0) this._gapBenchmarkId = Object.keys(roadmap)[0];
            this.renderizarGAP();
        } catch (e) { console.error(e); }
    },

    renderizarGAP: function() {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container || !this._gapData) return;
        const { roadmap, mesIni, mesFim } = this._gapData;
        const lista = Object.values(roadmap).sort((a,b) => a.nome.localeCompare(b.nome));
        
        // [FIX] Encontrar o último mês com dados (shared)
        let lastSharedMes = mesIni;
        for (let m = mesFim; m >= mesIni; m--) {
            const hasData = lista.some(as => as.meses[m] > 0);
            if (hasData) { lastSharedMes = m; break; }
        }
        
        const benchmarkRow = roadmap[this._gapBenchmarkId] || lista[0];
        const outrosUsuarios = lista.filter(as => as.id !== this._gapBenchmarkId);
        
        let html = `<div class="space-y-6 animate-enter">
            <div class="bg-rose-50 p-4 rounded-2xl flex items-center justify-between border border-rose-100 shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg"><i class="fas fa-balance-scale"></i></div>
                    <div><h4 class="text-rose-900 font-black text-xs uppercase tracking-widest">Comparativo de Performance</h4><p class="text-[10px] text-rose-600 font-bold">Base de comparação: Mês ${lastSharedMes}</p></div>
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-[8px] font-bold text-rose-400 uppercase mb-1">Referência (Benchmark):</span>
                    <select onchange="MinhaArea.Relatorios.setGapBenchmark(this.value)" class="bg-white border-2 border-rose-200 rounded-lg text-xs font-bold px-3 py-1.5 outline-none focus:border-rose-500 transition shadow-sm">
                        ${lista.map(as => `<option value="${as.id}" ${as.id === this._gapBenchmarkId ? 'selected' : ''}>${as.nome}</option>`).join('')}
                    </select>
                </div>
            </div>
            
            <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div class="flex flex-wrap gap-2 items-center">
                    <span class="text-[10px] font-black text-slate-400 uppercase mr-2">Exibir:</span>
                    <button onclick="MinhaArea.Relatorios.toggleAllGap(true)" class="px-2 py-1 rounded bg-slate-100 text-[9px] font-bold hover:bg-slate-200 transition text-slate-600">Todos</button>
                    <button onclick="MinhaArea.Relatorios.toggleAllGap(false)" class="px-2 py-1 rounded bg-slate-100 text-[9px] font-bold hover:bg-slate-200 transition text-slate-600">Nenhum</button>
                    <div class="h-4 w-px bg-slate-200 mx-2"></div>
                    <div class="flex flex-wrap gap-1.5">`;
        
        lista.forEach(as => {
            const isSel = this._selectedGapUsers.has(as.id) || this._selectedGapUsers.size === 0;
            html += `<button onclick="MinhaArea.Relatorios.toggleUserGap('${as.id}')" class="px-2 py-1 rounded-full border text-[9px] font-bold transition ${isSel ? 'bg-rose-600 border-rose-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-400 hover:border-rose-300'}">${as.nome}</button>`;
        });
        
        html += `</div></div></div>
            </div>
            
            <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <table class="w-full text-left border-collapse"><thead class="bg-slate-50 text-[9px] font-black uppercase text-slate-500 border-b"><tr><th class="px-6 py-4 sticky left-0 bg-slate-50 z-10 w-48 shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-slate-900 border-r">Assistente</th>`;
        for (let m = mesIni; m <= mesFim; m++) html += `<th class="px-4 py-4 text-center border-r">Mês ${m}</th>`;
        html += `<th class="px-4 py-4 text-center bg-blue-50/50 text-blue-900 border-r">EVOLUÇÃO %</th><th class="px-4 py-4 text-right bg-rose-50/50 text-rose-900 pr-8">DIFERENÇA VS REF.</th></tr></thead><tbody class="divide-y">`;
        
        // Primeiro: Referência (sempre no topo)
        html += this.renderizarLinhaGAP(benchmarkRow, benchmarkRow, lastSharedMes, true);
        
        // Depois: outros usuários
        outrosUsuarios.forEach(as => {
            if (this._selectedGapUsers.size > 0 && !this._selectedGapUsers.has(as.id)) return;
            html += this.renderizarLinhaGAP(as, benchmarkRow, lastSharedMes, false);
        });
        
        html += `</tbody></table></div></div></div>`;
        container.innerHTML = html;
    },

    setGapBenchmark: function(id) {
        this._gapBenchmarkId = id;
        this.renderizarGAP();
    },

    toggleUserGap: function(id) {
        if (this._selectedGapUsers.has(id)) this._selectedGapUsers.delete(id); else this._selectedGapUsers.add(id);
        this.renderizarGAP();
    },

    renderizarLinhaGAP: function(as, benchmarkRow, lastSharedMes, isRef) {
        let onclick = isRef ? '' : `onclick="MinhaArea.Relatorios.abrirGrafico('${as.id}')" style="cursor:pointer"`;
        let html = `<tr ${onclick} class="hover:bg-slate-50 transition group ${isRef ? 'bg-rose-50/10' : ''}"><td class="px-6 py-4 font-black sticky left-0 bg-white z-10 border-r shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-slate-700 bg-clip-padding group-hover:bg-slate-50">${as.nome} ${isRef ? '⭐' : ''}</td>`;
        
        let pVal = null, lVal = null;
        for (let m = this._gapData.mesIni; m <= this._gapData.mesFim; m++) {
            const val = as.meses[m] || 0;
            if (val > 0) { if (pVal === null) pVal = val; lVal = val; }
            html += `<td class="px-4 py-4 text-center border-r font-mono font-bold text-slate-500">${val > 0 ? Math.round(val) : '--'}</td>`;
        }
        
        let ev = (pVal > 0 && lVal > 0) ? ((lVal / pVal) - 1) * 100 : 0;
        
        const curMonthVal = as.meses[lastSharedMes] || 0;
        const refMonthVal = benchmarkRow.meses[lastSharedMes] || 0;
        const diff = curMonthVal - refMonthVal;
        
        html += `
            <td class="px-4 py-4 text-center border-r font-black ${ev >= 0 ? 'text-emerald-600' : 'text-rose-600'} text-[10px] bg-blue-50/10">${ev > 0 ? '+' : ''}${ev.toFixed(1)}%</td>
            <td class="px-4 py-4 text-right font-black pr-8 ${isRef ? 'text-slate-400' : (diff >= 0 ? 'text-emerald-600' : 'text-rose-600')}" style="font-size: 11px;">
                ${isRef ? '<span class="text-[9px] opacity-50 uppercase">Referência</span>' : (diff >= 0 ? `+${Math.round(diff)} metas/dia` : `-${Math.abs(Math.round(diff))} metas/dia`)}
            </td></tr>`;
        return html;
    },
    
    toggleAllGap: function(sel) {
        if (!sel) this._selectedGapUsers = new Set(['FORCED_EMPTY']); else this._selectedGapUsers.clear();
        this.renderizarGAP();
    },

    abrirGrafico: function(userId) {
        if (!this._gapData || !userId) return;
        const { roadmap, mesIni, mesFim } = this._gapData;
        const user = roadmap[userId];
        const benchmark = roadmap[this._gapBenchmarkId];
        if (!user || !benchmark) return;

        const container = document.getElementById('gap-chart-container');
        container.classList.remove('hidden');
        document.getElementById('chart-user-name').textContent = user.nome;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const ctx = document.getElementById('gap-chart');
                if (!ctx || typeof Chart === 'undefined') return;
                if (this._gapChartInstance) this._gapChartInstance.destroy();

            const meses = [];
            const labels = [];
            for (let m = mesIni; m <= mesFim; m++) {
                meses.push(m);
                labels.push('Mês ' + m);
            }

            const userData = meses.map(m => user.meses[m] || 0);
            const refData = meses.map(m => benchmark.meses[m] || 0);

            this._gapChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: user.nome, data: userData, backgroundColor: '#3b82f6', borderRadius: 4 },
                        { label: benchmark.nome, data: refData, backgroundColor: '#f43f5e', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.raw)} metas/dia` } }
                    },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'Metas/Dia' } }
                    }
                }
            });
        });
    });
},

    fecharGrafico: function() {
        document.getElementById('gap-chart-container').classList.add('hidden');
        if (this._gapChartInstance) { this._gapChartInstance.destroy(); this._gapChartInstance = null; }
    }
};
