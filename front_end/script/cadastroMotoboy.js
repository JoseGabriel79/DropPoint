document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('cadastroMotoboyForm');
  const btn = document.getElementById('btnCadastrar');
  const telEl = document.getElementById('telefone');
  if (!form || !btn) return;

  // Máscara de telefone (formato BR)
  function formatPhoneBR(value) {
    const digits = (value || '').replace(/\D/g, '').slice(0, 11);
    const ddd = digits.slice(0, 2);
    const mid = digits.slice(2, digits.length > 10 ? 7 : 6);
    const end = digits.slice(digits.length > 10 ? 7 : 6);
    if (!digits.length) return '';
    if (digits.length <= 2) return `(${ddd}`;
    if (digits.length <= (digits.length > 10 ? 7 : 6)) return `(${ddd}) ${mid}`;
    return `(${ddd}) ${mid}-${end}`;
  }

  telEl?.addEventListener('input', (e) => {
    const el = e.target;
    el.value = formatPhoneBR(el.value);
  });
  telEl?.addEventListener('blur', (e) => {
    const el = e.target;
    el.value = formatPhoneBR(el.value);
  });

  btn.addEventListener('click', async () => {
    const login = document.getElementById('login')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const telefoneMasked = telEl?.value?.trim() || '';
    const telefone = telefoneMasked.replace(/\D/g, '') || null; // envia apenas dígitos
    const senha = document.getElementById('senha')?.value || '';
    const confirmar = document.getElementById('confirmarSenha')?.value || '';

    if (!login || !email || !senha) {
      alert('Preencha nome, email e senha.');
      return;
    }
    // Validação mínima de telefone (10 ou 11 dígitos)
    if (!telefone || (telefone.length !== 10 && telefone.length !== 11)) {
      alert('Informe um telefone válido com 10 ou 11 dígitos.');
      return;
    }
    if (senha !== confirmar) {
      alert('As senhas não coincidem.');
      return;
    }

    try {
      const resp = await fetch('http://localhost:8080/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, email, telefone, senha, tipo: 'motoboy' })
      });
      const data = await resp.json();
      if (!resp.ok) {
        alert(data?.erro || 'Erro ao cadastrar motoboy');
        return;
      }
      alert('Motoboy cadastrado com sucesso!');
      window.location.href = './loginMotoboy.html';
    } catch (err) {
      console.error(err);
      alert('Falha ao conectar ao servidor.');
    }
  });
});