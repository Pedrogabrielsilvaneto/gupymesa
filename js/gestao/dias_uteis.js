/* ARQUIVO: js/gestao/dias_uteis.js */
window.Gestao = window.Gestao || {};

Gestao.DiasUteis = {
    cache: {},

    init: async function () {
        // Tenta criar tabela se não existir (melhor esforço)
        try {
            const sql = `CREATE TABLE IF NOT EXISTS config_dias_uteis (
                mes INT NOT NULL,
                ano INT NOT NULL,
                dias_uteis INT NOT NULL,
                PRIMARY KEY (mes, ano)
            )`;
            await Sistema.query(sql);
            console.log("📅 Gestão Dias Úteis: Tabela verificada.");
        } catch (e) {
            console.warn("Erro ao verificar tabela dias uteis:", e);
        }
    },

    obter: async function (mes, ano) {
        const k = `${mes}-${ano}`;
        if (this.cache[k] !== undefined) return this.cache[k];

        try {
            const res = await Sistema.query(`SELECT dias_uteis FROM config_dias_uteis WHERE mes = ? AND ano = ?`, [mes, ano]);
            const val = (res && res[0]) ? res[0].dias_uteis : null;
            this.cache[k] = val;
            return val;
        } catch (e) {
            console.error("Erro ao obter dias uteis:", e);
            return null;
        }
    },

    salvar: async function (mes, ano, dias) {
        const k = `${mes}-${ano}`;
        try {
            const val = parseInt(dias);
            if (!dias || isNaN(val) || val < 0) {
                await Sistema.query(`DELETE FROM config_dias_uteis WHERE mes = ? AND ano = ?`, [mes, ano]);
                this.cache[k] = null;
            } else {
                await Sistema.query(
                    `INSERT INTO config_dias_uteis (mes, ano, dias_uteis) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE dias_uteis = VALUES(dias_uteis)`,
                    [mes, ano, val]
                );
                this.cache[k] = val;
            }
            return true;
        } catch (e) {
            console.error("Erro ao salvar dias uteis:", e);
            throw e;
        }
    },

    // Retorna os dias úteis do mês (Manual OU Calendário Simples)
    // Se manual existir, retorna manual. Senão, conta seg-sex.
    getDiasUteisMes: async function (mes, ano) {
        // Tenta manual
        const manual = await this.obter(mes, ano);
        if (manual !== null) return manual;

        // Fallback: Calendário (apenas dias da semana, sem feriados por enquanto para manter compatibilidade)
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
    }
};

// Auto-init se possível
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Gestao.DiasUteis.init());
} else {
    Gestao.DiasUteis.init();
}
