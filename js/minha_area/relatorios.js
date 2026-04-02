/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área - V5.9.1 (Sync Full Dashboard)
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,
    ID_LIDERANCA: '1074356', // ID da Roberta (Baseline para Meta)
    VISITANTE_IDS: ['2026', '200601'], // IDs de teste a ignorar

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
            container.innerHTML = `
                <div class="text-center py-20 text-slate-300 italic">
                    <i class="fas fa-chart-line mb-3 text-4xl opacity-20"></i><br>
                    Selecione um relatório acima para visualizar os dados.
                </div>
            `;
            return;
        }

        this.relatorioAtivo = id;
        container.innerHTML = `
            <div class="flex items-center justify-center py-20 text-blue-600">
                <i class="fas fa-spinner fa-spin text-3xl"></i>
            </div>
        `;

        if (id === 'metas_okr') {
            this.carregarMetasOKR();
        } else if (id === 'gap') {
            this.carregarGAP();
        }
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
            const ano = dInicio.getFullYear();
            const mesIni = dInicio.getMonth() + 1;
            const mesFim = new Date(fim + 'T12:00:00').getMonth() + 1;

            // 1. DADOS DE CONFIGURAÇÃO (HEADCOUNT E DIAS ÚTEIS)
            const configMes = await Sistema.query(`SELECT * FROM config_mes WHERE ano = ?`, [ano]);

            // 2. METAS (Dessa vez buscamos apenas para o titular da meta do relatório)
            let userTargetForMeta = alvoId;
            if (isAdmin && (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS')) {
                userTargetForMeta = this.ID_LIDERANCA;
            } else if (!isAdmin) {
                userTargetForMeta = myId;
            }
            const metas = await Sistema.query(`SELECT * FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`, [ano, mesIni, mesFim, userTargetForMeta]);

            // 3. PRODUÇÃO (Sincronizada com Dashboard: Soma tudo, menos Visitantes, se for Geral)
            let paramsProd = [inicio, fim];
            let sqlProd = `
                SELECT 
                    p.mes_referencia as mes, 
                    SUM(p.quantidade) as total_prod,
                    COUNT(DISTINCT p.data_referencia) as dias_unicos
                FROM producao p
            `;
            
            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                // Individual: Apenas o selecionado
                sqlProd += ` WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id = ? `;
                paramsProd.push(alvoId);
            } else if (alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') {
                // Grupos: Filtra por contrato
                sqlProd += ` JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? `;
                if (alvoId === 'GRUPO_CLT') {
                    sqlProd += ` AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE '%pj%' AND LOWER(u.contrato) NOT LIKE '%terceiro%')) `;
                } else {
                    sqlProd += ` AND (LOWER(u.contrato) LIKE '%pj%' OR LOWER(u.contrato) LIKE '%terceiro%') `;
                }
                sqlProd += ` AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) `;
            } else {
                // GERAL (TODOS): Soma absoluta para a meta de gestão (Regra Dashboard 4.41)
                sqlProd += ` WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) `;
            }
            sqlProd += ` GROUP BY p.mes_referencia`;
            const producaoRaw = await Sistema.query(sqlProd, paramsProd);

            // 4. ASSERTIVIDADE (Média ponderada para ser fiel ao Dashboard)
            let sqlAs = `SELECT MONTH(data_referencia) as mes, SUM(assertividade_val) as soma_val, COUNT(*) as qtd FROM assertividade WHERE data_referencia >= ? AND data_referencia <= ? `;
            let paramsAs = [inicio, fim];

            if (alvoId && alvoId !== 'EQUIPE') {
                sqlAs += ` AND usuario_id = ? `;
                paramsAs.push(alvoId);
            }
            sqlAs += ` GROUP BY mes`;
            const assertRaw = await Sistema.query(sqlAs, paramsAs);

            // 5. PROCESSAMENTO E SINCRONIZAÇÃO DE CÁLCULO
            const dataFinal = [];
            for (let m = mesIni; m <= mesFim; m++) {
                const c = (configMes || []).find(x => Number(x.mes) === m);
                const p = (producaoRaw || []).find(x => Number(x.mes) === m);
                const a = (assertRaw || []).find(x => Number(x.mes) === m);

                let hc = 17, diasUteis = 22; // Fallbacks
                if (c) {
                    hc = (Number(c.hc_clt) || 0) + (Number(c.hc_terceiros) || 0) || 17;
                    diasUteis = Number(c.dias_uteis_clt) || (Number(c.dias_uteis) - 1) || 21;
                } else {
                    // Sem config, tenta calcular dias do calendário - 1
                    diasUteis = this.calcularDiasUteisCalendario(m, ano) - 1;
                }

                let denominadorVel = 0;
                if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') {
                    denominadorVel = hc * diasUteis;
                } else {
                    // Individual: dias reais trabalhados ou úteis se contrato for CLT
                    const diasReais = p ? p.dias_unicos : 0;
                    denominadorVel = diasReais; // Simplificado para individual
                }

                dataFinal.push({
                    mes: m,
                    total_prod: p ? Number(p.total_prod) : 0,
                    denominador: denominadorVel,
                    assert: a ? (a.soma_val / a.qtd) : 0
                });
            }

            this.renderizarMetasOKR(metas, dataFinal, dataFinal, ano, mesIni, mesFim);

        } catch (e) {
            console.error("Erro na carga OKR:", e);
        }
    },

    renderizarMetasOKR: function(metas, producao, assertividade, ano, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let html = `<div class="space-y-6 animate-enter"><div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div class="space-y-4">
                <div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-layer-group text-blue-500"></i> Produção (Velocidade)</h3><button onclick="MinhaArea.Relatorios.copiarRelatorio('PROD', '${ano}')" class="text-[10px] font-bold text-blue-600 flex items-center gap-1.5"><i class="fas fa-copy"></i> Copiar Tabela</button></div>
                <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white"><table class="w-full text-left text-sm" id="table-rel-prod"><thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th><th class="px-4 py-3 text-center w-8"></th></tr></thead><tbody class="divide-y divide-slate-100">`;

        let tMetaP = 0, cMetaP = 0, tProdP = 0, tDenomP = 0;

        for (let i = mesIni - 1; i < mesFim; i++) {
            const mN = i + 1;
            const metaObj = (metas || []).find(m => Number(m.mes) === mN);
            const prodObj = (producao || []).find(p => Number(p.mes) === mN);

            const metaVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
            const realizTotal = prodObj ? prodObj.total_prod : 0;
            const denominador = prodObj ? prodObj.denominador : 0;
            const realizado = denominador > 0 ? (realizTotal / denominador) : 0;
            const pct = metaVal > 0 ? (realizado / metaVal) * 100 : 0;
            
            if (metaVal > 0) { tMetaP += metaVal; cMetaP++; }
            tProdP += realizTotal; tDenomP += denominador;

            const colLine = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : (pct >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            html += `<tr class="hover:bg-slate-50 transition group ${realizado === 0 ? 'opacity-40' : ''}"><td class="px-4 py-2.5 font-bold text-slate-700">${mesesStr[i]}</td><td class="px-4 py-2.5 font-medium text-slate-600 text-right">${metaVal > 0 ? metaVal.toLocaleString() : '--'}</td><td class="px-4 py-2.5 font-black text-blue-600 text-right">${realizado > 0 ? Math.round(realizado).toLocaleString() : '--'}</td><td class="px-4 py-2.5 text-center">${realizado > 0 ? `<span class="px-2 py-0.5 rounded-full font-black text-[10px] ${colLine}">${pct.toFixed(1)}%</span>` : '--'}</td><td class="px-4 py-2.5 text-center">${realizado > 0 ? `<button onclick="MinhaArea.Relatorios.copiarLinha('PROD', '${mesesStr[i]}', '${metaVal}', '${Math.round(realizado)}', '${pct.toFixed(1)}')" class="w-6 h-6 rounded bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100"><i class="fas fa-copy text-[9px]"></i></button>` : ''}</td></tr>`;
        }

        const avgMetaP = cMetaP > 0 ? (tMetaP / cMetaP) : 0;
        const avgRealP = tDenomP > 0 ? (tProdP / tDenomP) : 0;
        const avgPctP = avgMetaP > 0 ? (avgRealP / avgMetaP) * 100 : 0;

        html += `</tbody><tfoot class="bg-slate-50 border-t-2 border-slate-200 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right text-slate-600">${Math.round(avgMetaP).toLocaleString()}</td><td class="px-4 py-3 text-right text-blue-700 bg-emerald-50/40">${Math.round(avgRealP).toLocaleString()}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-lg bg-amber-500 text-white shadow-sm">${avgPctP.toFixed(1)}%</span></td><td class="px-4 py-3"></td></tr></tfoot></table></div></div>`;

        html += `<div class="space-y-4 shadow-xl"><div class="flex justify-between items-end px-1"><h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><i class="fas fa-check-double text-emerald-500"></i> Assertividade</h3><button onclick="MinhaArea.Relatorios.copiarRelatorio('ASSERT', '${ano}')" class="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5"><i class="fas fa-copy"></i> Copiar Tabela</button></div>
                <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white"><table class="w-full text-left text-sm" id="table-rel-assert"><thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th><th class="px-4 py-3 text-center w-8"></th></tr></thead><tbody class="divide-y divide-slate-100">`;

        let tMA = 0, cMA = 0, sA = 0, cA = 0;
        for (let i = mesIni - 1; i < mesFim; i++) {
            const mN = i + 1;
            const metaObj = (metas || []).find(m => Number(m.mes) === mN);
            const asObj = (assertividade || []).find(a => Number(a.mes) === mN);
            const mVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
            const rVal = asObj ? asObj.assert : 0;
            let ating = 0; if (rVal > 0) { if (rVal < 90) ating = 0; else if (rVal < 94) ating = 50; else if (rVal < 95) ating = 70; else if (rVal < 96) ating = 80; else if (rVal <= 97) ating = 90; else ating = 100; }
            if (mVal > 0) { tMA += mVal; cMA++; } if (rVal > 0) { sA += rVal; cA++; }
            const col = rVal >= mVal ? 'text-emerald-600 bg-emerald-50' : (rVal >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            html += `<tr class="hover:bg-slate-50 transition group ${rVal === 0 ? 'opacity-40' : ''}"><td class="px-4 py-2.5 font-bold text-slate-700">${mesesStr[i]}</td><td class="px-4 py-2.5 font-medium text-slate-600 text-right">${mVal}%</td><td class="px-4 py-2.5 font-black text-emerald-600 text-right">${rVal > 0 ? rVal.toFixed(2) + '%' : '--'}</td><td class="px-4 py-2.5 text-center">${rVal > 0 ? `<span class="px-2 py-0.5 rounded-full font-black text-[10px] ${col}">${ating}%</span>` : '--'}</td><td class="px-4 py-2.5 text-center"></td></tr>`;
        }
        const avgMA = cMA > 0 ? (tMA / cMA) : 97; const avgRA = cA > 0 ? (sA / cA) : 0;
        let avgAt = 0; if (avgRA > 0) { if (avgRA < 90) avgAt = 0; else if (avgRA < 94) avgAt = 50; else if (avgRA < 95) avgAt = 70; else if (avgRA < 96) avgAt = 80; else if (avgRA <= 97) avgAt = 90; else avgAt = 100; }
        html += `</tbody><tfoot class="bg-slate-50 border-t-2 border-slate-200 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right text-slate-600">${Math.round(avgMA)}%</td><td class="px-4 py-3 text-right text-emerald-700 bg-emerald-50/40">${avgRA.toFixed(2)}%</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-lg bg-amber-500 text-white shadow-sm">${avgAt}%</span></td><td></td></tr></tfoot></table></div></div></div></div>`;

        container.innerHTML = html;
        this._lastMetas = metas; this._lastProd = producao; this._lastAssert = assertividade; this._lastMesRange = { mesIni, mesFim };
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
            if (!datas) return;
            const { inicio, fim } = datas;
            let sql = `SELECT p.usuario_id, u.nome, p.mes_referencia as mes, SUM(p.quantidade) as total_prod, COUNT(DISTINCT p.data_referencia) as dias_trab FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND u.ativo = 1 AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) GROUP BY p.usuario_id, u.nome, p.mes_referencia ORDER BY u.nome, p.mes_referencia`;
            const data = await Sistema.query(sql, [inicio, fim]);
            const roadmap = {}; const topMensal = {};
            data.forEach(row => {
                const uid = String(row.usuario_id);
                if (!roadmap[uid]) roadmap[uid] = { nome: row.nome, meses: {} };
                const vel = row.dias_trab > 0 ? (row.total_prod / row.dias_trab) : 0;
                roadmap[uid].meses[row.mes] = vel;
                if (!topMensal[row.mes] || vel > topMensal[row.mes]) topMensal[row.mes] = vel;
            });
            const dInicio = new Date(inicio + 'T12:00:00');
            const mesIni = dInicio.getMonth() + 1;
            const mesFim = new Date(fim + 'T12:00:00').getMonth() + 1;
            this.renderizarGAP(roadmap, topMensal, mesIni, mesFim);
        } catch (e) { console.error(e); }
    },

    renderizarGAP: function(roadmap, topMensal, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;
        const mesesStr = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const listaAssist = Object.values(roadmap).sort((a,b) => a.nome.localeCompare(b.nome));
        let html = `<div class="space-y-6 animate-enter"><div class="bg-rose-50 p-4 rounded-xl flex items-center gap-3"><div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm"><i class="fas fa-chart-line"></i></div><div><h4 class="text-rose-900 font-black text-sm">Análise de GAP e Evolução</h4><p class="text-rose-600 text-[10px] uppercase font-bold tracking-wider">Média Diária entre Assistentes (Top Performance)</p></div></div><div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white"><table class="w-full text-left text-xs"><thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px]"><tr><th class="px-4 py-4 sticky left-0 bg-slate-50 z-10">Assistente</th>`;
        for (let m = mesIni; m <= mesFim; m++) html += `<th class="px-3 py-4 text-center whitespace-nowrap">${mesesStr[m-1]}</th>`;
        html += `<th class="px-4 py-4 text-center bg-slate-100/50">Evolução (%)</th><th class="px-4 py-4 text-right bg-slate-100/50">Gap (vs TOP)</th></tr></thead><tbody class="divide-y divide-slate-100">`;
        listaAssist.forEach(assist => {
            let pV = null, uV = null, curV = 0;
            html += `<tr class="hover:bg-slate-50 transition"><td class="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100">${assist.nome}</td>`;
            for (let m = mesIni; m <= mesFim; m++) {
                const v = assist.meses[m] || 0;
                if (v > 0) { if (pV === null) pV = v; uV = v; curV = v; }
                const isTop = v > 0 && v >= (topMensal[m] || 0);
                html += `<td class="px-3 py-3 text-center"><span class="font-black ${isTop ? 'text-emerald-600' : 'text-slate-600'}">${v > 0 ? Math.round(v) : '--'}</span></td>`;
            }
            let ev = (pV > 0 && uV > 0) ? ((uV / pV) - 1) * 100 : 0;
            const topU = topMensal[mesFim] || 0; const gap = topU - curV;
            html += `<td class="px-4 py-3 text-center bg-slate-50/30 font-black ${ev > 0 ? 'text-emerald-600' : 'text-rose-600'}">${ev.toFixed(1)}%</td><td class="px-4 py-3 text-right bg-slate-50/30 font-black ${gap <= 0 ? 'text-emerald-600' : 'text-amber-600'}">${gap <= 0 ? 'TOP' : `-${Math.round(gap)}`}</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        container.innerHTML = html;
    },

    copiarLinha: function(tipo, mes, meta, realizado, ating) {
        const titulo = tipo === 'PROD' ? 'Produção' : 'Assertividade';
        const texto = `${titulo} - ${mes}:\nMeta: ${meta} | Realizado: ${realizado} | Atingimento: ${ating}%`;
        this.executarCopia(texto);
    },

    copiarRelatorio: function(tipo, ano) {
        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const titulo = tipo === 'PROD' ? '📈 RELATÓRIO DE PRODUÇÃO' : '✅ RELATÓRIO DE ASSERTIVIDADE';
        let texto = `${titulo} - ${ano}\n\n`;
        const { mesIni, mesFim } = this._lastMesRange || { mesIni: 1, mesFim: 12 };
        if (tipo === 'PROD') {
            let tM = 0, cM = 0, tP = 0, tD = 0;
            for (let i = mesIni - 1; i < mesFim; i++) {
                const mN = i + 1;
                const mObj = (this._lastMetas || []).find(x => Number(x.mes) === mN);
                const pObj = (this._lastProd || []).find(x => Number(x.mes) === mN);
                const mVal = mObj ? (Number(mObj.meta_producao) || 0) : 0;
                const rT = pObj ? pObj.total_prod : 0;
                const d = pObj ? pObj.denominador : 0;
                const rV = d > 0 ? (rT / d) : 0;
                if (rV > 0 || mVal > 0) {
                    const p = mVal > 0 ? (rV / mVal) * 100 : 0;
                    texto += `${mesesStr[i]}: Meta ${mVal.toLocaleString()} | Realizado ${Math.round(rV).toLocaleString()} | Ating. ${p.toFixed(1)}%\n`;
                    if (mVal > 0) { tM += mVal; cM++; }
                    tP += rT; tD += d;
                }
            }
            if (tD > 0 || tM > 0) { const aM = cM > 0 ? (tM / cM) : 0; const aR = tP / tD; const aP = aM > 0 ? (aR / aM * 100) : 0; texto += `\nACUMULADO: Meta ${Math.round(aM).toLocaleString()} | Realizado ${Math.round(aR).toLocaleString()} | Ating. ${aP.toFixed(1)}%`; }
        } else {
            let tM = 0, cM = 0, sA = 0, cA = 0;
            for (let i = mesIni - 1; i < mesFim; i++) {
                const mN = i + 1;
                const mObj = (this._lastMetas || []).find(x => Number(x.mes) === mN);
                const aObj = (this._lastAssert || []).find(x => Number(x.mes) === mN);
                const mVal = mObj ? (Number(mObj.meta_assertividade) || 97) : 97;
                const rV = aObj ? aObj.assert : 0;
                if (rV > 0 || mVal > 0) {
                    let at = (rV > 0) ? (rV < 90 ? 0 : (rV < 94 ? 50 : (rV < 95 ? 70 : (rV < 96 ? 80 : (rV <= 97 ? 90 : 100))))) : 0;
                    texto += `${mesesStr[i]}: Meta ${mVal}% | Realizado ${rV.toFixed(2)}% | Ating. ${at}%\n`;
                    if (mVal > 0) { tM += mVal; cM++; } if (rV > 0) { sA += rV; cA++; }
                }
            }
            if (cA > 0) { const aM = cM > 0 ? tM / cM : 97; const aR = sA / cA; let aT = (aR > 0) ? (aR < 90 ? 0 : (aR < 94 ? 50 : (aR < 95 ? 70 : (aR < 96 ? 80 : (aR <= 97 ? 90 : 100))))) : 0; texto += `\nACUMULADO: Meta ${Math.round(aM)}% | Realizado ${aR.toFixed(2)}% | Ating. ${aT}%`; }
        }
        this.executarCopia(texto);
    },

    executarCopia: function(texto) {
        navigator.clipboard.writeText(texto).then(() => {
            const t = document.createElement('div');
            t.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold animate-bounce z-[100]';
            t.innerHTML = '<i class="fas fa-check-circle text-emerald-400 mr-2"></i> Copiado!';
            document.body.appendChild(t); setTimeout(() => t.remove(), 2500);
        });
    }
};
