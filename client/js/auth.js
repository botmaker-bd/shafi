class AuthManager {
    constructor() {
        this.currentTab = 'login';
        this.init();
    }

    init() {
        this.setupTabSwitching();
        this.setupLoginForm();
        this.setupSignupForm();
        this.setupPasswordStrength();
        this.checkExistingSession();
        this.setupSocialAuth();
    }

    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const authForms = document.querySelectorAll('.auth-form');

        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });
    }

    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}Form`);
        });

        this.currentTab = tab;
        
        // Clear form errors when switching tabs
        this.clearFormErrors();
    }

    setupLoginForm() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        // Demo credentials auto-fill
        const demoLoginBtn = document.querySelector('[data-demo-login]');
        if (demoLoginBtn) {
            demoLoginBtn.addEventListener('click', () => {
                document.getElementById('loginEmail').value = 'demo@example.com';
                document.getElementById('loginPassword').value = 'password123';
            });
        }
    }

    setupSignupForm() {
        const form = document.getElementById('signupForm');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSignup();
        });
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('signupPassword');
        const strengthBar = document.querySelector('.strength-bar');

        if (passwordInput && strengthBar) {
            passwordInput.addEventListener('input', () => {
                this.updatePasswordStrength(passwordInput.value, strengthBar);
            });
        }
    }

    setupSocialAuth() {
        // Google login
        const googleBtn = document.querySelector('.btn-google');
        if (googleBtn) {
            googleBtn.addEventListener('click', () => {
                this.showNotification('Google authentication will be available soon!', 'info');
            });
        }

        // GitHub login
        const githubBtn = document.querySelector('.btn-github');
        if (githubBtn) {
            githubBtn.addEventListener('click', () => {
                this.showNotification('GitHub authentication will be available soon!', 'info');
            });
        }
    }

    updatePasswordStrength(password, strengthBar) {
        let strength = 0;
        if (password.length >= 6) strength += 25;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 25;
        if (password.match(/\d/)) strength += 25;
        if (password.match(/[^a-zA-Z\d]/)) strength += 25;

        if (strengthBar) {
            strengthBar.style.width = `${strength}%`;
            strengthBar.style.background = this.getStrengthColor(strength);
        }
    }

    getStrengthColor(strength) {
        if (strength < 50) return '#ef4444';
        if (strength < 75) return '#f59e0b';
        return '#10b981';
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberMe')?.checked || false;

        // Validation
        if (!email || !password) {
            this.showError('Please fill in all fields');
            return;
        }

        const btn = document.querySelector('#loginForm .btn');
        this.setButtonLoading(btn, true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password, remember })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.saveSession(data);
                this.showSuccess('Login successful! Redirecting...');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                this.showError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    async handleSignup() {
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        const securityQuestion = document.getElementById('securityQuestion').value;
        const securityAnswer = document.getElementById('securityAnswer').value;
        const agreeTerms = document.getElementById('agreeTerms')?.checked || false;

        // Validation
        if (!email || !password || !confirmPassword || !securityQuestion || !securityAnswer) {
            this.showError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        if (!agreeTerms) {
            this.showError('Please agree to the terms and conditions');
            return;
        }

        const btn = document.querySelector('#signupForm .btn');
        this.setButtonLoading(btn, true);

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    securityQuestion,
                    securityAnswer
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showSuccess('Account created successfully! Please login.');
                this.switchTab('login');
                document.getElementById('loginEmail').value = email;
            } else {
                this.showError(data.error || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.setButtonLoading(btn, false);
        }
    }

    saveSession(authData) {
        localStorage.setItem('token', authData.token);
        localStorage.setItem('sessionId', authData.sessionId);
        localStorage.setItem('user', JSON.stringify(authData.user));
        
        if (authData.remember) {
            localStorage.setItem('remember', 'true');
        }
    }

    async checkExistingSession() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch('/api/auth/verify', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.valid) {
                        window.location.href = 'dashboard.html';
                    } else {
                        this.clearSession();
                    }
                } else {
                    this.clearSession();
                }
            } catch (error) {
                console.error('Session check error:', error);
                this.clearSession();
            }
        }
    }

    clearSession() {
        localStorage.removeItem('token');
        localStorage.removeItem('sessionId');
        localStorage.removeItem('user');
        localStorage.removeItem('remember');
    }

    setButtonLoading(button, loading) {
        if (!button) return;

        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');

        if (loading) {
            button.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'block';
        } else {
            button.disabled = false;
            if (btnText) btnText.style.display = 'block';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    }

    clearFormErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(el => el.remove());
        
        const formGroups = document.querySelectorAll('.form-group');
        formGroups.forEach(group => group.classList.remove('error'));
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            error: '❌',
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icons[type] || icons.info}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#ef4444' : 
                       type === 'success' ? '#10b981' : 
                       type === 'warning' ? '#f59e0b' : '#3b82f6',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: '10000',
            maxWidth: '400px',
            minWidth: '300px',
            border: type === 'error' ? '1px solid #dc2626' : 
                    type === 'success' ? '1px solid #059669' : 
                    type === 'warning' ? '1px solid #d97706' : '1px solid #2563eb'
        });

        const content = notification.querySelector('.notification-content');
        Object.assign(content.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
        });

        const closeBtn = notification.querySelector('.notification-close');
        Object.assign(closeBtn.style, {
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '0',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background-color 0.2s'
        });

        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });

        closeBtn.addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});