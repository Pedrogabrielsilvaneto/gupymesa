/* ARQUIVO: js/gestao/importacao/assertividade.js */
window.Gestao = window.Gestao || {};
window.Gestao.Importacao = window.Gestao.Importacao || {};

// --- MÓDULO DE INTELIGÊNCIA DE DATAS (Mantido V116) ---
Gestao.Importacao.Datas = {
    feriadosFixos: ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'],
    getFeriadosMoveis: function (ano) {
        const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
        const pascoa = new Date(ano, month - 1, day);
        const carnaval = new Date(pascoa); carnaval.setDate(pascoa.getDate() - 47);
        const corpus = new Date(pascoa); corpus.setDate(pascoa.getDate() + 60);
        const sextaSanta = new Date(pascoa); sextaSanta.setDate(pascoa.getDate() - 2);
        const fmt = d => d.toISOString().split('T')[0].slice(5);
        return [fmt(carnaval), fmt(sextaSanta), fmt(corpus)];
    },
    ehFimDeSemana: function (data) { const dia = data.getDay(); return dia === 0 || dia === 6; },
    ehFeriado: function (data) {
        const mesDia = data.toISOString().split('T')[0].slice(5);
        if (this.feriadosFixos.includes(mesDia)) return true;
        return this.getFeriadosMoveis(data.getFullYear()).includes(mesDia);
    },
    ehDiaUtil: function (data) { return !this.ehFimDeSemana(data) && !this.ehFeriado(data); },
    calcularCompetencia: function (dataISO) {
        if (!dataISO) return null;
        let data = new Date(dataISO + 'T12:00:00');
        if (this.ehDiaUtil(data)) return dataISO;
        let anterior = new Date(data);
        while (!this.ehDiaUtil(anterior)) anterior.setDate(anterior.getDate() - 1);
        const ultimoDiaMesAnterior = new Date(anterior.getFullYear(), anterior.getMonth() + 1, 0).getDate();
        if (anterior.getDate() === ultimoDiaMesAnterior) {
            let proximo = new Date(data);
            while (!this.ehDiaUtil(proximo)) proximo.setDate(proximo.getDate() + 1);
            return proximo.toISOString().split('T')[0];
        } else {
            return anterior.toISOString().split('T')[0];
        }
    }
};

// --- IMPORTADOR PRINCIPAL ---

Gestao.Importacao.Assertividade = {

    // 🚀 LOTE TURBO: 2000 por lote (2000×25=50000 placeholders, limite TiDB: 65535)
    LOTE_SIZE: 2000,

    mesesMap: { 'janeiro': 1, 'jan': 1, 'fevereiro': 2, 'fev': 2, 'marco': 3, 'março': 3, 'mar': 3, 'abril': 4, 'abr': 4, 'maio': 5, 'mai': 5, 'junho': 6, 'jun': 6, 'julho': 7, 'jul': 7, 'agosto': 8, 'ago': 8, 'setembro': 9, 'set': 9, 'outubro': 10, 'out': 10, 'novembro': 11, 'nov': 11, 'dezembro': 12, 'dez': 12 },

    mapaColunas: {
        'end_time': 'end_time_raw', 'ID PPC': 'id_ppc', 'Company_id': 'company_id', 'Schema_id': 'schema_id',
        'Empresa': 'empresa_nome', 'Assistente': 'assistente_nome', 'Auditora': 'auditora_nome',
        'doc_name': 'doc_name', 'DOCUMENTO': 'tipo_documento', 'STATUS': 'status', 'Nome da PPC': 'nome_ppc',
        'Apontamentos/obs': 'observacao', 'Fila': 'fila', 'Revalidação': 'revalidacao',
        'nº Campos': 'qtd_campos', 'Ok': 'qtd_ok', 'Nok': 'qtd_nok',
        'Quantidade_documentos_validados': 'qtd_docs_validados', '% Assert': 'porcentagem_assertividade',
        'id_assistente': 'usuario_id', 'Data da Auditoria': 'data_auditoria'
    },

    // --- UI: MODAL DE PROGRESSO ---
    injetarModal: function () {
        if (document.getElementById('modal-progresso-impt')) return;
        const html = `
        <div id="modal-progresso-impt" class="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center hidden">
            <div class="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg border border-slate-200 relative animate-fade-in-down">
                <h3 class="text-xl font-bold text-slate-800 mb-6 flex items-center justify-center">
                    <i class="fas fa-bolt fa-spin text-amber-500 mr-3 text-2xl" id="icone-loading"></i>
                    <span id="titulo-modal">Importação Turbo...</span>
                </h3>
                <div class="w-full bg-slate-100 rounded-full h-6 mb-3 overflow-hidden border border-slate-200 shadow-inner">
                    <div id="barra-progresso" class="bg-amber-500 h-6 rounded-full transition-all duration-300 ease-out flex items-center justify-center shadow-lg relative" style="width: 0%">
                        <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                        <span id="label-percent" class="text-[10px] text-white font-bold px-2 relative z-10 tracking-wider">0%</span>
                    </div>
                </div>
                <p id="texto-status" class="text-sm text-slate-600 font-mono mt-3 text-center border-t pt-3 border-slate-100">Iniciando...</p>
                <button id="btn-fechar-progresso" onclick="Gestao.Importacao.Assertividade.fecharModal()" class="mt-6 w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-lg hidden transition shadow-md">Fechar</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    mostrarProgresso: async function (percentual, texto, tipo = 'normal') {
        this.injetarModal();
        const modal = document.getElementById('modal-progresso-impt');
        const barra = document.getElementById('barra-progresso');
        const label = document.getElementById('label-percent');
        const txt = document.getElementById('texto-status');
        const icone = document.getElementById('icone-loading');
        const titulo = document.getElementById('titulo-modal');
        const btn = document.getElementById('btn-fechar-progresso');

        modal.classList.remove('hidden');
        const perc = Math.min(100, Math.max(0, Math.round(percentual)));
        barra.style.width = `${perc}%`;
        label.innerText = `${perc}%`;
        txt.innerHTML = texto;

        if (tipo === 'erro') {
            barra.className = 'bg-rose-500 h-6 rounded-full relative overflow-hidden';
            icone.className = 'fas fa-times-circle text-rose-600 mr-3 text-2xl';
            titulo.innerText = 'Erro na Importação';
            btn.classList.remove('hidden');
        } else if (tipo === 'sucesso') {
            barra.className = 'bg-emerald-500 h-6 rounded-full relative overflow-hidden';
            icone.className = 'fas fa-check-circle text-emerald-600 mr-3 text-2xl';
            titulo.innerText = 'Importação Concluída!';
            btn.classList.remove('hidden');
            btn.className = 'mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition';
            btn.innerText = 'Concluir';
        } else {
            barra.className = 'bg-amber-500 h-6 rounded-full relative overflow-hidden';
            icone.className = 'fas fa-bolt fa-spin text-amber-600 mr-3 text-2xl';
            titulo.innerText = 'Processando (Turbo)...';
            btn.classList.add('hidden');
        }
        await new Promise(r => setTimeout(r, 10));
    },

    fecharModal: function () {
        const modal = document.getElementById('modal-progresso-impt');
        if (modal) modal.classList.add('hidden');
        const input = document.getElementById('file-upload-assertividade') || document.querySelector('input[type="file"]');
        if (input) input.value = '';
    },

    // --- FLUXO PRINCIPAL ---

    processarArquivo: async function (input) {
        const arquivo = input.files[0];
        if (!arquivo) return;

        const infoPeriodo = this.extrairPeriodoDoNome(arquivo.name);
        if (!infoPeriodo) {
            alert("⚠️ Nome inválido! Use 'Mês Ano.csv' (ex: 'Janeiro 2026.csv')");
            input.value = '';
            return;
        }

        if (!confirm(`🚀 IMPORTAÇÃO TURBO (V118)\n\nArquivo: ${arquivo.name}\nPeríodo: ${infoPeriodo.texto}\nLote: 5.000 registros (Alta Performance)\n\nO sistema tentará ajustar datas e usar velocidade máxima.\nDeseja iniciar?`)) {
            input.value = '';
            return;
        }

        this.injetarModal();
        await this.mostrarProgresso(0, "Lendo CSV (Modo Rápido)...", 'normal');

        Papa.parse(arquivo, {
            header: true,
            skipEmptyLines: true,
            encoding: "UTF-8",
            complete: async (results) => {
                try {
                    await this.executarFluxoCompleto(results.data, input, infoPeriodo);
                } catch (error) {
                    console.error("Erro Fluxo:", error);
                    await this.mostrarProgresso(100, `Erro Fatal: ${error.message}`, 'erro');
                }
            },
            error: (err) => {
                console.error("Erro CSV:", err);
                this.mostrarProgresso(100, "Falha na leitura do CSV.", 'erro');
            }
        });
    },

    executarFluxoCompleto: async function (linhasBrutas, inputElement, infoPeriodo) {
        await this.limparCompetenciaDiaADia(infoPeriodo);

        await this.mostrarProgresso(16, "Calculando Datas (Inteligência Artificial)...", 'normal');
        await new Promise(r => setTimeout(r, 100));

        const dadosValidos = [];
        const chavesReais = Object.keys(linhasBrutas[0] || {});
        const mapaChaves = {};
        for (const chaveConfig in this.mapaColunas) {
            const chaveEncontrada = chavesReais.find(k => k.trim().toUpperCase() === chaveConfig.toUpperCase());
            if (chaveEncontrada) mapaChaves[chaveConfig] = chaveEncontrada;
        }

        const chunkSize = 10000;
        let diasAjustadosCount = 0;

        for (let i = 0; i < linhasBrutas.length; i += chunkSize) {
            const chunk = linhasBrutas.slice(i, i + chunkSize);
            chunk.forEach((row) => {
                try {
                    const getVal = (keyConfig) => {
                        const realKey = mapaChaves[keyConfig];
                        return realKey ? row[realKey] : undefined;
                    };
                    const rawTime = getVal('end_time') || row['END_TIME'] || row['Data'];
                    const dataPura = this.extrairDataPura(rawTime);
                    const dataCompetencia = Gestao.Importacao.Datas.calcularCompetencia(dataPura);
                    if (dataPura !== dataCompetencia) diasAjustadosCount++;
                    const idAssistenteCsv = this.limparInteiro(getVal('id_assistente'));
                    const idPpc = this.limparBigIntString(getVal('ID PPC'));

                    if (!dataCompetencia || !idPpc) return;

                    const registro = {
                        id_ppc: idPpc, data_referencia: dataCompetencia, end_time_raw: rawTime, usuario_id: idAssistenteCsv,
                        company_id: this.limparBigIntString(getVal('Company_id')), schema_id: this.limparBigIntString(getVal('Schema_id')),
                        empresa_nome: this.limparTexto(getVal('Empresa')), assistente_nome: this.limparTexto(getVal('Assistente')),
                        auditora_nome: this.limparTexto(getVal('Auditora')), doc_name: this.limparTexto(getVal('doc_name') || getVal('DOCUMENTO')),
                        status: this.limparTexto(getVal('STATUS')), nome_ppc: this.limparTexto(getVal('Nome da PPC')),
                        observacao: this.limparTexto(getVal('Apontamentos/obs')), fila: this.limparTexto(getVal('Fila')),
                        revalidacao: this.limparTexto(getVal('Revalidação')), tipo_documento: this.limparTexto(getVal('DOCUMENTO')),
                        data_auditoria: this.limparTexto(getVal('Data da Auditoria')), qtd_campos: this.limparInteiro(getVal('nº Campos')),
                        qtd_ok: this.limparInteiro(getVal('Ok')), qtd_nok: this.limparInteiro(getVal('Nok')),
                        qtd_docs_validados: this.limparInteiro(getVal('Quantidade_documentos_validados')), porcentagem_assertividade: getVal('% Assert'),
                        assertividade_val: this.limparDecimal(getVal('% Assert'))
                    };

                    Object.keys(registro).forEach(k => { if (registro[k] === undefined || registro[k] === "") registro[k] = null; });
                    dadosValidos.push(registro);
                } catch (e) { }
            });
            if (i % 20000 === 0) await this.mostrarProgresso(16 + ((i / linhasBrutas.length) * 4), `Processando linha ${i.toLocaleString()}...`);
        }

        if (dadosValidos.length === 0) throw new Error("Arquivo vazio ou inválido.");
        console.log(`ℹ️ Ajuste de Datas: ${diasAjustadosCount} registros movidos.`);
        await this.inserirLotesComProgresso(dadosValidos);
    },

    limparCompetenciaDiaADia: async function (info) {
        const dataInicial = new Date(info.inicio + 'T00:00:00');
        const dataFinal = new Date(info.fim + 'T00:00:00');
        const diffTime = Math.abs(dataFinal - dataInicial);
        const totalDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        let diaAtual = 1;

        for (let d = new Date(dataInicial); d <= dataFinal; d.setDate(d.getDate() + 1)) {
            const dataStr = d.toISOString().split('T')[0];
            const diaDisplay = dataStr.split('-').reverse().join('/');
            const progressoFase = (diaAtual / totalDias) * 15;
            await this.mostrarProgresso(progressoFase, `Limpando histórico: <b>${diaDisplay}</b>`);

            try {
                // Timeout manual para evitar travamento eterno
                const sqlDelete = `DELETE FROM assertividade WHERE data_referencia = ?`;
                const resultado = await Promise.race([
                    Sistema.query(sqlDelete, [dataStr]),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
                ]);
                if (resultado === null) throw new Error("Falha ao limpar histórico.");
            } catch (err) {
                console.warn(`Retry limpeza ${dataStr}...`);
                await new Promise(r => setTimeout(r, 1500));
                const sqlDelete = `DELETE FROM assertividade WHERE data_referencia = ?`;
                const resultado = await Sistema.query(sqlDelete, [dataStr]);
                if (resultado === null) throw new Error("Falha ao limpar histórico após retry.");
            }
            diaAtual++;
        }
    },

    inserirLotesComProgresso: async function (dados) {
        let processados = 0;
        let erros = 0;
        const total = dados.length;
        const totalLotes = Math.ceil(total / this.LOTE_SIZE);
        const BASE_PERC = 20, RANGE_PERC = 80;

        for (let i = 0; i < total; i += this.LOTE_SIZE) {
            const lote = dados.slice(i, i + this.LOTE_SIZE);
            const qtdLote = lote.length;
            const numLote = Math.floor(i / this.LOTE_SIZE) + 1;
            const percGlobal = BASE_PERC + ((processados / total) * RANGE_PERC);

            await this.mostrarProgresso(percGlobal, `Gravando Lote <b>${numLote}/${totalLotes}</b> (${qtdLote} reg)...`);

            // --- TENTATIVA COM RETRY ---
            let sucesso = false;
            let tentativas = 0;

            while (!sucesso && tentativas < 3) {
                try {
                    // Monta SQL INSERT para TiDB com múltiplos valores
                    const campos = Object.keys(lote[0] || {});
                    if (campos.length === 0) {
                        sucesso = true;
                        continue;
                    }

                    const sql = `
                        INSERT INTO assertividade (
                            ${campos.join(', ')}
                        ) VALUES
                        ${lote.map(() => `(${campos.map(() => '?').join(', ')})`).join(', ')}
                    `;

                    const params = [];
                    for (const registro of lote) {
                        campos.forEach(campo => {
                            params.push(registro[campo] !== undefined && registro[campo] !== '' ? registro[campo] : null);
                        });
                    }

                    const result = await Sistema.query(sql, params);
                    if (result === null) throw new Error("Falha ao inserir lote.");
                    sucesso = true;
                } catch (err) {
                    tentativas++;
                    console.warn(`⚠️ Falha Lote ${numLote} (Tentativa ${tentativas}/3): ${err.message}`);
                    // Se for erro de timeout, espera e tenta de novo
                    if (tentativas < 3) {
                        await this.mostrarProgresso(percGlobal, `Reenviando Lote ${numLote} (Tentativa ${tentativas + 1})...`, 'normal');
                        await new Promise(r => setTimeout(r, 3000)); // Espera 3s
                    } else {
                        console.error(`Erro Final Lote ${numLote}:`, err);
                        erros += qtdLote;
                    }
                }
            }

            if (sucesso) processados += qtdLote;
        }

        if (erros === 0) {
            await this.mostrarProgresso(100, `Sucesso! <b>${processados.toLocaleString()}</b> registros importados.`, 'sucesso');
            if (window.Gestao && Gestao.Assertividade) Gestao.Assertividade.carregar();
        } else {
            await this.mostrarProgresso(100, `Finalizado com <b>${erros}</b> erros (veja console).`, 'erro');
        }
    },

    extrairDataPura: function (v) {
        if (!v) return null;
        const str = String(v).trim();
        if (str.includes('T')) return str.split('T')[0];
        if (str.includes('/')) {
            const p = str.split('/');
            if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`;
        }
        return str.match(/^\d{4}-\d{2}-\d{2}$/) ? str : null;
    },

    limparTexto: function (v) { return (v === null || v === undefined || String(v).trim() === '') ? null : String(v).trim(); },

    limparBigIntString: function (v) { if (!v) return null; const str = String(v).replace(/\D/g, ''); return str === "" ? null : str; },

    limparInteiro: function (v) { if (!v) return null; const n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? null : n; },

    limparDecimal: function (v) { if (!v) return null; const s = String(v).replace('%', '').replace(',', '.').trim(); const f = parseFloat(s); return isNaN(f) ? null : f; },

    extrairPeriodoDoNome: function (nomeArquivo) {
        const nomeLimpo = nomeArquivo.replace(/\.csv$/i, '').trim().toLowerCase();
        const regex = /^([a-zç]+)[\s_-]+(\d{2,4})$/;
        const match = nomeLimpo.match(regex);
        if (!match) return null;
        const nomeMes = match[1];
        let anoStr = match[2];
        if (anoStr.length === 2) anoStr = '20' + anoStr;
        const ano = parseInt(anoStr);
        const mes = this.mesesMap[nomeMes];
        if (!mes) return null;
        const dataInicio = new Date(ano, mes - 1, 1);
        const dataFim = new Date(ano, mes, 0);
        const fmt = (d) => d.toISOString().split('T')[0];
        return { mes, ano, texto: `${nomeMes.toUpperCase()}/${ano}`, inicio: fmt(dataInicio), fim: fmt(dataFim) };
    }
};

console.log("🚀 Importador V118 (Turbo 5000 + Retry System) carregado.");