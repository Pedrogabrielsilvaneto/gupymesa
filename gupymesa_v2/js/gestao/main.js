/* ARQUIVO: js/gestao/main.js */
window.Gestao = window.Gestao || {};

Gestao.init = async function () {
    // 1. Inicializa Sistema (Se ainda não estiver)
    if (typeof Sistema === 'undefined') {
        console.error("ERRO CRÍTICO: js/sistema.js não foi carregado!");
        return;
    }

    // Sistema agora usa TiDB diretamente via Sistema.query() - não precisa mais de Supabase

    // 2. Verifica Sessão Manualmente (Segurança da Página)
    let user = null;
    try {
        // Tenta ler do Sistema (que tem try/catch) ou direto do storage
        user = Sistema.lerSessao();
    } catch (e) {
        console.error("Sessão inválida:", e);
    }

    if (!user) {
        console.warn("🚫 Sessão não encontrada. Redirecionando para Login...");
        window.location.href = 'index.html';
        return;
    }

    // 3. Verifica Permissões
    // Normaliza textos
    const perfil = (user.perfil || '').toLowerCase().trim();
    const funcao = (user.funcao || '').toLowerCase().trim();
    const id = parseInt(user.id);

    // Lista VIP
    const temAcesso =
        perfil === 'admin' ||
        perfil === 'administrador' ||
        funcao.includes('gestor') ||
        funcao.includes('auditor') ||
        funcao.includes('assistente') ||
        id === 1 ||
        id === 1000;

    if (!temAcesso) {
        console.warn("🚫 Acesso Negado (Perfil sem permissão). Perfil:", perfil, "ID:", id);
        alert("Acesso restrito a gestores.");
        window.location.href = 'minha_area.html';
        return;
    }

    console.log("✅ Gestão Iniciada. Usuário:", user.nome);

    // Atualiza nome no topo se existir elemento
    const elNome = document.getElementById('usuario-nome-top');
    if (elNome) elNome.innerText = user.nome.split(' ')[0];

    // Renderiza Menu
    if (window.Menu && Menu.Gestao) Menu.Gestao.renderizar();

    // Garante que todos os grupos de busca estão escondidos inicialmente
    document.querySelectorAll('.header-search-group').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });

    // Restaura última aba
    const ultimaAba = localStorage.getItem('gestao_aba_ativa') || 'usuarios';
    setTimeout(() => Gestao.mudarAba(ultimaAba), 50);
};

Gestao.mudarAba = function (aba) {
    localStorage.setItem('gestao_aba_ativa', aba);

    // 1. Atualiza Botões da Navegação (Esquerda)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-50', 'text-blue-700');
        btn.classList.add('text-slate-600');
    });
    const btnAtivo = document.getElementById(aba.startsWith('btn-') ? aba : `btn-${aba}`);
    if (btnAtivo) btnAtivo.classList.add('active', 'bg-blue-50', 'text-blue-700');

    // 2. Atualiza Views (Conteúdo)
    document.querySelectorAll('.gestao-view').forEach(el => el.classList.add('hidden'));
    const view = document.getElementById(`view-${aba}`);
    if (view) view.classList.remove('hidden');

    // 3. Atualiza Ações do Header (Direita)
    document.querySelectorAll('.header-action-group').forEach(el => el.classList.remove('active'));
    const headerAction = document.getElementById(`actions-${aba}`);
    if (headerAction) headerAction.classList.add('active');

    // 4. Atualiza Buscas do Header (Novo)
    document.querySelectorAll('.header-search-group').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    const searchGroup = document.getElementById(`search-group-${aba}`);
    if (searchGroup) {
        searchGroup.classList.add('active');
        searchGroup.style.display = 'flex';
    }

    if (window.Menu && Menu.Gestao) Menu.Gestao.atualizarAcao(aba);

    // 5. Carrega Dados (Check de segurança)
    if (aba === 'usuarios' && Gestao.Usuarios) Gestao.Usuarios.carregar();
    else if (aba === 'empresas' && Gestao.Empresas) Gestao.Empresas.carregar();
    else if (aba === 'assertividade' && Gestao.Assertividade) Gestao.Assertividade.carregar();
    else if (aba === 'metas' && Gestao.Metas) Gestao.Metas.init();
};

document.addEventListener('DOMContentLoaded', Gestao.init);