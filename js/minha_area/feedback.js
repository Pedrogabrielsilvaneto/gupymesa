MinhaArea.Feedback = {
    chatAtivo: null, // 'GERAL' ou UID do usuário
    destinatarioAtual: null,
    pollingInterval: null,
    mensagensCache: [],
    contatosCache: [],
    anexoAtual: null,

    init: async function () {
        console.log("💬 [Feedback] Iniciando módulo de Chat...");
        await this.carregarContatos();
        // Seleciona GERAL por padrão ao abrir
        this.selecionarChat('GERAL');

        // Inicia Polling (solução simples para "Realtime" sem configurar WebSockets complexos por enquanto)
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => this.atualizarMensagensSilencioso(), 5000);
    },

    carregarContatos: async function () {
        // Carrega usuários para a sidebar
        // Se for Admin/Gestor, vê todo mundo. Se for Assistente, vê Gestores.
        try {
            const container = document.getElementById('chat-contacts-dynamic');
            if (!container) return;
            container.innerHTML = '<div class="text-center py-2"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';

            // Busca usuários da tabela usuarios
            const { data: users, error } = await Sistema.supabase
                .from('usuarios')
                .select('id, nome, perfil, funcao, avatar_url')
                .eq('ativo', true)
                .neq('id', MinhaArea.usuario.id) // Não mostrar a si mesmo
                .order('nome');

            if (error) throw error;
            this.contatosCache = users;
            this.renderizarContatos(users);

        } catch (err) {
            console.error("Erro ao carregar contatos:", err);
        }
    },

    renderizarContatos: function (lista) {
        const container = document.getElementById('chat-contacts-dynamic');
        if (!container) return;

        const html = lista.map(u => {
            const iniciais = u.nome.substring(0, 2).toUpperCase();
            const avatar = u.avatar_url
                ? `<img src="${u.avatar_url}" class="w-10 h-10 rounded-full object-cover">`
                : `<div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">${iniciais}</div>`;

            const cargo = u.funcao || u.perfil || 'Colaborador';

            return `
                <div onclick="MinhaArea.Feedback.selecionarChat('${u.id}')" id="contact-item-${u.id}"
                    class="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-slate-50 transition border border-transparent hover:border-slate-100 group">
                    <div class="shrink-0 relative">
                        ${avatar}
                        <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-baseline">
                            <span class="font-bold text-slate-700 text-xs truncate capitalize">${u.nome.toLowerCase()}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate">${cargo}</p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    },

    filtrarContatos: function (termo) {
        if (!termo) {
            this.renderizarContatos(this.contatosCache);
            return;
        }
        const lower = termo.toLowerCase();
        const filtrados = this.contatosCache.filter(u => u.nome.toLowerCase().includes(lower) || (u.funcao && u.funcao.toLowerCase().includes(lower)));
        this.renderizarContatos(filtrados);
    },

    selecionarChat: async function (id) {
        this.chatAtivo = id;

        // Atualiza UI da Sidebar (Active State)
        document.querySelectorAll('[id^="contact-item-"]').forEach(el => el.classList.remove('bg-blue-50', 'border-blue-100'));
        const activeItem = document.getElementById(`contact-item-${id}`);
        if (activeItem) activeItem.classList.add('bg-blue-50', 'border-blue-100');

        // Atualiza Header
        const headerName = document.getElementById('chat-header-name');
        const headerAvatar = document.getElementById('chat-header-avatar');

        if (id === 'GERAL') {
            headerName.innerText = "Canal Geral";
            headerAvatar.innerHTML = '<i class="fas fa-users text-blue-500"></i>';
            headerAvatar.className = "w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center";
            this.destinatarioAtual = null; // Broadcast
        } else {
            const user = this.contatosCache.find(u => u.id === id);
            if (user) {
                headerName.innerText = user.nome;
                const iniciais = user.nome.substring(0, 2).toUpperCase();
                headerAvatar.innerHTML = user.avatar_url
                    ? `<img src="${user.avatar_url}" class="w-full h-full rounded-full object-cover">`
                    : `<span class="text-sm font-bold text-slate-600">${iniciais}</span>`;
                headerAvatar.className = "w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden";
                this.destinatarioAtual = user.id;
            }
        }

        // Limpa e Carrega Mensagens
        document.getElementById('chat-messages-area').innerHTML = '<div class="flex justify-center py-10"><i class="fas fa-circle-notch fa-spin text-slate-300 text-2xl"></i></div>';
        await this.carregarMensagens();
    },

    carregarMensagens: async function () {
        try {
            let query = Sistema.supabase
                .from('feedbacks')
                .select('*')
                .order('created_at', { ascending: true });

            if (this.chatAtivo === 'GERAL') {
                query = query.eq('tipo_destinatario', 'TODOS');
            } else {
                // Conversa privada: (Eu -> Ele) OU (Ele -> Eu)
                // Sintaxe Supabase OR complicada, vamos simplificar
                // Trazendo as que envolvem os dois IDs
                // (remetente = eu AND destinatario = ele) OR (remetente = ele AND destinatario = eu)
                const me = MinhaArea.usuario.id;
                const other = this.chatAtivo;
                query = query.or(`and(remetente_id.eq.${me},destinatario_id.eq.${other}),and(remetente_id.eq.${other},destinatario_id.eq.${me})`);
            }

            const { data, error } = await query;
            if (error) {
                // Se a tabela não existir, avisa
                if (error.code === '42P01') { // undefined_table
                    document.getElementById('chat-messages-area').innerHTML = `
                        <div class="text-center p-8 text-slate-400">
                            <i class="fas fa-database text-3xl mb-2"></i>
                            <p>Tabela de chat não encontrada. Execute o script de migração.</p>
                        </div>`;
                    return;
                }
                throw error;
            }

            this.mensagensCache = data || [];
            this.renderizarMensagens();
            this.scrollParaFim();

        } catch (err) {
            console.error("Erro ao carregar mensagens:", err);
        }
    },

    atualizarMensagensSilencioso: async function () {
        if (!this.chatAtivo) return;
        // Re-executa query (idealmente seria só as novas, mas por simplicidade e consistência...)
        await this.carregarMensagens();
    },

    renderizarMensagens: function () {
        const area = document.getElementById('chat-messages-area');
        if (!area) return;

        if (this.mensagensCache.length === 0) {
            area.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-300 opacity-50">
                    <i class="fas fa-paper-plane text-4xl mb-2"></i>
                    <p>Nenhuma mensagem ainda.</p>
                </div>`;
            return;
        }

        const meuId = MinhaArea.usuario.id;

        const html = this.mensagensCache.map(msg => {
            const souEu = msg.remetente_id === meuId;
            const alignClass = souEu ? 'self-end items-end' : 'self-start items-start';
            const bubbleClass = souEu ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none';
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Conteúdo (Texto ou Mídia)
            let conteudo = '';
            if (msg.tipo_midia === 'IMAGEM') {
                conteudo = `<div class="mb-1"><img src="${msg.url_midia}" class="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition" onclick="window.open('${msg.url_midia}','_blank')"></div>`;
            } else if (msg.tipo_midia === 'VIDEO') {
                conteudo = `<video src="${msg.url_midia}" controls class="max-w-[250px] rounded-lg"></video>`;
            } else if (msg.tipo_midia === 'AUDIO') {
                conteudo = `<audio src="${msg.url_midia}" controls class="max-w-[200px]"></audio>`;
            } else if (msg.tipo_midia === 'DOCUMENTO') {
                conteudo = `<a href="${msg.url_midia}" target="_blank" class="flex items-center gap-2 bg-black/10 p-2 rounded hover:bg-black/20 transition">
                    <i class="fas fa-file-alt"></i> <span class="underline text-sm">${msg.nome_arquivo || 'Arquivo'}</span>
                </a>`;
            }

            if (msg.mensagem) {
                conteudo += `<p class="whitespace-pre-wrap leading-relaxed ${msg.tipo_midia !== 'TEXTO' ? 'mt-1' : ''}">${msg.mensagem}</p>`;
            }

            return `
                <div class="flex flex-col max-w-[70%] ${alignClass} animate-fade-in">
                    <div class="${bubbleClass} px-4 py-2 rounded-2xl shadow-sm relative group min-w-[60px]">
                        ${conteudo}
                        <span class="text-[9px] opacity-60 absolute bottom-1 right-2 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            ${time}
                            ${souEu ? '<i class="fas fa-check ml-1"></i>' : ''}
                        </span>
                    </div>
                </div>
            `;
        }).join('');

        area.innerHTML = html;
        // Nota: Idealmente comparar se mudou algo antes de dar replace no innerHTML p/ não perder scroll, mas com scrollParaFim resolve pra chat.
    },

    scrollParaFim: function () {
        const area = document.getElementById('chat-messages-area');
        if (area) area.scrollTop = area.scrollHeight;
    },

    checkEnter: function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.enviar();
        }
    },

    handleFileSelect: function (input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            this.anexoAtual = file;

            // Preview
            const prev = document.getElementById('chat-upload-preview');
            const name = document.getElementById('chat-upload-filename');

            if (prev && name) {
                prev.classList.remove('hidden');
                name.innerText = file.name;
            }
        }
    },

    limparAnexo: function () {
        this.anexoAtual = null;
        document.getElementById('chat-input-file').value = '';
        document.getElementById('chat-upload-preview').classList.add('hidden');
    },

    enviar: async function () {
        const input = document.getElementById('chat-input-text');
        const texto = input.value.trim();

        if (!texto && !this.anexoAtual) return;

        // Bloqueia UI
        input.disabled = true;

        try {
            let urlMidia = null;
            let tipoMidia = 'TEXTO';
            let nomeArq = null;

            // Upload se tiver anexo
            if (this.anexoAtual) {
                const file = this.anexoAtual;
                const ext = file.name.split('.').pop().toLowerCase();
                nomeArq = file.name;

                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) tipoMidia = 'IMAGEM';
                else if (['mp4', 'webm', 'mov'].includes(ext)) tipoMidia = 'VIDEO';
                else if (['mp3', 'wav', 'ogg'].includes(ext)) tipoMidia = 'AUDIO';
                else tipoMidia = 'DOCUMENTO';

                // Usando Supabase Storage (supondo bucket 'chat-files')
                // Se falhar o bucket, vamos apenas logar o erro
                try {
                    const path = `chat/${Date.now()}_${file.name}`;
                    const { data, error: upErr } = await Sistema.supabase.storage
                        .from('chat-files')
                        .upload(path, file);

                    if (upErr) throw upErr;

                    // Public URL
                    const { data: pubData } = Sistema.supabase.storage.from('chat-files').getPublicUrl(path);
                    urlMidia = pubData.publicUrl;

                } catch (storageErr) {
                    console.error("Erro upload Storage (Bucket chat-files existe?):", storageErr);
                    // Fallback para teste: Fake URL (pra não quebrar a demo) ou Alert
                    if (!confirm("Falha no upload (Bucket não existe?). Enviar apenas texto?")) {
                        input.disabled = false;
                        return;
                    }
                    tipoMidia = 'TEXTO';
                }
            }

            const payload = {
                remetente_id: MinhaArea.usuario.id,
                mensagem: texto,
                tipo_midia: tipoMidia,
                url_midia: urlMidia,
                nome_arquivo: nomeArq,
                created_at: new Date()
            };

            if (this.chatAtivo === 'GERAL') {
                payload.tipo_destinatario = 'TODOS';
                payload.destinatario_id = null;
            } else {
                payload.tipo_destinatario = 'INDIVIDUAL';
                payload.destinatario_id = this.chatAtivo;
            }

            const { error } = await Sistema.supabase.from('feedbacks').insert(payload);

            if (error) throw error;

            // Sucesso: Limpa
            input.value = '';
            this.limparAnexo();
            await this.carregarMensagens(); // Refresh imediato

        } catch (err) {
            console.error("Erro ao enviar:", err);
            alert("Erro ao enviar mensagem: " + err.message);
        } finally {
            input.disabled = false;
            input.focus();
        }
    }
};