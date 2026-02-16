window.Gestao = window.Gestao || {};

Gestao.Usuarios = {
    cacheData: null,

    init: function() {
        console.log("🚀 Gestão Usuários Carregada.");
        this.injetarModal();
        this.carregar();
    },

    carregar: async function() {
        const tbody = document.getElementById('lista-usuarios');
        if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8"><i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i></td></tr>`;

        try {
            const { data, error } = await Sistema.supabase
                .from('usuarios')
                .select('*')
                .order('nome');

            if (error) throw error;
            this.cacheData = data;
            this.filtrar(); 

        } catch (error) {
            console.error(error);
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-red-500">Erro: ${error.message}</td></tr>`;
        }
    },

    filtrar: async function() {
        const termo = document.getElementById('header-search-usuarios')?.value.toLowerCase() || '';
        const mostrarInativos = document.getElementById('toggle-inativos')?.checked || false;

        const tbody = document.getElementById('lista-usuarios');
        const contador = document.getElementById('contador-usuarios');
        
        if(!tbody) return;

        tbody.innerHTML = '';
        
        if (!this.cacheData) {
             await this.carregar();
             return; 
        }

        const filtrados = this.cacheData.filter(u => {
            const matchTexto = u.id.toString().includes(termo) || 
                               u.nome.toLowerCase().includes(termo) || 
                               (u.email && u.email.toLowerCase().includes(termo));
            
            const matchAtivo = mostrarInativos ? true : u.ativo;
            
            return matchTexto && matchAtivo;
        });

        if (filtrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400">Nenhum usuário encontrado.</td></tr>`;
            if(contador) contador.innerText = '0 registros';
            return;
        }

        tbody.innerHTML = filtrados.map(u => {
            const statusClass = u.ativo 
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                : 'bg-slate-100 text-slate-500 border-slate-200';
            const statusText = u.ativo ? 'ATIVO' : 'INATIVO'; // Texto igual ao da planilha
            
            // Tratamento visual da função
            let badgeFuncao = 'bg-slate-50 text-slate-600 border-slate-200';
            if ((u.funcao||'').toUpperCase().includes('AUDITORA')) badgeFuncao = 'bg-purple-50 text-purple-700 border-purple-100';
            if ((u.funcao||'').toUpperCase().includes('GESTORA')) badgeFuncao = 'bg-amber-50 text-amber-700 border-amber-100';

            return `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-slate-600 transition">
                <td class="px-4 py-3 font-mono text-xs text-slate-500">${u.id}</td>
                
                <td class="px-4 py-3 font-bold text-slate-700 flex flex-col">
                    <span>${u.nome}</span>
                    <span class="text-[10px] text-slate-400 font-normal">${u.email || ''}</span>
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

        if(contador) contador.innerText = `${filtrados.length} registros`;
    },
    
    // ... MANTER O RESTANTE DO CÓDIGO (injetarModal, abrirModal, editar, salvar, redefinirSenha) IGUAL AO ANTERIOR ...
    injetarModal: function() {
         if (document.getElementById('modal-usuario')) return;
         const html = `
        <div id="modal-usuario" class="fixed inset-0 bg-slate-900 bg-opacity-50 hidden items-center justify-center z-50 backdrop-blur-sm">
            <div class="bg-white rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-down">
                <div class="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 id="modal-titulo-user" class="text-lg font-bold text-slate-700">Novo Usuário</h3>
                    <button onclick="document.getElementById('modal-usuario').classList.add('hidden'); document.getElementById('modal-usuario').classList.remove('flex');" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
                </div>
                <div class="p-6">
                    <form id="form-usuario" onsubmit="event.preventDefault(); Gestao.Usuarios.salvar()">
                        <input type="hidden" id="user-id">
                        
                        <div class="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo *</label>
                                <input type="text" id="user-nome" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" required>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                                <input type="email" id="user-email" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Função</label>
                                <select id="user-funcao" class="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:border-blue-500 outline-none">
                                    <option value="Assistente">Assistente</option>
                                    <option value="Auditora">Auditora</option>
                                    <option value="Gestora">Gestora</option>
                                    <option value="Admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Contrato</label>
                                <select id="user-contrato" class="w-full border border-slate-300 rounded px-3 py-2 text-sm bg-white focus:border-blue-500 outline-none">
                                    <option value="CLT">CLT</option>
                                    <option value="PJ">PJ</option>
                                    <option value="Temporário">Temporário</option>
                                </select>
                            </div>
                            <div class="flex items-end pb-2">
                                <label class="flex items-center cursor-pointer">
                                    <input type="checkbox" id="user-ativo" class="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500">
                                    <span class="ml-2 text-sm font-bold text-slate-600">Usuário Ativo</span>
                                </label>
                            </div>
                        </div>

                         <div class="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jornada (Horas)</label>
                                <input type="number" id="user-jornada" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none" placeholder="Ex: 8">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Supervisor</label>
                                <input type="text" id="user-supervisor" class="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 outline-none">
                            </div>
                        </div>

                        <div class="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button type="button" onclick="Gestao.Usuarios.redefinirSenha()" class="px-4 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 border border-amber-200 rounded transition flex items-center gap-2">
                                <i class="fas fa-key"></i> Redefinir Senha
                            </button>

                            <div class="flex gap-3">
                                <button type="button" onclick="document.getElementById('modal-usuario').classList.add('hidden'); document.getElementById('modal-usuario').classList.remove('flex');" class="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded transition">Cancelar</button>
                                <button type="submit" id="btn-salvar-user" class="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow transition">Salvar</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    
    abrirModal: function() {
        if(!document.getElementById('modal-usuario')) this.injetarModal();
        const modal = document.getElementById('modal-usuario');
        const form = document.getElementById('form-usuario');
        form.reset();
        document.getElementById('user-id').value = '';
        document.getElementById('user-ativo').checked = true;
        document.getElementById('modal-titulo-user').innerText = 'Novo Usuário';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    },

    editar: async function(id) {
        this.abrirModal();
        document.getElementById('modal-titulo-user').innerText = 'Editar Usuário';
        const user = this.cacheData.find(u => u.id === id);
        if(user) {
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-nome').value = user.nome;
            document.getElementById('user-email').value = user.email || '';
            document.getElementById('user-funcao').value = user.funcao || 'Assistente';
            document.getElementById('user-contrato').value = user.modelo_contrato || 'CLT';
            document.getElementById('user-jornada').value = user.jornada_diaria || '';
            document.getElementById('user-supervisor').value = user.supervisor || '';
            document.getElementById('user-ativo').checked = user.ativo;
        }
    },

    redefinirSenha: async function() {
        const id = document.getElementById('user-id').value;
        if (!id) {
            alert("Selecione um usuário já salvo para redefinir a senha.");
            return;
        }
        
        if (!confirm("Tem certeza que deseja redefinir a senha deste usuário para 'gupy123'?")) return;

        try {
            const btn = event.currentTarget;
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
            btn.disabled = true;

            const hash = await Sistema.gerarHash("gupy123");
            const { error } = await Sistema.supabase
                .from('usuarios')
                .update({ senha: hash })
                .eq('id', id);

            if (error) throw error;
            alert("Senha redefinida com sucesso para 'gupy123'!");
            
            btn.innerHTML = originalText;
            btn.disabled = false;

        } catch (e) {
            alert("Erro ao redefinir senha: " + e.message);
            const btn = event.target.closest('button'); // Fallback caso event.currentTarget se perca
            if(btn) {
                btn.innerHTML = '<i class="fas fa-key"></i> Redefinir Senha';
                btn.disabled = false;
            }
        }
    },

    salvar: async function() {
        const id = document.getElementById('user-id').value;
        const nome = document.getElementById('user-nome').value;
        
        const payload = {
            nome: nome,
            email: document.getElementById('user-email').value,
            funcao: document.getElementById('user-funcao').value,
            modelo_contrato: document.getElementById('user-contrato').value,
            ativo: document.getElementById('user-ativo').checked,
            jornada_diaria: document.getElementById('user-jornada').value || null,
            supervisor: document.getElementById('user-supervisor').value
        };
        
        if(id) payload.id = id;
        
        const { error } = await Sistema.supabase.from('usuarios').upsert(payload);
        if(!error) {
            document.getElementById('modal-usuario').classList.add('hidden');
            document.getElementById('modal-usuario').classList.remove('flex');
            this.carregar();
        } else {
            alert(error.message);
        }
    }
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if(window.Gestao && window.Gestao.Usuarios) Gestao.Usuarios.init();
}