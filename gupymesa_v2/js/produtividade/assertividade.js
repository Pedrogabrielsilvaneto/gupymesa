// ARQUIVO: js/produtividade/assertividade.js
window.Produtividade = window.Produtividade || {};

Produtividade.Assertividade = {
    init: function() {
        console.log("🛡️ Módulo de Assertividade (Produtividade) Iniciado");
    },

    /**
     * Renderiza a célula usando a inteligência central do Sistema.
     * @param {Object} dadosPreCalculados - Opcional. Se vier nulo, calcula na hora.
     * Espera-se: { soma: number, qtd: number }
     */
    renderizarCelula: function(auditoriaData, metaAlvo) {
        // Usa a Central para garantir consistência visual e matemática
        const qtd = Number(auditoriaData?.qtd || 0);
        const soma = Number(auditoriaData?.soma || 0);
        
        // Se não houver dados
        if (qtd === 0) {
            return '<div class="text-center text-slate-300 font-mono text-xs">-</div>';
        }

        // Delega o cálculo matemático para a Central
        const media = Sistema.Assertividade.calcularMedia(soma, qtd);
        
        // Delega a decisão visual (cores/ícones) para a Central
        const visual = Sistema.Assertividade.obterStatusVisual(media, metaAlvo);
        const textoFormatado = Sistema.Assertividade.formatarPorcentagem(media);

        // Renderiza HTML específico desta view (Card Compacto)
        // Nota: Usamos as classes retornadas pelo sistema (visual.class) ou aplicamos classes customizadas mantendo a lógica de cor
        
        // Mapeando as cores do sistema para o layout específico de Produtividade (se quiser manter o layout de "pill")
        // Mas o ideal é usar as cores vindas do visual.color para bordas/texto.
        
        return `
            <div class="flex flex-col items-center justify-center py-1 px-2 rounded-lg ${visual.class} transition group cursor-help w-full" 
                 title="Média: ${textoFormatado} | Meta: ${metaAlvo || Sistema.Assertividade.config.metaPadrao}% | Total: ${qtd} Docs">
                
                <div class="flex items-center gap-1.5 font-bold text-xs">
                    ${visual.icon}
                    <span>${textoFormatado}</span>
                </div>
                
                <span class="text-[9px] opacity-70 font-semibold uppercase tracking-wide mt-0.5">
                    ${qtd} ${qtd === 1 ? 'Doc' : 'Docs'}
                </span>
            </div>
        `;
    }
};

Produtividade.Assertividade.init();