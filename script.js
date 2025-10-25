'use strict';

document.addEventListener('DOMContentLoaded', () => {

    // --- REFERÊNCIAS DO DOM (ATUALIZADAS) ---
    const containerTabela = document.getElementById('tabela-periodica-container');
    const infoContent = document.getElementById('info-content');
    const mesaContainer = document.getElementById('mesa-container');
    const zonaDeReacao = document.getElementById('zona-de-reacao'); // CORREÇÃO: ID novo do HTML
    const nomeMoleculaEl = document.getElementById('nome-molecula');
    const formulaMoleculaEl = document.getElementById('formula-molecula'); // NOVO: Referência para a fórmula
    
    // Botões de controle
    const btnLimpar = document.getElementById('btn-limpar');
    const btnSalvar = document.getElementById('btn-salvar');
    const btnCarregar = document.getElementById('btn-carregar');
    
    // Novas referências do Modal
    const btnExplicacao = document.getElementById('btn-explicacao');
    const modalExplicacao = document.getElementById('modal-explicacao');
    const modalFechar = document.getElementById('modal-fechar');
    const modalTitulo = document.getElementById('modal-titulo');
    const modalDescricao = document.getElementById('modal-descricao');

    // --- ESTADO DA APLICAÇÃO ---
    let todosOsElementos = [];
    let moleculasConhecidas = {};
    let atomosNaMesa = [];
    let ligacoesNaMesa = [];
    let proximoAtomoId = 0;
    
    let atomoAtivo = null;
    let offsetX = 0;
    let offsetY = 0;

    // --- FUNÇÕES DE LÓGICA QUÍMICA ---
    function calcularSlots(elemento) { if (elemento.numeroAtomico === 1) return 1; const tipoSanitizado = sanitizarStringParaClasseCSS(elemento.tipo); if (['gas-nobre', 'desconhecido'].includes(tipoSanitizado)) return 0; const valencia = elemento.eletronsDeValencia; if (valencia <= 4) return valencia; return 8 - valencia; }
    
    // --- FUNÇÕES UTILITÁRIAS ---
    function sanitizarStringParaClasseCSS(texto) { if (!texto) return 'desconhecido'; return texto.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/-+/g, '-'); }

    // --- INICIALIZAÇÃO ---
    async function carregarDadosIniciais() {
        try {
            const [elementosResponse, moleculasResponse] = await Promise.all([
                fetch('elementos.json'),
                fetch('moleculas.json') 
            ]);
            
            if (!elementosResponse.ok || !moleculasResponse.ok) {
                throw new Error("Falha ao carregar arquivos JSON.");
            }

            todosOsElementos = await elementosResponse.json();
            moleculasConhecidas = await moleculasResponse.json();
            
            criarTabelaPeriodica(todosOsElementos);
            configurarMesaDeTrabalho();
            configurarBotoes();
            configurarModal(); // NOVO: Configura os botões do modal
        } catch (error) {
            console.error("Falha ao carregar dados iniciais:", error);
            document.body.innerHTML = `<h1>Erro ao carregar os dados do jogo. Verifique o console. Lembre-se de usar um Live Server.</h1>`;
        }
    }

    // --- CRIAÇÃO DOS ELEMENTOS NA INTERFACE ---
    function criarTabelaPeriodica(elementos) { containerTabela.innerHTML = ''; elementos.forEach(elemento => { const divElemento = document.createElement('div'); const classeCSS = sanitizarStringParaClasseCSS(elemento.tipo); divElemento.className = `elemento ${classeCSS}`; divElemento.textContent = elemento.simbolo; divElemento.draggable = true; divElemento.addEventListener('dragstart', (e) => e.dataTransfer.setData("text/plain", elemento.numeroAtomico)); divElemento.addEventListener('click', () => atualizarCaixaInfo(elemento)); containerTabela.appendChild(divElemento); }); }

    function criarAtomoNaMesa(elemento, x, y, id = null, slots = null) {
        const atomoDiv = document.createElement('div');
        const atomoId = id !== null ? id : proximoAtomoId++;
        atomoDiv.dataset.id = atomoId;
        const classeCSS = sanitizarStringParaClasseCSS(elemento.tipo);
        atomoDiv.className = `atomo-na-mesa ${classeCSS}`;
        atomoDiv.textContent = elemento.simbolo;
        const rectMesa = mesaContainer.getBoundingClientRect();
        const posX = x - rectMesa.left - 27.5;
        const posY = y - rectMesa.top - 27.5;
        atomoDiv.style.left = `${posX}px`;
        atomoDiv.style.top = `${posY}px`;
        atomoDiv.addEventListener('mousedown', (e) => { atomoAtivo = e.target; const rectAtomo = atomoAtivo.getBoundingClientRect(); offsetX = e.clientX - rectAtomo.left; offsetY = e.clientY - rectAtomo.top; });
        const slotsIniciais = slots !== null ? slots : calcularSlots(elemento);
        atomosNaMesa.push({ id: atomoId, elemento: elemento, div: atomoDiv, slotsAbertos: slotsIniciais });
        mesaContainer.appendChild(atomoDiv);
        identificarMolecula();
        return atomoDiv;
    }

    // --- LÓGICA DE INTERAÇÃO (DRAG AND DROP E LIGAÇÕES) ---
    function configurarMesaDeTrabalho() {
        // CORREÇÃO: Usando a referência correta 'zonaDeReacao'
        zonaDeReacao.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); });
        zonaDeReacao.addEventListener('dragleave', (e) => e.currentTarget.classList.remove('drag-over'));
        zonaDeReacao.addEventListener('drop', (e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            const numeroAtomico = e.dataTransfer.getData("text/plain");
            const elemento = todosOsElementos.find(el => el.numeroAtomico == numeroAtomico);
            if (elemento) criarAtomoNaMesa(elemento, e.clientX, e.clientY);
        });
        
        // Os eventos de movimento continuam ligados ao 'mesaContainer'
        mesaContainer.addEventListener('mousemove', (e) => { if (atomoAtivo) { e.preventDefault(); const rectMesa = mesaContainer.getBoundingClientRect(); atomoAtivo.style.left = `${e.clientX - rectMesa.left - offsetX}px`; atomoAtivo.style.top = `${e.clientY - rectMesa.top - offsetY}px`; } });
        mesaContainer.addEventListener('mouseup', () => { if (atomoAtivo) { verificarLigacoes(atomoAtivo); atomoAtivo = null; } });
        mesaContainer.addEventListener('mouseleave', () => { atomoAtivo = null; });
    }

    function verificarLigacoes(divMovido) {
        // ... (Esta função não precisa de alterações)
        const idMovido = parseInt(divMovido.dataset.id);
        const atomoMovido = atomosNaMesa.find(a => a.id === idMovido);
        atomoMovido.posX = parseInt(divMovido.style.left);
        atomoMovido.posY = parseInt(divMovido.style.top);
        for (const outroAtomo of atomosNaMesa) {
            if (atomoMovido.id === outroAtomo.id) continue;
            const dx = atomoMovido.posX - parseInt(outroAtomo.div.style.left);
            const dy = atomoMovido.posY - parseInt(outroAtomo.div.style.top);
            const distancia = Math.sqrt(dx * dx + dy * dy);
            if (distancia < 80 && atomoMovido.slotsAbertos > 0 && outroAtomo.slotsAbertos > 0) {
                const ligacaoExistente = ligacoesNaMesa.find(l => (l.a === atomoMovido.id && l.b === outroAtomo.id) || (l.a === outroAtomo.id && l.b === atomoMovido.id));
                if (ligacaoExistente && ligacaoExistente.tipo < 3) { ligacaoExistente.tipo++; } else if (!ligacaoExistente) { ligacoesNaMesa.push({ a: atomoMovido.id, b: outroAtomo.id, tipo: 1 }); } else { continue; }
                atomoMovido.slotsAbertos--;
                outroAtomo.slotsAbertos--;
                desenharTodasAsLigacoes();
                identificarMolecula();
                break;
            }
        }
    }

    function desenharTodasAsLigacoes() {
        // ... (Esta função não precisa de alterações)
        mesaContainer.querySelectorAll('.ligacao, .ligacao-dupla, .ligacao-tripla').forEach(l => l.remove());
        for (const ligacao of ligacoesNaMesa) {
            const atomoA = atomosNaMesa.find(a => a.id === ligacao.a);
            const atomoB = atomosNaMesa.find(a => a.id === ligacao.b);
            if (!atomoA || !atomoB) continue;
            const div1 = atomoA.div;
            const div2 = atomoB.div;
            const rect1 = div1.getBoundingClientRect();
            const rect2 = div2.getBoundingClientRect();
            const rectMesa = mesaContainer.getBoundingClientRect();
            const x1 = rect1.left - rectMesa.left + rect1.width / 2;
            const y1 = rect1.top - rectMesa.top + rect1.height / 2;
            const x2 = rect2.left - rectMesa.left + rect2.width / 2;
            const y2 = rect2.top - rectMesa.top + rect2.height / 2;
            const distancia = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angulo = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            const containerLigacao = document.createElement('div');
            let classe = 'ligacao';
            if (ligacao.tipo === 2) classe = 'ligacao-dupla';
            if (ligacao.tipo === 3) classe = 'ligacao-tripla';
            containerLigacao.className = classe;
            containerLigacao.style.width = `${distancia}px`;
            containerLigacao.style.top = `${y1}px`;
            containerLigacao.style.left = `${x1}px`;
            containerLigacao.style.transform = `rotate(${angulo}deg)`;
            if (ligacao.tipo > 1) { containerLigacao.innerHTML = `<div></div><div></div>`; if(ligacao.tipo === 3) containerLigacao.innerHTML += `<div></div>`; }
            mesaContainer.appendChild(containerLigacao);
        }
    }
    
    // --- FUNÇÕES DE CONTROLE (BOTÕES, INFO, ETC) ---
    function configurarBotoes() {
        btnLimpar.addEventListener('click', () => { 
            mesaContainer.innerHTML = ''; 
            atomosNaMesa = []; 
            ligacoesNaMesa = []; 
            proximoAtomoId = 0; 
            identificarMolecula(); 
        });
        btnSalvar.addEventListener('click', () => { const estado = { atomos: atomosNaMesa.map(a => ({ id: a.id, numeroAtomico: a.elemento.numeroAtomico, slotsAbertos: a.slotsAbertos, x: parseInt(a.div.style.left), y: parseInt(a.div.style.top) })), ligacoes: ligacoesNaMesa, proximoId: proximoAtomoId }; localStorage.setItem('salvamentoQuimica', JSON.stringify(estado)); alert('Criação salva!'); });
        btnCarregar.addEventListener('click', () => { const estadoSalvo = localStorage.getItem('salvamentoQuimica'); if (estadoSalvo) { btnLimpar.click(); const estado = JSON.parse(estadoSalvo); proximoAtomoId = estado.proximoId; ligacoesNaMesa = estado.ligacoes; const rectMesa = mesaContainer.getBoundingClientRect(); estado.atomos.forEach(atomoSalvo => { const elemento = todosOsElementos.find(e => e.numeroAtomico === atomoSalvo.numeroAtomico); if(elemento) { criarAtomoNaMesa(elemento, atomoSalvo.x + rectMesa.left + 27.5, atomoSalvo.y + rectMesa.top + 27.5, atomoSalvo.id, atomoSalvo.slotsAbertos); } }); desenharTodasAsLigacoes(); identificarMolecula(); } else { alert('Nenhuma criação salva encontrada.'); } });
    }

    // NOVO: Função para controlar o modal de explicação
    function configurarModal() {
        btnExplicacao.addEventListener('click', () => {
            modalExplicacao.classList.remove('modal-oculto');
        });
        
        modalFechar.addEventListener('click', () => {
            modalExplicacao.classList.add('modal-oculto');
        });
        
        // Fecha o modal se clicar fora do conteúdo
        modalExplicacao.addEventListener('click', (e) => {
            if (e.target === modalExplicacao) {
                modalExplicacao.classList.add('modal-oculto');
            }
        });
    }

    function atualizarCaixaInfo(elemento) { infoContent.innerHTML = `<h3>${elemento.nome} (${elemento.simbolo})</h3><ul><li><strong>Número Atômico:</strong> ${elemento.numeroAtomico}</li><li><strong>Massa Atômica:</strong> ${elemento.massaAtomica} u</li><li><strong>Tipo:</strong> ${elemento.tipo || 'Desconhecido'}</li></ul><hr><ul><li><strong>Prótons:</strong> ${elemento.protons}</li><li><strong>Elétrons:</strong> ${elemento.eletrons}</li><li><strong>Nêutrons:</strong> ${elemento.neutrons}</li><li><strong>Valência:</strong> ${elemento.eletronsDeValencia || 'N/A'}</li></ul>`; }

    // =================================================================
    // FUNÇÃO DE IDENTIFICAÇÃO ATUALIZADA
    // =================================================================
    function identificarMolecula() {
        if (atomosNaMesa.length === 0) {
            nomeMoleculaEl.textContent = 'Laboratório Químico';
            formulaMoleculaEl.textContent = 'Arraste os elementos para começar';
            modalTitulo.textContent = 'Informação do Composto';
            modalDescricao.textContent = 'Arraste elementos para a mesa para formar um composto e ver sua descrição aqui.';
            return;
        }
        
        const contagem = {};
        atomosNaMesa.forEach(atomo => {
            const simbolo = atomo.elemento.simbolo;
            contagem[simbolo] = (contagem[simbolo] || 0) + 1;
        });
        
        const formula = Object.keys(contagem).sort().map(simbolo => {
            return simbolo + (contagem[simbolo] > 1 ? contagem[simbolo] : '');
        }).join('');

        // Atualiza a interface com base na nova estrutura do moleculas.json
        if (moleculasConhecidas[formula]) {
            const moleculaInfo = moleculasConhecidas[formula];
            nomeMoleculaEl.textContent = moleculaInfo.nome;
            formulaMoleculaEl.textContent = formula;
            
            // Atualiza o conteúdo do modal
            modalTitulo.textContent = moleculaInfo.nome;
            modalDescricao.textContent = moleculaInfo.descricao;
        } else {
            nomeMoleculaEl.textContent = "Composto Desconhecido";
            formulaMoleculaEl.textContent = formula;
            
            // Reseta o conteúdo do modal
            modalTitulo.textContent = "Composto Desconhecido";
            modalDescricao.textContent = "Nenhuma informação encontrada em nosso banco de dados para esta fórmula.";
        }
    }

    // --- INICIA A APLICAÇÃO ---
    carregarDadosIniciais();
});