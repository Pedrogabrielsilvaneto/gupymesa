/**
 * ARQUIVO: js/produtividade/filtros.js
 * FUNÇÃO: Orquestrador de Filtros Contextuais (HUD)
 * VERSÃO: 3.0 - Visibilidade Dinâmica
 */
window.Produtividade = window.Produtividade || {};

Produtividade.Filtros = {
    abaAtiva: 'geral',
    estado: { nome: '', funcao: 'todos', contrato: 'todos' },

    // CONFIGURAÇÃO: Define quais filtros aparecem em cada aba
    configVisibilidade: {
        'geral': ['nome', 'funcao', 'contrato'],
        'consolidado': ['funcao', 'contrato'],
        'performance': ['nome', 'funcao'],
        'matriz': ['nome', 'funcao']
    },

    init: function () {
        console.log("🔍 [HUD] Engine de Filtros Iniciada");
        this.configurarInterceptadorDeAbas();

        setTimeout(() => {
            this.abaAtiva = this.detectarAbaInicial();
            this.ajustarVisibilidade(this.abaAtiva);
            this.popularSeletores();
        }, 500);
    },

    popularSeletores: async function () {
        if (!window.Sistema || !Sistema.query) return;
        try {
            // Busca funções únicas do banco
            const funcoes = await Sistema.query("SELECT DISTINCT funcao FROM usuarios WHERE funcao IS NOT NULL AND funcao != '' ORDER BY funcao ASC");
            const selFuncao = document.getElementById('filtro-funcao-prod');
            if (selFuncao && funcoes) {
                // Mantém a opção "Função" como label padrão (valor vazio)
                selFuncao.innerHTML = '<option value="">Função</option>';
                funcoes.forEach(f => {
                    const role = f.funcao.toUpperCase();
                    if (role === 'ADMIN' || role.includes('ADMIN')) return;

                    const opt = document.createElement('option');
                    opt.value = role;
                    opt.textContent = f.funcao;
                    selFuncao.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Erro ao popular seletores de filtro:", e);
        }
    },

    detectarAbaInicial: function () {
        if (!document.getElementById('tab-geral').classList.contains('hidden')) return 'geral';
        if (!document.getElementById('tab-consolidado').classList.contains('hidden')) return 'consolidado';
        if (!document.getElementById('tab-performance').classList.contains('hidden')) return 'performance';
        if (!document.getElementById('tab-matriz').classList.contains('hidden')) return 'matriz';
        return 'geral';
    },

    configurarInterceptadorDeAbas: function () {
        const self = this;
        const funcaoOriginal = Produtividade.mudarAba;

        Produtividade.mudarAba = function (abaId) {
            funcaoOriginal(abaId);
            self.abaAtiva = abaId;
            self.ajustarVisibilidade(abaId);
            self.aplicar();
        };
    },

    ajustarVisibilidade: function (abaId) {
        const container = document.getElementById('container-filtros-hud');
        if (!container) return;

        const configs = this.configVisibilidade[abaId];
        if (!configs) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');

        const elementos = {
            'nome': document.getElementById('wrap-filtro-nome'),
            'funcao': document.getElementById('wrap-filtro-funcao'),
            'contrato': document.getElementById('wrap-filtro-contrato')
        };

        Object.keys(elementos).forEach(chave => {
            const el = elementos[chave];
            if (el) {
                if (configs.includes(chave)) el.classList.remove('hidden');
                else el.classList.add('hidden');
            }
        });
    },

    aplicar: function () {
        try {
            this.estado.nome = document.getElementById('filtro-nome-prod')?.value.toLowerCase().trim() || '';
            this.estado.funcao = document.getElementById('filtro-funcao-prod')?.value || 'todos';
            this.estado.contrato = document.getElementById('filtro-contrato-prod')?.value || 'todos';

            // Ajuste para o padrão de label (vazio = todos)
            if (this.estado.funcao === '') this.estado.funcao = 'todos';
            if (this.estado.contrato === '') this.estado.contrato = 'todos';

            switch (this.abaAtiva) {
                case 'geral': this.filtrarGeral(); break;
                // Outras abas podem precisar de implementações específicas se não usarem a mesma lógica de filtro
            }
        } catch (err) {
            console.error("[HUD] Erro ao aplicar filtro:", err);
        }
    },

    resetar: function () {
        const elNome = document.getElementById('filtro-nome-prod');
        const elFuncao = document.getElementById('filtro-funcao-prod');
        const elContrato = document.getElementById('filtro-contrato-prod');

        if (elNome) elNome.value = '';
        if (elFuncao) elFuncao.value = '';
        if (elContrato) elContrato.value = '';

        this.aplicar();
    },

    filtrarGeral: function () {
        if (!Produtividade.Geral || !Produtividade.Geral.state) return;

        Produtividade.Geral.renderizarTabela();
        Produtividade.Geral.calcularKpisGlobal();
        if (typeof Produtividade.Geral.atualizarDestaques === 'function') {
            Produtividade.Geral.atualizarDestaques();
        }
    },

    // Esta função será chamada de dentro dos métodos de renderização dos módulos
    preFiltrar: function (lista) {
        if (!lista || lista.length === 0) return [];

        return lista.filter(item => {
            const u = item.usuario_id ? (window.Produtividade.Geral?.state?.mapaUsuarios[item.usuario_id] || {}) : (item.uid ? (window.Produtividade.Geral?.state?.mapaUsuarios[item.uid] || {}) : item);

            const nome = (item.nome || u.nome || '').toLowerCase();
            const funcao = (u.funcao || '').toUpperCase();
            const contrato = (u.contrato || '').toUpperCase();

            // Match Nome/ID
            const matchNome = this.estado.nome === '' || nome.includes(this.estado.nome) || String(item.usuario_id || item.uid || '').includes(this.estado.nome);

            // Match Função
            const matchFuncao = this.estado.funcao === 'todos' || funcao === this.estado.funcao;

            // Match Contrato
            let matchContrato = this.estado.contrato === 'todos';
            if (!matchContrato) {
                if (this.estado.contrato === 'TERCEIROS') {
                    matchContrato = contrato.includes('PJ') || contrato.includes('TERCEIRO') || contrato.includes('TER');
                } else {
                    matchContrato = contrato.includes(this.estado.contrato);
                }
            }

            return matchNome && matchFuncao && matchContrato;
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Produtividade.Filtros.init(), 600);
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => Produtividade.Filtros.init(), 300);
});