-- Script para criar a tabela 'metas' no TiDB
-- Execute este comando no TiDB (dentro do banco GupyMesa)

USE GupyMesa;

-- Cria a tabela metas se não existir
CREATE TABLE IF NOT EXISTS metas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id VARCHAR(50) NOT NULL,
    mes INT NOT NULL,
    ano INT NOT NULL,
    meta_producao INT DEFAULT NULL,
    meta_assertividade DECIMAL(5,2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_usuario_mes_ano (usuario_id, mes, ano),
    INDEX idx_periodo (mes, ano),
    INDEX idx_usuario (usuario_id)
);

-- Verifica se a tabela foi criada
SHOW TABLES LIKE 'metas';

-- Descreve a estrutura da tabela
DESCRIBE metas;
