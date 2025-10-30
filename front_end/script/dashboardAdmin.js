document.addEventListener('DOMContentLoaded', function() {
    // Verificar se admin está logado
    const adminLogado = JSON.parse(localStorage.getItem('adminLogado'));
    if (!adminLogado) {
        window.location.href = 'loginAdmin.html';
        return;
    }

    // Elementos DOM
    const adminNome = document.getElementById('adminNome');
    const btnLogout = document.getElementById('btnLogout');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const btnAtualizarPendentes = document.getElementById('btnAtualizarPendentes');
    const btnAtualizarTodos = document.getElementById('btnAtualizarTodos');
    const listaPendentes = document.getElementById('listaPendentes');
    const listaTodos = document.getElementById('listaTodos');
    const modal = document.getElementById('modalConfirmacao');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalMensagem = document.getElementById('modalMensagem');
    const btnConfirmar = document.getElementById('btnConfirmar');
    const btnCancelar = document.getElementById('btnCancelar');
    const mensagemDiv = document.getElementById('mensagem');
    
    // Elementos do modal de documentos
    const modalDocumentos = document.getElementById('modalDocumentos');
    const modalDocumentosTitulo = document.getElementById('modalDocumentosTitulo');
    const btnFecharDocumentos = document.getElementById('btnFecharDocumentos');
    const imagemEndereco = document.getElementById('imagemEndereco');
    const imagemMoto = document.getElementById('imagemMoto');
    const imagemFotoDoc = document.getElementById('imagemFotoDoc');

    // Configurar nome do admin
    adminNome.textContent = adminLogado.login || adminLogado.email;

    // Event Listeners
    btnLogout.addEventListener('click', logout);
    btnAtualizarPendentes.addEventListener('click', () => carregarMotoboys('pendentes'));
    btnAtualizarTodos.addEventListener('click', () => carregarMotoboys('todos'));
    btnCancelar.addEventListener('click', fecharModal);
    btnFecharDocumentos.addEventListener('click', fecharModalDocumentos);

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            ativarTab(tabId);
        });
    });

    // Carregar dados iniciais
    carregarMotoboys('pendentes');

    function ativarTab(tabId) {
        // Remover classe active de todos os botões e conteúdos
        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        // Adicionar classe active ao botão e conteúdo selecionados
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
        document.getElementById(`tab-${tabId}`).classList.add('active');

        // Carregar dados da tab ativa
        carregarMotoboys(tabId);
    }

    async function carregarMotoboys(tipo) {
        const lista = tipo === 'pendentes' ? listaPendentes : listaTodos;
        const endpoint = tipo === 'pendentes' ? '/admin/motoboys/pendentes' : '/admin/motoboys';

        lista.innerHTML = '<div class="loading">Carregando...</div>';

        try {
            const response = await fetch(`http://localhost:8080${endpoint}`);
            const data = await response.json();

            if (response.ok) {
                renderizarMotoboys(data.motoboys, lista, tipo);
            } else {
                lista.innerHTML = `<div class="empty-state"><h3>Erro</h3><p>${data.erro}</p></div>`;
            }
        } catch (error) {
            console.error('Erro ao carregar motoboys:', error);
            lista.innerHTML = '<div class="empty-state"><h3>Erro de conexão</h3><p>Não foi possível carregar os dados</p></div>';
        }
    }

    function renderizarMotoboys(motoboys, container, tipo) {
        if (!motoboys || motoboys.length === 0) {
            const mensagem = tipo === 'pendentes' 
                ? 'Nenhum motoboy pendente de aprovação' 
                : 'Nenhum motoboy cadastrado';
            container.innerHTML = `<div class="empty-state"><h3>Lista vazia</h3><p>${mensagem}</p></div>`;
            return;
        }

        const html = motoboys.map(motoboy => criarCardMotoboy(motoboy)).join('');
        container.innerHTML = html;

        // Adicionar event listeners aos botões
        container.querySelectorAll('.btn-aprovar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const motoboyId = e.target.dataset.id;
                const motoboyNome = e.target.dataset.nome;
                confirmarAcao('aprovar', motoboyId, motoboyNome);
            });
        });

        container.querySelectorAll('.btn-rejeitar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const motoboyId = e.target.dataset.id;
                const motoboyNome = e.target.dataset.nome;
                confirmarAcao('rejeitar', motoboyId, motoboyNome);
            });
        });

        // Adicionar event listeners aos botões de visualizar documentos
        container.querySelectorAll('.btn-ver-documentos').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('🖱️ Botão Ver Documentos clicado!');
                const motoboyId = e.target.dataset.id;
                const motoboyNome = e.target.dataset.nome;
                const endereco = e.target.dataset.endereco;
                const moto = e.target.dataset.moto;
                const fotoDoc = e.target.dataset.fotodoc;
                console.log('📋 Dados do botão:', { motoboyId, motoboyNome, endereco, moto, fotoDoc });
                mostrarDocumentos(motoboyNome, endereco, moto, fotoDoc);
            });
        });
    }

    function criarCardMotoboy(motoboy) {
        const statusClass = motoboy.aprovado ? 'status-aprovado' : 'status-pendente';
        const statusText = motoboy.aprovado ? 'Aprovado' : 'Pendente';
        const dataFormatada = new Date(motoboy.data_cadastro).toLocaleDateString('pt-BR');

        const botoes = !motoboy.aprovado ? `
            <button class="btn-ver-documentos" 
                    data-id="${motoboy.id}" 
                    data-nome="${motoboy.login}"
                    data-endereco="${motoboy.comprovante_endereco || ''}"
                    data-moto="${motoboy.documento_moto || ''}"
                    data-fotodoc="${motoboy.foto_documento || ''}">
                📄 Ver Documentos
            </button>
            <button class="btn-aprovar" data-id="${motoboy.id}" data-nome="${motoboy.login}">
                ✓ Aprovar
            </button>
            <button class="btn-rejeitar" data-id="${motoboy.id}" data-nome="${motoboy.login}">
                ✗ Rejeitar
            </button>
        ` : `
            <button class="btn-ver-documentos" 
                    data-id="${motoboy.id}" 
                    data-nome="${motoboy.login}"
                    data-endereco="${motoboy.comprovante_endereco || ''}"
                    data-moto="${motoboy.documento_moto || ''}"
                    data-fotodoc="${motoboy.foto_documento || ''}">
                📄 Ver Documentos
            </button>
            <span class="status-badge status-aprovado">Já aprovado</span>
        `;

        return `
            <div class="motoboy-card">
                <div class="motoboy-header">
                    <div class="motoboy-info">
                        <h3>${motoboy.login}</h3>
                        <p>ID: ${motoboy.id}</p>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                
                <div class="motoboy-details">
                    <div class="detail-item">
                        <strong>Email:</strong> ${motoboy.email}
                    </div>
                    <div class="detail-item">
                        <strong>Telefone:</strong> ${motoboy.telefone || 'Não informado'}
                    </div>
                    <div class="detail-item">
                        <strong>Status:</strong> ${motoboy.status}
                    </div>
                    <div class="detail-item">
                        <strong>Data Cadastro:</strong> ${dataFormatada}
                    </div>
                    <div class="detail-item">
                        <strong>Comprovante:</strong> ${motoboy.comprovante_endereco ? 'Enviado' : 'Não enviado'}
                    </div>
                    <div class="detail-item">
                        <strong>Doc. Moto:</strong> ${motoboy.documento_moto ? 'Enviado' : 'Não enviado'}
                    </div>
                    <div class="detail-item">
                        <strong>Foto Doc.:</strong> ${motoboy.foto_documento ? 'Enviado' : 'Não enviado'}
                    </div>
                </div>
                
                <div class="motoboy-actions">
                    ${botoes}
                </div>
            </div>
        `;
    }

    function confirmarAcao(acao, motoboyId, motoboyNome) {
        const titulo = acao === 'aprovar' ? 'Aprovar Motoboy' : 'Rejeitar Motoboy';
        const mensagem = `Tem certeza que deseja ${acao} o motoboy "${motoboyNome}"?`;

        modalTitulo.textContent = titulo;
        modalMensagem.textContent = mensagem;
        modal.style.display = 'block';

        btnConfirmar.onclick = () => {
            fecharModal();
            processarAprovacao(motoboyId, acao === 'aprovar');
        };
    }

    async function processarAprovacao(motoboyId, aprovado) {
        try {
            mostrarMensagem('Processando...', 'info');

            const response = await fetch(`http://localhost:8080/admin/motoboys/${motoboyId}/aprovacao`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    aprovado: aprovado
                })
            });

            const data = await response.json();

            if (response.ok) {
                const acao = aprovado ? 'aprovado' : 'rejeitado';
                mostrarMensagem(`Motoboy ${acao} com sucesso!`, 'sucesso');
                
                // Recarregar as listas
                setTimeout(() => {
                    carregarMotoboys('pendentes');
                    carregarMotoboys('todos');
                }, 1000);
            } else {
                mostrarMensagem(data.erro || 'Erro ao processar aprovação', 'erro');
            }
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem('Erro de conexão com o servidor', 'erro');
        }
    }

    function fecharModal() {
        modal.style.display = 'none';
    }

    function mostrarDocumentos(motoboyNome, endereco, moto, fotoDoc) {
        console.log('🔍 Abrindo modal para:', motoboyNome);
        console.log('📁 Arquivos:', { endereco, moto, fotoDoc });
        
        modalDocumentosTitulo.textContent = `Documentos de ${motoboyNome}`;
        
        // Configurar as imagens
        if (endereco) {
            console.log('📄 Configurando imagem de endereço:', endereco);
            imagemEndereco.src = `http://localhost:8080/images/${endereco}`;
            imagemEndereco.style.display = 'block';
        } else {
            console.log('❌ Sem imagem de endereço');
            imagemEndereco.style.display = 'none';
        }
        
        if (moto) {
            console.log('🏍️ Configurando imagem da moto:', moto);
            imagemMoto.src = `http://localhost:8080/images/${moto}`;
            imagemMoto.style.display = 'block';
        } else {
            console.log('❌ Sem imagem da moto');
            imagemMoto.style.display = 'none';
        }
        
        if (fotoDoc) {
            console.log('🆔 Configurando foto do documento:', fotoDoc);
            imagemFotoDoc.src = `http://localhost:8080/images/${fotoDoc}`;
            imagemFotoDoc.style.display = 'block';
        } else {
            console.log('❌ Sem foto do documento');
            imagemFotoDoc.style.display = 'none';
        }
        
        console.log('🎭 Abrindo modal...');
        modalDocumentos.style.display = 'block';
        console.log('✅ Modal aberto!');
    }

    function fecharModalDocumentos() {
        modalDocumentos.style.display = 'none';
    }

    function logout() {
        localStorage.removeItem('adminLogado');
        window.location.href = 'loginAdmin.html';
    }

    function mostrarMensagem(texto, tipo) {
        mensagemDiv.textContent = texto;
        mensagemDiv.className = `mensagem ${tipo}`;
        mensagemDiv.style.display = 'block';
        
        setTimeout(() => {
            mensagemDiv.style.display = 'none';
        }, 3000);
    }

    // Fechar modal ao clicar fora dele
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            fecharModal();
        }
        if (e.target === modalDocumentos) {
            fecharModalDocumentos();
        }
    });
});