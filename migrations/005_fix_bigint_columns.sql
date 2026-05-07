-- Migração 005: Ajustar colunas numéricas para VARCHAR
-- IDs do CSV podem exceder o limite de BIGINT (19 dígitos)

ALTER TABLE assertividade MODIFY COLUMN id_ppc VARCHAR(50);
ALTER TABLE assertividade MODIFY COLUMN company_id VARCHAR(50);
ALTER TABLE assertividade MODIFY COLUMN schema_id VARCHAR(50)
