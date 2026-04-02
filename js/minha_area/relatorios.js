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
            <div class="space-y-10 animate-enter">
                
                <!-- RELATÓRIO DE PRODUÇÃO -->
                <div>
                    <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i class="fas fa-layer-group text-blue-500"></i> Relatório de Produção (Validação) - ${ano}
                    </h3>
                    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                        <table class="w-full text-left text-sm">
                            <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                <tr>
                                    <th class="px-6 py-4">Mês</th>
                                    <th class="px-6 py-4">Meta do Mês</th>
                                    <th class="px-6 py-4">Realizado</th>
                                    <th class="px-6 py-4 text-center">% Atingimento</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
        `;

        mesesStr.forEach((nomeMes, i) => {
            const mesNum = i + 1;
            
            // Se for Geral, precisamos somar as metas de todos os usuários ou usar a meta da equipe (ConfigMes)
            // Para simplicidade inicial, vamos considerar a meta média se for individual
            const metaObj = (metas || []).find(m => m.mes === mesNum);
            const prodObj = (producao || []).find(p => p.mes === mesNum);

            const metaVal = metaObj ? (metaObj.meta_producao || 0) : 0;
            const realizado = prodObj ? (prodObj.total_prod || 0) : 0;
            const porcentagem = metaVal > 0 ? (realizado / metaVal) * 100 : (realizado > 0 ? 100 : 0);
            
            const colorClass = porcentagem >= 100 ? 'text-emerald-600 bg-emerald-50' : (porcentagem >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');

            html += `
                <tr class="hover:bg-slate-50/50 transition">
                    <td class="px-6 py-4 font-bold text-slate-700">${nomeMes}</td>
                    <td class="px-6 py-4 font-medium text-slate-600">${metaVal.toLocaleString()}</td>
                    <td class="px-6 py-4 font-black text-blue-600">${realizado.toLocaleString()}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-3 py-1 rounded-full font-black text-[11px] ${colorClass}">
                            ${porcentagem.toFixed(2)}%
                        </span>
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
                <div>
                    <h3 class="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i class="fas fa-check-double text-emerald-500"></i> Relatório de Assertividade (Qualidade) - ${ano}
                    </h3>
                    <div class="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
                        <table class="w-full text-left text-sm">
                            <thead class="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[10px]">
                                <tr>
                                    <th class="px-6 py-4">Mês</th>
                                    <th class="px-6 py-4">Meta do Mês</th>
                                    <th class="px-6 py-4">Realizado</th>
                                    <th class="px-6 py-4 text-center">% Atingimento</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
        `;

        mesesStr.forEach((nomeMes, i) => {
            const mesNum = i + 1;
            const metaObj = (metas || []).find(m => m.mes === mesNum);
            const assertObj = (assertividade || []).find(a => a.mes === mesNum);

            const metaVal = metaObj ? (metaObj.meta_assertividade || 97) : 97; // Padrão 97%
            const realizado = assertObj ? (assertObj.media_assert || 0) : 0;
            const atingimento = realizado >= metaVal ? 100 : (realizado > 0 ? (realizado / metaVal) * 100 : 0);
            
            const colorClass = realizado >= metaVal ? 'text-emerald-600 bg-emerald-50' : (realizado >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');

            html += `
                <tr class="hover:bg-slate-50/50 transition">
                    <td class="px-6 py-4 font-bold text-slate-700">${nomeMes}</td>
                    <td class="px-6 py-4 font-medium text-slate-600">${metaVal}%</td>
                    <td class="px-6 py-4 font-black text-emerald-600">${realizado > 0 ? realizado.toFixed(2) + '%' : '--'}</td>
                    <td class="px-6 py-4 text-center">
                        <span class="px-3 py-1 rounded-full font-black text-[11px] ${colorClass}">
                            ${atingimento.toFixed(2)}%
                        </span>
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
        `;

        container.innerHTML = html;
    }
};
