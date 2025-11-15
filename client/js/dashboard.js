class Dashboard {
    constructor() {
        this.user = null;
        this.bots = [];
        this.stats = {};
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadDashboardData();
        this.updateUserInfo();
        console.log('✅ Dashboard initialized');
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
        } catch (error) {
            this.logout();
        }
    }

    setupEventListeners() {
        // Refresh dashboard
        document.getElementById('refreshDashboard').addEventListener('click', () => {
            this.loadDashboardData();
        });

        // Test all bots
        document.getElementById('testAllBots').addEventListener('click', (e) => {
            e.preventDefault();
            this.testAllBots();
        });

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }

    async loadDashboardData() {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            
            // Load user's bots
            const botsResponse = await fetch(`/api/bots/user/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (botsResponse.ok) {
                const botsData = await botsResponse.json();
                if (botsData.success) {
                    this.bots = botsData.bots || [];
                    this.displayBots();
                }
            }

            // Load dashboard stats
            const statsResponse = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                if (statsData.success) {
                    this.stats = statsData.stats || {};
                    this.updateStats();
                }
            }

        } catch (error) {
            console.error('❌ Dashboard data loading error:', error);
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
    }

    updateUserInfo() {
        if (this.user) {
            const userNameEl = document.getElementById('userName');
            const userEmailEl = document.getElementById('userEmail');
            const userAvatarEl = document.getElementById('userAvatar');
            
            if (userNameEl) userNameEl.textContent = this.user.email.split('@')[0];
            if (userEmailEl) userEmailEl.textContent = this.user.email;
            if (userAvatarEl) userAvatarEl.textContent = this.user.email.charAt(0).toUpperCase();
        }
    }

    updateStats() {
        // Update header stats
        const totalBotsEl = document.getElementById('totalBots');
        const activeBotsEl = document.getElementById('activeBots');
        
        if (totalBotsEl) totalBotsEl.textContent = this.bots.length;
        if (activeBotsEl) {
            const activeBots = this.bots.filter(bot => bot.is_active).length;
            activeBotsEl.textContent = activeBots;
        }

        // Update main stats
        const totalCommandsEl = document.getElementById('totalCommands');
        const todayMessagesEl = document.getElementById('todayMessages');
        const totalUsersEl = document.getElementById('totalUsers');
        const uptimeEl = document.getElementById('uptime');
        
        if (totalCommandsEl) totalCommandsEl.textContent = this.stats.totalCommands || '0';
        if (todayMessagesEl) todayMessagesEl.textContent = this.stats.todayMessages || '0';
        if (totalUsersEl) totalUsersEl.textContent = this.formatNumber(this.stats.totalUsers || 0);
        if (uptimeEl) uptimeEl.textContent = this.stats.uptime ? `${this.stats.uptime}%` : '99.8%';
    }

    displayBots() {
        const botsList = document.getElementById('botsList');
        
        if (!botsList) return;

        if (!this.bots || this.bots.length === 0) {
            botsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-robot"></i>
                    </div>
                    <h3>No Bots Yet</h3>
                    <p>Get started by adding your first bot</p>
                    <a href="bot-management.html" class="btn btn-primary">Add Your First Bot</a>
                </div>
            `;
            return;
        }

        // Show only recent bots (limit to 6)
        const recentBots = this.bots.slice(0, 6);
        
        let html = '';
        recentBots.forEach(bot => {
            const isActive = bot.is_active;
            const commandsCount = bot.commands_count || 0;
            const botInitial = bot.name ? bot.name.charAt(0).toUpperCase() : 'B';
            
            html += `
                <div class="bot-card" data-bot-id="${bot.id}">
                    <div class="bot-avatar" style="background: ${this.getBotColor(bot.id)};">
                        ${botInitial}
                    </div>
                    <div class="bot-info">
                        <div class="bot-name">${this.escapeHtml(bot.name)}</div>
                        <div class="bot-username">@${this.escapeHtml(bot.username)}</div>
                        <div class="bot-meta">
                            <span class="bot-status ${isActive ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i>
                                ${isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span class="bot-commands">
                                <i class="fas fa-code"></i>
                                ${commandsCount} commands
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });

        botsList.innerHTML = html;

        // Add click events to bot cards
        botsList.querySelectorAll('.bot-card').forEach(card => {
            card.addEventListener('click', () => {
                const botId = card.dataset.botId;
                window.location.href = `command-editor.html?bot=${botId}`;
            });
        });
    }

    async testAllBots() {
        if (!this.bots || this.bots.length === 0) {
            this.showInfo('No bots to test');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            let successCount = 0;
            let failCount = 0;

            // Test each bot
            for (const bot of this.bots) {
                try {
                    const response = await fetch(`/api/bots/${bot.id}/test`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    failCount++;
                }
            }

            this.showSuccess(`Bot testing completed: ${successCount} successful, ${failCount} failed`);
            
            // Reload dashboard to update status
            await this.loadDashboardData();

        } catch (error) {
            console.error('❌ Test all bots error:', error);
            this.showError('Failed to test bots');
        } finally {
            this.showLoading(false);
        }
    }

    getBotColor(botId) {
        // Generate consistent color based on bot ID
        const colors = [
            '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
            '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
        ];
        const index = parseInt(botId) % colors.length;
        return colors[index];
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    logout() {
        const sessionId = localStorage.getItem('sessionId');
        const token = localStorage.getItem('token');
        
        if (sessionId && token) {
            fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

    showInfo(message) {
        this.showNotification(message, 'info');
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
        if (unsafe === null || unsafe === undefined) {
            return '';
        }
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
            .replace(/\//g, "&#x2F;");
    }
}

// Initialize dashboard
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});