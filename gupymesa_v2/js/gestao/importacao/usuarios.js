/* ARQUIVO: js/gestao/importacao/usuarios.js
   VERSÃO: V2.0 (Adaptado para CSV com colunas separadas: CONTRATO e FUNÇÃO)
*/

window.Gestao = window.Gestao || {};
window.Gestao.Importacao = window.Gestao.Importacao || {};

Gestao.Importacao.Usuarios = {
    executar: async function (input) {
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
                }
            });

        } catch (e) {
            console.error(e);
            alert("Erro crítico: " + e.message);
        }
    },

    processarDados: async function (linhas) {
        console.log(`📊 Linhas brutas: ${linhas.length}`);

        const mapUsuarios = new Map();
        // Gera o hash da senha padrão 'gupy123' uma única vez para performance
        const senhaPadraoHash = await Sistema.gerarHash("gupy123");

        for (const row of linhas) {
            // Função auxiliar para evitar erros de undefined e trimar espaços
            const getVal = (key) => {
                const val = row[key] || row[key.toUpperCase()] || '';
                return val.toString().trim();
            };

            const idRaw = getVal('ID ASSISTENTE');
            const nomeRaw = getVal('NOME ASSIST');

            // --- MAPEAMENTO DIRETO DA NOVA PLANILHA ---
            const contratoRaw = getVal('CONTRATO'); // Lê coluna CONTRATO (CLT/PJ)
            const funcaoRaw = getVal('FUNÇÃO');     // Lê coluna FUNÇÃO (Assistente/Auditora/Gestora)
            const situacaoRaw = getVal('SITUAÇÃO').toUpperCase();

            if (!idRaw || !nomeRaw) continue;

            const id = parseInt(idRaw);
            const ativo = situacaoRaw === 'ATIVO'; // Se for 'INATIVO' ou 'FINALIZADO', vira false

            // Tratamento Básico (caso venha vazio, aplica padrão)
            const funcaoFinal = funcaoRaw ? funcaoRaw.toUpperCase() : 'ASSISTENTE';
            let contratoFinal = contratoRaw ? contratoRaw.toUpperCase() : 'CLT';

            // Pequeno ajuste para garantir consistência no banco (Ex: "PJ " vira "PJ")
            if (contratoFinal.includes('PJ')) contratoFinal = 'PJ';
            else if (contratoFinal.includes('TEMP')) contratoFinal = 'Temporário';
            else contratoFinal = 'CLT';

            mapUsuarios.set(id, {
                id: id,
                nome: nomeRaw,
                funcao: funcaoFinal,             // Agora lê direto da coluna FUNÇÃO
                contrato: contratoFinal,         // Coluna real no TiDB
                situacao: ativo ? 'ATIVO' : 'INATIVO',
                senha: senhaPadraoHash,
                nivel_acesso: funcaoFinal === 'ADMIN' ? 3 : 1
            });
        }

        const listaUpsert = Array.from(mapUsuarios.values());
        console.log(`📉 Usuários processados: ${listaUpsert.length}`);

        if (listaUpsert.length > 0) {
            try {
                // Monta um único SQL de upsert para TiDB (MySQL compatível)
                // ON DUPLICATE KEY UPDATE usa a PK 'id' da tabela usuarios
                const sql = `
                    INSERT INTO usuarios (
                        id, nome, contrato, situacao, funcao, senha, nivel_acesso, ativo
                    ) VALUES
                    ${listaUpsert.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
                    ON DUPLICATE KEY UPDATE
                        nome         = VALUES(nome),
                        contrato     = VALUES(contrato),
                        situacao     = VALUES(situacao),
                        funcao       = VALUES(funcao),
                        senha        = VALUES(senha),
                        nivel_acesso = VALUES(nivel_acesso),
                        ativo        = VALUES(ativo)
                `;

                const params = [];
                for (const u of listaUpsert) {
                    params.push(
                        String(u.id),
                        u.nome,
                        u.contrato,
                        u.situacao,
                        u.funcao,
                        u.senha,
                        u.nivel_acesso,
                        u.situacao === 'ATIVO' ? 1 : 0
                    );
                }

                const result = await Sistema.query(sql, params);
                if (result === null) throw new Error("Falha ao salvar usuários.");

                alert(`✅ Importação concluída!\n\n${listaUpsert.length} usuários inseridos/atualizados no TiDB.`);
                if (Gestao.Usuarios) Gestao.Usuarios.carregar();
            } catch (e) {
                console.error("Erro ao importar usuários (TiDB):", e);
                alert("Erro ao salvar: " + (e.message || "Falha na importação."));
            }
        } else {
            alert("Nenhum dado válido encontrado no CSV.");
        }
    }
};