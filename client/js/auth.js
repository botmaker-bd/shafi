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
    }

    setupLoginForm() {
        const form = document.getElementById('loginForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    setupSignupForm() {
        const form = document.getElementById('signupForm');
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

    updatePasswordStrength(password, strengthBar) {
        let strength = 0;
        if (password.length >= 6) strength += 25;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength += 25;
        if (password.match(/\d/)) strength += 25;
        if (password.match(/[^a-zA-Z\d]/)) strength += 25;

        strengthBar.style.width = `${strength}%`;
        strengthBar.style.background = this.getStrengthColor(strength);
    }

    getStrengthColor(strength) {
        if (strength < 50) return '#ef4444';
        if (strength < 75) return '#f59e0b';
        return '#10b981';
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberMe').checked;

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

            if (response.ok) {
                this.saveSession(data);
                this.showSuccess('Login successful! Redirecting...');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
            } else {
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
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
        const agreeTerms = document.getElementById('agreeTerms').checked;

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

            if (response.ok) {
                this.showSuccess('Account created successfully! Please login.');
                this.switchTab('login');
                document.getElementById('loginEmail').value = email;
            } else {
                this.showError(data.error);
            }
        } catch (error) {
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
                    window.location.href = 'dashboard.html';
                } else {
                    this.clearSession();
                }
            } catch (error) {
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
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');

        if (loading) {
            button.disabled = true;
            btnText.style.display = 'none';
            btnLoader.style.display = 'block';
        } else {
            button.disabled = false;
            btnText.style.display = 'block';
            btnLoader.style.display = 'none';
        }
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
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            max-width: 400px;
        `;

        notification.querySelector('.notification-content').style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        `;

        notification.querySelector('.notification-close').style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 1.25rem;
            cursor: pointer;
            padding: 0;
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);

        // Close button
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});