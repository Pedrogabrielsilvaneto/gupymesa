/**
 * ARQUIVO: js/biblioteca/main.js
 * DESCRIÇÃO: Controlador da página Biblioteca (Frases, CEP e Calculadora)
 * DESIGN ATUALIZADO: 2026-03-13
 */

window.GupyBiblioteca = {
    supabaseFrases: null,
    cacheFrases: [],
    modoCalculadora: 'intervalo',
    usuario: null,
    cacheFavoritos: [],
    verFavoritos: false,

    init: async function () {
        try {
            if (window.Sistema) {
                this.usuario = Sistema.lerSessao();
            }

            if (!window.supabase) {
                console.error("Erro: Biblioteca Supabase não encontrada.");
                this.mostrarErroUI("Biblioteca Supabase (CDN) não foi carregada. Verifique sua conexão ou extensões do navegador.");
                return;
            }

            if (!this.supabaseFrases) {
                const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
                const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';
                this.supabaseFrases = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            }

            const btnNova = document.getElementById('btn-nova-frase');
            if (btnNova && this.isAdmin()) {
                btnNova.classList.remove('hidden');
            }

            this.carregarFavoritos();
            await this.carregarFrases();
            this.atualizarSugestoesModal();
            this.setupEventListeners();
        } catch (e) {
            console.error("Erro no init da biblioteca:", e);
            this.mostrarErroUI("Erro ao inicializar biblioteca: " + e.message);
        }
    },

    mostrarErroUI: function(msg) {
        const grid = document.getElementById('grid-frases');
        if (grid) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <i class="fas fa-exclamation-triangle text-amber-500 text-4xl mb-4"></i>
                    <h3 class="text-slate-800 font-black text-xl mb-2">Ops! Algo deu errado</h3>
                    <p class="text-slate-500 font-medium max-w-md mx-auto mb-6 px-4">${msg}</p>
                    <button onclick="location.reload()" class="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3 rounded-xl transition shadow-lg active:scale-95">
                        <i class="fas fa-sync-alt mr-2"></i> Tentar Novamente
                    </button>
                    <p class="mt-4 text-[10px] text-slate-400 uppercase tracking-widest">Dica: Se o problema persistir, tente usar o Google Chrome.</p>
                </div>
            `;
        }
    },

    setupEventListeners: function() {
        // CEP
        const inputCep = document.getElementById('lib-cep-input');
        if (inputCep) {
            inputCep.addEventListener('input', () => this.mascararCEP(inputCep));
            inputCep.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.buscarCEP(); });
        }

        // CID
        const inputCid = document.getElementById('lib-cid-input');
        if (inputCid) {
            inputCid.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.buscarCID(); });
        }

        // SIGLA
        const inputSigla = document.getElementById('lib-sigla-input');
        if (inputSigla) {
            inputSigla.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.buscarSigla(); });
        }

        // Calculadora
        const idsCalc = ['lib-calc-data-input', 'lib-calc-dias-input', 'lib-calc-meses-input', 'lib-calc-anos-input'];
        idsCalc.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === 'lib-calc-data-input') {
                el.addEventListener('input', () => {
                    this.mascararData(el);
                    if (el.value.length === 10) this.processarCalculadora();
                });
            } else {
                el.addEventListener('input', () => this.processarCalculadora());
            }
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.processarCalculadora();
            });
        });
    },

    isAdmin: function () {
        if (!this.usuario) return false;
        const p = (this.usuario.perfil || '').toUpperCase();
        const f = (this.usuario.funcao || '').toUpperCase();
        const id = parseInt(this.usuario.id);
        
        // Define gestora conforme solicitação do usuário
        const isGestora = p === 'ADMIN' || p === 'ADMINISTRADOR' || f.includes('GESTOR') || f.includes('COORDENADOR') || f.includes('LIDER');
        
        return isGestora || f.includes('AUDITOR') || f.includes('ASSISTENTE') || id === 1 || id === 1000;
    },

    isGestora: function () {
        if (!this.usuario) return false;
        const p = (this.usuario.perfil || '').toUpperCase();
        const f = (this.usuario.funcao || '').toUpperCase();
        const id = parseInt(this.usuario.id);
        return p === 'ADMIN' || p === 'ADMINISTRADOR' || f.includes('GESTOR') || f.includes('COORDENADOR') || f.includes('LIDER') || id === 1 || id === 1000;
    },

    podeApagar: function (frase) {
        if (!this.usuario) return false;
        if (this.isGestora()) return true;
        
        // Somente quem criou (comparando com revisado_por que armazena o ID de quem salvou)
        const criadorId = String(frase.revisado_por);
        const meuId = String(this.usuario.id);
        const meuNome = String(this.usuario.nome || '');
        
        return criadorId === meuId || criadorId === meuNome;
    },

    carregarFavoritos: function () {
        if (!this.usuario) return;
        const key = `gupy_favs_${this.usuario.id}`;
        try {
            const saved = localStorage.getItem(key);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    // Força todos a serem strings para evitar problemas de comparação
                    this.cacheFavoritos = parsed.map(id => String(id));
                } else {
                    this.cacheFavoritos = [];
                }
            } else {
                this.cacheFavoritos = [];
            }
        } catch (e) {
            console.error("Erro ao carregar favoritos:", e);
            this.cacheFavoritos = [];
        }
    },

    salvarFavoritos: function () {
        if (!this.usuario) return;
        const key = `gupy_favs_${this.usuario.id}`;
        // Limpar duplicatas e salvar somente strings
        const listaUnica = [...new Set(this.cacheFavoritos.map(id => String(id)))];
        localStorage.setItem(key, JSON.stringify(listaUnica));
        this.cacheFavoritos = listaUnica;
    },

    toggleFavorito: function (id) {
        if (!id) return;
        id = String(id);
        const index = this.cacheFavoritos.indexOf(id);
        
        if (index > -1) {
            this.cacheFavoritos.splice(index, 1);
        } else {
            this.cacheFavoritos.push(id);
        }
        
        this.salvarFavoritos();
        
        // Se estiver na aba de favoritos, re-aplica filtros para remover o card da tela
        // Se estiver em outra aba, apenas re-renderiza para atualizar o ícone do coração
        this.aplicarFiltros(false);
    },

    isFavorito: function (id) {
        if (!id) return false;
        return this.cacheFavoritos.includes(String(id));
    },

    toggleOpcoes: function () {
        const d = document.getElementById('dropdown-opcoes');
        if (!d) return;
        const isClosing = !d.classList.contains('hidden');
        d.classList.toggle('hidden');
        // Ao fechar o dropdown, reseta o submenu de filtros
        if (isClosing) {
            const sub = document.getElementById('submenu-filtros');
            const icon = document.getElementById('icon-filtros-chevron');
            if (sub) sub.classList.add('hidden');
            if (icon) icon.style.transform = '';
        }
    },

    toggleFiltrosDropdown: function () {
        const sub = document.getElementById('submenu-filtros');
        const icon = document.getElementById('icon-filtros-chevron');
        if (!sub) return;
        const isOpen = !sub.classList.contains('hidden');
        sub.classList.toggle('hidden');
        if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';
    },

    limparFiltros: function () {
        const selEmpresa = document.getElementById('lib-filtro-empresa');
        const selMotivo  = document.getElementById('lib-filtro-motivo');
        const selDoc     = document.getElementById('lib-filtro-doc');
        if (selEmpresa) selEmpresa.value = '';
        if (selMotivo)  selMotivo.value  = '';
        if (selDoc)     selDoc.value     = '';
        this.aplicarFiltros();
    },

    setAba: function (aba) {
        this.verFavoritos = (aba === 'favoritas');
        
        const btnTodas = document.getElementById('aba-todas');
        const btnFavs = document.getElementById('aba-favoritas');
        
        if (this.verFavoritos) {
            btnFavs.classList.add('active', 'bg-blue-50', 'text-blue-600');
            btnTodas.classList.remove('active', 'bg-blue-50', 'text-blue-600');
            btnTodas.classList.add('text-slate-500');
        } else {
            btnTodas.classList.add('active', 'bg-blue-50', 'text-blue-600');
            btnFavs.classList.remove('active', 'bg-blue-50', 'text-blue-600');
            btnFavs.classList.add('text-slate-500');
        }

        this.aplicarFiltros();
    },

    limparBusca: function () {
        const input = document.getElementById('lib-search');
        const input2 = document.getElementById('lib-search-2');
        if (input) input.value = "";
        if (input2) input2.value = "";

        // Limpar todos os filtros
        const selEmpresa = document.getElementById('lib-filtro-empresa');
        const selMotivo  = document.getElementById('lib-filtro-motivo');
        const selDoc     = document.getElementById('lib-filtro-doc');
        if (selEmpresa) selEmpresa.value = '';
        if (selMotivo)  selMotivo.value  = '';
        if (selDoc)     selDoc.value     = '';

        this.aplicarFiltros(true); // true = rolar ao topo
        if (input) input.focus();
    },

    carregarFrases: async function () {
        try {
            const grid = document.getElementById('grid-frases');
            if (grid) grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando biblioteca...</div>';

            if (!this.supabaseFrases) {
                throw new Error("Conexão com banco de frases não inicializada.");
            }

            const { data: frases, error } = await this.supabaseFrases
                .from('frases')
                .select('*');

            if (error) throw error;

            let meusUsosMap = {};
            if (this.usuario) {
                console.log("Buscando usos para usuário:", this.usuario.id);
                const { data: stats, error: errorStats } = await this.supabaseFrases
                    .from('view_usos_pessoais')
                    .select('frase_id, qtd_uso')
                    .eq('usuario', this.usuario.id);

                if (errorStats) {
                    console.warn("Erro ao buscar usos pessoais (pode ser ausência de dados):", errorStats);
                } else if (stats) {
                    stats.forEach(s => meusUsosMap[s.frase_id] = s.qtd_uso);
                }
            }

            this.cacheFrases = (frases || []).map(f => ({
                ...f,
                meus_usos: meusUsosMap[f.id] || 0,
                _busca: this.normalizar((f.conteudo || '') + (f.empresa || '') + (f.motivo || '') + (f.documento || ''))
            }));

            if (this.isAdmin()) {
                this.cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
            } else {
                this.cacheFrases.sort((a, b) => {
                    if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                    return (b.usos || 0) - (a.usos || 0);
                });
            }

            this.atualizarFiltrosSelects();
            this.aplicarFiltros();
        } catch (e) {
            console.error("Erro ao carregar frases:", e);
            this.mostrarErroUI("Houve um problema ao carregar as frases do banco de dados. " + (e.message || ""));
        }
    },

    atualizarFiltrosSelects: function() {
        const empresas = [...new Set(this.cacheFrases.map(f => f.empresa || 'Geral'))].sort();
        const motivos = [...new Set(this.cacheFrases.map(f => f.motivo || 'Outros'))].sort();
        const docs = [...new Set(this.cacheFrases.map(f => f.documento || 'Geral'))].sort();

        this.encherSelect('lib-filtro-empresa', empresas, 'Empresa');
        this.encherSelect('lib-filtro-motivo', motivos, 'Motivo');
        this.encherSelect('lib-filtro-doc', docs, 'Documento');
    },

    encherSelect: function(id, lista, label) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">Todas as ${label}s</option>` + 
            lista.map(v => `<option value="${v}">${v}</option>`).join('');
    },

    normalizar: function (t) {
        return (t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    },

    aplicarFiltros: function (scrollToTop, originIsSearch) {
        if (originIsSearch) {
            const elEmp = document.getElementById('lib-filtro-empresa');
            const elMot = document.getElementById('lib-filtro-motivo');
            const elDoc = document.getElementById('lib-filtro-doc');
            if (elEmp) elEmp.value = "";
            if (elMot) elMot.value = "";
            if (elDoc) elDoc.value = "";
        }
        const inputBusca = document.getElementById('lib-search');
        const inputBusca2 = document.getElementById('lib-search-2');
        const termo = this.normalizar(inputBusca?.value || '');
        const termo2 = this.normalizar(inputBusca2?.value || '');
        const valEmpresa = document.getElementById('lib-filtro-empresa')?.value || '';
        const valMotivo = document.getElementById('lib-filtro-motivo')?.value || '';
        const valDoc = document.getElementById('lib-filtro-doc')?.value || '';
        const btnLimpar = document.getElementById('btn-limpar-busca');
        const badgeFiltros = document.getElementById('badge-filtros');

        // Mostrar botão de limpar se tiver qualquer filtro ativo
        const temFiltroAtivo = termo || termo2 || valEmpresa || valMotivo || valDoc;
        if (temFiltroAtivo) btnLimpar?.classList.remove('hidden');
        else btnLimpar?.classList.add('hidden');

        // Badge "ON" no botão Filtros quando há filtro de select ativo
        const temFiltroSelect = valEmpresa || valMotivo || valDoc;
        if (badgeFiltros) {
            if (temFiltroSelect) badgeFiltros.classList.remove('hidden');
            else badgeFiltros.classList.add('hidden');
        }

        let filtrados = this.cacheFrases;

        if (this.verFavoritos) {
            filtrados = filtrados.filter(f => this.isFavorito(f.id));
        }

        if (!temFiltroAtivo && !this.verFavoritos) {
            filtrados = filtrados.slice(0, 4);
        } else {
            if (termo) filtrados = filtrados.filter(f => f._busca.includes(termo));
            if (termo2) filtrados = filtrados.filter(f => f._busca.includes(termo2));
            if (valEmpresa) filtrados = filtrados.filter(f => f.empresa === valEmpresa);
            if (valMotivo) filtrados = filtrados.filter(f => f.motivo === valMotivo);
            if (valDoc) filtrados = filtrados.filter(f => f.documento === valDoc);
        }

        this.renderizar(filtrados);

        // Só rola ao topo quando explicitamente solicitado (busca/limpar)
        if (scrollToTop) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    },

    filtrarPorDocumento: function (docName) {
        const selectDoc = document.getElementById('lib-filtro-doc');
        if (!selectDoc) return;

        // Se já for o mesmo, limpa
        if (selectDoc.value === docName) {
            selectDoc.value = "";
        } else {
            selectDoc.value = docName;
        }

        this.aplicarFiltros();
    },

    filtrarPorEmpresa: function (empName) {
        const sel = document.getElementById('lib-filtro-empresa');
        if (!sel) return;
        sel.value = (sel.value === empName) ? "" : empName;
        this.aplicarFiltros();
    },

    filtrarPorMotivo: function (motName) {
        const sel = document.getElementById('lib-filtro-motivo');
        if (!sel) return;
        sel.value = (sel.value === motName) ? "" : motName;
        this.aplicarFiltros();
    },

    renderizar: function (lista) {
        const grid = document.getElementById('grid-frases');
        if (!grid) return;

        if (!lista.length) {
            grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-bold bg-white rounded-xl border border-slate-100 italic">Nenhuma frase encontrada.</div>';
            return;
        }

        grid.innerHTML = lista.map(f => this.gerarCardHTML(f)).join('');
    },

    togglePainelFiltros: function () { /* legacy no-op */ },


    getDocColor: function (doc) {
        const d = (doc || '').toUpperCase();
        if (d.includes('CPF')) return { tag: 'bg-amber-100 text-amber-700 border-amber-200', card: 'border-l-amber-500', dot: 'text-amber-500' };
        if (d.includes('RG')) return { tag: 'bg-indigo-100 text-indigo-700 border-indigo-200', card: 'border-l-indigo-500', dot: 'text-indigo-500' };
        if (d.includes('CNH')) return { tag: 'bg-emerald-100 text-emerald-700 border-emerald-200', card: 'border-l-emerald-500', dot: 'text-emerald-500' };
        if (d.includes('CERTIDAO')) return { tag: 'bg-rose-100 text-rose-700 border-rose-200', card: 'border-l-rose-500', dot: 'text-rose-500' };
        if (d.includes('COMPROVANTE')) return { tag: 'bg-cyan-100 text-cyan-700 border-cyan-200', card: 'border-l-cyan-500', dot: 'text-cyan-500' };
        if (d.includes('TITULO')) return { tag: 'bg-lime-100 text-lime-700 border-lime-200', card: 'border-l-lime-500', dot: 'text-lime-500' };
        if (d.includes('PIS') || d.includes('PASEP')) return { tag: 'bg-orange-100 text-orange-700 border-orange-200', card: 'border-l-orange-500', dot: 'text-orange-500' };
        if (d.includes('GERAL')) return { tag: 'bg-slate-100 text-slate-700 border-slate-200', card: 'border-l-slate-500', dot: 'text-slate-500' };

        const colors = [
            { tag: 'bg-blue-100 text-blue-700 border-blue-200', card: 'border-l-blue-500', dot: 'text-blue-500' },
            { tag: 'bg-purple-100 text-purple-700 border-purple-200', card: 'border-l-purple-500', dot: 'text-purple-500' },
            { tag: 'bg-teal-100 text-teal-700 border-teal-200', card: 'border-l-teal-500', dot: 'text-teal-500' },
            { tag: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', card: 'border-l-fuchsia-500', dot: 'text-fuchsia-500' }
        ];
        let hash = 0;
        for (let i = 0; i < d.length; i++) hash = d.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    },

    getEmpresaColor: function (emp) {
        const e = (emp || 'GERAL').toUpperCase();
        if (e.includes('CLARO')) return 'bg-red-500 text-white border-red-600 hover:bg-red-600';
        if (e.includes('TIM')) return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700';
        if (e.includes('VIVO')) return 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700';
        if (e.includes('OI')) return 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600';
        if (e === 'GERAL') return 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700';

        const colors = [
            'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600',
            'bg-violet-500 text-white border-violet-600 hover:bg-violet-600',
            'bg-pink-500 text-white border-pink-600 hover:bg-pink-600',
            'bg-orange-500 text-white border-orange-600 hover:bg-orange-600',
            'bg-cyan-500 text-white border-cyan-600 hover:bg-cyan-600',
            'bg-fuchsia-500 text-white border-fuchsia-600 hover:bg-fuchsia-600'
        ];
        let hash = 0;
        for (let i = 0; i < e.length; i++) hash = e.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    },

    gerarCardHTML: function (f) {
        const isAdmin = this.isAdmin();
        const fav = this.isFavorito(f.id);
        const colors = this.getDocColor(f.documento);

        const textoContador = (f.meus_usos > 0 ? `${f.meus_usos} VEZES USADO POR MIM` : `${f.usos || 0} VEZES USADO PELA EQUIPE`);
        const iconeContador = (f.meus_usos > 0 ? "fa-user-check text-blue-500" : "fa-globe text-slate-400");

        const empColor = this.getEmpresaColor(f.empresa);
        const tagEmpresa = `<span onclick="GupyBiblioteca.filtrarPorEmpresa('${f.empresa || 'Geral'}')" title="Filtrar por esta empresa" class="${empColor} text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider cursor-pointer transition-colors shadow-sm">${f.empresa || 'Geral'}</span>`;
        const tagDoc = `<span onclick="GupyBiblioteca.filtrarPorDocumento('${f.documento || 'GERAL'}')" title="Filtrar por este documento" class="${colors.tag} text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide cursor-pointer hover:brightness-95 active:scale-95 transition-all">${f.documento || 'GERAL'}</span>`;

        const btnFav = `<button onclick="GupyBiblioteca.toggleFavorito('${f.id}')" class="transition-all active:scale-75 ${fav ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}"><i class="${fav ? 'fas' : 'far'} fa-heart"></i></button>`;

        return `
            <div id="card-frase-${f.id}" class="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 ${colors.card} hover:shadow-md transition-all duration-300 group overflow-hidden">
                <div class="px-5 pt-4 pb-2 flex justify-between items-start">
                    <div class="flex flex-col gap-1.5">
                        <div class="flex items-center gap-2">${tagEmpresa}</div>
                        ${tagDoc}
                    </div>
                    <div class="flex items-center gap-3">
                        ${btnFav}
                        <button onclick="GupyBiblioteca.copiarTexto('${f.id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"><i class="far fa-copy"></i> Copiar</button>
                        ${isAdmin ? `
                            <button onclick="GupyBiblioteca.prepararEdicao('${f.id}')" class="text-slate-300 hover:text-amber-500 p-1.5 transition" title="Editar"><i class="fas fa-pen text-sm"></i></button>
                            ${this.podeApagar(f) ? `<button onclick="GupyBiblioteca.deletar('${f.id}')" class="text-slate-300 hover:text-rose-500 p-1.5 transition" title="Excluir"><i class="fas fa-trash-alt text-sm"></i></button>` : ''}
                        ` : ''}
                    </div>
                </div>
                <div class="px-5 py-6 flex-grow">
                    <h4 onclick="GupyBiblioteca.filtrarPorMotivo('${f.motivo || 'Sem Motivo'}')" title="Filtrar por este motivo" class="font-black text-slate-800 text-lg leading-tight mb-4 cursor-pointer hover:text-blue-600 transition-colors inline-block border-b-2 border-transparent hover:border-blue-200">${f.motivo || 'Sem Motivo'}</h4>
                    <p class="text-[15px] text-slate-600 font-medium whitespace-pre-wrap leading-relaxed select-all">${f.conteudo}</p>
                </div>
                <div class="px-5 py-3 bg-slate-50/50 border-t border-slate-50">
                    <span class="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                        <i class="fas ${iconeContador}"></i> ${textoContador}
                    </span>
                </div>
            </div>`;
    },

    init: async function () {
        try {
            if (window.Sistema) {
                this.usuario = Sistema.lerSessao();
            }

            // [FIX] Agora usamos um Proxy para evitar bloqueios de Tracking Prevention no Edge/Chrome
            console.log("🚀 Biblioteca: Inicializando com modo Proxy Server-Side.");

            const btnNova = document.getElementById('btn-nova-frase');
            if (btnNova && this.isAdmin()) {
                btnNova.classList.remove('hidden');
            }

            this.carregarFavoritos();
            await this.carregarFrases();
            this.atualizarSugestoesModal();
            this.setupEventListeners();
        } catch (e) {
            console.error("Erro no init da biblioteca:", e);
            this.mostrarErroUI("Erro ao inicializar biblioteca: " + e.message);
        }
    },

    // [NEW] Helper para chamadas ao Proxy Server-Side
    callAPI: async function (action, table, payload) {
        try {
            const response = await fetch('/api/biblioteca', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    table,
                    ...payload
                })
            });
            return await response.json();
        } catch (e) {
            return { data: null, error: e };
        }
    },

    mostrarErroUI: function(msg) {
        const grid = document.getElementById('grid-frases');
        if (grid) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <i class="fas fa-exclamation-triangle text-amber-500 text-4xl mb-4"></i>
                    <h3 class="text-slate-800 font-black text-xl mb-2">Ops! Algo deu errado</h3>
                    <p class="text-slate-500 font-medium max-w-md mx-auto mb-6 px-4">${msg}</p>
                    <button onclick="location.reload()" class="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 py-3 rounded-xl transition shadow-lg active:scale-95">
                        <i class="fas fa-sync-alt mr-2"></i> Tentar Novamente
                    </button>
                    <p class="mt-4 text-[10px] text-slate-400 uppercase tracking-widest text-blue-400 font-bold">Modo de Segurança Ativado (Proxy Server-Side)</p>
                </div>
            `;
        }
    },

    carregarFrases: async function () {
        try {
            const grid = document.getElementById('grid-frases');
            if (grid) grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando biblioteca...</div>';

            // Busca frases via Proxy
            const { data: frases, error } = await this.callAPI('select', 'frases', { 
                queryParams: { select: '*' }
            });

            if (error) throw error;

            let meusUsosMap = {};
            if (this.usuario) {
                console.log("Buscando usos para usuário (Server Proxy):", this.usuario.id);
                const { data: stats, error: errorStats } = await this.callAPI('select', 'view_usos_pessoais', {
                    queryParams: { select: '*', usuario: `eq.${this.usuario.id}` }
                });

                if (errorStats) {
                    console.warn("Erro ao buscar usos pessoais:", errorStats);
                } else if (stats) {
                    stats.forEach(s => meusUsosMap[s.frase_id] = s.qtd_uso);
                }
            }

            this.cacheFrases = (frases || []).map(f => ({
                ...f,
                meus_usos: meusUsosMap[f.id] || 0,
                _busca: this.normalizar((f.conteudo || '') + (f.empresa || '') + (f.motivo || '') + (f.documento || ''))
            }));

            if (this.isAdmin()) {
                this.cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
            } else {
                this.cacheFrases.sort((a, b) => {
                    if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                    return (b.usos || 0) - (a.usos || 0);
                });
            }

            this.atualizarFiltrosSelects();
            this.aplicarFiltros();
        } catch (e) {
            console.error("Erro ao carregar frases:", e);
            this.mostrarErroUI("Houve um problema ao carregar as frases. Certifique-se de estar logado. Detalhes: " + (e.message || ""));
        }
    },

    copiarTexto: async function (id) {
        const f = this.cacheFrases.find(i => i.id == id);
        if (!f) return;

        navigator.clipboard.writeText(f.conteudo).then(async () => {
            if (window.Swal) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Copiado!',
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true
                });
            }
            await this.registrarLog('COPIAR', String(id));
            f.usos = (f.usos || 0) + 1;
            f.meus_usos = (f.meus_usos || 0) + 1;
            // Atualiza sem rolar ao topo
            this.aplicarFiltros(false);
        });
    },

    registrarLog: async function (acao, desc) {
        try {
            if (!this.usuario) return;
            await this.callAPI('insert', 'logs', {
                data: {
                    usuario: this.usuario.id,
                    acao: acao,
                    descricao: desc,
                    perfil: this.isAdmin() ? 'admin' : 'user'
                }
            });
        } catch (e) { }
    },

    prepararEdicao: function (id) {
        const modal = document.getElementById('modal-lib-frase');
        const titulo = document.getElementById('lib-modal-titulo');
        const form = document.getElementById('lib-form-frase');

        if (!id) {
            titulo.innerHTML = 'Criar Nova Frase';
            form.reset();
            document.getElementById('lib-form-id').value = "";
        } else {
            const f = this.cacheFrases.find(i => i.id == id);
            if (!f) return;
            titulo.innerHTML = 'Editar Frase';
            document.getElementById('lib-form-id').value = f.id;
            document.getElementById('lib-form-conteudo').value = f.conteudo;
            document.getElementById('lib-form-empresa').value = f.empresa || "";
            document.getElementById('lib-form-doc').value = f.documento || "";
            document.getElementById('lib-form-motivo').value = f.motivo || "";
        }
        modal.classList.remove('hidden');
    },

    salvarFrase: async function () {
        const id = document.getElementById('lib-form-id').value;
        const conteudo = document.getElementById('lib-form-conteudo').value.trim();
        const empresa = document.getElementById('lib-form-empresa').value.trim();
        const doc = document.getElementById('lib-form-doc').value.trim();
        const motivo = document.getElementById('lib-form-motivo').value.trim();

        if (!conteudo) return;

        try {
            const payload = { 
                conteudo, 
                empresa, 
                documento: doc, 
                motivo,
                revisado_por: this.usuario ? this.usuario.id : null,
                data_revisao: new Date().toISOString()
            };
            
            let res;
            if (id) {
                res = await this.callAPI('update', 'frases', { id, data: payload });
            } else {
                res = await this.callAPI('insert', 'frases', { data: [payload] });
            }

            if (res.error) throw res.error;

            document.getElementById('modal-lib-frase').classList.add('hidden');
            await this.carregarFrases();
            Swal.fire({ icon: 'success', title: 'Sucesso!', timer: 1500, showConfirmButton: false });
        } catch (e) {
            Swal.fire('Erro ao salvar', e.message, 'error');
        }
    },

    deletar: async function (id) {
        const frase = this.cacheFrases.find(f => f.id == id);
        if (!frase) return;

        const confirm = await Swal.fire({
            title: 'Excluir esta frase?',
            html: `
                <div class="text-left mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div class="text-[10px] font-black uppercase text-slate-400 mb-2">${frase.empresa || 'GERAL'} - ${frase.documento || 'GERAL'}</div>
                    <div class="font-bold text-slate-800 mb-2">${frase.motivo || 'Sem Motivo'}</div>
                    <div class="text-sm text-slate-600 whitespace-pre-wrap">${frase.conteudo}</div>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i> Sim, excluir',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'rounded-xl font-bold',
                cancelButton: 'rounded-xl font-bold'
            }
        });

        if (confirm.isConfirmed) {
            try {
                // Remove via Proxy
                const { error } = await this.callAPI('delete', 'frases', { id });
                if (error) throw error;

                // Remove do cache e atualiza tela
                this.cacheFrases = this.cacheFrases.filter(f => f.id != id);
                this.aplicarFiltros();

                // Mostra toast com opção de restaurar
                Swal.fire({
                    title: 'Frase excluída!',
                    html: `A frase foi removida com sucesso.`,
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-undo mr-2"></i> Restaurar',
                    confirmButtonColor: '#2563eb',
                    showConfirmButton: true,
                    cancelButtonText: 'Ok',
                    timer: 5000,
                    timerProgressBar: true,
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        try {
                            const { id: oldId, _busca, meus_usos, ...dadosOriginais } = frase;
                            const resRestore = await this.callAPI('insert', 'frases', { data: [dadosOriginais] });
                            if (resRestore.error) throw resRestore.error;

                            await this.carregarFrases();
                            Swal.fire({ icon: 'success', title: 'Restaurada!', timer: 1500, showConfirmButton: false });
                        } catch (erestore) {
                            Swal.fire('Erro ao restaurar', erestore.message, 'error');
                        }
                    }
                });

            } catch (e) {
                Swal.fire('Erro ao excluir', e.message, 'error');
            }
        }
    },

    buscarCEP: async function () {
        const input = document.getElementById('lib-cep-input');
        const cep = input.value.replace(/\D/g, '');
        if (cep.length !== 8) return;
        const resBox = document.getElementById('lib-cep-resultado');

        try {
            let data = null;
            // Robust fallback logic
            const r1 = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            if (r1.ok) {
                const res = await r1.json();
                if (!res.erro) data = res;
            }
            if (!data) {
                const r2 = await fetch(`https://opencep.com/v1/${cep}`);
                if (r2.ok) {
                    const res = await r2.json();
                    if (!res.erro) data = res;
                }
            }

            if (!data) throw new Error();

            document.getElementById('lib-cep-logradouro').innerText = data.logradouro || '-';
            document.getElementById('lib-cep-bairro').innerText = data.bairro || '-';
            document.getElementById('lib-cep-localidade').innerText = (data.localidade && data.uf) ? `${data.localidade} - ${data.uf}` : (data.localidade || '-');
            document.getElementById('lib-cep-display-num').innerText = cep;
            resBox.classList.remove('hidden');
        } catch (e) {
            Swal.fire('Erro', 'CEP não encontrado', 'warning');
        }
    },

    buscarCID: async function () {
        const input = document.getElementById('lib-cid-input');
        let query = input.value.trim().toUpperCase();
        if (query.length < 2) return;
        const resBox = document.getElementById('lib-cid-resultado');
        const descEl = document.getElementById('lib-cid-descricao');
        const codeEl = document.getElementById('lib-cid-display-code');

        try {
            // Tenta primeiro CID-11 (como solicitado pelo usuário que não estava funcionando)
            let r = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd11_codes/v3/search?terms=${encodeURIComponent(query)}&max=1`);
            let data = await r.json();
            let version = "CID-11";

            // Se não encontrou no CID-11, tenta no CID-10 (CM)
            if (!data || !data[3] || data[3].length === 0) {
                r = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?terms=${encodeURIComponent(query)}&max=1`);
                data = await r.json();
                version = "CID-10";
            }

            if (data && data[3] && data[3].length > 0) {
                let code = data[3][0][0];
                let desc = data[3][0][1];

                // Remove possíveis tags HTML ou parênteses do código que às vezes vêm do NIH
                code = String(code).split(' ')[0].replace(/[\(\)]/g, '');

                // Lógica de tradução para Português (O NIH retorna em Inglês)
                try {
                    const rTrad = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(desc)}&langpair=en|pt-BR`);
                    const dataTrad = await rTrad.json();
                    if (dataTrad?.responseData?.translatedText) {
                        desc = dataTrad.responseData.translatedText;
                    }
                } catch(t) { console.warn("Erro ao traduzir CID:", t); }

                if (codeEl) codeEl.innerText = `${version}: ${code}`;
                if (descEl) descEl.innerText = desc;
                if (resBox) resBox.classList.remove('hidden');
            } else {
                Swal.fire('Não encontrado', 'CID não localizado nem em CID-11 nem em CID-10. Tente termos genéricos ou códigos específicos.', 'info');
            }
        } catch (e) {
            console.error("Erro na busca CID:", e);
            Swal.fire('Erro', 'Houve um problema ao consultar as bases oficiais.', 'error');
        }
    },

    CommonSiglas: {
        'SSP': 'Secretaria de Segurança Pública', 'Detran': 'Departamento Estadual de Trânsito', 'DETRAN': 'Departamento Estadual de Trânsito', 
        'PF': 'Polícia Federal', 'DPF': 'Departamento de Polícia Federal', 'OAB': 'Ordem dos Advogados do Brasil', 
        'CRM': 'Conselho Regional de Medicina', 'CREA': 'Conselho Regional de Engenharia e Agronomia', 
        'MTE': 'Ministério do Trabalho e Emprego', 'MTB': 'Ministério do Trabalho', 'CNH': 'Carteira Nacional de Habilitação',
        'PC': 'Polícia Civil', 'PM': 'Polícia Militar', 'PTC': 'Polícia Técnico-Científica', 'SPTC': 'Secretaria de Polícia Técnico-Científica',
        'DIC': 'Diretoria de Identificação Civil', 'IFP': 'Instituto Félix Pacheco', 'IPF': 'Instituto Pereira Faustino',
        'II': 'Instituto de Identificação', 'IIRGD': 'Instituto de Identificação Ricardo Gumbleton Daunt',
        'ITEP': 'Instituto Técnico-Científico de Perícia', 'IGP': 'Instituto-Geral de Perícias', 'SESP': 'Secretaria de Estado de Segurança Pública',
        'SSPDS': 'Secretaria da Segurança Pública e Defesa Social', 'SDS': 'Secretaria de Defesa Social',
        'SEJUSP': 'Secretaria de Estado de Justiça e Segurança Pública', 'SEGUP': 'Secretaria de Estado de Segurança Pública e Defesa Social',
        'SJTC': 'Secretaria da Justiça, do Trabalho e da Cidadania', 'SJS': 'Secretaria da Justiça e da Segurança',
        'MAER': 'Ministério da Aeronáutica', 'MEX': 'Ministério do Exército', 'MINDEF': 'Ministério da Defesa',
        'MM': 'Ministério da Marinha', 'POM': 'Polícia Militar', 'POF': 'Polícia Federal', 'MJ': 'Ministério da Justiça',
        'CRECI': 'Conselho Regional de Corretores de Imóveis', 'COREN': 'Conselho Regional de Enfermagem',
        'CRA': 'Conselho Regional de Administração', 'CRAS': 'Centro de Referência de Assistência Social',
        'CRB': 'Conselho Regional de Biblioteconomia', 'CRC': 'Conselho Regional de Contabilidade',
        'CRE': 'Conselho Regional de Economia', 'CREF': 'Conselho Regional de Educação Física',
        'CREFITO': 'Conselho Regional de Fisioterapia e Terapia Ocupacional', 'CRMV': 'Conselho Regional de Medicina Veterinária',
        'CRO': 'Conselho Regional de Odontologia', 'CRP': 'Conselho Regional de Psicologia',
        'CRQ': 'Conselho Regional de Química', 'CRT': 'Conselho Regional dos Técnicos Industriais',
        'CRV': 'Conselho Regional de Medicina Veterinária', 'SNJ': 'Secretaria Nacional de Justiça',
        'SECC': 'Secretaria de Estado da Casa Civil', 'SRTE': 'Superintendência Regional do Trabalho e Emprego',
        'CEEE': 'Companhia Estadual de Energia Elétrica', 'DPU': 'Defensoria Pública da União',
        'DPE': 'Defensoria Pública do Estado', 'PGE': 'Procuradoria-Geral do Estado',
        'PGJ': 'Procuradoria-Geral de Justiça', 'TRE': 'Tribunal Regional Eleitoral',
        'TRF': 'Tribunal Regional Federal', 'TRT': 'Tribunal Regional do Trabalho',
        'TSE': 'Tribunal Superior Eleitoral', 'TST': 'Tribunal Superior do Trabalho',
        'STF': 'Supremo Tribunal Federal', 'STJ': 'Superior Tribunal de Justiça',
        'CNIG': 'Conselho Nacional de Imigração', 'CGPI': 'Coordenação Geral de Privilégios e Imunidades',
        'CGPMAF': 'Coordenação Geral de Polícia de Imigração', 'CGPI/DAP': 'Coordenação Geral de Privilégios e Imunidades',
        'CBM': 'Corpo de Bombeiros Militar', 'CFM': 'Conselho Federal de Medicina',
        'CME': 'Conselho Ministerial de Educação', 'CNEN': 'Comissão Nacional de Energia Nuclear',
        'CNP': 'Conselho Nacional de Petróleo', 'CONRE': 'Conselho Regional de Estatística',
        'CORECON': 'Conselho Regional de Economia', 'COREMP': 'Conselho Regional de Enfermagem e Obstetrícia'
    },

    buscarSigla: function () {
        const input = document.getElementById('lib-sigla-input');
        const query = input.value.trim().toUpperCase();
        const resBox = document.getElementById('lib-sigla-resultado');
        
        const desc = this.CommonSiglas[query];
        if (desc) {
            document.getElementById('lib-sigla-display-code').innerText = query;
            document.getElementById('lib-sigla-descricao').innerText = desc;
            resBox.classList.remove('hidden');
        } else {
            Swal.fire('Não encontrada', 'Sigla não localizada', 'info');
        }
    },

    abrirCalculadora: function () { document.getElementById('modal-lib-calculadora').classList.remove('hidden'); },
    fecharCalculadora: function () { document.getElementById('modal-lib-calculadora').classList.add('hidden'); },
    
    toggleCalcOperation: function() {
        const btn = document.getElementById('lib-calc-operation-btn');
        const val = document.getElementById('lib-calc-operation-val');
        if (!btn || !val) return;
        
        if (val.value === 'somar') {
            val.value = 'subtrair';
            btn.innerText = '-';
            btn.classList.add('text-rose-600');
            btn.classList.remove('text-blue-600');
        } else {
            val.value = 'somar';
            btn.innerText = '+';
            btn.classList.add('text-blue-600');
            btn.classList.remove('text-rose-600');
        }
        
        // Auto-calcular ao alternar sinal
        const valData = document.getElementById('lib-calc-data-input')?.value;
        if (valData && valData.length === 10) {
            this.processarCalculadora();
        }
    },

    mudarModoCalculadora: function (modo) {
        this.modoCalculadora = modo;
        const btnInt = document.getElementById('lib-calc-btn-intervalo');
        const btnSom = document.getElementById('lib-calc-btn-soma');
        const contSoma = document.getElementById('lib-calc-container-soma');
        const labelInput = document.getElementById('lib-calc-label-input');
        const iconInput = document.getElementById('lib-calc-icon-input');
        const resBox = document.getElementById('lib-calc-resultados');
        
        // Esconder resultados ao mudar de modo
        if (resBox) resBox.classList.add('hidden');

        if (modo === 'intervalo') {
            btnInt.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            btnInt.classList.remove('text-slate-500');
            btnSom.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
            btnSom.classList.add('text-slate-500');
            if (contSoma) contSoma.classList.add('hidden');
            if (labelInput) labelInput.innerText = 'Data Inicial / Nascimento';
            if (iconInput) {
                iconInput.className = 'far fa-calendar-alt absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors text-lg';
            }
        } else {
            btnSom.classList.add('bg-white', 'text-blue-600', 'shadow-sm');
            btnSom.classList.remove('text-slate-500');
            btnInt.classList.remove('bg-white', 'text-blue-600', 'shadow-sm');
            btnInt.classList.add('text-slate-500');
            if (contSoma) contSoma.classList.remove('hidden');
            if (labelInput) labelInput.innerText = 'Data de Referência';
            if (iconInput) {
                iconInput.className = 'fas fa-calendar-day absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors text-lg';
            }
        }
    },

    processarCalculadora: function () {
        const valData = document.getElementById('lib-calc-data-input').value;
        if (valData.length !== 10) return;
        const parts = valData.split('/');
        const dataBase = new Date(parts[2], parts[1] - 1, parts[0]);
        if (isNaN(dataBase.getTime())) return;

        const resBox = document.getElementById('lib-calc-resultados');
        const displayPrincipal = document.getElementById('lib-res-principal');
        const displayDataInserida = document.getElementById('lib-res-data-inserida');
        const labelPrimaria = document.getElementById('lib-res-label-primaria');
        const labelSecundaria = document.getElementById('lib-res-label-secundaria');
        const unidadePrincipal = document.getElementById('lib-res-unidade');
        
        const gridDetalhado = document.getElementById('lib-calc-grid-detalhado');
        const dividerDetalhado = document.getElementById('lib-calc-divider');

        if (this.modoCalculadora === 'intervalo') {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            dataBase.setHours(0, 0, 0, 0);

            const diffTime = Math.abs(hoje - dataBase);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            displayPrincipal.innerText = diffDays.toLocaleString('pt-BR');
            displayDataInserida.innerText = valData;
            labelPrimaria.innerText = 'Total Dias Corridos';
            labelSecundaria.innerText = 'Data Inserida';
            unidadePrincipal.innerText = 'dias';

            // Cálculo detalhado
            let d1 = dataBase < hoje ? dataBase : hoje;
            let d2 = dataBase < hoje ? hoje : dataBase;

            let anos = d2.getFullYear() - d1.getFullYear();
            let meses = d2.getMonth() - d1.getMonth();
            let dias = d2.getDate() - d1.getDate();

            if (dias < 0) {
                meses--;
                const ultimoDiaMesAnterior = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate();
                dias += ultimoDiaMesAnterior;
            }
            if (meses < 0) {
                anos--;
                meses += 12;
            }

            const semanas = Math.floor(dias / 7);
            const diasRestantes = dias % 7;

            document.getElementById('lib-res-anos').innerText = anos;
            document.getElementById('lib-res-meses').innerText = meses;
            document.getElementById('lib-res-semanas').innerText = semanas;
            document.getElementById('lib-res-dias').innerText = diasRestantes;

            if (gridDetalhado) gridDetalhado.classList.remove('hidden');
            if (dividerDetalhado) dividerDetalhado.classList.remove('hidden');
            resBox.classList.remove('hidden');
        } else {
            // Modo Soma/Subtração
            const op = document.getElementById('lib-calc-operation-val').value;
            const anos = parseInt(document.getElementById('lib-calc-anos-input').value) || 0;
            const meses = parseInt(document.getElementById('lib-calc-meses-input').value) || 0;
            const dias = parseInt(document.getElementById('lib-calc-dias-input').value) || 0;
            
            const mult = op === 'somar' ? 1 : -1;
            
            const dataResult = new Date(dataBase);
            dataResult.setFullYear(dataResult.getFullYear() + (anos * mult));
            dataResult.setMonth(dataResult.getMonth() + (meses * mult));
            dataResult.setDate(dataResult.getDate() + (dias * mult));
            
            const diaStr = String(dataResult.getDate()).padStart(2, '0');
            const mesStr = String(dataResult.getMonth() + 1).padStart(2, '0');
            const anoStr = dataResult.getFullYear();
            const dataFormatada = `${diaStr}/${mesStr}/${anoStr}`;

            displayPrincipal.innerText = dataFormatada;
            displayDataInserida.innerText = valData;
            labelPrimaria.innerText = 'Data Resultante';
            labelSecundaria.innerText = 'Data Referência';
            unidadePrincipal.innerText = '';
            
            if (gridDetalhado) gridDetalhado.classList.add('hidden');
            if (dividerDetalhado) dividerDetalhado.classList.add('hidden');
            resBox.classList.remove('hidden');
        }
    },

    mascararData: function (input) {
        let v = input.value.replace(/\D/g, '').slice(0, 8);
        if (v.length >= 5) input.value = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
        else if (v.length >= 3) input.value = `${v.slice(0, 2)}/${v.slice(2)}`;
        else input.value = v;
    },

    copiarTextoSimples: function (texto) {
        if (!texto || texto === '-') return;
        navigator.clipboard.writeText(texto).then(() => {
            if (window.Swal) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Copiado!',
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true
                });
            }
        });
    },

    mascararCEP: function (input) {
        let v = input.value.replace(/\D/g, '').slice(0, 8);
        if (v.length >= 6) input.value = `${v.slice(0, 5)}-${v.slice(5)}`;
        else input.value = v;
    },

    atualizarSugestoesModal: function() {}
};
