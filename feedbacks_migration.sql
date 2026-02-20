-- CRIAÇÃO DA TABELA DE FEEDBACKS (CHAT CORPORATIVO)

CREATE TABLE IF NOT EXISTS feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    remetente_id UUID NOT NULL, -- ID do usuário que enviou
    destinatario_id UUID, -- ID do usuário que recebe (NULL se for broadcast/equipe)
    tipo_destinatario TEXT NOT NULL CHECK (tipo_destinatario IN ('INDIVIDUAL', 'EQUIPE', 'TODOS')),
    mensagem TEXT, -- Conteúdo do texto
    tipo_midia TEXT DEFAULT 'TEXTO' CHECK (tipo_midia IN ('TEXTO', 'IMAGEM', 'VIDEO', 'AUDIO', 'DOCUMENTO')),
    url_midia TEXT, -- URL do arquivo (Supabase Storage ou Link Externo)
    nome_arquivo TEXT, -- Nome original do arquivo para display
    lido BOOLEAN DEFAULT FALSE, -- Status de leitura
    
    -- Foreign Keys (assumindo que existe tabela usuarios)
    CONSTRAINT fk_remetente FOREIGN KEY (remetente_id) REFERENCES usuarios(id),
    CONSTRAINT fk_destinatario FOREIGN KEY (destinatario_id) REFERENCES usuarios(id)
);

-- ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_feedbacks_remetente ON feedbacks(remetente_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_destinatario ON feedbacks(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_data ON feedbacks(created_at DESC);

-- POLICIES (Segurança - RLS)
-- Habilitar RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- 1. Leitura: Usuários podem ver mensagens enviadas POR eles ou PARA eles (ou PARA TODOS/EQUIPE se pertencerem)
-- Nota: A lógica de 'EQUIPE' pode ser complexa dependendo de como os times são definidos. 
-- Simplificação inicial: Ver suas próprias mensagens (enviadas/recebidas) e mensagens de 'TODOS'.

CREATE POLICY "Ver seus próprios feedbacks" ON feedbacks
    FOR SELECT
    USING (
        auth.uid() = remetente_id OR 
        auth.uid() = destinatario_id OR
        tipo_destinatario = 'TODOS'
    );

-- 2. Inserção: Todos autenticados podem enviar
CREATE POLICY "Enviar feedbacks" ON feedbacks
    FOR INSERT
    WITH CHECK (auth.uid() = remetente_id);

-- 3. Update: Apenas o destinatário pode marcar como lido (ou o remetente editar? Geralmente chat não edita)
CREATE POLICY "Marcar como lido" ON feedbacks
    FOR UPDATE
    USING (auth.uid() = destinatario_id)
    WITH CHECK (auth.uid() = destinatario_id);


-- TABELA DE CHECK-IN DIÁRIO (CONFIRMAÇÃO DE LEITURA)
CREATE TABLE IF NOT EXISTS checkin_diario (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_uid UUID NOT NULL,
    data_referencia DATE NOT NULL, -- O dia que está sendo confirmado (ex: ontem)
    data_checkin TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Quando confirmou
    status TEXT DEFAULT 'CONFIRMADO',
    
    CONSTRAINT unique_checkin_dia UNIQUE (usuario_uid, data_referencia)
);

CREATE INDEX IF NOT EXISTS idx_checkin_uid ON checkin_diario(usuario_uid);
CREATE INDEX IF NOT EXISTS idx_checkin_data ON checkin_diario(data_referencia);

ALTER TABLE checkin_diario ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário pode ver seus próprios checkins
CREATE POLICY "Ver seus checkins" ON checkin_diario FOR SELECT USING (auth.uid() = usuario_uid);

-- Policy: Usuário pode inserir seu próprio checkin
CREATE POLICY "Inserir checkin" ON checkin_diario FOR INSERT WITH CHECK (auth.uid() = usuario_uid);

-- Policy: Gestores podem ver todos (Simplificado: authenticated pode ver tudo por enquanto, ou restrito por role depois)
-- Para facilitar o MVP, vamos liberar SELECT para autenticados (Gestores precisam ver de todos)
CREATE POLICY "Gestores veem checkins" ON checkin_diario FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Ver seus checkins" ON checkin_diario FOR SELECT USING (auth.uid() = usuario_uid);

-- Policy: Usuário pode inserir seu próprio checkin
CREATE POLICY "Inserir checkin" ON checkin_diario FOR INSERT WITH CHECK (auth.uid() = usuario_uid);

-- Tabela de Check-in Diário (Produtividade)
CREATE TABLE IF NOT EXISTS checkin_diario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_uid VARCHAR(255) NOT NULL,
    data_referencia DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'CONFIRMADO',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_checkin (usuario_uid, data_referencia)
);

-- Políticas de Check-in (Simuladas no App via TiDB)
-- (O TiDB não tem policies estilo Supabase, o controle é via filtro no Backend/App)r role depois)
-- Para facilitar o MVP, vamos liberar SELECT para autenticados (Gestores precisam ver de todos)
CREATE POLICY "Gestores veem checkins" ON checkin_diario FOR SELECT USING (auth.role() = 'authenticated');
