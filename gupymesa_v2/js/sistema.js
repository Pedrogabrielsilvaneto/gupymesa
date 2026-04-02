/**
 * SISTEMA: GupyMesa - TiDB Adapter (Versão 3.0 - SECURE)
 * Arquitetura: Frontend -> Vercel API (JWT Secured) -> TiDB Cloud
 */

const Sistema = {
    usuarioLogado: null,
    
    // --- NÚCLEO: Conexão com a API ---
    async query(sql, params = []) {
        try {
            const token = this.lerToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = token;

            const response = await fetch('/api/banco', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ query: sql, values: params })
            });

            const result = await response.json();

            if (response.status === 401 || response.status === 403) {
                console.warn("Sessão expirada ou não autorizada.");
                this.limparSessao();
                return null;
            }

            if (result.error) {
                console.error("Erro SQL:", result.error);
                throw new Error(result.error);
            }

            return result.data;
        } catch (erro) {
            console.error("Falha na comunicação com API:", erro);
            return null;
        }
    },

    // --- NOVO: Chamada para Chat com Token ---
    async chat(messages) {
        try {
            const token = this.lerToken();
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token 
                },
                body: JSON.stringify({ messages })
            });

            if (!response.ok) throw new Error("Erro no chat: " + response.statusText);
            return response.body; // Retorna o stream
        } catch (e) {
            console.error("Erro Chat API:", e);
            return null;
        }
    },

    // --- CRIPTOGRAFIA ---
    gerarHash: async function (texto) {
        if (!texto) return '';
        const msgBuffer = new TextEncoder().encode(texto);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // --- UTILITÁRIOS ---
    gerarUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    },

    escapar(str) {
        if (!str) return '';
        return str.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    },

    // --- SESSÃO E LOGIN (JWT) ---
    lerSessao() {
        try {
            const dados = localStorage.getItem('usuario_logado');
            return dados ? JSON.parse(dados) : null;
        } catch (e) {
            this.limparSessao();
            return null;
        }
    },

    lerToken() {
        return localStorage.getItem('auth_token');
    },

    salvarSessao(dadosUsuario, token = null) {
        localStorage.setItem('usuario_logado', JSON.stringify(dadosUsuario));
        if (token) localStorage.setItem('auth_token', token);
        localStorage.setItem('ultimo_acesso', new Date().toISOString());
    },

    limparSessao() {
        localStorage.removeItem('usuario_logado');
        localStorage.removeItem('auth_token');
        if (window.location.pathname.indexOf('index.html') === -1 && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
    },

    verificarSessaoGlobal() {
        const paginasPublicas = ['index.html', 'login.html', 'ferramentas.html'];
        const path = window.location.pathname;
        const paginaAtual = path.substring(path.lastIndexOf('/') + 1) || 'index.html';

        if (paginasPublicas.includes(paginaAtual)) return;

        const usuario = this.lerSessao();
        const token = this.lerToken();

        if (!usuario || !token) {
            this.limparSessao();
        } else {
            const elNome = document.getElementById('usuario-nome-top');
            if (elNome) elNome.innerText = usuario.nome.split(' ')[0];
        }
    },

    // --- MÉTODOS DE NEGÓCIO ---
    async buscarProducao(mes, ano) {
        const sql = `SELECT * FROM producao WHERE mes_referencia = ? AND ano_referencia = ?`;
        return await this.query(sql, [mes, ano]);
    },

    async salvarProducao(dados) {
        const id = this.gerarUUID();
        const sql = `
            INSERT INTO producao (id, usuario_id, data_referencia, mes_referencia, ano_referencia, tarefa, quantidade, tempo_gasto_minutos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const usuarioId = this.lerSessao()?.id || 'ANONIMO';
        return await this.query(sql, [
            id, usuarioId, dados.data, dados.mes, dados.ano, dados.tarefa, dados.qtd, dados.tempo || 0
        ]);
    },

    async atualizarSenha(novaSenhaHash, senhaAtualHash = null) {
        const usuario = this.lerSessao();
        if (!usuario || !usuario.id) return { success: false, error: 'Sessão não encontrada' };

        try {
            // Se informou a senha atual, usa a API específica e segura
            if (senhaAtualHash) {
                const response = await fetch('/api/auth/change-password', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': this.lerToken()
                    },
                    body: JSON.stringify({ 
                        senhaAtual: senhaAtualHash, 
                        novaSenha: novaSenhaHash 
                    })
                });
                const result = await response.json();
                if (response.ok) {
                    usuario.trocar_senha = 0;
                    this.salvarSessao(usuario, this.lerToken());
                    return { success: true };
                }
                return { success: false, error: result.error };
            }

            // Fallback para admin/troca obrigatória inicial (via query segura)
            // Nota: O api/banco vai verificar se o usuário está alterando a SI MESMO.
            const sql = `UPDATE usuarios SET senha = ?, trocar_senha = 0 WHERE id = ?`;
            const result = await this.query(sql, [novaSenhaHash, usuario.id]);

            if (result !== null) {
                usuario.trocar_senha = 0;
                this.salvarSessao(usuario, this.lerToken());
                return { success: true };
            }
            return { success: false, error: 'Erro ao salvar no banco' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    inicializar() {
        console.log("🚀 Sistema V3 Iniciado");
    }
};

if (typeof window !== 'undefined') {
    window.Sistema = Sistema;
    document.addEventListener('DOMContentLoaded', () => {
        Sistema.inicializar();
        Sistema.verificarSessaoGlobal();
    });
}
