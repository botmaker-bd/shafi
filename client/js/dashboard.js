// Dashboard functionality - Complete version
class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.userStats = {
            totalBots: 0,
            activeCommands: 0,
            totalUsers: 0,
            activeBots: 0
        };
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        await this.loadUserData();
        await this.loadDashboardData();
        this.setupEventListeners();
        this.initializeCharts();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            window.location.href = 'login.html';
            return;
        }

        try {
            // Verify token is still valid
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Invalid token');
            }

            this.currentUser = JSON.parse(user);
            
        } catch (error) {
            console.error('Authentication check failed:', error);
            this.logout();
        }
    }

    async loadUserData() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.displayUserInfo(data.user);
            }
        } catch (error) {
            console.error('Load user data error:', error);
        }
    }

    displayUserInfo(user) {
        // Display user name
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = user.email.split('@')[0];
        }

        // Display last login if available
        if (user.last_login) {
            const lastLoginElement = document.getElementById('lastLogin');
            if (lastLoginElement) {
                const lastLogin = new Date(user.last_login);
                lastLoginElement.textContent = `Last login: ${lastLogin.toLocaleString()}`;
            }
        }
    }

    async loadDashboardData() {
        try {
            const token = localStorage.getItem('token');
            
            // Fetch user's bots
            const botsResponse = await fetch(`/api/bots/user/${this.currentUser.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (botsResponse.ok) {
                const botsData = await botsResponse.json();
                this.displayBots(botsData.bots);
                this.updateStats(botsData.bots);
                this.updateCharts(botsData.bots);
            }

            // Fetch recent activity
            await this.loadRecentActivity();

        } catch (error) {
            console.error('Load dashboard data error:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    displayBots(bots) {
        const botsList = document.getElementById('botsList');
        const recentBotsContainer = document.getElementById('recentBots');
        
        if (!bots || bots.length === 0) {
            const emptyHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🤖</div>
                    <h3>No bots yet</h3>
                    <p>Get started by adding your first Telegram bot</p>
                    <a href="bot-management.html" class="btn btn-primary">Add Your First Bot</a>
                </div>
            `;
            
            if (botsList) botsList.innerHTML = emptyHTML;
            if (recentBotsContainer) recentBotsContainer.innerHTML = emptyHTML;
            return;
        }

        // Display in recent bots section (limited to 4)
        const recentBots = bots.slice(0, 4);
        if (recentBotsContainer) {
            recentBotsContainer.innerHTML = recentBots.map(bot => this.createBotCard(bot)).join('');
        }

        // Display in bots list (full list)
        if (botsList) {
            botsList.innerHTML = bots.map(bot => this.createBotCard(bot)).join('');
        }
    }

    createBotCard(bot) {
        const statusClass = bot.is_active ? 'active' : 'inactive';
        const statusIcon = bot.is_active ? '🟢' : '🔴';
        const statusText = bot.is_active ? 'Active' : 'Inactive';
        const createdDate = new Date(bot.created_at).toLocaleDateString();
        
        return `
            <div class="bot-card" data-bot-id="${bot.id}">
                <div class="bot-info">
                    <div class="bot-avatar">🤖</div>
                    <div class="bot-details">
                        <h4>${bot.name}</h4>
                        <p class="bot-username">@${bot.username}</p>
                        <div class="bot-meta">
                            <span class="bot-status ${statusClass}">
                                ${statusIcon} ${statusText}
                            </span>
                            <span class="bot-added">Added: ${createdDate}</span>
                        </div>
                    </div>
                </div>
                <div class="bot-actions">
                    <a href="command-editor.html?bot=${bot.id}" class="btn btn-primary">
                        <span class="btn-icon">✏️</span>
                        Manage Commands
                    </a>
                    <button onclick="dashboard.testBot('${bot.token}')" class="btn btn-success">
                        <span class="btn-icon">🧪</span>
                        Test Bot
                    </button>
                    <button onclick="dashboard.removeBot('${bot.id}')" class="btn btn-danger">
                        <span class="btn-icon">🗑️</span>
                        Remove
                    </button>
                </div>
            </div>
        `;
    }

    updateStats(bots) {
        this.userStats.totalBots = bots?.length || 0;
        this.userStats.activeBots = bots?.filter(bot => bot.is_active).length || 0;
        
        // Update DOM elements
        document.getElementById('totalBots').textContent = this.userStats.totalBots;
        document.getElementById('activeBots').textContent = this.userStats.activeBots;
        document.getElementById('activeCommands').textContent = this.userStats.activeCommands;
        document.getElementById('totalUsers').textContent = this.userStats.totalUsers;

        // Update progress bars
        this.updateProgressBars();
    }

    updateProgressBars() {
        const progressBars = document.querySelectorAll('.progress-bar');
        progressBars.forEach(bar => {
            const statType = bar.getAttribute('data-stat');
            const value = this.userStats[statType] || 0;
            const max = statType === 'totalBots' ? 10 : 100; // Example max values
            
            const percentage = Math.min((value / max) * 100, 100);
            bar.style.width = `${percentage}%`;
            bar.setAttribute('title', `${value}/${max}`);
        });
    }

    initializeCharts() {
        // Initialize any charts here
        // This is a placeholder for chart initialization
        console.log('Charts initialized');
    }

    updateCharts(bots) {
        // Update charts with bot data
        // This is a placeholder for chart updates
        console.log('Charts updated with bot data');
    }

    async loadRecentActivity() {
        try {
            // Simulate loading recent activity
            const activity = [
                { type: 'bot_added', message: 'Added new bot "Weather Bot"', time: '2 hours ago' },
                { type: 'command_created', message: 'Created command /start', time: '5 hours ago' },
                { type: 'bot_updated', message: 'Updated bot settings', time: '1 day ago' }
            ];

            this.displayRecentActivity(activity);
        } catch (error) {
            console.error('Load recent activity error:', error);
        }
    }

    displayRecentActivity(activity) {
        const activityContainer = document.getElementById('recentActivity');
        if (!activityContainer) return;

        if (!activity || activity.length === 0) {
            activityContainer.innerHTML = `
                <div class="empty-activity">
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        activityContainer.innerHTML = activity.map(item => `
            <div class="activity-item ${item.type}">
                <div class="activity-icon">
                    ${this.getActivityIcon(item.type)}
                </div>
                <div class="activity-content">
                    <p class="activity-message">${item.message}</p>
                    <span class="activity-time">${item.time}</span>
                </div>
            </div>
        `).join('');
    }

    getActivityIcon(type) {
        const icons = {
            'bot_added': '🤖',
            'command_created': '⚡',
            'bot_updated': '🔧',
            'default': '📝'
        };
        return icons[type] || icons.default;
    }

    async testBot(botToken) {
        try {
            this.showLoading('Testing bot...');
            
            const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
            const data = await response.json();
            
            if (data.ok) {
                this.showSuccess(
                    'Bot Test Successful', 
                    `✅ Your bot "${data.result.first_name}" (@${data.result.username}) is working properly!`
                );
            } else {
                this.showError(
                    'Bot Test Failed',
                    '❌ Bot token is invalid or bot is not accessible. Please check your token.'
                );
            }
        } catch (error) {
            console.error('Test bot error:', error);
            this.showError(
                'Bot Test Failed',
                '❌ Failed to test bot. Please check your internet connection and token.'
            );
        } finally {
            this.hideLoading();
        }
    }

    async removeBot(botId) {
        if (!confirm('Are you sure you want to remove this bot? This will delete all associated commands and cannot be undone.')) {
            return;
        }

        try {
            this.showLoading('Removing bot...');
            
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/${botId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showSuccess('Bot Removed', 'Bot removed successfully');
                await this.loadDashboardData();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to remove bot');
            }
        } catch (error) {
            console.error('Remove bot error:', error);
            this.showError('Remove Failed', error.message || 'Failed to remove bot');
        } finally {
            this.hideLoading();
        }
    }

    setupEventListeners() {
        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // Refresh dashboard button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshDashboard();
            });
        }

        // Quick action cards
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                const action = card.getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });

        // Search functionality
        const searchInput = document.getElementById('searchBots');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchBots(e.target.value);
            });
        }
    }

    async refreshDashboard() {
        this.showLoading('Refreshing dashboard...');
        await this.loadDashboardData();
        this.hideLoading();
        this.showSuccess('Dashboard Updated', 'Dashboard data refreshed successfully');
    }

    handleQuickAction(action) {
        const actions = {
            'add-bot': () => window.location.href = 'bot-management.html',
            'manage-bots': () => window.location.href = 'bot-management.html',
            'analytics': () => this.showFeatureComingSoon('Analytics'),
            'templates': () => this.showFeatureComingSoon('Templates'),
            'settings': () => this.showFeatureComingSoon('Settings'),
            'help': () => this.showFeatureComingSoon('Help Center')
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    showFeatureComingSoon(featureName) {
        this.showInfo(
            'Feature Coming Soon',
            `${featureName} feature is under development and will be available soon!`
        );
    }

    searchBots(query) {
        const botCards = document.querySelectorAll('.bot-card');
        const searchTerm = query.toLowerCase().trim();

        botCards.forEach(card => {
            const botName = card.querySelector('h4').textContent.toLowerCase();
            const botUsername = card.querySelector('.bot-username').textContent.toLowerCase();
            
            if (botName.includes(searchTerm) || botUsername.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Utility methods for notifications
    showLoading(message = 'Loading...') {
        // Create or show loading indicator
        let loadingEl = document.getElementById('loadingIndicator');
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'loadingIndicator';
            loadingEl.className = 'loading-indicator';
            loadingEl.innerHTML = `
                <div class="loading-spinner"></div>
                <span>${message}</span>
            `;
            document.body.appendChild(loadingEl);
        }
        loadingEl.style.display = 'flex';
    }

    hideLoading() {
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    showSuccess(title, message) {
        this.showNotification(title, message, 'success');
    }

    showError(title, message) {
        this.showNotification(title, message, 'error');
    }

    showInfo(title, message) {
        this.showNotification(title, message, 'info');
    }

    showNotification(title, message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-header">
                <strong>${title}</strong>
                <button class="notification-close">&times;</button>
            </div>
            <div class="notification-body">${message}</div>
        `;

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        document.body.appendChild(notification);

        // Add show class after a delay for animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberLogin');
        window.location.href = 'index.html';
    }
}

// Initialize dashboard when DOM is loaded
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DashboardManager();
});

// Global access for HTML onclick handlers
window.dashboard = dashboard;