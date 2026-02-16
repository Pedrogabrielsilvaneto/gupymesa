-- Migração 002: Adicionar colunas de metas (produção e assertividade)

SET @dbname = DATABASE();
SET @tablename = 'metas';

-- 1. Adicionar meta_producao (INT)
SET @col1 = 'meta_producao';
SET @stmt1 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @col1)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE metas ADD COLUMN meta_producao INT DEFAULT NULL'
));
PREPARE stmt1 FROM @stmt1;
EXECUTE stmt1;
DEALLOCATE PREPARE stmt1;

-- 2. Adicionar meta_assertividade (DECIMAL)
SET @col2 = 'meta_assertividade';
SET @stmt2 = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @col2)
  ) > 0,
  'SELECT 1',
  'ALTER TABLE metas ADD COLUMN meta_assertividade DECIMAL(5,2) DEFAULT NULL'
));
PREPARE stmt2 FROM @stmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Verificação
DESCRIBE metas;
