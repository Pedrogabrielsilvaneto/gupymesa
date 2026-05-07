/* ARQUIVO: debug_config.js */
async function debug() {
    try {
        const config = await Sistema.query("SELECT * FROM config_mes WHERE ano = 2026");
        console.log("CONFIG 2026:", JSON.stringify(config, null, 2));
        
        const prodJan = await Sistema.query("SELECT SUM(p.quantidade) as total FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= '2026-01-01' AND p.data_referencia <= '2026-01-31' AND NOT (COALESCE(LOWER(u.funcao),'') LIKE '%gestor%' OR COALESCE(LOWER(u.perfil),'') LIKE '%gestor%' OR COALESCE(LOWER(u.funcao),'') LIKE '%auditor%')");
        console.log("PROD JAN:", prodJan);

        const prodFeb = await Sistema.query("SELECT SUM(p.quantidade) as total FROM producao p JOIN usuarios u ON p.usuario_id = u.id WHERE p.data_referencia >= '2026-02-01' AND p.data_referencia <= '2026-02-28' AND NOT (COALESCE(LOWER(u.funcao),'') LIKE '%gestor%' OR COALESCE(LOWER(u.perfil),'') LIKE '%gestor%' OR COALESCE(LOWER(u.funcao),'') LIKE '%auditor%')");
        console.log("PROD FEB:", prodFeb);
        
    } catch (e) {
        console.error(e);
    }
}
debug();
