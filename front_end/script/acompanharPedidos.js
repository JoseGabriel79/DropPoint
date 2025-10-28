document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('containerPedidos');
  const usuarioStr = localStorage.getItem('usuario');

  if (!container) return;

  if (!usuarioStr) {
    container.innerHTML = `
      <div class="pedido-item">
        <div class="pedido-header">
          <h3 class="pedido-titulo">Você não está logado</h3>
          <span class="pedido-status status-pendente">Acesso necessário</span>
        </div>
        <div class="pedido-info">
          <p class="pedido-descricao">Faça login para ver seus pedidos.</p>
        </div>
        <div class="btns-pedido">
          <button class="btn-confirmar" type="button" onclick="window.location.href='./loginUsuario.html'">Ir para Login</button>
        </div>
      </div>
    `;
    return;
  }

  const usuario = JSON.parse(usuarioStr);
  const usuarioId = usuario?.id;
  const usuarioTipo = usuario?.tipo;
  if (!usuarioId) {
    container.innerHTML = `<p>Não foi possível identificar o usuário logado.</p>`;
    return;
  }

  renderLoading();
  loadPedidos(usuarioId).catch(err => {
    console.error('Falha ao carregar pedidos:', err);
    container.innerHTML = `<p>Erro ao carregar pedidos: ${err?.message || 'tente novamente mais tarde'}</p>`;
  });

  function renderLoading() {
    container.innerHTML = `
      <div class="pedido-item">
        <div class="pedido-header">
          <h3 class="pedido-titulo">Carregando...</h3>
          <span class="pedido-status status-andamento">Aguarde</span>
        </div>
        <div class="pedido-info">
          <p class="pedido-descricao">Buscando seus pedidos no servidor.</p>
        </div>
      </div>
    `;
  }

  async function loadPedidos(uid) {
    const url = new URL('http://localhost:8080/pedidos');
    url.searchParams.set('usuario_id', uid);
    const resp = await fetch(url.href);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const pedidos = await resp.json();
    // Exibir apenas pedidos ativos (pendente/andamento); entregues vão para histórico
    const ativos = Array.isArray(pedidos) ? pedidos.filter(p => p.status !== 'entregue') : [];
    renderPedidos(ativos);
  }

  function renderPedidos(pedidos) {
    if (!Array.isArray(pedidos) || !pedidos.length) {
      container.innerHTML = `
        <div class="pedido-item">
          <div class="pedido-header">
            <h3 class="pedido-titulo">Nenhum pedido encontrado</h3>
            <span class="pedido-status status-pendente">Sem registros</span>
          </div>
          <div class="pedido-info">
            <p class="pedido-descricao">Você ainda não possui pedidos cadastrados.</p>
          </div>
          <div class="btns-pedido">
            <button class="btn-editar" type="button" onclick="window.location.href='./cadastrarPedido.html'">Cadastrar Pedido</button>
          </div>
        </div>
      `;
      return;
    }

    const items = pedidos.map(p => {
      const statusClass = p.status === 'pendente' ? 'status-pendente' : 'status-andamento';
      const observacoes = p.observacoes ? `<p class="pedido-descricao">${escapeHtml(p.observacoes)}</p>` : '';
      const endereco = p.endereco ? `<p class="pedido-endereco">${escapeHtml(p.endereco)}</p>` : '';
      const canAssign = usuarioTipo === 'gestor';
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
            <button class="btn-confirmar" type="button" data-action="concluir">Concluir Entrega</button>
            <button class="btn-editar" type="button" data-action="editar">Editar</button>
            ${canAssign ? '<button class="btn-atribuir" type="button" data-action="atribuir">Atribuir Motoboy</button>' : ''}
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
          await loadPedidos(usuarioId);
        } catch (err) {
          alert('Erro ao atualizar status do pedido.');
          console.error(err);
        }
      });
    });

    container.querySelectorAll('button[data-action="editar"]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const item = ev.currentTarget.closest('.pedido-item');
        const id = item?.dataset?.id;
        if (!id) return;
        // valores atuais
        const tituloEl = item.querySelector('.pedido-titulo');
        const descEl = item.querySelector('.pedido-descricao');
        const enderecoEl = item.querySelector('.pedido-endereco');
        const codigoAtual = tituloEl ? tituloEl.textContent : '';
        const descText = descEl ? descEl.textContent : '';
        const [tipoAtual, empresaAtual] = descText.includes(' — ') ? descText.split(' — ') : [descText, ''];
        const enderecoAtual = enderecoEl ? enderecoEl.textContent : '';
        const obsAtual = (() => {
          const allDesc = item.querySelectorAll('.pedido-descricao');
          if (allDesc.length > 1) return allDesc[1].textContent;
          return '';
        })();

        const codigo = prompt('Código do pedido:', codigoAtual || '') ?? codigoAtual;
        const tipo_objeto = prompt('Tipo do objeto:', tipoAtual || '') ?? tipoAtual;
        const empresa = prompt('Empresa:', empresaAtual || '') ?? empresaAtual;
        const endereco = prompt('Endereço:', enderecoAtual || '') ?? enderecoAtual;
        const observacoes = prompt('Observações:', obsAtual || '') ?? obsAtual;

        const payload = { codigo, tipo_objeto, empresa, endereco, observacoes };
        try {
          const resp = await fetch(`http://localhost:8080/pedidos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          await loadPedidos(usuarioId);
        } catch (err) {
          alert('Erro ao editar o pedido.');
          console.error(err);
        }
      });
    });

    // Atribuir motoboy por e-mail
    container.querySelectorAll('button[data-action="atribuir"]').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const item = ev.currentTarget.closest('.pedido-item');
        const id = item?.dataset?.id;
        if (!id) return;
        const email = prompt('E-mail do motoboy a atribuir:');
        if (!email) return;
        try {
          const url = new URL('http://localhost:8080/motoboys');
          url.searchParams.set('email', email.trim());
          const r = await fetch(url.href);
          const motoboys = await r.json();
          const moto = Array.isArray(motoboys) ? motoboys[0] : null;
          if (!moto) {
            alert('Motoboy não encontrado para o e-mail informado.');
            return;
          }
          const resp = await fetch(`http://localhost:8080/pedidos/${id}/assign`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': String(usuarioId) },
            body: JSON.stringify({ motoboy_id: moto.id })
          });
          if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data?.erro || `HTTP ${resp.status}`);
          }
          alert('Motoboy atribuído com sucesso!');
          await loadPedidos(usuarioId);
        } catch (err) {
          alert('Erro ao atribuir motoboy: ' + (err?.message || 'falha desconhecida'));
          console.error(err);
        }
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