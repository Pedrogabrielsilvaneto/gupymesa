-- Migração 003: Adicionar AUTO_INCREMENT ao ID

SET @dbname = DATABASE();
SET @tablename = 'metas';

-- Verificação simplificada: Tenta modificar a coluna ID para ser AUTO_INCREMENT
-- Em TiDB/MySQL, isso geralmente exige que seja Key também.

ALTER TABLE metas MODIFY COLUMN id INT AUTO_INCREMENT;

-- Nota: Se id não for Primary Key, o comando acima pode falhar ou exigir ADD PRIMARY KEY.
-- O CREATE TABLE original definia id INT AUTO_INCREMENT PRIMARY KEY.
-- Se a tabela foi criada sem isso, precisamos garantir.

-- Caso seguro:
-- SELECT 'Ajustando ID para AUTO_INCREMENT...';
