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

    async loadBotInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const botId = urlParams.get('bot');

        if (!botId) {
            this.showError('No bot specified');
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
                this.showError('Bot not found');
                window.location.href = 'bot-management.html';
            }
        } catch (error) {
            this.showError('Failed to load bot info');
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            document.getElementById('botName').textContent = `Commands - ${this.currentBot.name}`;
            document.getElementById('botUsername').textContent = `@${this.currentBot.username}`;
        }
    }

    setupEventListeners() {
        console.log('🔄 Setting up event listeners...');
        
        // Navigation
        document.getElementById('backToBots')?.addEventListener('click', () => {
            window.location.href = 'bot-management.html';
        });

        // Command actions - FIXED: Proper event listeners
        document.getElementById('addCommandBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.addNewCommand();
        });

        document.getElementById('createFirstCommand')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.addNewCommand();
        });

        document.getElementById('addFirstCommand')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.addNewCommand();
        });

        // FIXED: Save button with proper form submission
        document.getElementById('saveCommandBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('💾 Save button clicked');
            this.saveCommand();
        });

        // FIXED: Delete button
        document.getElementById('deleteCommandBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteCommand();
        });

        // FIXED: Test button
        document.getElementById('testCommandBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.testCommand();
        });

        // Form interactions
        document.getElementById('waitForAnswer')?.addEventListener('change', (e) => {
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
        document.getElementById('formatCode')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.formatCode();
        });

        document.getElementById('insertTemplate')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showTemplateSelector();
        });

        // Command search
        const searchInput = document.getElementById('commandSearch');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterCommands(e.target.value);
                }, 300);
            });
        }

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        console.log('✅ Event listeners setup complete');
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
                this.showError('Failed to load commands');
            }
        } catch (error) {
            this.showError('Network error while loading commands');
        } finally {
            this.showLoading(false);
        }
    }

    displayCommands() {
        const commandsList = document.getElementById('commandsList');
        const emptyCommands = document.getElementById('emptyCommands');

        if (!this.commands || this.commands.length === 0) {
            if (commandsList) commandsList.style.display = 'none';
            if (emptyCommands) emptyCommands.style.display = 'block';
            return;
        }

        if (commandsList) {
            commandsList.style.display = 'block';
            commandsList.innerHTML = this.commands.map(command => this.getCommandItemHTML(command)).join('');
        }
        if (emptyCommands) emptyCommands.style.display = 'none';
    }

    getCommandItemHTML(command) {
        const isActive = command.is_active;
        
        return `
            <div class="command-item" data-command-id="${command.id}">
                <div class="command-header">
                    <h4>${this.escapeHtml(command.name)}</h4>
                    <span class="command-pattern">${this.escapeHtml(command.pattern)}</span>
                </div>
                <p class="command-desc">${this.escapeHtml(command.description || 'No description')}</p>
                <div class="command-meta">
                    <span class="command-status ${isActive ? 'active' : 'inactive'}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                    ${command.wait_for_answer ? '<span class="command-feature">⏳ Waits</span>' : ''}
                </div>
            </div>
        `;
    }

    // FIXED: Add click event listeners to command items
    attachCommandClickEvents() {
        document.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const commandId = item.dataset.commandId;
                this.selectCommand(commandId);
                
                // Update active state
                document.querySelectorAll('.command-item').forEach(i => {
                    i.classList.remove('active');
                });
                item.classList.add('active');
            });
        });
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
        console.log('➕ Creating new command...');
        
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
        
        // Focus on name field
        setTimeout(() => {
            document.getElementById('commandName')?.focus();
        }, 100);
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
            } else {
                this.showError('Failed to load command');
            }
        } catch (error) {
            this.showError('Network error while loading command');
        } finally {
            this.showLoading(false);
        }
    }

    showCommandEditor() {
        const noSelection = document.getElementById('noCommandSelected');
        const editor = document.getElementById('commandEditor');
        
        if (noSelection) noSelection.style.display = 'none';
        if (editor) editor.style.display = 'block';
    }

    hideCommandEditor() {
        const noSelection = document.getElementById('noCommandSelected');
        const editor = document.getElementById('commandEditor');
        
        if (noSelection) noSelection.style.display = 'block';
        if (editor) editor.style.display = 'none';
        this.currentCommand = null;
    }

    populateCommandForm() {
        if (!this.currentCommand) return;

        // Basic fields
        document.getElementById('commandName').value = this.currentCommand.name;
        document.getElementById('commandPattern').value = this.currentCommand.pattern;
        document.getElementById('commandDescription').value = this.currentCommand.description || '';
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        // Wait for answer
        const waitCheckbox = document.getElementById('waitForAnswer');
        if (waitCheckbox) {
            waitCheckbox.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitCheckbox.checked);
        }
        
        // Answer handler
        if (this.currentCommand.answer_handler) {
            document.getElementById('answerHandler').value = this.currentCommand.answer_handler;
        }
        
        // Update UI
        document.getElementById('currentCommandName').textContent = this.currentCommand.name;
        const statusElement = document.getElementById('commandStatus');
        if (statusElement) {
            statusElement.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            statusElement.className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        }
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        if (section) {
            section.style.display = show ? 'block' : 'none';
        }
    }

    // FIXED: Save command with better validation and feedback
    async saveCommand() {
        console.log('💾 Starting save command process...');
        
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
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

        console.log('📦 Form data:', formData);

        // Validation
        if (!formData.name) {
            this.showError('Command name is required');
            document.getElementById('commandName').focus();
            return;
        }

        if (!formData.pattern) {
            this.showError('Command pattern is required');
            document.getElementById('commandPattern').focus();
            return;
        }

        if (!formData.pattern.startsWith('/')) {
            this.showError('Command pattern should start with /');
            document.getElementById('commandPattern').focus();
            return;
        }

        if (!formData.code) {
            this.showError('Command code is required');
            document.getElementById('commandCode').focus();
            return;
        }

        if (formData.waitForAnswer && !formData.answerHandler) {
            this.showError('Answer handler code is required when "Wait for Answer" is enabled');
            document.getElementById('answerHandler').focus();
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            let response;
            let url;
            let method;

            if (this.currentCommand.id === 'new') {
                method = 'POST';
                url = '/api/commands';
                console.log('🆕 Creating new command...');
            } else {
                method = 'PUT';
                url = `/api/commands/${this.currentCommand.id}`;
                console.log('✏️ Updating existing command...');
            }

            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log('📨 Server response:', data);

            if (response.ok) {
                this.showSuccess('Command saved successfully!');
                await this.loadCommands();
                
                // Re-attach click events after loading commands
                setTimeout(() => {
                    this.attachCommandClickEvents();
                }, 100);
                
            } else {
                this.showError(data.error || 'Failed to save command');
            }
        } catch (error) {
            console.error('❌ Save command error:', error);
            this.showError('Network error while saving command: ' + error.message);
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
                this.showSuccess('Command deleted successfully');
                this.hideCommandEditor();
                await this.loadCommands();
            } else {
                const data = await response.json();
                this.showError(data.error || 'Failed to delete command');
            }
        } catch (error) {
            this.showError('Network error while deleting command');
        } finally {
            this.showLoading(false);
        }
    }

    async testCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            this.showError('Please save the command before testing');
            return;
        }

        if (!this.currentBot) {
            this.showError('Bot information not loaded');
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
                this.showSuccess('Test command sent successfully! Check your Telegram bot.');
            } else {
                this.showError(data.error || 'Failed to execute test command');
            }
        } catch (error) {
            this.showError('Network error while testing command');
        } finally {
            this.showLoading(false);
        }
    }

    insertTemplate(templateName) {
        const template = this.getDefaultTemplate(templateName);
        const codeTextarea = document.getElementById('commandCode');
        if (codeTextarea) {
            codeTextarea.value = template;
            this.showSuccess(`"${templateName}" template inserted`);
        }
    }

    getDefaultTemplate(templateName) {
        const templates = {
            welcome: `// Welcome command template
const user = getUser();
const welcomeMessage = \`
👋 Hello \${user.first_name}!

Welcome to our bot! I'm here to help you with various tasks.

🤖 *Available Commands:*
/start - Show this welcome message
/help - Get help information

Thank you for using our bot! 😊
\`;

return sendMessage(welcomeMessage);`,
            echo: `// Echo command - repeats user's message
const message = getMessage();
const text = message.text;

// Remove command part and get the text to echo
const echoText = text.replace('/echo', '').trim();

if (!echoText) {
    return sendMessage('Please provide some text after /echo command.\\nExample: /echo Hello World!');
}

return sendMessage(\`🔊 Echo: \${echoText}\`);`
        };

        return templates[templateName] || templates.welcome;
    }

    formatCode() {
        const codeTextarea = document.getElementById('commandCode');
        if (!codeTextarea) return;
        
        try {
            const code = codeTextarea.value;
            // Simple formatting logic
            const formatted = code.split('\n').map(line => line.trim()).join('\n');
            codeTextarea.value = formatted;
            this.showSuccess('Code formatted successfully!');
        } catch (error) {
            this.showError('Formatting failed');
        }
    }

    showTemplateSelector() {
        this.showNotification('Select a template from the templates section below', 'info');
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

// FIXED: Initialize command editor with error handling
let commandEditor;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Command Editor...');
    try {
        commandEditor = new CommandEditor();
        
        // Attach click events after a short delay to ensure DOM is ready
        setTimeout(() => {
            if (commandEditor.attachCommandClickEvents) {
                commandEditor.attachCommandClickEvents();
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Failed to initialize Command Editor:', error);
        alert('Failed to load command editor. Please refresh the page.');
    }
});