/* ARQUIVO: js/sistema/assertividade.js */
/* Adaptado para TiDB (Sistema.query) - V2 */
window.Sistema = window.Sistema || {};

Sistema.Assertividade = {

    buscarPaginado: async function (filtros, pagina = 1, tamanho = 50) {
        let where = [];
        let params = [];
        let join = '';
        let selectPrefix = 'a.*';

        if (filtros.data) { where.push('a.data_referencia = ?'); params.push(filtros.data); }
        if (filtros.id_emp) { where.push('a.company_id LIKE ?'); params.push(`%${filtros.id_emp}%`); }
        if (filtros.empresa) { where.push('a.empresa_nome LIKE ?'); params.push(`%${filtros.empresa}%`); }
        if (filtros.assistente) { where.push('a.assistente_nome LIKE ?'); params.push(`%${filtros.assistente}%`); }
        if (filtros.doc_name) { where.push('a.doc_name LIKE ?'); params.push(`%${filtros.doc_name}%`); }
        if (filtros.status) { where.push('a.status LIKE ?'); params.push(`%${filtros.status}%`); }
        if (filtros.obs) { where.push('a.observacao LIKE ?'); params.push(`%${filtros.obs}%`); }
        if (filtros.auditora) { where.push('a.auditora_nome LIKE ?'); params.push(`%${filtros.auditora}%`); }

        // Contrato e Função: JOIN com usuarios
        if (filtros.contrato || filtros.funcao) {
            join = ' LEFT JOIN usuarios u ON a.usuario_id = u.id';
            if (filtros.contrato) {
                if (filtros.contrato === 'TERCEIROS') {
                    where.push("(UPPER(u.contrato) LIKE '%PJ%' OR UPPER(u.contrato) LIKE '%TERCEIRO%')");
                } else {
                    where.push("UPPER(u.contrato) LIKE ?"); params.push(`%${filtros.contrato}%`);
                }
            }
            if (filtros.funcao) {
                if (filtros.funcao === 'GESTAO') {
                    where.push("(UPPER(u.funcao) LIKE '%GESTOR%' OR UPPER(u.funcao) LIKE '%ADMIN%' OR u.nivel_acesso >= 2)");
                } else if (filtros.funcao === 'AUDITORIA') {
                    where.push("UPPER(u.funcao) LIKE '%AUDITOR%'");
                } else if (filtros.funcao === 'ASSISTENTE') {
                    where.push("(UPPER(u.funcao) NOT LIKE '%GESTOR%' AND UPPER(u.funcao) NOT LIKE '%ADMIN%' AND UPPER(u.funcao) NOT LIKE '%AUDITOR%' AND (u.nivel_acesso IS NULL OR u.nivel_acesso < 2))");
                }
            }
        }

        const whereClause = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';
        const offset = (pagina - 1) * tamanho;

        // Count total
        const countSql = `SELECT COUNT(*) as total FROM assertividade a${join}${whereClause}`;
        const countResult = await Sistema.query(countSql, params);
        const total = (countResult && countResult[0]) ? countResult[0].total : 0;

        // Fetch page
        const dataSql = `SELECT ${selectPrefix} FROM assertividade a${join}${whereClause} ORDER BY a.data_referencia DESC LIMIT ${parseInt(tamanho)} OFFSET ${parseInt(offset)}`;
        const data = await Sistema.query(dataSql, params) || [];

        return { data, total };
    },

    buscarAnaliseCentralizada: async function (params) {
        console.log("🧠 Análise Centralizada (TiDB V2):", params);

        let where = ['auditora_nome IS NOT NULL', "auditora_nome != ''"];
        let sqlParams = [];

        if (params.inicio) { where.push('data_referencia >= ?'); sqlParams.push(params.inicio); }
        if (params.fim) { where.push('data_referencia <= ?'); sqlParams.push(params.fim); }
        if (params.assistente_id) { where.push('usuario_id = ?'); sqlParams.push(params.assistente_id); }
        if (params.auditora) { where.push('auditora_nome LIKE ?'); sqlParams.push(`%${params.auditora}%`); }

        const whereClause = where.length > 0 ? ' WHERE ' + where.join(' AND ') : '';

        // Total docs
        const totalSql = `SELECT COUNT(*) as total FROM assertividade${whereClause}`;
        const totalResult = await Sistema.query(totalSql, sqlParams);
        const total_docs = (totalResult && totalResult[0]) ? totalResult[0].total : 0;

        // Media assertividade
        const mediaSql = `SELECT AVG(assertividade_val) as media FROM assertividade${whereClause} AND assertividade_val IS NOT NULL`;
        const mediaResult = await Sistema.query(mediaSql, sqlParams);
        const media_assertividade = (mediaResult && mediaResult[0]) ? mediaResult[0].media : 0;

        // Detalhe diário
        const detalheSql = `
            SELECT data_referencia as data, COUNT(*) as docs, AVG(assertividade_val) as media
            FROM assertividade${whereClause} AND assertividade_val IS NOT NULL
            GROUP BY data_referencia
            ORDER BY data_referencia
        `;
        const detalheResult = await Sistema.query(detalheSql, sqlParams) || [];

        return {
            total_docs,
            media_assertividade,
            detalhe_diario: detalheResult.map(d => ({
                data: d.data,
                docs: d.docs,
                media: d.media
            }))
        };
    },

    _extrairValorPorcentagem: function (valorStr) {
        if (valorStr === null || valorStr === undefined || valorStr === '') return null;
        if (typeof valorStr === 'number') return valorStr;
        const limpo = String(valorStr).replace('%', '').replace(',', '.').trim();
        const num = parseFloat(limpo);
        return isNaN(num) ? null : num;
    },

    formatarPorcentagem: function (valor) {
        if (valor === null || valor === undefined) return '-';
        return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    }
};