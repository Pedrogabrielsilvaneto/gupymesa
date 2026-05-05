/* ARQUIVO: js/minha_area/relatorios.js
   DESCRIÇÃO: Módulo de Relatórios da Minha Área - V6.4.0 (Gráfico Comparativo)
*/

MinhaArea.Relatorios = {
    relatorioAtivo: null,
    ID_LIDERANCA: '432243', 
    VISITANTE_IDS: ['2026', '200601'],
    _gapData: null,
    _selectedGapUsers: new Set(),
    _gapBenchmarkId: null,

    init: function() {
        console.log("📊 Relatórios da Minha Área Inicializado.");
        const isAdmin = MinhaArea.isAdmin();
        const isThayla = (MinhaArea.usuario?.nome || '').toUpperCase().includes('THAYLA HUPERT');

        if (isAdmin || isThayla) {
            // Se for Thayla mas não Admin, só libera o Ranking
            if (isAdmin) {
                const btnGap = document.getElementById('btn-rel-gap');
                if (btnGap) btnGap.classList.remove('hidden');

                const btnContest = document.getElementById('btn-rel-contestacoes');
                const isAuditor = (MinhaArea.usuario?.funcao || '').toLowerCase().includes('audito');
                if (btnContest && (isAuditor || isAdmin)) btnContest.classList.remove('hidden');

                const btnExportTab = document.getElementById('btn-rel-exportar');
                if (btnExportTab) btnExportTab.classList.remove('hidden');
                
                const btnExport = document.getElementById('container-exportacao-gestao');
                if (btnExport) btnExport.classList.remove('hidden');
            }

            const btnRanking = document.getElementById('btn-rel-ranking');
            if (btnRanking) btnRanking.classList.remove('hidden');
        }

        // Inicia com o primeiro relatório por padrão
        if (isAdmin) {
            this.mudarRelatorio('metas_okr');
        } else if (isThayla) {
            this.mudarRelatorio('ranking_frases');
        }

        if (isAdmin) {
            const btnGapAnalise = document.getElementById('btn-rel-gap-analise');
            if (btnGapAnalise) btnGapAnalise.classList.remove('hidden');
        }
    },

    mudarRelatorio: function(id) {
        const container = document.getElementById('relatorio-ativo-content');
        if (!container) return;
        
        // Atualiza visual das ABAS
        const tabs = {
            'metas_okr': document.getElementById('tab-rel-metas'),
            'gap': document.getElementById('btn-rel-gap'),
            'gap_analise': document.getElementById('btn-rel-gap-analise'),
            'contestacoes': document.getElementById('btn-rel-contestacoes'),
            'ranking_frases': document.getElementById('btn-rel-ranking'),
            'excel_export': document.getElementById('btn-rel-exportar')
        };

        Object.keys(tabs).forEach(k => {
            const btn = tabs[k];
            if (!btn) return;
            if (k === id) {
                btn.classList.add('border-blue-600', 'text-blue-600');
                btn.classList.remove('border-transparent', 'text-slate-400');
            } else {
                btn.classList.remove('border-blue-600', 'text-blue-600');
                btn.classList.add('border-transparent', 'text-slate-400');
            }
        });

        // Toggle visibilidade dos containers
        const exportContainer = document.getElementById('container-exportacao-gestao');
        if (id === 'excel_export') {
            container.classList.add('hidden');
            if (exportContainer) exportContainer.classList.remove('hidden');
        } else {
            container.classList.remove('hidden');
            if (exportContainer) exportContainer.classList.add('hidden');
        }
        
        if (this.relatorioAtivo === id) return; 
        
        this.relatorioAtivo = id;
        if (id !== 'excel_export') {
            container.innerHTML = `<div class="flex items-center justify-center py-20 text-blue-600"><i class="fas fa-spinner fa-spin text-3xl"></i></div>`;
            if (id === 'metas_okr') this.carregarMetasOKR();
            else if (id === 'gap') this.carregarGAP11();
            else if (id === 'gap_analise') this.carregarAnaliseGAP();
            else if (id === 'contestacoes') this.carregarContestacoesReport();
            else if (id === 'ranking_frases') this.carregarRankingFrases();
        }
    },

    // --- MÓDULO DE EXPORTAÇÃO (EXCLUSIVO GESTÃO) ---
    Exportar: {
        async modulo(modulo, aba) {
            try {
                Sistema.notificar(`Preparando exportação: ${modulo.toUpperCase()} - ${aba.toUpperCase()}`);
                const datas = MinhaArea.getDatasFiltro();
                const wb = XLSX.utils.book_new();
                
                let data = null;
                let sheetName = (modulo.slice(0,3) + "_" + aba).toUpperCase();

                if (modulo === 'gestao') {
                    if (aba === 'usuarios') data = await Sistema.query("SELECT id, nome, perfil, funcao, contrato, situacao, ativo FROM usuarios ORDER BY nome");
                    else if (aba === 'empresas') data = await Sistema.query("SELECT * FROM empresas ORDER BY nome");
                    else if (aba === 'metas') data = await Sistema.query("SELECT m.*, u.nome as usuario_nome FROM metas m JOIN usuarios u ON m.usuario_id = u.id ORDER BY m.ano DESC, m.mes DESC, u.nome");
                } 
                else if (modulo === 'produtividade') {
                    if (aba === 'validacao') data = await Sistema.query("SELECT p.*, u.nome FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? ORDER BY p.data_referencia DESC", [datas.inicio, datas.fim]);
                    else if (aba === 'consolidado') data = await this.getConsolidado(datas);
                    else if (aba === 'matriz') { await this.exportarMatrizGrade(datas, "PROD_Matriz"); return; }
                } 
                else if (modulo === 'minha_area') {
                    if (aba === 'dia_a_dia') data = await Sistema.query("SELECT p.*, u.nome FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? ORDER BY p.data_referencia DESC", [datas.inicio, datas.fim]);
                    else if (aba === 'meta_okr') { await this.exportarMatrizGrade(datas, "MA_Meta_OKR"); return; }
                } 
                else if (modulo === 'biblioteca') {
                    if (aba === 'frases') data = await this.fetchFrases();
                    else if (aba === 'ranking_frases') {
                        data = await this.fetchFrases();
                        if (data) {
                            data = data.sort((a, b) => (b.usos || 0) - (a.usos || 0))
                                       .map((f, i) => ({ 
                                           RANK: i + 1, 
                                           USOS: f.usos || 0,
                                           EMPRESA: f.empresa,
                                           DOCUMENTO: f.documento,
                                           MOTIVO: f.motivo,
                                           CONTEUDO: f.conteudo
                                       }));
                        }
                    }
                }

                if (data && data.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                    XLSX.writeFile(wb, `RelatorioGupy_${modulo}_${aba}_${datas.inicio}.xlsx`);
                } else if (data !== null) {
                    alert("Nenhum dado encontrado para exportação.");
                }
            } catch (e) {
                console.error(e);
                alert("Erro na exportação: " + e.message);
            }
        },

        async relatorioGeral() {
            try {
                Sistema.notificar("Gerando BACKUP COMPLETO... Aguarde.");
                const datas = MinhaArea.getDatasFiltro();
                const wb = XLSX.utils.book_new();

                // 1. GESTÃO
                const users = await Sistema.query("SELECT id, nome, perfil, funcao, contrato, situacao, ativo FROM usuarios");
                const empresas = await Sistema.query("SELECT * FROM empresas");
                const metas = await Sistema.query("SELECT m.*, u.nome as usuario_nome FROM metas m JOIN usuarios u ON m.usuario_id = u.id");
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(users), "GES_Usuarios");
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empresas), "GES_Empresas");
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metas), "GES_Metas_Setup");

                // 2. PRODUTIVIDADE & MATRIZ (Grade)
                const vld = await Sistema.query("SELECT p.*, u.nome FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ?", [datas.inicio, datas.fim]);
                const csl = await this.getConsolidado(datas);
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vld), "PRD_Validacao");
                XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(csl), "PRD_Consolidado");
                
                // Matriz em Grade
                const matrixData = await this.getArrayMatrizGrade(datas);
                if (matrixData) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matrixData), "PRD_MA_Matriz_Grade");

                // 3. BIBLIOTECA
                const frases = await this.fetchFrases();
                if (frases) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(frases), "BIB_Frases_Geral");

                XLSX.writeFile(wb, `BACKUP_GERAL_GUPYMESA_${datas.inicio}.xlsx`);
                Sistema.notificar("Relatório de Backup concluído!");
            } catch (e) {
                console.error(e);
                alert("Erro no backup: " + e.message);
            }
        },

        // --- AUXILIARES ---
        async getConsolidado(datas) {
            try {
                // 1. Obter CONFIG para Headcount e Dias Úteis
                const mes = parseInt(datas.inicio.split('-')[1]);
                const ano = parseInt(datas.inicio.split('-')[0]);
                const configRes = await Sistema.query('SELECT * FROM config_mes WHERE mes = ? AND ano = ?', [mes, ano]);
                const config = configRes && configRes[0] ? configRes[0] : null;

                // 2. Obter Dados de Produção
                const rawData = await Sistema.query(`
                    SELECT data_referencia, quantidade, fifo, gradual_total, gradual_parcial, perfil_fc, usuario_id 
                    FROM producao 
                    WHERE data_referencia >= ? AND data_referencia <= ?
                `, [datas.inicio, datas.fim]);

                // 3. Obter Info de Usuários para Filtro de Assistentes
                const usersMap = {};
                (await Sistema.query('SELECT id, funcao, ativo FROM usuarios')).forEach(u => {
                    const func = (u.funcao || '').toLowerCase();
                    const isStaff = !['admin', 'gesto', 'audito', 'lider', 'coordena'].some(t => func.includes(t));
                    usersMap[u.id] = { active: u.ativo, isStaff };
                });

                // 4. Mapear Dias do Período
                const dataFimObj = new Date(datas.fim + 'T12:00:00');
                const cur = new Date(datas.inicio + 'T12:00:00');
                const dias = [];
                while (cur <= dataFimObj) {
                    dias.push(cur.toISOString().split('T')[0]);
                    cur.setDate(cur.getDate() + 1);
                }

                // 5. Agregação por Dia
                const daily = {};
                dias.forEach(d => daily[d] = { qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0, staffIds: new Set() });
                
                rawData.forEach(r => {
                    const d = r.data_referencia.split('T')[0];
                    if (daily[d]) {
                        daily[d].qty += Number(r.quantidade) || 0;
                        daily[d].fifo += Number(r.fifo) || 0;
                        daily[d].gt += Number(r.gradual_total) || 0;
                        daily[d].gp += Number(r.gradual_parcial) || 0;
                        daily[d].fc += Number(r.perfil_fc) || 0;
                        if (usersMap[r.usuario_id]?.isStaff) daily[d].staffIds.add(r.usuario_id);
                    }
                });

                // 6. Montar Linhas de Indicadores (Igual ao Sistema)
                const HC = config ? (Number(config.hc_clt || 0) + Number(config.hc_terceiros || 0)) : 17;
                // Calculamos DIAS ÚTEIS (simples: seg-sex no período)
                let diasUteisProcessados = 0;
                dias.forEach(d => {
                    const dd = new Date(d + 'T12:00:00').getDay();
                    if (dd !== 0 && dd !== 6) diasUteisProcessados++;
                });
                const DU = (config && config.dias_uteis) ? Number(config.dias_uteis) : diasUteisProcessados;

                const indicadores = [
                    { key: 'hc', label: 'TOTAL DE ASSISTENTES' },
                    { key: 'du', label: 'DIAS ÚTEIS (PERÍODO)' },
                    { key: 'fifo', label: 'TOTAL DOCUMENTOS FIFO' },
                    { key: 'gp', label: 'TOTAL DOCUMENTOS GRADUAL PARCIAL' },
                    { key: 'gt', label: 'TOTAL DOCUMENTOS GRADUAL TOTAL' },
                    { key: 'fc', label: 'TOTAL DOCUMENTOS PERFIL FC' },
                    { key: 'total', label: 'TOTAL DOCUMENTOS VALIDADOS' },
                    { key: 'media_dia', label: 'MÉDIA DIÁRIA (POR DIA ÚTIL)' },
                    { key: 'media_ast', label: 'MÉDIA POR ASSISTENTE (PERÍODO)' },
                    { key: 'media_dia_ast', label: 'MÉDIA DIÁRIA POR ASSISTENTE' }
                ];

                const rows = indicadores.map(ind => {
                    const row = { INDICADOR: ind.label };
                    let totalVal = 0;

                    dias.forEach(d => {
                        const dayData = daily[d];
                        const dayNum = d.split('-')[2];
                        let val = 0;
                        
                        const isWeekend = new Date(d + 'T12:00:00').getDay() === 0 || new Date(d + 'T12:00:00').getDay() === 6;

                        if (ind.key === 'hc') val = HC;
                        else if (ind.key === 'du') val = isWeekend ? 0 : 1;
                        else if (ind.key === 'fifo') val = dayData.fifo;
                        else if (ind.key === 'gp') val = dayData.gp;
                        else if (ind.key === 'gt') val = dayData.gt;
                        else if (ind.key === 'fc') val = dayData.fc;
                        else if (ind.key === 'total') val = dayData.qty;
                        else if (ind.key === 'media_dia') val = isWeekend ? 0 : dayData.qty;
                        else if (ind.key === 'media_ast') val = HC > 0 ? dayData.qty / HC : 0;
                        else if (ind.key === 'media_dia_ast') val = HC > 0 ? dayData.qty / HC : 0;

                        row[dayNum] = val;
                    });

                    // Coluna TOTAL
                    const sumData = Object.values(daily).reduce((acc, curr) => ({
                        qty: acc.qty + curr.qty, fifo: acc.fifo + curr.fifo, gt: acc.gt + curr.gt, gp: acc.gp + curr.gp, fc: acc.fc + curr.fc
                    }), { qty: 0, fifo: 0, gt: 0, gp: 0, fc: 0 });

                    if (ind.key === 'hc') totalVal = HC;
                    else if (ind.key === 'du') totalVal = DU;
                    else if (ind.key === 'fifo') totalVal = sumData.fifo;
                    else if (ind.key === 'gp') totalVal = sumData.gp;
                    else if (ind.key === 'gt') totalVal = sumData.gt;
                    else if (ind.key === 'fc') totalVal = sumData.fc;
                    else if (ind.key === 'total') totalVal = sumData.qty;
                    else if (ind.key === 'media_dia') totalVal = DU > 0 ? sumData.qty / DU : 0;
                    else if (ind.key === 'media_ast') totalVal = HC > 0 ? sumData.qty / HC : 0;
                    else if (ind.key === 'media_dia_ast') totalVal = (DU > 0 && HC > 0) ? sumData.qty / DU / HC : 0;

                    row['TOTAL'] = totalVal;
                    return row;
                });

                return rows;
            } catch (e) {
                console.error(e);
                return null;
            }
        },

        async getArrayMatrizGrade(datas) {
            // Gera uma matriz pivotada: Linhas = Colaboradores, Colunas = Datas
            const prod = await Sistema.query(`
                SELECT u.nome, p.data_referencia, SUM(p.quantidade) as qtd
                FROM producao p
                JOIN usuarios u ON p.usuario_id = u.id
                WHERE p.data_referencia >= ? AND p.data_referencia <= ?
                GROUP BY u.nome, p.data_referencia
                ORDER BY u.nome, p.data_referencia
            `, [datas.inicio, datas.fim]);

            if (!prod.length) return null;

            const datasUnicas = [...new Set(prod.map(p => p.data_referencia.split('T')[0]))].sort();
            const colabs = [...new Set(prod.map(p => p.nome))].sort();

            const header = ["Colaborador", ...datasUnicas, "TOTAL"];
            const rows = [header];

            colabs.forEach(nome => {
                const row = [nome];
                let soma = 0;
                datasUnicas.forEach(d => {
                    const match = prod.find(p => p.nome === nome && p.data_referencia.split('T')[0] === d);
                    const val = match ? match.qtd : 0;
                    row.push(val || "-");
                    soma += (val || 0);
                });
                row.push(soma);
                rows.push(row);
            });

            return rows;
        },

        async exportarMatrizGrade(datas, fileName) {
            const data = await this.getArrayMatrizGrade(datas);
            if (!data) { alert("Sem dados para a matriz grade."); return; }
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, "Matriz Performance");
            XLSX.writeFile(wb, `${fileName}_${datas.inicio}.xlsx`);
        },

        async fetchFrases() {
            try {
                // Migrado de Supabase para TiDB local
                const data = await Sistema.query("SELECT id, conteudo, empresa, motivo, documento, usos FROM frases ORDER BY usos DESC");
                return data || [];
            } catch (e) { 
                console.error("Erro fetchFrases:", e);
                return null; 
            }
        }
    },

    carregarContestacoesReport: async function() {
        try {
            const container = document.getElementById('relatorio-ativo-content');
            const datas = MinhaArea.getDatasFiltro();
            const { inicio, fim } = datas;

            const sql = `
                SELECT c.*, u.nome as usuario_nome 
                FROM contestacoes_assertividade c 
                JOIN usuarios u ON c.usuario_id = u.id 
                WHERE c.data_referencia >= ? AND c.data_referencia <= ?
                ORDER BY c.criado_em DESC
            `;
            const contestacoes = await Sistema.query(sql, [inicio, fim]);

            let html = `
                <div class="space-y-6 animate-enter">
                    <div class="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div>
                            <h3 class="text-sm font-black text-slate-700 uppercase tracking-widest">Relatório de Contestações</h3>
                            <p class="text-[10px] text-slate-400 font-bold">Período: ${inicio.split('-').reverse().join('/')} até ${fim.split('-').reverse().join('/')}</p>
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="filtro-contest-nome" placeholder="Filtrar por nome..." 
                                class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-400 w-48 shadow-sm"
                                oninput="MinhaArea.Relatorios.filtrarContestacoesReport()">
                        </div>
                    </div>

                    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <table class="w-full text-sm text-left border-collapse">
                            <thead class="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b">
                                <tr>
                                    <th class="px-4 py-3">Data Ref.</th>
                                    <th class="px-4 py-3">Assistente</th>
                                    <th class="px-4 py-3">Mensagem</th>
                                    <th class="px-4 py-3 text-center">Status</th>
                                    <th class="px-4 py-3">Resposta Auditora</th>
                                    <th class="px-4 py-3 text-right">Data Envio</th>
                                </tr>
                            </thead>
                            <tbody id="lista-contestacoes-report" class="divide-y divide-slate-100">
            `;

            if (contestacoes.length === 0) {
                html += `<tr><td colspan="6" class="px-4 py-10 text-center text-slate-400 italic">Nenhuma contestação encontrada no período.</td></tr>`;
            } else {
                contestacoes.forEach(c => {
                    const statusClass = c.status === 'PENDENTE' ? 'bg-amber-100 text-amber-700' : 
                                      (c.status === 'ACEITO' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700');
                    const dataRef = new Date(c.data_referencia + 'T12:00:00').toLocaleDateString('pt-BR');
                    const dataEnvio = new Date(c.criado_em).toLocaleString('pt-BR');

                    html += `
                        <tr class="contest-report-row hover:bg-slate-50 transition" data-nome="${c.usuario_nome.toLowerCase()}">
                            <td class="px-4 py-3 font-bold text-slate-700">${dataRef}</td>
                            <td class="px-4 py-3 font-black text-blue-600">${c.usuario_nome}</td>
                            <td class="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title="${c.mensagem}">${c.mensagem}</td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${statusClass}">${c.status}</span>
                            </td>
                            <td class="px-4 py-3 text-xs text-slate-500 italic">${c.resposta_auditora || '--'}</td>
                            <td class="px-4 py-3 text-right text-[10px] text-slate-400 font-bold">${dataEnvio}</td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            container.innerHTML = html;
        } catch (e) {
            console.error(e);
            Sistema.notificar("Erro ao carregar relatório de contestações", "erro");
        }
    },

    filtrarContestacoesReport: function() {
        const query = document.getElementById('filtro-contest-nome').value.toLowerCase();
        const rows = document.querySelectorAll('.contest-report-row');
        rows.forEach(row => {
            const nome = row.getAttribute('data-nome');
            if (nome.includes(query)) row.classList.remove('hidden');
            else row.classList.add('hidden');
        });
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

            // [FIX] Busca a Meta correta conforme regra de grupos
            let metasRes = [];
            const isGroup = !alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT' || alvoId === 'GRUPO_TERCEIROS';
            
            if (!alvoId || alvoId === 'EQUIPE' || alvoId === 'GRUPO_CLT') {
                // Time Geral ou CLT: Meta da Liderança
                metasRes = await Sistema.query(`SELECT mes, meta_producao FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`, [ano, mesIni, mesFim, this.ID_LIDERANCA]);
            } else if (alvoId === 'GRUPO_TERCEIROS') {
                // Time Terceiros: Maior meta dos assistentes do grupo
                const sqlMetaTerc = `SELECT m.mes, m.meta_producao FROM metas m JOIN usuarios u ON m.usuario_id = u.id WHERE m.ano = ? AND m.mes >= ? AND m.mes <= ? AND (LOWER(u.contrato) LIKE "%pj%" OR LOWER(u.contrato) LIKE "%terceiro%")`;
                metasRes = await Sistema.query(sqlMetaTerc, [ano, mesIni, mesFim]);
            } else {
                // Individual
                metasRes = await Sistema.query(`SELECT mes, meta_producao FROM metas WHERE ano = ? AND mes >= ? AND mes <= ? AND usuario_id = ?`, [ano, mesIni, mesFim, alvoId]);
            }

            const isIndividual = alvoId && !['EQUIPE', 'GRUPO_CLT', 'GRUPO_TERCEIROS'].includes(alvoId);
            const prodR = await Sistema.query(`SELECT MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, SUM(COALESCE(p.fator, 1.0)) as soma_fator, MAX(u.contrato) as contrato FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= ? AND p.data_referencia <= ? AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) ${isIndividual ? ' AND p.usuario_id = ? ' : filtroGrupo} GROUP BY mes`, isIndividual ? [inicio, fim, alvoId] : [inicio, fim]);
            const asR = await Sistema.query(`SELECT MONTH(a.data_referencia) as mes, AVG(a.assertividade_val) as media_assert FROM assertividade a JOIN usuarios u ON a.usuario_id = u.id WHERE a.data_referencia >= ? AND a.data_referencia <= ? ${isIndividual ? ' AND a.usuario_id = ? ' : filtroGrupo} GROUP BY mes`, isIndividual ? [inicio, fim, alvoId] : [inicio, fim]);

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
                const targetFallback = (alvoId === 'GRUPO_TERCEIROS') ? 100 : 650;
                const metaVal = metaM.length > 0 ? Math.max(...metaM.map(x => Number(x.meta_producao || 0))) : targetFallback;

                let denV = 1;
                const isIndView = alvoId && !['EQUIPE', 'GRUPO_CLT', 'GRUPO_TERCEIROS'].includes(alvoId);
                
                if (!isIndView) {
                    // Visão Grupo: Capacidade Fixa (HC * (Dias - 1))
                    denV = hcEquipe * (dReferencia > 0 ? Math.max(1, dReferencia - 1) : 0);
                } else {
                    // Visão Individual: Real Trabalhado (Soma Fatores - 1 se for CLT)
                    const sFator = p ? Number(p.soma_fator || 0) : 0;
                    const uContrato = p ? (p.contrato || '').toUpperCase() : 'CLT';
                    const isClt = !uContrato.includes('PJ') && !uContrato.includes('TERCEIR');
                    
                    if (isClt) {
                        denV = Math.max(0, sFator - 1);
                    } else {
                        denV = sFator;
                    }
                }

                const a = (asR || []).find(x => Number(x.mes) === m);
                dataF.push({ mes: m, total_prod: p ? Number(p.total_prod) : 0, denominador: denV > 0 ? denV : (isIndView ? 1 : 0), meta_meta: metaVal, assert: a ? Number(a.media_assert) : 0 });
            }
            this.renderizarMetasOKR(dataF, ano, mesIni, mesFim);
        } catch (e) { console.error(e); }
    },

    renderizarMetasOKR: function(producao, ano, mesIni, mesFim) {
        if (this.relatorioAtivo !== 'metas_okr') return;
        const container = document.getElementById('relatorio-ativo-content');
        const mS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let hIdx = `<div class="mb-4 flex justify-end gap-2">
                <button onclick="MinhaArea.Relatorios.copiarTudo()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black transition-all shadow-lg flex items-center gap-2">
                    <i class="fas fa-copy"></i> COPIAR RELATÓRIO COMPLETO
                </button>
            </div>
            <div id="tabela-metas-okr" class="grid grid-cols-1 xl:grid-cols-2 gap-8"><div class="space-y-4">
            <div class="flex justify-between items-center px-1">
                <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Produção (Velocidade)</h3>
                <button onclick="MinhaArea.Relatorios.copiarTabela('PROD')" class="text-[10px] font-bold text-blue-600 hover:underline"><i class="fas fa-copy"></i> Copiar Tabela</button>
            </div>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] font-bold"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th><th class="px-2 py-3"></th></tr></thead><tbody class="divide-y">`;
        
        let sM = 0, cM = 0, sR = 0, cR = 0;
        producao.forEach((p, idx) => {
            const mVal = p.meta_meta;
            const r = p.denominador > 0 ? (p.total_prod / p.denominador) : 0; const pct = mVal > 0 ? (r / mVal) * 100 : 0;
            const cl = pct >= 100 ? 'text-emerald-600 bg-emerald-50' : (pct >= 80 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            if (p.total_prod > 0) { if (mVal > 0) { sM += mVal; cM++; } sR += r; cR++; }
            hIdx += `<tr class="group"><td class="px-4 py-2.5 font-bold">${mS[p.mes-1]}</td><td class="px-4 py-2.5 text-right text-slate-600">${mVal || '--'}</td><td class="px-4 py-2.5 text-right font-black text-blue-600">${r > 0 ? Math.round(r).toLocaleString() : '--'}</td><td class="px-4 py-2.5 text-center"><span class="px-1.5 py-0.5 rounded font-black text-[10px] ${cl}">${pct.toFixed(1)}%</span></td><td class="px-2 text-center opacity-0 group-hover:opacity-100 transition"><button onclick="MinhaArea.Relatorios.copiarLinha('PROD', ${idx})" class="text-slate-300 hover:text-blue-600"><i class="fas fa-copy"></i></button></td></tr>`;
        });
        const aM = cM > 0 ? sM / cM : 0; const aR = cR > 0 ? sR / cR : 0; const aP = aM > 0 ? (aR / aM * 100) : 0;
        hIdx += `</tbody><tfoot class="bg-slate-50 border-t-2 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right">${Math.round(aM).toLocaleString()}</td><td class="px-4 py-3 text-right text-blue-700 bg-blue-50/50">${Math.round(aR).toLocaleString()}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-amber-500 text-white">${aP.toFixed(1)}%</span></td><td></td></tr></tfoot></table></div></div>`;
        
        let hAs = `<div class="space-y-4"><div class="flex justify-between items-center px-1">
                <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest">Assertividade</h3>
                <button onclick="MinhaArea.Relatorios.copiarTabela('ASSERT')" class="text-[10px] font-bold text-emerald-600 hover:underline"><i class="fas fa-copy"></i> Copiar Tabela</button>
            </div>
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><table class="w-full text-sm"><thead class="bg-slate-50 text-[10px] font-bold"><tr><th class="px-4 py-3">Mês</th><th class="px-4 py-3 text-right">Meta</th><th class="px-4 py-3 text-right">Realizado</th><th class="px-4 py-3 text-center">Ating.</th><th class="px-2 py-3"></th></tr></thead><tbody class="divide-y">`;
        
        let sRA = 0, cRA = 0;
        producao.forEach((p, idx) => {
            const mVal = 97;
            const rV = p.assert || 0;
            if (rV > 0) { sRA += rV; cRA++; }
            let at = 0; if (rV > 0) { if (rV < 90) at = 0; else if (rV < 94) at = 50; else if (rV < 95) at = 70; else if (rV < 96) at = 80; else if (rV <= 97) at = 90; else at = 100; }
            const cl = rV >= mVal ? 'text-emerald-600 bg-emerald-50' : (rV >= 90 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50');
            hAs += `<tr class="group"><td class="px-4 py-2.5 font-bold">${mS[p.mes-1]}</td><td class="px-4 py-2.5 text-right text-slate-600">${mVal}%</td><td class="px-4 py-2.5 text-right font-black text-emerald-600">${rV > 0 ? rV.toFixed(2) + '%' : '--'}</td><td class="px-4 py-2.5 text-center"><span class="px-1.5 py-0.5 rounded font-black text-[10px] ${cl}">${at}%</span></td><td class="px-2 text-center opacity-0 group-hover:opacity-100 transition"><button onclick="MinhaArea.Relatorios.copiarLinha('ASSERT', ${idx})" class="text-slate-300 hover:text-emerald-600"><i class="fas fa-copy"></i></button></td></tr>`;
        });
        const aRA = cRA > 0 ? sRA / cRA : 0;
        let aAt = 0; if (aRA > 0) { if (aRA < 90) aAt = 0; else if (aRA < 94) aAt = 50; else if (aRA < 95) aAt = 70; else if (aRA < 96) aAt = 80; else if (aRA <= 97) aAt = 90; else aAt = 100; }
        hAs += `</tbody><tfoot class="bg-slate-50 border-t-2 font-black"><tr><td class="px-4 py-3">Acumulado</td><td class="px-4 py-3 text-right">97%</td><td class="px-4 py-3 text-right text-emerald-700 bg-emerald-50/50">${aRA.toFixed(2)}%</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-amber-500 text-white">${aAt}%</span></td><td></td></tr></tfoot></table></div></div></div>`;
        
        container.innerHTML = hIdx + hAs;
        this._lastData = producao;
    },

    copiarTudo: function() {
        this.copiarDados(); // Reusa a função que já copia tudo
    },

    copiarTabela: function(tipo) {
        if (!this._lastData) return;
        const mS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let txt = "";
        
        if (tipo === 'PROD') {
            txt = "Mês\tMeta\tRealizado\tAtingimento%\n";
            let sM = 0, cM = 0, sR = 0, cR = 0;
            this._lastData.forEach(p => {
                const mVal = p.meta_meta || 650;
                const r = p.denominador > 0 ? (p.total_prod / p.denominador) : 0;
                const pct = (r / mVal) * 100;
                if (p.total_prod > 0) { sM += mVal; cM++; sR += r; cR++; }
                txt += `${mS[p.mes-1]}\t${mVal}\t${Math.round(r)}\t${pct.toFixed(1)}%\n`;
            });
            const aM = cM > 0 ? sM / cM : 0; const aR = cR > 0 ? sR / cR : 0; const aP = aM > 0 ? (aR / aM * 100) : 0;
            txt += `Acumulado\t${Math.round(aM)}\t${Math.round(aR)}\t${aP.toFixed(1)}%`;
        } else {
            txt = "Mês\tMeta\tRealizado\tStatus\n";
            let sRA = 0, cRA = 0;
            this._lastData.forEach(p => {
                const rV = p.assert || 0;
                if (rV > 0) { sRA += rV; cRA++; }
                let at = 0; if (rV > 0) { if (rV < 90) at = 0; else if (rV < 94) at = 50; else if (rV < 95) at = 70; else if (rV < 96) at = 80; else if (rV <= 97) at = 90; else at = 100; }
                txt += `${mS[p.mes-1]}\t97%\t${rV > 0 ? rV.toFixed(2) + '%' : '--'}\t${at}%\n`;
            });
            const aRA = cRA > 0 ? sRA / cRA : 0;
            let aAt = 0; if (aRA > 0) { if (aRA < 90) aAt = 0; else if (aRA < 94) aAt = 50; else if (aRA < 95) aAt = 70; else if (aRA < 96) aAt = 80; else if (aRA <= 97) aAt = 90; else aAt = 100; }
            txt += `Acumulado\t97%\t${aRA.toFixed(2)}%\t${aAt}%`;
        }
        this._finishCopy(txt);
    },

    copiarLinha: function(tipo, idx) {
        if (!this._lastData || !this._lastData[idx]) return;
        const p = this._lastData[idx];
        const mS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let txt = "";
        
        if (tipo === 'PROD') {
            const mVal = p.meta_meta || 650;
            const r = p.denominador > 0 ? (p.total_prod / p.denominador) : 0;
            const pct = (r / mVal) * 100;
            txt = `${mS[p.mes-1]}\t${mVal}\t${Math.round(r)}\t${pct.toFixed(1)}%`;
        } else {
            const rV = p.assert || 0;
            let at = 0; if (rV > 0) { if (rV < 90) at = 0; else if (rV < 94) at = 50; else if (rV < 95) at = 70; else if (rV < 96) at = 80; else if (rV <= 97) at = 90; else at = 100; }
            txt = `${mS[p.mes-1]}\t97%\t${rV > 0 ? rV.toFixed(2) + '%' : '--'}\t${at}%`;
        }
        this._finishCopy(txt);
    },

    _finishCopy: function(txt) {
        navigator.clipboard.writeText(txt).then(() => {
            Sistema.notificar("Copiado com sucesso! Use Ctrl+V para colar.");
        });
    },

    copiarDados: function() {
        if (!this._lastData) return;
        const mS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        let txt = "TABELA: PRODUÇÃO (VELOCIDADE)\nMês\tMeta\tRealizado\tAtingimento%\n";
        
        let sM = 0, cM = 0, sR = 0, cR = 0;
        this._lastData.forEach(p => {
            const mVal = p.meta_meta || 650;
            const r = p.denominador > 0 ? (p.total_prod / p.denominador) : 0;
            const pct = (r / mVal) * 100;
            if (p.total_prod > 0) { sM += mVal; cM++; sR += r; cR++; }
            txt += `${mS[p.mes-1]}\t${mVal}\t${Math.round(r)}\t${pct.toFixed(1)}%\n`;
        });
        
        const aM = cM > 0 ? sM / cM : 0; const aR = cR > 0 ? sR / cR : 0; const aP = aM > 0 ? (aR / aM * 100) : 0;
        txt += `Acumulado\t${Math.round(aM)}\t${Math.round(aR)}\t${aP.toFixed(1)}%\n\n`;
        
        txt += "TABELA: ASSERTIVIDADE\nMês\tMeta\tRealizado\tStatus\n";
        let sRA = 0, cRA = 0;
        this._lastData.forEach(p => {
            const rV = p.assert || 0;
            if (rV > 0) { sRA += rV; cRA++; }
            let at = 0; if (rV > 0) { if (rV < 90) at = 0; else if (rV < 94) at = 50; else if (rV < 95) at = 70; else if (rV < 96) at = 80; else if (rV <= 97) at = 90; else at = 100; }
            txt += `${mS[p.mes-1]}\t97%\t${rV > 0 ? rV.toFixed(2) + '%' : '--'}\t${at}%\n`;
        });
        const aRA = cRA > 0 ? sRA / cRA : 0;
        let aAt = 0; if (aRA > 0) { if (aRA < 90) aAt = 0; else if (aRA < 94) aAt = 50; else if (aRA < 95) aAt = 70; else if (aRA < 96) aAt = 80; else if (aRA <= 97) aAt = 90; else aAt = 100; }
        txt += `Acumulado\t97%\t${aRA.toFixed(2)}%\t${aAt}%\n`;

        navigator.clipboard.writeText(txt).then(() => {
            const btn = document.querySelector('button[onclick*="copiarDados"]');
            if (btn) {
                const old = btn.innerHTML;
                btn.innerHTML = `<i class="fas fa-check"></i> COPIADO!`;
                btn.classList.replace('bg-slate-100', 'bg-emerald-500');
                btn.classList.replace('text-slate-600', 'text-white');
                setTimeout(() => { btn.innerHTML = old; btn.classList.replace('bg-emerald-500', 'bg-slate-100'); btn.classList.replace('text-white', 'text-slate-600'); }, 2000);
            }
        });
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

    _gapDataFull: null,
    _gapMesAtivo: new Date().getMonth() + 1,
    _gapPiorIdPorMes: {},

    carregarGAP11: async function() {
        const container = document.getElementById('relatorio-ativo-content');
        try {
            const { inicio: inicioFiltro, fim } = MinhaArea.getDatasFiltro();
            const ano = inicioFiltro.split('-')[0];
            const inicioYTD = `${ano}-01-01`;
            
            console.log(`[GAP 1:1] Carregando YTD: ${inicioYTD} até ${fim}`);
            
            // Determina os meses limites para o gráfico (Sempre inicia em Jan para o GAP acumulado)
            this._currentStartMonth = 1;
            this._currentEndMonth = parseInt(fim.split('-')[1]);

            const alvoId = MinhaArea.getUsuarioAlvo();
            let filtroGrupo = '';
            if (alvoId === 'GRUPO_CLT') filtroGrupo = ' AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE "%pj%" AND LOWER(u.contrato) NOT LIKE "%terceiro%")) ';
            else if (alvoId === 'GRUPO_TERCEIROS') filtroGrupo = ' AND (LOWER(u.contrato) LIKE "%pj%" OR LOWER(u.contrato) LIKE "%terceiro%") ';

            const sql = `
                SELECT 
                    base.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, 
                    base.mes, 
                    base.total_prod, 
                    base.dias_trab,
                    COALESCE(avg_a.media_assert, 0) as media_assert
                FROM (
                    SELECT 
                        usuario_id, 
                        MONTH(data_referencia) as mes, 
                        SUM(quantidade) as total_prod, 
                        COUNT(DISTINCT data_referencia) as dias_trab
                    FROM producao
                    WHERE data_referencia >= ? AND data_referencia <= ?
                    GROUP BY usuario_id, MONTH(data_referencia)
                ) base
                JOIN usuarios u ON base.usuario_id = u.id
                LEFT JOIN (
                    SELECT usuario_id, MONTH(data_referencia) as mes, AVG(assertividade_val) as media_assert
                    FROM assertividade
                    WHERE data_referencia >= ? AND data_referencia <= ?
                    GROUP BY usuario_id, MONTH(data_referencia)
                ) avg_a ON base.usuario_id = avg_a.usuario_id AND base.mes = avg_a.mes
                WHERE u.ativo = 1 
                  AND base.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) 
                  AND (LOWER(u.funcao) NOT LIKE '%auditor%' AND LOWER(u.funcao) NOT LIKE '%lider%' AND LOWER(u.funcao) NOT LIKE '%gestor%' AND LOWER(u.funcao) NOT LIKE '%coordena%') 
                  ${filtroGrupo}
                ORDER BY base.mes ASC, base.total_prod DESC
            `;
            
            const data = await Sistema.query(sql, [inicioYTD, fim, inicioYTD, fim]);
            this._gapDataFull = data || [];
            
            if (this._gapDataFull.length === 0) {
                if (container) container.innerHTML = `<div class="text-center py-20 text-slate-400">Nenhum dado produtivo encontrado para o período selecionado.</div>`;
                return;
            }

            this.renderizarGAP11();
        } catch (e) { 
            console.error("❌ Erro ao carregar GAP:", e);
            if (container) container.innerHTML = `<div class="text-center py-20 text-rose-500">Erro ao carregar dados: ${e.message}</div>`;
        }
    },

    abrirSelecaoContrasteGlobal: function() {
        const todosUsuarios = [...new Set(this._gapDataFull.map(d => JSON.stringify({id: d.usuario_id, nome: d.nome})))].map(s => JSON.parse(s)).sort((a,b) => a.nome.localeCompare(b.nome));
        
        const currentIds = this._gapContrasteIdsGlobal || [];

        let listHtml = todosUsuarios.map(u => `
            <label class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                <input type="checkbox" name="contraste-user" value="${u.id}" ${currentIds.includes(String(u.id)) ? 'checked' : ''} class="w-4 h-4 text-indigo-600 rounded">
                <span class="text-sm font-semibold text-slate-700">${u.nome}</span>
            </label>
        `).join('');

        Swal.fire({
            title: 'Configurar Grupo de Referência',
            html: `
                <p class="text-xs text-slate-500 mb-4 text-left font-bold uppercase tracking-widest">Selecione os assistentes para compor a base de comparação:</p>
                <div class="max-h-[350px] overflow-y-auto custom-scrollbar pr-2 space-y-1">
                    <label class="flex items-center gap-3 p-2 bg-indigo-50 border border-indigo-100 rounded-lg cursor-pointer mb-3">
                        <input type="checkbox" onchange="const chks = document.querySelectorAll('input[name=contraste-user]'); chks.forEach(c => c.checked = this.checked)" class="w-4 h-4 text-indigo-600 rounded">
                        <span class="text-sm font-black text-indigo-700 uppercase">Selecionar Todos</span>
                    </label>
                    ${listHtml}
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Aplicar Seleção',
            cancelButtonText: 'Restaurar Automático',
            customClass: {
                confirmButton: 'bg-indigo-600 px-6 py-2.5 rounded-xl text-white font-black text-xs uppercase',
                cancelButton: 'bg-slate-100 px-6 py-2.5 rounded-xl text-slate-600 font-black text-xs uppercase'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                const selected = Array.from(document.querySelectorAll('input[name="contraste-user"]:checked')).map(i => i.value);
                this._gapContrasteIdsGlobal = selected;
                this.renderizarGAP11();
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                this._gapContrasteIdsGlobal = null;
                this.renderizarGAP11();
            }
        });
    },

    renderizarGAP11: function() {
        if (this.relatorioAtivo !== 'gap') return;
        const container = document.getElementById('relatorio-ativo-content');
        if (!container || !this._gapDataFull) return;

        let html = `
            <div class="p-8 space-y-8 animate-enter h-full overflow-y-auto custom-scrollbar">
                <!-- Header do Relatório -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <i class="fas fa-chart-line text-2xl text-white"></i>
                        </div>
                        <div>
                            <h2 class="text-2xl font-black text-slate-800 tracking-tight uppercase">Análise Detalhada do GAP</h2>
                            <p class="text-slate-400 text-xs font-bold uppercase tracking-widest">Histórico de Performance (YTD)</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3">
                        <button onclick="MinhaArea.Relatorios.abrirSelecaoContrasteGlobal()" class="flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-600 border-2 border-indigo-100 rounded-xl font-black text-xs hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm">
                            <i class="fas fa-users-cog"></i>
                            SELECIONAR CONTRASTE GLOBAL
                        </button>
                        <button onclick="MinhaArea.Relatorios.gerarRelatorioNarrativo()" class="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all shadow-md">
                            <i class="fas fa-file-alt"></i>
                            ABRIR RELATÓRIO NARRATIVO
                        </button>
                        <button onclick="MinhaArea.Relatorios.carregarGAP11()" class="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all">
                            <i class="fas fa-sync-alt"></i>
                        </button>
                    </div>
                </div>

                <!-- Grid de Visualização -->
                <div class="grid grid-cols-1 gap-8">
                    <!-- Card do Gráfico -->
                    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div class="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                            <h3 class="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                <i class="fas fa-chart-bar text-indigo-500"></i> Evolução do GAP Acumulado
                            </h3>
                            <div id="gap-global-info" class="text-[10px] font-bold text-slate-400 italic"></div>
                        </div>
                        <div class="p-8">
                            <div class="h-[400px] relative">
                                <canvas id="canvas-gap-evolution"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Card da Tabela (Excel Style) -->
                    <div class="bg-white rounded-lg border border-slate-300 shadow-sm">
                        <div class="bg-slate-100 px-4 py-2 border-b border-slate-300 font-black text-[11px] text-slate-600 uppercase">
                            Detalhamento Mensal de Performance
                        </div>
                        <div class="overflow-y-auto max-h-[500px]">
                            <table class="w-full text-xs text-left border-collapse border border-slate-200">
                                <thead class="sticky top-0 bg-slate-50 z-10">
                                    <tr class="border-b border-slate-300">
                                        <th class="px-3 py-2 border-r border-slate-200 font-bold text-slate-600">Mês</th>
                                        <th class="px-3 py-2 border-r border-slate-200 font-bold text-emerald-700">Top</th>
                                        <th class="px-3 py-2 border-r border-slate-200 font-bold text-rose-700">Contraste</th>
                                        <th class="px-3 py-2 text-center font-bold text-slate-600">GAP</th>
                                        <th class="px-3 py-2 text-right font-bold text-slate-600">Evolução</th>
                                    </tr>
                                </thead>
                                <tbody id="gap-history-table-body" class="divide-y divide-slate-200"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.renderizarGraficoEvolucaoGAP();
    },



    renderizarGraficoEvolucaoGAP: function() {
        console.log(`📊 Renderizando Gráfico GAP v1.8.7...`);
        const ctx = document.getElementById('canvas-gap-evolution')?.getContext('2d');
        if (!ctx) return;

        const infoDiv = document.getElementById('gap-global-info');
        if (infoDiv) {
            if (this._gapContrasteIdsGlobal && this._gapContrasteIdsGlobal.length > 0) {
                infoDiv.innerHTML = `<i class="fas fa-users"></i> Referência: <span class="text-indigo-600">Grupo Personalizado (${this._gapContrasteIdsGlobal.length} assistentes)</span>`;
            } else {
                infoDiv.innerHTML = `<i class="fas fa-magic"></i> Seleção Automática (Menor do Mês)`;
            }
        }

        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const labels = [];
        const gapData = [];
        const historyDetails = [];

        const getMetricsAccum = (userId, targetMonth) => {
            if (!userId) return { vel: 0, ass: 0 };
            const history = this._gapDataFull.filter(d => String(d.usuario_id) === String(userId) && d.mes <= targetMonth);
            if (history.length === 0) return { vel: 0, ass: 0 };
            let totalProd = 0, totalDays = 0, sumAss = 0, countMonths = 0;
            history.forEach(d => {
                totalProd += parseFloat(d.total_prod) || 0;
                totalDays += parseFloat(d.dias_trab) || 0;
                sumAss += parseFloat(d.media_assert) || 0;
                countMonths++;
            });
            return {
                vel: totalDays > 0 ? Math.round(totalProd / totalDays) : 0,
                ass: countMonths > 0 ? (sumAss / countMonths) : 0
            };
        };

        for (let m = this._currentStartMonth; m <= this._currentEndMonth; m++) {
            const idsNoMes = [...new Set(this._gapDataFull.filter(d => d.mes === m).map(d => d.usuario_id))];
            labels.push(mesesNomes[m - 1]);
            
            if (idsNoMes.length === 0) {
                gapData.push(0);
                historyDetails.push({ m, gap: 0, empty: true });
                continue;
            }

            const rankingAccum = idsNoMes.map(id => {
                const mtr = getMetricsAccum(id, m);
                const u = this._gapDataFull.find(d => String(d.usuario_id) === String(id));
                return { ...u, ...mtr };
            }).sort((a,b) => b.vel - a.vel);

            const top = rankingAccum[0];
            
            // Lógica de Contraste (Global ou Automática)
            let worst = rankingAccum[rankingAccum.length - 1];
            if (this._gapContrasteIdsGlobal && this._gapContrasteIdsGlobal.length > 0) {
                const group = rankingAccum.filter(r => this._gapContrasteIdsGlobal.includes(String(r.usuario_id)));
                if (group.length > 0) {
                    const avgVel = group.reduce((acc, curr) => acc + curr.vel, 0) / group.length;
                    const avgAss = group.reduce((acc, curr) => acc + curr.ass, 0) / group.length;
                    const label = group.length === 1 ? group[0].nome : "Média do Grupo";
                    worst = { vel: Math.round(avgVel), ass: avgAss, nome: label };
                }
            }

            const vTop = top.vel;
            const vWorst = worst.vel;
            const gap = vTop - vWorst;

            gapData.push(gap);
            historyDetails.push({ m, top, worst, vTop, vWorst, gap });
        }

        // Renderizar Tabela
        const tbody = document.getElementById('gap-history-table-body');
        if (tbody) {
            tbody.innerHTML = historyDetails.map((h, i) => {
                if (h.empty) {
                    return `
                        <tr class="bg-slate-50/20">
                            <td class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">${mesesNomes[h.m-1]}</td>
                            <td colspan="4" class="px-6 py-4 text-center text-[10px] font-bold text-slate-400 italic uppercase">Sem dados produtivos neste período</td>
                        </tr>
                    `;
                }
                const prevGap = (i > 0 && !historyDetails[i-1].empty) ? historyDetails[i-1].gap : null;
                const diff = prevGap !== null ? h.gap - prevGap : null;
                const colorClass = diff <= 0 ? 'text-emerald-500' : 'text-rose-500';
                const icon = diff <= 0 ? 'fa-arrow-down' : 'fa-arrow-up';
                
                const evoHtml = diff !== null 
                    ? `<span class="font-black ${colorClass} text-[10px] flex items-center gap-1 justify-end">
                        <i class="fas ${icon}"></i>
                        ${Math.abs(diff)} (${diff <= 0 ? 'Redução' : 'Aumento'})
                      </span>`
                    : '<span class="text-slate-300">--</span>';

                return `
                    <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">${mesesNomes[h.m-1]}</td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black">
                                    ${h.top.nome.substring(0,2).toUpperCase()}
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[12px] font-black text-slate-700 leading-tight">${h.top.nome}</span>
                                    <span class="text-[10px] text-slate-400 font-bold">Média Acumulada: ${h.vTop}</span>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black">
                                    ${h.worst.nome.substring(0,2).toUpperCase()}
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[12px] font-black text-slate-700 leading-tight">${h.worst.nome}</span>
                                    <span class="text-[10px] text-slate-400 font-bold">Média Acumulada: ${h.vWorst}</span>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="px-3 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-800">${h.gap}</span>
                        </td>
                        <td class="px-6 py-4 text-right">${evoHtml}</td>
                    </tr>
                `;
            }).join('');
        }

        // Renderizar Gráfico
        if (window._gapChartInstance) window._gapChartInstance.destroy();
        
        window._gapChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'GAP Acumulado (YTD)',
                        data: gapData,
                        backgroundColor: 'rgba(79, 70, 229, 0.4)',
                        borderColor: '#4f46e5',
                        borderWidth: 2,
                        borderRadius: 12,
                        order: 2,
                        barThickness: 65 // Barra mais larga conforme solicitado
                    },
                    {
                        label: 'Tendência Histórica',
                        data: gapData,
                        type: 'line',
                        borderColor: '#ef4444',
                        borderWidth: 4,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 6,
                        pointHoverRadius: 9,
                        tension: 0.3,
                        order: 1,
                        fill: false
                    }
                ]
            },
            plugins: [{
                id: 'customLabels',
                afterDraw: (chart) => {
                    const { ctx } = chart;
                    chart.data.datasets.forEach((dataset, i) => {
                        const meta = chart.getDatasetMeta(i);
                        // Aplicar apenas no dataset de barras (Index 0 ou Type Bar)
                        if (meta.type === 'bar') {
                            meta.data.forEach((bar, index) => {
                                const data = dataset.data[index];
                                ctx.save();
                                ctx.fillStyle = '#4f46e5';
                                ctx.font = 'bold 13px Inter';
                                ctx.textAlign = 'center';
                                ctx.fillText(data, bar.x, bar.y - 12);
                                ctx.restore();
                            });
                        }
                    });
                }
            }],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            font: { size: 11, weight: 'black' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        padding: 16,
                        titleFont: { size: 14, weight: 'black' },
                        bodyFont: { size: 12 },
                        cornerRadius: 12,
                        callbacks: {
                            afterLabel: (context) => {
                                const h = historyDetails[context.dataIndex];
                                if (h.empty) return ['', 'Sem dados para este mês'];
                                return [
                                    '',
                                    `REFERÊNCIA (TOP): ${h.top.nome}`,
                                    `Média Acumulada: ${h.vTop} metas/dia`,
                                    '',
                                    `CONTRASTE: ${h.worst.nome}`,
                                    `Média Acumulada: ${h.vWorst} metas/dia`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [5, 5], color: '#f1f5f9' },
                        ticks: { font: { size: 11, weight: 'black' }, color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: 'black' }, color: '#64748b' }
                    }
                }
            }
        });
    },

    renderizarConteudoMesGap11: function() {
        return ''; // Removido conforme solicitado para focar no gráfico e tabela
    },

    gerarRelatorioNarrativo: function() {
        if (!this._gapDataFull || this._gapDataFull.length === 0) {
            Sistema.notificar("Nenhum dado disponível para gerar o relatório.", "aviso");
            return;
        }

        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const historyDetails = [];

        const getMetricsAccum = (userId, targetMonth) => {
            const history = this._gapDataFull.filter(d => String(d.usuario_id) === String(userId) && d.mes <= targetMonth);
            if (history.length === 0) return { vel: 0, ass: 0 };
            let totalProd = 0, totalDays = 0;
            history.forEach(d => {
                totalProd += parseFloat(d.total_prod) || 0;
                totalDays += parseFloat(d.dias_trab) || 0;
            });
            return {
                vel: totalDays > 0 ? Math.round(totalProd / totalDays) : 0
            };
        };

        const mesesPresentes = [...new Set(this._gapDataFull.map(d => d.mes))].sort((a,b) => a - b);
        mesesPresentes.forEach(m => {
            const idsNoMes = [...new Set(this._gapDataFull.filter(d => d.mes === m).map(d => d.usuario_id))];
            const rankingAccum = idsNoMes.map(id => {
                const mtr = getMetricsAccum(id, m);
                const u = this._gapDataFull.find(d => String(d.usuario_id) === String(id));
                return { ...u, ...mtr };
            }).sort((a,b) => b.vel - a.vel);

            const top = rankingAccum[0];
            let worst = rankingAccum[rankingAccum.length - 1];
            if (this._gapContrasteIdsGlobal && this._gapContrasteIdsGlobal.length > 0) {
                const group = rankingAccum.filter(r => this._gapContrasteIdsGlobal.includes(String(r.usuario_id)));
                if (group.length > 0) {
                    const avgVel = group.reduce((acc, curr) => acc + curr.vel, 0) / group.length;
                    const label = group.length === 1 ? group[0].nome : `Média Grupo (${group.length})`;
                    worst = { vel: Math.round(avgVel), nome: label };
                }
            }

            historyDetails.push({ 
                mes: m, 
                nomeMes: mesesNomes[m-1],
                top: { nome: top.nome, vel: top.vel },
                contraste: { nome: worst.nome, vel: worst.vel },
                gap: top.vel - worst.vel
            });
        });

        let html = `
            <div class="animate-enter space-y-4">
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                            <i class="fas fa-table"></i>
                        </div>
                        <div>
                            <h3 class="text-slate-800 font-black uppercase text-xs tracking-widest">Grade Analítica de GAP</h3>
                            <p class="text-[10px] text-slate-400 font-bold uppercase">Visão Tabular (Excel Style)</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                    <div class="overflow-x-auto max-h-[60vh] custom-scrollbar">
                        <table class="w-full text-left border-collapse text-[11px] font-sans">
                            <thead class="bg-[#f8f9fa] border-b border-slate-300 sticky top-0 z-10">
                                <tr>
                                    <th class="px-3 py-2 border-r border-slate-200 font-bold text-slate-600">MÊS</th>
                                    <th class="px-3 py-2 border-r border-slate-200 font-bold text-emerald-700">TOP PERFORMER</th>
                                    <th class="px-3 py-2 border-r border-slate-200 font-bold text-slate-600 text-center">MÉDIA (TOP)</th>
                                    <th class="px-3 py-2 border-r border-slate-200 font-bold text-rose-700">BASE (CONTRASTE)</th>
                                    <th class="px-3 py-2 border-r border-slate-200 font-bold text-slate-600 text-center">MÉDIA (BASE)</th>
                                    <th class="px-3 py-2 border-r border-slate-200 font-bold text-slate-900 text-center bg-amber-50">GAP</th>
                                    <th class="px-3 py-2 font-bold text-slate-900 text-left bg-slate-50 w-1/3">ANÁLISE NARRATIVA</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200">
        `;

        historyDetails.forEach((h, i) => {
            const prev = i > 0 ? historyDetails[i-1] : null;
            
            let insight = "";
            if (!prev) {
                insight = `<span class="text-slate-400 italic">Mês inicial para análise de tendência.</span>`;
            } else {
                const diffTop = h.top.vel - prev.top.vel;
                const diffBase = h.contraste.vel - prev.contraste.vel;
                const diffGap = h.gap - prev.gap;

                const topTxt = diffTop === 0 ? "manteve a produção" : `${diffTop > 0 ? 'subiu' : 'reduziu'} ${Math.abs(diffTop)} pts`;
                const baseTxt = diffBase === 0 ? "manteve o ritmo" : `${diffBase > 0 ? 'subiu' : 'caiu'} ${Math.abs(diffBase)} pts`;
                const gapTxt = diffGap === 0 ? "o GAP estabilizou" : `o GAP ${diffGap < 0 ? 'diminuiu' : 'aumentou'} ${Math.abs(diffGap)} unidades`;

                insight = `<b>${h.top.nome}</b> ${topTxt}, enquanto <b>${h.contraste.nome}</b> ${baseTxt}. Com isso, ${gapTxt}.`;
            }

            html += `
                <tr class="${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} hover:bg-blue-50/30 transition-colors">
                    <td class="px-3 py-2 border-r border-slate-100 font-black text-slate-500">${h.nomeMes.toUpperCase()}</td>
                    <td class="px-3 py-2 border-r border-slate-100 text-slate-700 font-medium">${h.top.nome}</td>
                    <td class="px-3 py-2 border-r border-slate-100 text-center font-mono font-bold">${h.top.vel}</td>
                    <td class="px-3 py-2 border-r border-slate-100 text-slate-700 font-medium">${h.contraste.nome}</td>
                    <td class="px-3 py-2 border-r border-slate-100 text-center font-mono font-bold">${h.contraste.vel}</td>
                    <td class="px-3 py-2 border-r border-slate-100 text-center font-black text-slate-900 bg-amber-50/30">${h.gap}</td>
                    <td class="px-3 py-2 text-slate-600 leading-tight">
                        <p class="text-[10px]">${insight}</p>
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

        Swal.fire({
            title: '',
            html: html,
            width: '1200px',
            padding: '1.5rem',
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
                popup: 'rounded-3xl'
            }
        });
    },

    // --- ANÁLISE DE GAP (TABELA ORIGINAL) ---
    carregarAnaliseGAP: async function() {
        const container = document.getElementById('relatorio-ativo-content');
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20"><i class="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i><p class="text-slate-500 font-bold">Calculando Roadmap de Performance...</p></div>`;
        
        try {
            const { inicio: inicioFiltro, fim } = MinhaArea.getDatasFiltro();
            const ano = inicioFiltro.split('-')[0];
            const inicioYTD = `${ano}-01-01`;

            const alvoId = MinhaArea.getUsuarioAlvo();
            let filtroGrupo = '';
            if (alvoId === 'GRUPO_CLT') filtroGrupo = ' AND (u.contrato IS NULL OR (LOWER(u.contrato) NOT LIKE "%pj%" AND LOWER(u.contrato) NOT LIKE "%terceiro%")) ';
            else if (alvoId === 'GRUPO_TERCEIROS') filtroGrupo = ' AND (LOWER(u.contrato) LIKE "%pj%" OR LOWER(u.contrato) LIKE "%terceiro%") ';
            
            const sql = `SELECT p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, COUNT(DISTINCT p.data_referencia) as dias_trab FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia BETWEEN ? AND ? AND (LOWER(u.funcao) NOT LIKE '%auditor%' AND LOWER(u.funcao) NOT LIKE '%lider%' AND LOWER(u.funcao) NOT LIKE '%gestor%' AND LOWER(u.funcao) NOT LIKE '%coordena%') AND p.usuario_id NOT IN (${this.VISITANTE_IDS.join(',')}) ${filtroGrupo} GROUP BY p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, mes ORDER BY u.nome, mes`;
            const data = await Sistema.query(sql, [inicioYTD, fim]);
            const roadmap = {};
            data.forEach(row => {
                const uid = String(row.usuario_id);
                if (!roadmap[uid]) roadmap[uid] = { id: uid, nome: row.nome, meses: {} };
                roadmap[uid].meses[row.mes] = row.dias_trab > 0 ? (row.total_prod / row.dias_trab) : 0;
            });
            this._gapData = { 
                roadmap, 
                mesIni: 1, 
                mesFim: parseInt(fim.split('-')[1]) 
            };
            this._gapBenchmarkIds = new Set(); // Reset benchmarks
            this._selectedGapUsers = new Set(); // Inicia vazio para evitar "spaghetti chart"
            this.renderizarAnaliseGAP();
        } catch (e) { console.error(e); }
    },

    toggleBenchmark: function(id) {
        if (!this._gapBenchmarkIds) this._gapBenchmarkIds = new Set();
        if (this._gapBenchmarkIds.has(id)) {
            this._gapBenchmarkIds.delete(id);
        } else {
            this._gapBenchmarkIds.add(id);
        }
        this.renderizarAnaliseGAP();
    },

    renderizarAnaliseGAP: function() {
        if (this.relatorioAtivo !== 'gap_analise') return;
        const container = document.getElementById('relatorio-ativo-content');
        const roadmapOrig = Object.values(this._gapData.roadmap);
        if (roadmapOrig.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400">Nenhum dado produtivo encontrado para o período.</div>`;
            return;
        }

        if (!this._gapBenchmarkIds || this._gapBenchmarkIds.size === 0) {
            let maxTotal = -1;
            let topId = null;
            roadmapOrig.forEach(u => {
                let sum = 0;
                Object.values(u.meses).forEach(v => sum += v);
                if (sum > maxTotal) { maxTotal = sum; topId = u.id; }
            });
            this._gapBenchmarkIds = new Set([topId]);
        }

        if (!this._selectedGapUsers) this._selectedGapUsers = new Set(roadmapOrig.map(u => u.id));
        const allSelected = this._selectedGapUsers.size === roadmapOrig.length;

        const bench = roadmapOrig.find(u => u.id == this._gapBenchmarkId);

        // Calcular Evolução antecipadamente para poder ordenar
        const roadmapArr = roadmapOrig.map(as => {
            let pVal = null, lVal = null;
            let sum = 0, count = 0;
            let totalBenchDiff = 0, totalBenchCount = 0;

            for (let m = this._gapData.mesIni; m <= this._gapData.mesFim; m++) {
                const val = as.meses[m] || 0;
                if (val > 0) { 
                    if (pVal === null) pVal = val; 
                    lVal = val; 
                    sum += val;
                    count++;
                }

                // Cálculo do Benchmark Médio para o mês m
                let monthlyBenchSum = 0, monthlyBenchCount = 0;
                this._gapBenchmarkIds.forEach(bid => {
                    const bUser = this._gapData.roadmap[bid];
                    if (bUser && bUser.meses[m] > 0) {
                        monthlyBenchSum += bUser.meses[m];
                        monthlyBenchCount++;
                    }
                });

                if (monthlyBenchCount > 0) {
                    const monthlyBenchAvg = monthlyBenchSum / monthlyBenchCount;
                    totalBenchDiff += (val - monthlyBenchAvg);
                    totalBenchCount++;
                }
            }
            as._ev = (pVal > 0 && lVal > 0) ? ((lVal / pVal) - 1) * 100 : 0;
            as._avg = count > 0 ? sum / count : 0;
            as._diff = totalBenchCount > 0 ? totalBenchDiff / totalBenchCount : 0;
            return as;
        });

        // Ordenar: Benchmarks no topo, os demais pela diferença (maior para menor)
        roadmapArr.sort((a,b) => {
            const aIsBench = this._gapBenchmarkIds.has(a.id);
            const bIsBench = this._gapBenchmarkIds.has(b.id);
            if (aIsBench && !bIsBench) return -1;
            if (!aIsBench && bIsBench) return 1;
            return b._diff - a._diff;
        });

        let ths = '';
        const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        for (let m = this._gapData.mesIni; m <= this._gapData.mesFim; m++) {
            ths += `<th class="px-4 py-4 text-center border-r border-slate-200 bg-slate-100/50">${mesesNomes[m-1]}</th>`;
        }

        let html = `
            <div class="space-y-6 animate-enter">
                <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-100"><i class="fas fa-info-circle"></i></div>
                        <div>
                            <h4 class="font-black text-blue-900 text-xs uppercase tracking-widest">GAP 1:1 - Roadmap</h4>
                            <p class="text-[10px] text-blue-600 font-bold uppercase">Acompanhamento Individual vs Referência</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="MinhaArea.Relatorios.abrirGraficoComparativo()" class="text-[10px] font-black text-white bg-indigo-600 px-4 py-2 rounded-lg border border-indigo-700 hover:bg-indigo-700 shadow-md transition uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-chart-line"></i> Comparar Selecionados
                        </button>
                        <button onclick="MinhaArea.Relatorios.mudarRelatorio('gap_analise')" class="text-[10px] font-black text-blue-700 bg-white px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 shadow-sm transition uppercase tracking-tighter">
                            <i class="fas fa-sync-alt mr-1"></i> Atualizar Dados
                        </button>
                    </div>
                </div>

                <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-sm text-left border-collapse">
                            <thead class="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
                                <tr>
                                    <th class="px-6 py-5 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 min-w-[250px]">
                                        <div class="flex items-center gap-3 group/header">
                                            <div class="flex items-center gap-2">
                                                <input type="checkbox" onchange="MinhaArea.Relatorios.toggleAllGap(this.checked)" ${allSelected ? 'checked' : ''} class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer">
                                                <span class="cursor-default">Assistente</span>
                                            </div>
                                            <div class="hidden group-hover/header:flex items-center gap-1 ml-auto mr-4">
                                                <button onclick="MinhaArea.Relatorios.toggleAllGap(true)" class="text-[9px] bg-slate-200 hover:bg-blue-600 hover:text-white px-1.5 py-0.5 rounded transition">TUDO</button>
                                                <button onclick="MinhaArea.Relatorios.toggleAllGap(false)" class="text-[9px] bg-slate-200 hover:bg-rose-600 hover:text-white px-1.5 py-0.5 rounded transition">NADA</button>
                                            </div>
                                        </div>
                                    </th>
                                    ${ths}
                                    <th class="px-6 py-5 text-center bg-slate-100">Evolução %</th>
                                    <th class="px-6 py-5 text-right bg-rose-50/50 text-rose-800">Diferença vs Ref.</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
        `;

        roadmapArr.forEach(as => {
            const isRef = this._gapBenchmarkIds.has(as.id);
            const checked = allSelected || this._selectedGapUsers.has(as.id) ? 'checked' : '';
            
            html += `<tr class="hover:bg-slate-50 transition group ${isRef ? 'bg-indigo-50/20' : ''}">
                <td class="px-6 py-4 font-black sticky left-0 bg-white z-10 border-r shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-slate-700 bg-clip-padding group-hover:bg-slate-50">
                    <div class="flex items-center gap-3">
                        <input type="checkbox" onchange="MinhaArea.Relatorios.toggleGapUser('${as.id}', event)" ${checked} class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 cursor-pointer">
                        <span class="flex items-center gap-1">
                            <span onclick="MinhaArea.Relatorios.abrirGrafico('${as.id}')" style="cursor:pointer" class="hover:text-blue-600 transition truncate max-w-[150px]">${as.nome}</span>
                            <span onclick="MinhaArea.Relatorios.toggleBenchmark('${as.id}')" class="ml-1 cursor-pointer transition-transform hover:scale-125" title="Fixar como Referência (Benchmark)">
                                ${isRef ? '<i class="fas fa-star text-amber-400"></i>' : '<i class="far fa-star text-slate-300 hover:text-amber-300"></i>'}
                            </span>
                        </span>
                    </div>
                </td>`;
            
            for (let m = this._gapData.mesIni; m <= this._gapData.mesFim; m++) {
                const val = as.meses[m] || 0;
                html += `<td class="px-4 py-4 text-center border-r font-mono font-bold text-slate-500">${val > 0 ? Math.round(val) : '--'}</td>`;
            }
            
            let ev = as._ev;
            let diffHtml = '';
            if (isRef) {
                diffHtml = `<span class="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">Referência</span>`;
            } else {
                let diffVal = Math.round(as._diff);
                diffHtml = `<span class="font-black ${diffVal >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${diffVal > 0 ? '+' : ''}${diffVal} metas/dia</span>`;
            }

            html += `
                <td class="px-6 py-4 text-center bg-slate-50/50 font-black text-[11px] ${ev >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                    ${ev > 0 ? '+' : ''}${ev.toFixed(1)}%
                </td>
                <td class="px-6 py-4 text-right bg-rose-50/30 text-[11px]">
                    ${diffHtml}
                </td>
            </tr>`;
        });

        html += `</tbody></table></div></div></div>`;
        container.innerHTML = html;
    },

    toggleGapUser: function(id, evt) {
        if (evt) evt.stopPropagation();
        if (!this._selectedGapUsers) this._selectedGapUsers = new Set();
        if (this._selectedGapUsers.has(id)) {
            this._selectedGapUsers.delete(id);
        } else {
            this._selectedGapUsers.add(id);
        }
        this.renderizarAnaliseGAP();
    },

    toggleAllGap: function(sel) {
        if (!this._gapData) return;
        const roadmap = Object.values(this._gapData.roadmap);
        if (sel) {
            this._selectedGapUsers = new Set(roadmap.map(u => u.id));
        } else {
            this._selectedGapUsers = new Set();
        }
        this.renderizarAnaliseGAP();
    },

    abrirGraficoComparativo: function() {
        if (!this._gapData) return;
        this.verificarEInjetarModalGrafico(); // [NOVO] Garante que o modal existe
        
        const { roadmap, mesIni, mesFim } = this._gapData;
        let benchmarkLine = null;
        if (this._gapBenchmarkIds && this._gapBenchmarkIds.size > 0) {
            const bIds = Array.from(this._gapBenchmarkIds);
            const label = bIds.length === 1 ? roadmap[bIds[0]].nome : 'Média Referência';
            const virtual = { id: 'virtual_bench', nome: label, meses: {} };
            let hasAnyData = false;
            for (let m = mesIni; m <= mesFim; m++) {
                let mSum = 0, mCount = 0;
                bIds.forEach(bid => {
                    if (roadmap[bid] && roadmap[bid].meses[m] > 0) {
                        mSum += roadmap[bid].meses[m];
                        mCount++;
                    }
                });
                virtual.meses[m] = mCount > 0 ? mSum / mCount : 0;
                if (virtual.meses[m] > 0) hasAnyData = true;
            }
            if (hasAnyData) benchmarkLine = virtual;
        }

        const selectedIds = Array.from(this._selectedGapUsers);
        let usersToDraw = selectedIds.length > 0 ? selectedIds.map(id => roadmap[id]).filter(u => !!u) : [];
        
        // Remove individual benchmark members from the general list to avoid redundancy with the average line
        usersToDraw = usersToDraw.filter(u => !this._gapBenchmarkIds.has(u.id));

        if (benchmarkLine) usersToDraw.unshift(benchmarkLine);
        
        // Se não houver ninguém selecionado, avisa
        if (usersToDraw.length === 0) {
            Swal.fire({
                icon: 'info',
                title: 'Nenhum assistente selecionado',
                text: 'Selecione ao menos um assistente na tabela para comparar com a referência.',
                confirmButtonColor: '#4f46e5'
            });
            return;
        }

        const container = document.getElementById('gap-chart-container');
        if (container) container.classList.remove('hidden');
        const titleEl = document.getElementById('chart-user-name');
        if (titleEl) titleEl.textContent = "Comparativo Geral de Performance";

        setTimeout(() => {
            const canvas = document.getElementById('gap-chart');
            if (!canvas || canvas.tagName !== 'CANVAS') {
                console.error("Canvas 'gap-chart' não encontrado ou inválido.");
                return;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error("Não foi possível obter o contexto 2D do canvas.");
                return;
            }

            if (typeof Chart === 'undefined') {
                console.error("Chart.js não carregado.");
                return;
            }
            
            if (this._gapChartInstance) this._gapChartInstance.destroy();

            const meses = [];
            const labels = [];
            for (let m = mesIni; m <= mesFim; m++) {
                meses.push(m);
                labels.push('Mês ' + m);
            }

            const isSingle = labels.length === 1;
            const userColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#71717a', '#0f172a'];
            const benchColor = '#f43f5e'; // Rose fixo para Benchmark

            const datasets = usersToDraw.map((u, i) => {
                const isBench = u.id === 'virtual_bench' || this._gapBenchmarkIds.has(u.id);
                const baseColor = isBench ? benchColor : userColors[i % userColors.length];
                
                return {
                    label: isBench ? u.nome + " (REF)" : u.nome,
                    data: meses.map(m => u.meses[m] || 0),
                    backgroundColor: isSingle ? baseColor + 'CC' : (isBench ? baseColor + '10' : 'transparent'),
                    borderColor: isBench ? baseColor : baseColor + '90',
                    borderWidth: isBench ? 4 : 1.5,
                    borderRadius: isSingle ? 8 : 0,
                    tension: 0.3,
                    fill: isBench && !isSingle,
                    pointRadius: isSingle ? 0 : (isBench ? 5 : 3),
                    pointBackgroundColor: baseColor
                };
            });

            this._gapChartInstance = new Chart(ctx, {
                type: isSingle ? 'bar' : 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 10, weight: 'bold' }, boxWidth: 12, usePointStyle: true } },
                        tooltip: { 
                            mode: 'index', 
                            intersect: false, 
                            itemSort: (a, b) => b.raw - a.raw, // Ordena do maior para o menor no tooltip
                            callbacks: { 
                                label: (ctx) => {
                                    const val = Math.round(ctx.raw);
                                    const isBench = ctx.dataset.label.includes('(REF)');
                                    if (isBench) return `${ctx.dataset.label}: ${val} metas/dia`;
                                    
                                    const benchDs = ctx.chart.data.datasets.find(d => d.label.includes('(REF)'));
                                    const benchVal = benchDs ? Math.round(benchDs.data[ctx.dataIndex]) : 0;
                                    const diff = val - benchVal;
                                    const perc = benchVal > 0 ? (diff / benchVal) * 100 : 0;
                                    return `${ctx.dataset.label}: ${val} m/d (GAP: ${diff > 0 ? '+' : ''}${diff} | ${Math.round(perc)}%)`;
                                } 
                            } 
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, title: { display: true, text: 'Metas/Dia', font: { size: 10, weight: 'bold' } } },
                        x: { grid: { display: false } }
                    }
                }
            });

            // [NOVO] Renderiza o resumo de GAP fixo abaixo do gráfico
            const summaryContainer = document.getElementById('gap-summary-container');
            if (summaryContainer) {
                const bIds = Array.from(this._gapBenchmarkIds);
                const getBenchVal = (m) => {
                    let s = 0, c = 0;
                    bIds.forEach(bid => { if (roadmap[bid]?.meses[m] > 0) { s += roadmap[bid].meses[m]; c++; } });
                    return c > 0 ? s / c : 0;
                };
                const benchAvg = meses.reduce((acc, m) => acc + getBenchVal(m), 0) / meses.length;
                
                let html = '';
                usersToDraw.forEach(u => {
                    const isBench = u.id === 'virtual_bench' || this._gapBenchmarkIds.has(u.id);
                    const uAvg = meses.reduce((acc, m) => acc + (u.meses[m] || 0), 0) / meses.length;
                    const diff = uAvg - benchAvg;
                    const perc = benchAvg > 0 ? (diff / benchAvg) * 100 : 0;
                    
                    html += `
                        <div class="flex flex-col gap-2 p-3 rounded-2xl ${isBench ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-slate-100 shadow-sm'}">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg ${isBench ? 'bg-rose-500' : 'bg-blue-500'} text-white flex items-center justify-center text-[10px] font-bold">
                                    ${isBench ? '<i class="fas fa-crown"></i>' : u.nome.substring(0, 2).toUpperCase()}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-[10px] font-black text-slate-700 truncate">${u.nome}${isBench ? ' (REF)' : ''}</p>
                                    <span class="text-[10px] font-bold text-slate-500">${Math.round(uAvg)} metas/dia</span>
                                </div>
                            </div>
                            ${!isBench ? `
                                <div class="pt-2 border-t border-slate-200 mt-1">
                                    <p class="text-[9px] font-black uppercase ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'} leading-tight">
                                        ${diff >= 0 ? 'ACIMA' : 'ABAIXO'} DA REFERÊNCIA
                                    </p>
                                    <p class="text-[11px] font-black text-slate-800">
                                        ${diff >= 0 ? '+' : ''}${Math.round(diff)} metas/dia (${Math.round(perc)}%)
                                    </p>
                                </div>
                            ` : `
                                <div class="pt-2 border-t border-rose-200 mt-1 opacity-60 italic">
                                    <p class="text-[9px] font-black text-rose-800 uppercase tracking-tighter">Padrão de Performance</p>
                                    <p class="text-[11px] font-black text-rose-900 leading-tight">Meta de Referência</p>
                                </div>
                            `}
                        </div>
                    `;
                });
                summaryContainer.innerHTML = html;
            }
        }, 150);
    },

    abrirGrafico: function(userId) {
        if (!this._gapData || !userId) return;
        this.verificarEInjetarModalGrafico();
        
        const { roadmap, mesIni, mesFim } = this._gapData;
        const user = roadmap[userId];
        if (!user) return;

        // Create virtual bench for individual comparison
        const bIds = Array.from(this._gapBenchmarkIds);
        const label = bIds.length === 1 ? roadmap[bIds[0]].nome : 'Média Referência';
        const virtualBench = { id: 'virtual_bench', nome: label, meses: {} };
        for (let m = mesIni; m <= mesFim; m++) {
            let mSum = 0, mCount = 0;
            bIds.forEach(bid => { if (roadmap[bid]?.meses[m] > 0) { mSum += roadmap[bid].meses[m]; mCount++; } });
            virtualBench.meses[m] = mCount > 0 ? mSum / mCount : 0;
        }

        const container = document.getElementById('gap-chart-container');
        container.classList.remove('hidden');
        document.getElementById('chart-user-name').textContent = user.nome + " vs Benchmark";

        setTimeout(() => {
            const canvas = document.getElementById('gap-chart');
            if (!canvas || canvas.tagName !== 'CANVAS') {
                console.error("Canvas 'gap-chart' não encontrado ou inválido.");
                return;
            }
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error("Não foi possível obter o contexto 2D do canvas.");
                return;
            }

            if (typeof Chart === 'undefined') {
                console.error("Chart.js não carregado.");
                return;
            }
            
            if (this._gapChartInstance) this._gapChartInstance.destroy();

            const meses = [];
            const labels = [];
            for (let m = mesIni; m <= mesFim; m++) {
                meses.push(m);
                labels.push('Mês ' + m);
            }

            const isSingle = labels.length === 1;
            const userData = meses.map(m => user.meses[m] || 0);
            const refData = meses.map(m => virtualBench.meses[m] || 0);
            const userBaseColor = '#3b82f6'; // Azul fixo para usuário
            const refBaseColor = '#f43f5e';  // Rose fixo para referência

            this._gapChartInstance = new Chart(ctx, {
                type: isSingle ? 'bar' : 'line',
                data: {
                    labels: labels,
                    datasets: [
                        { 
                            label: user.nome, 
                            data: userData, 
                            backgroundColor: isSingle ? userBaseColor : userBaseColor + '20', 
                            borderColor: userBaseColor,
                            borderWidth: 2,
                            borderRadius: isSingle ? 8 : 0,
                            fill: !isSingle,
                            tension: 0.3
                        },
                        { 
                            label: virtualBench.nome + " (REF)", 
                            data: refData, 
                            backgroundColor: isSingle ? refBaseColor : refBaseColor + '20', 
                            borderColor: refBaseColor,
                            borderWidth: 2,
                            borderRadius: isSingle ? 8 : 0,
                            fill: !isSingle,
                            tension: 0.3
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 10, weight: 'bold' }, boxWidth: 12 } },
                        tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.raw)} metas/dia` } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, title: { display: true, text: 'Metas/Dia', font: { size: 10, weight: 'bold' } } },
                        x: { grid: { display: false } }
                    }
                }
            });

            // [NOVO] Resumo individual
            const summaryContainer = document.getElementById('gap-summary-container');
            if (summaryContainer) {
                const uAvg = userData.reduce((a, b) => a + b, 0) / labels.length;
                const bAvg = refData.reduce((a, b) => a + b, 0) / labels.length;
                const diff = uAvg - bAvg;
                const perc = bAvg > 0 ? (diff / bAvg) * 100 : 0;

                summaryContainer.innerHTML = `
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <div class="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                            ${user.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black text-slate-700 truncate">${user.nome}</p>
                            <span class="text-[10px] font-bold text-slate-500">${Math.round(uAvg)} m/d</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
                        <div class="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold">
                            <i class="fas fa-crown"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black text-slate-700 truncate">${benchmark.nome} (REF)</p>
                            <span class="text-[10px] font-bold text-slate-500">${Math.round(bAvg)} m/d</span>
                        </div>
                    </div>
                    <div class="flex flex-col justify-center px-4 bg-slate-900 rounded-xl text-white">
                        <p class="text-[9px] font-bold uppercase opacity-60">Diferença Final (GAP)</p>
                        <p class="text-xs font-black ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                            ${diff >= 0 ? '+' : ''}${Math.round(diff)} metas/dia (${Math.round(perc)}%)
                        </p>
                    </div>
                `;
            }
        }, 150);
    },

    fecharGrafico: function() {
        const container = document.getElementById('gap-chart-container');
        if (container) container.classList.add('hidden');
        if (this._gapChartInstance) { this._gapChartInstance.destroy(); this._gapChartInstance = null; }
    },

    verificarEInjetarModalGrafico: function() {
        const canvas = document.getElementById('gap-chart');
        const summary = document.getElementById('gap-summary-container');
        
        // Só pula se ambos existirem
        if (canvas && canvas.tagName === 'CANVAS' && summary) return;
        
        const old = document.getElementById('gap-chart-container');
        if (old) old.remove();

        console.warn("Modal de gráfico incompleto. Reinjetando com painel de resumo...");
        
        const modal = document.createElement('div');
        modal.id = 'gap-chart-container';
        modal.className = 'fixed inset-0 z-[120] hidden bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden">
                <div class="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-100">
                            <i class="fas fa-chart-bar"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-slate-800 text-xs uppercase tracking-widest leading-tight">Análise de Tendência</h3>
                            <p id="chart-user-name" class="text-[10px] text-slate-400 font-bold">Visualização Comparativa</p>
                        </div>
                    </div>
                    <button onclick="MinhaArea.Relatorios.fecharGrafico()" class="text-slate-400 hover:text-rose-500 transition">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="p-8">
                    <div class="h-[350px] w-full relative">
                        <canvas id="gap-chart"></canvas>
                    </div>
                    <!-- [NOVO] Container para o Resumo de GAP Fixo -->
                    <div id="gap-summary-container" class="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto max-h-[150px]">
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    carregarRankingFrases: async function() {
        try {
            const data = await this.Exportar.fetchFrases();
            if (!data) return;
            this._rawRankingData = data;
            this.atualizarSugestoesRanking();
            this.renderizarRankingFrases(false); 
        } catch (e) { 
            console.error("Erro ao carregar ranking de frases:", e); 
        }
    },

    renderizarRankingFrases: function(showAll = false) {
        if (this.relatorioAtivo !== 'ranking_frases') return;
        const container = document.getElementById('relatorio-ativo-content');
        if (!container || !this._rawRankingData) return;

        const data = showAll ? this._rawRankingData : this._rawRankingData.slice(0, 10);
        const total = this._rawRankingData.length;

        let html = `
            <div class="space-y-4 animate-enter">
                <div class="flex items-center justify-between bg-slate-100 p-3 rounded-t-xl border border-slate-200 border-b-0">
                    <div class="flex items-center gap-3">
                        <div class="bg-indigo-600 text-white p-2 rounded shadow-sm"><i class="fas fa-table text-sm"></i></div>
                        <div>
                            <h3 class="text-xs font-black text-slate-700 uppercase tracking-widest leading-none">Ranking de Uso - Biblioteca</h3>
                            <p class="text-[9px] text-slate-400 font-bold mt-1">Visão de Grade Analítica (Consolidado Equipe)</p>
                        </div>
                    </div>
                    <button onclick="MinhaArea.Relatorios.copiarRanking()" 
                            class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 px-4 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-2 shadow-sm transition active:scale-95">
                        <i class="fas fa-copy"></i> COPIAR RANKING
                    </button>
                </div>

                <div class="bg-white border border-slate-300 rounded-b-xl overflow-hidden shadow-sm">
                    <div class="max-h-[600px] overflow-auto custom-scroll">
                        <table class="w-full text-xs text-left border-collapse table-fixed">
                            <thead class="bg-slate-50 text-[10px] font-black uppercase text-slate-500 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                <tr class="divide-x divide-slate-200">
                                    <th class="px-3 py-3 w-12 text-center bg-slate-100 border-b border-slate-200">#</th>
                                    <th class="px-3 py-3 w-20 text-center bg-slate-100 border-b border-slate-200">USOS</th>
                                    <th class="px-4 py-3 border-b border-slate-200">CONTEÚDO DA FRASE</th>
                                    <th class="px-4 py-3 w-32 border-b border-slate-200">EMPRESA</th>
                                    <th class="px-4 py-3 w-32 border-b border-slate-200">DOCUMENTO</th>
                                    <th class="px-4 py-3 w-40 border-b border-slate-200">MOTIVO</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200">
        `;

        data.forEach((f, i) => {
            const rank = i + 1;
            const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
            
            html += `
                <tr class="${rowBg} hover:bg-indigo-50/30 transition-colors divide-x divide-slate-200 cursor-pointer" onclick="MinhaArea.Relatorios.abrirDetalheFrase(${i})">
                    <td class="px-3 py-2 text-center font-black text-slate-400 bg-slate-50/30">${rank}</td>
                    <td class="px-3 py-2 text-center font-mono font-black text-indigo-600">${f.usos || 0}</td>
                    <td class="px-4 py-2">
                        <div class="text-[11px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap line-clamp-2" title="${f.conteudo.replace(/"/g, '&quot;')}">
                            ${f.conteudo}
                        </div>
                    </td>
                    <td class="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase truncate">${f.empresa || '-'}</td>
                    <td class="px-4 py-2 text-[10px] font-bold text-blue-600 truncate">${f.documento || '-'}</td>
                    <td class="px-4 py-2 text-[10px] font-bold text-slate-600 truncate">${f.motivo || '-'}</td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>

                    ${!showAll && total > 10 ? `
                        <div class="p-4 bg-slate-50 border-t border-slate-200 text-center">
                            <button onclick="MinhaArea.Relatorios.renderizarRankingFrases(true)" 
                                    class="bg-white border border-indigo-200 text-indigo-600 px-8 py-2.5 rounded-xl font-black text-[11px] shadow-sm hover:bg-indigo-50 transition-all flex items-center gap-2 mx-auto uppercase tracking-widest">
                                <i class="fas fa-stream"></i> Carregar Ranking Completo (${total} Frases)
                            </button>
                        </div>
                    ` : ''}
                </div>
                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter text-right italic">* Clique no conteúdo para ver a frase completa (tooltip)</p>
            </div>
        `;

        container.innerHTML = html;
        container.scrollTop = 0;
    },

    copiarRanking: function() {
        if (!this._rawRankingData) return;
        
        let text = "RANKING DE USO DE FRASES - GUPYMESA\n\n";
        this._rawRankingData.forEach((f, i) => {
            text += `[#${i + 1}] USOS: ${f.usos || 0} | ${f.motivo || ''} | ${f.empresa || ''} - ${f.documento || ''}\n`;
            text += `"${f.conteudo}"\n\n`;
        });

        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        alert("Ranking copiado para a área de transferência!");
    },

    abrirDetalheFrase: function(index) {
        if (!this._rawRankingData || !this._rawRankingData[index]) return;
        const f = this._rawRankingData[index];

        document.getElementById('ranking-edit-id').value = f.id || '';
        document.getElementById('ranking-edit-empresa').value = f.empresa || '';
        document.getElementById('ranking-edit-doc').value = f.documento || '';
        document.getElementById('ranking-edit-motivo').value = f.motivo || '';
        document.getElementById('ranking-edit-conteudo').value = f.conteudo || '';
        document.getElementById('ranking-edit-usos').innerText = f.usos || 0;

        document.getElementById('modal-ranking-detalhe').classList.remove('hidden');
    },

    salvarFrase: async function() {
        const id = document.getElementById('ranking-edit-id').value;
        const payload = {
            empresa: document.getElementById('ranking-edit-empresa').value,
            documento: document.getElementById('ranking-edit-doc').value,
            motivo: document.getElementById('ranking-edit-motivo').value,
            conteudo: document.getElementById('ranking-edit-conteudo').value
        };

        try {
            const response = await fetch('/api/biblioteca', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', table: 'frases', id, data: payload })
            });
            const res = await response.json();
            if (res.error) throw new Error(res.error);

            Swal.fire({ icon: 'success', title: 'Frase atualizada!', timer: 1500, showConfirmButton: false });
            document.getElementById('modal-ranking-detalhe').classList.add('hidden');
            this.carregarRankingFrases();
        } catch (e) {
            Swal.fire('Erro ao salvar', e.message, 'error');
        }
    },

    excluirFrase: async function() {
        const id = document.getElementById('ranking-edit-id').value;
        const confirm = await Swal.fire({
            title: 'Excluir esta frase?',
            text: "Esta ação não pode ser desfeita na Biblioteca.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            try {
                const response = await fetch('/api/biblioteca', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete', table: 'frases', id })
                });
                const res = await response.json();
                if (res.error) throw new Error(res.error);

                Swal.fire({ icon: 'success', title: 'Frase excluída!', timer: 1500, showConfirmButton: false });
                document.getElementById('modal-ranking-detalhe').classList.add('hidden');
                this.carregarRankingFrases();
            } catch (e) {
                Swal.fire('Erro ao excluir', e.message, 'error');
            }
        }
    },

    atualizarSugestoesRanking: function() {
        if (!this._rawRankingData) return;
        
        const items = this._rawRankingData;
        const empresas = [...new Set(items.map(f => f.empresa).filter(Boolean))].sort();
        const docs = [...new Set(items.map(f => f.documento).filter(Boolean))].sort();
        const motivos = [...new Set(items.map(f => f.motivo).filter(Boolean))].sort();

        const populate = (id, list) => {
            let el = document.getElementById(id);
            if (!el) {
                el = document.createElement('datalist');
                el.id = id;
                document.body.appendChild(el);
            }
            el.innerHTML = list.map(i => `<option value="${i}">`).join('');
        };

        populate('list-empresas-ranking', empresas);
        populate('list-documentos-ranking', docs);
        populate('list-motivos-ranking', motivos);
    }
};
