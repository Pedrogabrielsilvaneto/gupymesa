const assertividade = {
    visaoAtual: 'doc',
    listaErrosCache: [
        { doc_name: 'Dados Bancários', tipo_documento: 'DOC_NDF_EMPRESA', empresa_nome: 'votorantin' },
        { doc_name: 'Declaração de União Estável', tipo_documento: 'outra_coisa' },
        { doc_name: 'RG (dependente)' }
    ],
    isNDF: function (d) { return (d.tipo_documento || '').toUpperCase().startsWith('DOC_NDF_'); },
    getFriendlyName: function (n) { return n || 'Sem Nome'; },
    getDocType: function (d) {
        if (this.isNDF(d)) return d.tipo_documento || "DOC_NDF_GENERICO";
        return d.doc_name || d.tipo_documento || 'Documento Gupy';
    },
    aplicarFiltroVisual: function (lista, filtro) { console.log('FILTROU', lista.length, 'com', filtro); console.log(lista); },
    filtrarPorSelecao: function (valorAmigavel) {
        let base = this.listaErrosCache;
        if (this.visaoAtual === 'ndf') {
            base = base.filter(d => this.isNDF(d));
        }

        const filtrados = [];
        let limit = 0;
        for (let i = 0; i < base.length; i++) {
            if (limit >= 200) break;
            const d = base[i];
            let match = false;
            if (this.visaoAtual === 'empresa') {
                const emp = d.empresa_nome || 'Desconhecida';
                match = (emp === valorAmigavel || emp.includes(valorAmigavel.replace('...', '')));
            } else if (this.visaoAtual === 'ndf') {
                const tipoTecnico = d.tipo_documento || 'Outros NDF';
                const nomeAmigavelItem = this.getFriendlyName(tipoTecnico);
                match = (nomeAmigavelItem === valorAmigavel || nomeAmigavelItem.includes(valorAmigavel.replace('...', '')));
            } else {
                // Visão DOC
                const tipoTecnico = this.getDocType(d);
                const nomeAmigavelItem = this.getFriendlyName(tipoTecnico);
                match = (nomeAmigavelItem === valorAmigavel || nomeAmigavelItem.includes(valorAmigavel.replace('...', '')));
            }
            if (match) { filtrados.push(d); limit++; }
        }
        this.aplicarFiltroVisual(filtrados, valorAmigavel);
    }
};

assertividade.filtrarPorSelecao('DOC_NDF_EMPRESA');
assertividade.filtrarPorSelecao('Declaração de União Estável');
assertividade.filtrarPorSelecao('RG (dependente)');
