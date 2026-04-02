
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Configura o cliente OpenAI para usar o Vercel AI Gateway
const openai = createOpenAI({
    // A chave da API fornecida pelo usuário (AI_GATEWAY_API_KEY) deve ser usada aqui.
    // O Vercel AI Gateway atua como um proxy compatível com a API da OpenAI.
    apiKey: process.env.AI_GATEWAY_API_KEY,
    baseURL: "https://gateway.ai.vercel-api.com", // Endpoint padrão do Vercel AI Gateway
});

export const config = {
    runtime: 'edge', // Vercel AI SDK funciona melhor no edge runtime
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { messages } = await req.json();

        // Chama o modelo através do Gateway
        const result = await streamText({
            model: openai('gpt-4o'), // Você pode parametrizar isso se quiser mudar o modelo
            messages,
        });

        return result.toDataStreamResponse();
    } catch (error) {
        console.error('Erro na API de Chat:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
