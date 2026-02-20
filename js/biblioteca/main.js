/**
 * ARQUIVO: js/biblioteca/main.js
 * DESCRIÇÃO: Controlador da página Biblioteca (Frases, CEP e Calculadora)
 * INTEGRADO DE: App-Frases/gupy
 */

window.GupyBiblioteca = {
    supabaseFrases: null,
    cacheFrases: [],
    modoCalculadora: 'intervalo',
    usuario: null,
    cacheFavoritos: [],
    verFavoritos: false,

    init: async function () {
        // Inicializa usuário da sessão do Sistema
        if (window.Sistema) {
            this.usuario = Sistema.lerSessao();
        }

        if (!this.supabaseFrases) {
            const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';
            this.supabaseFrases = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        // Mostrar botão Nova Frase se for Admin
        const btnNova = document.getElementById('btn-nova-frase');
        if (btnNova && this.isAdmin()) {
            btnNova.classList.remove('hidden');
        }

        this.carregarFavoritos();
        await this.carregarFrases();
        this.atualizarSugestoesModal();
    },

    isAdmin: function () {
        if (!this.usuario) return false;
        const p = (this.usuario.perfil || '').toUpperCase();
        const f = (this.usuario.funcao || '').toUpperCase();
        const id = parseInt(this.usuario.id);
        return p === 'ADMIN' || p === 'ADMINISTRADOR' || f.includes('GESTOR') || f.includes('AUDITOR') || f.includes('COORDENADOR') || f.includes('LIDER') || id === 1 || id === 1000;
    },

    carregarFavoritos: function () {
        if (!this.usuario) return;
        const key = `gupy_favs_${this.usuario.id}`;
        try {
            const saved = localStorage.getItem(key);
            this.cacheFavoritos = saved ? JSON.parse(saved) : [];
        } catch (e) {
            this.cacheFavoritos = [];
        }
    },

    salvarFavoritos: function () {
        if (!this.usuario) return;
        const key = `gupy_favs_${this.usuario.id}`;
        localStorage.setItem(key, JSON.stringify(this.cacheFavoritos));
    },

    toggleFavorito: function (id) {
        id = id.toString();
        const index = this.cacheFavoritos.indexOf(id);
        if (index > -1) {
            this.cacheFavoritos.splice(index, 1);
        } else {
            this.cacheFavoritos.push(id);
        }
        this.salvarFavoritos();

        // Renderiza tudo para refletir o novo estado
        this.aplicarFiltros();
    },

    isFavorito: function (id) {
        return this.cacheFavoritos.includes(id.toString());
    },

    toggleVerFavoritos: function () {
        this.verFavoritos = !this.verFavoritos;
        const btn = document.getElementById('btn-ver-favoritos');
        if (btn) {
            if (this.verFavoritos) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        this.aplicarFiltros();
    },

    carregarFrases: async function () {
        try {
            const grid = document.getElementById('grid-frases');
            if (grid) grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Carregando biblioteca...</div>';

            const { data: frases, error } = await this.supabaseFrases
                .from('frases')
                .select('*');

            if (error) throw error;

            // Busca usos pessoais se o usuário estiver logado no GupyMesa
            let meusUsosMap = {};
            if (this.usuario) {
                const { data: stats } = await this.supabaseFrases
                    .from('view_usos_pessoais')
                    .select('frase_id, qtd_uso')
                    .eq('usuario', this.usuario.id);

                if (stats) {
                    stats.forEach(s => meusUsosMap[s.frase_id] = s.qtd_uso);
                }
            }

            this.cacheFrases = (frases || []).map(f => ({
                ...f,
                meus_usos: meusUsosMap[f.id] || 0,
                _busca: this.normalizar(f.conteudo + (f.empresa || '') + (f.motivo || '') + (f.documento || ''))
            }));

            // Ordenação: Admin vê global, Colaborador vê pessoal
            if (this.isAdmin()) {
                this.cacheFrases.sort((a, b) => (b.usos || 0) - (a.usos || 0));
            } else {
                this.cacheFrases.sort((a, b) => {
                    if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                    return (b.usos || 0) - (a.usos || 0);
                });
            }

            this.aplicarFiltros();
        } catch (e) {
            console.error("Erro ao carregar frases:", e);
        }
    },

    normalizar: function (t) {
        return (t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    },

    aplicarFiltros: function () {
        const termo = this.normalizar(document.getElementById('lib-search')?.value || '');
        const valEmpresa = document.getElementById('lib-filtro-empresa')?.value || '';
        const valMotivo = document.getElementById('lib-filtro-motivo')?.value || '';
        const valDoc = document.getElementById('lib-filtro-doc')?.value || '';

        let filtrados = this.cacheFrases;

        if (this.verFavoritos) {
            filtrados = filtrados.filter(f => this.isFavorito(f.id));
        }

        if (termo) filtrados = filtrados.filter(f => f._busca.includes(termo));
        if (valEmpresa) filtrados = filtrados.filter(f => f.empresa === valEmpresa);
        if (valMotivo) filtrados = filtrados.filter(f => f.motivo === valMotivo);
        if (valDoc) filtrados = filtrados.filter(f => f.documento === valDoc);

        this.renderizar(filtrados);
    },

    renderizar: function (lista) {
        this.renderizarFavoritos();

        const grid = document.getElementById('grid-frases');
        if (!grid) return;

        if (!lista.length) {
            grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-bold bg-white rounded-xl border border-slate-100 italic">Nenhuma frase encontrada para os filtros aplicados.</div>';
            return;
        }

        grid.innerHTML = lista.map(f => this.gerarCardHTML(f)).join('');
    },

    renderizarFavoritos: function () {
        const container = document.getElementById('container-favoritos');
        const grid = document.getElementById('grid-favoritos');
        if (!container || !grid) return;

        const favoritos = this.cacheFrases.filter(f => this.isFavorito(f.id));

        if (favoritos.length > 0 && !document.getElementById('lib-search').value && !this.verFavoritos) {
            container.classList.remove('hidden');
            grid.innerHTML = favoritos.map(f => this.gerarCardHTML(f)).join('');
        } else {
            container.classList.add('hidden');
        }
    },

    togglePainelFiltros: function () {
        const p = document.getElementById('painel-filtros');
        if (p) p.classList.toggle('hidden');
    },

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

        // Hashing for unknown docs
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

    gerarCardHTML: function (f) {
        const isAdmin = this.isAdmin();
        const fav = this.isFavorito(f.id);
        const colors = this.getDocColor(f.documento);

        const textoContador = isAdmin
            ? `${f.usos || 0} usos na equipe`
            : (f.meus_usos > 0 ? `${f.meus_usos} vezes usado por mim` : `${f.usos || 0} usos na equipe`);
        const iconeContador = isAdmin ? "fa-chart-line text-blue-600" : (f.meus_usos > 0 ? "fa-user-check text-blue-500" : "fa-globe text-slate-400");

        const tagEmpresa = `<span onclick="GupyBiblioteca.setarFiltroDireto('empresa', '${f.empresa || 'Geral'}')" class="cursor-pointer hover:brightness-95 transition bg-white text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-100">${f.empresa || 'Geral'}</span>`;
        const tagDoc = `<span onclick="GupyBiblioteca.setarFiltroDireto('doc', '${f.documento || 'DOC'}')" class="cursor-pointer hover:brightness-95 transition ${colors.tag} text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-sm border uppercase tracking-wide transition-all">${f.documento || 'DOC'}</span>`;

        const btnFav = `<button onclick="GupyBiblioteca.toggleFavorito('${f.id}')" class="transition-all active:scale-75 ${fav ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}" title="${fav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}"><i class="${fav ? 'fas' : 'far'} fa-heart"></i></button>`;

        return `
            <div id="card-frase-${f.id}" class="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 border-l-4 ${colors.card} hover:shadow-md transition-all duration-300 group overflow-hidden">
                <div class="px-5 pt-4 pb-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                    <div class="flex-1 pr-3">
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                            ${tagEmpresa}
                            ${tagDoc}
                        </div>
                        <h4 class="font-black text-slate-800 text-sm leading-tight flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full ${colors.dot}"></span>
                            ${f.motivo || 'Motivo'}
                        </h4>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        ${btnFav}
                        <div class="w-px h-4 bg-slate-200 mx-1"></div>
                        <button onclick="GupyBiblioteca.copiarTexto('${f.id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5"><i class="far fa-copy"></i> Copiar</button>
                        ${isAdmin ? `
                            <button onclick="GupyBiblioteca.prepararEdicao('${f.id}')" class="bg-white border border-slate-200 text-slate-400 hover:text-amber-500 px-2 py-1.5 rounded-lg transition shadow-sm" title="Editar"><i class="fas fa-pen"></i></button>
                            <button onclick="GupyBiblioteca.deletar('${f.id}')" class="bg-white border border-slate-200 text-slate-400 hover:text-rose-500 px-2 py-1.5 rounded-lg transition shadow-sm" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                        ` : ''}
                    </div>
                </div>
                <div class="px-5 py-5 flex-grow"><p class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed select-all">${f.conteudo}</p></div>
                <div class="px-5 py-2.5 bg-slate-50 border-t border-slate-100">
                    <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        <i class="fas ${iconeContador}"></i> ${textoContador}
                    </span>
                </div>
            </div>`;
    },

    setarFiltroDireto: function (tipo, valor) {
        let el;
        if (tipo === 'empresa') el = document.getElementById('lib-filtro-empresa');
        if (tipo === 'doc') el = document.getElementById('lib-filtro-doc');

        if (el) {
            // Lógica de Toggle: Se clicar no mesmo valor, limpa
            if (el.value === valor) {
                el.value = "";
            } else {
                el.value = valor;
            }

            this.aplicarFiltros();

            // Scroll para os resultados
            const grid = document.getElementById('grid-frases');
            if (grid) window.scrollTo({ top: grid.offsetTop - 150, behavior: 'smooth' });
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

            // Registrar Log no banco de frases
            const hoje = new Date().toISOString().split('T')[0];
            const ultimoRegistro = localStorage.getItem('gupy_ultimo_login_diario');

            if (ultimoRegistro !== hoje) {
                await this.registrarLog('LOGIN', 'Acesso Diário (Via GupyMesa Standalone)');
                localStorage.setItem('gupy_ultimo_login_diario', hoje);
            }

            await this.registrarLog('COPIAR', String(id));

            // Atualização visual otimista
            f.usos = (f.usos || 0) + 1;
            f.meus_usos = (f.meus_usos || 0) + 1;
            this.renderizar(this.cacheFrases);
        });
    },

    registrarLog: async function (acao, desc) {
        try {
            if (!this.usuario) return;
            await this.supabaseFrases.from('logs').insert([{
                usuario: this.usuario.id,
                acao: acao,
                descricao: desc,
                perfil: this.isAdmin() ? 'admin' : 'user'
            }]);
        } catch (e) { }
    },

    prepararEdicao: function (id) {
        const modal = document.getElementById('modal-lib-frase');
        const titulo = document.getElementById('lib-modal-titulo');
        const form = document.getElementById('lib-form-frase');

        if (!id) {
            // Modo Novo
            titulo.innerHTML = '<i class="fas fa-plus text-blue-600"></i> Criar Nova Frase';
            form.reset();
            document.getElementById('lib-form-id').value = "";
        } else {
            // Modo Edição
            const f = this.cacheFrases.find(i => i.id == id);
            if (!f) return;

            titulo.innerHTML = '<i class="fas fa-edit text-blue-600"></i> Editar Frase';
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
            const loading = Swal.fire({ title: 'Salvando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            const payload = {
                conteudo,
                empresa,
                documento: doc,
                motivo
            };

            let res;
            if (id) {
                res = await this.supabaseFrases.from('frases').update(payload).eq('id', id);
            } else {
                res = await this.supabaseFrases.from('frases').insert([payload]);
            }

            if (res.error) throw res.error;

            Swal.close();
            document.getElementById('modal-lib-frase').classList.add('hidden');
            await this.carregarFrases();

            Swal.fire({ icon: 'success', title: 'Sucesso!', text: id ? 'Frase atualizada!' : 'Frase criada!', timer: 1500, showConfirmButton: false });

        } catch (e) {
            Swal.fire('Erro ao salvar', e.message || 'Erro desconhecido', 'error');
        }
    },

    deletar: async function (id) {
        const confirm = await Swal.fire({
            title: 'Excluir frase?',
            text: "Esta ação não pode ser desfeita!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            try {
                const { error } = await this.supabaseFrases.from('frases').delete().eq('id', id);
                if (error) throw error;

                await this.carregarFrases();
                Swal.fire({ icon: 'success', title: 'Excluído!', timer: 1500, showConfirmButton: false });
            } catch (e) {
                Swal.fire('Erro ao excluir', e.message, 'error');
            }
        }
    },

    // --- CEP ---
    buscarCEP: async function () {
        const input = document.getElementById('lib-cep-input');
        const cep = input.value.replace(/\D/g, '');

        if (cep.length !== 8) return;

        const loading = document.getElementById('lib-cep-loading');
        const resBox = document.getElementById('lib-cep-resultado');

        if (loading) loading.classList.remove('hidden');
        if (resBox) resBox.classList.add('hidden');

        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await r.json();

            if (data.erro) throw new Error();

            document.getElementById('lib-cep-logradouro').innerText = data.logradouro;
            document.getElementById('lib-cep-bairro').innerText = data.bairro;
            document.getElementById('lib-cep-localidade').innerText = `${data.localidade} - ${data.uf}`;
            document.getElementById('lib-cep-display-num').innerText = cep.replace(/^(\d{5})(\d{3})/, "$1-$2");

            if (resBox) resBox.classList.remove('hidden');
        } catch (e) {
            if (window.Swal) Swal.fire('CEP não localizado', 'Verifique o número digitado.', 'warning');
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    },

    // --- CALCULADORA ---
    abrirCalculadora: function () {
        document.getElementById('modal-lib-calculadora').classList.remove('hidden');
        this.mudarModoCalculadora('intervalo');
    },

    fecharCalculadora: function () {
        document.getElementById('modal-lib-calculadora').classList.add('hidden');
    },

    mudarModoCalculadora: function (modo) {
        this.modoCalculadora = modo;
        const btnInt = document.getElementById('lib-calc-btn-intervalo');
        const btnSom = document.getElementById('lib-calc-btn-soma');
        const inDias = document.getElementById('lib-calc-container-dias');
        const resInt = document.getElementById('lib-calc-resultado-intervalo');
        const resSom = document.getElementById('lib-calc-resultado-soma');

        if (modo === 'intervalo') {
            btnInt.className = "px-4 py-2 rounded-lg text-xs font-extrabold shadow-sm bg-blue-600 text-white transition";
            btnSom.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-white transition";
            if (inDias) inDias.classList.add('hidden');
            if (resSom) resSom.classList.add('hidden');
            document.getElementById('lib-calc-label-data').innerText = "Data Inicial";
        } else {
            btnSom.className = "px-4 py-2 rounded-lg text-xs font-extrabold shadow-sm bg-blue-600 text-white transition";
            btnInt.className = "px-4 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-white transition";
            if (inDias) inDias.classList.remove('hidden');
            if (resInt) resInt.classList.add('hidden');
            document.getElementById('lib-calc-label-data').innerText = "Data Base";
        }
    },

    processarCalculadora: function () {
        const valData = document.getElementById('lib-calc-data-input').value;
        if (valData.length !== 10) return;

        const parts = valData.split('/');
        const dataBase = new Date(parts[2], parts[1] - 1, parts[0]);
        if (isNaN(dataBase.getTime())) return;

        if (this.modoCalculadora === 'intervalo') {
            this.calcularIntervalo(dataBase);
        } else {
            this.calcularSoma(dataBase);
        }
    },

    calcularIntervalo: function (d) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
        const diff = Math.abs(hoje - d);
        const totalDias = Math.floor(diff / (1000 * 60 * 60 * 24));

        let anos = hoje.getFullYear() - d.getFullYear();
        let meses = hoje.getMonth() - d.getMonth();
        let dias = hoje.getDate() - d.getDate();

        if (dias < 0) { meses--; dias += new Date(hoje.getFullYear(), hoje.getMonth(), 0).getDate(); }
        if (meses < 0) { anos--; meses += 12; }

        document.getElementById('lib-res-total-dias').innerText = totalDias;
        document.getElementById('lib-res-anos').innerText = anos;
        document.getElementById('lib-res-meses').innerText = meses;
        document.getElementById('lib-res-dias').innerText = dias;
        document.getElementById('lib-calc-resultado-intervalo').classList.remove('hidden');
    },

    calcularSoma: function (d) {
        const dias = parseInt(document.getElementById('lib-calc-dias-input').value);
        if (isNaN(dias)) return;

        const futura = new Date(d);
        futura.setDate(futura.getDate() + dias);

        const dd = String(futura.getDate()).padStart(2, '0');
        const mm = String(futura.getMonth() + 1).padStart(2, '0');
        const aa = futura.getFullYear();
        const diasSem = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

        document.getElementById('lib-res-data-futura').innerText = `${dd}/${mm}/${aa}`;
        document.getElementById('lib-res-dia-semana').innerText = diasSem[futura.getDay()];
        document.getElementById('lib-calc-resultado-soma').classList.remove('hidden');
    },

    // --- AUX ---
    atualizarSugestoesModal: function () {
        const empresas = [...new Set(this.cacheFrases.map(f => f.empresa).filter(Boolean))].sort();
        const motivos = [...new Set(this.cacheFrases.map(f => f.motivo).filter(Boolean))].sort();
        const docs = [...new Set(this.cacheFrases.map(f => f.documento).filter(Boolean))].sort();

        this.updateSelect('lib-filtro-empresa', empresas, '🏢 Empresas');
        this.updateSelect('lib-filtro-motivo', motivos, '🎯 Motivos');
        this.updateSelect('lib-filtro-doc', docs, '📄 Documentos');

        // Popula os datalists do modal de edição
        this.updateDatalist('sugestoes-empresa', empresas);
        this.updateDatalist('sugestoes-motivo', motivos);
        this.updateDatalist('sugestoes-doc', docs);
    },

    updateSelect: function (id, list, label) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">${label}</option>` + list.map(v => `<option value="${v}">${v}</option>`).join('');
    },

    updateDatalist: function (id, list) {
        const dl = document.getElementById(id);
        if (!dl) return;
        dl.innerHTML = list.map(v => `<option value="${v}">`).join('');
    }
};
