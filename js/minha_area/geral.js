/* ARQUIVO: js/minha_area/geral.js
   ATUALIZAÇÃO:
   - Inclusão de "Nº Erros Auditados" no Card de Assertividade.
   - Ajuste de UI para aceitar HTML nos cards (innerHTML).
   - Manutenção das lógicas de Abono e Metas Recalculadas.
*/

MinhaArea.Geral = {
    obsEditando: { data: null, uid: null },

    carregar: async function() {
        const rawUid = MinhaArea.getUsuarioAlvo();
        const uid = rawUid ? parseInt(rawUid) : null;
        const isGeral = (uid === null); 
        const tbody = document.getElementById('tabela-extrato');
        
        // Proteção contra datas inválidas
        const filtro = MinhaArea.getDatasFiltro();
        if (!filtro || !filtro.inicio || !filtro.fim) return;
        const { inicio, fim } = filtro;

        if(tbody) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center py-20 text-slate-400 bg-slate-50/50"><div class="flex flex-col items-center"><i class="fas fa-spinner fa-spin text-2xl text-blue-400 mb-2"></i><span>Carregando dados...</span></div></td></tr>';
        }

        try {
            const dtInicio = new Date(inicio + 'T12:00:00');
            const dtFim = new Date(fim + 'T12:00:00');

            // Queries
            const qProd = Sistema.supabase.from('producao').select('*').gte('data_referencia', inicio).lte('data_referencia', fim);
            const qMetas = Sistema.supabase.from('metas').select('*').gte('ano', dtInicio.getFullYear()).lte('ano', dtFim.getFullYear());
            
            // ATUALIZAÇÃO: Buscando auditora_nome para filtrar erros auditados
            const qAssert = Sistema.supabase.from('assertividade').select('qtd_ok, qtd_nok, usuario_id, data_referencia, auditora_nome').gte('data_referencia', inicio).lte('data_referencia', fim);

            let dProd = [], dMetas = [], dAssert = [];

            const promises = isGeral 
                ? [qProd, qMetas, qAssert] 
                : [qProd.eq('usuario_id', uid), qMetas.eq('usuario_id', uid), qAssert.eq('usuario_id', uid)];

            const [p, m, a] = await Promise.all(promises);

            if (p.error) throw new Error("Erro Prod: " + p.error.message);
            if (m.error) throw new Error("Erro Metas: " + m.error.message);
            
            dProd = p.data || []; 
            dMetas = m.data || []; 
            dAssert = a.data || [];

            // Processamento Metas
            const mapMetas = {}; 
            dMetas.forEach(meta => {
                mapMetas[`${meta.ano}-${meta.mes}`] = {
                    prod: meta.meta_producao || 100,
                    assert: meta.meta_assertividade || 98
                };
            });

            // Processamento Diário (Produção + Abono)
            const mapDiario = new Map();
            const diasProdutivos = new Set();
            
            dProd.forEach(prod => {
                const d = prod.data_referencia;
                if (!mapDiario.has(d)) mapDiario.set(d, { qtd: 0, fator: 0, c: 0, f: 0, gt: 0, gp: 0, j_g: '', j_a: '' });
                const o = mapDiario.get(d);
                
                o.qtd += Number(prod.quantidade || 0);
                o.fator += (prod.fator !== null) ? Number(prod.fator) : 1.0;
                o.c++;
                
                if (prod.quantidade > 0) diasProdutivos.add(d);
                
                o.j_g = (prod.justificativa || prod.justificativa_abono || '').trim();
                o.j_a = (prod.observacao_assistente || '').trim();
                o.f = prod.fifo || 0; 
                o.gt = prod.gradual_total || 0; 
                o.gp = prod.gradual_parcial || 0;
            });

            const listaGrid = [];
            const defaultMetaProd = 100;
            
            let totalProduzido = 0;
            let totalMetaAcumulada = 0; 
            let totalDiasAbonados = 0; 

            for (let d = new Date(dtInicio); d <= dtFim; d.setDate(d.getDate() + 1)) {
                if (d.getDay() === 0 || d.getDay() === 6) continue;
                
                const dStr = d.toISOString().split('T')[0];
                const keyMeta = `${d.getFullYear()}-${d.getMonth() + 1}`;
                const metaObj = mapMetas[keyMeta];
                const metaBase = metaObj ? metaObj.prod : defaultMetaProd;
                const metaAssertMes = metaObj ? metaObj.assert : 98;

                const info = mapDiario.get(dStr);
                const qtdDia = info ? info.qtd : 0;
                const fatorDia = info ? (info.fator / info.c) : 1.0;
                
                const metaAjustada = Math.round(metaBase * fatorDia);
                totalProduzido += qtdDia;
                totalMetaAcumulada += metaAjustada;

                const fatorSeguro = Math.max(0, Math.min(1, fatorDia));
                const abonoDia = 1.0 - fatorSeguro;
                totalDiasAbonados += abonoDia;

                if (info || !isGeral) {
                    listaGrid.push({ 
                        data: dStr, fator: fatorDia, qtd: qtdDia, meta: metaAjustada, metaAssert: metaAssertMes,
                        j_g: info?.j_g || '', j_a: info?.j_a || '', 
                        f: info?.f || 0, gt: info?.gt || 0, gp: info?.gp || 0 
                    });
                }
            }

            // --- ATUALIZAÇÃO DOS CARDS (KPIS) ---

            // CARD 1: PRODUTIVIDADE
            const pctProd = totalMetaAcumulada > 0 ? (totalProduzido / totalMetaAcumulada) * 100 : 0;
            this.atualizarCard('kpi-prod-real', 'kpi-prod-meta', 'bar-prod', 'pct-prod', totalProduzido, totalMetaAcumulada, pctProd);

            // CARD 2: DIAS PRODUTIVOS
            const numDiasUteisCalendar = this.calcUteis(inicio, fim);
            const numDiasUteisEfetivos = Math.max(0, numDiasUteisCalendar - Math.round(totalDiasAbonados * 10) / 10);
            const numDiasTrab = diasProdutivos.size;
            const pctDias = numDiasUteisEfetivos > 0 ? (numDiasTrab / numDiasUteisEfetivos) * 100 : 0;
            this.atualizarCard('kpi-dias-trab', 'kpi-dias-uteis', 'bar-dias', 'pct-dias', numDiasTrab, numDiasUteisEfetivos, pctDias);

            // CARD 3: PRODUÇÃO DIÁRIA
            const refMetaKey = `${dtFim.getFullYear()}-${dtFim.getMonth()+1}`;
            const metaMensalRef = (mapMetas[refMetaKey] ? mapMetas[refMetaKey].prod : defaultMetaProd);
            const mediaReal = numDiasTrab > 0 ? Math.round(totalProduzido / numDiasTrab) : 0;
            const pctDia = metaMensalRef > 0 ? (mediaReal / metaMensalRef) * 100 : 0;
            this.atualizarCard('kpi-dia-media', 'kpi-dia-meta', 'bar-dia', 'pct-dia', mediaReal, metaMensalRef, pctDia);

            // CARD 4: ASSERTIVIDADE (Atualizado com Erros Auditados)
            let totalOk = 0, totalNok = 0, errosAuditados = 0;
            
            dAssert.forEach(i => { 
                totalOk += (i.qtd_ok || 0); 
                totalNok += (i.qtd_nok || 0);
                
                // Só conta como erro auditado se tiver nome da auditora
                if (i.auditora_nome && i.auditora_nome.trim() !== '') {
                    errosAuditados += (i.qtd_nok || 0);
                }
            });
            
            const totalDocs = totalOk + totalNok;
            const assertReal = totalDocs > 0 ? (totalOk / totalDocs) * 100 : 100;
            const metaAssertRef = (mapMetas[refMetaKey] ? mapMetas[refMetaKey].assert : 98);
            const pctAssertKpi = metaAssertRef > 0 ? (assertReal / metaAssertRef) * 100 : 100;
            
            // Constrói HTML para mostrar: "98% (3 Erros)"
            const htmlMetaAssert = `${metaAssertRef}% <span class="text-rose-500 text-[10px] ml-1 font-bold whitespace-nowrap" title="Erros validados por auditoria">(${errosAuditados} Erros)</span>`;

            this.atualizarCard('kpi-assert-real', 'kpi-assert-meta', 'bar-assert', 'pct-assert', 
                assertReal.toFixed(2) + '%', 
                htmlMetaAssert, // Passa HTML aqui
                pctAssertKpi
            );

            // --- RENDERIZAÇÃO TABELA ---
            if(tbody) {
                tbody.innerHTML = '';
                if (document.getElementById('total-registros-footer')) document.getElementById('total-registros-footer').innerText = listaGrid.length;

                if (listaGrid.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="11" class="text-center py-8 text-slate-400 text-xs">Sem registros.</td></tr>';
                } else {
                    listaGrid.sort((a,b) => b.data.localeCompare(a.data)).forEach(i => {
                        const p = i.meta > 0 ? (i.qtd / i.meta) * 100 : 100;
                        const dBr = i.data.split('-').reverse().join('/');
                        const assertDia = (i.fator * 100); 
                        
                        let obsHtml = '';
                        if (i.j_g) obsHtml += `<div class="text-[10px] text-blue-600 font-bold mb-1 truncate" title="${i.j_g}"><i class="fas fa-user-tie mr-1"></i>${i.j_g}</div>`;
                        if (i.j_a) obsHtml += `<div class="text-[10px] text-slate-500 italic truncate" title="${i.j_a}"><i class="fas fa-comment-dots mr-1"></i>${i.j_a}</div>`;
                        
                        const metaStyle = (i.fator < 1.0) ? 'text-amber-600 font-black' : 'text-slate-400 font-bold';
                        const fatorStyle = (i.fator < 1.0) ? 'text-amber-600 font-bold bg-amber-50 rounded px-1' : 'text-slate-500';

                        tbody.innerHTML += `
                        <tr class="hover:bg-blue-50/50 border-b border-slate-200 text-xs cursor-pointer transition-colors group" onclick="MinhaArea.Geral.abrirModalObs('${i.data}', '${i.j_g.replace(/'/g, "\\'")}', '${i.j_a.replace(/'/g, "\\'")}')">
                            <td class="px-3 py-2 font-bold bg-slate-50/30 text-slate-600 group-hover:text-blue-600">${dBr}</td>
                            <td class="px-2 py-2 text-center"><span class="${fatorStyle}">${i.fator.toFixed(2)}</span></td>
                            <td class="px-2 py-2 text-center text-slate-400">${i.f}</td>
                            <td class="px-2 py-2 text-center text-slate-400">${i.gt}</td>
                            <td class="px-2 py-2 text-center text-slate-400">${i.gp}</td>
                            <td class="px-2 py-2 text-center font-black text-blue-700">${i.qtd}</td>
                            <td class="px-2 py-2 text-center ${metaStyle}">${i.meta}</td>
                            <td class="px-2 py-2 text-center font-bold ${p >= 100 ? 'text-emerald-600' : 'text-rose-600'}">${p.toFixed(0)}%</td>
                            <td class="px-2 py-2 text-center text-slate-400 font-bold">${i.metaAssert}%</td>
                            <td class="px-2 py-2 text-center font-bold ${assertDia >= i.metaAssert ? 'text-emerald-600' : 'text-rose-600'}">${assertDia.toFixed(2)}%</td>
                            <td class="px-3 py-2 min-w-[200px] border-l border-slate-100 relative group-hover:bg-blue-50/30">
                                ${obsHtml || '<span class="text-slate-300 opacity-50 text-[10px]">Clique para adicionar...</span>'}
                                <i class="fas fa-pen absolute right-2 top-1/2 -translate-y-1/2 text-blue-300 opacity-0 group-hover:opacity-100 transition"></i>
                            </td>
                        </tr>`;
                    });
                }
            }

        } catch (e) { 
            console.error(e);
            if(tbody) tbody.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-rose-500 text-xs">Erro: ${e.message}</td></tr>`;
        }
    },

    atualizarCard: function(idVal, idMeta, idBar, idPct, val, meta, pct) {
        const elVal = document.getElementById(idVal);
        const elMeta = document.getElementById(idMeta);
        const elBar = document.getElementById(idBar);
        const elPct = document.getElementById(idPct);
        const safePct = isNaN(pct) ? 0 : pct;

        // ATUALIZAÇÃO: Uso de innerHTML para permitir ícones/cores
        if(elVal) elVal.innerHTML = (typeof val === 'number') ? val.toLocaleString('pt-BR') : val;
        if(elMeta) elMeta.innerHTML = (typeof meta === 'number') ? meta.toLocaleString('pt-BR') : meta;
        
        if(elBar) elBar.style.width = Math.min(Math.max(safePct, 0), 100) + '%';
        if(elPct) {
            elPct.innerText = safePct.toFixed(1) + '%';
            elPct.className = 'font-black ' + (safePct >= 100 ? 'text-emerald-600' : (safePct >= 80 ? 'text-blue-600' : 'text-rose-600'));
        }
    },

    abrirModalObs: function(data, gestao, assistente) {
        const uidAlvo = MinhaArea.getUsuarioAlvo();
        if (!uidAlvo) return; 

        this.obsEditando = { data, uid: parseInt(uidAlvo) };
        const elData = document.getElementById('obs-data-ref');
        const elView = document.getElementById('obs-gestao-view');
        const elText = document.getElementById('obs-assistente-text');
        const modal = document.getElementById('modal-obs-assistente');
        
        if (!modal || !elText) {
            alert("ERRO VISUAL: Modal não encontrado.");
            return;
        }

        if(elData) elData.innerText = data.split('-').reverse().join('/');
        
        if(elView) {
            if (gestao && gestao !== 'undefined' && gestao.trim() !== '') {
                elView.innerHTML = `<span class="text-blue-700 font-semibold">${gestao}</span>`;
            } else {
                elView.innerHTML = '<span class="text-slate-400 font-normal">Nenhuma observação da gestão.</span>';
            }
        }

        if(elText) elText.value = (assistente && assistente !== 'undefined') ? assistente : '';
        
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
    },

    fecharModalObs: function() { 
        const modal = document.getElementById('modal-obs-assistente');
        if(modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    },

    salvarObsAssistente: async function() {
        const txt = document.getElementById('obs-assistente-text').value.trim();
        const { data, uid } = this.obsEditando;
        
        const btnSalvar = document.getElementById('btn-salvar-obs');
        if(btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
            const { data: reg, error: errSelect } = await Sistema.supabase.from('producao').select('id').eq('usuario_id', uid).eq('data_referencia', data).maybeSingle();
            if (errSelect) throw errSelect;

            if (reg) {
                const { error } = await Sistema.supabase.from('producao').update({ observacao_assistente: txt }).eq('id', reg.id);
                if(error) throw error;
            } else {
                const { error } = await Sistema.supabase.from('producao').insert({ usuario_id: uid, data_referencia: data, quantidade: 0, fator: 1.0, observacao_assistente: txt });
                if(error) throw error;
            }
            
            this.fecharModalObs();
            this.carregar();
            
            if(btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar';

        } catch (e) { 
            console.error(e);
            alert("Erro ao salvar: " + e.message);
            if(btnSalvar) btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar';
        }
    },

    calcUteis: function(i, f) {
        try {
            let c = 0, cur = new Date(i+'T12:00:00'), end = new Date(f+'T12:00:00');
            while(cur<=end) { if(cur.getDay()!==0 && cur.getDay()!==6) c++; cur.setDate(cur.getDate()+1); }
            return c;
        } catch(e) { return 0; }
    }
};