// ARQUIVO: js/produtividade/importacao/validacao.js

window.Produtividade = window.Produtividade || {};
window.Produtividade.Importacao = window.Produtividade.Importacao || {};

window.Produtividade.Importacao.Validacao = {
    dadosProcessados: [],

    init: function () {
        console.log("🚀 GupyMesa: Engine Importação V3.0 (Smart Headers)");
    },

    /**
     * MANTIDO CONFORME REGRA DE NEGÓCIO:
     * A data DEVE vir do nome do arquivo (ex: 01122025.csv).
     */
    /**
     * Extrai a data do nome do arquivo (Formato ESTRITO: ddmmaaaa.csv)
     */
    extrairDataDoNome: function (nome) {
        // Regex ESTRITA para DDMMAAAA (8 dígitos seguidos)
        const match = nome.match(/^(\d{2})(\d{2})(\d{4})\.csv$/i);
        if (match) {
            let [_, dia, mes, ano] = match;
            return `${ano}-${mes}-${dia}`;
        }
        // Tenta pegar apenas ocorrência de 8 dígitos se não for exato o nome
        const matchLoose = nome.match(/(\d{2})(\d{2})(\d{4})/);
        if (matchLoose) {
            let [_, dia, mes, ano] = matchLoose;
            return `${ano}-${mes}-${dia}`;
        }
        return null;
    },

    processar: async function (input) {
        const files = Array.from(input.files);
        if (files.length === 0) return;

        this.dadosProcessados = [];
        const statusEl = document.getElementById('status-importacao-prod');
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.innerHTML = `<span class="text-blue-500"><i class="fas fa-spinner fa-spin"></i> Analisando arquivos...</span>`;
        }

        let arquivosIgnorados = 0;
        let arquivosProcessados = 0;
        let datasParaImportar = new Set();
        let arquivosValidos = [];

        // 1. Pré-análise: Coletar datas e filtrar nomes inválidos
        for (const file of files) {
            const dataRef = this.extrairDataDoNome(file.name);
            if (!dataRef) {
                console.warn(`⚠️ Ignorado (Nome inválido): ${file.name}`);
                arquivosIgnorados++;
                continue;
            }
            datasParaImportar.add(dataRef);
            arquivosValidos.push({ file, dataRef });
        }

        if (datasParaImportar.size === 0) {
            alert(`Nenhum arquivo válido encontrado.\nCertifique-se que o nome segue o padrão DDMMAAAA.csv (ex: 01012026.csv).`);
            if (statusEl) statusEl.innerHTML = "";
            return;
        }

        // 2. Verificar Duplicidade em Massa
        const datasArray = Array.from(datasParaImportar);
        const datasExistentes = await this.verificarDuplicidadeMassa(datasArray);

        if (datasExistentes.length > 0) {
            const msg = `⚠️ ATENÇÃO: Encontramos dados já importados para as seguintes datas:\n\n` +
                datasExistentes.map(d => `📅 ${d.split('-').reverse().join('/')}`).join('\n') +
                `\n\nDeseja EXCLUIR os dados antigos dessas datas e SUBSTITUIR pelos novos arquivos?\n` +
                `(Essa ação não pode ser desfeita)`;

            if (!confirm(msg)) {
                alert("Importação cancelada pelo usuário.");
                if (statusEl) statusEl.innerHTML = "";
                input.value = '';
                return;
            }

            // 3. Auto-Delete (Se confirmado)
            if (statusEl) statusEl.innerHTML = `<span class="text-rose-500"><i class="fas fa-trash"></i> Removendo dados antigos...</span>`;
            await this.excluirDadosMassa(datasExistentes);
        }

        // 4. Processamento Normal
        if (statusEl) statusEl.innerHTML = `<span class="text-blue-500"><i class="fas fa-spinner fa-spin"></i> Sincronizando usuários...</span>`;
        
        const resUsers = await Sistema.query("SELECT id, nome FROM usuarios WHERE ativo = 1");
        // [FIX v5.7] Cache como nome → [array de IDs] para tratar nomes duplicados
        this.cacheUsuarios = {};
        (resUsers || []).forEach(u => {
            if (!u.nome) return;
            const chave = u.nome.trim().toUpperCase();
            if (!this.cacheUsuarios[chave]) this.cacheUsuarios[chave] = [];
            this.cacheUsuarios[chave].push(u.id);
        });

        if (statusEl) statusEl.innerHTML = `<span class="text-blue-500"><i class="fas fa-spinner fa-spin"></i> Detectando codificação...</span>`;

        for (const item of arquivosValidos) {
            // Detecta encoding para cada arquivo (pode variar)
            const encoding = await this.detectarEncoding(item.file);
            console.log(`📡 Codificação para ${item.file.name}: ${encoding}`);

            if (statusEl) statusEl.innerHTML = `<span class="text-blue-500"><i class="fas fa-spinner fa-spin"></i> Lendo (${encoding}) ${item.file.name}...</span>`;

            await new Promise(resolve => {
                Papa.parse(item.file, {
                    header: true,
                    skipEmptyLines: true,
                    encoding: encoding,
                    transformHeader: h => h.trim().toLowerCase()
                        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
                        .replace(/\s+/g, '_') // Espaços para underscore
                        .replace(/[^a-z0-9_]/g, ''), // Remove caracteres especiais
                    complete: (res) => {
                        this.prepararDados(res.data, item.dataRef, item.file.name);
                        arquivosProcessados++;
                        resolve();
                    },
                    error: (err) => {
                        console.error(`❌ Erro PapaParse (${item.file.name}):`, err);
                        resolve();
                    }
                });
            });
        }

        this.finalizarAnalise(files.length, arquivosIgnorados, 0); // 0 duplicados pois foram tratados
        input.value = '';
    },

    verificarDuplicidadeMassa: async function (datas) {
        if (datas.length === 0) return [];
        // Constrói query dinâmica: SELECT DISTINCT data_referencia WHERE data_referencia IN (?, ?, ?)
        const placeholders = datas.map(() => '?').join(',');
        const sql = `SELECT DISTINCT data_referencia FROM producao WHERE data_referencia IN (${placeholders})`;
        try {
            const res = await Sistema.query(sql, datas);
            return res ? res.map(r => r.data_referencia) : [];
        } catch (e) {
            console.error("Erro check duplicidade massa:", e);
            return [];
        }
    },

    excluirDadosMassa: async function (datas) {
        if (datas.length === 0) return;
        const placeholders = datas.map(() => '?').join(',');
        const sql = `DELETE FROM producao WHERE data_referencia IN (${placeholders})`;
        try {
            await Sistema.query(sql, datas);
            console.log("✅ Dados antigos excluídos para:", datas);
        } catch (e) {
            console.error("Erro auto-delete:", e);
            alert("Erro ao excluir dados antigos: " + e.message);
            throw e; // Interrompe fluxo
        }
    },

    verificarDuplicidade: async function (data) {
        try {
            // Verifica se existe pelo menos 1 registro para essa data
            const res = await Sistema.query("SELECT id FROM producao WHERE data_referencia = ? LIMIT 1", [data]);
            return res && res.length > 0;
        } catch (e) {
            console.error("Erro ao verificar duplicidade:", e);
            return false; // Na dúvida, deixa passar (ou bloqueia, dependo da segurança)
        }
    },

    prepararDados: function (linhas, dataFixa, fileName) {
        if (!linhas || linhas.length === 0) return;

        // DEBUG: Mostra headers encontrados para ajudar a diagnosticar CSVs novos
        const headers = Object.keys(linhas[0]);
        console.log(`📂 Arquivo: ${fileName} | Headers:`, headers);

        linhas.forEach(row => {
            // Lista expandida de sinônimos para IDs e Nomes
            let idRaw = row['id_assistente'] || row['usuario_id'] || row['id'] || row['matricula'] || row['codigo_assistente'] || row['codigo'] || row['id_usuario'];
            let assistenteNome = row['assistente'] || row['nome'] || row['nome_do_assistente'] || row['colaborador'] || row['vendedor'] || row['nome_completo'];

            // Ignora linha de totais ou vazias
            if (!idRaw || (assistenteNome && assistenteNome.toLowerCase().includes('total'))) return;

            let usuarioId = parseInt(idRaw.toString().replace(/\D/g, ''));
            
            // [FIX v5.7] Só substitui o ID pelo nome se houver UMA correspondência única
            // Se houver nomes duplicados, mantém o ID original do CSV (ID sempre vence)
            if (assistenteNome && this.cacheUsuarios) {
                const nomeBusca = assistenteNome.trim().toUpperCase();
                const idsEncontrados = this.cacheUsuarios[nomeBusca];
                if (idsEncontrados && idsEncontrados.length === 1) {
                    // Nome único, substitui com segurança
                    usuarioId = idsEncontrados[0];
                } else if (idsEncontrados && idsEncontrados.length > 1 && !isNaN(usuarioId)) {
                    // Nome ambíguo: usa o ID do CSV se ele estiver na lista de IDs válidos
                    if (idsEncontrados.includes(usuarioId) || idsEncontrados.includes(String(usuarioId))) {
                        // ID do CSV bate com um dos cadastros, mantém
                    } else {
                        // ID do CSV não bate: usa o primeiro ID (fallback)
                        usuarioId = idsEncontrados[0];
                    }
                }
            }

            if (isNaN(usuarioId)) return;

            // --- SMART MAPPING (Correção da Fragilidade) ---
            // Tenta encontrar o valor em colunas com nomes variados
            const getVal = (chaves) => {
                for (let k of chaves) if (row[k] !== undefined && row[k] !== "") return parseInt(row[k]);
                return 0;
            };

            this.dadosProcessados.push({
                usuario_id: usuarioId,
                data_referencia: dataFixa,

                // Busca em lista de sinônimos para evitar quebra se mudar o CSV
                // As chaves já chegam aqui com underscore e sem acento pelo transformHeader
                quantidade: getVal(['documentos_validados', 'quantidade', 'qtd', 'total_validados', 'validados']),
                fifo: getVal(['documentos_validados_fifo', 'fifo', 'qtd_fifo', 'fifo_total']),
                gradual_total: getVal(['documentos_validados_gradual_total', 'gradual_total', 'gt', 'gradual_total_v2']),
                gradual_parcial: getVal(['documentos_validados_gradual_parcial', 'gradual_parcial', 'gp', 'gradual_parcial_v2']),
                perfil_fc: getVal(['documentos_validados_perfil_fc', 'perfil_fc', 'fc', 'perfil_fc_v2']),

                fator: 1, // Padrão 1 (Dia completo)
                status: 'OK'
            });
        });
    },

    finalizarAnalise: function (totalArquivos, ignorados, duplicados) {
        const statusEl = document.getElementById('status-importacao-prod');

        if (this.dadosProcessados.length === 0) {
            let msgErro = "❌ Nenhum dado válido para importar!";
            if (ignorados > 0) msgErro += `\n\n• ${ignorados} arquivo(s) com nome inválido (Use DDMMAAAA.csv).`;
            if (duplicados > 0) msgErro += `\n• ${duplicados} arquivo(s) já importados anteriormente (Bloqueados).`;

            alert(msgErro);
            if (statusEl) statusEl.innerHTML = "";
            return;
        }

        const datasUnicas = [...new Set(this.dadosProcessados.map(d => d.data_referencia))].sort();
        const range = datasUnicas.length > 1
            ? `${datasUnicas[0]} até ${datasUnicas[datasUnicas.length - 1]}`
            : datasUnicas[0];

        let msg = `Resumo da Importação:\n\n` +
            `✅ Arquivos Prontos: ${totalArquivos - ignorados - duplicados}\n` +
            `📅 Datas Identificadas: ${range}\n` +
            `📊 Linhas de Produção: ${this.dadosProcessados.length}\n`;

        if (ignorados > 0) msg += `⚠️ Ignorados (Nome Inválido): ${ignorados}\n`;
        if (duplicados > 0) msg += `⛔ Bloqueados (Já Existem): ${duplicados}\n`;

        msg += `\nConfirmar gravação no banco de dados?`;

        if (confirm(msg)) {
            this.salvarNoBanco();
        } else {
            if (statusEl) statusEl.innerHTML = "";
        }
    },

    salvarNoBanco: async function () {
        const statusEl = document.getElementById('status-importacao-prod');
        try {
            if (statusEl) statusEl.innerHTML = `<span class="text-orange-500"><i class="fas fa-sync fa-spin"></i> Gravando dados...</span>`;

            if (this.dadosProcessados.length === 0) return;

            const values = [];
            const placeholders = [];

            this.dadosProcessados.forEach(d => {
                const uuid = Sistema.gerarUUID ? Sistema.gerarUUID() : crypto.randomUUID();
                // Extrai MÊS e ANO da data_referencia (YYYY-MM-DD)
                const partesData = d.data_referencia.split('-'); // [2026, 02, 16]
                const anoRef = parseInt(partesData[0]);
                const mesRef = parseInt(partesData[1]);

                values.push(uuid, d.usuario_id, d.data_referencia, mesRef, anoRef, d.quantidade, d.fifo || 0, d.gradual_total || 0, d.gradual_parcial || 0, d.perfil_fc || 0, d.fator || 1, 'OK');
                placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            });

            const sql = `
                INSERT INTO producao (id, usuario_id, data_referencia, mes_referencia, ano_referencia, quantidade, fifo, gradual_total, gradual_parcial, perfil_fc, fator, status)
                VALUES ${placeholders.join(', ')}
                ON DUPLICATE KEY UPDATE
                    mes_referencia = VALUES(mes_referencia),
                    ano_referencia = VALUES(ano_referencia),
                    quantidade = VALUES(quantidade),
                    fifo = VALUES(fifo),
                    gradual_total = VALUES(gradual_total),
                    gradual_parcial = VALUES(gradual_parcial),
                    perfil_fc = VALUES(perfil_fc),
                    fator = VALUES(fator),
                    status = VALUES(status)
            `;

            console.log("🔍 [DEBUG] Inserindo produção SQL:", sql.substring(0, 200) + "...", "Values count:", values.length);

            const result = await Sistema.query(sql, values);
            console.log("🔍 [DEBUG] Resultado Insert:", result);

            if (result === null) throw new Error("Falha na gravação SQL.");

            alert("✅ Sucesso! Dados de produção atualizados.");

            // Força atualização da tela
            if (window.Produtividade.Geral?.carregarTela) window.Produtividade.Geral.carregarTela();
            if (window.Produtividade.Consolidado?.carregar) window.Produtividade.Consolidado.carregar(true);

        } catch (e) {
            console.error("Erro Upsert:", e);
            alert("Erro ao gravar no banco: " + (e.message || "Verifique sua conexão."));
        } finally {
            if (statusEl) statusEl.innerHTML = "";
        }
    },

    /**
     * Detecta codificação (UTF-8 vs ISO-8859-1)
     */
    detectarEncoding: function (file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const bytes = new Uint8Array(e.target.result);
                if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return resolve("UTF-8");
                try {
                    const decoder = new TextDecoder('utf-8', { fatal: true });
                    decoder.decode(bytes);
                    resolve("UTF-8");
                } catch (err) {
                    resolve("ISO-8859-1");
                }
            };
            reader.readAsArrayBuffer(file.slice(0, 10000));
        });
    }
};

window.Produtividade.Importacao.Validacao.init();