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
    const telefone = telefoneMasked.replace(/\D/g, '') || null;
    const senha = document.getElementById('senha')?.value || '';
    const confirmar = document.getElementById('confirmarSenha')?.value || '';

    // Validações básicas
    if (!login || !email || !senha) {
      alert('Preencha nome, email e senha.');
      return;
    }
    
    if (!telefone || (telefone.length !== 10 && telefone.length !== 11)) {
      alert('Informe um telefone válido com 10 ou 11 dígitos.');
      return;
    }
    
    if (senha !== confirmar) {
      alert('As senhas não coincidem.');
      return;
    }

    // Validar se todas as imagens foram selecionadas
    const enderecoFile = document.getElementById('endereco').files[0];
    const motoFile = document.getElementById('moto').files[0];
    const fotoDocFile = document.getElementById('fotoDoc').files[0];

    if (!enderecoFile || !motoFile || !fotoDocFile) {
      alert('Todas as imagens são obrigatórias: Comprovante de Endereço, Documento da Moto e Foto do Documento.');
      return;
    }

    // Validar tipos de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(enderecoFile.type) || 
        !allowedTypes.includes(motoFile.type) || 
        !allowedTypes.includes(fotoDocFile.type)) {
      alert('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF).');
      return;
    }

    // Validar tamanho dos arquivos (5MB cada)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (enderecoFile.size > maxSize || motoFile.size > maxSize || fotoDocFile.size > maxSize) {
      alert('Cada imagem deve ter no máximo 5MB.');
      return;
    }

    try {
      // Criar FormData para envio com arquivos
      const formData = new FormData();
      formData.append('login', login);
      formData.append('email', email);
      formData.append('telefone', telefone);
      formData.append('senha', senha);
      formData.append('endereco', enderecoFile);
      formData.append('moto', motoFile);
      formData.append('fotoDoc', fotoDocFile);

      // Desabilitar botão durante o upload
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      const resp = await fetch('http://localhost:8080/usuarios/motoboy', {
        method: 'POST',
        body: formData // Não definir Content-Type, deixar o browser definir
      });

      const data = await resp.json();
      
      if (!resp.ok) {
        alert(data?.erro || 'Erro ao cadastrar motoboy');
        return;
      }
      
      alert('Motoboy cadastrado com sucesso! Aguarde aprovação para fazer login.');
      window.location.href = './loginMotoboy.html';
      
    } catch (err) {
      console.error(err);
      alert('Falha ao conectar ao servidor.');
    } finally {
      // Reabilitar botão
      btn.disabled = false;
      btn.textContent = 'Cadastrar';
    }
  });
});