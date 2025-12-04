class BotManager {
    constructor() {
        this.user = null;
        this.bots = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        await this.loadBots();
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
        // Add bot form
        document.getElementById('addBotBtn').addEventListener('click', () => {
            this.toggleAddBotSection();
        });

        document.getElementById('addFirstBot').addEventListener('click', () => {
            this.toggleAddBotSection();
        });

        document.getElementById('addBotForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewBot();
        });

        document.getElementById('testToken').addEventListener('click', () => {
            this.testBotToken();
        });

        document.getElementById('cancelAddBot').addEventListener('click', () => {
            this.toggleAddBotSection(false);
        });

        document.getElementById('refreshBots').addEventListener('click', () => {
            this.loadBots();
        });

        this.setupModalEvents();
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

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });
    }

    setupModalEvents() {
        const modal = document.getElementById('testTokenModal');
        const closeBtn = document.getElementById('closeTestModal');
        const modalClose = document.querySelector('#testTokenModal .modal-close');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        if (modalClose) {
            modalClose.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    toggleAddBotSection(show = true) {
        const section = document.getElementById('addBotSection');
        section.style.display = show ? 'block' : 'none';
        
        if (show) {
            section.scrollIntoView({ behavior: 'smooth' });
        }
    }

    async loadBots() {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/user/${this.user.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.bots = data.bots || [];
                this.displayBots();
                this.updateStats();
            } else {
                this.showError('Failed to load bots');
            }
        } catch (error) {
            this.showError('Network error while loading bots');
        } finally {
            this.showLoading(false);
        }
    }

    displayBots() {
        const container = document.getElementById('botsContainer');
        const emptyState = document.getElementById('emptyState');

        if (!this.bots || this.bots.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        container.innerHTML = this.bots.map(bot => this.getBotHTML(bot)).join('');
    }

    getBotHTML(bot) {
        const webhookStatus = bot.webhook_url ? '✅ Connected' : '❌ Disconnected';
        
        return `
            <div class="bot-card">
                <div class="bot-header">
                    <div class="bot-avatar">
                        <i class="fas fa-robot"></i>
                    </div>
                    <div class="bot-info">
                        <h4>${this.escapeHtml(bot.name)}</h4>
                        <p class="bot-username">@${this.escapeHtml(bot.username || 'unknown')}</p>
        <div class="bot-details">
            <span class="bot-status ${bot.is_active ? 'active' : 'inactive'}">
                <i class="fas fa-circle"></i>
                ${bot.is_active ? 'Active' : 'Inactive'}
            </span>
            <span class="webhook-status ${bot.webhook_url ? 'connected' : 'disconnected'}">
                <i class="fas fa-${bot.webhook_url ? 'link' : 'unlink'}"></i>
                ${bot.webhook_url ? 'Webhook Set' : 'Polling'}
            </span>
        </div>
                        <p class="bot-token">
                            <small>Token: ${this.maskToken(bot.token)}</small>
                        </p>
                    </div>
                </div>
                <div class="bot-actions">
                    <a href="command-editor.html?bot=${bot.id}" class="btn btn-primary btn-small">
                        <i class="fas fa-code"></i> Manage Commands
                    </a>
                    <button onclick="botManager.testBot('${bot.id}')" class="btn btn-success btn-small">
                        <i class="fas fa-bolt"></i> Test
                    </button>
                    <button onclick="botManager.removeBot('${bot.id}')" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
                <div class="bot-meta">
                    <small>Added: ${new Date(bot.created_at).toLocaleDateString()}</small>
                </div>
            </div>
        `;
    }

    updateStats() {
        const totalBots = this.bots.length;
        const activeBots = this.bots.filter(bot => bot.is_active).length;
        const totalCommands = this.bots.reduce((sum, bot) => sum + (bot.commands_count || 0), 0);
        const webhookStatus = this.bots.every(bot => bot.webhook_url) ? 'All Connected' : 'Some Issues';

        document.getElementById('totalBotsCount').textContent = totalBots;
        document.getElementById('activeBotsCount').textContent = activeBots;
        document.getElementById('totalCommandsCount').textContent = totalCommands;
        document.getElementById('webhookStatus').textContent = webhookStatus;
    }

    // client/js/bot-management.js - addNewBot ফাংশনে
async addNewBot() {
    const tokenInput = document.getElementById('botToken');
    const nameInput = document.getElementById('botName');
    
    const token = tokenInput.value.trim();
    const name = nameInput.value.trim();

    if (!token) {
        this.showError('Please enter bot token');
        return;
    }

    this.showLoading(true);

    try {
        const userToken = localStorage.getItem('token');
        
        // ✅ FIX: Remove userId from request body, it will come from JWT
        const response = await fetch('/api/bots/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                token,
                name
                // userId is now extracted from JWT token
            })
        });

        const data = await response.json();

        if (response.ok) {
            this.showSuccess('Bot added successfully!');
            tokenInput.value = '';
            nameInput.value = '';
            this.toggleAddBotSection(false);
            await this.loadBots();
            
            // Show webhook info if available
            if (data.webhookUrl) {
                this.showNotification(`Webhook set: ${data.webhookUrl}`, 'success');
            }
        } else {
            this.showError(data.error || 'Failed to add bot');
        }
    } catch (error) {
        console.error('❌ Add bot error:', error);
        this.showError('Network error while adding bot');
    } finally {
        this.showLoading(false);
    }
}

    async testBotToken() {
        const tokenInput = document.getElementById('botToken');
        const token = tokenInput.value.trim();

        if (!token) {
            this.showError('Please enter bot token to test');
            return;
        }

        this.showLoading(true);

        try {
            const userToken = localStorage.getItem('token');
            const response = await fetch('/api/bots/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({ token })
            });

            const data = await response.json();

            if (response.ok) {
                this.showTestResult(`
                    <div class="test-success">
                        <h4>✅ Token Valid</h4>
                        <p><strong>Bot Name:</strong> ${data.botInfo.name}</p>
                        <p><strong>Username:</strong> @${data.botInfo.username}</p>
                        <p><strong>ID:</strong> ${data.botInfo.id}</p>
                    </div>
                `);
            } else {
                this.showTestResult(`
                    <div class="test-error">
                        <h4>❌ Invalid Token</h4>
                        <p>Please check your bot token and try again.</p>
                    </div>
                `);
            }
        } catch (error) {
            this.showTestResult(`
                <div class="test-error">
                    <h4>❌ Test Failed</h4>
                    <p>Network error. Please check your connection.</p>
                </div>
            `);
        } finally {
            this.showLoading(false);
        }
    }

    async testBot(botId) {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/${botId}/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess(`Bot connection successful! Name: ${data.botInfo.name}`);
            } else {
                this.showError(data.error || 'Failed to test bot');
            }
        } catch (error) {
            this.showError('Network error while testing bot');
        } finally {
            this.showLoading(false);
        }
    }

    async removeBot(botId) {
        if (!confirm('Are you sure you want to remove this bot? All associated commands will be deleted.')) {
            return;
        }

        this.showLoading(true);

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
                await this.loadBots();
            } else {
                this.showError(data.error || 'Failed to remove bot');
            }
        } catch (error) {
            this.showError('Network error while removing bot');
        } finally {
            this.showLoading(false);
        }
    }

    showTestResult(html) {
        const modal = document.getElementById('testTokenModal');
        const resultDiv = document.getElementById('testResult');
        
        resultDiv.innerHTML = html;
        modal.style.display = 'flex';
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

    maskToken(token) {
        if (!token) return '';
        return token.substring(0, 10) + '...' + token.substring(token.length - 10);
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

let botManager;
document.addEventListener('DOMContentLoaded', () => {
    botManager = new BotManager();
});