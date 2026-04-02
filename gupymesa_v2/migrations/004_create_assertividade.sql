-- Migração 004: Criar tabela de assertividade
-- Baseado na análise de js/gestao/importacao/assertividade.js

CREATE TABLE IF NOT EXISTS assertividade (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_ppc BIGINT,
    data_referencia DATE,
    end_time_raw VARCHAR(255),
    usuario_id INT,
    company_id BIGINT,
    schema_id BIGINT,
    empresa_nome VARCHAR(255),
    assistente_nome VARCHAR(255),
    auditora_nome VARCHAR(255),
    doc_name VARCHAR(255),
    status VARCHAR(50),
    nome_ppc VARCHAR(255),
    observacao TEXT,
    fila VARCHAR(100),
    revalidacao VARCHAR(100),
    tipo_documento VARCHAR(100),
    data_auditoria VARCHAR(50),
    qtd_campos INT,
    qtd_ok INT,
    qtd_nok INT,
    qtd_docs_validados INT,
    porcentagem_assertividade VARCHAR(20),
    assertividade_val DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_assert_data ON assertividade (data_referencia);
CREATE INDEX idx_assert_user ON assertividade (usuario_id);
CREATE INDEX idx_assert_assistente ON assertividade (assistente_nome);
