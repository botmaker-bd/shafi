class ChangePassword {
    constructor() {
        this.user = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupTheme();
        this.setupMobileMenu();
        this.setupEventListeners();
        this.setupPasswordToggle();
        this.setupPasswordStrength();
        this.setupUserMenu();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            this.user = JSON.parse(userData);
            this.updateUI();
        } catch (error) {
            this.logout();
        }
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

    setupMobileMenu() {
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mobileMenu = document.getElementById('mobileMenu');
        const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

        if (mobileMenuBtn && mobileMenu) {
            mobileMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileMenu.classList.toggle('active');
            });

            document.addEventListener('click', (e) => {
                if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
                    mobileMenu.classList.remove('active');
                }
            });

            if (mobileLogoutBtn) {
                mobileLogoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }
        }
    }

    updateUI() {
        if (this.user) {
            document.getElementById('userEmail').textContent = this.user.email;
        }
    }

    setupEventListeners() {
        document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordChange();
        });

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }

    setupUserMenu() {
        const userBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');

        if (userBtn && userDropdown) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                userDropdown.classList.remove('show');
            });
        }
    }

    setupPasswordToggle() {
        // Current password toggle
        const toggleCurrent = document.getElementById('toggleCurrentPassword');
        const currentPassword = document.getElementById('currentPassword');
        
        if (toggleCurrent && currentPassword) {
            toggleCurrent.addEventListener('click', () => {
                this.togglePasswordVisibility(currentPassword, toggleCurrent);
            });
        }

        // New password toggle
        const toggleNew = document.getElementById('toggleNewPassword');
        const newPassword = document.getElementById('newPassword');
        
        if (toggleNew && newPassword) {
            toggleNew.addEventListener('click', () => {
                this.togglePasswordVisibility(newPassword, toggleNew);
            });
        }

        // Confirm password toggle
        const toggleConfirm = document.getElementById('toggleConfirmPassword');
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

    async handlePasswordChange() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Please fill in all fields', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('New password must be at least 6 characters long', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        if (currentPassword === newPassword) {
            this.showNotification('New password must be different from current password', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    userId: this.user.id
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Password changed successfully!', 'success');
                // Clear form
                document.getElementById('changePasswordForm').reset();
                // Reset strength bar
                const strengthBar = document.querySelector('.strength-bar');
                if (strengthBar) {
                    strengthBar.style.width = '0%';
                }
            } else {
                this.showNotification(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while changing password', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    logout() {
        const sessionId = localStorage.getItem('sessionId');
        
        if (sessionId) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ sessionId })
            }).catch(() => {});
        }

        localStorage.clear();
        window.location.href = 'index.html';
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }

        const submitBtn = document.querySelector('#changePasswordForm button[type="submit"]');
        if (submitBtn) {
            if (show) {
                submitBtn.disabled = true;
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<div class="spinner"></div> Changing...';
                submitBtn.setAttribute('data-original-text', originalText);
            } else {
                submitBtn.disabled = false;
                const originalText = submitBtn.getAttribute('data-original-text');
                if (originalText) {
                    submitBtn.innerHTML = originalText;
                }
            }
        }
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

// Initialize change password
document.addEventListener('DOMContentLoaded', () => {
    new ChangePassword();
});