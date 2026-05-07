import { executeQuery } from '../../lib/db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { id, senha } = req.body;

  if (!id || !senha) {
    return res.status(400).json({ error: 'ID e Senha obrigatórios' });
  }

  try {
    const rows = await executeQuery(
      'SELECT id, nome, perfil, funcao, ativo, trocar_senha FROM usuarios WHERE id = ? AND senha = ? LIMIT 1',
      [id, senha]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }

    const user = rows[0];

    if (!user.ativo) {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    // Gerar JWT Token
    const payload = {
      id: user.id,
      nome: user.nome,
      perfil: user.perfil,
      funcao: user.funcao
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Enviar dados e o token (não enviar senha)
    res.status(200).json({ 
      user: payload, 
      token, 
      trocar_senha: user.trocar_senha 
    });

  } catch (error) {
    console.error("Login API Error:", error);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
}
