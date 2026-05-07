-- Script para criar a tabela 'empresas' no TiDB
-- Execute este comando no TiDB (dentro do banco GupyMesa)

USE GupyMesa;

-- Cria a tabela empresas se não existir
CREATE TABLE IF NOT EXISTS empresas (
    id INT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    subdominio VARCHAR(100),
    data_entrada DATE,
    observacao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Verifica se a tabela foi criada
SHOW TABLES LIKE 'empresas';

-- Descreve a estrutura da tabela
DESCRIBE empresas;
