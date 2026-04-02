const mysql = require('mysql2/promise');

async function testUser() {
  const conn = await mysql.createConnection({
    host: 'gateway01.us-east-1.prod.aws.tidbcloud.com',
    user: '3CmQF29BCKpLVQv.root',
    password: 'NjiqHJc2ojeBJEqt',
    database: 'GupyMesa',
    port: 4000,
    ssl: { rejectUnauthorized: true }
  });

  const [rows] = await conn.execute(`
    SELECT id, nome, perfil, funcao
    FROM usuarios
    WHERE nome LIKE '%Pedro%'
  `);
  
  console.log("PEDRO USER:");
  rows.forEach(r => console.log(JSON.stringify(r)));

  await conn.end();
}

testUser().catch(console.error);
