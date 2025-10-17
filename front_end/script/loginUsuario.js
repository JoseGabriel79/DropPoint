// Funcionalidades da página de login do usuário
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const submitBtn = document.getElementById('loginBtn');
    
    // Configuração de validação para cada campo
    const validationRules = {
        email: {
            required: true,
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            errorMessages: {
                required: 'E-mail é obrigatório',
                pattern: 'Digite um e-mail válido'
            }
        },
        senha: {
            required: true,
            minLength: 6,
            errorMessages: {
                required: 'Senha é obrigatória',
                minLength: 'Senha deve ter pelo menos 6 caracteres'
            }
        }
    };

    // Adicionar validação em tempo real para cada input
    const inputs = form.querySelectorAll('.input-field');
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => clearError(input));
    });

    // Validação individual de campo
    function validateField(input) {
        const fieldName = input.name;
        const value = input.value.trim();
        const rules = validationRules[fieldName];
        
        if (!rules) return true;

        // Limpar estados anteriores
        clearError(input);

        // Verificar se é obrigatório
        if (rules.required && !value) {
            showError(input, rules.errorMessages.required);
            return false;
        }

        // Se não é obrigatório e está vazio, considera válido
        if (!rules.required && !value) {
            showSuccess(input);
            return true;
        }

        // Verificar comprimento mínimo
        if (rules.minLength && value.length < rules.minLength) {
            showError(input, rules.errorMessages.minLength);
            return false;
        }

        // Verificar padrão
        if (rules.pattern && !rules.pattern.test(value)) {
            showError(input, rules.errorMessages.pattern);
            return false;
        }

        // Se passou em todas as validações
        showSuccess(input);
        return true;
    }

    // Mostrar erro
    function showError(input, message) {
        const inputGroup = input.closest('.input-group');
        const errorElement = inputGroup.querySelector('.error-message');
        
        inputGroup.classList.add('error');
        inputGroup.classList.remove('success');
        input.classList.add('error');
        input.classList.remove('success');
        
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    // Mostrar sucesso
    function showSuccess(input) {
        const inputGroup = input.closest('.input-group');
        
        inputGroup.classList.add('success');
        inputGroup.classList.remove('error');
        input.classList.add('success');
        input.classList.remove('error');
    }

    // Limpar erro
    function clearError(input) {
        const inputGroup = input.closest('.input-group');
        const errorElement = inputGroup.querySelector('.error-message');
        
        inputGroup.classList.remove('error', 'success');
        input.classList.remove('error', 'success');
        
        if (errorElement) {
            errorElement.textContent = '';
        }
    }

    // Validar formulário completo
    function validateForm() {
        let isValid = true;
        
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        return isValid;
    }

    // Autenticar usuário (simulação)
    async function authenticateUser(email, password) {
        // Aqui você faria uma requisição para o backend
        // Por agora, vamos simular uma autenticação
        
        // Simulação de usuários válidos
        const validUsers = [
            { email: 'admin@droppoint.com', password: '123456' },
            { email: 'user@test.com', password: 'password' },
            { email: 'teste@gmail.com', password: '123456' }
        ];
        
        const user = validUsers.find(u => 
            u.email.toLowerCase() === email.toLowerCase() && 
            u.password === password
        );
        
        if (user) {
            return { success: true, user: { email: user.email } };
        } else {
            return { success: false, message: 'E-mail ou senha incorretos' };
        }
    }

    // Submissão do formulário
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        // Mostrar loading
        const btnText = submitBtn.querySelector('.btn-text');
        const loadingSpinner = submitBtn.querySelector('.loading-spinner');
        
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        loadingSpinner.style.display = 'block';

        try {
            const formData = new FormData(form);
            const userData = Object.fromEntries(formData);
            
            // Autenticar usuário
            const authResult = await authenticateUser(userData.email, userData.senha);
            
            // Simular delay da requisição
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            if (authResult.success) {
                // Sucesso - salvar dados do usuário e redirecionar
                localStorage.setItem('droppoint_user', JSON.stringify(authResult.user));
                
                // Mostrar mensagem de sucesso
                alert('Login realizado com sucesso!');
                
                // Redirecionar para dashboard
                window.location.href = '../public/dashboardUsuario.html';
                
            } else {
                // Erro de autenticação
                showError(document.getElementById('senha'), authResult.message);
            }
            
        } catch (error) {
            console.error('Erro no login:', error);
            alert('Erro ao realizar login. Verifique sua conexão e tente novamente.');
        } finally {
            // Restaurar botão
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            loadingSpinner.style.display = 'none';
        }
    });

    // Implementar "Esqueceu a senha"
    const forgotLink = document.querySelector('.link-forgot');
    if (forgotLink) {
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            
            if (!email) {
                alert('Por favor, digite seu e-mail primeiro.');
                document.getElementById('email').focus();
                return;
            }
            
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                alert('Por favor, digite um e-mail válido.');
                document.getElementById('email').focus();
                return;
            }
            
            // Simular envio de e-mail de recuperação
            alert(`Um e-mail de recuperação foi enviado para ${email}. Verifique sua caixa de entrada.`);
        });
    }

    // Auto-completar com dados salvos (opcional)
    const savedEmail = localStorage.getItem('droppoint_last_email');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
    }

    // Salvar último e-mail usado
    form.addEventListener('submit', function() {
        const email = document.getElementById('email').value.trim();
        if (email) {
            localStorage.setItem('droppoint_last_email', email);
        }
    });
});

// Função para mostrar/ocultar senha
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const button = field.nextElementSibling;
    
    if (field.type === 'password') {
        field.type = 'text';
        button.textContent = '🙈';
    } else {
        field.type = 'password';
        button.textContent = '👁️';
    }
}

// Verificar se usuário já está logado
document.addEventListener('DOMContentLoaded', function() {
    const loggedUser = localStorage.getItem('droppoint_user');
    if (loggedUser) {
        // Se já está logado, perguntar se quer continuar como o usuário atual
        const user = JSON.parse(loggedUser);
        const continueAsUser = confirm(`Você já está logado como ${user.email}. Deseja continuar?`);
        
        if (continueAsUser) {
            window.location.href = '../public/dashboardUsuario.html';
        } else {
            // Limpar dados salvos
            localStorage.removeItem('droppoint_user');
        }
    }
});

// Adicionar funcionalidade de Enter para navegar entre campos
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.input-field');
    
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                
                if (index < inputs.length - 1) {
                    // Ir para o próximo campo
                    inputs[index + 1].focus();
                } else {
                    // Se é o último campo, submeter o formulário
                    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
                }
            }
        });
    });
});