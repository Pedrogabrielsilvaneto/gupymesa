/**
 * MÓDULO: Produtividade.Matriz
 * FUNÇÃO: Grade anual de resultados agrupada por assistente
 * CORREÇÃO: Alinhamento de seletores com o arquivo produtividade.html
 */
Produtividade.Matriz = {
    initialized: false,

    init: function () {
        if (!this.initialized) { this.initialized = true; }
        this.carregar();
    },

    carregar: async function () {
        const tbody = document.getElementById('matriz-body');
        if (!tbody) return;

        // CORREÇÃO: O ID correto no HTML é 'sel-ano', não 'global-date'
        const anoSelect = document.getElementById('sel-ano');
        let ano = new Date().getFullYear();
        if (anoSelect && anoSelect.value) {
            ano = parseInt(anoSelect.value);
        }

        tbody.innerHTML = '<tr><td colspan="20" class="text-center py-12 text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i> Buscando dados anuais...</td></tr>';

        try {
            // [MIGRATION v4.32] Supabase -> TiDB (Sistema.query)
            const sql = `
                SELECT 
                    p.quantidade, p.data_referencia, p.usuario_id, p.fator,
                    u.id, u.nome, u.perfil, u.funcao, u.contrato
                FROM producao p
                INNER JOIN usuarios u ON p.usuario_id = u.id
                WHERE p.data_referencia BETWEEN ? AND ?
            `;
            const params = [`${ano}-01-01`, `${ano}-12-31`];

            const data = await Sistema.query(sql, params);

            if (data === null) throw new Error("Falha na consulta SQL.");

            const filtroFuncao = (window.Produtividade.Filtros?.estado?.funcao || 'todos').toUpperCase();
            const users = {};

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="20" class="text-center py-12 text-slate-400 italic">Nenhum dado encontrado para o ano de ' + ano + '.</td></tr>';
                return;
            }

            // Aplica filtros se a engine estiver carregada
            const dadosFiltrados = (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.preFiltrar === 'function')
                ? window.Produtividade.Filtros.preFiltrar(data)
                : data;

            dadosFiltrados.forEach(r => {
                // [ADAPTATION] Flat structure from SQL JOIN (no nested .usuario property)
                const uid = r.id || r.usuario_id;
                if (!uid) return;

                const nome = r.nome || 'Sem Nome';
                const cargo = r.funcao ? String(r.funcao).toUpperCase() : 'ASSISTENTE';
                const perfil = r.perfil ? String(r.perfil).toUpperCase() : '';

                // Filtro de cargos de Gestão (Esconde por padrão se filtro for 'TODOS')
                if (filtroFuncao === 'TODOS') {
                    const termosGestao = ['GESTOR', 'AUDITOR', 'LIDER', 'ADMIN', 'COORDENADOR'];
                    const ehGestora = termosGestao.some(t => cargo.includes(t) || perfil.includes(t));
                    if (ehGestora) return;
                }

                if (!users[uid]) {
                    users[uid] = {
                        nome: nome,
                        cargo: cargo,
                        contrato: r.contrato || 'PJ',
                        months: Array.from({ length: 12 }, () => ({ prod: 0, fator: 0 }))
                    };
                }

                // Mapeia o mês da data_referencia (YYYY-MM-DD)
                const mesIndex = parseInt(r.data_referencia.split('-')[1]) - 1;
                if (mesIndex >= 0 && mesIndex <= 11) {
                    users[uid].months[mesIndex].prod += (Number(r.quantidade) || 0);
                    users[uid].months[mesIndex].fator += (r.fator !== null ? Number(r.fator) : 1.0);
                }
            });

            const listaUsers = Object.values(users).sort((a, b) => a.nome.localeCompare(b.nome));
            this.renderizar(listaUsers, tbody);

        } catch (err) {
            console.error("Erro Crítico na Matriz:", err);
            tbody.innerHTML = `<tr><td colspan="20" class="text-center py-4 text-red-500">Erro ao carregar matriz: ${err.message}</td></tr>`;
        }
    },

    renderizar: function (lista, tbody) {
        if (!tbody) return;
        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="20" class="text-center py-12 text-slate-400 italic">Nenhum dado encontrado para os filtros atuais.</td></tr>';
            return;
        }

        const format = (n) => n === 0 ? '-' : Math.round(n).toLocaleString('pt-BR');

        const calcVelocidade = (prod, fator, contrato) => {
            if (prod <= 0) return 0;
            const ehCLT = contrato.toUpperCase().includes('CLT');
            let divisor = fator;
            if (ehCLT && divisor > 0) divisor = Math.max(0, divisor - 1);
            divisor = divisor > 0 ? divisor : 1;
            return Math.round(prod / divisor);
        };

        const calcMacro = (velsArray) => {
            let soma = 0, count = 0;
            velsArray.forEach(v => {
                if (v > 0) { soma += v; count++; }
            });
            return count > 0 ? Math.round(soma / count) : 0;
        };

        lista.forEach(u => {
            const vels = u.months.map(m => calcVelocidade(m.prod, m.fator, u.contrato));
            
            const q1 = calcMacro([vels[0], vels[1], vels[2]]);
            const q2 = calcMacro([vels[3], vels[4], vels[5]]);
            const q3 = calcMacro([vels[6], vels[7], vels[8]]);
            const q4 = calcMacro([vels[9], vels[10], vels[11]]);
            const s1 = calcMacro([vels[0], vels[1], vels[2], vels[3], vels[4], vels[5]]);
            const s2 = calcMacro([vels[6], vels[7], vels[8], vels[9], vels[10], vels[11]]);
            const total = calcMacro(vels);

            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 transition odd:bg-white even:bg-slate-50/30 group border-b border-slate-100 last:border-0";

            // Classes de estilização
            const tdNome = "px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]";
            const tdMes = "px-3 py-3 text-center text-slate-600 border-r border-slate-100 text-xs";
            const tdQ = "px-3 py-3 text-center font-bold text-blue-700 bg-blue-50/30 border-r border-blue-100 text-xs";
            const tdS = "px-3 py-3 text-center font-bold text-indigo-700 bg-indigo-50/30 border-r border-indigo-100 text-xs";
            const tdTotal = "px-4 py-3 text-center font-black text-slate-800 bg-slate-100 text-xs";

            tr.innerHTML = `
                <td class="${tdNome}">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-700 text-xs truncate max-w-[180px]" title="${u.nome}">${u.nome}</span>
                        <span class="text-[9px] text-slate-400 uppercase tracking-tight">${u.cargo} • ${u.contrato}</span>
                    </div>
                </td>
                <td class="${tdMes}">${format(vels[0])}</td>
                <td class="${tdMes}">${format(vels[1])}</td>
                <td class="${tdMes}">${format(vels[2])}</td>
                <td class="${tdQ}">${format(q1)}</td>
                <td class="${tdMes}">${format(vels[3])}</td>
                <td class="${tdMes}">${format(vels[4])}</td>
                <td class="${tdMes}">${format(vels[5])}</td>
                <td class="${tdQ}">${format(q2)}</td>
                <td class="${tdS}">${format(s1)}</td>
                <td class="${tdMes}">${format(vels[6])}</td>
                <td class="${tdMes}">${format(vels[7])}</td>
                <td class="${tdMes}">${format(vels[8])}</td>
                <td class="${tdQ}">${format(q3)}</td>
                <td class="${tdMes}">${format(vels[9])}</td>
                <td class="${tdMes}">${format(vels[10])}</td>
                <td class="${tdMes}">${format(vels[11])}</td>
                <td class="${tdQ}">${format(q4)}</td>
                <td class="${tdS}">${format(s2)}</td>
                <td class="${tdTotal}">${format(total)}</td>
            `;
            tbody.appendChild(tr);
        });
    }
};