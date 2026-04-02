/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,

    init: function() {
        console.log("📊 Relatórios da Minha Área Inicializado.");
    },

    mudarRelatorio: function(id) {
        this.relatorioAtivo = id;
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;

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
            
            // Reusar ou buscar dados necessários
            // Para simplificar, vamos buscar os dados de metas e produção do período selecionado
            
            const { inicio, fim } = datas;
            const ano = new Date(inicio + 'T12:00:00').getFullYear();

            // SQL para buscar as metas do usuário (ou equipe se for admin e geral)
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
            
            // SQL para buscar produção sumarizada por mês
            let sqlProd = `
                SELECT 
                    mes_referencia as mes, 
                    SUM(quantidade) as total_prod
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

            // SQL para buscar assertividade sumarizada por mês
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
                
                <!-- Header com Ações -->
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                        <h3 class="font-bold text-slate-700">Relatórios de Metas e OKR</h3>
                        <p class="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Visualização Anual - ${ano}</p>
                    </div>
                    <button onclick="MinhaArea.Relatorios.copiarRelatorioCompleto(${ano})" 
                            class="px-4 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition flex items-center gap-2">
                        <i class="fas fa-copy"></i> Copiar Relatório Completo
                    </button>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    
                    <!-- RELATÓRIO DE PRODUÇÃO -->
                    <div class="space-y-4">
                        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <i class="fas fa-layer-group text-blue-500"></i> Produção (Validação)
                        </h3>
                        <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                            <table class="w-full text-left text-sm" id="table-rel-prod">
                                <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th class="px-4 py-3">Mês</th>
                                        <th class="px-4 py-3 text-right">Meta</th>
                                        <th class="px-4 py-3 text-right">Realizado</th>
                                        <th class="px-4 py-3 text-center">Ating.</th>
                                        <th class="px-4 py-3 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
        `;

        mesesStr.forEach((nomeMes, i) => {
            const mesNum = i + 1;
            const metaObj = (metas || []).find(m => m.mes === mesNum);
            const prodObj = (producao || []).find(p => p.mes === mesNum);

            const metaVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
            const realizado = prodObj ? (Number(prodObj.total_prod) || 0) : 0;
            const porcentagem = metaVal > 0 ? (realizado / metaVal) * 100 : (realizado > 0 ? 100 : 0);
            
            const colorClass = porcentagem >= 100 ? 'text-emerald-600 bg-emerald-50' : (porcentagem >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');

            html += `
                <tr class="hover:bg-slate-50/50 transition group">
                    <td class="px-4 py-3 font-bold text-slate-700">${nomeMes}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-right">${metaVal.toLocaleString()}</td>
                    <td class="px-4 py-3 font-black text-blue-600 text-right">${realizado.toLocaleString()}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-0.5 rounded-full font-black text-[10px] ${colorClass}">
                            ${porcentagem.toFixed(1)}%
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="MinhaArea.Relatorios.copiarLinha('PROD', '${nomeMes}', ${metaVal}, ${realizado}, ${porcentagem.toFixed(1)})" 
                                class="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 transition opacity-0 group-hover:opacity-100">
                            <i class="fas fa-copy text-[10px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- RELATÓRIO DE ASSERTIVIDADE -->
                    <div class="space-y-4">
                        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
                            <i class="fas fa-check-double text-emerald-500"></i> Assertividade (Qualidade)
                        </h3>
                        <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                            <table class="w-full text-left text-sm" id="table-rel-assert">
                                <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                    <tr>
                                        <th class="px-4 py-3">Mês</th>
                                        <th class="px-4 py-3 text-right">Meta</th>
                                        <th class="px-4 py-3 text-right">Realizado</th>
                                        <th class="px-4 py-3 text-center">Ating.</th>
                                        <th class="px-4 py-3 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
        `;

        mesesStr.forEach((nomeMes, i) => {
            const mesNum = i + 1;
            const metaObj = (metas || []).find(m => m.mes === mesNum);
            const assertObj = (assertividade || []).find(a => a.mes === mesNum);

            const metaVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
            const realizado = assertObj ? (Number(assertObj.media_assert) || 0) : 0;
            const atingimento = realizado >= metaVal ? 100 : (realizado > 0 ? (realizado / metaVal) * 100 : 0);
            
            const colorClass = realizado >= metaVal ? 'text-emerald-600 bg-emerald-50' : (realizado >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');

            html += `
                <tr class="hover:bg-slate-50/50 transition group">
                    <td class="px-4 py-3 font-bold text-slate-700">${nomeMes}</td>
                    <td class="px-4 py-3 font-medium text-slate-600 text-right">${metaVal}%</td>
                    <td class="px-4 py-3 font-black text-emerald-600 text-right">${realizado > 0 ? realizado.toFixed(2) + '%' : '--'}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-0.5 rounded-full font-black text-[10px] ${colorClass}">
                            ${atingimento.toFixed(1)}%
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="MinhaArea.Relatorios.copiarLinha('ASSERT', '${nomeMes}', '${metaVal}%', '${realizado.toFixed(2)}%', ${atingimento.toFixed(1)})" 
                                class="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-emerald-100 hover:text-emerald-600 transition opacity-0 group-hover:opacity-100">
                            <i class="fas fa-copy text-[10px]"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                                </tbody>
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

    copiarRelatorioCompleto: function(ano) {
        const mesesStr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let texto = `📊 RELATÓRIO ANUAL GUPYMESA - ${ano}\n\n`;
        
        texto += `--- PRODUÇÃO (VALIDAÇÃO) ---\n`;
        mesesStr.forEach((m, i) => {
            const mesNum = i + 1;
            const metaObj = (this._lastMetas || []).find(x => x.mes === mesNum);
            const prodObj = (this._lastProd || []).find(x => x.mes === mesNum);
            const mVal = metaObj ? (Number(metaObj.meta_producao) || 0) : 0;
            const rVal = prodObj ? (Number(prodObj.total_prod) || 0) : 0;
            if (rVal > 0 || mVal > 0) {
                const pct = mVal > 0 ? (rVal / mVal) * 100 : (rVal > 0 ? 100 : 0);
                texto += `${m}: Meta ${mVal.toLocaleString()} | Realizado ${rVal.toLocaleString()} | Ating. ${pct.toFixed(1)}%\n`;
            }
        });

        texto += `\n--- ASSERTIVIDADE (QUALIDADE) ---\n`;
        mesesStr.forEach((m, i) => {
            const mesNum = i + 1;
            const metaObj = (this._lastMetas || []).find(x => x.mes === mesNum);
            const assertObj = (this._lastAssert || []).find(x => x.mes === mesNum);
            const mVal = metaObj ? (Number(metaObj.meta_assertividade) || 97) : 97;
            const rVal = assertObj ? (Number(assertObj.media_assert) || 0) : 0;
            if (rVal > 0) {
                const pct = rVal >= mVal ? 100 : (rVal / mVal) * 100;
                texto += `${m}: Meta ${mVal}% | Realizado ${rVal.toFixed(2)}% | Ating. ${pct.toFixed(1)}%\n`;
            }
        });

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
