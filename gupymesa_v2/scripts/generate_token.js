// scripts/generate_token.js
// Use: node scripts/generate_token.js [admin_id] [admin_name]
require('dotenv').config();
const jwt = require('jsonwebtoken');

const id = process.argv[2] || 1;
const nome = process.argv[3] || 'Developer Admin';
const secret = process.env.JWT_SECRET;

if (!secret) {
  console.error("ERRO: JWT_SECRET não configurado no .env");
  process.exit(1);
}

const payload = {
  id: parseInt(id),
  nome: nome,
  perfil: 'admin',
  funcao: 'administrador'
};

const token = jwt.sign(payload, secret, { expiresIn: '30d' });

console.log("--------------------------------------------------");
console.log("🔑 NOVO TOKEN DE ACESSO (Válido por 30 dias):");
console.log(token);
console.log("--------------------------------------------------");
console.log("Dica: Use como Header 'Authorization' nas suas requisições.");
