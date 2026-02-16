window.Gestao = window.Gestao || {};

Gestao.Usuarios = {
    cacheData: null,

    init: function () {
        console.log("🚀 Gestão Usuários Carregada.");
        this.injetarModal();
        this.carregar();
    },

    carregar: async function () {
        const tbody = document.getElementById('lista-usuarios');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></td></tr>`;

        try {
            // Consulta direta no TiDB via API (/api/banco)
            const sql = `
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

            const rows = await Sistema.query(sql);
            if (!rows) throw new Error("Falha ao carregar usuários.");

            // Normaliza os campos para o formato esperado pela tela
            this.cacheData = rows.map(u => ({
                ...u,
                email: u.email || '', // pode não existir na tabela ainda
                modelo_contrato: u.contrato || '',
                ativo: (u.situacao || '').toUpperCase() === 'ATIVO',
                jornada_diaria: u.jornada_diaria || null,
                supervisor: u.supervisor || ''
            }));
            this.popularFiltros();
            this.filtrar();

        } catch (error) {
            console.error(error);
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Erro: ${error.message}</td></tr>`;
        }
    },

    popularFiltros: function () {
        if (!this.cacheData || this.cacheData.length === 0) return;

        // Extrai valores únicos dos dados reais
        const contratos = new Set();
        const situacoes = new Set();
        const funcoes = new Set();

        this.cacheData.forEach(u => {
            const contrato = (u.modelo_contrato || u.contrato || '').trim().toUpperCase();
            const situacao = (u.situacao || (u.ativo ? 'ATIVO' : 'INATIVO')).trim().toUpperCase();
            const funcao = (u.funcao || '').trim().toUpperCase();

            if (contrato) {
                // Normaliza PJ para Terceiros
                if (contrato === 'PJ' || contrato.includes('PJ')) {
                    contratos.add('TERCEIROS');
                } else if (contrato === 'CLT' || contrato.includes('CLT')) {
                    contratos.add('CLT');
                }
            }
            if (situacao) situacoes.add(situacao);
            if (funcao) funcoes.add(funcao);
        });

        // Popula seletor de Contrato
        const selectContrato = document.getElementById('filtro-contrato-usuarios');
        if (selectContrato) {
            const valorAtual = selectContrato.value;
            selectContrato.innerHTML = '<option value="">Contrato: Todos</option>';

            const opcoesContrato = Array.from(contratos).sort();
            opcoesContrato.forEach(c => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c === 'TERCEIROS' ? 'Terceiros' : c;
                selectContrato.appendChild(option);
            });

            // Restaura seleção anterior se ainda existir
            if (valorAtual && opcoesContrato.includes(valorAtual)) {
                selectContrato.value = valorAtual;
            }
        }

        // Popula seletor de Situação
        const selectSituacao = document.getElementById('filtro-situacao-usuarios');
        if (selectSituacao) {
            const valorAtual = selectSituacao.value;
            selectSituacao.innerHTML = '<option value="">Status: Todos</option>';

            const opcoesSituacao = Array.from(situacoes).sort();
            opcoesSituacao.forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s === 'ATIVO' ? 'Ativos' : s === 'INATIVO' ? 'Inativos' : s;
                selectSituacao.appendChild(option);
            });

            // Restaura seleção anterior se ainda existir
            if (valorAtual && opcoesSituacao.includes(valorAtual)) {
                selectSituacao.value = valorAtual;
            }
        }

        // Popula seletor de Função
        const selectFuncao = document.getElementById('filtro-funcao-usuarios');
        if (selectFuncao) {
            const valorAtual = selectFuncao.value;
            selectFuncao.innerHTML = '<option value="">Função: Todas</option>';

            const opcoesFuncao = Array.from(funcoes).sort();
            opcoesFuncao.forEach(f => {
                const option = document.createElement('option');
                option.value = f;
                // Formatação amigável
                const texto = f === 'ASSISTENTE' ? 'Assistente' :
                    f === 'AUDITORA' ? 'Auditora' :
                        f === 'GESTORA' ? 'Gestora' :
                            f === 'ADMIN' ? 'Admin' : f;
                option.textContent = texto;
                selectFuncao.appendChild(option);
            });

            // Restaura seleção anterior se ainda existir
            if (valorAtual && opcoesFuncao.includes(valorAtual)) {
                selectFuncao.value = valorAtual;
            }
        }
    },

    filtrar: async function () {
        const termo = document.getElementById('header-search-usuarios')?.value.toLowerCase() || '';
        const contratoFiltro = (document.getElementById('filtro-contrato-usuarios')?.value || '').toUpperCase();
        const situacaoFiltro = (document.getElementById('filtro-situacao-usuarios')?.value || '').toUpperCase();
        const funcaoFiltro = (document.getElementById('filtro-funcao-usuarios')?.value || '').toUpperCase();

        const tbody = document.getElementById('lista-usuarios');
        const contador = document.getElementById('contador-usuarios');

        if (!tbody) return;

        tbody.innerHTML = '';

        if (!this.cacheData) {
            await this.carregar();
            return;
        }

        const filtrados = this.cacheData.filter(u => {
            let contrato = (u.modelo_contrato || u.contrato || '').toUpperCase().trim();
            // Normaliza PJ para TERCEIROS para comparação
            if (contrato === 'PJ' || contrato.includes('PJ')) {
                contrato = 'TERCEIROS';
            }
            const situacao = (u.situacao || (u.ativo ? 'ATIVO' : 'INATIVO')).toUpperCase().trim();
            const funcao = (u.funcao || '').toUpperCase().trim();

            const matchTexto = u.id.toString().includes(termo) ||
                u.nome.toLowerCase().includes(termo) ||
                (u.email && u.email.toLowerCase().includes(termo));

            const matchContrato = contratoFiltro ? contrato === contratoFiltro : true;
            const matchSituacao = situacaoFiltro ? situacao === situacaoFiltro : true;
            const matchFuncao = funcaoFiltro ? funcao === funcaoFiltro : true;

            return matchTexto && matchContrato && matchSituacao && matchFuncao;
        });

        if (filtrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Nenhum usuário encontrado.</td></tr>`;
            if (contador) contador.innerText = '0 registros';
            return;
        }

        tbody.innerHTML = filtrados.map(u => {
            const statusClass = u.ativo
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200';
            const statusText = u.ativo ? 'ATIVO' : 'INATIVO'; // Texto igual ao da planilha

            // Tratamento visual da função
            let badgeFuncao = 'bg-slate-50 text-slate-600 border-slate-200';
            if ((u.funcao || '').toUpperCase().includes('AUDITORA')) badgeFuncao = 'bg-purple-50 text-purple-700 border-purple-100';
            if ((u.funcao || '').toUpperCase().includes('GESTORA')) badgeFuncao = 'bg-amber-50 text-amber-700 border-amber-100';

            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-slate-600 transition">
                <td class="px-4 py-3 font-mono text-xs text-slate-500">${u.id}</td>
                
                <td class="px-4 py-3 font-bold text-slate-700">
                    ${u.nome}
                </td>

                <td class="px-4 py-3 text-xs font-semibold text-slate-500">${u.modelo_contrato || '-'}</td>

                <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${statusClass}">${statusText}</span>
                </td>

                <td class="px-4 py-3 text-xs">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeFuncao}">${u.funcao || 'Assistente'}</span>
                </td>
                
                <td class="px-4 py-3 text-right">
                    <button onclick="Gestao.Usuarios.editar(${u.id})" class="text-indigo-600 hover:bg-indigo-50 p-2 rounded transition" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        if (contador) contador.innerText = `${filtrados.length} registros`;
    },

    // ... MANTER O RESTANTE DO CÓDIGO (injetarModal, abrirModal, editar, salvar, redefinirSenha) IGUAL AO ANTERIOR ...
    injetarModal: function () {
        if (document.getElementById('modal-usuario')) return;
        const html = `
        <div id="modal-usuario" class="fixed inset-0 bg-slate-900/60 hidden items-center justify-center z-50 backdrop-blur-sm p-4">
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-down border border-slate-200">
                <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 id="modal-titulo-user" class="text-sm font-bold text-slate-700 uppercase tracking-wider">Novo Usuário</h3>
                    <button onclick="document.getElementById('modal-usuario').classList.add('hidden');" class="text-slate-400 hover:text-slate-600 transition">
                        <i class="fas fa-times text-lg"></i>
                    </button>
                </div>
                <div class="p-6">
                    <form id="form-usuario" onsubmit="event.preventDefault(); Gestao.Usuarios.salvar()">
                        
                        <div class="space-y-4">
                            <!-- ID e Nome -->
                            <div class="grid grid-cols-12 gap-4">
                                <div class="col-span-4">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">ID Assistente *</label>
                                    <input type="text" id="user-id-input" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition bg-slate-50" required placeholder="Ex: 123456">
                                </div>
                                <div class="col-span-8">
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Nome Completo *</label>
                                    <input type="text" id="user-nome" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" required placeholder="Nome do assistente">
                                </div>
                            </div>

                            <!-- Contrato e Função -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Modelo de Contrato</label>
                                    <select id="user-contrato" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition appearance-none cursor-pointer">
                                        <option value="CLT">CLT</option>
                                        <option value="TERCEIROS">Terceiros</option>
                                        <option value="PJ">PJ</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-tighter">Função</label>
                                    <select id="user-funcao" class="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-600 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition appearance-none cursor-pointer">
                                        <option value="ASSISTENTE">Assistente</option>
                                        <option value="AUDITORA">Auditora</option>
                                        <option value="GESTORA">Gestora</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Situação (Ativo/Inativo) -->
                            <div class="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" id="user-ativo" class="sr-only peer" checked>
                                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                    <span class="ml-3 text-xs font-bold text-slate-600 uppercase tracking-wider">Usuário Ativo</span>
                                </label>
                            </div>
                        </div>

                        <div class="flex justify-between items-center pt-6 mt-6 border-t border-slate-100">
                             <button type="button" onclick="Gestao.Usuarios.redefinirSenha()" class="px-3 py-1.5 text-[10px] font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 rounded-lg transition-all flex items-center gap-2">
                                <i class="fas fa-key text-[9px]"></i> Redefinir Senha
                            </button>

                            <div class="flex gap-2">
                                <button type="button" onclick="document.getElementById('modal-usuario').classList.add('hidden');" class="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition">Cancelar</button>
                                <button type="submit" id="btn-salvar-user" class="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md hover:shadow-lg transition active:scale-95">Salvar Cadastro</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    abrirModal: function () {
        if (!document.getElementById('modal-usuario')) this.injetarModal();
        const modal = document.getElementById('modal-usuario');
        const form = document.getElementById('form-usuario');
        const inputId = document.getElementById('user-id-input');

        form.reset();

        inputId.readOnly = false;
        inputId.classList.remove('bg-slate-100');
        inputId.classList.add('bg-slate-50');

        document.getElementById('user-ativo').checked = true;
        document.getElementById('modal-titulo-user').innerText = 'Novo Usuário';

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    editar: async function (id) {
        if (!document.getElementById('modal-usuario')) this.injetarModal();

        this.abrirModal();
        document.getElementById('modal-titulo-user').innerText = 'Editar Usuário';

        const user = this.cacheData.find(u => String(u.id) === String(id));

        if (user) {
            const inputId = document.getElementById('user-id-input');
            inputId.value = user.id;
            inputId.readOnly = true; // Não permite mudar ID de quem já existe
            inputId.classList.remove('bg-slate-50');
            inputId.classList.add('bg-slate-100');

            document.getElementById('user-nome').value = user.nome || '';
            document.getElementById('user-funcao').value = (user.funcao || 'ASSISTENTE').toUpperCase();

            // Corrige exibição do contrato PJ/Terceiros
            let contrato = (user.modelo_contrato || user.contrato || 'CLT').toUpperCase();
            if (contrato === 'PJ') contrato = 'TERCEIROS'; // Normaliza para o valor do select
            document.getElementById('user-contrato').value = contrato;

            document.getElementById('user-ativo').checked = user.ativo;
        } else {
            alert("Erro: Dados do usuário não encontrados no cache.");
            document.getElementById('modal-usuario').classList.add('hidden');
        }
    },

    redefinirSenha: async function () {
        const id = document.getElementById('user-id-input').value;
        if (!id) {
            alert("Selecione um usuário para redefinir a senha.");
            return;
        }

        if (!confirm("Tem certeza que deseja redefinir a senha deste usuário para 'gupy123'?")) return;

        try {
            const btn = event.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aguarde...';
            btn.disabled = true;

            const hash = await Sistema.gerarHash("gupy123");

            const sql = `UPDATE usuarios SET senha = ? WHERE id = ?`;
            const result = await Sistema.query(sql, [hash, id]);

            if (result === null) throw new Error("Falha na atualização de senha.");

            alert("✅ Senha redefinida com sucesso para 'gupy123'!");

            btn.innerHTML = originalHtml;
            btn.disabled = false;

        } catch (e) {
            alert("Erro: " + e.message);
            const btn = event.currentTarget;
            if (btn) {
                btn.innerHTML = '<i class="fas fa-key text-[9px]"></i> Redefinir Senha';
                btn.disabled = false;
            }
        }
    },

    salvar: async function () {
        const idInput = document.getElementById('user-id-input');
        const id = idInput.value.trim();
        const nome = document.getElementById('user-nome').value.trim();
        const contrato = document.getElementById('user-contrato').value;
        const funcao = document.getElementById('user-funcao').value;
        const situacao = document.getElementById('user-ativo').checked ? 'ATIVO' : 'INATIVO';

        if (!id || !nome) {
            alert("ID e Nome são obrigatórios.");
            return;
        }

        const btn = document.getElementById('btn-salvar-user');
        const originalText = btn.innerText;
        btn.innerText = 'Salvando...';
        btn.disabled = true;

        try {
            const isEdit = idInput.readOnly; // Se o ID é readonly, é edição

            if (isEdit) {
                // UPDATE
                const sql = `
                    UPDATE usuarios
                    SET nome = ?, contrato = ?, situacao = ?, funcao = ?
                    WHERE id = ?
                `;
                const res = await Sistema.query(sql, [nome, contrato, situacao, funcao, id]);
                if (res === null) throw new Error("Falha ao atualizar.");
            } else {
                // INSERT
                // Verifica se ID já existe antes de inserir para evitar duplicidade silenciosa
                const check = await Sistema.query("SELECT id FROM usuarios WHERE id = ?", [id]);
                if (check && check.length > 0) {
                    throw new Error("Este ID já está cadastrado para outro usuário.");
                }

                const senhaHash = await Sistema.gerarHash("gupy123");
                const sql = `
                    INSERT INTO usuarios (id, nome, contrato, situacao, funcao, senha, nivel_acesso)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `;
                const res = await Sistema.query(sql, [id, nome, contrato, situacao, funcao, senhaHash]);
                if (res === null) throw new Error("Falha ao criar novo usuário.");
            }

            // Sucesso
            document.getElementById('modal-usuario').classList.add('hidden');
            await this.carregar();
            alert("✅ Cadastro salvo com sucesso!");

        } catch (e) {
            console.error(e);
            alert("❌ Erro: " + e.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (window.Gestao && window.Gestao.Usuarios) Gestao.Usuarios.init();
}