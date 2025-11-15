// client/js/dashboard.js
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
            this.updateUserInfo();
        } catch (error) {
            this.logout();
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
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
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

            const botsData = await botsResponse.json();

            if (botsData.success) {
                this.bots = botsData.bots || [];
                this.updateBotsList();
                this.updateStats();
            }

            // Load recent activity (mock data for now)
            this.updateRecentActivity();

        } catch (error) {
            console.error('❌ Dashboard data loading error:', error);
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
    }

    updateBotsList() {
        const botsList = document.getElementById('botsList');
        
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

        // Show only first 3 bots
        const displayBots = this.bots.slice(0, 3);
        
        let html = '';
        displayBots.forEach(bot => {
            const isActive = bot.is_active;
            const commandsCount = bot.commands_count || 0;
            
            html += `
                <div class="bot-card">
                    <div class="bot-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="bot-info">
                        <div class="bot-name">
                            ${bot.name}
                            <span class="bot-status ${isActive ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i>
                                ${isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div class="bot-username">@${bot.username}</div>
                        <div class="bot-meta">
                            <span>${commandsCount} commands</span>
                            <span>Added ${this.formatDate(bot.created_at)}</span>
                        </div>
                    </div>
                    <div class="bot-actions">
                        <a href="command-editor.html?bot=${bot.id}" class="btn btn-small btn-secondary">
                            <i class="fas fa-code"></i>
                        </a>
                        <a href="bot-management.html" class="btn btn-small btn-primary">
                            <i class="fas fa-cog"></i>
                        </a>
                    </div>
                </div>
            `;
        });

        botsList.innerHTML = html;
    }

    updateStats() {
        // Update main stats
        document.getElementById('totalBots').textContent = this.bots.length;
        document.getElementById('activeBots').textContent = this.bots.filter(bot => bot.is_active).length;
        
        // Calculate total commands
        const totalCommands = this.bots.reduce((sum, bot) => sum + (bot.commands_count || 0), 0);
        document.getElementById('totalCommands').textContent = totalCommands;
        
        // Mock data for other stats
        document.getElementById('todayMessages').textContent = '42';
        document.getElementById('totalUsers').textContent = '1.2K';
        document.getElementById('uptime').textContent = '99.8%';
    }

    updateRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        
        // Mock activity data - in real app, fetch from API
        const activities = [
            {
                type: 'success',
                icon: 'check',
                message: 'Welcome Bot received a new message',
                time: '2 minutes ago'
            },
            {
                type: 'info',
                icon: 'code',
                message: 'Command /start was updated',
                time: '1 hour ago'
            },
            {
                type: 'warning',
                icon: 'exclamation',
                message: 'Support Bot connection test failed',
                time: '3 hours ago'
            }
        ];

        let html = '';
        activities.forEach(activity => {
            html += `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas fa-${activity.icon}"></i>
                    </div>
                    <div class="activity-content">
                        <p>${activity.message}</p>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                </div>
            `;
        });

        activityList.innerHTML = html;
    }

    async testAllBots() {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const activeBots = this.bots.filter(bot => bot.is_active);
            
            let successCount = 0;
            let totalCount = activeBots.length;

            // Test each bot
            for (const bot of activeBots) {
                try {
                    const response = await fetch(`/api/bots/${bot.id}/test`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        successCount++;
                    }
                } catch (error) {
                    console.error(`❌ Test failed for bot ${bot.name}:`, error);
                }
            }

            this.showSuccess(`Tested ${successCount}/${totalCount} bots successfully!`);

        } catch (error) {
            console.error('❌ Test all bots error:', error);
            this.showError('Failed to test bots');
        } finally {
            this.showLoading(false);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'today';
        if (diffDays === 2) return 'yesterday';
        if (diffDays <= 7) return `${diffDays - 1} days ago`;
        if (diffDays <= 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        
        return date.toLocaleDateString();
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

    logout() {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// Initialize dashboard
let dashboard;

document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});