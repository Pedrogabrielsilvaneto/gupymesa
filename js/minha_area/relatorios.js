/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,

    init: function() {
        console.log("📊 Relatórios da Minha Área Inicializado.");
    },

    mudarRelatorio: function(id) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;

        // Se clicar no mesmo que já está aberto, recolhe
        if (this.relatorioAtivo === id) {
            this.relatorioAtivo = null;
            container.innerHTML = '';
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
        }
    },

    carregarMetasOKR: async function() {
        try {
            const datas = MinhaArea.getDatasFiltro();
            if (!datas) return;

            const alvoId = MinhaArea.getUsuarioAlvo();
            const myId = MinhaArea.usuario ? MinhaArea.usuario.id : null;
            
            const { inicio, fim } = datas;
            const ano = new Date(inicio + 'T12:00:00').getFullYear();

            let sqlMetas = `SELECT * FROM metas WHERE ano = ?`;
            let paramsMetas = [ano];
            
            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlMetas += ` AND usuario_id = ?`;
                paramsMetas.push(alvoId);
            } else if (!MinhaArea.isAdmin() && myId) {
                sqlMetas += ` AND usuario_id = ?`;
                paramsMetas.push(myId);
            }

            const metas = await Sistema.query(sqlMetas, paramsMetas);
            
            let sqlProd = `
                SELECT 
                    mes_referencia as mes, 
                    SUM(quantidade) as total_prod,
                    COUNT(DISTINCT CONCAT(usuario_id, '_', data_referencia)) as dias_trab
                FROM producao 
                WHERE ano_referencia = ?
            `;
            let paramsProd = [ano];

            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlProd += ` AND usuario_id = ?`;
                paramsProd.push(alvoId);
            } else if (!MinhaArea.isAdmin() && myId) {
                sqlProd += ` AND usuario_id = ?`;
                paramsProd.push(myId);
            }
            sqlProd += ` GROUP BY mes_referencia ORDER BY mes_referencia`;

            const producao = await Sistema.query(sqlProd, paramsProd);

            let sqlAssert = `
                SELECT 
                    MONTH(data_referencia) as mes,
                    AVG(assertividade_val) as media_assert
                FROM assertividade
                WHERE YEAR(data_referencia) = ?
            `;
            let paramsAssert = [ano];
            
            if (alvoId && alvoId !== 'EQUIPE' && alvoId !== 'GRUPO_CLT' && alvoId !== 'GRUPO_TERCEIROS') {
                sqlAssert += ` AND usuario_id = ?`;
                paramsAssert.push(alvoId);
            } else if (!MinhaArea.isAdmin() && myId) {
                sqlAssert += ` AND usuario_id = ?`;
                paramsAssert.push(myId);
            }
            sqlAssert += ` GROUP BY MONTH(data_referencia) ORDER BY mes`;
            
            const assertividade = await Sistema.query(sqlAssert, paramsAssert);

            this.renderizarMetasOKR(metas, producao, assertividade, ano);

        } catch (e) {
            console.error("Erro ao carregar Metas OKR:", e);
            document.getElementById('relatorio-ativo-content').innerHTML = `
                <div class="p-8 text-center text-rose-500 font-bold">
                    Erro ao carregar dados do relatório.
                </div>
            `;
        }
    },

    renderizarMetasOKR: function(metas, producao, assertividade, ano) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;

        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let html = `
            <div class="space-y-6 animate-enter">
                
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    <!-- RELATÓRIO DE PRODUÇÃO -->
                    <div class="space-y-4">
                        <div class="flex justify-between items-end px-1">
                            <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <i class="fas fa-layer-group text-blue-500"></i> Produção (Velocidade) - ${ano}
                            </h3>
                            <button onclick="MinhaArea.Relatorios.copiarRelatorio('PROD', ${ano})" 
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

        let totalMetaP = 0;
        let countMesesMetaP = 0;
        let totalProdP = 0;
        let totalDiasP = 0;

        mesesStr.forEach((nomeMes, i) => {
            const mesNum = i + 1;
            const metaObj = (metas || []).find(m => m.mes === mesNum);
            const prodObj = (producao || []).find(p => p.mes === mesNum);

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
                <tr class="hover:bg-slate-50/50 transition group ${realizado === 0 ? 'opacity-40' : ''}">
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
        });

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
                                            <button onclick="MinhaArea.Relatorios.copiarLinha('PROD', 'Acumulado Anual', '${Math.round(avgMetaP)}', '${Math.round(avgRealP)}', '${avgPctP.toFixed(1)}')" 
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
                                <i class="fas fa-check-double text-emerald-500"></i> Assertividade (Qualidade) - ${ano}
                            </h3>
                            <button onclick="MinhaArea.Relatorios.copiarRelatorio('ASSERT', ${ano})" 
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

        let totalMetaA = 0;
        let countMesesMetaA = 0;
        let sumMediaAssert = 0;
        let countMesesAssert = 0;

        mesesStr.forEach((nomeMes, i) => {
            const mesNum = i + 1;
            const metaObj = (metas || []).find(m => m.mes === mesNum);
            const assertObj = (assertividade || []).find(a => a.mes === mesNum);

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
                <tr class="hover:bg-slate-50/50 transition group ${realizado === 0 ? 'opacity-40' : ''}">
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
        });

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
                                            <button onclick="MinhaArea.Relatorios.copiarLinha('ASSERT', 'Acumulado Anual', '${Math.round(avgMetaA)}%', '${avgRealA.toFixed(2)}%', '${avgAtingA}')" 
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
        
        if (tipo === 'PROD') {
            let tMeta = 0, cMeta = 0, tProd = 0, tDias = 0;
            mesesStr.forEach((m, i) => {
                const mesNum = i + 1;
                const metaObj = (this._lastMetas || []).find(x => x.mes === mesNum);
                const prodObj = (this._lastProd || []).find(x => x.mes === mesNum);
                const mVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
                const rTotal = prodObj ? (Number(prodObj.total_prod) || 0) : 0;
                const dias = prodObj ? (Number(prodObj.dias_trab) || 0) : 0;
                const rVal = dias > 0 ? (rTotal / dias) : 0;
                
                if (rVal > 0) {
                    const pct = mVal > 0 ? (rVal / mVal) * 100 : 0;
                    texto += `${m}: Meta ${mVal.toLocaleString()} | Realizado ${Math.round(rVal).toLocaleString()} | Ating. ${pct.toFixed(1)}%\n`;
                    tMeta += mVal; cMeta++; tProd += rTotal; tDias += dias;
                }
            });
            if (tDias > 0) {
                const avgM = tMeta / cMeta;
                const avgR = tProd / tDias;
                const avgP = avgM > 0 ? (avgR / avgM * 100) : 0;
                texto += `\nACUMULADO: Meta ${Math.round(avgM).toLocaleString()} | Realizado ${Math.round(avgR).toLocaleString()} | Ating. ${avgP.toFixed(1)}%`;
            }
        } else {
            let tMeta = 0, cMeta = 0, sAssert = 0, cAssert = 0;
            mesesStr.forEach((m, i) => {
                const mesNum = i + 1;
                const metaObj = (this._lastMetas || []).find(x => x.mes === mesNum);
                const assertObj = (this._lastAssert || []).find(x => x.mes === mesNum);
                const mVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
                const rVal = assertObj ? (Number(assertObj.media_assert) || 0) : 0;
                
                if (rVal > 0) {
                    let ating = 0;
                    if (rVal < 90) ating = 0; else if (rVal < 94) ating = 50; else if (rVal < 95) ating = 70; else if (rVal < 96) ating = 80; else if (rVal <= 97) ating = 90; else ating = 100;
                    texto += `${m}: Meta ${mVal}% | Realizado ${rVal.toFixed(2)}% | Ating. ${ating}%\n`;
                    tMeta += mVal; cMeta++; sAssert += rVal; cAssert++;
                }
            });
            if (cAssert > 0) {
                const avgM = tMeta / cMeta;
                const avgR = sAssert / cAssert;
                let ating = 0;
                if (avgR < 90) ating = 0; else if (avgR < 94) ating = 50; else if (avgR < 95) ating = 70; else if (avgR < 96) ating = 80; else if (avgR <= 97) ating = 90; else ating = 100;
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
