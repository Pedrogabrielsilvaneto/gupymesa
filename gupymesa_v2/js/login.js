/* ARQUIVO: js/login.js
   DESCRIÇÃO: Módulo de Autenticação (JWT Secured)
*/

const Login = {
    init: function() {
        if (typeof Sistema === 'undefined') {
            console.error("Sistema não carregado.");
            return;
        }
        
        const sessao = Sistema.lerSessao();
        if (sessao && Sistema.lerToken()) {
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

        if (!id || !senha) {
            this.mostrarErro('Preencha todos os campos.');
            return;
        }

        const idNum = parseInt(id);
        if (isNaN(idNum)) {
            this.mostrarErro('O ID deve ser numérico.');
            return;
        }

        const textoOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        btn.disabled = true;
        if (msgErro) msgErro.classList.add('hidden');

        try {
            const senhaHash = await Sistema.gerarHash(senha);

            // Chamada para a NOVA API de Autenticação Segura
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: idNum, senha: senhaHash })
            });

            const result = await response.json();

            if (!response.ok) {
                this.mostrarErro(result.error || 'Falha na autenticação');
                return;
            }

            // SUCESSO: Salva usuário e o TOKEN JWT
            Sistema.salvarSessao(result.user, result.token);

            const precisaTrocar = result.trocar_senha === 1 || senha === 'gupy123';
            
            if (precisaTrocar) {
                this.exibirTrocaSenha(result.user);
            } else {
                this.redirecionar(result.user);
            }

        } catch (error) {
            console.error("Erro Login:", error);
            this.mostrarErro('Erro ao conectar ao servidor.');
        } finally {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    },

    exibirTrocaSenha: function(usuario) {
        const antigo = document.getElementById('modal-troca-senha');
        if (antigo) antigo.remove();

        const modalHtml = `
            <div id="modal-troca-senha" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95">
                    <div class="bg-indigo-600 p-6 text-white">
                        <h3 class="text-xl font-bold flex items-center gap-2"><i class="fas fa-shield-alt"></i> Segurança</h3>
                        <p class="text-indigo-100 text-sm mt-1">Altere sua senha padrão para continuar.</p>
                    </div>
                    <div class="p-8 space-y-5">
                        <div class="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg text-xs text-amber-800">
                            A senha <strong>gupy123</strong> é temporária. Use pelo menos 6 caracteres.
                        </div>
                        <input type="password" id="nova-senha" class="block w-full px-4 py-3 border rounded-xl bg-slate-50 outline-none focus:border-indigo-500" placeholder="Nova Senha">
                        <input type="password" id="confirma-senha" class="block w-full px-4 py-3 border rounded-xl bg-slate-50 outline-none focus:border-indigo-500" placeholder="Confirmar Senha">
                        <div id="erro-senha" class="hidden text-rose-500 text-[10px] font-bold text-center"></div>
                        <button id="btn-atualizar-senha" onclick="Login.salvarNovaSenha()" class="w-full py-3.5 rounded-xl text-white bg-emerald-600 font-bold shadow-lg">Salvar e Acessar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    salvarNovaSenha: async function() {
        const s1 = document.getElementById('nova-senha').value.trim();
        const s2 = document.getElementById('confirma-senha').value.trim();
        const msg = document.getElementById('erro-senha');
        const btn = document.getElementById('btn-atualizar-senha');

        if (s1.length < 6 || s1 !== s2 || s1 === 'gupy123') {
            msg.innerText = "Verifique os requisitos da senha.";
            msg.classList.remove('hidden');
            return;
        }

        btn.disabled = true;
        const res = await Sistema.atualizarSenha(s1);
        if (res.success) {
            this.redirecionar(Sistema.lerSessao());
        } else {
            msg.innerText = "Erro: " + res.error;
            msg.classList.remove('hidden');
            btn.disabled = false;
        }
    },

    redirecionar: function(usuario) {
        const perfil = (usuario.perfil || '').toLowerCase().trim();
        const funcao = (usuario.funcao || '').toLowerCase().trim();
        const perfisGestao = ['admin', 'administrador', 'gestor', 'gestora'];

        if (perfisGestao.includes(perfil) || perfisGestao.includes(funcao)) {
            window.location.href = 'gestao.html';
        } else {
            window.location.href = 'minha_area.html';
        }
    },

    solicitarReset: async function() {
        const id = document.getElementById('esqueci-id').value;
        if (!id) return alert("Informe seu ID.");

        const btn = event.currentTarget;
        btn.disabled = true;
        btn.innerText = "Enviando...";

        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(id) })
            });

            const result = await res.json();
            alert(result.message);
            document.getElementById('modal-esqueci').classList.add('hidden');
        } catch (e) {
            alert("Erro ao solicitar reset.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Solicitar Reset";
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

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Login.init(), 100);
});