const item = { uid: '1185327' };
const reqMes = 1;
const reqAno = 2026;
const dadosMetas = [
    {
        id: '06730815-28ca-4823-86a6-7dddde902352',
        usuario_id: '1185327',
        equipe: null,
        mes: 3,
        ano: 2026,
        meta_produtividade: null,
        meta_qualidade: null,
        meta_producao: 650,
        meta_assertividade: '97.00'
    },
    {
        id: '1f59d558-326a-4c5a-8642-940481788a2f',
        usuario_id: '1185327',
        equipe: null,
        mes: 2,
        ano: 2026,
        meta_produtividade: null,
        meta_qualidade: null,
        meta_producao: 550,
        meta_assertividade: '97.00'
    },
    {
        id: '9f349ed4-3752-4b7f-857b-7254776a0211',
        usuario_id: '1185327',
        equipe: null,
        mes: 1,
        ano: 2026,
        meta_produtividade: null,
        meta_qualidade: null,
        meta_producao: 450,
        meta_assertividade: '97.00'
    }
];

const userMetas = dadosMetas.filter(m => String(m.usuario_id) === String(item.uid));
let metasDoMes = userMetas.filter(m => m.mes == reqMes && m.ano == reqAno);
let metaObj = null;

if (metasDoMes.length > 0) {
    metaObj = metasDoMes.reverse().find(m => m.meta_producao !== null && m.meta_producao !== undefined) || metasDoMes[0];
}

if (!metaObj || (metaObj.meta_producao === null && metaObj.meta_prod === null)) {
    const metasAnteriores = userMetas
        .filter(m => (m.ano < reqAno || (m.ano === reqAno && m.mes < reqMes)) && (m.meta_producao !== null || m.meta_prod !== null))
        .sort((a, b) => (b.ano !== a.ano ? b.ano - a.ano : b.mes - a.mes));
    if (metasAnteriores.length > 0) {
        metaObj = metasAnteriores[0];
    }
}

const safeMetaProd = metaObj ? (metaObj.meta_producao !== null && metaObj.meta_producao !== undefined ? Number(metaObj.meta_producao) : null) : null;
console.log({ metaObj, safeMetaProd });
