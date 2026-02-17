/* ARQUIVO: js/gestao/metas.js */
Gestao.Metas = {
    state: {
        mes: new Date().getMonth() + 1,
        ano: new Date().getFullYear(),
        listaCompleta: [],
        listaVisivel: [],
        alteracoesPendentes: new Set(),
        _initialized: false
    },

    MESES: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],

    init: function () {
        if (!this.state._initialized) {
            this.atualizarInputMes();
            this.state._initialized = true;
        }
        this.carregar();
    },

    atualizarInputMes: function () {
        const el = document.getElementById('input-mes-metas');
        if (el) el.value = String(this.state.mes).padStart(2, '0') + '/' + this.state.ano;

        // Carrega Configuração do Mês (Dias Úteis + Headcount)
        this.carregarConfigMes();
    },

    carregarConfigMes: async function () {
        if (!Gestao.ConfigMes) return;
        const inputDias = document.getElementById('input-dias-uteis-metas');
        const inputClt = document.getElementById('input-hc-clt-metas');
        const inputTerc = document.getElementById('input-hc-terc-metas');

        if (inputDias) { inputDias.value = ''; inputDias.placeholder = '...'; }
        if (inputClt) { inputClt.value = ''; inputClt.placeholder = '...'; }
        if (inputTerc) { inputTerc.value = ''; inputTerc.placeholder = '...'; }

        const config = await Gestao.ConfigMes.obter(this.state.mes, this.state.ano);

        if (inputDias) {
            inputDias.value = (config && config.dias_uteis) ? config.dias_uteis : '';
            inputDias.placeholder = (config && config.dias_uteis) ? '' : 'Auto';
        }
        if (inputClt) {
            inputClt.value = (config && config.hc_clt) ? config.hc_clt : '';
            inputClt.placeholder = (config && config.hc_clt) ? '' : '-';
        }
        if (inputTerc) {
            inputTerc.value = (config && config.hc_terceiros) ? config.hc_terceiros : '';
            inputTerc.placeholder = (config && config.hc_terceiros) ? '' : '-';
        }
    },

    salvarConfigMes: async function () {
        const inputDias = document.getElementById('input-dias-uteis-metas');
        const inputClt = document.getElementById('input-hc-clt-metas');
        const inputTerc = document.getElementById('input-hc-terc-metas');
        const icon = document.getElementById('icon-saved-config'); // Atualizado ID

        const dados = {
            dias_uteis: inputDias ? (inputDias.value ? parseInt(inputDias.value) : null) : null,
            hc_clt: inputClt ? (inputClt.value ? parseInt(inputClt.value) : 0) : 0,
            hc_terceiros: inputTerc ? (inputTerc.value ? parseInt(inputTerc.value) : 0) : 0
        };

        await Gestao.ConfigMes.salvar(this.state.mes, this.state.ano, dados);

        if (icon) {
            icon.classList.remove('hidden');
            setTimeout(() => icon.classList.add('hidden'), 2000);
        }
    },

    // --- Lógica do Seletor de Mês ---
    abrirSeletorMes: function () {
        const dropdown = document.getElementById('dropdown-mes-metas');
        if (!dropdown) return;

        this.viewAno = this.state.ano; // Inicia com o ano atual
        dropdown.classList.remove('hidden');
        this.renderizarGradeMeses();

        // Fechar ao clicar fora
        setTimeout(() => {
            const closeHandler = (e) => {
                const el = document.getElementById('dropdown-mes-metas');
                const input = document.getElementById('input-mes-metas');
                if (el && !el.classList.contains('hidden') && !el.contains(e.target) && e.target !== input) {
                    el.classList.add('hidden');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    },

    mudarAno: function (delta) {
        this.viewAno = (this.viewAno || this.state.ano) + delta;
        this.renderizarGradeMeses();
    },

    renderizarGradeMeses: function () {
        const grid = document.getElementById('grid-meses-metas');
        const labelAno = document.getElementById('label-ano-metas');
        if (!grid || !labelAno) return;

        labelAno.innerText = this.viewAno;

        grid.innerHTML = this.MESES.map((nome, i) => {
            const mes = i + 1;
            const isSelected = (mes === this.state.mes && this.viewAno === this.state.ano);
            const classe = isSelected
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-600 border border-slate-100';

            return `<button onclick="Gestao.Metas.confirmarSelecaoMes(${mes})" class="rounded py-1.5 text-xs font-bold transition ${classe}">${nome.substring(0, 3)}</button>`;
        }).join('');
    },

    confirmarSelecaoMes: function (mes) {
        this.state.mes = mes;
        this.state.ano = this.viewAno;
        this.atualizarInputMes();
        document.getElementById('dropdown-mes-metas').classList.add('hidden');
        this.state.alteracoesPendentes.clear();
        this.carregar();
    },

    selecionarMes: function () {
        const el = document.getElementById('input-mes-metas');
        if (!el || !el.value) return;

        const val = el.value.trim();
        const match = val.match(/^(\d{1,2})\s*[\/\-\.]\s*(\d{4})$/);
        if (!match) {
            this.atualizarInputMes(); // reverte ao valor válido
            return;
        }

        const mes = parseInt(match[1]);
        const ano = parseInt(match[2]);

        if (mes < 1 || mes > 12 || ano < 2020 || ano > 2040) {
            this.atualizarInputMes();
            return;
        }

        this.state.mes = mes;
        this.state.ano = ano;
        this.atualizarInputMes(); // normaliza formato
        this.state.alteracoesPendentes.clear();
        this.carregar();
    },

    carregar: async function () {
        const tbody = document.getElementById('lista-metas');
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-12"><i class="fas fa-circle-notch fa-spin text-slate-400 text-xl"></i></td></tr>';

        try {
            const usersRows = await Sistema.query(`SELECT id, nome, contrato, situacao, funcao, nivel_acesso FROM usuarios ORDER BY nome`);
            if (!usersRows) throw new Error("Falha ao carregar usuários.");

            const metasRows = await Sistema.query(`SELECT * FROM metas WHERE mes = ? AND ano = ?`, [this.state.mes, this.state.ano]);
            if (metasRows === null) throw new Error("Falha ao carregar metas.");

            this.state.listaCompleta = usersRows.map(u => {
                const m = metasRows.find(x => x.usuario_id === u.id || x.usuario_id === String(u.id));
                const ativo = (u.situacao || '').toUpperCase() === 'ATIVO';
                const funcao = (u.funcao || '').toUpperCase();

                let contrato = (u.contrato || '').toUpperCase().trim();
                if (contrato === 'PJ' || contrato.includes('PJ')) contrato = 'TERCEIROS';
                else if (contrato === 'CLT' || contrato.includes('CLT')) contrato = 'CLT';

                // Categoriza função
                let categFuncao = 'ASSISTENTE';
                if (funcao.includes('GESTOR') || funcao.includes('ADMIN') || u.nome === 'Super Admin' || u.nome === 'Super Admin Gupy' || String(u.id) === '1' || String(u.id) === '1000' || (u.nivel_acesso && parseInt(u.nivel_acesso) >= 2)) {
                    categFuncao = 'GESTAO';
                } else if (funcao.includes('AUDITOR')) {
                    categFuncao = 'AUDITORIA';
                }

                return {
                    id: u.id, nome: u.nome, contrato, situacao: (u.situacao || '').toUpperCase(),
                    ativo, funcao, categFuncao,
                    meta_prod: m ? (m.meta_producao || m.meta_prod || null) : null,
                    meta_assert: m ? (m.meta_assertividade || m.meta_assert || null) : null,
                    id_meta: m ? m.id : null
                };
            });

            this.filtrarERenderizar();
        } catch (e) {
            console.error(e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-rose-500 py-4 text-xs">${e.message}</td></tr>`;
        }
    },

    filtrarERenderizar: function () {
        const termo = (document.getElementById('header-search-metas')?.value || '').toLowerCase().trim();
        const contratoFiltro = (document.getElementById('filtro-contrato-metas')?.value || '').toUpperCase();
        const situacaoFiltro = (document.getElementById('filtro-situacao-metas')?.value || '').toUpperCase();
        const funcaoFiltro = (document.getElementById('filtro-funcao-metas')?.value || '').toUpperCase();

        this.state.listaVisivel = this.state.listaCompleta.filter(u => {
            if (termo && !u.nome.toLowerCase().includes(termo) && !String(u.id).includes(termo)) return false;
            if (contratoFiltro && u.contrato !== contratoFiltro) return false;
            if (situacaoFiltro && u.situacao !== situacaoFiltro) return false;
            if (funcaoFiltro && u.categFuncao !== funcaoFiltro) return false;
            return true;
        });

        this.state.listaVisivel.sort((a, b) => {
            if (a.categFuncao !== b.categFuncao) {
                const order = { ASSISTENTE: 0, AUDITORIA: 1, GESTAO: 2 };
                return (order[a.categFuncao] || 0) - (order[b.categFuncao] || 0);
            }
            if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
            return a.nome.localeCompare(b.nome);
        });

        this.renderizar();
    },

    renderizar: function () {
        const tbody = document.getElementById('lista-metas');
        const footer = document.getElementById('resumo-metas-footer');
        if (!tbody) return;

        if (this.state.listaVisivel.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-slate-400 text-xs italic">Nenhum registro encontrado.</td></tr>';
            if (footer) footer.innerText = '0 registros';
            return;
        }

        const funcaoBadge = { GESTAO: 'bg-purple-50 text-purple-600', AUDITORIA: 'bg-amber-50 text-amber-600', ASSISTENTE: '' };

        tbody.innerHTML = this.state.listaVisivel.map(u => {
            const isInactive = !u.ativo;
            let rowClass = 'hover:bg-slate-50/50';
            if (isInactive) rowClass = 'opacity-40';

            const badge = funcaoBadge[u.categFuncao] || '';
            const badgeLabel = u.categFuncao === 'GESTAO' ? 'Gestão' : u.categFuncao === 'AUDITORIA' ? 'Auditoria' : '';

            return `
            <tr class="border-b border-slate-100/80 transition ${rowClass}" id="row-${u.id}">
                <td class="px-6 py-2.5 text-center">
                    <div class="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500 text-[10px] font-bold">
                        ${u.nome.charAt(0)}
                    </div>
                </td>
                <td class="px-5 py-2.5">
                    <div class="flex flex-col gap-0.5">
                        <span class="font-bold text-slate-700 text-xs flex items-center gap-2">
                            ${u.nome}
                            ${badgeLabel ? `<span class="text-[8px] ${badge} px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider">${badgeLabel}</span>` : ''}
                        </span>
                        <span class="text-[9px] text-slate-400 tracking-wide">
                            ${u.contrato || '—'}${isInactive ? ' · <span class="text-rose-400">Inativo</span>' : ''}
                        </span>
                    </div>
                </td>
                
                <td class="px-4 py-2.5 border-l border-slate-100/50">
                    <input type="number" id="prod-${u.id}" 
                        value="${u.meta_prod !== null ? u.meta_prod : ''}" placeholder="—"
                        onchange="Gestao.Metas.marcarAlterado(${u.id})"
                        class="w-full text-center font-bold text-slate-600 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 outline-none py-0.5 transition text-xs">
                </td>

                <td class="px-4 py-2.5 border-l border-slate-100/50">
                    <input type="number" step="0.01" id="assert-${u.id}" 
                        value="${u.meta_assert !== null ? u.meta_assert : ''}" placeholder="—"
                        onchange="Gestao.Metas.marcarAlterado(${u.id})"
                        class="w-full text-center font-bold text-slate-600 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 outline-none py-0.5 transition text-xs">
                </td>
            </tr>`;
        }).join('');

        if (footer) footer.innerText = `${this.state.listaVisivel.length} registros`;
    },

    marcarAlterado: function (uid) {
        this.state.alteracoesPendentes.add(uid);
        const row = document.getElementById(`row-${uid}`);
        if (row) row.classList.add('bg-blue-50/20');
    },

    aplicarPadrao: function () {
        const valProd = document.getElementById('padrao-prod-input')?.value || 650;
        const valAssert = document.getElementById('padrao-assert-input')?.value || 97;
        const alvos = this.state.listaVisivel.filter(u => u.categFuncao === 'ASSISTENTE');
        if (!confirm(`Aplicar ${valProd} / ${valAssert}% para ${alvos.length} assistentes?`)) return;
        alvos.forEach(u => {
            const elProd = document.getElementById(`prod-${u.id}`);
            const elAssert = document.getElementById(`assert-${u.id}`);
            if (elProd) { elProd.value = valProd; this.marcarAlterado(u.id); }
            if (elAssert) { elAssert.value = valAssert; this.marcarAlterado(u.id); }
        });
    },

    salvarTodas: async function () {
        if (this.state.alteracoesPendentes.size === 0) { alert("Nenhuma alteração para salvar."); return; }

        const btn = document.querySelector('#actions-metas button[onclick="Gestao.Metas.salvarTodas()"]');
        let originalHtml;
        if (btn) { originalHtml = btn.innerHTML; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin text-[9px]"></i>'; btn.disabled = true; }

        const upserts = [];
        this.state.alteracoesPendentes.forEach(uid => {
            const u = this.state.listaCompleta.find(x => x.id === uid);
            const valProd = document.getElementById(`prod-${uid}`)?.value;
            const valAssert = document.getElementById(`assert-${uid}`)?.value;
            if (u && valProd && valAssert) {
                upserts.push({
                    usuario_id: uid, mes: this.state.mes, ano: this.state.ano,
                    meta_producao: parseInt(valProd), meta_assertividade: parseFloat(valAssert.replace(',', '.'))
                });
            }
        });

        try {
            if (upserts.length === 0) { alert("Nenhuma alteração válida."); return; }
            const sql = `INSERT INTO metas (id, usuario_id, mes, ano, meta_producao, meta_assertividade) VALUES ${upserts.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')} ON DUPLICATE KEY UPDATE meta_producao = VALUES(meta_producao), meta_assertividade = VALUES(meta_assertividade)`;
            const params = [];
            for (const m of upserts) { params.push(Sistema.gerarUUID(), String(m.usuario_id), this.state.mes, this.state.ano, m.meta_producao, m.meta_assertividade); }
            const result = await Sistema.query(sql, params);
            if (result === null) throw new Error("Falha ao salvar.");
            this.state.alteracoesPendentes.clear();
            await this.carregar();
            alert("✅ Metas salvas!");
        } catch (e) {
            console.error(e); alert("Erro: " + e.message);
        } finally {
            if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
        }
    }
};