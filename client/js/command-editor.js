class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupTheme();
        this.setupMobileMenu();
        this.setupEventListeners();
        await this.loadCommands();
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

    async loadBotInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const botId = urlParams.get('bot');

        if (!botId) {
            this.showNotification('No bot specified', 'error');
            window.location.href = 'bot-management.html';
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/${botId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.currentBot = data.bot;
                this.updateBotInfo();
            } else {
                this.showNotification('Bot not found', 'error');
                window.location.href = 'bot-management.html';
            }
        } catch (error) {
            this.showNotification('Failed to load bot info', 'error');
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            document.getElementById('botName').textContent = `Commands - ${this.currentBot.name}`;
            document.getElementById('botUsername').textContent = `@${this.currentBot.username}`;
            document.title = `Commands - ${this.currentBot.name} - Bot Maker Pro`;
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backToBots').addEventListener('click', () => {
            window.location.href = 'bot-management.html';
        });

        document.getElementById('refreshCommands').addEventListener('click', () => {
            this.loadCommands();
        });

        // Command actions
        document.getElementById('addCommandBtn').addEventListener('click', () => {
            this.addNewCommand();
        });

        document.getElementById('createFirstCommand').addEventListener('click', () => {
            this.addNewCommand();
        });

        document.getElementById('addFirstCommand').addEventListener('click', () => {
            this.addNewCommand();
        });

        document.getElementById('saveCommandBtn').addEventListener('click', () => {
            this.saveCommand();
        });

        document.getElementById('deleteCommandBtn').addEventListener('click', () => {
            this.deleteCommand();
        });

        document.getElementById('testCommandBtn').addEventListener('click', () => {
            this.testCommand();
        });

        // Form interactions
        document.getElementById('waitForAnswer').addEventListener('change', (e) => {
            this.toggleAnswerHandler(e.target.checked);
        });

        // Code templates
        document.querySelectorAll('.template-card').forEach(card => {
            card.addEventListener('click', () => {
                const template = card.dataset.template;
                this.insertTemplate(template);
            });
        });

        // Code formatting
        document.getElementById('formatCode').addEventListener('click', () => {
            this.formatCode();
        });

        document.getElementById('insertTemplate').addEventListener('click', () => {
            this.showTemplateSelector();
        });

        // Command search
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            this.filterCommands(e.target.value);
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Modal events
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
    }

    setupModalEvents() {
        const modal = document.getElementById('testCommandModal');
        const closeBtn = document.getElementById('closeTestCommand');
        const modalClose = document.querySelector('.modal-close');

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

    async loadCommands() {
        if (!this.currentBot) return;

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/bot/${this.currentBot.token}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.commands = data.commands || [];
                this.displayCommands();
            } else {
                this.showNotification('Failed to load commands', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while loading commands', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayCommands() {
        const commandsList = document.getElementById('commandsList');
        const emptyCommands = document.getElementById('emptyCommands');

        if (!this.commands || this.commands.length === 0) {
            commandsList.style.display = 'none';
            emptyCommands.style.display = 'block';
            return;
        }

        commandsList.style.display = 'block';
        emptyCommands.style.display = 'none';

        commandsList.innerHTML = this.commands.map(command => this.getCommandItemHTML(command)).join('');
    }

    getCommandItemHTML(command) {
        const isActive = command.is_active;
        const hasAnswerHandler = command.wait_for_answer && command.answer_handler;
        
        return `
            <div class="command-item ${this.currentCommand?.id === command.id ? 'active' : ''}" 
                 onclick="commandEditor.selectCommand('${command.id}')">
                <div class="command-header">
                    <h4>${this.escapeHtml(command.name)}</h4>
                    <span class="command-pattern">${this.escapeHtml(command.pattern)}</span>
                </div>
                <p class="command-desc">${this.escapeHtml(command.description || 'No description')}</p>
                <div class="command-meta">
                    <span class="command-status ${isActive ? 'active' : 'inactive'}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                    ${hasAnswerHandler ? '<span class="command-feature">⏳ Waits</span>' : ''}
                </div>
            </div>
        `;
    }

    filterCommands(searchTerm) {
        const commandItems = document.querySelectorAll('.command-item');
        const lowerSearch = searchTerm.toLowerCase();

        commandItems.forEach(item => {
            const commandName = item.querySelector('h4').textContent.toLowerCase();
            const commandPattern = item.querySelector('.command-pattern').textContent.toLowerCase();
            const isVisible = commandName.includes(lowerSearch) || commandPattern.includes(lowerSearch);
            
            item.style.display = isVisible ? 'block' : 'none';
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            name: 'New Command',
            pattern: '/start',
            description: '',
            code: this.getDefaultTemplate('welcome'),
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
    }

    async selectCommand(commandId) {
        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/${commandId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                this.currentCommand = data.command;
                this.showCommandEditor();
                this.populateCommandForm();
                
                // Update active state in list
                document.querySelectorAll('.command-item').forEach(item => {
                    item.classList.remove('active');
                });
                document.querySelector(`.command-item[onclick*="${commandId}"]`)?.classList.add('active');
            } else {
                this.showNotification('Failed to load command', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while loading command', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showCommandEditor() {
        document.getElementById('noCommandSelected').style.display = 'none';
        document.getElementById('commandEditor').style.display = 'block';
    }

    hideCommandEditor() {
        document.getElementById('noCommandSelected').style.display = 'block';
        document.getElementById('commandEditor').style.display = 'none';
        this.currentCommand = null;
    }

    populateCommandForm() {
        if (!this.currentCommand) return;

        const form = document.getElementById('commandForm');
        
        // Basic fields
        document.getElementById('commandName').value = this.currentCommand.name;
        document.getElementById('commandPattern').value = this.currentCommand.pattern;
        document.getElementById('commandDescription').value = this.currentCommand.description || '';
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        // Wait for answer
        const waitCheckbox = document.getElementById('waitForAnswer');
        waitCheckbox.checked = this.currentCommand.wait_for_answer || false;
        this.toggleAnswerHandler(waitCheckbox.checked);
        
        // Answer handler
        if (this.currentCommand.answer_handler) {
            document.getElementById('answerHandler').value = this.currentCommand.answer_handler;
        }
        
        // Update UI
        document.getElementById('currentCommandName').textContent = this.currentCommand.name;
        document.getElementById('commandStatus').textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
        document.getElementById('commandStatus').className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        section.style.display = show ? 'block' : 'none';
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showNotification('No command selected', 'error');
            return;
        }

        const formData = {
            name: document.getElementById('commandName').value.trim(),
            pattern: document.getElementById('commandPattern').value.trim(),
            description: document.getElementById('commandDescription').value.trim(),
            code: document.getElementById('commandCode').value.trim(),
            waitForAnswer: document.getElementById('waitForAnswer').checked,
            answerHandler: document.getElementById('waitForAnswer').checked ? 
                          document.getElementById('answerHandler').value.trim() : '',
            botToken: this.currentBot.token
        };

        // Validation
        if (!formData.name || !formData.pattern || !formData.code) {
            this.showNotification('Name, pattern and code are required', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            let response;

            if (this.currentCommand.id === 'new') {
                response = await fetch('/api/commands', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });
            } else {
                response = await fetch(`/api/commands/${this.currentCommand.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });
            }

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Command saved successfully!', 'success');
                await this.loadCommands();
                
                // Select the saved command
                if (data.command) {
                    this.currentCommand = data.command;
                    this.populateCommandForm();
                }
            } else {
                this.showNotification(data.error || 'Failed to save command', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while saving command', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            return;
        }

        if (!confirm('Are you sure you want to delete this command? This action cannot be undone.')) {
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/${this.currentCommand.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showNotification('Command deleted successfully', 'success');
                this.hideCommandEditor();
                await this.loadCommands();
            } else {
                const data = await response.json();
                this.showNotification(data.error || 'Failed to delete command', 'error');
            }
        } catch (error) {
            this.showNotification('Network error while deleting command', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async testCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            this.showNotification('Please save the command before testing', 'error');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/${this.currentCommand.id}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    botToken: this.currentBot.token
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showTestResult(`
                    <div class="test-success">
                        <h4>✅ Test Command Sent</h4>
                        <p>Command execution test has been sent to your admin Telegram account.</p>
                        <p>Check your bot for the test results.</p>
                    </div>
                `);
            } else {
                this.showTestResult(`
                    <div class="test-error">
                        <h4>❌ Test Failed</h4>
                        <p>${data.error || 'Failed to execute test command'}</p>
                    </div>
                `);
            }
        } catch (error) {
            this.showTestResult(`
                <div class="test-error">
                    <h4>❌ Test Failed</h4>
                    <p>Network error: ${error.message}</p>
                </div>
            `);
        } finally {
            this.showLoading(false);
        }
    }

    showTestResult(html) {
        const modal = document.getElementById('testCommandModal');
        const resultDiv = document.getElementById('testCommandResult');
        
        resultDiv.innerHTML = html;
        modal.style.display = 'flex';
    }

    insertTemplate(templateName) {
        const template = this.getDefaultTemplate(templateName);
        document.getElementById('commandCode').value = template;
        this.showNotification(`"${templateName}" template inserted`, 'success');
    }

    getDefaultTemplate(templateName) {
        const templates = {
            welcome: `// Welcome command template
const user = getUser();
const welcomeMessage = \`
👋 Hello \${user.first_name}!

Welcome to our bot! I'm here to help you with various tasks.

🤖 *Bot Features:*
• Command responses
• User interactions
• Custom workflows

Type /help to see all available commands.

Thank you for using our bot! 😊
\`;

return sendMessage(welcomeMessage);`,

            echo: `// Echo command - repeats user's message
const message = getMessage();
const text = message.text;

// Remove command part
const echoText = text.replace('/echo', '').trim();

if (!echoText) {
    return sendMessage('Please provide some text after /echo command.\\nExample: /echo Hello World!');
}

return sendMessage(\`🔊 Echo: \${echoText}\`);`,

            buttons: `// Message with inline buttons
const keyboard = {
    inline_keyboard: [
        [
            { text: '✅ Button 1', callback_data: 'btn1' },
            { text: '🔘 Button 2', callback_data: 'btn2' }
        ],
        [
            { text: '🌐 Website', url: 'https://example.com' }
        ]
    ]
};

return sendMessage('Please choose an option:', {
    reply_markup: keyboard
});`,

            wait: `// Command that waits for user answer
const user = getUser();

// Send initial message
await sendMessage(\`Hello \${user.first_name}! Please tell me your favorite color:\`);

// The bot will now wait for user's response
// The answer handler will process the response

// Answer handler code (will be executed when user responds):
/*
const answer = getAnswer();
const user = getUser();

return sendMessage(\`🎨 Great choice! \${answer} is a beautiful color, \${user.first_name}!\`);
*/`
        };

        return templates[templateName] || templates.welcome;
    }

    formatCode() {
        const codeTextarea = document.getElementById('commandCode');
        const code = codeTextarea.value;
        
        try {
            // Simple formatting - indent lines properly
            const formatted = code
                .split('\n')
                .map(line => {
                    const trimmed = line.trim();
                    if (trimmed === '') return '';
                    // Add proper indentation based on code structure
                    if (trimmed.endsWith('{') || trimmed.startsWith('}') || trimmed.endsWith(')')) {
                        return '    ' + trimmed;
                    }
                    return '        ' + trimmed;
                })
                .join('\n');
            
            codeTextarea.value = formatted;
            this.showNotification('Code formatted', 'success');
        } catch (error) {
            this.showNotification('Formatting failed', 'error');
        }
    }

    showTemplateSelector() {
        const templates = ['welcome', 'echo', 'buttons', 'wait'];
        let templateHTML = '<div class="template-selector"><h4>Select Template</h4><div class="template-buttons">';
        
        templates.forEach(tpl => {
            templateHTML += `<button class="btn btn-secondary btn-small" onclick="commandEditor.insertTemplate('${tpl}')">${tpl}</button>`;
        });
        
        templateHTML += '</div></div>';
        
        this.showNotification(templateHTML, 'info');
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
        
        if (type === 'info' && message.includes('<div')) {
            // For template selector
            notification.innerHTML = message;
        } else {
            notification.innerHTML = `
                <div class="notification-content">
                    <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                    <span class="notification-message">${message}</span>
                    <button class="notification-close">&times;</button>
                </div>
            `;
        }

        document.body.appendChild(notification);

        // Auto remove after 5 seconds (except for template selector)
        if (!message.includes('template-selector')) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }

        // Close button
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                notification.remove();
            });
        }
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

// Initialize command editor
let commandEditor;
document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
});