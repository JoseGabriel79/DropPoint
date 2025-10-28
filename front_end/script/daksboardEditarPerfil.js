 // Seleciona elementos do modal
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalInput = document.getElementById('modal-input');
  const saveBtn = document.getElementById('save-btn');
  const closeBtn = document.querySelector('.close');

  // Seleciona os botões de editar específicos
  const btnEditarEndereco = document.querySelector('.endereco .btn-editar');
  const btnEditarTelefone = document.querySelector('li:not(.endereco):not(.entregaMovel) .btn-editar');

  // Função para abrir o modal com o título e placeholder corretos
  function openModal(tipo, placeholder) {
    modal.style.display = 'flex';
    modalTitle.textContent = `Editar ${tipo}`;
    modalInput.placeholder = placeholder;
    modalInput.value = '';
    modalInput.focus();
  }

  // Função para fechar o modal
  function closeModal() {
    modal.style.display = 'none';
  }

  // Eventos de clique nos botões
  btnEditarEndereco.addEventListener('click', () => openModal('Endereço', 'Digite o novo endereço'));
  btnEditarTelefone.addEventListener('click', () => openModal('Telefone', 'Digite o novo telefone'));

  // Botão fechar (X)
  closeBtn.addEventListener('click', closeModal);

  // Fecha modal ao clicar fora da caixa
  window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Botão salvar
  saveBtn.addEventListener('click', () => {
    alert(`${modalTitle.textContent} salvo com sucesso!`);
    closeModal();
  });