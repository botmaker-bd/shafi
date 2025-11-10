class DashboardManager {
    constructor() {
        this.user = null;
        this.bots = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadDashboardData();
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
        // Update user info
        if (this.user) {
            document.getElementById('userName').textContent = this.user.email.split('@')[0];
            document.getElementById('userEmail').textContent = this.user.email;
        }
    }

    setupEventListeners() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Test all bots
        document.getElementById('testAllBots')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.testAllBots();
        });

        // Refresh dashboard
        document.getElementById('refreshBots')?.addEventListener('click', () => {
            this.loadDashboardData();
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

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                userDropdown.classList.remove('show');
            });
        }
    }

    async loadDashboardData() {
        this.showLoading(true);

        try {
            const [botsResponse, statsResponse] = await Promise.all([
                this.fetchBots(),
                this.fetchStats()
            ]);

            if (botsResponse.success) {
                this.bots = botsResponse.bots;
                this.displayBots();
                this.updateBotStats();
            }

            if (statsResponse.success) {
                this.updateStats(statsResponse.stats);
            }

        } catch (error) {
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchBots() {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/bots/user/${this.user.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return await response.json();
    }

    async fetchStats() {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return await response.json();
    }

    displayBots() {
        const botsList = document.getElementById('botsList');
        
        if (!this.bots || this.bots.length === 0) {
            botsList.innerHTML = this.getEmptyBotsHTML();
            return;
        }

        const recentBots = this.bots.slice(0, 4); // Show only 4 recent bots
        botsList.innerHTML = recentBots.map(bot => this.getBotCardHTML(bot)).join('');
    }

    getEmptyBotsHTML() {
        return `
            <div class="empty-state">
                <div class="empty-icon">
                    <i class="fas fa-robot"></i>
                </div>
                <h3>No Bots Yet</h3>
                <p>Get started by adding your first Telegram bot</p>
                <a href="bot-management.html" class="btn btn-primary">
                    <i class="fas fa-plus"></i> Add Your First Bot
                </a>
            </div>
        `;
    }

    getBotCardHTML(bot) {
        return `
            <div class="bot-card">
                <div class="bot-header">
                    <div class="bot-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="bot-info">
                        <h4>${this.escapeHtml(bot.name)}</h4>
                        <p class="bot-username">@${this.escapeHtml(bot.username || 'unknown')}</p>
                        <span class="bot-status ${bot.is_active ? 'active' : 'inactive'}">
                            <i class="fas fa-circle"></i>
                            ${bot.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
                <div class="bot-actions">
                    <a href="command-editor.html?bot=${bot.id}" class="btn btn-primary btn-small">
                        <i class="fas fa-code"></i> Commands
                    </a>
                    <button onclick="dashboard.removeBot('${bot.id}')" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }

    updateBotStats() {
        const totalBots = this.bots.length;
        const activeBots = this.bots.filter(bot => bot.is_active).length;
        
        document.getElementById('totalBots').textContent = totalBots;
        document.getElementById('activeBots').textContent = activeBots;
    }

    updateStats(stats) {
        document.getElementById('totalCommands').textContent = stats.totalCommands || 0;
        document.getElementById('todayMessages').textContent = '0'; // Placeholder
    }

    async removeBot(botId) {
        if (!confirm('Are you sure you want to remove this bot? This will delete all associated commands.')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/${botId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('Bot removed successfully');
                await this.loadDashboardData();
            } else {
                this.showError(data.error || 'Failed to remove bot');
            }
        } catch (error) {
            this.showError('Network error while removing bot');
        }
    }

    async testAllBots() {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const testPromises = this.bots.map(bot => 
                fetch(`/api/bots/${bot.id}/test`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })
            );

            const results = await Promise.allSettled(testPromises);
            const successfulTests = results.filter(result => result.status === 'fulfilled' && result.value.ok).length;
            
            this.showSuccess(`${successfulTests}/${this.bots.length} bots tested successfully`);
        } catch (error) {
            this.showError('Failed to test bots');
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
            }).catch(() => {}); // Ignore errors during logout
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
        // Remove existing notifications
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

        // Add styles
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

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DashboardManager();
});