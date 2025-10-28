(() => {
  const form = document.getElementById('cadastroPedidoForm');
  if (!form) return;

  const cepInput = document.getElementById('cep');
  const numeroInput = document.getElementById('numero');
  const complementoInput = document.getElementById('complemento');
  const enderecoInput = document.getElementById('endereco');
  const btnBuscarCep = document.getElementById('btnBuscarCep');
  const btnGeo = document.getElementById('btnGeo');

  // Formata e sanitiza CEP: apenas dígitos
  function sanitizeCep(raw) {
    return String(raw || '').replace(/\D/g, '').slice(0, 8);
  }

  function buildEnderecoFromViaCep(data) {
    const cep = sanitizeCep(cepInput?.value);
    const numero = numeroInput?.value?.trim();
    const complemento = complementoInput?.value?.trim();
    const partes = [];
    if (data.logradouro) partes.push(data.logradouro);
    if (numero) partes.push(numero);
    const linha1 = partes.join(', ');
    const linha2 = [data.bairro, data.localidade, data.uf].filter(Boolean).join(', ');
    const final = [linha1, linha2].filter(Boolean).join(' - ');
    const withCep = cep ? `${final} (CEP: ${cep})` : final;
    return complemento ? `${withCep} — ${complemento}` : withCep;
  }

  async function fetchCep() {
    const cep = sanitizeCep(cepInput?.value);
    if (!cep || cep.length !== 8) {
      alert('Informe um CEP válido (8 dígitos).');
      return;
    }
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await resp.json();
      if (data.erro) throw new Error('CEP não encontrado');
      const addr = buildEnderecoFromViaCep(data);
      if (enderecoInput) enderecoInput.value = addr;
    } catch (err) {
      alert('Falha ao buscar CEP: ' + (err.message || 'erro desconhecido'));
    }
  }

  async function fetchReverseGeocoding(lat, lon) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('addressdetails', '1');
    const resp = await fetch(url.href, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('Falha no reverse geocoding');
    return resp.json();
  }

  function buildEnderecoFromNominatim(data) {
    const a = data.address || {};
    const numero = numeroInput?.value?.trim();
    const complemento = complementoInput?.value?.trim();
    const rua = a.road || a.pedestrian || a.footway || a.cycleway || a.residential || a.neighbourhood || '';
    const cidade = a.city || a.town || a.village || a.municipality || a.county || '';
    const estado = a.state || a.region || '';
    const bairro = a.suburb || a.neighbourhood || a.quarter || '';
    const partes = [];
    if (rua) partes.push(rua);
    if (numero) partes.push(numero);
    const linha1 = partes.join(', ');
    const linha2 = [bairro, cidade, estado].filter(Boolean).join(', ');
    let final = [linha1, linha2].filter(Boolean).join(' - ');
    if (a.postcode) final += ` (CEP: ${a.postcode})`;
    if (complemento) final += ` — ${complemento}`;
    return final;
  }

  function getLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalização não suportada'));
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => reject(new Error(err.message || 'Falha ao obter localização')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  if (btnBuscarCep) btnBuscarCep.addEventListener('click', fetchCep);
  if (cepInput) cepInput.addEventListener('blur', () => {
    const cep = sanitizeCep(cepInput.value);
    if (cep.length === 8) fetchCep();
  });

  if (btnGeo) btnGeo.addEventListener('click', async () => {
    try {
      const { lat, lon } = await getLocation();
      const data = await fetchReverseGeocoding(lat, lon);
      const addr = buildEnderecoFromNominatim(data);
      if (enderecoInput) enderecoInput.value = addr;
    } catch (err) {
      alert('Falha ao obter endereço pela localização: ' + (err.message || 'erro desconhecido'));
    }
  });

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
    const entregaMovel = !!document.getElementById('entregaMovel')?.checked;

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
          observacoes,
          entregaMovel
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