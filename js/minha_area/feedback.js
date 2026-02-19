MinhaArea.Feedback = {
    chatAtivo: null, // 'GERAL' ou UID do usuário
    destinatarioAtual: null,
    pollingInterval: null,
    mensagensCache: [],
    contatosCache: [],
    anexoAtual: null,

    init: async function () {
        await this.carregarContatos();
        // Seleciona GERAL por padrão ao abrir
        this.selecionarChat('GERAL');

        // Inicia Polling (solução simples para "Realtime" via SQL)
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => this.atualizarMensagensSilencioso(), 5000);
    },

    carregarContatos: async function () {
        // Carrega usuários para a sidebar
        try {
            const container = document.getElementById('chat-contacts-dynamic');
            if (!container) return;
            container.innerHTML = '<div class="text-center py-2"><i class="fas fa-spinner fa-spin text-blue-500"></i></div>';

            // Query SQL direta (TiDB)
            const sql = `
                SELECT id, nome, perfil, funcao, avatar_url 
                FROM usuarios 
                WHERE ativo = 1 AND id != ? 
                ORDER BY nome
            `;
            const users = await Sistema.query(sql, [MinhaArea.usuario.id]);

            if (!users) throw new Error("Falha ao buscar contatos.");

            this.contatosCache = users;
            this.renderizarContatos(users);

        } catch (err) {
            console.error("Erro ao carregar contatos:", err);
            const container = document.getElementById('chat-contacts-dynamic');
            if (container) container.innerHTML = '<div class="text-center text-xs text-rose-500">Erro ao carregar contatos.</div>';
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
            // Hide status for General
            document.getElementById('chat-header-status').classList.add('hidden');
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

                // Generic status
                const statusEl = document.getElementById('chat-header-status');
                statusEl.classList.remove('hidden');
                statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Disponível para mensagem';
            }
        }

        // Limpa e Carrega Mensagens
        document.getElementById('chat-messages-area').innerHTML = '<div class="flex justify-center py-10"><i class="fas fa-circle-notch fa-spin text-slate-300 text-2xl"></i></div>';
        await this.carregarMensagens();
    },

    carregarMensagens: async function () {
        try {
            let sql = "";
            let params = [];

            if (this.chatAtivo === 'GERAL') {
                sql = "SELECT * FROM feedbacks WHERE tipo_destinatario = 'TODOS' ORDER BY created_at ASC";
            } else {
                // Conversa privada: (Eu -> Ele) OU (Ele -> Eu)
                const me = MinhaArea.usuario.id;
                const other = this.chatAtivo;
                sql = `
                    SELECT * FROM feedbacks 
                    WHERE (remetente_id = ? AND destinatario_id = ?) 
                       OR (remetente_id = ? AND destinatario_id = ?) 
                    ORDER BY created_at ASC
                `;
                params = [me, other, other, me];
            }

            const data = await Sistema.query(sql, params);

            if (data === null) { // Erro na query
                throw new Error("Erro na consulta SQL.");
            }

            this.mensagensCache = data || [];
            this.renderizarMensagens();
            this.scrollParaFim();

        } catch (err) {
            console.error("Erro ao carregar mensagens:", err);
            // Se falhar e a UI estiver carregando, mostra erro
            const area = document.getElementById('chat-messages-area');
            if (area && area.innerHTML.includes('fa-spin')) {
                area.innerHTML = '<div class="text-center p-8 text-rose-400">Erro ao carregar mensagens. Tente novamente.</div>';
            }
        }
    },

    atualizarMensagensSilencioso: async function () {
        if (!this.chatAtivo) return;
        // Re-executa query (poll)
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
                conteudo += `<p class="whitespace-pre-wrap leading-relaxed ${msg.tipo_midia !== 'TEXTO' ? 'mt-1' : ''}">${Sistema.escapar(msg.mensagem)}</p>`;
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

            // Upload se tiver anexo (Mantido Supabase Storage por enquanto)
            if (this.anexoAtual) {
                const file = this.anexoAtual;
                const ext = file.name.split('.').pop().toLowerCase();
                nomeArq = file.name;

                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) tipoMidia = 'IMAGEM';
                else if (['mp4', 'webm', 'mov'].includes(ext)) tipoMidia = 'VIDEO';
                else if (['mp3', 'wav', 'ogg'].includes(ext)) tipoMidia = 'AUDIO';
                else tipoMidia = 'DOCUMENTO';

                try {
                    // Nota: Se não houver bucket configurado, isso falhará.
                    // O usuário deve configurar o bucket 'chat-files' no Supabase Storage.
                    const path = `chat/${Date.now()}_${file.name}`;
                    const { data, error: upErr } = await Sistema.supabase.storage
                        .from('chat-files')
                        .upload(path, file);

                    if (upErr) throw upErr;

                    const { data: pubData } = Sistema.supabase.storage.from('chat-files').getPublicUrl(path);
                    urlMidia = pubData.publicUrl;

                } catch (storageErr) {
                    console.error("Erro upload Storage:", storageErr);
                    if (!confirm("Falha no upload de arquivo (Storage indisponível?). Enviar apenas o texto?")) {
                        input.disabled = false;
                        return;
                    }
                    tipoMidia = 'TEXTO';
                }
            }

            // Define valores para Insert
            const remetente_id = MinhaArea.usuario.id;
            const created_at = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format MySQL

            let tipo_destinatario = 'INDIVIDUAL';
            let destinatario_id = this.chatAtivo;

            if (this.chatAtivo === 'GERAL') {
                tipo_destinatario = 'TODOS';
                destinatario_id = null;
            }

            const sql = `
                INSERT INTO feedbacks (
                    id, created_at, remetente_id, destinatario_id, tipo_destinatario, 
                    mensagem, tipo_midia, url_midia, nome_arquivo
                ) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            // Executa Query TiDB
            await Sistema.query(sql, [
                created_at, remetente_id, destinatario_id, tipo_destinatario,
                texto, tipoMidia, urlMidia, nomeArq
            ]);

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