/**
 * ARQUIVO: js/minha_area/biblioteca.js
 * DESCRIÇÃO: Controlador da aba Biblioteca (Frases, CEP e Calculadora)
 * INTEGRADO DE: App-Frases/gupy
 */

MinhaArea.Biblioteca = {
    supabaseFrases: null,
    cacheFrases: [],
    modoCalculadora: 'intervalo',

    init: async function () {
        if (!this.supabaseFrases) {
            const SUPABASE_URL = 'https://urmwvabkikftsefztadb.supabase.co';
            const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybXd2YWJraWtmdHNlZnp0YWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjU1NjQsImV4cCI6MjA4MDc0MTU2NH0.SXR6EG3fIE4Ya5ncUec9U2as1B7iykWZhZWN1V5b--E';
            this.supabaseFrases = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }

        await this.carregarFrases();
        this.atualizarSugestoesModal();
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
            if (MinhaArea.usuario) {
                const { data: stats } = await this.supabaseFrases
                    .from('view_usos_pessoais')
                    .select('frase_id, qtd_uso')
                    .eq('usuario', MinhaArea.usuario.username);

                if (stats) {
                    stats.forEach(s => meusUsosMap[s.frase_id] = s.qtd_uso);
                }
            }

            this.cacheFrases = (frases || []).map(f => ({
                ...f,
                meus_usos: meusUsosMap[f.id] || 0,
                _busca: this.normalizar(f.conteudo + f.empresa + f.motivo + f.documento)
            }));

            // Ordenação: Admin vê global, Colaborador vê pessoal
            if (MinhaArea.isAdmin()) {
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

        if (termo) filtrados = filtrados.filter(f => f._busca.includes(termo));
        if (valEmpresa) filtrados = filtrados.filter(f => f.empresa === valEmpresa);
        if (valMotivo) filtrados = filtrados.filter(f => f.motivo === valMotivo);
        if (valDoc) filtrados = filtrados.filter(f => f.documento === valDoc);

        this.renderizar(filtrados);
    },

    renderizar: function (lista) {
        const grid = document.getElementById('grid-frases');
        if (!grid) return;

        if (!lista.length) {
            grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10 font-bold bg-white rounded-xl border border-slate-100 italic">Nenhuma frase encontrada para os filtros aplicados.</div>';
            return;
        }

        grid.innerHTML = lista.map(f => {
            const me = MinhaArea.isAdmin() ? false : true;
            const textoContador = MinhaArea.isAdmin()
                ? `${f.usos || 0} usos na empresa`
                : (f.meus_usos > 0 ? `${f.meus_usos} vezes usado por mim` : `${f.usos || 0} usos na empresa`);
            const iconeContador = MinhaArea.isAdmin() ? "fa-chart-line text-blue-600" : (f.meus_usos > 0 ? "fa-user-check text-blue-500" : "fa-globe text-slate-400");

            return `
                <div id="card-frase-${f.id}" class="flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 group overflow-hidden">
                    <div class="px-5 pt-4 pb-3 border-b border-slate-50 bg-slate-50/50 flex justify-between items-start">
                        <div class="flex-1 pr-3">
                            <div class="flex flex-wrap gap-2 mb-1.5">
                                <span class="bg-blue-50 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider border border-blue-100">${f.empresa || 'Geral'}</span>
                                <span class="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-slate-200">${f.documento || 'DOC'}</span>
                            </div>
                            <h4 class="font-extrabold text-slate-800 text-sm leading-tight">${f.motivo || 'Motivo'}</h4>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                            <button onclick="MinhaArea.Biblioteca.copiarTexto('${f.id}')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5"><i class="far fa-copy"></i> Copiar</button>
                            ${MinhaArea.isAdmin() ? `
                                <button onclick="MinhaArea.Biblioteca.prepararEdicao('${f.id}')" class="bg-white border border-slate-200 text-slate-400 hover:text-amber-500 px-2 py-1.5 rounded-lg transition shadow-sm"><i class="fas fa-pen"></i></button>
                                <button onclick="MinhaArea.Biblioteca.deletar('${f.id}')" class="bg-white border border-slate-200 text-slate-400 hover:text-rose-500 px-2 py-1.5 rounded-lg transition shadow-sm"><i class="fas fa-trash-alt"></i></button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="px-5 py-4 flex-grow"><p class="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed select-all">${f.conteudo}</p></div>
                    <div class="px-5 py-2 bg-slate-50 border-t border-slate-100">
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <i class="fas ${iconeContador}"></i> ${textoContador}
                        </span>
                    </div>
                </div>`;
        }).join('');
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
                await this.registrarLog('LOGIN', 'Acesso Diário (Via GupyMesa)');
                localStorage.setItem('gupy_ultimo_login_diario', hoje);
            }

            await this.registrarLog('COPIAR', String(id));

            // Atualização visual otimista
            f.usos = (f.usos || 0) + 1;
            f.meus_usos = (f.meus_usos || 0) + 1;
            this.renderizar(this.cacheFrases); // Simplificado: re-renderiza tudo para atualizar contadores
        });
    },

    registrarLog: async function (acao, desc) {
        try {
            await this.supabaseFrases.from('logs').insert([{
                usuario: MinhaArea.usuario.username,
                acao: acao,
                descricao: desc,
                perfil: MinhaArea.isAdmin() ? 'admin' : 'user'
            }]);
        } catch (e) { }
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
    },

    updateSelect: function (id, list, label) {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = `<option value="">${label}</option>` + list.map(v => `<option value="${v}">${v}</option>`).join('');
    }
};
