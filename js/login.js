/* ARQUIVO: js/login.js
   DESCRIÇÃO: Módulo de Autenticação (Com Hashing Client-Side)
*/

const Login = {
    init: function() {
        // Verifica se o Sistema foi carregado corretamente
        if (typeof Sistema === 'undefined') {
            console.error("Sistema não carregado. Verifique a ordem dos scripts no index.html.");
            return;
        }
        
        // Se já estiver logado, redireciona
        const sessao = Sistema.lerSessao();
        if (sessao) {
            this.redirecionar(sessao);
        }
    },

    entrar: async function() {
        const idInput = document.getElementById('login-id');
        const senhaInput = document.getElementById('login-senha');
        const btn = document.querySelector('button');
        const msgErro = document.getElementById('msg-erro');

        const id = idInput.value.trim();
        const senha = senhaInput.value.trim();

        // Validação básica de input
        if (!id || !senha) {
            this.mostrarErro('Preencha todos os campos.');
            return;
        }

        // Validação de tipo de ID
        const idNum = parseInt(id);
        if (isNaN(idNum)) {
            this.mostrarErro('O ID deve ser numérico.');
            return;
        }

        // Feedback Visual (Loading)
        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        btn.disabled = true;
        if (msgErro) msgErro.classList.add('hidden');

        try {
            // 1. Gera o hash da senha (SHA-256)
            const senhaHash = await Sistema.gerarHash(senha);

            // 2. Consulta direta no TiDB via API (/api/banco)
            // Usamos SELECT * para não depender de nomes de colunas específicos
            const sql = `
                SELECT *
                FROM usuarios
                WHERE id = ? AND senha = ?
                LIMIT 1
            `;

            const rows = await Sistema.query(sql, [idNum, senhaHash]);

            // Falha na comunicação com a API
            if (!rows) {
                this.mostrarErro('Erro ao conectar ao servidor. Tente novamente em instantes.');
                return;
            }

            // Nenhum usuário encontrado com este ID/senha
            if (!Array.isArray(rows) || rows.length === 0) {
                this.mostrarErro('Usuário ou senha inválidos.');
                return;
            }

            const usuario = rows[0];

            // Usuário inativo
            if (usuario.ativo === false || usuario.ativo === 0 || usuario.ativo === '0') {
                this.mostrarErro('Acesso negado. Usuário inativo.');
                return;
            }

            // --- SUCESSO ---
            Sistema.salvarSessao(usuario);

            // 3. Verificação de Troca de Senha Obrigatória
            const precisaTrocar = usuario.trocar_senha === true || usuario.trocar_senha === 1 || usuario.trocar_senha === '1' || senha === 'gupy123';
            
            if (precisaTrocar) {
                this.exibirTrocaSenha(usuario);
            } else {
                // 4. Redirecionamento baseado no perfil
                this.redirecionar(usuario);
            }

        } catch (error) {
            console.error("Erro Login:", error);
            this.mostrarErro('Erro ao conectar: ' + (error.message || 'Erro desconhecido'));
        } finally {
            if (btn) {
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
            }
        }
    },

    exibirTrocaSenha: function(usuario) {
        // Remove modal anterior se existir
        const antigo = document.getElementById('modal-troca-senha');
        if (antigo) antigo.remove();

        const modalHtml = `
            <div id="modal-troca-senha" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-300">
                    <div class="bg-indigo-600 p-6 text-white">
                        <h3 class="text-xl font-bold flex items-center gap-2">
                            <i class="fas fa-shield-alt"></i> Segurança Necessária
                        </h3>
                        <p class="text-indigo-100 text-sm mt-1">Por favor, altere sua senha padrão para continuar.</p>
                    </div>
                    <div class="p-8 space-y-5">
                        <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded r-lg">
                            <div class="flex gap-3">
                                <i class="fas fa-info-circle text-amber-500 mt-0.5"></i>
                                <p class="text-xs text-amber-800 leading-relaxed">
                                    A senha <strong>gupy123</strong> é temporária. Sua nova senha deve ter pelo menos 6 caracteres.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Nova Senha</label>
                            <div class="relative group">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i class="fas fa-key text-slate-400 group-focus-within:text-indigo-500 transition"></i>
                                </div>
                                <input type="password" id="nova-senha" class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700" placeholder="Digite sua nova senha">
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Confirmar Senha</label>
                            <div class="relative group">
                                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <i class="fas fa-check-double text-slate-400 group-focus-within:text-indigo-500 transition"></i>
                                </div>
                                <input type="password" id="confirma-senha" class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700" placeholder="Repita a nova senha">
                            </div>
                        </div>

                        <div id="erro-senha" class="hidden text-rose-500 text-[10px] font-bold text-center px-4 animate-bounce">
                           <i class="fas fa-exclamation-triangle"></i> <span>As senhas não coincidem.</span>
                        </div>

                        <button id="btn-atualizar-senha" onclick="Login.salvarNovaSenha()" class="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all transform active:scale-[0.98]">
                            Salvar e Acessar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('nova-senha').focus();
    },

    salvarNovaSenha: async function() {
        const s1 = document.getElementById('nova-senha').value.trim();
        const s2 = document.getElementById('confirma-senha').value.trim();
        const msg = document.getElementById('erro-senha');
        const btn = document.getElementById('btn-atualizar-senha');

        if (s1.length < 6) {
            msg.innerText = "A senha deve ter pelo menos 6 caracteres.";
            msg.classList.remove('hidden');
            return;
        }

        if (s1 !== s2) {
            msg.innerText = "As senhas não coincidem.";
            msg.classList.remove('hidden');
            return;
        }

        if (s1 === 'gupy123') {
            msg.innerText = "A nova senha não pode ser a senha padrão.";
            msg.classList.remove('hidden');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        const res = await Sistema.atualizarSenha(s1);

        if (res.success) {
            const usuario = Sistema.lerSessao();
            this.redirecionar(usuario);
        } else {
            msg.innerText = "Erro ao salvar: " + res.error;
            msg.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = 'Salvar e Acessar';
        }
    },

    redirecionar: function(usuario) {
        // Normaliza o perfil para evitar erros de Maiúscula/Minúscula
        const perfil = (usuario.perfil || '').toLowerCase().trim();
        const funcao = (usuario.funcao || '').toLowerCase().trim();

        // Lista de perfis com acesso ao Painel de Gestão
        const perfisGestao = ['admin', 'administrador', 'gestor', 'gestora'];

        // Verifica permissão
        if (perfisGestao.includes(perfil) || perfisGestao.includes(funcao)) {
            console.log("🔒 Acesso concedido: Painel de Gestão");
            window.location.href = 'gestao.html';
        } else {
            console.log("👤 Acesso concedido: Minha Área");
            window.location.href = 'minha_area.html';
        }
    },

    mostrarErro: function(msg) {
        const el = document.getElementById('msg-erro');
        if(el) {
            el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
            el.classList.remove('hidden');
        } else {
            alert(msg);
        }
    }
};

// Inicializa o módulo após o carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    // Pequeno delay para garantir que o script sistema.js carregou
    setTimeout(() => Login.init(), 100);
});