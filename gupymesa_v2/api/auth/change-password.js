import { executeQuery } from '../../lib/db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Sessão inválida.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada.' });
  }

  const { senhaAtual, novaSenha } = req.body;
  const userId = decoded.id;

  if (!senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
  }

  try {
    // 1. Verificar senha atual no banco
    const userResult = await executeQuery('SELECT senha FROM usuarios WHERE id = ?', [userId]);

    if (!userResult || userResult.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const senhaNoBanco = userResult[0].senha;
    if (senhaNoBanco !== senhaAtual) {
      return res.status(403).json({ error: 'Senha atual incorreta.' });
    }

    // 2. Atualizar para a nova senha e remover flag de troca obrigatória
    await executeQuery('UPDATE usuarios SET senha = ?, trocar_senha = 0 WHERE id = ?', [novaSenha, userId]);

    res.status(200).json({ success: true, message: 'Senha atualizada com sucesso!' });

  } catch (error) {
    console.error("Change Password Error:", error);
    res.status(500).json({ error: 'Erro ao processar solicitação.' });
  }
}
