/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área - V5.9.2 (Fix Março/Abril e Assertividade)
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,
    ID_LIDERANCA: '1074356', 
    VISITANTE_IDS: ['2026', '200601'],

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
        if (this.relatorioAtivo === id) {
            this.relatorioAtivo = null;
            container.innerHTML = `<div class="text-center py-20 text-slate-300 italic"><i class="fas fa-chart-line mb-3 text-4xl opacity-20"></i><br>Selecione um relatório acima para visualizar os dados.</div>`;
            return;
        }
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
            const myId = MinhaArea.usuario ? MinhaArea.usuario.id : null;
            const isAdmin = MinhaArea.isAdmin();
            const { inicio, fim } = datas;
            const dInicio = new Date(inicio + 'T12:00:00');
            const dHoje = new Date();
            const anoAtual = dHoje.getFullYear();
            const mesAtual = dHoje.getMonth() + 1;
            const diaHojeStr = dHoje.toISOString().split('T')[0];

            const ano = dInicio.getFullYear();
            const mesIni = dInicio.getMonth() + 1;
            const mesFim = new Date(fim + 'T12:00:00').getMonth() + 1;

            const configMes = await Sistema.query(`SELECT * FROM config_mes WHERE ano = ?`, [ano]);

            let userTargetForMeta = alvoId;
            if (isAdmin && (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS')) {
                userTargetForMeta = this.ID_LIDERANCA;
            } else if (!isAdmin) {
                userTargetForMeta = myId;
            }
            const metas = await Sistema.query(`SELECT * FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`, [ano, mesIni, mesFim, userTargetForMeta]);

            // PRODUÇÃO: Usa MONTH(data_referencia) para garantir Março
            let paramsProd = [inicio, fim];
            let sqlProd = `SELECT MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, COUNT(DISTINCT p.data_referencia) as dias_unicos FROM producao p `;
            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlProd += ` WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id = ? `;
                paramsProd.push(alvoId);
            } else {
                sqlProd += ` JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) `;
                if (alvoId === 'GRUPO_CLT') sqlProd += ` AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE '%pj%' AND LOWER(u.contrato) NOT LIKE '%terceiro%')) `;
                else if (alvoId === 'GRUPO_TERCEIROS') sqlProd += ` AND (LOWER(u.contrato) LIKE '%pj%' OR LOWER(u.contrato) LIKE '%terceiro%') `;
            }
            sqlProd += ` GROUP BY mes`;
            const producaoRaw = await Sistema.query(sqlProd, paramsProd);

            // ASSERTIVIDADE: AVG ignora nulos e traz o real
            let sqlAs = `SELECT MONTH(data_referencia) as mes, AVG(assertividade_val) as media_assert FROM assertividade WHERE data_referencia >= ? AND data_referencia <= ? `;
            let paramsAs = [inicio, fim];
            if (alvoId && alvoId !== 'EQUIPE') { sqlAs += ` AND usuario_id = ? `; paramsAs.push(alvoId); }
            sqlAs += ` GROUP BY mes`;
            const assertRaw = await Sistema.query(sqlAs, paramsAs);

            const dataFinal = [];
            for (let m = mesIni; m <= mesFim; m++) {
                const c = (configMes || []).find(x => Number(x.mes) === m);
                const p = (producaoRaw || []).find(x => Number(x.mes) === m);
                const a = (assertRaw || []).find(x => Number(x.mes) === m);

                let hc = (c ? ((Number(c.hc_clt) || 0) + (Number(c.hc_terceiros) || 0)) : 0) || 17;
                let diasUteisTotal = c ? (Number(c.dias_uteis) || 22) : this.calcularDiasUteisCalendario(m, ano);
                
                // [FIX ABRIL] Se for o mês atual, divide pelos dias decorridos (Sync Dashboard Card)
                let diasParaDivisor = diasUteisTotal;
                if (m === mesAtual && ano === anoAtual) {
                    const primeiroDiaMes = `${ano}-${String(m).padStart(2,'0')}-01`;
                    diasParaDivisor = this.contarDiasUteis(primeiroDiaMes, diaHojeStr);
                }

                // Regra CLT (-1)
                let divisorMes = Math.max(1, diasParaDivisor - 1);
                
                let denominadorVel = 0;
                if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') {
                    denominadorVel = hc * divisorMes;
                } else {
                    denominadorVel = divisorMes; // Individual simplificado
                }

                dataFinal.push({
                    mes: m,
                    total_prod: p ? Number(p.total_prod) : 0,
                    denominador: denominadorVel,
                    assert: a ? Number(a.media_assert) : 0
                });
            }

            this.renderizarMetasOKR(metas, dataFinal, dataFinal, ano, mesIni, mesFim);
        } catch (e) { console.error(e); }
    },

    renderizarMetasOKR: function(metas, producao, assertividade, ano, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let html = `<div class="space-y-6 animate-enter"><div class="grid grid-cols-1 xl:grid-cols-2 gap-8"><div class="space-y-4">
            <div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-layer-group text-blue-500"></i> Produção (Velocidade)</h3><button onclick="MinhaArea.Relatorios.copiarRelatorio('PROD', '${ano}')" class="text-[10px] font-bold text-blue-600 flex items-center gap-1.5"><i class="fas fa-copy"></i> Copiar Tabela</button></div>
            <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white"><table class="w-full text-left text-sm" id="table-rel-prod"><thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th><th class="px-4 py-3 text-center w-8"></th></tr></thead><tbody class="divide-y divide-slate-100">`;

        let tMP = 0, cMP = 0, tPP = 0, tDP = 0;
        for (let i = mesIni - 1; i < mesFim; i++) {
            const mN = i + 1;
            const metaObj = (metas || []).find(m => Number(m.mes) === mN);
            const prodObj = (producao || []).find(p => Number(p.mes) === mN);
            const mVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
            const rT = prodObj ? prodObj.total_prod : 0;
            const den = prodObj ? prodObj.denominador : 0;
            const real = den > 0 ? (rT / den) : 0;
            const pct = mVal > 0 ? (real / mVal) * 100 : 0;
            if (mVal > 0) { tMP += mVal; cMP++; } tPP += rT; tDP += den;
            const cl = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : (pct >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            html += `<tr class="hover:bg-slate-50 transition group ${real === 0 ? 'opacity-40' : ''}"><td class="px-4 py-2.5 font-bold text-slate-700">${mesesStr[i]}</td><td class="px-4 py-2.5 font-medium text-slate-600 text-right">${mVal > 0 ? mVal.toLocaleString() : '--'}</td><td class="px-4 py-2.5 font-black text-blue-600 text-right">${real > 0 ? Math.round(real).toLocaleString() : '--'}</td><td class="px-4 py-2.5 text-center">${real > 0 ? `<span class="px-2 py-0.5 rounded-full font-black text-[10px] ${cl}">${pct.toFixed(1)}%</span>` : '--'}</td><td class="px-4 py-2.5 text-center">${real > 0 ? `<button onclick="MinhaArea.Relatorios.copiarLinha('PROD', '${mesesStr[i]}', '${mVal}', '${Math.round(real)}', '${pct.toFixed(1)}')" class="w-6 h-6 rounded bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100"><i class="fas fa-copy text-[9px]"></i></button>` : ''}</td></tr>`;
        }
        const aMP = cMP > 0 ? (tMP / cMP) : 0; const aRP = tDP > 0 ? (tPP / tDP) : 0; const aPP = aMP > 0 ? (aRP / aMP * 100) : 0;
        html += `</tbody><tfoot class="bg-slate-50 border-t-2 border-slate-200 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right text-slate-600">${Math.round(aMP).toLocaleString()}</td><td class="px-4 py-3 text-right text-blue-700 bg-emerald-50/40">${Math.round(aRP).toLocaleString()}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-lg bg-amber-500 text-white shadow-sm">${aPP.toFixed(1)}%</span></td><td></td></tr></tfoot></table></div></div>`;

        html += `<div class="space-y-4"><div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-check-double text-emerald-500"></i> Assertividade</h3><button onclick="MinhaArea.Relatorios.copiarRelatorio('ASSERT', '${ano}')" class="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5"><i class="fas fa-copy"></i> Copiar Tabela</button></div>
            <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white"><table class="w-full text-left text-sm" id="table-rel-assert"><thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th><th class="px-4 py-3 text-center w-8"></th></tr></thead><tbody class="divide-y divide-slate-100">`;

        let sA = 0, cA = 0, tMA = 0, cMA = 0;
        for (let i = mesIni - 1; i < mesFim; i++) {
            const mN = i + 1;
            const metaObj = (metas || []).find(m => Number(m.mes) === mN);
            const asObj = (assertividade || []).find(a => Number(a.mes) === mN);
            const mVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
            const rVal = asObj ? asObj.assert : 0;
            let at = 0; if (rVal > 0) { if (rVal < 90) at = 0; else if (rVal < 94) at = 50; else if (rVal < 95) at = 70; else if (rVal < 96) at = 80; else if (rVal <= 97) at = 90; else at = 100; }
            if (mVal > 0) { tMA += mVal; cMA++; } if (rVal > 0) { sA += rVal; cA++; }
            const col = rVal >= mVal ? 'text-emerald-600 bg-emerald-50' : (rVal >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            html += `<tr class="hover:bg-slate-50 transition group ${rVal === 0 ? 'opacity-40' : ''}"><td class="px-4 py-2.5 font-bold text-slate-700">${mesesStr[i]}</td><td class="px-4 py-2.5 font-medium text-slate-600 text-right">${mVal}%</td><td class="px-4 py-2.5 font-black text-emerald-600 text-right">${rVal > 0 ? rVal.toFixed(2) + '%' : '--'}</td><td class="px-4 py-2.5 text-center">${rVal > 0 ? `<span class="px-2 py-0.5 rounded-full font-black text-[10px] ${col}">${at}%</span>` : '--'}</td><td class="px-4 py-2.5 text-center"></td></tr>`;
        }
        const aMA = cMA > 0 ? tMA / cMA : 97; const aRA = cA > 0 ? sA / cA : 0;
        let aAt = 0; if (aRA > 0) { if (aRA < 90) aAt = 0; else if (aRA < 94) aAt = 50; else if (aRA < 95) aAt = 70; else if (aRA < 96) aAt = 80; else if (aRA <= 97) aAt = 90; else aAt = 100; }
        html += `</tbody><tfoot class="bg-slate-50 border-t-2 border-slate-200 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right text-slate-600">${Math.round(aMA)}%</td><td class="px-4 py-3 text-right text-emerald-700 bg-emerald-50/40">${aRA.toFixed(2)}%</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-lg bg-amber-500 text-white shadow-sm">${aAt}%</span></td><td></td></tr></tfoot></table></div></div></div></div>`;

        container.innerHTML = html;
        this._lastMetas = metas; this._lastProd = producao; this._lastAssert = assertividade; this._lastMesRange = { mesIni, mesFim };
    },

    contarDiasUteis: function (inicio, fim) {
        let count = 0; let cur = new Date(inicio + 'T12:00:00'); let end = new Date(fim + 'T12:00:00');
        while (cur <= end) { if (cur.getDay() !== 0 && cur.getDay() !== 6) count++; cur.setDate(cur.getDate() + 1); }
        return count || 1;
    },

    calcularDiasUteisCalendario: function (mes, ano) {
        const i = new Date(ano, mes - 1, 1); const f = new Date(ano, mes, 0);
        let c = 0; let cur = new Date(i);
        while (cur <= f) { if (cur.getDay() !== 0 && cur.getDay() !== 6) c++; cur.setDate(cur.getDate() + 1); }
        return c;
    }
};
// GAP mantido do arquivo anterior (copiar do original se necessário, mas foco no OKR)
MinhaArea.Relatorios.carregarGAP = async function() {
    try {
        if (!MinhaArea.isAdmin()) return;
        const datas = MinhaArea.getDatasFiltro();
        const { inicio, fim } = datas;
        const sql = `SELECT p.usuario_id, u.nome, MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, COUNT(DISTINCT p.data_referencia) as dias_trab FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND u.ativo = 1 AND p.usuario_id NOT IN (2026, 200601) GROUP BY p.usuario_id, u.nome, mes ORDER BY u.nome, mes`;
        const data = await Sistema.query(sql, [inicio, fim]);
        const roadmap = {}; const topM = {};
        data.forEach(row => {
            const uid = String(row.usuario_id);
            if (!roadmap[uid]) roadmap[uid] = { nome: row.nome, meses: {} };
            const v = row.dias_trab > 0 ? (row.total_prod / row.dias_trab) : 0;
            roadmap[uid].meses[row.mes] = v;
            if (!topM[row.mes] || v > topM[row.mes]) topM[row.mes] = v;
        });
        const dI = new Date(inicio + 'T12:00:00');
        this.renderizarGAP(roadmap, topM, dI.getMonth() + 1, new Date(fim + 'T12:00:00').getMonth() + 1);
    } catch (e) { console.error(e); }
};

MinhaArea.Relatorios.renderizarGAP = function(roadmap, topM, mesIni, mesFim) {
    const container = document.getElementById('relatorio-ativo-content');
    const mesesStr = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const lista = Object.values(roadmap).sort((a,b) => a.nome.localeCompare(b.nome));
    let html = `<div class="space-y-6 animate-enter"><div class="bg-rose-50 p-4 rounded-xl flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm"><i class="fas fa-chart-line"></i></div><div><h4 class="text-rose-900 font-black text-sm">Análise de GAP e Evolução</h4><p class="text-rose-600 text-[10px] uppercase font-bold tracking-wider">Média Diária entre Assistentes</p></div></div><div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white"><table class="w-full text-xs text-left"><thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[9px]"><tr><th class="px-4 py-4 sticky left-0 bg-slate-50 z-10 w-32">Assistente</th>`;
    for (let m = mesIni; m <= mesFim; m++) html += `<th class="px-3 py-4 text-center">${mesesStr[m-1]}</th>`;
    html += `<th class="px-4 py-4 text-center bg-slate-100/50">Ev. %</th><th class="px-4 py-4 text-right bg-slate-100/50">Gap</th></tr></thead><tbody class="divide-y divide-slate-100">`;
    lista.forEach(as => {
        let pV = null, uV = null;
        html += `<tr><td class="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100 truncate">${as.nome}</td>`;
        for (let m = mesIni; m <= mesFim; m++) {
            const v = as.meses[m] || 0; if (v > 0) { if (pV === null) pV = v; uV = v; }
            html += `<td class="px-3 py-3 text-center font-black ${v >= (topM[m]||0) && v>0 ? 'text-emerald-600' : 'text-slate-600'}">${v > 0 ? Math.round(v) : '--'}</td>`;
        }
        let ev = (pV > 0 && uV > 0) ? ((uV / pV) - 1) * 100 : 0;
        const g = (topM[mesFim] || 0) - (uV || 0);
        html += `<td class="px-4 py-3 text-center bg-slate-50/30 font-black ${ev > 0 ? 'text-emerald-600' : 'text-rose-600'}">${ev.toFixed(1)}%</td><td class="px-4 py-3 text-right bg-slate-50/30 font-black ${g <= 0 ? 'text-emerald-600' : 'text-amber-600'}">${g <= 0 ? 'TOP' : `-${Math.round(g)}`}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;
    container.innerHTML = html;
};

MinhaArea.Relatorios.copiarLinha = function(tipo, mes, meta, realizado, ating) {
    const texto = `${tipo === 'PROD' ? 'Produção' : 'Assertividade'} - ${mes}: Meta ${meta} | Realizado ${realizado} | Ating. ${ating}%`;
    navigator.clipboard.writeText(texto);
};

MinhaArea.Relatorios.copiarRelatorio = function(tipo, ano) {
    const titulo = tipo === 'PROD' ? '📈 RELATÓRIO DE PRODUÇÃO' : '✅ RELATÓRIO DE ASSERTIVIDADE';
    let t = `${titulo} - ${ano}\n\n`;
    const { mesIni, mesFim } = this._lastMesRange || { mesIni: 1, mesFim: 12 };
    for (let i = mesIni - 1; i < mesFim; i++) {
        const mN = i + 1;
        if (tipo === 'PROD') {
            const p = (this._lastProd || []).find(x => x.mes === mN);
            const m = (this._lastMetas || []).find(x => x.mes === mN);
            if (p) t += `${i + 1}: Meta ${m?.meta_producao || 0} | Realizado ${Math.round(p.total_prod / p.denominador)} | Ating. ${Math.round((p.total_prod / p.denominador) / (m?.meta_producao || 1) * 100)}%\n`;
        }
    }
    navigator.clipboard.writeText(t);
};
