/* ARQUIVO: js/gestao/config_mes.js */
window.Gestao = window.Gestao || {};

Gestao.ConfigMes = {
    cache: {},

    init: async function () {
        try {
            // Cria tabela unificada de configuração mensal
            const sql = `CREATE TABLE IF NOT EXISTS config_mes (
                mes INT NOT NULL,
                ano INT NOT NULL,
                dias_uteis INT,
                dias_uteis_clt INT,
                dias_uteis_terceiros INT,
                hc_clt INT DEFAULT 0,
                hc_terceiros INT DEFAULT 0,
                PRIMARY KEY (mes, ano)
            )`;
            await Sistema.query(sql);

            // Garantir que as colunas novas existam caso a tabela já tenha sido criada anteriormente
            try { await Sistema.query("ALTER TABLE config_mes ADD COLUMN dias_uteis_clt INT AFTER dias_uteis"); } catch (e) { }
            try { await Sistema.query("ALTER TABLE config_mes ADD COLUMN dias_uteis_terceiros INT AFTER dias_uteis_clt"); } catch (e) { }
            console.log("📅 Gestão Config Mês: Tabela verificada.");
        } catch (e) {
            console.warn("Erro ao verificar tabela config_mes:", e);
        }
    },

    obter: async function (mes, ano) {
        const k = `${mes}-${ano}`;
        if (this.cache[k] !== undefined) return this.cache[k];

        try {
            const res = await Sistema.query(`SELECT * FROM config_mes WHERE mes = ? AND ano = ?`, [mes, ano]);
            const val = (res && res[0]) ? res[0] : null;
            this.cache[k] = val;
            return val;
        } catch (e) {
            console.error("Erro ao obter config mês:", e);
            return null;
        }
    },

    salvar: async function (mes, ano, dados) {
        // dados: { dias_uteis, hc_clt, hc_terceiros }
        // Se algum valor for null/undefined, mantemos o existente ou 0?
        // Vamos fazer upsert completo.

        try {
            // Primeiro obtemos o atual para não perder dados se passarmos apenas um campo
            let atual = await this.obter(mes, ano) || {};

            const novo = {
                dias_uteis: dados.dias_uteis !== undefined ? dados.dias_uteis : atual.dias_uteis,
                dias_uteis_clt: dados.dias_uteis_clt !== undefined ? dados.dias_uteis_clt : atual.dias_uteis_clt,
                dias_uteis_terceiros: dados.dias_uteis_terceiros !== undefined ? dados.dias_uteis_terceiros : atual.dias_uteis_terceiros,
                hc_clt: dados.hc_clt !== undefined ? dados.hc_clt : atual.hc_clt,
                hc_terceiros: dados.hc_terceiros !== undefined ? dados.hc_terceiros : atual.hc_terceiros
            };

            await Sistema.query(
                `INSERT INTO config_mes (mes, ano, dias_uteis, dias_uteis_clt, dias_uteis_terceiros, hc_clt, hc_terceiros) 
                 VALUES (?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                    dias_uteis = VALUES(dias_uteis), 
                    dias_uteis_clt = VALUES(dias_uteis_clt), 
                    dias_uteis_terceiros = VALUES(dias_uteis_terceiros),
                    hc_clt = VALUES(hc_clt), 
                    hc_terceiros = VALUES(hc_terceiros)`,
                [mes, ano, novo.dias_uteis || null, novo.dias_uteis_clt || null, novo.dias_uteis_terceiros || null, novo.hc_clt || 0, novo.hc_terceiros || 0]
            );

            // Atualiza cache
            this.cache[`${mes}-${ano}`] = novo;
            return true;
        } catch (e) {
            console.error("Erro ao salvar config mês:", e);
            throw e;
        }
    },

    // Retorna os dias úteis baseados no tipo de contrato (CLT vs TERCEIROS)
    getDiasUteisMes: async function (mes, ano, tipo) {
        const config = await this.obter(mes, ano);

        // Pega valor base do calendário para o mês
        const diasCalendario = this.calcularDiasUteisCalendario(mes, ano);

        // Se o tipo for TERCEIROS ou não especificado
        let vTerc = (config && config.dias_uteis_terceiros) ? config.dias_uteis_terceiros : (config && config.dias_uteis ? config.dias_uteis : diasCalendario);

        if (tipo === 'TERCEIROS') return vTerc;

        // Se o tipo for CLT
        let vClt = (config && config.dias_uteis_clt) ? config.dias_uteis_clt : (vTerc - 1);

        if (tipo === 'CLT') return vClt;

        // Se não filtrar, retorna o de terceiros por padrão ou média? Vamos retornar Terceiros.
        return vTerc;
    },

    calcularDiasUteisCalendario: function (mes, ano) {
        const i = new Date(ano, mes - 1, 1);
        const f = new Date(ano, mes, 0);
        let c = 0;
        let cur = new Date(i);
        while (cur <= f) {
            const dia = cur.getDay();
            if (dia !== 0 && dia !== 6) c++;
            cur.setDate(cur.getDate() + 1);
        }
        return c;
    },

    // Retorna Headcount (Manual OU Padrão 17)
    getHeadcount: async function (mes, ano) {
        const config = await this.obter(mes, ano);
        const clt = (config && config.hc_clt) ? config.hc_clt : 0;
        const terc = (config && config.hc_terceiros) ? config.hc_terceiros : 0;
        const total = clt + terc;

        // Se total for 0, retorna padrão 17? O usuário disse: "senão a quantidade padrão de 17 no geral"
        // Mas e se ele quiser definir 0? (Pouco provável em "Minha Área", mas possível)
        // Vamos assumir que 0 = "Não configurado" -> Padrão 17.
        if (total === 0) return { total: 17, clt: 0, terceiros: 0, isDefault: true };

        return { total, clt, terc, isDefault: false };
    }
};

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Gestao.ConfigMes.init());
} else {
    Gestao.ConfigMes.init();
}
