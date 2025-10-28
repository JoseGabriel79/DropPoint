(() => {
  const form = document.getElementById('cadastroPedidoForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    if (!usuario || !usuario.id) {
      alert('Você precisa estar logado para cadastrar pedidos.');
      return window.location.href = './loginUsuario.html';
    }

    const codigoPedido = document.getElementById('codigoPedido')?.value?.trim();
    const tipoObjeto = document.getElementById('tipoObjeto')?.value;
    const empresa = document.getElementById('empresa')?.value;
    const endereco = document.getElementById('endereco')?.value?.trim();
    const observacoes = document.getElementById('observacoes')?.value?.trim();

    if (!codigoPedido || !tipoObjeto || !empresa || !endereco) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }

    const btn = document.getElementById('cadastrarBtn');
    const spinner = btn?.querySelector('.loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';
    btn?.setAttribute('disabled', 'true');

    try {
      const resp = await fetch('http://localhost:8080/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuario.id,
          codigoPedido,
          tipoObjeto,
          empresa,
          endereco,
          observacoes
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Falha ao criar pedido');

      alert('Pedido cadastrado com sucesso!');
      form.reset();
      window.location.href = './acompanharPedidos.html';
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      if (spinner) spinner.style.display = 'none';
      btn?.removeAttribute('disabled');
    }
  });
})();