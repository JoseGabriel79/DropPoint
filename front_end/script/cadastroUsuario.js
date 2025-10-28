function togglePassword(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

(function () {
  const form = document.getElementById('cadastroForm');
  if (!form) return;

  const senhaEl = document.getElementById('senha');
  const confirmarEl = document.getElementById('confirmarSenha');
  const strengthEl = document.getElementById('password-strength');
  const telEl = document.getElementById('telefone');

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

  // Indicador simples de força de senha
  senhaEl?.addEventListener('input', () => {
    const v = senhaEl.value;
    let level = 'Fraca';
    if (v.length >= 8 && /[A-Z]/.test(v) && /[0-9]/.test(v)) level = 'Forte';
    else if (v.length >= 6) level = 'Média';
    if (strengthEl) strengthEl.textContent = `Força da senha: ${level}`;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = document.getElementById('login')?.value?.trim();
    const telefoneMasked = telEl?.value?.trim() || '';
    const telefone = telefoneMasked.replace(/\D/g, '') || null; // envia apenas dígitos
    const email = document.getElementById('email')?.value?.trim();
    const senha = senhaEl?.value || '';
    const confirmarSenha = confirmarEl?.value || '';
    const terms = document.getElementById('terms');

    if (!login || !email || !senha) {
      alert('Preencha login, e-mail e senha.');
      return;
    }
    // Validação mínima de telefone (10 ou 11 dígitos)
    if (!telefone || (telefone.length !== 10 && telefone.length !== 11)) {
      alert('Informe um telefone válido com 10 ou 11 dígitos.');
      return;
    }
    if (senha !== confirmarSenha) {
      alert('As senhas não coincidem.');
      return;
    }
    if (!(terms && terms.checked)) {
      alert('Você precisa aceitar os termos.');
      return;
    }

    const btn = document.getElementById('submitBtn');
    const spinner = btn?.querySelector('.loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';
    btn?.setAttribute('disabled', 'true');

    try {
      const resp = await fetch('http://localhost:8080/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, email, senha, telefone })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Falha no cadastro');

      alert('Cadastro realizado! Faça login para continuar.');
      window.location.href = './loginUsuario.html';
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      if (spinner) spinner.style.display = 'none';
      btn?.removeAttribute('disabled');
    }
  });
})();