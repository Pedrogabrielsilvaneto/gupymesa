import { executeQuery } from '../lib/db.js';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Token ausente.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida.' });
  }

  const { query, values } = req.body;
  if (!query) return res.status(400).json({ error: 'Query ausente.' });

  const sqlLower = query.toLowerCase().trim();
  const isAdmin = (decoded.perfil || '').toLowerCase() === 'admin' || 
                  (decoded.funcao || '').toLowerCase().includes('gestor') ||
                  (decoded.funcao || '').toLowerCase().includes('lider') ||
                  (decoded.funcao || '').toLowerCase().includes('auditor') ||
                  (decoded.funcao || '').toLowerCase().includes('coordena');

  // --- POLÍTICA DE SEGURANÇA ---

  // 1. Bloqueio de Comandos Destrutivos
  const isDestructive = (sqlLower.includes('drop ') || sqlLower.includes('truncate ') || sqlLower.includes('delete ') || sqlLower.includes('alter '));
  if (isDestructive && !isAdmin) {
    return res.status(403).json({ error: 'Ação não permitida para o seu nível de acesso.' });
  }

  // 2. Proteção de Dados de Usuários (IDOR)
  // Se não for admin e tentar mexer na tabela usuarios
  if (!isAdmin && sqlLower.includes('usuarios')) {
    // Só permite ver/alterar o PRÓPRIO ID
    const matchesId = values && values.some(v => String(v) === String(decoded.id));
    const containsOwnIdFilter = sqlLower.includes('id =') || sqlLower.includes('id=');
    
    // Se não estiver filtrando explicitamente pelo seu ID nos valores, bloqueia
    if (!matchesId || !containsOwnIdFilter) {
       return res.status(403).json({ error: 'Você só pode acessar seus próprios dados de usuário.' });
    }
    
    // Bloqueia alteração de perfil/função/ativo por não-admins
    if ((sqlLower.includes('update') || sqlLower.includes('insert')) && 
        (sqlLower.includes('perfil') || sqlLower.includes('funcao') || sqlLower.includes('situacao') || sqlLower.includes('ativo'))) {
       return res.status(403).json({ error: 'Alteração de privilégios não permitida.' });
    }
  }

  // 3. Proteção de Feedbacks/Produção (Garante que só veja o seu se não for admin)
  const privateTables = ['feedbacks', 'producao', 'metas', 'auditoria'];
  const accessingPrivate = privateTables.some(t => sqlLower.includes(t));
  
  if (!isAdmin && accessingPrivate) {
    const matchesId = values && values.some(v => String(v) === String(decoded.id));
    const containsUserFilter = sqlLower.includes('remetente_id') || sqlLower.includes('destinatario_id') || sqlLower.includes('id_usuario') || sqlLower.includes('usuario_id') || sqlLower.includes('usuario');
    
    if (!matchesId && !containsUserFilter) {
       return res.status(403).json({ error: 'Filtro de usuário obrigatório para acesso a estes dados.' });
    }
  }

  try {
    const data = await executeQuery(query, values);
    res.status(200).json({ data, error: null });
  } catch (error) {
    res.status(500).json({ error: 'Erro no banco de dados.' });
  }
}
