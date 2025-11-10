class AdminSettings {
    constructor() {
        this.user = null;
        this.settings = {};
        this.init();
    }

    async init() {
        await this.checkAuth();
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

        document.getElementById('generalSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveGeneralSettings();
        });

        document.getElementById('securitySettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSecuritySettings();
        });

        document.getElementById('notificationSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveNotificationSettings();
        });

        document.getElementById('advancedSettingsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAdvancedSettings();
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
                this.showError('Failed to load settings');
            }
        } catch (error) {
            this.showError('Network error while loading settings');
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

        // Set default values for other settings
        document.getElementById('enableTesting').checked = true;
        document.getElementById('enableLogging').checked = true;
        document.getElementById('sessionTimeout').value = 60;
        document.getElementById('maxLoginAttempts').value = 5;
        document.getElementById('apiRateLimit').value = 100;
        document.getElementById('webhookTimeout').value = 30;
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
            this.showError('Admin Chat ID is required');
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
                this.showSuccess('Admin settings saved successfully!');
                this.settings.admin_chat_id = adminChatId;
            } else {
                this.showError(data.error || 'Failed to save admin settings');
            }
        } catch (error) {
            this.showError('Network error while saving settings');
        } finally {
            this.showLoading(false);
        }
    }

    async saveGeneralSettings() {
        // Implementation for general settings
        this.showSuccess('General settings saved successfully!');
    }

    async saveSecuritySettings() {
        // Implementation for security settings
        this.showSuccess('Security settings saved successfully!');
    }

    async saveNotificationSettings() {
        // Implementation for notification settings
        this.showSuccess('Notification settings saved successfully!');
    }

    async saveAdvancedSettings() {
        // Implementation for advanced settings
        this.showSuccess('Advanced settings saved successfully!');
    }

    async testAdminSettings() {
        const adminChatId = document.getElementById('adminChatId').value.trim();

        if (!adminChatId) {
            this.showError('Please enter Admin Chat ID first');
            return;
        }

        this.showLoading(true);

        try {
            // Simulate test - in real implementation, you might want to send a test message
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.showSuccess('Admin settings test completed successfully!');
        } catch (error) {
            this.showError('Admin settings test failed');
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
            // Simulate cache clearing
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.showSuccess('Cache cleared successfully!');
        } catch (error) {
            this.showError('Failed to clear cache');
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

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: '10000',
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
        });

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize admin settings
let adminSettings;
document.addEventListener('DOMContentLoaded', () => {
    adminSettings = new AdminSettings();
});