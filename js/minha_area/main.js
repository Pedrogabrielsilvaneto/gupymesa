/* ARQUIVO: js/minha_area/main.js
   DESCRIÇÃO: Controlador de Filtros (Configurado para Início Semestral)
   REGRA: Inicia sempre exibindo o semestre atual (S1 ou S2).
*/

window.MinhaArea = {
    usuario: null,
    usuarioAlvoId: null,
    filtroPeriodo: 'ano', // Alterado de 'mes' para 'ano' para iniciar no modo semestral

    init: async function () {
        if (!Sistema.supabase) await Sistema.inicializar(false);

        const storedUser = localStorage.getItem('usuario_logado');
        if (!storedUser) { window.location.href = 'index.html'; return; }
        this.usuario = JSON.parse(storedUser);

        await this.setupAdminAccess();

        if (!this.isAdmin()) {
            this.usuarioAlvoId = this.usuario.id;
        } else {
            // Se for Admin, começa com a Visão de Equipe
            this.usuarioAlvoId = null;
        }

        this.popularSeletoresFixos();

        // Tenta carregar estado salvo, se não houver, define o semestre atual
        const salvo = localStorage.getItem('ma_filtro_state');
        if (!salvo) {
            this.configurarSemestreAtual();
        } else {
            this.carregarEstadoSalvo();
        }

        this.atualizarInterfaceFiltros();

        if (this.filtroPeriodo === 'semana') {
            this.popularSemanasDoMes();
        }

        this.atualizarTudo();

        // Listeners
        ['sel-ano', 'sel-mes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    if (this.filtroPeriodo === 'semana') {
                        this.popularSemanasDoMes();
                    }
                    this.salvarEAtualizar();
                });
            }
        });

        ['sel-semana', 'sel-subperiodo-ano'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.salvarEAtualizar());
        });
    },

    // Define automaticamente S1 ou S2 com base na data atual
    configurarSemestreAtual: function () {
        const mesAtual = new Date().getMonth(); // 0-11
        const seletorSub = document.getElementById('sel-subperiodo-ano');
        if (seletorSub) {
            // Janeiro (0) a Junho (5) = S1, Julho (6) a Dezembro (11) = S2
            const semestre = mesAtual <= 5 ? 'S1' : 'S2';
            seletorSub.value = semestre;
        }
    },

    isAdmin: function () {
        const p = (this.usuario.perfil || '').toUpperCase();
        const f = (this.usuario.funcao || '').toUpperCase();
        const id = parseInt(this.usuario.id);
        const isExactAdmin = p === 'ADMIN' || p === 'ADMINISTRADOR' || f === 'ADMIN' || f === 'ADMINISTRADOR';
        const isLeadershipRole = ['GESTOR', 'AUDITOR', 'COORDENADOR', 'COORDENA', 'LIDER', 'LÍDER', 'HEAD', 'DIRETOR'].some(t => p.includes(t) || f.includes(t));
        // Evita que Assistente de Auditoria ganhe poderes globais se não for para ter, mas caso eles tenham 'Auditor' no título, 
        // as well as 'Assistente Administrativo'.
        // Na verdade, the new logic prevents explicitly 'ASSISTENTE ADMINISTRATIVO' 
        // since 'ADMIN' is exact match. For 'AUDITOR', if we want to block 'Assistente de Auditoria', we should check:
        const isAssistente = f.includes('ASSISTENTE');
        return isExactAdmin || (isLeadershipRole && !isAssistente) || id === 1 || id === 1000;
    },

    setupAdminAccess: async function () {
        if (this.isAdmin()) {
            const container = document.getElementById('admin-selector-container');
            if (container) container.classList.remove('hidden');
        }
    },

    mudarPeriodo: function (tipo) {
        this.filtroPeriodo = tipo;
        this.atualizarInterfaceFiltros();
        if (tipo === 'semana') this.popularSemanasDoMes();
        this.salvarEAtualizar();
    },

    atualizarInterfaceFiltros: function () {
        ['mes', 'semana', 'ano'].forEach(t => {
            const btn = document.getElementById(`btn-periodo-${t}`);
            if (btn) {
                btn.className = (t === this.filtroPeriodo)
                    ? "px-3 py-1.5 text-xs font-bold rounded shadow-sm text-blue-600 bg-white border border-blue-200 transition-all"
                    : "px-3 py-1.5 text-xs font-bold rounded text-slate-500 hover:bg-slate-100 transition-all";
            }
        });

        const elMes = document.getElementById('sel-mes');
        const elSemana = document.getElementById('sel-semana');
        const elSubAno = document.getElementById('sel-subperiodo-ano');

        if (elMes) elMes.classList.add('hidden');
        if (elSemana) elSemana.classList.add('hidden');
        if (elSubAno) elSubAno.classList.add('hidden');

        if (this.filtroPeriodo === 'mes') {
            if (elMes) elMes.classList.remove('hidden');
        }
        else if (this.filtroPeriodo === 'semana') {
            if (elMes) elMes.classList.remove('hidden');
            if (elSemana) elSemana.classList.remove('hidden');
        }
        else if (this.filtroPeriodo === 'ano') {
            if (elSubAno) elSubAno.classList.remove('hidden');
        }
    },

    popularSeletoresFixos: function () {
        const anoAtual = new Date().getFullYear();
        const mesAtual = new Date().getMonth();

        const elAno = document.getElementById('sel-ano');
        if (elAno) {
            elAno.innerHTML = `
                <option value="${anoAtual}">${anoAtual}</option>
                <option value="${anoAtual - 1}">${anoAtual - 1}</option>
                <option value="${anoAtual + 1}">${anoAtual + 1}</option>
            `;
            elAno.value = anoAtual;
        }

        const elMes = document.getElementById('sel-mes');
        if (elMes) elMes.value = mesAtual;
    },

    popularSemanasDoMes: function () {
        const elSemana = document.getElementById('sel-semana');
        const elAno = document.getElementById('sel-ano');
        const elMes = document.getElementById('sel-mes');

        if (!elSemana || !elAno || !elMes) return;

        const ano = parseInt(elAno.value);
        const mes = parseInt(elMes.value);

        const primeiroDiaMes = new Date(ano, mes, 1);
        const ultimoDiaMes = new Date(ano, mes + 1, 0);

        let diaSemana = primeiroDiaMes.getDay();
        if (diaSemana === 0) diaSemana = 7;

        let segundaFeiraAtual = new Date(primeiroDiaMes);
        segundaFeiraAtual.setDate(primeiroDiaMes.getDate() - (diaSemana - 1));

        let html = '';
        let count = 1;

        while (segundaFeiraAtual <= ultimoDiaMes) {
            const domingoAtual = new Date(segundaFeiraAtual);
            domingoAtual.setDate(segundaFeiraAtual.getDate() + 6);

            if (segundaFeiraAtual > ultimoDiaMes) break;

            const inicioReal = segundaFeiraAtual < primeiroDiaMes ? primeiroDiaMes : segundaFeiraAtual;
            const fimReal = domingoAtual > ultimoDiaMes ? ultimoDiaMes : domingoAtual;

            const fmt = d => d.toISOString().split('T')[0];
            const fmtBr = d => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            if (inicioReal <= fimReal) {
                const valor = `${fmt(inicioReal)}|${fmt(fimReal)}`;
                const texto = `Semana ${count} (${fmtBr(inicioReal)} a ${fmtBr(fimReal)})`;
                html += `<option value="${valor}">${texto}</option>`;
                count++;
            }
            segundaFeiraAtual.setDate(segundaFeiraAtual.getDate() + 7);
        }
        elSemana.innerHTML = html;
        if (elSemana.options.length > 0 && !elSemana.value) {
            elSemana.selectedIndex = 0;
        }
    },

    getDatasFiltro: function () {
        const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const ano = parseInt(document.getElementById('sel-ano').value);

        if (this.filtroPeriodo === 'mes') {
            const mes = parseInt(document.getElementById('sel-mes').value);
            return {
                inicio: fmt(new Date(ano, mes, 1)),
                fim: fmt(new Date(ano, mes + 1, 0))
            };
        }
        else if (this.filtroPeriodo === 'semana') {
            const rawVal = document.getElementById('sel-semana').value;
            if (rawVal && rawVal.includes('|')) {
                const [i, f] = rawVal.split('|');
                return { inicio: i, fim: f };
            }
            return { inicio: fmt(new Date()), fim: fmt(new Date()) };
        }
        else if (this.filtroPeriodo === 'ano') {
            const tipo = document.getElementById('sel-subperiodo-ano').value;
            let inicio, fim;
            switch (tipo) {
                case 'S1': inicio = new Date(ano, 0, 1); fim = new Date(ano, 5, 30); break;
                case 'S2': inicio = new Date(ano, 6, 1); fim = new Date(ano, 11, 31); break;
                case 'T1': inicio = new Date(ano, 0, 1); fim = new Date(ano, 2, 31); break;
                case 'T2': inicio = new Date(ano, 3, 1); fim = new Date(ano, 5, 30); break;
                case 'T3': inicio = new Date(ano, 6, 1); fim = new Date(ano, 8, 30); break;
                case 'T4': inicio = new Date(ano, 9, 1); fim = new Date(ano, 11, 31); break;
                default: inicio = new Date(ano, 0, 1); fim = new Date(ano, 11, 31); break;
            }
            return { inicio: fmt(inicio), fim: fmt(fim) };
        }
    },

    salvarEAtualizar: function () {
        const estado = {
            tipo: this.filtroPeriodo,
            ano: document.getElementById('sel-ano')?.value,
            mes: document.getElementById('sel-mes')?.value,
            sub: document.getElementById('sel-subperiodo-ano')?.value,
            alvoId: this.usuarioAlvoId
        };
        localStorage.setItem('ma_filtro_state', JSON.stringify(estado));
        // [PERF] Invalida cache de dados ao mudar período
        if (MinhaArea.Metas) MinhaArea.Metas.rawDataCache = null;
        this.atualizarTudo();
    },

    carregarEstadoSalvo: function () {
        const salvo = localStorage.getItem('ma_filtro_state');
        if (salvo) {
            try {
                const s = JSON.parse(salvo);
                if (s.tipo) this.filtroPeriodo = s.tipo;
                if (s.ano && document.getElementById('sel-ano')) document.getElementById('sel-ano').value = s.ano;
                if (s.mes && document.getElementById('sel-mes')) document.getElementById('sel-mes').value = s.mes;
                if (s.sub && document.getElementById('sel-subperiodo-ano')) document.getElementById('sel-subperiodo-ano').value = s.sub;

                if (s.alvoId !== undefined) {
                    if (this.isAdmin()) {
                        this.usuarioAlvoId = s.alvoId;
                    } else {
                        // Força o ID próprio se não for admin
                        this.usuarioAlvoId = this.usuario.id;
                    }
                }
            } catch (e) { }
        }
    },

    mudarAba: function (aba) {
        // Remove active class from all buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

        // Hide all views
        document.querySelectorAll('.ma-view').forEach(v => v.classList.add('hidden'));

        // Highlight active button
        const btn = document.getElementById(`btn-ma-${aba}`);
        if (btn) btn.classList.add('active');
        // Show active view
        const view = document.getElementById(`ma-tab-${aba}`);
        if (view) view.classList.remove('hidden');

        const btnDiario = document.getElementById('btn-ma-diario');
        const btnMetas = document.getElementById('btn-ma-metas');
        const btnAuditoria = document.getElementById('btn-ma-auditoria');
        const btnFeedback = document.getElementById('btn-ma-feedback');

        if (aba === 'diario') {
            if (btnDiario) btnDiario.classList.add('active');
            if (MinhaArea.Geral) MinhaArea.Geral.carregar();
        } else if (aba === 'metas') {
            if (btnMetas) btnMetas.classList.add('active');
            if (MinhaArea.Metas) MinhaArea.Metas.carregar();
        } else if (aba === 'auditoria') {
            if (btnAuditoria) btnAuditoria.classList.add('active');
            if (MinhaArea.Auditoria) MinhaArea.Auditoria.carregar();
        } else if (aba === 'feedback') {
            if (btnFeedback) btnFeedback.classList.add('active');
            if (MinhaArea.Feedback) MinhaArea.Feedback.init();
        } else if (aba === 'relatorios') {
            const btnRel = document.getElementById('btn-ma-relatorios');
            if (btnRel) btnRel.classList.add('active');
            if (MinhaArea.Relatorios) MinhaArea.Relatorios.init();
        }
    },

    atualizarTudo: function () {
        this.atualizarListaAssistentes();
        const abaAtiva = document.querySelector('.tab-btn.active');
        if (abaAtiva) {
            // Refresh based on visibility
            if (!document.getElementById('ma-tab-diario').classList.contains('hidden')) {
                MinhaArea.Geral.carregar();
            } else if (!document.getElementById('ma-tab-metas').classList.contains('hidden')) {
                MinhaArea.Metas.carregar();
            } else if (!document.getElementById('ma-tab-relatorios').classList.contains('hidden')) {
                if (MinhaArea.Relatorios && MinhaArea.Relatorios.relatorioAtivo === 'metas_okr') {
                    MinhaArea.Relatorios.carregarMetasOKR();
                } else if (MinhaArea.Relatorios && MinhaArea.Relatorios.relatorioAtivo === 'gap') {
                    MinhaArea.Relatorios.carregarGAP();
                }
            }
        }
    },

    atualizarListaAssistentes: async function () {
        if (!this.isAdmin()) return;
        const select = document.getElementById('admin-user-selector');
        if (!select || select.options.length > 1) return;

        try {
            const { data, error } = await Sistema.supabase
                .from('usuarios')
                .select('id, nome, funcao, perfil, ativo')
                .order('nome');

            if (!error) {
                let options = `<option value="">👥 Geral (Todos)</option>`;
                options += `<option value="GRUPO_CLT">👥 Equipe CLT</option>`;
                options += `<option value="GRUPO_TERCEIROS">👥 Equipe Terceiros</option>`;
                options += `<option disabled>──────────────</option>`;

                const termosExcluidos = ['gestor', 'auditor', 'lider', 'líder', 'coordenador', 'coordena'];

                data.forEach(u => {
                    // [SYNC v4.41] Restore active filter but keep Roberta (Special Case)
                    const isActive = u.ativo === true || u.ativo === 1 || u.ativo === '1';
                    if (!isActive && String(u.id).trim() !== '432243') return;

                    const f = (u.funcao || '').toLowerCase();
                    const p = (u.perfil || '').toLowerCase();

                    // Checagem rigorosa para Admin para não bloquear "Assistente Administrativo"
                    const isAdmin = p === 'admin' || p === 'administrador' || f === 'admin' || f === 'administrador';
                    const ehLideranca = isAdmin || termosExcluidos.some(t => f.includes(t) || p.includes(t)) || u.id == 1 || u.id == 1000;

                    if (!ehLideranca) {
                        options += `<option value="${u.id}">${u.nome}</option>`;
                    }
                });
                select.innerHTML = options;

                // Se já estiver selecionado, mantém, senão default para Equipe (vazio)
                select.value = this.usuarioAlvoId || "";
            }
        } catch (e) { }
    },

    mudarUsuarioAlvo: function (novoId) {
        if (novoId === 'EQUIPE' || novoId === "") {
            this.usuarioAlvoId = null;
        } else if (novoId === 'GRUPO_CLT' || novoId === 'GRUPO_TERCEIROS') {
            this.usuarioAlvoId = novoId; // Salva como string
        } else {
            this.usuarioAlvoId = novoId ? parseInt(novoId) : null;
        }

        // [PERF] Se estamos na aba Meta/OKR e há cache disponível, só re-processa (sem API)
        const metasTabVisible = document.getElementById('ma-tab-metas') && !document.getElementById('ma-tab-metas').classList.contains('hidden');
        if (metasTabVisible && MinhaArea.Metas && MinhaArea.Metas.rawDataCache) {
            MinhaArea.Metas.reaplicarFiltros();
            // Atualiza o seletor de assistentes caso mude (sem re-fetch)
            this.atualizarListaAssistentes();
        } else {
            this.atualizarTudo();
        }
    },

    getUsuarioAlvo: function () { return this.usuarioAlvoId; }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { if (typeof MinhaArea !== 'undefined') MinhaArea.init(); }, 100);
});