class ForgotPassword {
    constructor() {
        this.currentStep = 1;
        this.userId = null;
        this.resetToken = null;
        this.securityQuestion = '';
        this.init();
    }

    init() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupPasswordToggle();
        this.setupPasswordStrength();
    }

    setupTheme() {
        const themeToggle = document.getElementById('themeToggle');
        const html = document.documentElement;

        const currentTheme = localStorage.getItem('theme') || 'dark';
        html.setAttribute('data-theme', currentTheme);
        this.updateThemeIcon(currentTheme);

        themeToggle.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            this.updateThemeIcon(newTheme);
        });
    }

    updateThemeIcon(theme) {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    setupEventListeners() {
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailSubmit();
        });

        document.getElementById('verifyAnswerBtn').addEventListener('click', () => {
            this.handleAnswerSubmit();
        });

        document.getElementById('resetPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordReset();
        });
    }

    setupPasswordToggle() {
        // New password toggle
        const toggleNew = document.getElementById('toggleNewPassword');
        const newPassword = document.getElementById('newPassword');
        
        if (toggleNew && newPassword) {
            toggleNew.addEventListener('click', () => {
                this.togglePasswordVisibility(newPassword, toggleNew);
            });
        }

        // Confirm password toggle
        const toggleConfirm = document.getElementById('toggleConfirmNewPassword');
        const confirmPassword = document.getElementById('confirmNewPassword');
        
        if (toggleConfirm && confirmPassword) {
            toggleConfirm.addEventListener('click', () => {
                this.togglePasswordVisibility(confirmPassword, toggleConfirm);
            });
        }
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('newPassword');
        const strengthBar = document.querySelector('.strength-bar');

        if (passwordInput && strengthBar) {
            passwordInput.addEventListener('input', () => {
                this.updatePasswordStrength(passwordInput.value, strengthBar);
            });
        }
    }

    togglePasswordVisibility(passwordField, toggleIcon) {
        const type = passwordField.type === 'password' ? 'text' : 'password';
        passwordField.type = type;
        toggleIcon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
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

    async handleEmailSubmit() {
        const email = document.getElementById('forgotEmail').value.trim();

        if (!email) {
            this.showNotification('Please enter your email address', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/password/forgot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.userId && data.securityQuestion) {
                    this.userId = data.userId;
                    this.securityQuestion = data.securityQuestion;
                    this.showStep(2);
                    document.getElementById('securityQuestionLabel').textContent = this.securityQuestion;
                    this.showNotification('Please answer your security question', 'info');
                } else {
                    this.showNotification('If the email exists, reset instructions have been sent.', 'info');
                }
            } else {
                this.showNotification(data.error || 'Failed to process request', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleAnswerSubmit() {
        const answer = document.getElementById('securityAnswer').value.trim();

        if (!answer) {
            this.showNotification('Please enter your security answer', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/password/verify-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    securityAnswer: answer
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.resetToken = data.resetToken;
                this.showStep(3);
                this.showNotification('Security answer verified. You can now set your new password.', 'success');
            } else {
                this.showNotification(data.error || 'Incorrect security answer', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handlePasswordReset() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (!newPassword || !confirmPassword) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('Password must be at least 6 characters long', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/password/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    resetToken: this.resetToken,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Password reset successfully! Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                this.showNotification(data.error || 'Failed to reset password', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showStep(step) {
        this.currentStep = step;
        
        // Hide all steps
        document.querySelectorAll('.forgot-step').forEach(stepEl => {
            stepEl.classList.remove('active');
        });
        
        // Show current step
        document.getElementById(`step${step}`).classList.add('active');
    }

    showLoading(show) {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            if (show) {
                btn.disabled = true;
                const originalText = btn.textContent;
                btn.innerHTML = '<div class="spinner"></div> Loading...';
                btn.setAttribute('data-original-text', originalText);
            } else {
                btn.disabled = false;
                const originalText = btn.getAttribute('data-original-text');
                if (originalText) {
                    btn.textContent = originalText;
                }
            }
        });
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
}

// Initialize forgot password
document.addEventListener('DOMContentLoaded', () => {
    new ForgotPassword();
});