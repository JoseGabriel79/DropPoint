// Validação e funcionalidades da página de cadastro
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('cadastroForm');
    const inputs = form.querySelectorAll('.input-field');
    const submitBtn = document.getElementById('submitBtn');
    
    // Configuração de validação para cada campo
    const validationRules = {
        login: {
            required: true,
            minLength: 3,
            maxLength: 20,
            pattern: /^[a-zA-Z0-9_]+$/,
            errorMessages: {
                required: 'Nome de usuário é obrigatório',
                minLength: 'Nome deve ter pelo menos 3 caracteres',
                maxLength: 'Nome deve ter no máximo 20 caracteres',
                pattern: 'Use apenas letras, números e underscore'
            }
        },
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
        },
        confirmarSenha: {
            required: true,
            match: 'senha',
            errorMessages: {
                required: 'Confirmação de senha é obrigatória',
                match: 'Senhas não coincidem'
            }
        }
    };

    // Adicionar validação em tempo real para cada input
    inputs.forEach(input => {
        input.addEventListener('blur', () => validateField(input));
        input.addEventListener('input', () => {
            clearError(input);
            if (input.name === 'senha') {
                updatePasswordStrength(input.value);
                validateField(document.getElementById('confirmarSenha'));
            }
            if (input.name === 'confirmarSenha') {
                validateField(input);
            }
        });
    });

    // Validação individual de campo
    function validateField(input) {
        const fieldName = input.name;
        const value = input.value.trim();
        const rules = validationRules[fieldName];
        const inputGroup = input.closest('.input-group');
        
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

        // Verificar comprimento máximo
        if (rules.maxLength && value.length > rules.maxLength) {
            showError(input, rules.errorMessages.maxLength);
            return false;
        }

        // Verificar padrão
        if (rules.pattern && !rules.pattern.test(value)) {
            showError(input, rules.errorMessages.pattern);
            return false;
        }

        // Verificar se senhas coincidem
        if (rules.match) {
            const matchField = document.getElementById(rules.match);
            if (value !== matchField.value) {
                showError(input, rules.errorMessages.match);
                return false;
            }
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

    // Atualizar indicador de força da senha
    function updatePasswordStrength(password) {
        const strengthElement = document.getElementById('password-strength');
        
        if (!password) {
            strengthElement.className = 'password-strength';
            return;
        }

        let strength = 0;
        
        // Critérios de força
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;

        // Aplicar classe baseada na força
        strengthElement.className = 'password-strength';
        if (strength >= 2 && strength < 4) {
            strengthElement.classList.add('weak');
        } else if (strength >= 4 && strength < 6) {
            strengthElement.classList.add('medium');
        } else if (strength >= 6) {
            strengthElement.classList.add('strong');
        }
    }

    // Validar formulário completo
    function validateForm() {
        let isValid = true;
        
        // Validar todos os campos
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });

        // Validar checkbox dos termos
        const termsCheckbox = document.getElementById('terms');
        const termsError = document.getElementById('terms-error');
        
        if (!termsCheckbox.checked) {
            termsError.textContent = 'Você deve aceitar os termos de uso';
            isValid = false;
        } else {
            termsError.textContent = '';
        }

        return isValid;
    }

    // Verificar se usuário já existe (simulação)
    async function checkUserExists(login, email) {
        // Aqui você faria uma requisição para o backend
        // Por agora, vamos simular uma verificação
        
        const existingUsers = ['admin', 'user', 'test']; // Simulação
        const existingEmails = ['admin@test.com', 'user@test.com']; // Simulação
        
        if (existingUsers.includes(login.toLowerCase())) {
            return { userExists: true, emailExists: false };
        }
        
        if (existingEmails.includes(email.toLowerCase())) {
            return { userExists: false, emailExists: true };
        }
        
        return { userExists: false, emailExists: false };
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
            
            // Verificar se usuário já existe
            const checkResult = await checkUserExists(userData.login, userData.email);
            
            if (checkResult.userExists) {
                showError(document.getElementById('login'), 'Este nome de usuário já está em uso');
                return;
            }
            
            if (checkResult.emailExists) {
                showError(document.getElementById('email'), 'Este e-mail já está cadastrado');
                return;
            }

            // Simular envio para o servidor
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Sucesso - redirecionar ou mostrar mensagem
            alert('Cadastro realizado com sucesso!');
            
            // Aqui você redirecionaria para a página de login
            // window.location.href = '../public/loginUsuario.html';
            
        } catch (error) {
            console.error('Erro no cadastro:', error);
            alert('Erro ao realizar cadastro. Tente novamente.');
        } finally {
            // Restaurar botão
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            loadingSpinner.style.display = 'none';
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

// Verificar força da senha em tempo real
document.addEventListener('DOMContentLoaded', function() {
    const senhaInput = document.getElementById('senha');
    if (senhaInput) {
        senhaInput.addEventListener('input', function() {
            updatePasswordStrength(this.value);
        });
    }
});

// Função para validação de CPF (caso queira adicionar depois)
function validateCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    
    if (cpf.length !== 11 || !/^\d{11}$/.test(cpf)) {
        return false;
    }
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1+$/.test(cpf)) {
        return false;
    }
    
    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    
    let remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }
    
    if (remainder !== parseInt(cpf.charAt(9))) {
        return false;
    }
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    
    remainder = 11 - (sum % 11);
    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }
    
    return remainder === parseInt(cpf.charAt(10));
}

// Função para formatar campos (telefone, CPF, etc.)
function formatPhone(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{2})(\d)/, '($1) $2');
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
    input.value = value;
}

function formatCPF(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    input.value = value;
}