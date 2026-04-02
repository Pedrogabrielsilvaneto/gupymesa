/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área - V5.9.3 (Force Feb Sync)
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
            const dInicio = new Date(inicio + 'T12:00:00');
            const dHoje = new Date();
            const diaHojeStr = dHoje.toISOString().split('T')[0];

            const ano = dInicio.getFullYear();
            const mesIni = dInicio.getMonth() + 1;
            const mesFim = new Date(fim + 'T12:00:00').getMonth() + 1;

            const configMes = await Sistema.query(`SELECT * FROM config_mes WHERE ano = ?`, [ano]);

            let utForMeta = alvoId;
            if (isAdmin && (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS')) utForMeta = this.ID_LIDERANCA;
            else if (!isAdmin) utForMeta = MinhaArea.usuario?.id;
            
            const metas = await Sistema.query(`SELECT * FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`, [ano, mesIni, mesFim, utForMeta]);

            // PRODUÇÃO: MONTH() para garantir agrupamento correto
            let pP = [inicio, fim];
            let sqlP = `SELECT MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod FROM producao p `;
            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlP += ` WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id = ? `;
                pP.push(alvoId);
            } else {
                sqlP += ` JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) `;
                if (alvoId === 'GRUPO_CLT') sqlP += ` AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE '%pj%' AND LOWER(u.contrato) NOT LIKE '%terceiro%')) `;
                else if (alvoId === 'GRUPO_TERCEIROS') sqlP += ` AND (LOWER(u.contrato) LIKE '%pj%' OR LOWER(u.contrato) LIKE '%terceiro%') `;
            }
            sqlP += ` GROUP BY mes`;
            const prodR = await Sistema.query(sqlP, pP);

            // ASSERTIVIDADE
            let pA = [inicio, fim];
            let sqlA = `SELECT MONTH(data_referencia) as mes, AVG(assertividade_val) as media_assert FROM assertividade WHERE data_referencia >= ? AND data_referencia <= ? `;
            if (alvoId && alvoId !== 'EQUIPE') { sqlA += ` AND usuario_id = ? `; pA.push(alvoId); }
            sqlA += ` GROUP BY mes`;
            const asR = await Sistema.query(sqlA, pA);

            const dataF = [];
            for (let m = mesIni; m <= mesFim; m++) {
                const c = (configMes || []).find(x => Number(x.mes) === m);
                const p = (prodR || []).find(x => Number(x.mes) === m);
                const a = (asR || []).find(x => Number(x.mes) === m);

                let hc = c ? ((Number(c.hc_clt) || 0) + (Number(c.hc_terceiros) || 0)) : 0;
                if (hc === 0) hc = 17;

                let dUteis = c ? Number(c.dias_uteis) : 0;
                if (dUteis === 0) {
                    // Fallback Inteligente (Sincronizado com Dashboard 2026)
                    dUteis = this.calcularDiasUteisCalendario(m, ano);
                    if (m === 2 && ano === 2026) dUteis = 18; // Fevereiro 2026 (Carnaval)
                }
                
                let dDivisor = dUteis;
                // Se for mês futuro (maior que hoje), usa o mês cheio. Se for atual, usa o decorrido.
                if (m === (dHoje.getMonth() + 1) && ano === dHoje.getFullYear()) {
                    dDivisor = this.contarDiasUteis(`${ano}-${String(m).padStart(2,'0')}-01`, diaHojeStr);
                }

                let dFinal = Math.max(1, dDivisor - 1);
                let denV = 0;
                if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') denV = hc * dFinal;
                else denV = dFinal;

                dataF.push({
                    mes: m,
                    total_prod: p ? Number(p.total_prod) : 0,
                    denominador: denV,
                    assert: a ? Number(a.media_assert) : 0
                });
            }

            this.renderizarMetasOKR(metas, dataF, dataF, ano, mesIni, mesFim);
        } catch (e) { console.error(e); }
    },

    renderizarMetasOKR: function(metas, producao, assertividade, ano, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        const mStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let html = `<div class="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-enter">
            <div class="space-y-4">
                <div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase">Produção (Velocidade)</h3><button onclick="MinhaArea.Relatorios.copiarRelatorio('PROD', '${ano}')" class="text-[10px] font-bold text-blue-600">Copiar</button></div>
                <div class="overflow-hidden rounded-xl border border-slate-200 bg-white"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] font-bold"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th></tr></thead><tbody class="divide-y">`;

        let tMP = 0, cMP = 0, tPP = 0, tDP = 0;
        producao.forEach(p => {
            const mN = p.mes;
            const metaObj = (metas || []).find(m => Number(m.mes) === mN);
            const mVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
            const real = p.denominador > 0 ? (p.total_prod / p.denominador) : 0;
            const pct = mVal > 0 ? (real / mVal) * 100 : 0;
            if (mVal > 0) { tMP += mVal; cMP++; } tPP += p.total_prod; tDP += p.denominador;
            const cl = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : (pct >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            html += `<tr class="hover:bg-slate-50 transition ${real === 0 ? 'opacity-40' : ''}"><td class="px-4 py-2.5 font-bold">${mStr[mN-1]}</td><td class="px-4 py-2.5 text-right font-medium text-slate-600">${mVal || '--'}</td><td class="px-4 py-2.5 text-right font-black text-blue-600">${real > 0 ? Math.round(real).toLocaleString() : '--'}</td><td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full font-black text-[10px] ${cl}">${pct.toFixed(1)}%</span></td></tr>`;
        });
        const aMP = cMP > 0 ? (tMP / cMP) : 0; const aRP = tDP > 0 ? (tPP / tDP) : 0; const aPP = aMP > 0 ? (aRP / aMP * 100) : 0;
        html += `</tbody><tfoot class="bg-slate-50 border-t-2 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right">${Math.round(aMP).toLocaleString()}</td><td class="px-4 py-3 text-right text-blue-700 bg-emerald-50/40">${Math.round(aRP).toLocaleString()}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-amber-500 text-white">${aPP.toFixed(1)}%</span></td></tr></tfoot></table></div></div>`;

        html += `<div class="space-y-4 shadow-xl">
            <div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase">Assertividade</h3></div>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] font-bold"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th></tr></thead><tbody class="divide-y">`;
        let sA = 0, cA = 0, tMA = 0, cMA = 0;
        assertividade.forEach(as => {
            const mN = as.mes;
            const metaObj = (metas || []).find(m => Number(m.mes) === mN);
            const mVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
            const rV = as.assert;
            let at = 0; if (rV > 0) { if (rV < 90) at = 0; else if (rV < 94) at = 50; else if (rV < 95) at = 70; else if (rV < 96) at = 80; else if (rV <= 97) at = 90; else at = 100; }
            if (mVal > 0) { tMA += mVal; cMA++; } if (rV > 0) { sA += rV; cA++; }
            const cl = rV >= mVal ? 'text-emerald-600 bg-emerald-50' : (rV >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            html += `<tr class="hover:bg-slate-50 transition ${rV === 0 ? 'opacity-40' : ''}"><td class="px-4 py-2.5 font-bold">${mStr[mN-1]}</td><td class="px-4 py-2.5 text-right font-medium text-slate-600">${mVal}%</td><td class="px-4 py-2.5 text-right font-black text-emerald-600">${rV > 0 ? rV.toFixed(2) + '%' : '--'}</td><td class="px-4 py-2.5 text-center"><span class="px-2 py-0.5 rounded-full font-black text-[10px] ${cl}">${at}%</span></td></tr>`;
        });
        const aMA = cMA > 0 ? tMA / cMA : 97; const aRA = cA > 0 ? sA / cA : 0;
        let aAt = 0; if (aRA > 0) { if (aRA < 90) aAt = 0; else if (aRA < 94) aAt = 50; else if (aRA < 95) aAt = 70; else if (aRA < 96) aAt = 80; else if (aRA <= 97) aAt = 90; else aAt = 100; }
        html += `</tbody><tfoot class="bg-slate-50 border-t-2 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right">${Math.round(aMA)}%</td><td class="px-4 py-3 text-right text-emerald-700 bg-emerald-50/40">${aRA.toFixed(2)}%</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-amber-500 text-white">${aAt}%</span></td></tr></tfoot></table></div></div></div>`;

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
    },

    carregarGAP: async function() {
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
    },

    renderizarGAP: function(roadmap, topM, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        const mesesStr = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const lista = Object.values(roadmap).sort((a,b) => a.nome.localeCompare(b.nome));
        let html = `<div class="space-y-6"><div class="bg-rose-50 p-4 rounded-xl flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm"><i class="fas fa-chart-line"></i></div><div><h4 class="text-rose-900 font-bold">Análise de GAP</h4></div></div><div class="overflow-x-auto rounded-xl border bg-white"><table class="w-full text-xs text-left"><thead class="bg-slate-50 text-[9px] font-bold uppercase"><tr><th class="px-4 py-4 sticky left-0 bg-slate-50 z-10">Assistente</th>`;
        for (let m = mesIni; m <= mesFim; m++) html += `<th class="px-3 py-4 text-center">${mesesStr[m-1]}</th>`;
        html += `<th>Ev %</th><th class="px-4 py-4 text-right">Gap</th></tr></thead><tbody class="divide-y">`;
        lista.forEach(as => {
            let pV = null, uV = null;
            html += `<tr><td class="px-4 py-3 font-bold sticky left-0 bg-white z-10 border-r">${as.nome}</td>`;
            for (let m = mesIni; m <= mesFim; m++) {
                const v = as.meses[m] || 0; if (v > 0) { if (pV === null) pV = v; uV = v; }
                html += `<td class="px-3 py-3 text-center ${v >= (topM[m]||0) && v>0 ? 'text-emerald-600 font-bold' : ''}">${v > 0 ? Math.round(v) : '--'}</td>`;
            }
            let ev = (pV > 0 && uV > 0) ? ((uV / pV) - 1) * 100 : 0;
            const g = (topM[mesFim] || 0) - (uV || 0);
            html += `<td class="px-4 py-3 text-center ${ev > 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold">${ev.toFixed(1)}%</td><td class="px-4 py-3 text-right ${g <= 0 ? 'text-emerald-600' : 'text-amber-600'} font-bold">${g <= 0 ? 'TOP' : `-${Math.round(g)}`}</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        container.innerHTML = html;
    }
};
