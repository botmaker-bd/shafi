class AdminSettings {
    constructor() {
        this.user = null;
        this.settings = {};
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupTheme();
        this.setupMobileMenu();
        this.setupEventListeners();
        await this.loadSettings();
        await this.loadStats();
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
        // Tab switching
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form submissions
        document.getElementById('adminSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAdminSettings();
        });

        // Action buttons
        document.getElementById('testAdminSettings').addEventListener('click', () => {
            this.testAdminSettings();
        });

        document.getElementById('clearCache').addEventListener('click', () => {
            this.clearCache();
        });

        // Logout
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

    switchTab(tabName) {
        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.classList.toggle('active', tab.id === `${tabName}-tab`);
        });
    }

    async loadSettings() {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/settings', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.settings = data.settings || {};
                this.populateSettingsForms();
            } else {
                this.showNotification('Failed to load settings', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while loading settings', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStats() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.updateStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    populateSettingsForms() {
        // Admin settings
        if (this.settings.admin_chat_id) {
            document.getElementById('adminChatId').value = this.settings.admin_chat_id;
        }
    }

    updateStats(stats) {
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalBotsAdmin').textContent = stats.totalBots || 0;
        document.getElementById('totalCommandsAdmin').textContent = stats.totalCommands || 0;
        document.getElementById('activeBotsAdmin').textContent = stats.activeBots || 0;
    }

    async saveAdminSettings() {
        const adminChatId = document.getElementById('adminChatId').value.trim();
        const enableTesting = document.getElementById('enableTesting').checked;
        const enableLogging = document.getElementById('enableLogging').checked;

        if (!adminChatId) {
            this.showNotification('Admin Chat ID is required', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    adminChatId,
                    userId: this.user.id,
                    enableTesting,
                    enableLogging
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Admin settings saved successfully!', 'success');
                this.settings.admin_chat_id = adminChatId;
            } else {
                this.showNotification(data.error || 'Failed to save admin settings', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while saving settings', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async testAdminSettings() {
        const adminChatId = document.getElementById('adminChatId').value.trim();

        if (!adminChatId) {
            this.showNotification('Please enter Admin Chat ID first', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Test admin settings by checking if it's a valid format
            if (!/^-?\d+$/.test(adminChatId)) {
                throw new Error('Invalid chat ID format');
            }

            this.showNotification('Admin settings test completed successfully!', 'success');
        } catch (error) {
            this.showNotification('Admin settings test failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async clearCache() {
        if (!confirm('Are you sure you want to clear all cache? This may temporarily affect performance.')) {
            return;
        }

        this.showLoading(true);

        try {
            // Clear localStorage cache
            const keysToKeep = ['token', 'user', 'sessionId', 'remember', 'theme'];
            const keys = Object.keys(localStorage);
            
            for (const key of keys) {
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            }

            this.showNotification('Cache cleared successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to clear cache', 'error');
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

// Initialize admin settings
let adminSettings;
document.addEventListener('DOMContentLoaded', () => {
    adminSettings = new AdminSettings();
});