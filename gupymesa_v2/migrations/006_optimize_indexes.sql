-- Migração 006: Otimização de Índices para Performance do Dashboard
-- Esta migração adiciona índices compostos para acelerar as consultas de filtros e agrupamentos no TiDB.

USE GupyMesa;

-- ==========================================
-- 1. TABELA 'assertividade' (Otimização Pesada)
-- ==========================================

-- Índice composto para filtros por período + usuário (Comum em Dashboards e Minha Área)
CREATE INDEX IF NOT EXISTS idx_assert_data_user ON assertividade (data_referencia, usuario_id);
CREATE INDEX IF NOT EXISTS idx_assert_user_data ON assertividade (usuario_id, data_referencia);

-- Índice para agrupamentos de assertividade (KPIs de Produtividade)
-- Melhora consultas de AVG(assertividade_val) GROUP BY usuario_id filtrando por período
CREATE INDEX IF NOT EXISTS idx_assert_kpi ON assertividade (data_referencia, assertividade_val, usuario_id);

-- Índice para a busca de Auditoria (Dashboard Gestão)
CREATE INDEX IF NOT EXISTS idx_assert_auditora_data ON assertividade (auditora_nome, data_referencia);

-- Índices para buscas rápidas por texto
CREATE INDEX IF NOT EXISTS idx_assert_empresa ON assertividade (empresa_nome);
CREATE INDEX IF NOT EXISTS idx_assert_assistente ON assertividade (assistente_nome);
CREATE INDEX IF NOT EXISTS idx_assert_doc_name ON assertividade (doc_name);

-- ==========================================
-- 2. TABELA 'producao'
-- ==========================================

-- Melhora consultas de volume por período e usuário
CREATE INDEX IF NOT EXISTS idx_prod_data_user ON producao (data_referencia, usuario_id);
CREATE INDEX IF NOT EXISTS idx_prod_user_data ON producao (usuario_id, data_referencia);

-- ==========================================
-- 3. TABELA 'checkin_diario'
-- ==========================================

-- Melhora a verificação de presença/dias trabalhados
CREATE INDEX IF NOT EXISTS idx_checkin_data_user ON checkin_diario (data_referencia, usuario_uid);
CREATE INDEX IF NOT EXISTS idx_checkin_user_data ON checkin_diario (usuario_uid, data_referencia);

-- ==========================================
-- 4. TABELA 'usuarios' (Filtros do HUD)
-- ==========================================

-- Melhora a listagem geral e ordenação
CREATE INDEX IF NOT EXISTS idx_usuarios_nome ON usuarios (nome);

-- Melhora filtros de Perfil, Contrato e Situação (Filtros dinâmicos rápidos)
CREATE INDEX IF NOT EXISTS idx_usuarios_stats ON usuarios (situacao, contrato, funcao);

-- ==========================================
-- 5. TABELA 'config_mes' e 'metas'
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_config_mes_ano ON config_mes (ano, mes);
CREATE INDEX IF NOT EXISTS idx_metas_usuario_periodo ON metas (usuario_id, ano, mes);
