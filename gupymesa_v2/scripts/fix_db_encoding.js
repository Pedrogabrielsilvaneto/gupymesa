require('dotenv').config();
const mysql = require('mysql2/promise');

const R = '\uFFFD';

const replacements = [
    { from: `padr${R}es`, to: 'padrões' },
    { from: `padr${R}o`, to: 'padrão' },
    { from: `certid${R}o`, to: 'certidão' },
    { from: `certid${R}es`, to: 'certidões' },
    { from: `est${R}`, to: 'está' },
    { from: `Est${R}`, to: 'Está' },
    { from: `3${R}`, to: '3º' },
    { from: `2${R}`, to: '2º' },
    { from: `1${R}`, to: '1º' },
    { from: `n${R}o`, to: 'não' },
    { from: `N${R}o`, to: 'Não' },
    { from: `s${R}o`, to: 'são' },
    { from: `S${R}o`, to: 'São' },
    { from: `v${R}lido`, to: 'válido' },
    { from: `v${R}lida`, to: 'válida' },
    { from: `inv${R}lido`, to: 'inválido' },
    { from: `inv${R}lida`, to: 'inválida' },
    { from: `obrigat${R}rio`, to: 'obrigatório' },
    { from: `obrigat${R}ria`, to: 'obrigatória' },
    { from: `necess${R}rio`, to: 'necessário' },
    { from: `necess${R}ria`, to: 'necessária' },
    { from: `rescis${R}o`, to: 'rescisão' },
    { from: `admiss${R}o`, to: 'admissão' },
    { from: `f${R}rias`, to: 'férias' },
    { from: `benef${R}cio`, to: 'benefício' },
    { from: `experi${R}ncia`, to: 'experiência' },
    { from: `fun${R}${R}o`, to: 'função' },
    { from: `fun${R}o`, to: 'função' },
    { from: `sal${R}rio`, to: 'salário' },
    { from: `m${R}s`, to: 'mês' },
    { from: `atrav${R}s`, to: 'através' },
    { from: `voc${R}`, to: 'você' },
    { from: `ol${R}`, to: 'olá' },
    { from: `Ol${R}`, to: 'Olá' },
    { from: `m${R}e`, to: 'mãe' },
    { from: `pr${R}-natal`, to: 'pré-natal' },
    { from: `declara${R}${R}o`, to: 'declaração' },
    { from: `declara${R}o`, to: 'declaração' },
    { from: `atualiza${R}${R}o`, to: 'atualização' },
    { from: `atualiza${R}o`, to: 'atualização' },
    { from: `comprova${R}${R}o`, to: 'comprovação' },
    { from: `comprova${R}o`, to: 'comprovação' },
    { from: `identifica${R}${R}o`, to: 'identificação' },
    { from: `identifica${R}o`, to: 'identificação' },
    { from: `informa${R}${R}o`, to: 'informação' },
    { from: `informa${R}o`, to: 'informação' },
    { from: `informa${R}${R}es`, to: 'informações' },
    { from: `informa${R}es`, to: 'informações' },
    { from: `observa${R}${R}o`, to: 'observação' },
    { from: `observa${R}o`, to: 'observação' },
    { from: `anota${R}${R}o`, to: 'anotação' },
    { from: `anota${R}o`, to: 'anotação' },
    { from: `aplica${R}${R}o`, to: 'aplicação' },
    { from: `aplica${R}o`, to: 'aplicação' },
    { from: `avalia${R}${R}o`, to: 'avaliação' },
    { from: `avalia${R}o`, to: 'avaliação' },
    { from: `situa${R}${R}o`, to: 'situação' },
    { from: `situa${R}o`, to: 'situação' },
    { from: `crian${R}a`, to: 'criança' },
    { from: `crian${R}as`, to: 'crianças' },
    { from: `aten${R}${R}o`, to: 'atenção' },
    { from: `aten${R}o`, to: 'atenção' },
    { from: `op${R}${R}o`, to: 'opção' },
    { from: `op${R}o`, to: 'opção' },
    { from: `exce${R}${R}o`, to: 'exceção' },
    { from: `exce${R}o`, to: 'exceção' },
    { from: `inconsist${R}ncia`, to: 'inconsistência' },
    { from: `pend${R}ncia`, to: 'pendência' },
    { from: `v${R}nculo`, to: 'vínculo' }
];

async function runFix() {
    const connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        port: process.env.TIDB_PORT || 4000,
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
    });

    console.log("Iniciando correção na tabela assertividade com codificação Unicode \uFFFD...");

    try {
        for (const rep of replacements) {

            // Observacao
            const [resObs] = await connection.query(
                `UPDATE assertividade SET observacao = REPLACE(observacao, ?, ?) WHERE observacao LIKE ?`,
                [rep.from, rep.to, `%${rep.from}%`]
            );

            // Doc_name
            const [resDoc] = await connection.query(
                `UPDATE assertividade SET doc_name = REPLACE(doc_name, ?, ?) WHERE doc_name LIKE ?`,
                [rep.from, rep.to, `%${rep.from}%`]
            );

            if (resObs.affectedRows > 0 || resDoc.affectedRows > 0) {
                console.log(`Substituído <${rep.from}> -> <${rep.to}> | Obs: ${resObs.affectedRows} | Doc: ${resDoc.affectedRows}`);
            }
        }

        console.log("Processo concluído no banco de dados!");
    } catch (err) {
        console.error("Erro:", err);
    } finally {
        await connection.end();
    }
}

runFix();
