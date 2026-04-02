/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,
    ID_LIDERANCA: '1074356', // ID da Roberta (Baseline para Meta de Gestão)

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
            
            const { inicio, fim } = datas;
            const dInicio = new Date(inicio + 'T12:00:00');
            const dFim = new Date(fim + 'T12:00:00');
            const ano = dInicio.getFullYear();
            const mesIni = dInicio.getMonth() + 1;
            const mesFim = dFim.getMonth() + 1;

            // 1. DETERMINA ALVO DA META
            let userTargetForMeta = alvoId;
            if (MinhaArea.isAdmin()) {
                if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS') {
                    userTargetForMeta = this.ID_LIDERANCA;
                }
            } else {
                userTargetForMeta = myId;
            }

            // SQL Metas
            let sqlMetas = `SELECT * FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`;
            let paramsMetas = [ano, mesIni, mesFim, userTargetForMeta];
            const metas = await Sistema.query(sqlMetas, paramsMetas);
            
            // 2. SQL PRODUÇÃO (Com filtros robustos de grupo e gestão)
            let sqlProd = `
                SELECT 
                    p.mes_referencia as mes, 
                    SUM(p.quantidade) as total_prod,
                    COUNT(DISTINCT CONCAT(p.usuario_id, '_', p.data_referencia)) as dias_trab
                FROM producao p
                JOIN usuarios u ON p.usuario_id = u.id
                WHERE p.data_referencia >= ? AND p.data_referencia <= ?
            `;
            let paramsProd = [inicio, fim];

            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlProd += ` AND p.usuario_id = ? `;
                paramsProd.push(alvoId);
            } else {
                // Filtros de Grupo
                if (alvoId === 'GRUPO_CLT') {
                    sqlProd += ` AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE '%pj%' AND LOWER(u.contrato) NOT LIKE '%terceiro%')) `;
                } else if (alvoId === 'GRUPO_TERCEIROS') {
                    sqlProd += ` AND (LOWER(u.contrato) LIKE '%pj%' OR LOWER(u.contrato) LIKE '%terceiro%') `;
                }

                // Filtro Exclusão Gestão (HEADCOUNT logic)
                const forbidden = ['GESTOR', 'AUDITOR', 'LIDER', 'LÍDER', 'COORDENA', 'HEAD', 'DIRETOR'];
                sqlProd += ` AND NOT (${forbidden.map(f => `COALESCE(LOWER(u.funcao),'') LIKE '%${f.toLowerCase()}%' OR COALESCE(LOWER(u.perfil),'') LIKE '%${f.toLowerCase()}%'`).join(' OR ')})`;
            }

            sqlProd += ` GROUP BY p.mes_referencia ORDER BY p.mes_referencia`;
            const producao = await Sistema.query(sqlProd, paramsProd);

            // 3. SQL ASSERTIVIDADE
            let sqlAssert = `
                SELECT 
                    MONTH(a.data_referencia) as mes,
                    AVG(a.assertividade_val) as media_assert
                FROM assertividade a
                JOIN usuarios u ON a.usuario_id = u.id
                WHERE a.data_referencia >= ? AND a.data_referencia <= ?
            `;
            let paramsAssert = [inicio, fim];
            
            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlAssert += ` AND a.usuario_id = ? `;
                paramsAssert.push(alvoId);
            } else {
                if (alvoId === 'GRUPO_CLT') {
                    sqlAssert += ` AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE '%pj%' AND LOWER(u.contrato) NOT LIKE '%terceiro%')) `;
                } else if (alvoId === 'GRUPO_TERCEIROS') {
                    sqlAssert += ` AND (LOWER(u.contrato) LIKE '%pj%' OR LOWER(u.contrato) LIKE '%terceiro%') `;
                }
                const forbidden = ['GESTOR', 'AUDITOR', 'LIDER', 'LÍDER', 'COORDENA', 'HEAD', 'DIRETOR'];
                sqlAssert += ` AND NOT (${forbidden.map(f => `COALESCE(LOWER(u.funcao),'') LIKE '%${f.toLowerCase()}%' OR COALESCE(LOWER(u.perfil),'') LIKE '%${f.toLowerCase()}%'`).join(' OR ')})`;
            }
            sqlAssert += ` GROUP BY MONTH(a.data_referencia) ORDER BY mes`;
            const assertividade = await Sistema.query(sqlAssert, paramsAssert);

            this.renderizarMetasOKR(metas, producao, assertividade, ano, mesIni, mesFim);

        } catch (e) {
            console.error("Erro ao carregar Metas OKR:", e);
            document.getElementById('relatorio-ativo-content').innerHTML = `
                <div class="p-8 text-center text-rose-500 font-bold">
                    Erro ao carregar dados do relatório.
                </div>
            `;
        }
    },

    renderizarMetasOKR: function(metas, producao, assertividade, ano, mesIni, mesFim) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;

        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let periodoStr = `${ano}`;
        if (mesIni === mesFim) periodoStr = `${mesesStr[mesIni-1]} / ${ano}`;
        else if (mesIni === 1 && mesFim === 6) periodoStr = `1º Semestre / ${ano}`;
        else if (mesIni === 7 && mesFim === 12) periodoStr = `2º Semestre / ${ano}`;
        else if (mesIni !== 1 || mesFim !== 12) periodoStr = `${mesesStr[mesIni-1]} a ${mesesStr[mesFim-1]} / ${ano}`;

        let html = `
            <div class="space-y-6 animate-enter">
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    <!-- RELATÓRIO DE PRODUÇÃO -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-end px-1">
                            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i class="fas fa-layer-group text-blue-500"></i> Produção (Velocidade) - ${periodoStr}
                            </h3>
                            <button onclick="MinhaArea.Relatorios.copiarRelatorio('PROD', '${periodoStr}')" 
                                    class="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition">
                                <i class="fas fa-copy"></i> Copiar Tabela
                            </button>
                        </div>
                        <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                            <table class="w-full text-left text-sm" id="table-rel-prod">
                                <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th class="px-4 py-3">Mês</th>
                                        <th class="px-4 py-3 text-right">Meta</th>
                                        <th class="px-4 py-3 text-right">Realizado</th>
                                        <th class="px-4 py-3 text-center">Ating.</th>
                                        <th class="px-4 py-3 text-center w-8"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
        `;

        let totalMetaP = 0, countMesesMetaP = 0, totalProdP = 0, totalDiasP = 0;

        for (let i = mesIni - 1; i < mesFim; i++) {
            const nomeMes = mesesStr[i];
            const mesNum = i + 1;
            
            const metaObj = (metas || []).find(m => Number(m.mes) === mesNum);
            const prodObj = (producao || []).find(p => Number(p.mes) === mesNum);

            const metaVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
            const realizTotal = prodObj ? (Number(prodObj.total_prod) || 0) : 0;
            const diasTrab = prodObj ? (Number(prodObj.dias_trab) || 0) : 0;
            
            const realizado = diasTrab > 0 ? (realizTotal / diasTrab) : 0;
            const porcentagem = metaVal > 0 ? (realizado / metaVal) * 100 : 0;
            
            if (metaVal > 0) { totalMetaP += metaVal; countMesesMetaP++; }
            totalProdP += realizTotal;
            totalDiasP += diasTrab;

            const colorClass = porcentagem >= 100 ? 'text-emerald-600 bg-emerald-50' : (porcentagem >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');

            html += `
                <tr class="hover:bg-slate-50/50 transition group ${realizado === 0 && metaVal === 0 ? 'opacity-40' : ''}">
                    <td class="px-4 py-2.5 font-bold text-slate-700">${nomeMes}</td>
                    <td class="px-4 py-2.5 font-medium text-slate-600 text-right">${metaVal > 0 ? metaVal.toLocaleString() : '--'}</td>
                    <td class="px-4 py-2.5 font-black text-blue-600 text-right">${realizado > 0 ? Math.round(realizado).toLocaleString() : '--'}</td>
                    <td class="px-4 py-2.5 text-center">
                        ${realizado > 0 ? `
                        <span class="px-2 py-0.5 rounded-full font-black text-[10px] ${colorClass}">
                            ${porcentagem.toFixed(1)}%
                        </span>` : '--'}
                    </td>
                    <td class="px-4 py-2.5 text-center">
                        ${realizado > 0 ? `
                        <button onclick="MinhaArea.Relatorios.copiarLinha('PROD', '${nomeMes}', '${metaVal}', '${Math.round(realizado)}', '${porcentagem.toFixed(1)}')" 
                                class="w-6 h-6 rounded bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 transition opacity-0 group-hover:opacity-100">
                            <i class="fas fa-copy text-[9px]"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
        }

        const avgMetaP = countMesesMetaP > 0 ? (totalMetaP / countMesesMetaP) : 0;
        const avgRealP = totalDiasP > 0 ? (totalProdP / totalDiasP) : 0;
        const avgPctP = avgMetaP > 0 ? (avgRealP / avgMetaP) * 100 : 0;

        html += `
                                </tbody>
                                <tfoot class="bg-slate-50 border-t-2 border-slate-200 font-black">
                                    <tr class="group/acc">
                                        <td class="px-4 py-3 text-slate-800">Acumulado</td>
                                        <td class="px-4 py-3 text-right text-slate-600">${Math.round(avgMetaP).toLocaleString()}</td>
                                        <td class="px-4 py-3 text-right text-blue-700 bg-emerald-50/30">${Math.round(avgRealP).toLocaleString()}</td>
                                        <td class="px-4 py-3 text-center">
                                            <span class="px-2 py-1 rounded-lg font-black text-[11px] bg-amber-500 text-white shadow-sm">
                                                ${avgPctP.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <button onclick="MinhaArea.Relatorios.copiarLinha('PROD', 'Acumulado', '${Math.round(avgMetaP)}', '${Math.round(avgRealP)}', '${avgPctP.toFixed(1)}')" 
                                                    class="w-6 h-6 rounded bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white transition opacity-0 group-hover/acc:opacity-100">
                                                <i class="fas fa-copy text-[9px]"></i>
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <!-- RELATÓRIO DE ASSERTIVIDADE -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-end px-1">
                            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i class="fas fa-check-double text-emerald-500"></i> Assertividade (Qualidade) - ${periodoStr}
                            </h3>
                            <button onclick="MinhaArea.Relatorios.copiarRelatorio('ASSERT', '${periodoStr}')" 
                                    class="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition">
                                <i class="fas fa-copy"></i> Copiar Tabela
                            </button>
                        </div>
                        <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                            <table class="w-full text-left text-sm" id="table-rel-assert">
                                <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th class="px-4 py-3">Mês</th>
                                        <th class="px-4 py-3 text-right">Meta</th>
                                        <th class="px-4 py-3 text-right">Realizado</th>
                                        <th class="px-4 py-3 text-center">Ating.</th>
                                        <th class="px-4 py-3 text-center w-8"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
        `;

        let totalMetaA = 0, countMesesMetaA = 0, sumMediaAssert = 0, countMesesAssert = 0;

        for (let i = mesIni - 1; i < mesFim; i++) {
            const nomeMes = mesesStr[i];
            const mesNum = i + 1;
            const metaObj = (metas || []).find(m => Number(m.mes) === mesNum);
            const assertObj = (assertividade || []).find(a => Number(a.mes) === mesNum);

            const metaVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
            const realizado = assertObj ? (Number(assertObj.media_assert) || 0) : 0;
            
            let atingimento = 0;
            if (realizado > 0) {
                if (realizado < 90) atingimento = 0;
                else if (realizado < 94) atingimento = 50;
                else if (realizado < 95) atingimento = 70;
                else if (realizado < 96) atingimento = 80;
                else if (realizado <= 97) atingimento = 90;
                else atingimento = 100;
            }

            if (metaVal > 0) { totalMetaA += metaVal; countMesesMetaA++; }
            if (realizado > 0) { sumMediaAssert += realizado; countMesesAssert++; }

            const colorClass = realizado >= metaVal ? 'text-emerald-600 bg-emerald-50' : (realizado >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');

            html += `
                <tr class="hover:bg-slate-50/50 transition group ${realizado === 0 && metaVal === 0 ? 'opacity-40' : ''}">
                    <td class="px-4 py-2.5 font-bold text-slate-700">${nomeMes}</td>
                    <td class="px-4 py-2.5 font-medium text-slate-600 text-right">${metaVal}%</td>
                    <td class="px-4 py-2.5 font-black text-emerald-600 text-right">${realizado > 0 ? realizado.toFixed(2) + '%' : '--'}</td>
                    <td class="px-4 py-2.5 text-center">
                        ${realizado > 0 ? `
                        <span class="px-2 py-0.5 rounded-full font-black text-[10px] ${colorClass}">
                            ${atingimento}%
                        </span>` : '--'}
                    </td>
                    <td class="px-4 py-2.5 text-center">
                        ${realizado > 0 ? `
                        <button onclick="MinhaArea.Relatorios.copiarLinha('ASSERT', '${nomeMes}', '${metaVal}%', '${realizado.toFixed(2)}%', '${atingimento}')" 
                                class="w-6 h-6 rounded bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 transition opacity-0 group-hover:opacity-100">
                            <i class="fas fa-copy text-[9px]"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
        }

        const avgMetaA = countMesesMetaA > 0 ? (totalMetaA / countMesesMetaA) : 97;
        const avgRealA = countMesesAssert > 0 ? (sumMediaAssert / countMesesAssert) : 0;
        
        let avgAtingA = 0;
        if (avgRealA > 0) {
            if (avgRealA < 90) avgAtingA = 0;
            else if (avgRealA < 94) avgAtingA = 50;
            else if (avgRealA < 95) avgAtingA = 70;
            else if (avgRealA < 96) avgAtingA = 80;
            else if (avgRealA <= 97) avgAtingA = 90;
            else avgAtingA = 100;
        }

        html += `
                                </tbody>
                                <tfoot class="bg-slate-50 border-t-2 border-slate-200 font-black">
                                    <tr class="group/acc">
                                        <td class="px-4 py-3 text-slate-800">Acumulado</td>
                                        <td class="px-4 py-3 text-right text-slate-600">${Math.round(avgMetaA)}%</td>
                                        <td class="px-4 py-3 text-right text-emerald-700 bg-emerald-50/30">${avgRealA.toFixed(2)}%</td>
                                        <td class="px-4 py-3 text-center">
                                            <span class="px-2 py-1 rounded-lg font-black text-[11px] bg-amber-500 text-white shadow-sm">
                                                ${avgAtingA}%
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 text-center">
                                            <button onclick="MinhaArea.Relatorios.copiarLinha('ASSERT', 'Acumulado', '${Math.round(avgMetaA)}%', '${avgRealA.toFixed(2)}%', '${avgAtingA}')" 
                                                    class="w-6 h-6 rounded bg-amber-100 text-amber-600 hover:bg-amber-500 hover:text-white transition opacity-0 group-hover/acc:opacity-100">
                                                <i class="fas fa-copy text-[9px]"></i>
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this._lastMetas = metas;
        this._lastProd = producao;
        this._lastAssert = assertividade;
        this._lastMesRange = { mesIni, mesFim };
    },

    carregarGAP: async function() {
        try {
            if (!MinhaArea.isAdmin()) return;
            const datas = MinhaArea.getDatasFiltro();
            if (!datas) return;

            const { inicio, fim } = datas;
            const dInicio = new Date(inicio + 'T12:00:00');
            const dFim = new Date(fim + 'T12:00:00');
            const mesIni = dInicio.getMonth() + 1;
            const mesFim = dFim.getMonth() + 1;

            let sql = `
                SELECT 
                    p.usuario_id, 
                    u.nome,
                    p.mes_referencia as mes, 
                    SUM(p.quantidade) as total_prod,
                    COUNT(DISTINCT CONCAT(p.usuario_id, '_', p.data_referencia)) as dias_trab
                FROM producao p
                JOIN usuarios u ON p.usuario_id = u.id
                WHERE p.data_referencia >= ? AND p.data_referencia <= ?
                  AND u.ativo = 1
                GROUP BY p.usuario_id, u.nome, p.mes_referencia
                ORDER BY u.nome, p.mes_referencia
            `;
            const data = await Sistema.query(sql, [inicio, fim]);

            const roadmap = {};
            const topMensal = {};

            data.forEach(row => {
                const uid = String(row.usuario_id);
                if (!roadmap[uid]) roadmap[uid] = { nome: row.nome, meses: {} };
                const vel = row.dias_trab > 0 ? (row.total_prod / row.dias_trab) : 0;
                roadmap[uid].meses[row.mes] = vel;

                if (!topMensal[row.mes] || vel > topMensal[row.mes]) {
                    topMensal[row.mes] = vel;
                }
            });

            this.renderizarGAP(roadmap, topMensal, mesIni, mesFim, inicio, fim);

        } catch (e) {
            console.error("Erro ao carregar GAP:", e);
        }
    },

    renderizarGAP: function(roadmap, topMensal, mesIni, mesFim, dIni, dFim) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;

        const mesesStr = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const listaAssist = Object.values(roadmap).sort((a,b) => a.nome.localeCompare(b.nome));

        let html = `
            <div class="space-y-6 animate-enter">
                <div class="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm"><i class="fas fa-chart-line"></i></div>
                    <div>
                        <h4 class="text-rose-900 font-black text-sm">Análise de GAP e Evolução</h4>
                        <p class="text-rose-600 text-[10px] uppercase font-bold tracking-wider">Comparativo de Velocidade (Média Diária) entre Assistentes</p>
                    </div>
                </div>
                <div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white custom-scrollbar">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px]">
                            <tr><th class="px-4 py-4 sticky left-0 bg-slate-50 z-10 w-28">Assistente</th>
        `;

        for (let m = mesIni; m <= mesFim; m++) { html += `<th class="px-3 py-4 text-center whitespace-nowrap min-w-[70px]">${mesesStr[m-1]}</th>`; }
        html += `<th class="px-4 py-4 text-center bg-slate-100/50">Evolução (%)</th><th class="px-4 py-4 text-right bg-slate-100/50">Gap (vs TOP)</th></tr></thead><tbody class="divide-y divide-slate-100">`;

        listaAssist.forEach(assist => {
            let primeiroValor = null, ultimoValor = null, currentVel = 0;
            html += `<tr class="hover:bg-slate-50/50 transition"><td class="px-4 py-3 font-bold text-slate-700 sticky left-0 bg-white z-10 border-r border-slate-100 truncate max-w-[120px]" title="${assist.nome}">${assist.nome}</td>`;
            for (let m = mesIni; m <= mesFim; m++) {
                const vel = assist.meses[m] || 0;
                if (vel > 0) { if (primeiroValor === null) primeiroValor = vel; ultimoValor = vel; currentVel = vel; }
                const isTop = vel > 0 && vel >= (topMensal[m] || 0);
                html += `<td class="px-3 py-3 text-center"><span class="font-black ${isTop ? 'text-emerald-600' : 'text-slate-600'}">${vel > 0 ? Math.round(vel) : '--'}</span></td>`;
            }
            let evolPct = (primeiroValor > 0 && ultimoValor > 0) ? ((ultimoValor / primeiroValor) - 1) * 100 : 0;
            const evolClass = evolPct > 0 ? 'text-emerald-600' : (evolPct < 0 ? 'text-rose-600' : 'text-slate-400');
            const evolIcon = evolPct > 0 ? 'fa-arrow-up' : (evolPct < 0 ? 'fa-arrow-down' : 'fa-minus');
            const topUltimoMes = topMensal[mesFim] || 0;
            const gap = topUltimoMes - currentVel;
            const gapPct = topUltimoMes > 0 ? (gap / topUltimoMes) * 100 : 0;
            html += `<td class="px-4 py-3 text-center bg-slate-50/30"><span class="font-black ${evolClass} flex items-center justify-center gap-1"><i class="fas ${evolIcon} text-[8px]"></i>${evolPct.toFixed(1)}%</span></td><td class="px-4 py-3 text-right bg-slate-50/30 font-black ${gap <= 0 ? 'text-emerald-600' : 'text-amber-600'}">${gap <= 0 ? 'TOP' : `-${Math.round(gap)}`}</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        container.innerHTML = html;
        this._lastGAPData = roadmap;
    },

    copiarLinha: function(tipo, mes, meta, realizado, ating) {
        const titulo = tipo === 'PROD' ? 'Produção' : 'Assertividade';
        const texto = `${titulo} - ${mes}:\nMeta: ${meta} | Realizado: ${realizado} | Atingimento: ${ating}%`;
        this.executarCopia(texto);
    },

    copiarRelatorio: function(tipo, periodoStr) {
        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const titulo = tipo === 'PROD' ? '📈 RELATÓRIO DE PRODUÇÃO' : '✅ RELATÓRIO DE ASSERTIVIDADE';
        let texto = `${titulo} - ${periodoStr}\n\n`;
        const { mesIni, mesFim } = this._lastMesRange || { mesIni: 1, mesFim: 12 };
        if (tipo === 'PROD') {
            let tMeta = 0, cMeta = 0, tProd = 0, tDias = 0;
            for (let i = mesIni - 1; i < mesFim; i++) {
                const mesNum = i + 1;
                const metaObj = (this._lastMetas || []).find(x => Number(x.mes) === mesNum);
                const prodObj = (this._lastProd || []).find(x => Number(x.mes) === mesNum);
                const mVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
                const rTotal = prodObj ? (Number(prodObj.total_prod) || 0) : 0;
                const dias = prodObj ? (Number(prodObj.dias_trab) || 0) : 0;
                const rVal = dias > 0 ? (rTotal / dias) : 0;
                if (rVal > 0 || mVal > 0) {
                    const pct = mVal > 0 ? (rVal / mVal) * 100 : 0;
                    texto += `${mesesStr[i]}: Meta ${mVal.toLocaleString()} | Realizado ${Math.round(rVal).toLocaleString()} | Ating. ${pct.toFixed(1)}%\n`;
                    if (mVal > 0) { tMeta += mVal; cMeta++; }
                    tProd += rTotal; tDias += dias;
                }
            }
            if (tDias > 0 || tMeta > 0) {
                const avgM = cMeta > 0 ? (tMeta / cMeta) : 0;
                const avgR = tDias > 0 ? (tProd / tDias) : 0;
                const avgP = avgM > 0 ? (avgR / avgM * 100) : 0;
                texto += `\nACUMULADO: Meta ${Math.round(avgM).toLocaleString()} | Realizado ${Math.round(avgR).toLocaleString()} | Ating. ${avgP.toFixed(1)}%`;
            }
        } else {
            let tMeta = 0, cMeta = 0, sAssert = 0, cAssert = 0;
            for (let i = mesIni - 1; i < mesFim; i++) {
                const mesNum = i + 1;
                const metaObj = (this._lastMetas || []).find(x => Number(x.mes) === mesNum);
                const assertObj = (this._lastAssert || []).find(x => Number(x.mes) === mesNum);
                const mVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
                const rVal = assertObj ? (Number(assertObj.media_assert) || 0) : 0;
                if (rVal > 0 || mVal > 0) {
                    let ating = 0;
                    if (rVal > 0) { if (rVal < 90) ating = 0; else if (rVal < 94) ating = 50; else if (rVal < 95) ating = 70; else if (rVal < 96) ating = 80; else if (rVal <= 97) ating = 90; else ating = 100; }
                    texto += `${mesesStr[i]}: Meta ${mVal}% | Realizado ${rVal > 0 ? rVal.toFixed(2) + '%' : '--'} | Ating. ${ating}%\n`;
                    if (mVal > 0) { tMeta += mVal; cMeta++; }
                    if (rVal > 0) { sAssert += rVal; cAssert++; }
                }
            }
            if (cAssert > 0 || cMeta > 0) {
                const avgM = cMeta > 0 ? (tMeta / cMeta) : 97;
                const avgR = cAssert > 0 ? (sAssert / cAssert) : 0;
                let ating = (avgR > 0) ? (avgR < 90 ? 0 : (avgR < 94 ? 50 : (avgR < 95 ? 70 : (avgR < 96 ? 80 : (avgR <= 97 ? 90 : 100))))) : 0;
                texto += `\nACUMULADO: Meta ${Math.round(avgM)}% | Realizado ${avgR.toFixed(2)}% | Ating. ${ating}%`;
            }
        }
        this.executarCopia(texto);
    },

    executarCopia: function(texto) {
        navigator.clipboard.writeText(texto).then(() => {
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl text-xs font-bold animate-bounce z-[100] border border-slate-700';
            toast.innerHTML = '<i class="fas fa-check-circle text-emerald-400 mr-2"></i> Copiado para a área de transferência!';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
        });
    }
};
