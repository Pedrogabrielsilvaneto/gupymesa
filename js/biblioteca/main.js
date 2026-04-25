/**
 * ARQUIVO: js/biblioteca/main.js
 * DESCRIÇÃO: Controlador da página Biblioteca (TiDB / Vercel Edition)
 * VERSÃO: V.1.1.1
 */

window.GupyBiblioteca = {
    cacheFrases: [],
    modoCalculadora: 'intervalo',
    usuario: null,
    cacheFavoritos: [], // IDs das frases favoritas (strings)
    verFavoritos: false,

    init: async function () {
        console.log("📚 Biblioteca: Inicializando Versão V.1.1.1 (TiDB)");
        if (window.Sistema) {
            this.usuario = Sistema.lerSessao();
        }

        const btnNova = document.getElementById('btn-nova-frase');
        if (btnNova && this.isAdmin()) {
            btnNova.classList.remove('hidden');
        }

        this.atualizarRodape();
        await this.carregarFavoritos();
        await this.carregarFrases();
        this.atualizarSugestoesModal();
        this.setupEventListeners();
    },

    // Helper para chamar a API Proxy do Vercel
    callAPI: async function (payload) {
        try {
            const res = await fetch('/api/biblioteca', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.error) throw new Error(result.error);
            return result.data;
        } catch (e) {
            console.error("Erro callAPI:", e);
            return null;
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
        const id = String(this.usuario.id);
        const isGestora = p === 'ADMIN' || p === 'ADMINISTRADOR' || f.includes('GESTOR') || f.includes('COORDENADOR') || f.includes('LIDER');
        return isGestora || f.includes('AUDITOR') || f.includes('ASSISTENTE') || id === '1' || id === '1000';
    },

    isGestora: function () {
        if (!this.usuario) return false;
        const p = (this.usuario.perfil || '').toUpperCase();
        const f = (this.usuario.funcao || '').toUpperCase();
        const id = String(this.usuario.id);
        return p === 'ADMIN' || p === 'ADMINISTRADOR' || f.includes('GESTOR') || f.includes('COORDENADOR') || f.includes('LIDER') || id === '1' || id === '1000';
    },

    podeApagar: function (frase) {
        if (!this.usuario) return false;
        if (this.isGestora()) return true;
        const criadorId = String(frase.revisado_por);
        const meuId = String(this.usuario.id);
        const meuNome = String(this.usuario.nome || '');
        return criadorId === meuId || criadorId === meuNome;
    },

    carregarFavoritos: async function () {
        if (!this.usuario) return;
        try {
            const data = await this.callAPI({
                action: 'select',
                table: 'frases_favoritas',
                queryParams: { usuario_id: String(this.usuario.id) }
            });
            if (data) {
                this.cacheFavoritos = data.map(f => String(f.frase_id));
                localStorage.setItem(`gupy_favs_${this.usuario.id}`, JSON.stringify(this.cacheFavoritos));
            }
        } catch (e) {
            console.error("Erro ao carregar favoritos:", e);
        }
    },

    toggleFavorito: async function (id) {
        if (!id || !this.usuario) return;
        id = String(id);
        const index = this.cacheFavoritos.indexOf(id);
        const isAdding = index === -1;

        try {
            if (isAdding) {
                this.cacheFavoritos.push(id);
                await this.callAPI({
                    action: 'insert',
                    table: 'frases_favoritas',
                    data: { usuario_id: String(this.usuario.id), frase_id: id }
                });
            } else {
                this.cacheFavoritos.splice(index, 1);
                await this.callAPI({
                    action: 'delete',
                    table: 'frases_favoritas',
                    queryParams: { usuario_id: String(this.usuario.id), frase_id: id }
                });
            }

            this.aplicarFiltros(false);
            const icon = isAdding ? 'success' : 'info';
            const msg = isAdding ? 'Adicionado!' : 'Removido';
            if (window.Swal) {
                Swal.fire({ toast: true, position: 'top-end', icon, title: msg, showConfirmButton: false, timer: 1000 });
            }
        } catch (e) {
            console.error("Erro toggleFavorito:", e);
        }
    },

    isFavorito: function (id) {
        return this.cacheFavoritos.includes(String(id));
    },

    carregarFrases: async function () {
        try {
            const grid = document.getElementById('grid-frases');
            if (grid) grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Sincronizando com Vercel TiDB...</div>';

            const frases = await this.callAPI({ action: 'select', table: 'frases' });
            if (!frases) throw new Error("Falha ao carregar frases");

            let meusUsosMap = {};
            if (this.usuario) {
                const stats = await this.callAPI({
                    action: 'select',
                    table: 'view_usos_pessoais',
                    queryParams: { usuario: String(this.usuario.id) }
                });
                if (stats) stats.forEach(s => meusUsosMap[String(s.frase_id)] = s.qtd_uso);
            }

            this.cacheFrases = frases.map(f => ({
                ...f,
                meus_usos: meusUsosMap[String(f.id)] || 0,
                _busca: this.normalizar(f.conteudo + (f.empresa || '') + (f.motivo || '') + (f.documento || ''))
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
        }
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

    gerarCardHTML: function (f) {
        const isAdmin = this.isAdmin();
        const fav = this.isFavorito(f.id);
        const colors = this.getDocColor(f.documento);
        const textoContador = (f.meus_usos > 0 ? `${f.meus_usos} VEZES USADO POR MIM` : `${f.usos || 0} VEZES USADO PELA EQUIPE`);
        const iconeContador = (f.meus_usos > 0 ? "fa-user-check text-blue-500" : "fa-globe text-slate-400");
        const empColor = this.getEmpresaColor(f.empresa);

        return `
            <div id="card-frase-${f.id}" class="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 ${colors.card} hover:shadow-md transition-all duration-300 group overflow-hidden">
                <div class="px-5 pt-4 pb-2 flex justify-between items-start">
                    <div class="flex flex-col gap-1.5">
                        <span onclick="GupyBiblioteca.filtrarPorEmpresa('${f.empresa || 'Geral'}')" class="${empColor} text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider cursor-pointer shadow-sm transition-colors hover:brightness-110">${f.empresa || 'Geral'}</span>
                        <span onclick="GupyBiblioteca.filtrarPorDocumento('${f.documento || 'GERAL'}')" class="${colors.tag} text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide cursor-pointer hover:brightness-95 active:scale-95 transition-all">${f.documento || 'GERAL'}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="GupyBiblioteca.toggleFavorito('${f.id}')" class="transition-all active:scale-75 ${fav ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}"><i class="${fav ? 'fas' : 'far'} fa-heart"></i></button>
                        <button onclick="GupyBiblioteca.copiarTexto('${f.id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"><i class="far fa-copy"></i> Copiar</button>
                        ${isAdmin ? `
                            <button onclick="GupyBiblioteca.prepararEdicao('${f.id}')" class="text-slate-300 hover:text-amber-500 p-1.5 transition"><i class="fas fa-pen text-sm"></i></button>
                            ${this.podeApagar(f) ? `<button onclick="GupyBiblioteca.deletar('${f.id}')" class="text-slate-300 hover:text-rose-500 p-1.5 transition"><i class="fas fa-trash-alt text-sm"></i></button>` : ''}
                        ` : ''}
                    </div>
                </div>
                <div class="px-5 py-6 flex-grow">
                    <h4 onclick="GupyBiblioteca.filtrarPorMotivo('${f.motivo || 'Sem Motivo'}')" class="font-black text-slate-800 text-lg leading-tight mb-4 cursor-pointer hover:text-blue-600 transition-colors inline-block border-b-2 border-transparent hover:border-blue-200">${f.motivo || 'Sem Motivo'}</h4>
                    <p class="text-[15px] text-slate-600 font-medium whitespace-pre-wrap leading-relaxed select-all">${f.conteudo}</p>
                </div>
                <div class="px-5 py-3 bg-slate-50/50 border-t border-slate-50">
                    <span class="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                        <i class="fas ${iconeContador}"></i> ${textoContador}
                    </span>
                </div>
            </div>`;
    },

    copiarTexto: async function (id) {
        const f = this.cacheFrases.find(i => i.id == id);
        if (!f) return;
        navigator.clipboard.writeText(f.conteudo).then(async () => {
            if (window.Swal) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Copiado!', showConfirmButton: false, timer: 1500 });
            }
            // 1. Registrar Log
            await this.registrarLog('COPIAR', String(id));
            // 2. Incrementar global
            const novoUso = (f.usos || 0) + 1;
            await this.callAPI({
                action: 'update', table: 'frases', id: f.id,
                data: { usos: novoUso, ultimo_uso: new Date().toISOString().slice(0, 19).replace('T', ' ') }
            });
            f.usos = novoUso;
            f.meus_usos = (f.meus_usos || 0) + 1;
            this.aplicarFiltros(false);
        });
    },

    registrarLog: async function (acao, desc) {
        if (!this.usuario) return;
        await this.callAPI({
            action: 'insert', table: 'logs',
            data: { 
                usuario: String(this.usuario.id), 
                acao: acao, 
                detalhe: desc, 
                data_hora: new Date().toISOString().slice(0, 19).replace('T', ' ') 
            }
        });
    },

    toggleOpcoes: function () {
        const d = document.getElementById('dropdown-opcoes');
        if (!d) return;
        const isClosing = !d.classList.contains('hidden');
        d.classList.toggle('hidden');
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
        const ids = ['lib-filtro-empresa', 'lib-filtro-motivo', 'lib-filtro-doc'];
        ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
        this.aplicarFiltros();
    },

    filtrarPorDocumento: function (docName) {
        const sel = document.getElementById('lib-filtro-doc');
        if (sel) { sel.value = (sel.value === docName) ? "" : docName; this.aplicarFiltros(); }
    },

    filtrarPorEmpresa: function (empName) {
        const sel = document.getElementById('lib-filtro-empresa');
        if (sel) { sel.value = (sel.value === empName) ? "" : empName; this.aplicarFiltros(); }
    },

    filtrarPorMotivo: function (motName) {
        const sel = document.getElementById('lib-filtro-motivo');
        if (sel) { sel.value = (sel.value === motName) ? "" : motName; this.aplicarFiltros(); }
    },

    salvarFrase: async function () {
        const id = document.getElementById('lib-form-id').value;
        const payload = {
            conteudo: document.getElementById('lib-form-conteudo').value.trim(),
            empresa: document.getElementById('lib-form-empresa').value.trim(),
            documento: document.getElementById('lib-form-doc').value.trim(),
            motivo: document.getElementById('lib-form-motivo').value.trim(),
            revisado_por: this.usuario ? String(this.usuario.id) : null,
            data_revisao: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        if (!payload.conteudo) return;
        try {
            if (id) await this.callAPI({ action: 'update', table: 'frases', id, data: payload });
            else await this.callAPI({ action: 'insert', table: 'frases', data: payload });
            document.getElementById('modal-lib-frase').classList.add('hidden');
            await this.carregarFrases();
            Swal.fire({ icon: 'success', title: 'Salvo!', timer: 1500, showConfirmButton: false });
        } catch (e) { Swal.fire('Erro', e.message, 'error'); }
    },

    deletar: async function (id) {
        const confirm = await Swal.fire({ title: 'Excluir?', icon: 'warning', showCancelButton: true });
        if (confirm.isConfirmed) {
            await this.callAPI({ action: 'delete', table: 'frases', id });
            this.cacheFrases = this.cacheFrases.filter(f => f.id != id);
            this.aplicarFiltros();
        }
    },

    // UI e Utilitários
    normalizar: t => (t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    
    atualizarRodape: function () {
        const ver = (window.CONFIG && CONFIG.VERSION) ? CONFIG.VERSION : 'V.1.1.1';
        const footer = document.getElementById('lib-footer-version');
        if (footer) footer.innerText = ver;
    },

    aplicarFiltros: function (scrollToTop, originIsSearch) {
        const termo = this.normalizar(document.getElementById('lib-search')?.value || '');
        const valEmpresa = document.getElementById('lib-filtro-empresa')?.value || '';
        const valMotivo = document.getElementById('lib-filtro-motivo')?.value || '';
        const valDoc = document.getElementById('lib-filtro-doc')?.value || '';

        let filtrados = this.cacheFrases;
        if (this.verFavoritos) filtrados = filtrados.filter(f => this.isFavorito(f.id));

        const temFiltro = termo || valEmpresa || valMotivo || valDoc;
        if (temFiltro) {
            if (termo) filtrados = filtrados.filter(f => f._busca.includes(termo));
            if (valEmpresa) filtrados = filtrados.filter(f => f.empresa === valEmpresa);
            if (valMotivo) filtrados = filtrados.filter(f => f.motivo === valMotivo);
            if (valDoc) filtrados = filtrados.filter(f => f.documento === valDoc);
        } else if (!this.verFavoritos) {
            filtrados = filtrados.slice(0, 6); // TOP 6 como solicitado pelo usuário
        }

        this.renderizar(filtrados);
        if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    atualizarFiltrosSelects: function() {
        const getLista = (prop) => [...new Set(this.cacheFrases.map(f => f[prop] || (prop === 'empresa' ? 'Geral' : 'Geral')))].sort();
        this.encherSelect('lib-filtro-empresa', getLista('empresa'), 'Empresa');
        this.encherSelect('lib-filtro-motivo', getLista('motivo'), 'Motivo');
        this.encherSelect('lib-filtro-doc', getLista('documento'), 'Documento');
    },

    encherSelect: (id, lista, label) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">Todas as ${label}s</option>` + lista.map(v => `<option value="${v}">${v}</option>`).join('');
    },

    setAba: function (aba) {
        this.verFavoritos = (aba === 'favoritas');
        const btnTodas = document.getElementById('aba-todas');
        const btnFavs = document.getElementById('aba-favoritas');
        if (this.verFavoritos) {
            btnFavs.classList.add('active', 'bg-blue-50', 'text-blue-600');
            btnTodas.classList.remove('active', 'bg-blue-50', 'text-blue-600');
        } else {
            btnTodas.classList.add('active', 'bg-blue-50', 'text-blue-600');
            btnFavs.classList.remove('active', 'bg-blue-50', 'text-blue-600');
        }
        this.aplicarFiltros();
    },

    getDocColor: function (doc) {
        const d = (doc || '').toUpperCase();
        if (d.includes('CPF')) return { tag: 'bg-amber-100 text-amber-700 border-amber-200', card: 'border-l-amber-500' };
        if (d.includes('RG')) return { tag: 'bg-indigo-100 text-indigo-700 border-indigo-200', card: 'border-l-indigo-500' };
        if (d.includes('CNH')) return { tag: 'bg-emerald-100 text-emerald-700 border-emerald-200', card: 'border-l-emerald-500' };
        if (d.includes('CERTIDAO')) return { tag: 'bg-rose-100 text-rose-700 border-rose-200', card: 'border-l-rose-500' };
        if (d.includes('COMPROVANTE')) return { tag: 'bg-cyan-100 text-cyan-700 border-cyan-200', card: 'border-l-cyan-500' };
        return { tag: 'bg-slate-100 text-slate-700 border-slate-200', card: 'border-l-slate-500' };
    },

    getEmpresaColor: function (emp) {
        const e = (emp || 'GERAL').toUpperCase();
        if (e.includes('CLARO')) return 'bg-red-500 text-white border-red-600';
        if (e.includes('TIM')) return 'bg-blue-600 text-white border-blue-700';
        if (e.includes('VIVO')) return 'bg-indigo-600 text-white border-indigo-700';
        if (e.includes('OI')) return 'bg-amber-500 text-white border-amber-600';
        return 'bg-slate-800 text-white border-slate-700';
    },

    limparBusca: function () {
        const el = document.getElementById('lib-search');
        if (el) el.value = "";
        this.aplicarFiltros(true);
    },

    mascararCEP: (el) => {
        let v = el.value.replace(/\D/g, '');
        if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
        el.value = v;
    },

    mascararData: function (el) {
        let v = el.value.replace(/\D/g, '');
        if (v.length > 4) v = v.replace(/^(\d{2})(\d{2})(\d)/, '$1/$2/$3');
        else if (v.length > 2) v = v.replace(/^(\d{2})(\d)/, '$1/$2');
        el.value = v;
    },

    processarCalculadora: function () {
        const dataStr = document.getElementById('lib-calc-data-input').value;
        const dias = parseInt(document.getElementById('lib-calc-dias-input').value) || 0;
        const meses = parseInt(document.getElementById('lib-calc-meses-input').value) || 0;
        const anos = parseInt(document.getElementById('lib-calc-anos-input').value) || 0;
        if (dataStr.length < 10) return;
        const parts = dataStr.split('/');
        let d = new Date(parts[2], parts[1] - 1, parts[0]);
        if (this.modoCalculadora === 'intervalo') { d.setDate(d.getDate() + dias); d.setMonth(d.getMonth() + meses); d.setFullYear(d.getFullYear() + anos); }
        else { d.setDate(d.getDate() - dias); d.setMonth(d.getMonth() - meses); d.setFullYear(d.getFullYear() - anos); }
        document.getElementById('lib-calc-resultado-val').innerText = d.toLocaleDateString('pt-BR');
        document.getElementById('lib-calc-resultado').classList.remove('hidden');
    },

    setModoCalculadora: function (modo) {
        this.modoCalculadora = modo;
        const btnInt = document.getElementById('btn-calc-intervalo');
        const btnVen = document.getElementById('btn-calc-vencimento');
        if (modo === 'intervalo') {
            btnInt.classList.add('bg-blue-600', 'text-white'); btnInt.classList.remove('bg-slate-100', 'text-slate-600');
            btnVen.classList.remove('bg-blue-600', 'text-white'); btnVen.classList.add('bg-slate-100', 'text-slate-600');
        } else {
            btnVen.classList.add('bg-blue-600', 'text-white'); btnVen.classList.remove('bg-slate-100', 'text-slate-600');
            btnInt.classList.remove('bg-blue-600', 'text-white'); btnInt.classList.add('bg-slate-100', 'text-slate-600');
        }
        this.processarCalculadora();
    },

    buscarCEP: async function () {
        const cep = document.getElementById('lib-cep-input').value.replace(/\D/g, '');
        if (cep.length !== 8) return;
        try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await r.json();
            if (!data.erro) {
                document.getElementById('lib-cep-logradouro').innerText = data.logradouro || '-';
                document.getElementById('lib-cep-bairro').innerText = data.bairro || '-';
                document.getElementById('lib-cep-localidade').innerText = data.localidade || '-';
                document.getElementById('lib-cep-display-num').innerText = cep;
                document.getElementById('lib-cep-resultado').classList.remove('hidden');
            }
        } catch(e) {}
    },

    buscarCID: async function () {
        const query = document.getElementById('lib-cid-input').value.trim();
        if (query.length < 2) return;
        try {
            const r = await fetch(`https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?terms=${encodeURIComponent(query)}&max=1`);
            const data = await r.json();
            if (data && data[3] && data[3].length > 0) {
                document.getElementById('lib-cid-display-code').innerText = data[3][0][0];
                document.getElementById('lib-cid-descricao').innerText = data[3][0][1];
                document.getElementById('lib-cid-resultado').classList.remove('hidden');
            }
        } catch(e) {}
    },

    buscarSigla: function () {
        const sigla = document.getElementById('lib-sigla-input').value.trim().toUpperCase();
        const mapa = { 'SSP': 'Secretaria de Segurança Pública', 'OAB': 'Ordem dos Advogados', 'DETRAN': 'Detran' };
        if (mapa[sigla]) {
            document.getElementById('lib-sigla-display-code').innerText = sigla;
            document.getElementById('lib-sigla-descricao').innerText = mapa[sigla];
            document.getElementById('lib-sigla-resultado').classList.remove('hidden');
        }
    },
    
    prepararEdicao: function (id) {
        const f = this.cacheFrases.find(i => i.id == id) || { id: '', conteudo: '', empresa: '', documento: '', motivo: '' };
        document.getElementById('lib-form-id').value = f.id;
        document.getElementById('lib-form-conteudo').value = f.conteudo;
        document.getElementById('lib-form-empresa').value = f.empresa || "";
        document.getElementById('lib-form-doc').value = f.documento || "";
        document.getElementById('lib-form-motivo').value = f.motivo || "";
        document.getElementById('modal-lib-frase').classList.remove('hidden');
    },

    atualizarSugestoesModal: function () {
        const getL = (p) => [...new Set(this.cacheFrases.map(f => f[p]).filter(Boolean))].sort();
        const fill = (id, l) => { const dl = document.getElementById(id); if(dl) dl.innerHTML = l.map(v => `<option value="${v}">`).join(''); };
        fill('list-empresas', getL('empresa'));
        fill('list-motivos', getL('motivo'));
        fill('list-docs', getL('documento'));
    }
};
