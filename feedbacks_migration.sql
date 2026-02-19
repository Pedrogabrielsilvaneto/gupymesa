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
