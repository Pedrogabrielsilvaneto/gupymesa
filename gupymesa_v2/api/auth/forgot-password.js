import { executeQuery } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'ID do usuário é obrigatório.' });

  try {
    // 1. Verificar se o usuário existe
    const userResult = await executeQuery('SELECT nome FROM usuarios WHERE id = ?', [id]);
    if (!userResult || userResult.length === 0) {
      // Simula sucesso por segurança (evita enumeração de usuários), ou retorna erro controlado.
      return res.status(200).json({ success: true, message: 'Se o usuário existir, a solicitação foi enviada.' });
    }

    const { nome } = userResult[0];

    // 2. Criar um "Feedback" direcionado aos admins como solicitação de reset (Canal Interno)
    const sql = `
      INSERT INTO feedbacks (
        id, created_at, remetente_id, destinatario_id, tipo_destinatario, 
        mensagem, tipo_midia
      ) VALUES (UUID(), NOW(), ?, NULL, 'ADMIN', ?, 'SOLICITACAO_RESET')
    `;
    const msg = `⚠️ O usuário ${nome} (ID: ${id}) solicitou o reset de senha em ${new Date().toLocaleString()}.`;
    
    await executeQuery(sql, [id, msg]);

    res.status(200).json({ success: true, message: 'Solicitação de reset enviada à gestão.' });

  } catch (error) {
    console.error("Reset Request Error:", error);
    res.status(500).json({ error: 'Erro ao processar solicitação. Tente de novo.' });
  }
}
