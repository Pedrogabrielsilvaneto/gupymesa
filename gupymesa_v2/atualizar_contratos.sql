-- Script para atualizar todos os contratos "PJ" para "TERCEIROS"
-- Execute este comando no TiDB (dentro do banco GupyMesa)

USE GupyMesa;

UPDATE usuarios
SET contrato = 'TERCEIROS'
WHERE UPPER(TRIM(contrato)) = 'PJ' 
   OR UPPER(TRIM(contrato)) LIKE '%PJ%';

-- Verificar resultado
SELECT contrato, COUNT(*) as total
FROM usuarios
GROUP BY contrato
ORDER BY contrato;
