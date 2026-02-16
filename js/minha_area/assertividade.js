// ARQUIVO: js/minha_area/assertividade.js
MinhaArea.Assertividade = {
    carregar: async function() {
        const periodo = MinhaArea.getPeriodo(); // Assume que retorna { inicio: Date, fim: Date }
        const display = document.getElementById('assert-meta-display');
        const usuarioLogado = JSON.parse(localStorage.getItem('usuario_logado')); // Exemplo de obtenção de ID
        
        if(!display) return;
        if(!usuarioLogado) return;

        display.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';

        try {
            // CORREÇÃO: Usa o Sistema centralizado em vez de Service inexistente
            // Passamos a data final do período para pegar a meta daquele mês
            const metaValor = await Sistema.Assertividade.buscarMetaUsuario(
                usuarioLogado.id, 
                periodo.fim
            );
            
            // Formatação consistente
            display.innerText = Sistema.Assertividade.formatarPorcentagem(metaValor);
            
            // Opcional: Adicionar cor se tivermos a média real calculada em outro lugar
            // Mas aqui é apenas a exibição da META.
            
        } catch (e) {
            console.error("Erro ao buscar meta na Minha Área:", e);
            display.innerText = "98,00%"; // Fallback seguro do Sistema
        }
    }
};