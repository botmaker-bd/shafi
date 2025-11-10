// Auth functionality - Fixed version
class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.checkExistingLogin();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Signup form
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

        // Reset password form
        const resetForm = document.getElementById('resetForm');
        if (resetForm) {
            resetForm.addEventListener('submit', (e) => this.handleResetPassword(e));
        }

        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });
    }

    switchTab(e) {
        const tabName = e.target.textContent.toLowerCase().replace(' ', '');
        
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const formId = tabName + 'Form';
        const form = document.getElementById(formId);
        if (form) {
            form.classList.add('active');
            e.target.classList.add('active');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberLogin').checked;

        if (!this.validateEmail(email)) {
            this.showError('loginForm', 'Please enter a valid email address');
            return;
        }

        if (!password) {
            this.showError('loginForm', 'Please enter your password');
            return;
        }

        try {
            this.showLoading('loginForm', 'Logging in...');

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, remember })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Store user data and token
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('token', data.token);
                
                if (remember) {
                    localStorage.setItem('rememberLogin', 'true');
                }
                
                this.showSuccess('loginForm', 'Login successful! Redirecting...');
                
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
            } else {
                this.showError('loginForm', data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('loginForm', 'Login failed. Please try again.');
        } finally {
            this.hideLoading('loginForm');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (!this.validateEmail(email)) {
            this.showError('signupForm', 'Please enter a valid email address');
            return;
        }

        if (password.length < 6) {
            this.showError('signupForm', 'Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            this.showError('signupForm', 'Passwords do not match');
            return;
        }

        try {
            this.showLoading('signupForm', 'Creating account...');

            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showSuccess('signupForm', 'Account created successfully! Please login.');
                
                setTimeout(() => {
                    this.switchToTab('login');
                    document.getElementById('loginEmail').value = email;
                }, 1500);
                
            } else {
                this.showError('signupForm', data.error || 'Signup failed');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('signupForm', 'Signup failed. Please try again.');
        } finally {
            this.hideLoading('signupForm');
        }
    }

    async handleResetPassword(e) {
        e.preventDefault();
        
        const securityQuestion = document.getElementById('securityQuestion').value;
        const securityAnswer = document.getElementById('securityAnswer').value;
        const newPassword = document.getElementById('newPassword').value;

        const email = prompt('Please enter your email address:');
        if (!email) return;

        if (!this.validateEmail(email)) {
            alert('Please enter a valid email address');
            return;
        }

        if (!securityQuestion) {
            this.showError('resetForm', 'Please select a security question');
            return;
        }

        if (!securityAnswer) {
            this.showError('resetForm', 'Please answer the security question');
            return;
        }

        if (newPassword.length < 6) {
            this.showError('resetForm', 'New password must be at least 6 characters long');
            return;
        }

        try {
            this.showLoading('resetForm', 'Resetting password...');

            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    securityQuestion, 
                    securityAnswer, 
                    newPassword 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showSuccess('resetForm', 'Password reset successfully! Please login with your new password.');
                
                document.getElementById('resetForm').reset();
                
                setTimeout(() => {
                    this.switchToTab('login');
                }, 2000);
                
            } else {
                this.showError('resetForm', data.error || 'Password reset failed');
            }
        } catch (error) {
            console.error('Reset password error:', error);
            this.showError('resetForm', 'Password reset failed. Please try again.');
        } finally {
            this.hideLoading('resetForm');
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showLoading(formId, message) {
        const form = document.getElementById(formId);
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        submitBtn.innerHTML = '<div class="loading-spinner"></div> ' + message;
        submitBtn.disabled = true;
        submitBtn.setAttribute('data-original-text', originalText);
    }

    hideLoading(formId) {
        const form = document.getElementById(formId);
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.getAttribute('data-original-text');
        
        if (originalText) {
            submitBtn.textContent = originalText;
        }
        submitBtn.disabled = false;
    }

    showError(formId, message) {
        this.showMessage(formId, message, 'error');
    }

    showSuccess(formId, message) {
        this.showMessage(formId, message, 'success');
    }

    showMessage(formId, message, type) {
        const form = document.getElementById(formId);
        
        const existingMessages = form.querySelectorAll('.form-message');
        existingMessages.forEach(msg => msg.remove());
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;
        
        const submitBtn = form.querySelector('button[type="submit"]');
        form.insertBefore(messageDiv, submitBtn);
        
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }
    }

    switchToTab(tabName) {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tabName)) {
                btn.click();
            }
        });
    }

    checkExistingLogin() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        const rememberLogin = localStorage.getItem('rememberLogin');

        if (token && user && rememberLogin === 'true') {
            fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }).then(response => response.json())
              .then(data => {
                  if (data.success && data.valid) {
                      window.location.href = 'dashboard.html';
                  }
              })
              .catch(() => {
                  // Token verification failed
              });
        }
    }
}

// Initialize auth manager
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Global logout function
window.logout = function() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberLogin');
    window.location.href = 'index.html';
};