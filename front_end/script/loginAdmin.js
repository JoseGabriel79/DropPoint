document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const mensagemDiv = document.getElementById('mensagem');
    const btnEntrar = document.getElementById('btnEntrar');
    const btnText = document.getElementById('btnText');
    const loadingSpinner = document.getElementById('spinner');

    // Função para realizar o login
    const realizarLogin = async () => {
        const email = document.getElementById('email').value.trim();
        const senha = document.getElementById('senha').value;
        
        // Limpar mensagens de erro anteriores
        clearErrors();
        
        // Validações
        if (!email) {
            showFieldError('emailError', 'Email é obrigatório');
            return;
        }
        
        if (!senha) {
            showFieldError('senhaError', 'Senha é obrigatória');
            return;
        }

        try {
            // Mostrar loading
            setLoading(true);
            
            const response = await fetch('http://localhost:8080/loginAdmin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    senha: senha
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Sucesso
                showSuccess('Login realizado com sucesso!');
                
                // Salvar dados do admin no localStorage
                localStorage.setItem('adminLogado', JSON.stringify(data.usuario));
                
                // Redirecionar para dashboard admin
                setTimeout(() => {
                    window.location.href = 'dashboardAdmin.html';
                }, 1500);
            } else {
                // Erro do servidor
                showError(data.erro || 'Erro no login');
            }
        } catch (error) {
            console.error('Erro:', error);
            showError('Erro de conexão com o servidor');
        } finally {
            setLoading(false);
        }
    };

    // Event listener para o formulário
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        await realizarLogin();
    });

    // Event listener para a tecla Enter nos campos de input
    const emailInput = document.getElementById('email');
    const senhaInput = document.getElementById('senha');
    
    [emailInput, senhaInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    await realizarLogin();
                }
            });
        }
    });

    function setLoading(loading) {
        if (loading) {
            btnEntrar.disabled = true;
            btnText.style.display = 'none';
            loadingSpinner.style.display = 'inline-block';
        } else {
            btnEntrar.disabled = false;
            btnText.style.display = 'inline';
            loadingSpinner.style.display = 'none';
        }
    }

    function clearErrors() {
        document.getElementById('emailError').textContent = '';
        document.getElementById('senhaError').textContent = '';
        mensagemDiv.textContent = '';
        mensagemDiv.className = 'error-message';
        
        // Remover classes de erro dos campos
        document.getElementById('email').parentElement.classList.remove('error', 'success');
        document.getElementById('senha').parentElement.classList.remove('error', 'success');
    }

    function showFieldError(fieldId, message) {
        document.getElementById(fieldId).textContent = message;
        const field = fieldId === 'emailError' ? 'email' : 'senha';
        document.getElementById(field).parentElement.classList.add('error');
    }

    function showError(message) {
        mensagemDiv.textContent = message;
        mensagemDiv.style.color = '#e53e3e';
    }

    function showSuccess(message) {
        mensagemDiv.textContent = message;
        mensagemDiv.style.color = '#38a169';
    }
});

// Função para mostrar/ocultar senha
function togglePassword() {
    const senhaInput = document.getElementById('senha');
    const toggleBtn = document.querySelector('.toggle-password');
    
    if (senhaInput.type === 'password') {
        senhaInput.type = 'text';
        toggleBtn.textContent = '🙈';
    } else {
        senhaInput.type = 'password';
        toggleBtn.textContent = '👁️';
    }
}