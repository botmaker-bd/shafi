// Auth functionality - Complete version
class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.checkExistingLogin();
        this.setupEventListeners();
    }

    checkExistingLogin() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        const rememberLogin = localStorage.getItem('rememberLogin');

        if (token && user && rememberLogin === 'true') {
            // Verify token is still valid
            this.verifyToken(token).then(valid => {
                if (valid) {
                    window.location.href = 'dashboard.html';
                } else {
                    this.clearAuthData();
                }
            });
        }
    }

    setupEventListeners() {
        // Login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Signup form submission
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            signupForm.addEventListener('submit', (e) => this.handleSignup(e));
        }

        // Reset password form submission
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
        
        // Hide all forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected form and activate tab
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

        // Validate inputs
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

            if (response.ok) {
                // Store user data and token
                localStorage.setItem('user', JSON.stringify(data.user));
                localStorage.setItem('token', data.token);
                
                if (remember) {
                    localStorage.setItem('rememberLogin', 'true');
                } else {
                    localStorage.removeItem('rememberLogin');
                }
                
                // Show success message
                this.showSuccess('loginForm', 'Login successful! Redirecting...');
                
                // Redirect to dashboard after short delay
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 1000);
                
            } else {
                this.showError('loginForm', data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('loginForm', 'Login failed. Please check your internet connection and try again.');
        } finally {
            this.hideLoading('loginForm');
        }
    }

    async handleSignup(e) {
        e.preventDefault();
        
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        // Validate inputs
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

            if (response.ok) {
                this.showSuccess('signupForm', 'Account created successfully! Please login.');
                
                // Switch to login tab after short delay
                setTimeout(() => {
                    this.switchToTab('login');
                    // Pre-fill email in login form
                    document.getElementById('loginEmail').value = email;
                }, 1500);
                
            } else {
                this.showError('signupForm', data.error || 'Signup failed. Please try again.');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('signupForm', 'Signup failed. Please check your internet connection and try again.');
        } finally {
            this.hideLoading('signupForm');
        }
    }

    async handleResetPassword(e) {
        e.preventDefault();
        
        const securityQuestion = document.getElementById('securityQuestion').value;
        const securityAnswer = document.getElementById('securityAnswer').value;
        const newPassword = document.getElementById('newPassword').value;

        // Get email first
        const email = prompt('Please enter your email address:');
        if (!email) {
            return;
        }

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

            if (response.ok) {
                this.showSuccess('resetForm', 'Password reset successfully! Please login with your new password.');
                
                // Clear form
                document.getElementById('resetForm').reset();
                
                // Switch to login tab after short delay
                setTimeout(() => {
                    this.switchToTab('login');
                }, 2000);
                
            } else {
                this.showError('resetForm', data.error || 'Password reset failed. Please check your information and try again.');
            }
        } catch (error) {
            console.error('Reset password error:', error);
            this.showError('resetForm', 'Password reset failed. Please check your internet connection and try again.');
        } finally {
            this.hideLoading('resetForm');
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
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
        
        // Store original text for later restoration
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
        
        // Remove existing messages
        const existingMessages = form.querySelectorAll('.form-message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `form-message ${type}`;
        messageDiv.textContent = message;
        
        // Insert before submit button
        const submitBtn = form.querySelector('button[type="submit"]');
        form.insertBefore(messageDiv, submitBtn);
        
        // Auto-remove success messages after 5 seconds
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

    clearAuthData() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberLogin');
    }

    // Static method for logout
    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberLogin');
        window.location.href = 'index.html';
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});

// Global logout function
window.logout = function() {
    AuthManager.logout();
};

// Check if user is already logged in (for index.html)
if (window.location.pathname.includes('index.html') || 
    window.location.pathname === '/' || 
    window.location.pathname.endsWith('/')) {
    
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    const rememberLogin = localStorage.getItem('rememberLogin');

    if (token && user && rememberLogin === 'true') {
        // Verify token and redirect if valid
        fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => {
            if (response.ok) {
                window.location.href = 'dashboard.html';
            }
        }).catch(() => {
            // Token verification failed, stay on current page
        });
    }
}