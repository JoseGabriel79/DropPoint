document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('containerPedidosMotoboy');
  const disponiveisContainer = document.getElementById('containerPedidosDisponiveis');
  const toggle = document.getElementById('entregaMovel');
  const motoStr = localStorage.getItem('motoboy');

  if (!container) return;

  if (!motoStr) {
    container.innerHTML = `
      <div class="pedido-item">
        <div class="pedido-header">
          <h3 class="pedido-titulo">Você não está logado</h3>
          <span class="pedido-status status-pendente">Acesso necessário</span>
        </div>
        <div class="pedido-info">
          <p class="pedido-descricao">Faça login para ver seus pedidos atribuídos.</p>
        </div>
        <div class="btns-pedido">
          <button class="btn-confirmar" type="button" onclick="window.location.href='./loginMotoboy.html'">Ir para Login</button>
        </div>
      </div>
    `;
    return;
  }

  const motoboy = JSON.parse(motoStr);
  const motoboyId = motoboy?.id;
  if (!motoboyId) {
    container.innerHTML = `<p>Não foi possível identificar o motoboy logado.</p>`;
    return;
  }

  // Modal de confirmação e toast
  const modal = document.getElementById('modal-aceitar');
  const modalConfirm = document.getElementById('modal-aceitar-confirm');
  const modalCancel = document.getElementById('modal-aceitar-cancel');
  const modalBackdrop = document.querySelector('#modal-aceitar .modal-backdrop');
  const toast = document.getElementById('toast');
  let pendingAcceptId = null;

  function showModalAccept(id) {
    pendingAcceptId = id;
    if (modal) modal.classList.remove('hidden');
  }
  function hideModalAccept() {
    pendingAcceptId = null;
    if (modal) modal.classList.add('hidden');
  }
  function showToast(message, type = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden', 'success', 'error');
    toast.classList.add(type === 'error' ? 'error' : 'success', 'show');
    setTimeout(() => { toast.classList.remove('show'); }, 2000);
  }

  if (modalConfirm) {
    modalConfirm.addEventListener('click', async () => {
      const id = pendingAcceptId;
      if (!id) return;
      try {
        const resp = await fetch(`http://localhost:8080/pedidos/${id}/accept`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': String(motoboyId) }
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.erro || `HTTP ${resp.status}`);
        hideModalAccept();
        showToast('Pedido aceito com sucesso', 'success');
        await loadPedidos(motoboyId);
        await loadDisponiveis();
      } catch (err) {
        showToast(err?.message || 'Erro ao aceitar pedido', 'error');
      }
    });
  }
  if (modalCancel) modalCancel.addEventListener('click', hideModalAccept);
  if (modalBackdrop) modalBackdrop.addEventListener('click', hideModalAccept);

  // Disponibilidade local (UI apenas)
  if (toggle) {
    // Valor inicial: tenta do localStorage; se não houver, busca do backend
    if (typeof motoboy?.disponivel === 'boolean') {
      toggle.checked = !!motoboy.disponivel;
    } else {
      try {
        const url = new URL('http://localhost:8080/motoboys');
        url.searchParams.set('email', motoboy.email);
        fetch(url.href)
          .then(r => r.json())
          .then(list => {
            const me = Array.isArray(list) ? list.find(m => m.id === motoboyId) : null;
            if (me && typeof me.disponivel === 'boolean') toggle.checked = !!me.disponivel;
          })
          .catch(() => {});
      } catch (_) {}
    }

    // Controla visibilidade dos disponíveis conforme toggle
    if (disponiveisContainer) {
      disponiveisContainer.style.display = toggle.checked ? '' : 'none';
    }

    toggle.addEventListener('change', async () => {
      try {
        const resp = await fetch(`http://localhost:8080/motoboys/${motoboyId}/disponibilidade`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': String(motoboyId) },
          body: JSON.stringify({ disponivel: toggle.checked })
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.erro || `HTTP ${resp.status}`);
        // Atualiza localStorage
        const novo = { ...motoboy, disponivel: !!data?.usuario?.disponivel };
        localStorage.setItem('motoboy', JSON.stringify(novo));
        if (disponiveisContainer) {
          disponiveisContainer.style.display = toggle.checked ? '' : 'none';
          if (toggle.checked) {
            await loadDisponiveis();
          }
        }
      } catch (err) {
        alert('Erro ao atualizar disponibilidade: ' + (err?.message || 'falha desconhecida'));
        toggle.checked = !toggle.checked; // reverte
      }
    });
  }

  renderLoading();
  loadPedidos(motoboyId).catch(err => {
    console.error('Falha ao carregar pedidos do motoboy:', err);
    container.innerHTML = `<p>Erro ao carregar pedidos: ${err?.message || 'tente novamente mais tarde'}</p>`;
  });

  // Carregar pedidos disponíveis para aceitar
  if (disponiveisContainer) {
    renderDisponiveisLoading();
    loadDisponiveis().catch(err => {
      console.error('Falha ao carregar pedidos disponíveis:', err);
      disponiveisContainer.innerHTML = `<p>Erro ao carregar: ${err?.message || 'tente novamente mais tarde'}</p>`;
    });
  }

  function renderLoading() {
    container.innerHTML = `
      <div class="pedido-item">
        <div class="pedido-header">
          <h3 class="pedido-titulo">Carregando...</h3>
          <span class="pedido-status status-andamento">Aguarde</span>
        </div>
        <div class="pedido-info">
          <p class="pedido-descricao">Buscando seus pedidos atribuídos.</p>
        </div>
      </div>
    `;
  }

  async function loadPedidos(mid) {
    const url = new URL('http://localhost:8080/pedidos');
    url.searchParams.set('motoboy_id', mid);
    const resp = await fetch(url.href);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const pedidos = await resp.json();
    // Mostrar somente pedidos não entregues na lista ativa
    const ativos = Array.isArray(pedidos) ? pedidos.filter(p => p.status !== 'entregue') : [];
    renderPedidos(ativos);
  }

  async function loadDisponiveis() {
    const url = new URL('http://localhost:8080/pedidos');
    url.searchParams.set('disponiveis', 'true');
    const resp = await fetch(url.href);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const pedidos = await resp.json();
    renderDisponiveis(pedidos);
  }

  function renderPedidos(pedidos) {
    if (!Array.isArray(pedidos) || !pedidos.length) {
      container.innerHTML = `
        <div class="pedido-item">
          <div class="pedido-header">
            <h3 class="pedido-titulo">Nenhum pedido atribuído</h3>
            <span class="pedido-status status-pendente">Em espera</span>
          </div>
          <div class="pedido-info">
            <p class="pedido-descricao">Você não tem pedidos atribuídos no momento.</p>
          </div>
        </div>
      `;
      return;
    }

    const items = pedidos.map(p => {
      const statusClass = p.status === 'entregue' ? 'status-entregue' : (p.status === 'pendente' ? 'status-pendente' : 'status-andamento');
      const observacoes = p.observacoes ? `<p class="pedido-descricao">${escapeHtml(p.observacoes)}</p>` : '';
      const endereco = p.endereco ? `<p class="pedido-endereco">${escapeHtml(p.endereco)}</p>` : '';
      const canConclude = p.status !== 'entregue';
      return `
        <div class="pedido-item" data-id="${p.id}">
          <div class="pedido-header">
            <h3 class="pedido-titulo">${escapeHtml(p.codigo)}</h3>
            <span class="pedido-status ${statusClass}">${escapeHtml(p.status)}</span>
          </div>
          <div class="pedido-info">
            <p class="pedido-descricao">${escapeHtml(p.tipo_objeto)} — ${escapeHtml(p.empresa)}</p>
            ${endereco}
            ${observacoes}
          </div>
          <div class="btns-pedido">
            ${canConclude ? '<button class="btn-confirmar" type="button" data-action="concluir">Concluir Entrega</button>' : ''}
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = items;

    container.querySelectorAll('button[data-action="concluir"]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const item = ev.currentTarget.closest('.pedido-item');
        const id = item?.dataset?.id;
        if (!id) return;
        try {
          const resp = await fetch(`http://localhost:8080/pedidos/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'entregue' })
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          // Feedback visual
          showToast('Entrega concluída', 'success');
          await loadPedidos(motoboyId);
        } catch (err) {
          console.error(err);
          showToast('Erro ao concluir entrega', 'error');
        }
      });
    });
  }

  function renderDisponiveisLoading() {
    disponiveisContainer.innerHTML = `
      <div class="pedido-item">
        <div class="pedido-header">
          <h3 class="pedido-titulo">Carregando...</h3>
          <span class="pedido-status status-andamento">Aguarde</span>
        </div>
        <div class="pedido-info">
          <p class="pedido-descricao">Buscando pedidos disponíveis.</p>
        </div>
      </div>
    `;
  }

  function renderDisponiveis(pedidos) {
    if (!Array.isArray(pedidos) || !pedidos.length) {
      disponiveisContainer.innerHTML = `
        <div class="pedido-item">
          <div class="pedido-header">
            <h3 class="pedido-titulo">Nenhum pedido disponível</h3>
            <span class="pedido-status status-pendente">Em espera</span>
          </div>
          <div class="pedido-info">
            <p class="pedido-descricao">Não há pedidos para entrega móvel no momento.</p>
          </div>
        </div>
      `;
      return;
    }

    const items = pedidos.map(p => {
      const statusClass = 'status-pendente';
      const observacoes = p.observacoes ? `<p class="pedido-descricao">${escapeHtml(p.observacoes)}</p>` : '';
      const endereco = p.endereco ? `<p class="pedido-endereco">${escapeHtml(p.endereco)}</p>` : '';
      return `
        <div class="pedido-item" data-id="${p.id}">
          <div class="pedido-header">
            <h3 class="pedido-titulo">${escapeHtml(p.codigo)}</h3>
            <span class="pedido-status ${statusClass}">pendente</span>
          </div>
          <div class="pedido-info">
            <p class="pedido-descricao">${escapeHtml(p.tipo_objeto)} — ${escapeHtml(p.empresa)}</p>
            ${p.usuario_login ? `<p class="pedido-cliente">Cliente: ${escapeHtml(p.usuario_login)}</p>` : ''}
            ${endereco}
            ${observacoes}
          </div>
          <div class="btns-pedido">
            <button class="btn-confirmar" type="button" data-action="aceitar">Aceitar Pedido</button>
          </div>
        </div>
      `;
    }).join('');

    disponiveisContainer.innerHTML = items;

    disponiveisContainer.querySelectorAll('button[data-action="aceitar"]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const item = ev.currentTarget.closest('.pedido-item');
        const id = item?.dataset?.id;
        if (!id) return;
        // Impede aceitar quando indisponível
        if (toggle && !toggle.checked) {
          showToast('Ative sua disponibilidade para aceitar pedidos', 'error');
          return;
        }
        showModalAccept(id);
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});