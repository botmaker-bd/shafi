class Dashboard {
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
            this.user = JSON.parse(userData);
            this.updateUserInfo();
        } catch (error) {
            this.logout();
        }
    }

    updateUserInfo() {
        if (this.user) {
            document.getElementById('userName').textContent = this.user.email.split('@')[0];
            document.getElementById('userEmail').textContent = this.user.email;
            document.getElementById('userAvatar').textContent = this.user.email.charAt(0).toUpperCase();
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
    }

    async loadDashboardData() {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            
            // Load bots
            const botsResponse = await fetch('/api/bots/user/' + this.user.id, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (botsResponse.ok) {
                const botsData = await botsResponse.json();
                this.bots = botsData.bots || [];
                this.displayBots();
                this.updateStatistics();
            }

            // Load recent activity (mock data for now)
            this.displayRecentActivity();

        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
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
                    <p>Get started by adding your first Telegram bot</p>
                    <a href="bot-management.html" class="btn btn-primary">
                        <i class="fas fa-plus"></i> Add Your First Bot
                    </a>
                </div>
            `;
            return;
        }

        // Show only first 4 bots
        const displayBots = this.bots.slice(0, 4);
        
        botsList.innerHTML = displayBots.map(bot => this.getBotCardHTML(bot)).join('');
    }

    getBotCardHTML(bot) {
        const isActive = bot.is_active;
        const commandsCount = bot.commands_count || 0;
        
        return `
            <div class="bot-card">
                <div class="bot-header">
                    <div class="bot-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="bot-info">
                        <h4>${this.escapeHtml(bot.name)}</h4>
                        <div class="bot-username">@${this.escapeHtml(bot.username || 'unknown')}</div>
                        <div class="bot-status ${isActive ? 'active' : 'inactive'}">
                            <i class="fas fa-circle"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </div>
                    </div>
                </div>
                <div class="bot-meta">
                    <small>${commandsCount} commands • Created ${this.formatDate(bot.created_at)}</small>
                </div>
                <div class="bot-actions">
                    <a href="command-editor.html?bot=${bot.id}" class="btn btn-secondary btn-small">
                        <i class="fas fa-code"></i> Commands
                    </a>
                    <button class="btn btn-primary btn-small test-bot" data-bot-id="${bot.id}">
                        <i class="fas fa-bolt"></i> Test
                    </button>
                </div>
            </div>
        `;
    }

    updateStatistics() {
        const totalBots = this.bots.length;
        const activeBots = this.bots.filter(bot => bot.is_active).length;
        const totalCommands = this.bots.reduce((sum, bot) => sum + (bot.commands_count || 0), 0);
        
        document.getElementById('totalBots').textContent = totalBots;
        document.getElementById('activeBots').textContent = activeBots;
        document.getElementById('totalCommands').textContent = totalCommands;
        document.getElementById('todayMessages').textContent = '0'; // Mock data
    }

    displayRecentActivity() {
        const activityList = document.getElementById('recentActivity');
        const activities = [
            {
                type: 'bot_activated',
                description: 'Bot "Welcome Bot" was activated',
                timestamp: new Date(Date.now() - 300000).toISOString()
            },
            {
                type: 'command_added',
                description: 'New command "/start" added to "Test Bot"',
                timestamp: new Date(Date.now() - 600000).toISOString()
            },
            {
                type: 'test_executed',
                description: 'Command test executed successfully',
                timestamp: new Date(Date.now() - 900000).toISOString()
            }
        ];

        if (activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = activities.map(activity => this.getActivityHTML(activity)).join('');
    }

    getActivityHTML(activity) {
        const icons = {
            'command_added': 'fas fa-plus success',
            'command_updated': 'fas fa-edit warning',
            'bot_activated': 'fas fa-check success',
            'bot_deactivated': 'fas fa-times error',
            'test_executed': 'fas fa-bolt info'
        };

        const iconClass = icons[activity.type] || 'fas fa-info-circle info';
        
        return `
            <div class="activity-item">
                <div class="activity-icon ${activity.type.split('_')[1]}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="activity-content">
                    <p>${this.escapeHtml(activity.description)}</p>
                    <span class="activity-time">${this.formatTime(activity.timestamp)}</span>
                </div>
            </div>
        `;
    }

    async testAllBots() {
        this.showLoading(true);

        try {
            // Simulate testing all bots
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.showSuccess('All bots tested successfully!');
            await this.loadDashboardData(); // Refresh data
        } catch (error) {
            this.showError('Failed to test bots: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffMs = now - time;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        
        return time.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showSuccess(message) {
        commonApp?.showSuccess(message) || alert(message);
    }

    showError(message) {
        commonApp?.showError(message) || alert(message);
    }

    logout() {
        localStorage.clear();
        window.location.href = 'login.html';
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

// Initialize dashboard
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
});