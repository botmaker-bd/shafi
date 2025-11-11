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
            const userName = document.getElementById('userName');
            const userEmail = document.getElementById('userEmail');
            
            if (userName) userName.textContent = this.user.email.split('@')[0];
            if (userEmail) userEmail.textContent = this.user.email;
        }
    }

    setupEventListeners() {
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        document.getElementById('testAllBots')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.testAllBots();
        });

        document.getElementById('refreshDashboard')?.addEventListener('click', () => {
            this.loadDashboardData();
        });
    }

    async loadDashboardData() {
        this.showLoading(true);

        try {
            const [botsResponse, statsResponse] = await Promise.all([
                this.fetchBots(),
                this.fetchStats()
            ]);

            if (botsResponse.success) {
                this.bots = botsResponse.bots || [];
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
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/user/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            return { success: false, bots: [] };
        }
    }

    async fetchStats() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            return { success: false, stats: {} };
        }
    }

    displayBots() {
        const botsList = document.getElementById('botsList');
        
        if (!this.bots || this.bots.length === 0) {
            botsList.innerHTML = this.getEmptyBotsHTML();
            return;
        }

        const recentBots = this.bots.slice(0, 4);
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
        
        const totalBotsEl = document.getElementById('totalBots');
        const activeBotsEl = document.getElementById('activeBots');
        
        if (totalBotsEl) totalBotsEl.textContent = totalBots;
        if (activeBotsEl) activeBotsEl.textContent = activeBots;
    }

    updateStats(stats) {
        const totalCommandsEl = document.getElementById('totalCommands');
        const todayMessagesEl = document.getElementById('todayMessages');
        
        if (totalCommandsEl) totalCommandsEl.textContent = stats.totalCommands || 0;
        if (todayMessagesEl) todayMessagesEl.textContent = stats.todayMessages || 0;
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
        commonApp?.showError(message) || this.showNotification(message, 'error');
    }

    showSuccess(message) {
        commonApp?.showSuccess(message) || this.showNotification(message, 'success');
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

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DashboardManager();
});