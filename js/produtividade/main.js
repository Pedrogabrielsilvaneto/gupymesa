/* ARQUIVO: js/produtividade/main.js */
window.Produtividade = window.Produtividade || {};

// Usamos Object.assign para garantir que as funções fiquem na raiz do objeto Produtividade,
// compatível com o onclick="" do seu HTML atual.
Object.assign(window.Produtividade, {
    supabase: null,
    usuario: null,
    mapaUsuarios: {},
    filtroPeriodo: 'mes',
    debounceTimer: null,
 
    init: async function () {
        console.log("🚀 Produtividade Main (Root Mode) Iniciado");
 
        try {
            const storedUser = localStorage.getItem('usuario_logado');
            if (!storedUser) {
                window.location.href = 'index.html';
                return;
            }
            this.usuario = JSON.parse(storedUser);
 
            // [FIX] Carregamento Global de Usuários para garantir que os filtros funcionem em qualquer aba
            await this.carregarUsuariosGlobal();
        } catch (e) {
            window.location.href = 'index.html';
            return;
        }

        // Checking Diário
        if (window.Sistema && window.Sistema.registrarAcesso) {
            await window.Sistema.registrarAcesso(this.usuario.id);
        }

        this.popularSeletoresIniciais();
        this.carregarEstadoSalvo();
        this.verificarStatusPresenca();

        if (window.Produtividade.Filtros && typeof window.Produtividade.Filtros.init === 'function') {
            window.Produtividade.Filtros.init();
        }

        this.mudarAba('geral');
    },

    carregarUsuariosGlobal: async function () {
        if (!window.Sistema || !window.Sistema.supabase) return;
        try {
            const { data } = await window.Sistema.supabase
                .from('usuarios')
                .select('id, nome, perfil, funcao, contrato, ativo');
            
            if (data) {
                // Alimenta o mapa global
                data.forEach(u => this.mapaUsuarios[u.id] = u);
                
                // [LEGACY SYNC] Garante que as abas que usam Geral.state.mapaUsuarios também vejam os dados
                if (window.Produtividade.Geral && window.Produtividade.Geral.state) {
                    window.Produtividade.Geral.state.mapaUsuarios = this.mapaUsuarios;
                }
            }
        } catch (e) {
            console.error("Erro ao carregar usuários globais:", e);
        }
    },
 
    verificarStatusPresenca: async function () {
        if (!Sistema || !Sistema.supabase) return;
        const hoje = new Date().toISOString().split('T')[0];
        try {
            const { data } = await Sistema.supabase
                .from('acessos_diarios')
                .select('id')
                .eq('usuario_id', this.usuario.id)
                .eq('data_referencia', hoje)
                .maybeSingle();

            const statusEl = document.getElementById('status-presenca-hoje');
            if (statusEl) {
                statusEl.innerHTML = data
                    ? '<span class="text-green-500 font-bold"><i class="fas fa-check-circle"></i> CHECKING ATIVO</span>'
                    : '<span class="text-amber-500 font-bold"><i class="fas fa-clock"></i> AGUARDANDO REGISTRO</span>';
            }
        } catch (err) { }
    },

    popularSeletoresIniciais: function () {
        const anoSelect = document.getElementById('sel-ano');
        const anoAtual = new Date().getFullYear();
        if (anoSelect) {
            let htmlAnos = '';
            for (let i = anoAtual + 1; i >= anoAtual - 2; i--) {
                htmlAnos += `<option value="${i}" ${i === anoAtual ? 'selected' : ''}>${i}</option>`;
            }
            anoSelect.innerHTML = htmlAnos;
        }

        const mesSelect = document.getElementById('sel-mes');
        if (mesSelect) mesSelect.value = new Date().getMonth();

        const diaInput = document.getElementById('sel-data-dia');
        if (diaInput && !diaInput.value) {
            diaInput.value = new Date().toISOString().split('T')[0];
        }
    },

    mudarPeriodo: function (tipo, salvar = true) {
        this.filtroPeriodo = tipo;

        ['dia', 'mes', 'semana', 'ano'].forEach(t => {
            const btn = document.getElementById(`btn-periodo-${t}`);
            if (btn) {
                btn.className = (t === tipo)
                    ? "px-3 py-1 text-xs font-bold rounded bg-white shadow-sm text-blue-600 transition"
                    : "px-3 py-1 text-xs font-bold rounded hover:bg-white hover:shadow-sm transition text-slate-500";
            }
        });

        const els = {
            dia: document.getElementById('sel-data-dia'),
            mes: document.getElementById('sel-mes'),
            semana: document.getElementById('sel-semana'),
            sub: document.getElementById('sel-subperiodo-ano'),
            ano: document.getElementById('sel-ano')
        };

        Object.values(els).forEach(el => el?.classList.add('hidden'));

        if (tipo === 'dia') {
            els.dia?.classList.remove('hidden');
        } else {
            els.ano?.classList.remove('hidden');
            if (tipo === 'mes') els.mes?.classList.remove('hidden');
            else if (tipo === 'semana') {
                els.mes?.classList.remove('hidden');
                els.semana?.classList.remove('hidden');
            }
            else if (tipo === 'ano') els.sub?.classList.remove('hidden');
        }

        if (salvar) this.salvarEAtualizar();
    },

    salvarEAtualizar: function () {
        const estado = {
            tipo: this.filtroPeriodo,
            dia: document.getElementById('sel-data-dia')?.value,
            ano: document.getElementById('sel-ano')?.value,
            mes: document.getElementById('sel-mes')?.value,
            semana: document.getElementById('sel-semana')?.value,
            sub: document.getElementById('sel-subperiodo-ano')?.value
        };
        localStorage.setItem('prod_filtro_state', JSON.stringify(estado));

        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        // Feedback visual
        const statusEl = document.getElementById('tabela-corpo');
        if (statusEl) statusEl.innerHTML = '<tr><td colspan="14" class="text-center py-8 text-blue-400"><i class="fas fa-hourglass-half fa-spin"></i> Atualizando...</td></tr>';

        this.debounceTimer = setTimeout(() => {
            this.atualizarTodasAbas();
        }, 500);
    },

    carregarEstadoSalvo: function () {
        const salvo = localStorage.getItem('prod_filtro_state');
        if (salvo) {
            try {
                const s = JSON.parse(salvo);
                const setVal = (id, val) => { if (document.getElementById(id)) document.getElementById(id).value = val; };

                setVal('sel-data-dia', s.dia || new Date().toISOString().split('T')[0]);
                setVal('sel-ano', s.ano);
                setVal('sel-mes', s.mes);
                setVal('sel-semana', s.semana);
                setVal('sel-subperiodo-ano', s.sub);

                this.mudarPeriodo(s.tipo || 'mes', false);
                return;
            } catch (e) { }
        }
        this.mudarPeriodo('mes', false);
    },

    getDatasFiltro: function () {
        let inicio, fim;
        const fmt = (d) => d.toISOString().split('T')[0];

        if (this.filtroPeriodo === 'dia') {
            const val = document.getElementById('sel-data-dia')?.value || new Date().toISOString().split('T')[0];
            inicio = fim = val;
        } else {
            const ano = parseInt(document.getElementById('sel-ano')?.value || new Date().getFullYear());
            const mes = parseInt(document.getElementById('sel-mes')?.value || 0);

            if (this.filtroPeriodo === 'mes') {
                inicio = new Date(ano, mes, 1);
                fim = new Date(ano, mes + 1, 0);

            } else if (this.filtroPeriodo === 'semana') {
                // --- LÓGICA CORRIGIDA: SEGUNDA A DOMINGO ---
                const sem = parseInt(document.getElementById('sel-semana')?.value || 1);
                const primeiroDiaMes = new Date(ano, mes, 1);
                const ultimoDiaMes = new Date(ano, mes + 1, 0);

                // Encontrar o fim da primeira semana (Primeiro Domingo ou fim do mês)
                // getDay(): 0 = Domingo, 1 = Segunda ... 6 = Sábado
                const diaSemana1 = primeiroDiaMes.getDay();

                // Dias restantes até o próximo domingo (Se for Dom(0), já é o fim. Se for Seg(1), faltam 6 dias)
                const diasAteDomingo = diaSemana1 === 0 ? 0 : (7 - diaSemana1);

                let fimSemana1 = new Date(primeiroDiaMes);
                fimSemana1.setDate(primeiroDiaMes.getDate() + diasAteDomingo);

                if (sem === 1) {
                    // Semana 1: Dia 1 até o primeiro Domingo
                    inicio = primeiroDiaMes;
                    fim = fimSemana1;
                } else {
                    // Semanas seguintes: Segunda-feira até Domingo
                    // Calcula o início da semana N: (Fim da Semana 1 + 1 dia) + (N-2 semanas * 7 dias)
                    let inicioSemanaN = new Date(fimSemana1);
                    inicioSemanaN.setDate(fimSemana1.getDate() + 1 + (sem - 2) * 7);

                    let fimSemanaN = new Date(inicioSemanaN);
                    fimSemanaN.setDate(inicioSemanaN.getDate() + 6); // +6 dias para fechar no Domingo

                    inicio = inicioSemanaN;
                    fim = fimSemanaN;
                }

                // Trava de segurança: não sair do mês
                if (inicio > ultimoDiaMes) inicio = ultimoDiaMes;
                if (fim > ultimoDiaMes) fim = ultimoDiaMes;

            } else if (this.filtroPeriodo === 'ano') {
                const sub = document.getElementById('sel-subperiodo-ano')?.value;
                if (sub === 'S1') { inicio = new Date(ano, 0, 1); fim = new Date(ano, 5, 30); }
                else if (sub === 'S2') { inicio = new Date(ano, 6, 1); fim = new Date(ano, 11, 31); }
                else if (sub === 'T1') { inicio = new Date(ano, 0, 1); fim = new Date(ano, 2, 31); }
                else if (sub === 'T2') { inicio = new Date(ano, 3, 1); fim = new Date(ano, 5, 30); }
                else if (sub === 'T3') { inicio = new Date(ano, 6, 1); fim = new Date(ano, 8, 30); }
                else if (sub === 'T4') { inicio = new Date(ano, 9, 1); fim = new Date(ano, 11, 31); }
                else { inicio = new Date(ano, 0, 1); fim = new Date(ano, 11, 31); }
            }
        }
        return { inicio: typeof inicio === 'string' ? inicio : fmt(inicio), fim: typeof fim === 'string' ? fim : fmt(fim) };
    },

    mudarAba: function (abaId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

        const targetTab = document.getElementById(`tab-${abaId}`);
        const targetBtn = document.getElementById(`btn-${abaId}`);

        if (targetTab) targetTab.classList.remove('hidden');
        if (targetBtn) targetBtn.classList.add('active');

        // Carrega o módulo específico
        const moduloNome = abaId.charAt(0).toUpperCase() + abaId.slice(1);
        const modulo = Produtividade[moduloNome];

        if (modulo) {
            if (typeof modulo.carregarTela === 'function') modulo.carregarTela();
            else if (typeof modulo.init === 'function') modulo.init();
        }
    },

    atualizarTodasAbas: function () {
        const abas = ['Geral', 'Consolidado', 'Performance', 'Matriz'];
        abas.forEach(aba => {
            const idTab = `tab-${aba.toLowerCase()}`;
            const elTab = document.getElementById(idTab);

            if (elTab && !elTab.classList.contains('hidden')) {
                const modulo = Produtividade[aba];
                if (modulo && typeof modulo.carregarTela === 'function') {
                    modulo.carregarTela();
                }
            }
        });
    }
});

// Inicialização segura
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.Produtividade && typeof window.Produtividade.init === 'function') {
            window.Produtividade.init();
        }
    }, 100);
});