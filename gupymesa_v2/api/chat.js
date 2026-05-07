import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import jwt from 'jsonwebtoken';

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: "https://gateway.ai.vercel-api.com",
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Verificação de Token
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
     return res.status(401).json({ error: 'Não autorizado para usar a IA.' });
  }

  try {
    jwt.verify(authHeader, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada para o chat.' });
  }

  try {
    const { messages } = req.body;

    const result = await streamText({
      model: openai('gpt-4o'),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('Erro na API de Chat:', error);
    res.status(500).json({ error: error.message });
  }
}
