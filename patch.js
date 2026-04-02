const fs = require('fs');

let geral = fs.readFileSync('js/produtividade/geral.js_dl', 'utf8');

// 1. Meta Individual sensível ao tipo de contrato (CLT vs Terc)
const target1 = `// Meta Individual sensível ao tipo de contrato (CLT vs Terc)
            item.fator = item.count_fator > 0 ? (item.soma_fator / item.count_fator) : 1.0;
            const metaObj = this.state.dadosMetas.find(m => String(m.usuario_id) === String(item.uid));

            // Meta Padrão: 650 para Assistentes CLT/Geral, 100 para Terceiros/PJ
            const termosGestao = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];
            const ehGestao = termosGestao.some(t => funcao.includes(t) || perfil.includes(t));
            const contratoUpper = (u.contrato || '').toUpperCase();

            // Se for Gestão, define meta zero PARA O INDIVIDUO (na lista), mas guarda a meta base
            if (ehGestao) {
                item.meta_base_diaria = 0;
                item._meta_gestor_base = Number(metaObj ? (metaObj.meta_producao || 0) : 0); // Guarda meta do gestor (ex 650)
                item.meta_assert = 0;
            } else {
                // [REGRA] Meta: Sempre usar a meta MAIOR (mínimo 650), ignorar assistentes com metas menores
                const metaIndiv = Number(metaObj ? (metaObj.meta_producao || 0) : 0);
                item.meta_base_diaria = Math.max(650, metaIndiv);
                item.meta_assert = Number(metaObj ? (metaObj.meta_assertividade || 97) : 97);
            }`;

const rep1 = `// Meta Individual sensível ao tipo de contrato (CLT vs Terc)
            item.fator = item.count_fator > 0 ? (item.soma_fator / item.count_fator) : 1.0;
            const rangeInicioParts = this.state.range.inicio.split('-');
            const reqMes = parseInt(rangeInicioParts[1]);
            const reqAno = parseInt(rangeInicioParts[0]);

            // Pega TODAS as metas do usuário
            const userMetas = this.state.dadosMetas.filter(m => String(m.usuario_id) === String(item.uid));

            // Tenta achar a meta do mês atual que seja válida (não nula)
            let metasDoMes = userMetas.filter(m => m.mes == reqMes && m.ano == reqAno);
            let metaObj = null;

            if (metasDoMes.length > 0) {
                // Pega a última inserida ou a primeira que não seja nula
                metaObj = metasDoMes.reverse().find(m => m.meta_producao !== null && m.meta_producao !== undefined) || metasDoMes[0];
            }

            // Se não encontrou do mês atual, procura a meta VÁLIDA mais recente registrada em meses anteriores
            if (!metaObj || (metaObj.meta_producao === null && metaObj.meta_prod === null)) {
                const metasAnteriores = userMetas
                    .filter(m => (m.ano < reqAno || (m.ano === reqAno && m.mes < reqMes)) && (m.meta_producao !== null || m.meta_prod !== null))
                    .sort((a, b) => (b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes));

                if (metasAnteriores.length > 0) {
                    metaObj = metasAnteriores[0];
                }
            }

            // Meta Padrão: 650 para Assistentes (ou definido pela gestora), 0 para Gestão (Auditores/Líderes/Gestora)
            const termosGestao = ['admin', 'gestor', 'auditor', 'lider', 'líder', 'coordenador'];
            const ehGestao = termosGestao.some(t => funcao.includes(t) || perfil.includes(t));
            const defaultMeta = 650; // Base para assistentes conforme definido na aba meta

            // Se for Gestão, define meta zero PARA O INDIVIDUO (na lista), mas guarda a meta base
            const safeMetaProd = metaObj ? (metaObj.meta_producao !== null && metaObj.meta_producao !== undefined ? Number(metaObj.meta_producao) : (metaObj.meta_prod !== null && metaObj.meta_prod !== undefined ? Number(metaObj.meta_prod) : null)) : null;
            const safeMetaAssert = metaObj ? (metaObj.meta_assertividade !== null && metaObj.meta_assertividade !== undefined ? Number(metaObj.meta_assertividade) : (metaObj.meta_assert !== null && metaObj.meta_assert !== undefined ? Number(metaObj.meta_assert) : 97)) : 97;

            if (ehGestao) {
                item.meta_base_diaria = 0;
                item._meta_gestor_base = safeMetaProd !== null ? safeMetaProd : defaultMeta; 
                item.meta_assert = 0;
            } else {
                item.meta_base_diaria = safeMetaProd !== null ? safeMetaProd : defaultMeta;
                item.meta_assert = safeMetaAssert;
            }`;

geral = geral.replace(target1, rep1);

// 2. targetVelocidade = 650;
const target2 = `        // Target da Velocidade (Usa meta da gestora ou fallback conforme contrato)
        let targetVelocidade = metaDiariaGestor;
        if (targetVelocidade <= 0) {
            targetVelocidade = 650;
        }`;

const rep2 = `        // Target da Velocidade (Usa meta da gestora ou fallback conforme contrato)
        let targetVelocidade = metaDiariaGestor;
        if (targetVelocidade <= 0) {
            targetVelocidade = window.Produtividade.MetaGlobalCalculada > 0 ? Math.round(window.Produtividade.MetaGlobalCalculada / ((hcParaVelocidade || 1) * (diasParaVelocidade || 1))) : 650;
        }`;

geral = geral.replace(target2, rep2);

// 3. Math.max(650
geral = geral.replace(/Math\.max\(650,\s*Number\(metaObj\s*\?\s*\(metaObj\.meta_producao\s*\|\|\s*0\)\s*:\s*0\)\)/g, 'Number(metaObj ? (metaObj.meta_producao || 650) : 650)');

// 4. maxMetaProducao === 0 650 (just clean up if needed, wait, it's fine).

// 5. gestoraItem._meta_gestor_base || 650
geral = geral.replace(/gestoraItem\._meta_gestor_base \|\| 650/g, 'gestoraItem._meta_gestor_base || 0');

fs.writeFileSync('js/produtividade/geral.js', geral);

// Fix timezone in main.js
let main = fs.readFileSync('js/produtividade/main.js_dl', 'utf8');

const targetFmt = `    getDatasFiltro: function () {
        let inicio, fim;
        const fmt = (d) => d.toISOString().split('T')[0];

        if (this.filtroPeriodo === 'dia') {
            const val = document.getElementById('sel-data-dia')?.value || new Date().toISOString().split('T')[0];`;

const repFmt = `    getDatasFiltro: function () {
        let inicio, fim;
        const fmt = (d) => \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;

        if (this.filtroPeriodo === 'dia') {
            const val = document.getElementById('sel-data-dia')?.value || fmt(new Date());`;

main = main.replace(targetFmt, repFmt);
fs.writeFileSync('js/produtividade/main.js', main);

// Fix timezone in minha_area/main.js
try {
    let main2 = fs.readFileSync('js/minha_area/main.js', 'utf8');
    const targetFmt2 = `const fmt = (d) => d.toISOString().split('T')[0];`;
    const repFmt2 = `const fmt = (d) => \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;`;
    main2 = main2.replace(targetFmt2, repFmt2);
    fs.writeFileSync('js/minha_area/main.js', main2);
} catch (e) { }

// Cache busters
let prodHtml = fs.readFileSync('produtividade.html_dl', 'utf8');
prodHtml = prodHtml.replace(/\?v=20260227_[0-9]+/g, '?v=20260302_2145');
fs.writeFileSync('produtividade.html', prodHtml);

console.log("PATCH DONE");
