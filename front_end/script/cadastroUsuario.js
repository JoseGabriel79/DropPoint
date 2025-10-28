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
    const telefone = document.getElementById('telefone')?.value?.trim();
    const email = document.getElementById('email')?.value?.trim();
    const senha = senhaEl?.value || '';
    const confirmarSenha = confirmarEl?.value || '';
    const terms = document.getElementById('terms');

    if (!login || !email || !senha) {
      alert('Preencha login, e-mail e senha.');
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