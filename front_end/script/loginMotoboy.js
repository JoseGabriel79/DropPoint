function togglePassword(id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

(function () {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email')?.value?.trim();
    const senha = document.getElementById('senha')?.value || '';

    if (!email || !senha) {
      alert('Informe e-mail e senha.');
      return;
    }

    const btn = document.getElementById('loginBtn');
    const spinner = btn?.querySelector('.loading-spinner');
    if (spinner) spinner.style.display = 'inline-block';
    btn?.setAttribute('disabled', 'true');

    try {
      const resp = await fetch('http://localhost:8080/loginMotoboy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || 'Falha no login');

      localStorage.setItem('motoboy', JSON.stringify(data.usuario));
      alert('Login realizado com sucesso!');
      window.location.href = './dashboardEntregamovel.html';
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      if (spinner) spinner.style.display = 'none';
      btn?.removeAttribute('disabled');
    }
  });
})();