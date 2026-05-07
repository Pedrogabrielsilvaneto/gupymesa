
// Script simples para testar a comunicação com a API de Chat
async function testarIA(mensagem) {
    console.log("Enviando mensagem para IA:", mensagem);
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: mensagem }]
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }

        // Ler o stream de resposta
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let resultado = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            resultado += chunk;
            console.log("Chunk recebido:", chunk);
        }
        console.log("Resposta completa da IA:", resultado);
        return resultado;
    } catch (error) {
        console.error("Erro ao testar IA:", error);
    }
}

// Expor no escopo global para teste via console
window.testarIA = testarIA;
