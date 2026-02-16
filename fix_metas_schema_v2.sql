-- Script SQL para corrigir erro "Unknown column 'usuario_id'" na tabela 'metas'
-- Este script adiciona a coluna se não existir e garante que o índice único esteja correto.

USE GupyMesa;

-- 1. ADICIONAR COLUNA USUARIO_ID (SE NÃO EXISTIR)
-- O TiDB não suporta IF NOT EXISTS no ALTER TABLE diretamente da mesma forma que o MySQL em todas as versões,
-- mas vamos tentar o comando padrão que deve funcionar na maioria das versões compatíveis.

-- A melhor forma de garantir isso sem erros em scripts simples é tentar alterar e ignorar erro se já existir, 
-- ou recriar a tabela se não tiver dados importantes. 
-- Como presumo que já existam dados, vamos fazer um ALTER TABLE seguro.

SET @dbname = DATABASE();
SET @tablename = "metas";
SET @columnname = "usuario_id";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE metas ADD COLUMN usuario_id VARCHAR(50) NOT NULL AFTER id;"
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. AJUSTAR ÍNDICES (PARA EVITAR DUPLICIDADE COM A NOVA COLUNA)

-- Tentar remover o índice antigo se ele não contiver usuario_id (pode falhar se não existir, mas o script continua)
-- DROP INDEX unique_usuario_mes_ano ON metas; 
-- (Comentado para evitar erro fatal se o índice não existir com esse nome exato ou se for primary)

-- Cria índice correto garantindo unicidade por usuario + periodo
-- O TiDB suporta CREATE INDEX IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_unique_user_periodo ON metas (usuario_id, mes, ano);

-- 3. VERIFICAÇÃO FINAL
DESCRIBE metas;
