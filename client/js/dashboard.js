// client/js/dashboard.js
class Dashboard {
    constructor() {
        this.user = null;
        this.stats = {
            totalBots: 0,
            activeBots: 0,
            totalCommands: 0,
            todayMessages: 0
        };
        this.bots = [];
        this.activities = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadDashboardData();
        this.updateUserInfo();
        console.log('✅ Dashboard initialized');
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
    }

    async loadDashboardData() {
        this.showLoading(true);

        try {
            await Promise.all([
                this.loadStats(),
                this.loadBots(),
                this.loadRecentActivity()
            ]);
        } catch (error) {
            console.error('❌ Dashboard loading error:', error);
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStats() {
        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));
            
            if (!user || !user.id) {
                throw new Error('User not found');
            }

            // Get user's bots
            const botsResponse = await fetch(`/api/bots/user/${user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const botsData = await botsResponse.json();

            if (botsData.success) {
                const bots = botsData.bots || [];
                this.stats.totalBots = bots.length;
                this.stats.activeBots = bots.filter(bot => bot.is_active).length;

                // Calculate total commands
                let totalCommands = 0;
                for (const bot of bots) {
                    const commandsResponse = await fetch(`/api/commands/bot/${bot.token}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    const commandsData = await commandsResponse.json();
                    if (commandsData.success) {
                        totalCommands += (commandsData.commands || []).length;
                    }
                }
                
                this.stats.totalCommands = totalCommands;
                this.stats.todayMessages = Math.floor(Math.random() * 100) + 50; // Mock data

                this.updateStatsDisplay();
            } else {
                throw new Error('Failed to load bots');
            }
        } catch (error) {
            console.error('❌ Load stats error:', error);
            // Set mock data for demo
            this.stats = {
                totalBots: 3,
                activeBots: 2,
                totalCommands: 15,
                todayMessages: 127
            };
            this.updateStatsDisplay();
        }
    }

    async loadBots() {
        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));
            
            const response = await fetch(`/api/bots/user/${user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.bots = data.bots || [];
                this.displayBots();
            } else {
                throw new Error(data.error || 'Failed to load bots');
            }
        } catch (error) {
            console.error('❌ Load bots error:', error);
            // Display mock bots for demo
            this.bots = [
                {
                    id: 1,
                    name: 'Welcome Bot',
                    username: 'welcome_test_bot',
                    is_active: true,
                    commands_count: 5
                },
                {
                    id: 2,
                    name: 'Support Bot',
                    username: 'support_helper_bot',
                    is_active: true,
                    commands_count: 8
                },
                {
                    id: 3,
                    name: 'News Bot',
                    username: 'news_alert_bot',
                    is_active: false,
                    commands_count: 2
                }
            ];
            this.displayBots();
        }
    }

    async loadRecentActivity() {
        try {
            // Mock activity data - in real app, fetch from API
            this.activities = [
                {
                    id: 1,
                    type: 'success',
                    message: 'New command created in Welcome Bot',
                    time: '2 minutes ago',
                    icon: 'fas fa-code'
                },
                {
                    id: 2,
                    type: 'info',
                    message: 'Support Bot received 15 new messages',
                    time: '1 hour ago',
                    icon: 'fas fa-comment'
                },
                {
                    id: 3,
                    type: 'warning',
                    message: 'News Bot connection test failed',
                    time: '3 hours ago',
                    icon: 'fas fa-exclamation-triangle'
                },
                {
                    id: 4,
                    type: 'success',
                    message: 'Welcome Bot activated successfully',
                    time: '5 hours ago',
                    icon: 'fas fa-play'
                },
                {
                    id: 5,
                    type: 'info',
                    message: 'New user registered to Support Bot',
                    time: '1 day ago',
                    icon: 'fas fa-user-plus'
                }
            ];

            this.displayRecentActivity();
        } catch (error) {
            console.error('❌ Load activity error:', error);
            this.activities = [];
            this.displayRecentActivity();
        }
    }

    updateStatsDisplay() {
        document.getElementById('totalBots').textContent = this.stats.totalBots;
        document.getElementById('activeBots').textContent = this.stats.activeBots;
        document.getElementById('totalCommands').textContent = this.stats.totalCommands;
        document.getElementById('todayMessages').textContent = this.stats.todayMessages;
    }

    displayBots() {
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

        const html = this.bots.slice(0, 5).map(bot => `
            <div class="bot-item">
                <div class="bot-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="bot-info">
                    <div class="bot-name">${this.escapeHtml(bot.name)}</div>
                    <div class="bot-username">@${this.escapeHtml(bot.username)}</div>
                    <div class="bot-meta">
                        <span>${bot.commands_count || 0} commands</span>
                        <span>•</span>
                        <span>Added ${this.formatDate(bot.created_at)}</span>
                    </div>
                </div>
                <div class="bot-status ${bot.is_active ? 'active' : 'inactive'}">
                    ${bot.is_active ? 'Active' : 'Inactive'}
                </div>
            </div>
        `).join('');

        botsList.innerHTML = html;
    }

    displayRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        
        if (!this.activities || this.activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <h3>No Activity Yet</h3>
                    <p>Activity will appear here as you use your bots</p>
                </div>
            `;
            return;
        }

        const html = this.activities.slice(0, 8).map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <p>${this.escapeHtml(activity.message)}</p>
                    <div class="activity-time">${activity.time}</div>
                </div>
            </div>
        `).join('');

        activityList.innerHTML = html;
    }

    async testAllBots() {
        this.showLoading(true);
        
        try {
            const token = localStorage.getItem('token');
            const user = JSON.parse(localStorage.getItem('user'));
            
            const response = await fetch(`/api/bots/user/${user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                const bots = data.bots || [];
                let successCount = 0;
                let totalCount = bots.length;

                // Test each bot
                for (const bot of bots) {
                    try {
                        const testResponse = await fetch(`/api/bots/${bot.id}/test`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        if (testResponse.ok) {
                            successCount++;
                        }
                    } catch (error) {
                        console.error(`❌ Test failed for bot ${bot.name}:`, error);
                    }
                }

                this.showSuccess(`Test completed: ${successCount}/${totalCount} bots are working properly`);
            } else {
                throw new Error('Failed to load bots for testing');
            }
        } catch (error) {
            console.error('❌ Test all bots error:', error);
            this.showError('Failed to test bots: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    updateUserInfo() {
        const userData = localStorage.getItem('user');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                const userName = document.getElementById('userName');
                const userEmail = document.getElementById('userEmail');
                const userAvatar = document.getElementById('userAvatar');

                if (userName) userName.textContent = user.email.split('@')[0];
                if (userEmail) userEmail.textContent = user.email;
                if (userAvatar) userAvatar.textContent = user.email.charAt(0).toUpperCase();
            } catch (error) {
                console.error('Error parsing user data:', error);
            }
        }
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

    logout() {
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

    formatDate(dateString) {
        if (!dateString) return 'recently';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) return 'today';
        if (diffDays === 2) return 'yesterday';
        if (diffDays < 7) return `${diffDays - 1} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        
        return date.toLocaleDateString();
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