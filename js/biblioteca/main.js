/**
 * ARQUIVO: js/biblioteca/main.js
 * DESCRIÇÃO: Controlador da página Biblioteca (TiDB / Vercel Edition)
 * VERSÃO: V.1.1.6
 */

window.GupyBiblioteca = {
    cacheFrases: [],
    cacheEmpresas: [],
    modoCalculadora: 'intervalo',
    usuario: null,
    cacheFavoritos: [], 
    verFavoritos: false,
    abaAtiva: 'todas',
    cacheCID: null,
    mapaCapitulosCID: {
        'A': 'Capítulo I: Algumas doenças infecciosas e parasitárias', 'B': 'Capítulo I: Algumas doenças infecciosas e parasitárias',
        'C': 'Capítulo II: Neoplasias [tumores]', 'D': 'Capítulo II/III: Neoplasias / Doenças do sangue',
        'E': 'Capítulo IV: Doenças endócrinas, nutricionais e metabólicas', 'F': 'Capítulo V: Transtornos mentais e comportamentais',
        'G': 'Capítulo VI: Doenças do sistema nervoso', 'H': 'Capítulo VII/VIII: Doenças do olho e ouvido',
        'I': 'Capítulo IX: Doenças do aparelho circulatório', 'J': 'Capítulo X: Doenças do aparelho respiratório',
        'K': 'Capítulo XI: Doenças do aparelho digestivo', 'L': 'Capítulo XII: Doenças da pele e do tecido subcutâneo',
        'M': 'Capítulo XIII: Doenças do sistema osteomuscular', 'N': 'Capítulo XIV: Doenças do aparelho geniturinário',
        'O': 'Capítulo XV: Gravidez, parto e puerpério', 'P': 'Capítulo XVI: Afecções originadas no período perinatal',
        'Q': 'Capítulo XVII: Malformações congênitas e anomalias cromossômicas', 'R': 'Capítulo XVIII: Sintomas e achados anormais',
        'S': 'Capítulo XIX: Lesões e envenenamentos', 'T': 'Capítulo XIX: Lesões e envenenamentos',
        'V': 'Capítulo XX: Causas externas de morbidade', 'W': 'Capítulo XX: Causas externas de morbidade',
        'X': 'Capítulo XX: Causas externas de morbidade', 'Y': 'Capítulo XX: Causas externas de morbidade',
        'Z': 'Capítulo XXI: Fatores que influenciam o estado de saúde', 'U': 'Capítulo XXII: Códigos para propósitos especiais'
    },

    // Mapeamentos de cores dinâmicos
    mapaCoresEmpresas: {},
    mapaCoresDocs: {},
    mapaCoresMotivos: {},

    palette: [
        { tag: 'bg-indigo-100 text-indigo-700 border-indigo-200', text: 'text-indigo-600', card: 'border-l-indigo-500', bg: 'bg-indigo-600' },
        { tag: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'text-emerald-600', card: 'border-l-emerald-500', bg: 'bg-emerald-600' },
        { tag: 'bg-amber-100 text-amber-700 border-amber-200', text: 'text-amber-600', card: 'border-l-amber-500', bg: 'bg-amber-600' },
        { tag: 'bg-rose-100 text-rose-700 border-rose-200', text: 'text-rose-600', card: 'border-l-rose-500', bg: 'bg-rose-600' },
        { tag: 'bg-cyan-100 text-cyan-700 border-cyan-200', text: 'text-cyan-600', card: 'border-l-cyan-500', bg: 'bg-cyan-600' },
        { tag: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', text: 'text-fuchsia-600', card: 'border-l-fuchsia-500', bg: 'bg-fuchsia-600' },
        { tag: 'bg-violet-100 text-violet-700 border-violet-200', text: 'text-violet-600', card: 'border-l-violet-500', bg: 'bg-violet-600' },
        { tag: 'bg-sky-100 text-sky-700 border-sky-200', text: 'text-sky-600', card: 'border-l-sky-500', bg: 'bg-sky-600' },
        { tag: 'bg-lime-100 text-lime-700 border-lime-200', text: 'text-lime-600', card: 'border-l-lime-500', bg: 'bg-lime-600' },
        { tag: 'bg-orange-100 text-orange-700 border-orange-200', text: 'text-orange-600', card: 'border-l-orange-500', bg: 'bg-orange-600' },
        { tag: 'bg-teal-100 text-teal-700 border-teal-200', text: 'text-teal-600', card: 'border-l-teal-500', bg: 'bg-teal-600' },
        { tag: 'bg-slate-100 text-slate-700 border-slate-200', text: 'text-slate-600', card: 'border-l-slate-500', bg: 'bg-slate-600' }
    ],

    init: async function () {
        console.log("📚 Biblioteca: Inicializando Versão V.1.2.1");
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
        // Busca Principal e Secundária (já estão no HTML com oninput, mas reforçamos)
        
        // CEP - Live (8 dígitos)
        const inputCep = document.getElementById('lib-cep-input');
        if (inputCep) {
            inputCep.addEventListener('input', () => {
                this.mascararCEP(inputCep);
                const cep = inputCep.value.replace(/\D/g, "");
                if (cep.length === 8) this.buscarCEP();
            });
        }

        // CID - Live
        const inputCid = document.getElementById('lib-cid-input');
        if (inputCid) {
            inputCid.addEventListener('input', () => {
                if (inputCid.value.trim().length >= 2) this.buscarCID();
            });
        }

        // Siglas - Live
        const inputSigla = document.getElementById('lib-sigla-input');
        if (inputSigla) {
            inputSigla.addEventListener('input', () => {
                if (inputSigla.value.trim().length >= 2) this.buscarSigla();
            });
        }

        // Calculadora - Live
        const idsCalc = ['lib-calc-data-input', 'lib-calc-anos-input', 'lib-calc-meses-input', 'lib-calc-dias-input'];
        idsCalc.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    if (id === 'lib-calc-data-input') this.mascararData(e.target);
                    this.processarCalculadora();
                });
            }
        });
    },

    isAdmin: function () {
        if (!this.usuario) return false;
        const n = (this.usuario.nome || '').toUpperCase();
        const f = (this.usuario.funcao || '').toUpperCase();
        const p = (this.usuario.perfil || '').toUpperCase();
        
        // Verifica por Nomes Master, Perfis de Admin, Funções de Gestão ou IDs específicos
        const isMaster = n.includes('PEDRO') || n.includes('THAYLA') || n.includes('GUPY') || n.includes('HUPERT');
        const hasRole = p === 'ADMIN' || p === 'ADMINISTRADOR' || f.includes('GESTOR') || f.includes('AUDITOR') || f.includes('COORDENADOR') || f.includes('DIRETOR') || f.includes('GERENTE');
        const hasId = ['1', '1000', '14', '7'].includes(String(this.usuario.id));
        
        return isMaster || hasRole || hasId;
    },

    carregarFavoritos: async function () {
        if (!this.usuario) return;
        try {
            const data = await this.callAPI({
                action: 'select',
                table: 'frases_favoritas',
                queryParams: { usuario_id: String(this.usuario.id) }
            });
            if (data) this.cacheFavoritos = data.map(f => String(f.frase_id));
        } catch (e) { console.error(e); }
    },

    carregarFrases: async function () {
        try {
            const grid = document.getElementById('grid-frases');
            if (grid) grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10"><i class="fas fa-circle-notch fa-spin mr-2"></i>Sincronizando Sistema...</div>';

            const empresas = await this.callAPI({ action: 'select', table: 'empresas' });
            this.cacheEmpresas = empresas || [];
            
            const frases = await this.callAPI({ action: 'select', table: 'frases' });
            if (!frases) throw new Error("Falha ao carregar frases");

            let meusUsosMap = {};
            if (this.usuario) {
                const stats = await this.callAPI({ action: 'select', table: 'view_usos_pessoais', queryParams: { usuario: String(this.usuario.id) } });
                if (stats) stats.forEach(s => meusUsosMap[String(s.frase_id)] = s.qtd_uso);
            }

            this.cacheFrases = frases.map(f => ({
                ...f,
                meus_usos: meusUsosMap[String(f.id)] || 0,
                _busca: this.normalizar(f.conteudo + (f.empresa || '') + (f.motivo || '') + (f.documento || ''))
            }));

            this.gerarMapaCoresEmpresas();
            this.gerarMapaCoresDocs();
            this.gerarMapaCoresMotivos();

            this.cacheFrases.sort((a, b) => {
                if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                return (b.usos || 0) - (a.usos || 0);
            });

            this.atualizarFiltrosSelects();
            this.aplicarFiltros();
        } catch (e) {
            console.error("Erro ao carregar frases:", e);
        }
    },

    gerarMapaCoresEmpresas: function() {
        const nomes = this.cacheEmpresas.map(e => (e.nome || '').toUpperCase());
        const extras = [...new Set(this.cacheFrases.map(f => (f.empresa || 'GERAL').toUpperCase()))];
        const todos = [...new Set([...nomes, ...extras])].sort();
        
        todos.forEach((nome, i) => {
            if (nome.includes('CLARO')) this.mapaCoresEmpresas[nome] = 'bg-red-600 text-white border-red-700';
            else if (nome.includes('TIM')) this.mapaCoresEmpresas[nome] = 'bg-blue-600 text-white border-blue-700';
            else if (nome.includes('VIVO')) this.mapaCoresEmpresas[nome] = 'bg-indigo-600 text-white border-indigo-700';
            else if (nome.includes('OI')) this.mapaCoresEmpresas[nome] = 'bg-amber-500 text-white border-amber-600';
            else if (nome.includes('NEXTEL')) this.mapaCoresEmpresas[nome] = 'bg-yellow-500 text-slate-900 border-yellow-600';
            else {
                const color = this.palette[i % this.palette.length];
                this.mapaCoresEmpresas[nome] = `${color.bg} text-white border-white/20`;
            }
        });
    },

    gerarMapaCoresDocs: function() {
        const docs = [...new Set(this.cacheFrases.map(f => (f.documento || 'GERAL').toUpperCase()))].sort();
        docs.forEach((doc, i) => {
            this.mapaCoresDocs[doc] = this.palette[i % this.palette.length];
        });
    },

    gerarMapaCoresMotivos: function() {
        const motivos = [...new Set(this.cacheFrases.map(f => (f.motivo || 'SEM MOTIVO').toUpperCase()))].sort();
        motivos.forEach((mot, i) => {
            if (mot.includes('NITIDEZ')) this.mapaCoresMotivos[mot] = this.palette[3]; 
            else if (mot.includes('VISIBILIDADE')) this.mapaCoresMotivos[mot] = this.palette[9];
            else if (mot.includes('INVALIDO')) this.mapaCoresMotivos[mot] = this.palette[3];
            else if (mot.includes('QUALIDADE')) this.mapaCoresMotivos[mot] = this.palette[1];
            else this.mapaCoresMotivos[mot] = this.palette[(i + 5) % this.palette.length];
        });
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
        const fav = this.cacheFavoritos.includes(String(f.id));
        const emp = (f.empresa || 'GERAL').toUpperCase();
        const doc = (f.documento || 'GERAL').toUpperCase();
        const mot = (f.motivo || 'SEM MOTIVO').toUpperCase();

        const colorEmp = this.mapaCoresEmpresas[emp] || 'bg-slate-800 text-white';
        const colorDoc = this.mapaCoresDocs[doc] || this.palette[0];
        const colorMot = this.mapaCoresMotivos[mot] || this.palette[0];

        const textoContador = (f.meus_usos > 0 ? `${f.meus_usos} VEZES USADO POR MIM` : `${f.usos || 0} VEZES USADO PELA EQUIPE`);
        const iconeContador = (f.meus_usos > 0 ? "fa-user-check text-blue-500" : "fa-globe text-slate-400");

        return `
            <div class="flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 border-l-4 ${colorDoc.card} hover:shadow-md transition-all duration-300 group overflow-hidden">
                <div class="px-5 pt-4 pb-2 flex justify-between items-start">
                    <div class="flex flex-col gap-1.5">
                        <span onclick="GupyBiblioteca.filtrarPorEmpresa('${f.empresa || 'Geral'}')" class="${colorEmp} text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider cursor-pointer shadow-sm transition-colors hover:brightness-110">${f.empresa || 'Geral'}</span>
                        <span onclick="GupyBiblioteca.filtrarPorDocumento('${f.documento || 'GERAL'}')" class="${colorDoc.tag} text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide cursor-pointer hover:brightness-95 active:scale-95 transition-all">${f.documento || 'GERAL'}</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <button onclick="GupyBiblioteca.toggleFavorito('${f.id}')" class="transition-all active:scale-75 ${fav ? 'text-rose-500' : 'text-slate-300 hover:text-rose-400'}"><i class="${fav ? 'fas' : 'far'} fa-heart"></i></button>
                        <button onclick="GupyBiblioteca.copiarTexto('${f.id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"><i class="far fa-copy"></i> Copiar</button>
                        ${(isAdmin || String(f.revisado_por) === String(this.usuario?.id)) ? `
                            <button onclick="GupyBiblioteca.prepararEdicao('${f.id}')" class="text-slate-300 hover:text-amber-500 p-1.5 transition"><i class="fas fa-pen text-sm"></i></button>
                            <button onclick="GupyBiblioteca.deletar('${f.id}')" class="text-slate-300 hover:text-rose-500 p-1.5 transition"><i class="fas fa-trash-alt text-sm"></i></button>
                        ` : ''}
                    </div>
                </div>
                <div class="px-5 py-6 flex-grow">
                    <h4 onclick="GupyBiblioteca.filtrarPorMotivo('${f.motivo || 'Sem Motivo'}')" class="font-black ${colorMot.text} text-lg leading-tight mb-4 cursor-pointer hover:underline transition-all inline-block">${f.motivo || 'Sem Motivo'}</h4>
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
            if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Copiado!', showConfirmButton: false, timer: 1500 });
            await this.callAPI({ action: 'insert', table: 'logs', data: { usuario: String(this.usuario.id), acao: 'COPIAR', detalhe: String(id), data_hora: new Date().toISOString().slice(0, 19).replace('T', ' ') } });
            const novoUso = (f.usos || 0) + 1;
            await this.callAPI({ action: 'update', table: 'frases', id: f.id, data: { usos: novoUso, ultimo_uso: new Date().toISOString().slice(0, 19).replace('T', ' ') } });
            f.usos = novoUso;
            f.meus_usos = (f.meus_usos || 0) + 1;

            // Re-ordenar cache para refletir mudança de ranking imediatamente
            this.cacheFrases.sort((a, b) => {
                if (b.meus_usos !== a.meus_usos) return b.meus_usos - a.meus_usos;
                return (b.usos || 0) - (a.usos || 0);
            });

            this.aplicarFiltros(false);
        });
    },

    toggleFavorito: async function (id) {
        if (!id || !this.usuario) return;
        id = String(id);
        const index = this.cacheFavoritos.indexOf(id);
        const isAdding = index === -1;
        try {
            if (isAdding) {
                this.cacheFavoritos.push(id);
                await this.callAPI({ action: 'insert', table: 'frases_favoritas', data: { usuario_id: String(this.usuario.id), frase_id: id } });
            } else {
                this.cacheFavoritos.splice(index, 1);
                await this.callAPI({ action: 'delete', table: 'frases_favoritas', queryParams: { usuario_id: String(this.usuario.id), frase_id: id } });
            }
            this.aplicarFiltros(false);
        } catch (e) { console.error(e); }
    },

    aplicarFiltros: function (scrollToTop, clearBtn) {
        const termo = this.normalizar(document.getElementById('lib-search')?.value || '');
        const termo2 = this.normalizar(document.getElementById('lib-search-2')?.value || '');
        const valEmpresa = document.getElementById('lib-filtro-empresa')?.value || '';
        const valMotivo = document.getElementById('lib-filtro-motivo')?.value || '';
        const valDoc = document.getElementById('lib-filtro-doc')?.value || '';

        const btnLimpar = document.getElementById('btn-limpar-busca');
        if (btnLimpar) {
            const hasFilter = termo || termo2 || valEmpresa || valMotivo || valDoc;
            if (hasFilter) btnLimpar.classList.remove('hidden');
            else btnLimpar.classList.add('hidden');
        }

        let filtrados = this.cacheFrases;
        if (this.abaAtiva === 'favoritas') {
            filtrados = filtrados.filter(f => this.cacheFavoritos.includes(String(f.id)));
        }

        if (termo) filtrados = filtrados.filter(f => f._busca.includes(termo));
        if (termo2) filtrados = filtrados.filter(f => f._busca.includes(termo2));
        if (valEmpresa) filtrados = filtrados.filter(f => f.empresa === valEmpresa);
        if (valMotivo) filtrados = filtrados.filter(f => f.motivo === valMotivo);
        if (valDoc) filtrados = filtrados.filter(f => f.documento === valDoc);

        const isFiltered = termo || termo2 || valEmpresa || valMotivo || valDoc || this.abaAtiva === 'favoritas';
        if (!isFiltered) {
            filtrados = filtrados.slice(0, 6); 
        }

        this.renderizar(filtrados);
        if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setAba: function(aba) {
        this.abaAtiva = aba;
        document.getElementById('aba-todas').classList.toggle('active', aba === 'todas');
        document.getElementById('aba-favoritas').classList.toggle('active', aba === 'favoritas');
        this.aplicarFiltros(true);
    },

    limparBusca: function() {
        document.getElementById('lib-search').value = '';
        document.getElementById('lib-search-2').value = '';
        
        // Também limpar filtros ao limpar busca no "X"
        const fEmp = document.getElementById('lib-filtro-empresa');
        const fMot = document.getElementById('lib-filtro-motivo');
        const fDoc = document.getElementById('lib-filtro-doc');
        
        if (fEmp) fEmp.value = '';
        if (fMot) fMot.value = '';
        if (fDoc) fDoc.value = '';

        this.aplicarFiltros(true);
    },

    toggleOpcoes: function() {
        const d = document.getElementById('dropdown-opcoes');
        if (d) d.classList.toggle('hidden');
    },

    toggleFiltrosDropdown: function() {
        const sub = document.getElementById('submenu-filtros');
        const icon = document.getElementById('icon-filtros-chevron');
        if (sub) {
            sub.classList.toggle('hidden');
            if (icon) icon.classList.toggle('rotate-180', !sub.classList.contains('hidden'));
        }
    },

    limparFiltros: function() {
        document.getElementById('lib-filtro-empresa').value = '';
        document.getElementById('lib-filtro-motivo').value = '';
        document.getElementById('lib-filtro-doc').value = '';
        this.aplicarFiltros(true);
    },

    // --- CEP ---
    mascararCEP: function(el) {
        let v = el.value.replace(/\D/g, "");
        if (v.length > 5) v = v.substring(0, 5) + "-" + v.substring(5, 8);
        el.value = v;
    },
    buscarCEP: async function() {
        const cep = document.getElementById('lib-cep-input').value.replace(/\D/g, "");
        if (cep.length !== 8) return;
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) return;
        document.getElementById('lib-cep-display-num').innerText = data.cep;
        document.getElementById('lib-cep-logradouro').innerText = data.logradouro;
        document.getElementById('lib-cep-bairro').innerText = data.bairro;
        document.getElementById('lib-cep-localidade').innerText = `${data.localidade} - ${data.uf}`;
        document.getElementById('lib-cep-resultado').classList.remove('hidden');
    },
    copiarTextoSimples: function(t) {
        navigator.clipboard.writeText(t);
        if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Copiado!', showConfirmButton: false, timer: 1000 });
    },

    // --- CID ---
    buscarCID: async function() {
        const termo = document.getElementById('lib-cid-input').value.trim();
        const resDiv = document.getElementById('lib-cid-resultado');
        const resCode = document.getElementById('lib-cid-display-code');
        const resDesc = document.getElementById('lib-cid-descricao');

        if (!termo) return;

        resCode.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-2"></i> BUSCANDO...`;
        resDesc.innerText = "Pesquisando nas bases oficiais...";
        resDiv.classList.remove('hidden');

        try {
            if (!this.cacheCID) {
                const response = await fetch(`https://raw.githubusercontent.com/N1nh4/api-cid-10/master/api/cid10.json`);
                this.cacheCID = await response.json();
            }
            
            const busca = this.normalizar(termo);
            const encontrado = this.cacheCID.find(c => 
                this.normalizar(c.codigo).includes(busca) || 
                this.normalizar(c.descricao).includes(busca)
            );

            if (encontrado) {
                const prim = (encontrado.codigo || "").charAt(0).toUpperCase();
                const capitulo = this.mapaCapitulosCID[prim] || "Capítulo não identificado";
                
                resCode.innerText = "CID-10: " + encontrado.codigo;
                resDesc.innerHTML = `
                    <div class="space-y-2">
                        <p class="text-xs font-black text-rose-500 uppercase tracking-widest">${capitulo}</p>
                        <p class="text-base font-black text-slate-800 leading-tight">${encontrado.descricao}</p>
                        <div class="flex gap-2 pt-3">
                            <button onclick="GupyBiblioteca.copiarCID('${encontrado.codigo}', '${encontrado.descricao}')" class="flex-1 bg-white border border-rose-200 text-rose-600 font-black py-2 rounded-lg text-[10px] uppercase tracking-wider hover:bg-rose-50 transition flex items-center justify-center gap-2">
                                <i class="far fa-copy"></i> Copiar Tudo
                            </button>
                            <a href="https://icd.who.int/browse11/l-m/pt#/http%3a%2f%2fid.who.int%2ficd%2fentity%2f${encontrado.codigo}" target="_blank" class="flex-1 bg-rose-600 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-wider hover:bg-rose-700 transition flex items-center justify-center gap-2 shadow-sm">
                                <i class="fas fa-external-link-alt"></i> Ver na OMS
                            </a>
                        </div>
                    </div>`;
            } else {
                resCode.innerText = "NÃO ENCONTRADO NO CID-10";
                resDesc.innerHTML = `
                    <div class="space-y-3">
                        <p class="text-sm font-medium text-slate-600">Não encontramos o termo "${termo}" na base local CID-10.</p>
                        <a href="https://icd.who.int/browse11/l-m/pt#/search?q=${termo}" target="_blank" class="block w-full bg-slate-800 text-white text-center font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-900 transition shadow-lg">
                            <i class="fas fa-search-plus mr-2 text-rose-400"></i> Buscar na Base Global CID-11 (WHO)
                        </a>
                    </div>`;
            }
        } catch (e) {
            console.error("Erro busca CID:", e);
            resCode.innerText = "ERRO NA CONEXÃO";
            resDesc.innerText = "Falha ao carregar base de dados. Verifique sua internet.";
        }
    },

    copiarCID: function(codigo, desc) {
        const txt = `CID-10: ${codigo} - ${desc}`;
        navigator.clipboard.writeText(txt);
        if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'CID Copiado!', showConfirmButton: false, timer: 1500 });
    },

    // --- Siglas ---
    buscarSigla: function() {
        const s = document.getElementById('lib-sigla-input').value.toUpperCase().trim();
        const base = { 'SSP': 'Secretaria de Segurança Pública', 'DETRAN': 'Departamento Estadual de Trânsito', 'DIC': 'Diretoria de Identificação Civil' };
        const res = base[s];
        if (res) {
            document.getElementById('lib-sigla-display-code').innerText = s;
            document.getElementById('lib-sigla-descricao').innerText = res;
            document.getElementById('lib-sigla-resultado').classList.remove('hidden');
        }
    },

    // --- Calculadora ---
    abrirCalculadora: function() { document.getElementById('modal-lib-calculadora').classList.remove('hidden'); },
    fecharCalculadora: function() { document.getElementById('modal-lib-calculadora').classList.add('hidden'); },
    mudarModoCalculadora: function(modo) {
        this.modoCalculadora = modo;
        document.getElementById('lib-calc-btn-intervalo').classList.toggle('bg-white', modo === 'intervalo');
        document.getElementById('lib-calc-btn-soma').classList.toggle('bg-white', modo === 'soma');
        document.getElementById('lib-calc-container-soma').classList.toggle('hidden', modo === 'intervalo');
        document.getElementById('lib-calc-label-input').innerText = modo === 'intervalo' ? 'Data Inicial / Nascimento' : 'Data Base';
        
        // Recalcular imediatamente ao trocar o modo
        this.processarCalculadora();
    },
    mascararData: function(el) {
        let v = el.value.replace(/\D/g, "");
        if (v.length > 2) v = v.substring(0, 2) + "/" + v.substring(2);
        if (v.length > 5) v = v.substring(0, 5) + "/" + v.substring(5, 9);
        el.value = v;
    },
    toggleCalcOperation: function() {
        const btn = document.getElementById('lib-calc-operation-btn');
        const val = document.getElementById('lib-calc-operation-val');
        if (val.value === 'somar') {
            val.value = 'subtrair';
            btn.innerText = '-';
            btn.classList.replace('text-blue-600', 'text-rose-600');
        } else {
            val.value = 'somar';
            btn.innerText = '+';
            btn.classList.replace('text-rose-600', 'text-blue-600');
        }
        this.processarCalculadora();
    },

    processarCalculadora: function() {
        const val = document.getElementById('lib-calc-data-input').value;
        const [d, m, y] = val.split('/').map(Number);
        if (!d || !m || !y || val.length < 10) return;
        
        let dataIn = new Date(y, m - 1, d);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataIn.setHours(0, 0, 0, 0);

        const resPrincipal = document.getElementById('lib-res-principal');
        const resLabelPrincipal = document.getElementById('lib-res-label-primaria');
        const resDataInserida = document.getElementById('lib-res-data-inserida');
        const resLabelSecundaria = document.getElementById('lib-res-label-secundaria');
        const resContainerDetalhes = document.getElementById('lib-res-detalhes');
        const resUnidade = document.getElementById('lib-res-unidade');

        if (this.modoCalculadora === 'intervalo') {
            // MODO INTERVALO (Tempo Decorrido)
            const diffTime = Math.abs(hoje - dataIn);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            resDataInserida.innerText = val;
            resLabelSecundaria.innerText = "Data Inserida";
            resPrincipal.innerText = diffDays;
            resLabelPrincipal.innerText = "Total Dias Corridos";
            resContainerDetalhes.classList.remove('hidden');
            if (resUnidade) resUnidade.classList.remove('hidden');

            // Detalhado
            let years = hoje.getFullYear() - dataIn.getFullYear();
            let months = hoje.getMonth() - dataIn.getMonth();
            let days = hoje.getDate() - dataIn.getDate();
            if (days < 0) { months--; days += 30; }
            if (months < 0) { years--; months += 12; }
            
            document.getElementById('lib-res-anos').innerText = Math.abs(years);
            document.getElementById('lib-res-meses').innerText = Math.abs(months);
            document.getElementById('lib-res-semanas').innerText = Math.floor(diffDays / 7);
            document.getElementById('lib-res-dias').innerText = Math.abs(days);
        } else {
            // MODO SOMA/SUBTRAÇÃO (Future/Past)
            const op = document.getElementById('lib-calc-operation-val').value;
            const anos = Number(document.getElementById('lib-calc-anos-input').value) || 0;
            const meses = Number(document.getElementById('lib-calc-meses-input').value) || 0;
            const dias = Number(document.getElementById('lib-calc-dias-input').value) || 0;

            let dataResult = new Date(dataIn);
            const mult = (op === 'somar' ? 1 : -1);

            dataResult.setFullYear(dataResult.getFullYear() + (anos * mult));
            dataResult.setMonth(dataResult.getMonth() + (meses * mult));
            dataResult.setDate(dataResult.getDate() + (dias * mult));

            resDataInserida.innerText = val;
            resLabelSecundaria.innerText = "Data Base";
            resPrincipal.innerText = dataResult.toLocaleDateString('pt-BR');
            resLabelPrincipal.innerText = op === 'somar' ? "Data no Futuro" : "Data no Passado";
            resContainerDetalhes.classList.add('hidden');
            if (resUnidade) resUnidade.classList.add('hidden');
        }
        
        document.getElementById('lib-calc-resultados').classList.remove('hidden');
    },

    // --- Outros ---
    atualizarFiltrosSelects: function() {
        const getLista = (prop) => [...new Set(this.cacheFrases.map(f => f[prop] || 'Geral'))].sort();
        this.encherSelect('lib-filtro-empresa', getLista('empresa'), 'Empresa');
        this.encherSelect('lib-filtro-motivo', getLista('motivo'), 'Motivo');
        this.encherSelect('lib-filtro-doc', getLista('documento'), 'Documento');
    },

    encherSelect: (id, lista, label) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">Todas as ${label}s</option>` + lista.map(v => `<option value="${v}">${v}</option>`).join('');
    },

    normalizar: t => (t || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
    
    atualizarRodape: function () {
        const ver = (window.CONFIG && CONFIG.VERSION) ? CONFIG.VERSION : 'V.1.1.6';
        const footer = document.getElementById('lib-footer-version');
        if (footer) footer.innerText = ver;
        if (window.Sistema) Sistema.atualizarVersaoGlobal();
    },

    filtrarPorEmpresa: function(e) { document.getElementById('lib-filtro-empresa').value = e; this.aplicarFiltros(true); },
    filtrarPorDocumento: function(d) { document.getElementById('lib-filtro-doc').value = d; this.aplicarFiltros(true); },
    filtrarPorMotivo: function(m) { document.getElementById('lib-filtro-motivo').value = m; this.aplicarFiltros(true); },

    prepararEdicao: function (id) {
        const f = this.cacheFrases.find(i => i.id == id);
        document.getElementById('lib-form-id').value = f ? f.id : '';
        document.getElementById('lib-form-conteudo').value = f ? f.conteudo : '';
        document.getElementById('lib-form-empresa').value = f ? (f.empresa || "") : '';
        document.getElementById('lib-form-doc').value = f ? (f.documento || "") : '';
        document.getElementById('lib-form-motivo').value = f ? (f.motivo || "") : '';
        document.getElementById('modal-lib-frase').classList.remove('hidden');
    },

    deletar: async function (id) {
        if (!confirm("Excluir frase?")) return;
        await this.callAPI({ action: 'delete', table: 'frases', id });
        this.cacheFrases = this.cacheFrases.filter(f => f.id != id);
        this.aplicarFiltros();
    },

    salvarFrase: async function () {
        const id = document.getElementById('lib-form-id').value;
        const payload = {
            conteudo: document.getElementById('lib-form-conteudo').value.trim(),
            empresa: document.getElementById('lib-form-empresa').value.trim(),
            documento: document.getElementById('lib-form-doc').value.trim(),
            motivo: document.getElementById('lib-form-motivo').value.trim(),
            revisado_por: String(this.usuario.id),
            data_revisao: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
        if (id) await this.callAPI({ action: 'update', table: 'frases', id, data: payload });
        else await this.callAPI({ action: 'insert', table: 'frases', data: payload });
        document.getElementById('modal-lib-frase').classList.add('hidden');
        this.carregarFrases();
    },

    atualizarSugestoesModal: function () {
        const getL = (p) => [...new Set(this.cacheFrases.map(f => f[p]).filter(Boolean))].sort();
        const fill = (id, l) => { const dl = document.getElementById(id); if(dl) dl.innerHTML = l.map(v => `<option value="${v}">`).join(''); };
        fill('list-empresas', getL('empresa'));
        fill('list-motivos', getL('motivo'));
        fill('list-docs', getL('documento'));
    }
};
