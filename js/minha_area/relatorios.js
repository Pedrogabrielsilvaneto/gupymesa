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
        try {
            if (!MinhaArea.isAdmin()) return;
            const datas = MinhaArea.getDatasFiltro();
            const { inicio } = datas;
            const ano = inicio.split('-')[0];
            const inicioAno = `${ano}-01-01`;
            const fimAno = `${ano}-12-31`;

            const sql = `
                SELECT 
                    p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, 
                    MONTH(p.data_referencia) as mes, 
                    SUM(p.quantidade) as total_prod, 
                    COUNT(DISTINCT p.data_referencia) as dias_trab,
                    AVG(COALESCE(a.assertividade_val, 0)) as media_assert
                FROM producao p 
                JOIN usuarios u ON p.usuario_id = u.id 
                LEFT JOIN assertividade a ON p.usuario_id = a.usuario_id AND p.data_referencia = a.data_referencia
                WHERE p.data_referencia >= ? AND p.data_referencia <= ? 
                  AND u.ativo = 1 
                  AND p.usuario_id NOT IN (2026, 200601) 
                  AND (LOWER(u.funcao) NOT LIKE '%auditor%' AND LOWER(u.funcao) NOT LIKE '%lider%' AND LOWER(u.funcao) NOT LIKE '%gestor%' AND LOWER(u.funcao) NOT LIKE '%coordena%') 
                GROUP BY p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, mes 
                ORDER BY mes, total_prod DESC
            `;
            const data = await Sistema.query(sql, [inicioAno, fimAno]);
            this._gapDataFull = data;
            this.renderizarGAP11();
        } catch (e) { console.error(e); }
    },

    renderizarGAP11: function() {
        if (this.relatorioAtivo !== 'gap') return;
        const container = document.getElementById('relatorio-ativo-content');
        if (!container || !this._gapDataFull) return;

        const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        
        let html = `
            <div class="flex flex-col md:flex-row gap-6 h-auto md:h-[750px] animate-enter">
                <!-- Sidebar Meses -->
                <div class="w-full md:w-48 shrink-0 flex md:flex-col gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 overflow-x-auto md:overflow-y-auto no-scrollbar md:custom-scrollbar">
                    <h4 class="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Selecione o Mês</h4>
                    ${mesesNomes.map((nome, i) => {
                        const m = i + 1;
                        const ativo = this._gapMesAtivo === m;
                        const temDados = this._gapDataFull.some(d => d.mes === m);
                        return `
                            <button onclick="MinhaArea.Relatorios.mudarMesGap11(${m})" 
                                class="shrink-0 md:shrink md:w-full text-center md:text-left px-4 py-3 rounded-xl font-bold text-xs transition-all ${temDados ? '' : 'opacity-40'} ${ativo ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'hover:bg-white text-slate-600'}">
                                ${nome}
                            </button>
                        `;
                    }).join('')}
                </div>

                <!-- Conteúdo Principal -->
                <div class="flex-1 flex flex-col gap-6 overflow-hidden">
                    <div id="gap-main-view" class="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <!-- Header do Gap -->
                        <div class="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                                    <i class="fas fa-balance-scale"></i>
                                </div>
                                <div>
                                    <h3 class="font-black text-slate-800 text-sm uppercase tracking-widest leading-tight">Análise de GAP Mês a Mês</h3>
                                    <p class="text-[10px] text-slate-400 font-bold">Relatório GAP 1:1 - ${mesesNomes[this._gapMesAtivo-1]}</p>
                                </div>
                            </div>
                        </div>

                        <div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
                            ${this.renderizarConteudoMesGap11()}
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    },

    mudarMesGap11: function(m) {
        this._gapMesAtivo = m;
        this.renderizarGAP11();
    },

    setGapPior11: function(m, id) {
        this._gapPiorIdPorMes[m] = id;
        this.renderizarGAP11();
    },

    renderizarConteudoMesGap11: function() {
        const m = this._gapMesAtivo;
        const dadosMes = this._gapDataFull.filter(d => d.mes === m);
        
        if (dadosMes.length === 0) {
            return `<div class="h-full flex flex-col items-center justify-center text-slate-300 italic py-20">
                <i class="fas fa-ghost text-5xl mb-4 opacity-20"></i>
                <p>Sem dados de produtividade para este mês.</p>
            </div>`;
        }

        // Top Performance (calculado: maior total_prod / dias_trab)
        const top = [...dadosMes].sort((a,b) => (b.total_prod/b.dias_trab) - (a.total_prod/a.dias_trab))[0];
        
        // Pior do Mês (Selecionado pela Gestora ou o menor se não selecionado)
        const piorId = this._gapPiorIdPorMes?.[m];
        let pior = dadosMes.find(d => String(d.usuario_id) === String(piorId));
        if (!pior) pior = [...dadosMes].sort((a,b) => (a.total_prod/a.dias_trab) - (b.total_prod/b.dias_trab))[0];

        const getMetrics = (d) => {
            const v = d.total_prod / d.dias_trab;
            const a = Number(d.media_assert) || 0;
            return { vel: Math.round(v), ass: a.toFixed(1) };
        };

        const mt = getMetrics(top);
        const mp = getMetrics(pior);

        return `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <!-- Coluna: Melhor do Mês -->
                <div class="flex flex-col gap-4">
                    <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                                <i class="fas fa-crown"></i>
                            </div>
                            <h4 class="font-black text-emerald-900 text-xs uppercase tracking-widest">Melhor do Mês</h4>
                        </div>
                    </div>

                    <div class="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center gap-4 relative overflow-hidden">
                        <div class="absolute -right-6 -top-6 text-emerald-500/5 text-8xl rotate-12"><i class="fas fa-award"></i></div>
                        
                        <div class="w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl font-black border-4 border-white shadow-xl">
                            ${top.nome.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <h5 class="font-black text-slate-800 text-xl leading-tight">${top.nome}</h5>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${top.funcao || 'Assistente'}</p>
                        </div>

                        <div class="grid grid-cols-2 gap-4 w-full mt-4">
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Velocidade</p>
                                <p class="text-2xl font-black text-slate-800">${mt.vel}<span class="text-[10px] text-slate-400 ml-1">metas/dia</span></p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Assertividade</p>
                                <p class="text-2xl font-black text-slate-800">${mt.ass}%</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Coluna: Pior do Mês -->
                <div class="flex flex-col gap-4">
                    <div class="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-100">
                                <i class="fas fa-user-minus"></i>
                            </div>
                            <h4 class="font-black text-rose-900 text-xs uppercase tracking-widest">Pior do Mês</h4>
                        </div>
                        <div class="flex flex-col gap-2 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <select onchange="MinhaArea.Relatorios.setGapPior11(${m}, this.value)" 
                                    class="w-full text-[10px] font-black uppercase tracking-tighter outline-none cursor-pointer text-slate-500 hover:text-blue-600 transition">
                                <option value="">Trocar Colaborador...</option>
                                ${dadosMes.sort((a,b) => a.nome.localeCompare(b.nome)).map(d => `<option value="${d.usuario_id}" ${String(d.usuario_id) === String(pior.usuario_id) ? 'selected' : ''}>${d.nome}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div class="bg-white border-2 border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col items-center text-center gap-4 relative overflow-hidden">
                        <div class="absolute -right-6 -top-6 text-rose-500/5 text-8xl rotate-12"><i class="fas fa-chart-line"></i></div>
                        
                        <div class="w-24 h-24 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-3xl font-black border-4 border-white shadow-xl">
                            ${pior.nome.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                            <h5 class="font-black text-slate-800 text-xl leading-tight">${pior.nome}</h5>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${pior.funcao || 'Assistente'}</p>
                        </div>

                        <div class="grid grid-cols-2 gap-4 w-full mt-4">
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Velocidade</p>
                                <p class="text-2xl font-black text-slate-800">${mp.vel}<span class="text-[10px] text-slate-400 ml-1">metas/dia</span></p>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Assertividade</p>
                                <p class="text-2xl font-black text-slate-800">${mp.ass}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Dashboard de GAP -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <!-- Card GAP Central -->
                <div class="md:col-span-1 bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group hover:shadow-xl transition-all duration-500">
                    <div class="absolute -right-8 -bottom-8 w-32 h-32 bg-rose-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
                    <i class="fas fa-chart-area text-rose-200 text-5xl absolute left-6 top-6 opacity-30"></i>
                    
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 relative z-10">Déficit de Performance</span>
                    <h2 class="text-5xl font-black text-rose-600 mb-2 relative z-10">-${Math.round((1 - (mp.vel/mt.vel))*100)}%</h2>
                    <div class="px-4 py-1.5 bg-rose-100 text-rose-700 rounded-full text-[11px] font-black relative z-10">
                        ${mt.vel - mp.vel} metas/dia de GAP
                    </div>
                </div>

                <div class="md:col-span-2 bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden flex flex-col justify-center">
                    <div class="absolute top-0 right-0 p-8 opacity-10">
                        <i class="fas fa-quote-right text-8xl"></i>
                    </div>
                    <h4 class="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                        <i class="fas fa-lightbulb text-amber-400"></i> Insight de Gestão
                    </h4>
                    <p class="text-base text-slate-300 leading-relaxed font-medium italic">
                        "Para atingir o nível de performance do <b>${top.nome}</b>, o colaborador <b>${pior.nome}</b> precisa aumentar sua produção diária em <b>${mt.vel - mp.vel} metas</b>, mantendo a assertividade acima de 97%."
                    </p>
                </div>
            </div>
        `;
    },

    // --- ANÁLISE DE GAP (TABELA ORIGINAL) ---
    carregarAnaliseGAP: async function() {
        const container = document.getElementById('relatorio-ativo-content');
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-20"><i class="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-4"></i><p class="text-slate-500 font-bold">Calculando Roadmap de Performance...</p></div>`;
        
        try {
            const ano = document.getElementById('sel-ano').value;
            const sub = document.getElementById('sel-subperiodo-ano').value;
            let inicio, fim;
            if (sub === 'full') { inicio = `${ano}-01-01`; fim = `${ano}-12-31`; }
            else if (sub.startsWith('S')) { 
                inicio = sub === 'S1' ? `${ano}-01-01` : `${ano}-07-01`; 
                fim = sub === 'S1' ? `${ano}-06-30` : `${ano}-12-31`; 
            } else {
                const t = parseInt(sub.substring(1));
                inicio = `${ano}-0${(t-1)*3 + 1}-01`.replace('-010-', '-10-');
                fim = `${ano}-0${t*3}-30`.replace('-03-30', '-03-31').replace('-06-30', '-06-30').replace('-09-30', '-09-30').replace('-012-30', '-12-31');
            }

            const filtroGrupo = window._filtroGrupo ? `AND u.contrato = '${window._filtroGrupo}'` : '';
            const sql = `SELECT p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, MONTH(p.data_referencia) as mes, SUM(p.quantidade) as total_prod, COUNT(DISTINCT p.data_referencia) as dias_trab FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia BETWEEN ? AND ? AND (LOWER(u.funcao) NOT LIKE '%auditor%' AND LOWER(u.funcao) NOT LIKE '%lider%' AND LOWER(u.funcao) NOT LIKE '%gestor%' AND LOWER(u.funcao) NOT LIKE '%coordena%') ${filtroGrupo} GROUP BY p.usuario_id, u.nome, u.perfil, u.funcao, u.contrato, mes ORDER BY u.nome, mes`;
            const data = await Sistema.query(sql, [inicio, fim]);
            const roadmap = {};
            data.forEach(row => {
                const uid = String(row.usuario_id);
                if (!roadmap[uid]) roadmap[uid] = { id: uid, nome: row.nome, meses: {} };
                roadmap[uid].meses[row.mes] = row.dias_trab > 0 ? (row.total_prod / row.dias_trab) : 0;
            });
            this._gapData = { roadmap, mesIni: new Date(inicio+'T12:00:00').getMonth() + 1, mesFim: new Date(fim+'T12:00:00').getMonth() + 1 };
            this._gapBenchmarkId = null; 
            this.renderizarAnaliseGAP();
        } catch (e) { console.error(e); }
    },

    renderizarAnaliseGAP: function() {
        if (this.relatorioAtivo !== 'gap_analise') return;
        const container = document.getElementById('relatorio-ativo-content');
        const roadmap = Object.values(this._gapData.roadmap);
        if (roadmap.length === 0) {
            container.innerHTML = `<div class="text-center py-20 text-slate-400">Nenhum dado produtivo encontrado para o período.</div>`;
            return;
        }

        if (!this._gapBenchmarkId) {
            let maxTotal = -1;
            roadmap.forEach(u => {
                let sum = 0;
                Object.values(u.meses).forEach(v => sum += v);
                if (sum > maxTotal) { maxTotal = sum; this._gapBenchmarkId = u.id; }
            });
        }

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
                            <h4 class="font-black text-blue-900 text-xs uppercase tracking-widest">Roadmap de Performance</h4>
                            <p class="text-[10px] text-blue-600 font-bold uppercase">Comparativo de Média Diária por Mês</p>
                        </div>
                    </div>
                    <button onclick="MinhaArea.Relatorios.mudarRelatorio('gap_analise')" class="text-[10px] font-black text-blue-700 bg-white px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition uppercase tracking-tighter">
                        <i class="fas fa-sync-alt mr-1"></i> Atualizar Dados
                    </button>
                </div>

                <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    <div class="overflow-x-auto custom-scrollbar">
                        <table class="w-full text-sm text-left border-collapse">
                            <thead class="bg-slate-50 text-slate-600 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
                                <tr>
                                    <th class="px-6 py-5 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 min-w-[200px]">Nome do Assistente</th>
                                    ${ths}
                                    <th class="px-6 py-5 text-center bg-slate-100">Evolução</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
        `;

        roadmap.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(as => {
            const isRef = as.id == this._gapBenchmarkId;
            let onclick = isRef ? '' : `onclick="MinhaArea.Relatorios.abrirGrafico('${as.id}')" style="cursor:pointer"`;
            html += `<tr ${onclick} class="hover:bg-slate-50 transition group ${isRef ? 'bg-rose-50/10' : ''}"><td class="px-6 py-4 font-black sticky left-0 bg-white z-10 border-r shadow-[1px_0_0_0_rgba(0,0,0,0.05)] text-slate-700 bg-clip-padding group-hover:bg-slate-50">${as.nome} ${isRef ? '⭐' : ''}</td>`;
            
            let pVal = null, lVal = null;
            for (let m = this._gapData.mesIni; m <= this._gapData.mesFim; m++) {
                const val = as.meses[m] || 0;
                if (val > 0) { if (pVal === null) pVal = val; lVal = val; }
                html += `<td class="px-4 py-4 text-center border-r font-mono font-bold text-slate-500">${val > 0 ? Math.round(val) : '--'}</td>`;
            }
            
            let ev = (pVal > 0 && lVal > 0) ? ((lVal / pVal) - 1) * 100 : 0;
            html += `
                <td class="px-6 py-4 text-center bg-slate-50/50 font-black text-[11px] ${ev >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                    ${ev > 0 ? '+' : ''}${ev.toFixed(1)}%
                </td>
            </tr>`;
        });

        html += `</tbody></table></div></div></div>`;
        container.innerHTML = html;
    },

    toggleAllGap: function(sel) {
        if (!sel) this._selectedGapUsers = new Set(['FORCED_EMPTY']); else this._selectedGapUsers.clear();
        this.renderizarGAP();
    },

    abrirGraficoComparativo: function() {
        if (!this._gapData) return;
        this.verificarEInjetarModalGrafico(); // [NOVO] Garante que o modal existe
        
        const { roadmap, mesIni, mesFim } = this._gapData;
        const selectedIds = Array.from(this._selectedGapUsers);
        let usersToDraw = selectedIds.length > 0 ? selectedIds.map(id => roadmap[id]).filter(u => !!u) : Object.values(roadmap);
        
        // [NOVO] Garante que o Benchmark (Top Performer) sempre esteja no gráfico
        if (this._gapBenchmarkId && !usersToDraw.some(u => u.id == this._gapBenchmarkId)) {
            const bench = roadmap[this._gapBenchmarkId];
            if (bench) usersToDraw.unshift(bench);
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
                const isBench = u.id == this._gapBenchmarkId;
                const baseColor = isBench ? benchColor : userColors[i % userColors.length];
                
                return {
                    label: isBench ? u.nome + " (Referência)" : u.nome,
                    data: meses.map(m => u.meses[m] || 0),
                    backgroundColor: isSingle ? baseColor + 'CC' : baseColor + '20',
                    borderColor: baseColor,
                    borderWidth: isSingle ? 0 : 2,
                    borderRadius: isSingle ? 8 : 0,
                    tension: 0.3,
                    fill: !isSingle,
                    pointRadius: isSingle ? 0 : 4,
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
                            callbacks: { 
                                label: (ctx) => {
                                    const val = Math.round(ctx.raw);
                                    const isBench = ctx.dataset.label.includes('Referência');
                                    if (isBench) return `${ctx.dataset.label}: ${val} metas/dia`;
                                    
                                    const benchDs = ctx.chart.data.datasets.find(d => d.label.includes('Referência'));
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
                const bench = roadmap[this._gapBenchmarkId];
                const benchAvg = meses.reduce((acc, m) => acc + (bench.meses[m] || 0), 0) / meses.length;
                
                let html = '';
                usersToDraw.forEach(u => {
                    const isBench = u.id == this._gapBenchmarkId;
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
        const benchmark = roadmap[this._gapBenchmarkId];
        if (!user || !benchmark) return;

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
            const refData = meses.map(m => benchmark.meses[m] || 0);
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
                            label: "Referência", 
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
