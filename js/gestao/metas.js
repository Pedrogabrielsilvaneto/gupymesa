/* ARQUIVO: js/gestao/metas.js */
Gestao.Metas = {
    state: {
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        listaCompleta: [], 
        listaVisivel: [],  
        mostrarInativos: false,
        mostrarGestao: false,
        alteracoesPendentes: new Set()
    },

    init: function() {
        this.atualizarLabelPeriodo();
        this.carregar();
    },

    mudarMes: function(delta) {
        let novoMes = this.state.mes + delta;
        if (novoMes > 12) { novoMes = 1; this.state.ano++; } 
        else if (novoMes < 1) { novoMes = 12; this.state.ano--; }
        
        this.state.mes = novoMes;
        this.state.alteracoesPendentes.clear();
        this.atualizarLabelPeriodo();
        this.carregar();
    },

    toggleFiltros: function() {
        const elInativos = document.getElementById('check-mostrar-inativos');
        const elGestao = document.getElementById('check-mostrar-gestao');
        
        this.state.mostrarInativos = elInativos ? elInativos.checked : false;
        this.state.mostrarGestao = elGestao ? elGestao.checked : false;
        
        this.filtrarERenderizar();
    },

    atualizarLabelPeriodo: function() {
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const el = document.getElementById('header-meta-periodo');
        if (el) el.innerText = `${meses[this.state.mes - 1]} ${this.state.ano}`;
    },

    carregar: async function() {
        const tbody = document.getElementById('lista-metas');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12"><i class="fas fa-circle-notch fa-spin text-blue-500 text-2xl"></i><p class="text-xs text-slate-400 mt-2">Sincronizando metas...</p></td></tr>';

        try {
            // Busca usuários via TiDB
            const sqlUsers = `
                SELECT 
                    id, 
                    nome, 
                    contrato,
                    situacao,
                    funcao,
                    nivel_acesso
                FROM usuarios
                ORDER BY nome
            `;
            const usersRows = await Sistema.query(sqlUsers);
            if (!usersRows) throw new Error("Falha ao carregar usuários.");

            // Busca metas do período atual via TiDB
            const sqlMetas = `
                SELECT *
                FROM metas
                WHERE mes = ? AND ano = ?
            `;
            const metasRows = await Sistema.query(sqlMetas, [this.state.mes, this.state.ano]);
            if (metasRows === null) throw new Error("Falha ao carregar metas.");

            // Normaliza usuários e combina com metas
            this.state.listaCompleta = usersRows.map(u => {
                const m = metasRows.find(x => x.usuario_id === u.id || x.usuario_id === String(u.id));
                
                // Normaliza campos
                const ativo = (u.situacao || '').toUpperCase() === 'ATIVO';
                const perfil = (u.perfil || '').toUpperCase();
                const funcao = (u.funcao || '').toUpperCase();
                
                // Lógica Aprimorada de Identificação de Gestão
                // Inclui: Gestora, Auditora, Admin, Super Admin e IDs 1/1000
                const isGestao = perfil.includes('GESTOR') || perfil.includes('AUDITOR') || perfil.includes('ADMIN') ||
                                 funcao.includes('GESTOR') || funcao.includes('AUDITOR') || funcao.includes('ADMIN') ||
                                 u.nome === 'Super Admin' || u.nome === 'Super Admin Gupy' || 
                                 String(u.id) === '1' || String(u.id) === '1000' ||
                                 (u.nivel_acesso && parseInt(u.nivel_acesso) >= 2);
                
                return {
                    id: u.id,
                    nome: u.nome,
                    contrato: u.contrato || '',
                    ativo: ativo,
                    perfil: perfil,
                    funcao: funcao,
                    isGestao: !!isGestao,
                    meta_prod: m ? (m.meta_producao || m.meta_prod || null) : null, 
                    meta_assert: m ? (m.meta_assertividade || m.meta_assert || null) : null,
                    id_meta: m ? m.id : null
                };
            });

            this.filtrarERenderizar();

        } catch (e) {
            console.error(e);
            if(tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-rose-500 py-4">Erro: ${e.message}</td></tr>`;
        }
    },

    filtrarERenderizar: function() {
        this.state.listaVisivel = this.state.listaCompleta.filter(u => {
            // Filtro Inativos
            if (!this.state.mostrarInativos && !u.ativo) return false;
            
            // Filtro Gestão (Default: Esconder)
            if (!this.state.mostrarGestao && u.isGestao) return false;

            return true;
        });
        
        // Ordenação: Gestão > Ativos > Inativos > Nome
        this.state.listaVisivel.sort((a,b) => {
            if (a.isGestao !== b.isGestao) return a.isGestao ? 1 : -1; 
            if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
            return a.nome.localeCompare(b.nome);
        });

        this.renderizar();
    },

    renderizar: function() {
        const tbody = document.getElementById('lista-metas');
        const footer = document.getElementById('resumo-metas-footer');
        if (!tbody) return;

        if (this.state.listaVisivel.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-400 italic">Nenhum registro encontrado.</td></tr>';
            if(footer) footer.innerText = '0 registros';
            return;
        }

        tbody.innerHTML = this.state.listaVisivel.map(u => {
            const isInactive = !u.ativo;
            let rowClass = 'hover:bg-slate-50';
            if (isInactive) rowClass = 'bg-slate-50 opacity-60';
            if (u.isGestao) rowClass = 'bg-purple-50/30 hover:bg-purple-50'; 

            return `
            <tr class="border-b border-slate-100 transition group ${rowClass}" id="row-${u.id}">
                <td class="px-6 py-3 text-center text-slate-400 text-xs">
                    <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center mx-auto text-slate-500 font-bold border border-slate-200 shadow-sm">
                        ${u.nome.charAt(0)}
                    </div>
                </td>
                <td class="px-6 py-3">
                    <div class="flex flex-col">
                        <span class="font-bold text-slate-700 text-sm flex items-center gap-2">
                            ${u.nome}
                            ${u.isGestao ? '<span class="text-[9px] bg-purple-100 text-purple-700 px-1.5 rounded uppercase font-bold tracking-wider">Gestão</span>' : ''}
                        </span>
                        <span class="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                            ${u.contrato || 'ND'} 
                            ${isInactive ? '<span class="text-rose-500 font-bold bg-rose-50 px-1 rounded">INATIVO</span>' : ''}
                        </span>
                    </div>
                </td>
                
                <td class="px-4 py-3 bg-blue-50/20 border-x border-slate-100/50">
                    <div class="relative group/in">
                        <input type="number" id="prod-${u.id}" 
                            value="${u.meta_prod !== null ? u.meta_prod : ''}" 
                            placeholder="0"
                            onchange="Gestao.Metas.marcarAlterado(${u.id})"
                            class="w-full text-center font-bold text-slate-700 bg-transparent border-b-2 border-transparent hover:border-blue-200 focus:border-blue-500 focus:bg-white outline-none py-1 transition text-sm">
                    </div>
                </td>

                <td class="px-4 py-3 bg-emerald-50/20 border-r border-slate-100/50">
                    <div class="relative group/in">
                        <input type="number" step="0.01" id="assert-${u.id}" 
                            value="${u.meta_assert !== null ? u.meta_assert : ''}" 
                            placeholder="0.00"
                            onchange="Gestao.Metas.marcarAlterado(${u.id})"
                            class="w-full text-center font-bold text-slate-700 bg-transparent border-b-2 border-transparent hover:border-emerald-200 focus:border-emerald-500 focus:bg-white outline-none py-1 transition text-sm">
                    </div>
                </td>

                <td class="px-6 py-3 text-right">
                    <span id="status-${u.id}" class="text-[10px] font-bold text-slate-300">
                        ${u.id_meta ? '<i class="fas fa-check text-slate-300"></i> Salvo' : '-'}
                    </span>
                </td>
            </tr>`;
        }).join('');

        if(footer) footer.innerText = `${this.state.listaVisivel.length} registros listados`;
    },

    marcarAlterado: function(uid) {
        this.state.alteracoesPendentes.add(uid);
        const status = document.getElementById(`status-${uid}`);
        if(status) status.innerHTML = '<i class="fas fa-pen text-blue-500 animate-pulse"></i> <span class="text-blue-600">Editado</span>';
        
        const row = document.getElementById(`row-${uid}`);
        if(row) row.classList.add('bg-blue-50/30');
    },

    aplicarPadrao: function() {
        const valProd = document.getElementById('padrao-prod-input')?.value || 650;
        const valAssert = document.getElementById('padrao-assert-input')?.value || 97;

        // Filtra para não aplicar em Gestão
        const alvos = this.state.listaVisivel.filter(u => !u.isGestao);

        if (!confirm(`Aplicar Produção=${valProd} e Assertividade=${valAssert}% para ${alvos.length} assistentes? (Gestão/Admin ignorados)`)) return;

        alvos.forEach(u => {
            const elProd = document.getElementById(`prod-${u.id}`);
            const elAssert = document.getElementById(`assert-${u.id}`);
            
            if (elProd) { elProd.value = valProd; this.marcarAlterado(u.id); }
            if (elAssert) { elAssert.value = valAssert; this.marcarAlterado(u.id); }
        });
    },

    salvarTodas: async function() {
        if (this.state.alteracoesPendentes.size === 0) {
            alert("Nenhuma alteração detectada para salvar.");
            return;
        }

        const btn = document.querySelector('#actions-metas button[onclick="Gestao.Metas.salvarTodas()"]');
        if(btn) {
            var originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Salvando...';
            btn.disabled = true;
        }

        const upserts = [];
        
        this.state.alteracoesPendentes.forEach(uid => {
            const u = this.state.listaCompleta.find(x => x.id === uid);
            const valProd = document.getElementById(`prod-${uid}`)?.value;
            const valAssert = document.getElementById(`assert-${uid}`)?.value;

            if (u && valProd && valAssert) {
                upserts.push({
                    usuario_id: uid,
                    usuario_nome: u.nome,
                    mes: this.state.mes,
                    ano: this.state.ano,
                    meta_producao: parseInt(valProd),
                    meta_assertividade: parseFloat(valAssert.replace(',', '.'))
                });
            }
        });

        try {
            if (upserts.length === 0) {
                alert("Nenhuma alteração válida para salvar.");
                return;
            }

            // Monta SQL de upsert para TiDB (INSERT ... ON DUPLICATE KEY UPDATE)
            const sql = `
                INSERT INTO metas (
                    usuario_id, mes, ano, meta_producao, meta_assertividade
                ) VALUES
                ${upserts.map(() => '(?, ?, ?, ?, ?)').join(', ')}
                ON DUPLICATE KEY UPDATE
                    meta_producao = VALUES(meta_producao),
                    meta_assertividade = VALUES(meta_assertividade)
            `;

            const params = [];
            for (const m of upserts) {
                params.push(
                    String(m.usuario_id),
                    this.state.mes,
                    this.state.ano,
                    m.meta_producao,
                    m.meta_assertividade
                );
            }

            const result = await Sistema.query(sql, params);
            if (result === null) throw new Error("Falha ao salvar metas.");

            this.state.alteracoesPendentes.clear();
            await this.carregar();
            alert("✅ Metas atualizadas com sucesso!");

        } catch (e) {
            console.error(e);
            alert("Erro ao salvar: " + e.message);
        } finally {
            if(btn) {
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        }
    }
};