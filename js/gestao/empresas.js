window.Gestao = window.Gestao || {};

Gestao.Empresas = {
    state: {
        page: 1,
        pageSize: 1000, // Aumentado para mostrar mais empresas por vez
        total: 0,
        filtros: {
            nome: '',
            subdominio: '',
            obs: '',
            buscaGeral: ''
        },
        loading: false
    },

    init: function() {
        console.log("🚀 Gestão Empresas Carregada.");
        // Garante que o modal esteja no DOM antes de qualquer coisa
        this.injetarModal();
        this.carregar();
    },

    carregar: function() {
        this.buscarEmpresas();
    },

    atualizarFiltrosEBuscar: function() {
        // Busca geral do header - busca em nome, subdomínio e observação
        const buscaGeral = document.getElementById('header-search-empresas')?.value.trim() || '';
        
        // Limpa filtros anteriores
        this.state.filtros.nome = '';
        this.state.filtros.subdominio = '';
        this.state.filtros.obs = '';
        
        // Se há busca, aplica em todos os campos (busca inteligente)
        if (buscaGeral) {
            this.state.filtros.buscaGeral = buscaGeral;
        } else {
            this.state.filtros.buscaGeral = '';
        }

        this.state.page = 1;
        this.buscarEmpresas();
    },

    mudarPagina: function(delta) {
        const maxPages = Math.ceil(this.state.total / this.state.pageSize) || 1;
        const novaPagina = this.state.page + delta;

        if (novaPagina >= 1 && novaPagina <= maxPages) {
            this.state.page = novaPagina;
            this.buscarEmpresas();
        }
    },

    buscarEmpresas: async function() {
        if (this.state.loading) return;
        this.state.loading = true;
        this.renderLoading();

        try {
            // Monta condições WHERE dinamicamente
            const whereConditions = [];
            const params = [];

            // Busca geral busca em nome, subdomínio ou observação
            if (this.state.filtros.buscaGeral) {
                const busca = `%${this.state.filtros.buscaGeral}%`;
                whereConditions.push('(nome LIKE ? OR subdominio LIKE ? OR observacao LIKE ? OR id LIKE ?)');
                params.push(busca, busca, busca, busca);
            } else {
                // Filtros específicos (caso precise no futuro)
                if (this.state.filtros.nome) {
                    whereConditions.push('nome LIKE ?');
                    params.push(`%${this.state.filtros.nome}%`);
                }
                if (this.state.filtros.subdominio) {
                    whereConditions.push('subdominio LIKE ?');
                    params.push(`%${this.state.filtros.subdominio}%`);
                }
                if (this.state.filtros.obs) {
                    whereConditions.push('observacao LIKE ?');
                    params.push(`%${this.state.filtros.obs}%`);
                }
            }

            const whereClause = whereConditions.length > 0 
                ? 'WHERE ' + whereConditions.join(' AND ')
                : '';

            // Busca total de registros (para paginação)
            const sqlCount = `SELECT COUNT(*) as total FROM empresas ${whereClause}`;
            const countResult = await Sistema.query(sqlCount, params);
            
            if (countResult === null) {
                throw new Error("Tabela 'empresas' não encontrada. Execute o script criar_tabela_empresas.sql no TiDB.");
            }
            
            // Extrai o total do resultado (pode vir como objeto {total: X} ou array)
            const totalRow = Array.isArray(countResult) && countResult.length > 0 ? countResult[0] : null;
            this.state.total = totalRow ? (totalRow.total || totalRow['COUNT(*)'] || 0) : 0;

            // Busca dados paginados
            // Se não há filtros, busca todas as empresas (sem paginação)
            // Se há filtros, aplica paginação para melhor performance
            const temFiltros = whereConditions.length > 0;
            let sql = `
                SELECT *
                FROM empresas
                ${whereClause}
                ORDER BY nome ASC
            `;
            
            if (temFiltros) {
                // Com filtros, aplica paginação
                const offset = (this.state.page - 1) * this.state.pageSize;
                const limitValue = parseInt(this.state.pageSize) || 1000;
                const offsetValue = parseInt(offset) || 0;
                sql += ` LIMIT ${limitValue} OFFSET ${offsetValue}`;
            }
            // Sem filtros, busca todas sem LIMIT
            
            const data = await Sistema.query(sql, params);

            if (!data) throw new Error("Falha ao buscar empresas.");

            this.renderTabela(data || []);
            this.atualizarPaginacaoUI();

        } catch (error) {
            console.error(error);
            const tbody = document.getElementById('lista-empresas');
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Erro: ${error.message}</td></tr>`;
        } finally {
            this.state.loading = false;
        }
    },

    renderLoading: function() {
        const tbody = document.getElementById('lista-empresas');
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></td></tr>`;
    },

    renderTabela: function(lista) {
        const tbody = document.getElementById('lista-empresas');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (lista.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Nenhuma empresa encontrada.</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map(emp => {
            const dataF = emp.data_entrada ? emp.data_entrada.split('-').reverse().join('/') : '-';
            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-slate-600 transition">
                <td class="px-4 py-3 font-mono text-xs">${emp.id}</td>
                <td class="px-4 py-3 font-bold text-slate-700">${emp.nome}</td>
                <td class="px-4 py-3 text-blue-600 bg-blue-50 rounded-lg text-xs w-fit px-2 py-1 mx-4 block text-center">${emp.subdominio || '-'}</td>
                <td class="px-4 py-3 text-xs">${dataF}</td>
                <td class="px-4 py-3 text-xs truncate max-w-[200px]" title="${emp.observacao || ''}">${emp.observacao || '-'}</td>
                <td class="px-4 py-3 text-right">
                    <button onclick="Gestao.Empresas.abrirModal(${emp.id})" class="text-indigo-600 hover:bg-indigo-50 p-2 rounded transition">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="Gestao.Empresas.excluir(${emp.id})" class="text-rose-500 hover:bg-rose-50 p-2 rounded transition ml-1">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
    },

    atualizarPaginacaoUI: function() {
        const totalPaginas = Math.ceil(this.state.total / this.state.pageSize) || 1;
        const info = document.getElementById('info-paginacao-emp');
        if(info) info.innerText = `Pág ${this.state.page} de ${totalPaginas} (${this.state.total} registros)`;
        
        const btnAnt = document.getElementById('btn-ant-emp');
        const btnProx = document.getElementById('btn-prox-emp');
        if(btnAnt) btnAnt.disabled = this.state.page <= 1;
        if(btnProx) btnProx.disabled = this.state.page >= totalPaginas;
    },

    // --- CRUD ---

    abrirModal: async function(id = null) {
        // Garante que o modal existe
        if(!document.getElementById('modal-empresa')) {
            this.injetarModal();
        }
        
        const modal = document.getElementById('modal-empresa');
        const form = document.getElementById('form-empresa');
        
        form.reset();
        document.getElementById('emp-id').value = '';
        document.getElementById('emp-id-visual').value = '';
        document.getElementById('emp-id-visual').disabled = false;

        if (id) {
            try {
                const sql = `SELECT * FROM empresas WHERE id = ? LIMIT 1`;
                const rows = await Sistema.query(sql, [id]);
                
                if (!rows || rows.length === 0) {
                    throw new Error("Empresa não encontrada.");
                }
                
                const data = rows[0];
                document.getElementById('emp-id').value = data.id;
                document.getElementById('emp-id-visual').value = data.id;
                document.getElementById('emp-id-visual').disabled = true;
                document.getElementById('emp-nome').value = data.nome || '';
                document.getElementById('emp-sub').value = data.subdominio || '';
                document.getElementById('emp-data').value = data.data_entrada || '';
                document.getElementById('emp-obs').value = data.observacao || '';
                document.getElementById('modal-titulo-emp').innerText = 'Editar Empresa';
            } catch (e) {
                alert("Erro: " + e.message);
                return;
            }
        } else {
            document.getElementById('modal-titulo-emp').innerText = 'Nova Empresa';
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    fecharModal: function() {
        const modal = document.getElementById('modal-empresa');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    salvar: async function() {
        const idOculto = document.getElementById('emp-id').value;
        const idVisual = document.getElementById('emp-id-visual').value;
        const idFinal = idOculto ? parseInt(idOculto) : parseInt(idVisual);
        
        const nome = document.getElementById('emp-nome').value.trim();
        const sub = document.getElementById('emp-sub').value.trim().toLowerCase();
        const dataEntrada = document.getElementById('emp-data').value;
        const obs = document.getElementById('emp-obs').value.trim();

        if (!idFinal || !nome) {
            alert("ID e Nome são obrigatórios.");
            return;
        }

        const payload = {
            id: idFinal,
            nome: nome,
            subdominio: sub,
            data_entrada: dataEntrada || null,
            observacao: obs
        };

        const btn = document.getElementById('btn-salvar-emp');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btn.disabled = true;

        try {
            if (idOculto) {
                // Atualiza empresa existente
                const sqlUpdate = `
                    UPDATE empresas
                    SET 
                        nome         = ?,
                        subdominio   = ?,
                        data_entrada = ?,
                        observacao   = ?
                    WHERE id = ?
                `;
                const result = await Sistema.query(sqlUpdate, [
                    payload.nome,
                    payload.subdominio,
                    payload.data_entrada,
                    payload.observacao,
                    payload.id
                ]);
                if (result === null) throw new Error("Falha ao atualizar empresa.");
            } else {
                // Cria nova empresa
                const sqlInsert = `
                    INSERT INTO empresas (id, nome, subdominio, data_entrada, observacao)
                    VALUES (?, ?, ?, ?, ?)
                `;
                const result = await Sistema.query(sqlInsert, [
                    payload.id,
                    payload.nome,
                    payload.subdominio,
                    payload.data_entrada,
                    payload.observacao
                ]);
                if (result === null) throw new Error("Falha ao criar empresa.");
            }
            
            this.fecharModal();
            this.carregar();
        } catch (e) {
            alert("Erro ao salvar: " + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    excluir: async function(id) {
        if (!confirm(`Deseja excluir a empresa ID ${id}?`)) return;
        try {
            const sql = `DELETE FROM empresas WHERE id = ?`;
            const result = await Sistema.query(sql, [id]);
            if (result === null) throw new Error("Falha ao excluir empresa.");
            this.carregar();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    },

    injetarModal: function() {
        if (document.getElementById('modal-empresa')) return;
        const html = `
        <div id="modal-empresa" class="fixed inset-0 bg-slate-900 bg-opacity-50 hidden items-center justify-center z-50 backdrop-blur-sm">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-down">
                <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 id="modal-titulo-emp" class="text-lg font-bold text-slate-700">Nova Empresa</h3>
                    <button onclick="Gestao.Empresas.fecharModal()" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
                </div>
                <div class="p-6">
                    <form id="form-empresa" onsubmit="event.preventDefault(); Gestao.Empresas.salvar()">
                        <input type="hidden" id="emp-id">
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">ID Empresa *</label>
                            <input type="number" id="emp-id-visual" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" required>
                        </div>
                        <div class="mb-4">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Fantasia *</label>
                            <input type="text" id="emp-nome" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" required>
                        </div>
                        <div class="flex gap-4 mb-4">
                            <div class="w-1/2">
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Subdomínio</label>
                                <input type="text" id="emp-sub" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                            </div>
                            <div class="w-1/2">
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Data Entrada</label>
                                <input type="date" id="emp-data" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                            </div>
                        </div>
                        <div class="mb-6">
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                            <textarea id="emp-obs" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" rows="3"></textarea>
                        </div>
                        <div class="flex justify-end gap-3">
                            <button type="button" onclick="Gestao.Empresas.fecharModal()" class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded transition">Cancelar</button>
                            <button type="submit" id="btn-salvar-emp" class="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow transition">Salvar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
};

// Auto-inicialização segura
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if(window.Gestao && window.Gestao.Empresas) Gestao.Empresas.init();
}