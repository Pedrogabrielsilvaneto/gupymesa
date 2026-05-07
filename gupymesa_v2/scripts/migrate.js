const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuração do Banco de Dados
const dbConfig = {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    port: process.env.TIDB_PORT || 4000,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
};

async function migrate() {
    console.log('🚀 Iniciando migração de banco de dados (TiDB)...');
    
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Conectado ao banco de dados com sucesso.');

        // 1. Criar tabela de controle de migrações se não existir
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS _migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Ler arquivos de migração
        const migrationsDir = path.join(__dirname, '..', 'migrations');
        if (!fs.existsSync(migrationsDir)) {
            console.log('📂 Pasta de migrações não encontrada. Criando...');
            fs.mkdirSync(migrationsDir);
        }

        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();

        if (files.length === 0) {
            console.log('🤷 Nenhuma migração encontrada para executar.');
            return;
        }

        // 3. Verificar quais já foram executadas
        const [rows] = await connection.execute('SELECT name FROM _migrations');
        const executedMigrations = new Set(rows.map(r => r.name));

        // 4. Executar novas migrações
        for (const file of files) {
            if (executedMigrations.has(file)) {
                console.log(`⏭️  Pulando ${file} (já executado)`);
                continue;
            }

            console.log(`▶️  Executando: ${file} ...`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            // Divide por ponto e vírgula para executar comandos separadamente (simplificado)
            // Nota: Isso é básico. Para procedures/triggers complexas, precisaria de um parser melhor.
            // Para este caso de uso (alter table), funciona bem.
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);

            try {
                // Inicia transação para cada arquivo (se suportado pelo TiDB para DDL, mas atomicidade DDL varia)
                // TiDB suporta transações, mas DDL é auto-commit.
                
                for (const statement of statements) {
                    // Ignora comandos DELIMITER ou vazios
                    if (!statement) continue;
                    await connection.query(statement);
                }

                await connection.execute('INSERT INTO _migrations (name) VALUES (?)', [file]);
                console.log(`✅ Sucesso: ${file}`);
            } catch (err) {
                console.error(`❌ Falha ao executar ${file}:`, err.message);
                process.exit(1); // Para o processo em erro crítico
            }
        }

        console.log('🏁 Todas as migrações foram processadas.');

    } catch (error) {
        console.error('❌ Erro fatal na migração:', error);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
