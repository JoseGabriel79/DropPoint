document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('containerHistoricoMotoboy');
  const motoStr = localStorage.getItem('motoboy');

  if (!container) return;

  if (!motoStr) {
    container.innerHTML = `<p>Faça login como motoboy para ver seu histórico.</p>`;
    return;
  }

  const motoboy = JSON.parse(motoStr);
  const motoboyId = motoboy?.id;
  if (!motoboyId) {
    container.innerHTML = `<p>Não foi possível identificar o motoboy logado.</p>`;
    return;
  }

  renderLoading();
  loadHistorico(motoboyId).catch(err => {
    console.error('Falha ao carregar histórico do motoboy:', err);
    container.innerHTML = `<p>Erro ao carregar histórico: ${err?.message || 'tente novamente mais tarde'}</p>`;
  });

  function renderLoading() {
    container.innerHTML = `<p>Carregando histórico...</p>`;
  }

  async function loadHistorico(mid) {
    const url = new URL('http://localhost:8080/pedidos');
    url.searchParams.set('motoboy_id', mid);
    url.searchParams.set('status', 'entregue');
    const resp = await fetch(url.href);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const pedidos = await resp.json();
    renderHistorico(pedidos);
  }

  function renderHistorico(pedidos) {
    if (!Array.isArray(pedidos) || !pedidos.length) {
      container.innerHTML = `<p>Você ainda não possui entregas concluídas.</p>`;
      return;
    }

    const html = pedidos.map(p => `
      <div class="pedido-item" data-id="${p.id}">
        <div class="pedido-header">
          <h3 class="pedido-titulo">${escapeHtml(p.codigo)}</h3>
          <span class="pedido-status status-entregue">Entregue</span>
        </div>
        <div class="pedido-info">
          <p class="pedido-descricao">${escapeHtml(p.tipo_objeto)} — ${escapeHtml(p.empresa)}</p>
          ${p.endereco ? `<p class="pedido-endereco">${escapeHtml(p.endereco)}</p>` : ''}
          ${p.observacoes ? `<p class="pedido-descricao">${escapeHtml(p.observacoes)}</p>` : ''}
          <p class="pedido-data">Criado: ${formatDate(p.data_criacao)} | Atualizado: ${formatDate(p.data_atualizacao)}</p>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate(d) {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      return dt.toLocaleString('pt-BR');
    } catch {
      return String(d);
    }
  }
});