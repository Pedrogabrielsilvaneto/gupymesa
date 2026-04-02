window.Gestao = window.Gestao || {};
window.Gestao.Importacao = window.Gestao.Importacao || {};

Gestao.Importacao.Empresas = {
    executar: async function(input) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];

        const parentDiv = input.closest('div'); 
        const btnImportar = parentDiv ? parentDiv.querySelector('button') : null;
        let originalText = '';
        
        if (btnImportar) {
            originalText = btnImportar.innerHTML;
            btnImportar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Lendo CSV...';
            btnImportar.disabled = true;
            btnImportar.classList.add('opacity-75', 'cursor-not-allowed');
        }

        try {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: "UTF-8",
                complete: async (results) => {
                    await this.processarDados(results.data);
                    input.value = ""; 
                    if (btnImportar) {
                        btnImportar.innerHTML = originalText;
                        btnImportar.disabled = false;
                        btnImportar.classList.remove('opacity-75', 'cursor-not-allowed');
                    }
                },
                error: (error) => {
                    console.error(error);
                    alert("Erro ao ler CSV: " + error.message);
                    if (btnImportar) {
                        btnImportar.innerHTML = originalText;
                        btnImportar.disabled = false;
                        btnImportar.classList.remove('opacity-75', 'cursor-not-allowed');
                    }
                }
            });

        } catch (e) {
            console.error(e);
            alert("Erro crítico: " + e.message);
            if (btnImportar) {
                btnImportar.innerHTML = originalText;
                btnImportar.disabled = false;
                btnImportar.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    },

    processarDados: async function(linhas) {
        console.log(`📊 Linhas brutas: ${linhas.length}`);
        
        const upserts = [];

        for (const row of linhas) {
            // Normaliza chaves
            const c = {};
            Object.keys(row).forEach(k => c[this.normalizarChave(k)] = row[k]);

            // Campos Obrigatórios
            const id = parseInt(c['idempresa'] || c['id'] || 0);
            const nome = c['nome'] || c['empresa'] || '';
            
            if (!id || !nome) continue;

            // TRATAMENTO ROBUSTO DE DATA
            // Tenta ler colunas comuns para data
            const rawDate = c['entrouparamesa'] || c['dataentrada'] || c['inicio'] || c['data'];
            let dataEntrada = null;

            if (rawDate) {
                dataEntrada = this.parseData(rawDate);
            }

            upserts.push({
                id: id,
                nome: String(nome).trim(),
                subdominio: String(c['subdominio'] || '').trim().toLowerCase(),
                data_entrada: dataEntrada,
                observacao: String(c['obs'] || c['observacao'] || '').trim()
            });
        }

        console.log(`📉 Empresas processadas: ${upserts.length}`);

        if (upserts.length > 0) {
            try {
                // Monta SQL de upsert para TiDB
                const sql = `
                    INSERT INTO empresas (
                        id, nome, subdominio, data_entrada, observacao
                    ) VALUES
                    ${upserts.map(() => '(?, ?, ?, ?, ?)').join(', ')}
                    ON DUPLICATE KEY UPDATE
                        nome         = VALUES(nome),
                        subdominio   = VALUES(subdominio),
                        data_entrada = VALUES(data_entrada),
                        observacao   = VALUES(observacao)
                `;

                const params = [];
                for (const e of upserts) {
                    params.push(
                        e.id,
                        e.nome,
                        e.subdominio,
                        e.data_entrada,
                        e.observacao
                    );
                }

                const result = await Sistema.query(sql, params);
                if (result === null) throw new Error("Falha ao salvar empresas.");

                alert(`✅ Importação concluída!\n\n${upserts.length} empresas inseridas/atualizadas no TiDB.`);
                
                if (Gestao.Empresas && typeof Gestao.Empresas.carregar === 'function') {
                    Gestao.Empresas.carregar();
                }
            } catch (e) {
                console.error("Erro ao importar empresas (TiDB):", e);
                alert("Erro ao salvar: " + (e.message || "Falha na importação."));
            }
        } else {
            alert("Nenhuma empresa válida encontrada. Verifique as colunas 'ID Empresa' e 'Nome'.");
        }
    },

    // Função Auxiliar para converter qualquer formato de data para YYYY-MM-DD
    parseData: function(valor) {
        if (!valor) return null;

        // 1. Se for número (Excel Serial Date)
        if (typeof valor === 'number' && valor > 20000) {
            const date = new Date(Math.round((valor - 25569) * 864e5));
            return date.toISOString().split('T')[0];
        }

        // 2. Se for string
        const str = String(valor).trim();
        
        // Formato BR: DD/MM/YYYY
        if (str.includes('/')) {
            const partes = str.split('/');
            if (partes.length === 3) {
                // Assume dia/mes/ano
                return `${partes[2]}-${partes[1]}-${partes[0]}`;
            }
        }

        // Formato ISO ou Excel Texto: YYYY-MM-DD
        if (str.includes('-')) {
            // Pega apenas a parte da data (ignora hora se houver T)
            return str.split('T')[0];
        }

        return null;
    },

    normalizarChave: function(k) {
        return k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/ /g, '');
    }
};