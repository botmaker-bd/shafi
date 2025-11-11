class EnhancedCommandEditor {
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
        this.setupQuickTemplates();
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
            // Update user avatar with first letter
            const userAvatar = document.querySelector('.user-avatar');
            if (userAvatar) {
                userAvatar.textContent = this.user.email.charAt(0).toUpperCase();
            }
        }
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backToBots').addEventListener('click', () => {
            window.location.href = 'bot-management.html';
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

        // Toggle switches
        this.setupToggleSwitches();

        // Quick templates
        this.setupTemplateEvents();

        // Save button
        document.getElementById('saveCommandBtn').addEventListener('click', (e) => {
            e.preventDefault();
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

        // Command search
        let searchTimeout;
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCommand();
            }
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

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.remove('show');
                }
            });
        }
    }

    setupToggleSwitches() {
        // Setup all toggle switches in the command editor
        const toggles = document.querySelectorAll('.toggle-switch input');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const toggleId = e.target.id;
                
                // Handle different toggle functionalities
                switch (toggleId) {
                    case 'waitForAnswer':
                        this.toggleAnswerHandler(isChecked);
                        break;
                    case 'commandActive':
                        this.toggleCommandStatus(isChecked);
                        break;
                    default:
                        console.log(`Toggle ${toggleId} changed to:`, isChecked);
                }
                
                this.showSuccess(`Setting ${isChecked ? 'enabled' : 'disabled'}`);
            });
        });
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

    setupQuickTemplates() {
        // Predefined quick templates
        this.templates = {
            welcome: {
                name: "Welcome Message",
                pattern: "/start",
                description: "Send a welcome message to new users",
                code: `// Welcome command template
const user = getUser();
const welcomeMessage = \`👋 Hello \${user.first_name}!

Welcome to our bot! I'm here to help you with various tasks.

🤖 *Available Commands:*
/start - Show this welcome message
/help - Get help information

Thank you for using our bot! 😊\`;

return sendMessage(welcomeMessage);`,
                icon: "👋",
                tags: ["welcome", "basic"]
            },
            echo: {
                name: "Echo Command",
                pattern: "/echo",
                description: "Repeat user's message back",
                code: `// Echo command - repeats user's message
const message = getMessage();
const text = message.text;

// Remove command part and get the text to echo
const echoText = text.replace('/echo', '').trim();

if (!echoText) {
    return sendMessage('Please provide some text after /echo command.\\\\nExample: /echo Hello World!');
}

return sendMessage(\`🔊 Echo: \${echoText}\`);`,
                icon: "🔊",
                tags: ["utility", "basic"]
            },
            buttons: {
                name: "Inline Buttons",
                pattern: "/menu",
                description: "Show message with inline keyboard buttons",
                code: `// Message with inline buttons
const keyboard = {
    inline_keyboard: [
        [
            { text: '✅ Option 1', callback_data: 'option_1' },
            { text: '🔘 Option 2', callback_data: 'option_2' }
        ],
        [
            { text: '🌐 Visit Website', url: 'https://example.com' }
        ]
    ]
};

return sendMessage('Please choose an option:', {
    reply_markup: keyboard
});`,
                icon: "🔄",
                tags: ["interactive", "buttons"]
            },
            interactive: {
                name: "Wait for Answer",
                pattern: "/survey",
                description: "Ask question and wait for user response",
                code: `// Command that waits for user answer
const user = getUser();

// Send initial message
await sendMessage(\`Hello \${user.first_name}! Please tell me your favorite color:\`);

// The bot will now wait for user's response
// Answer handler will process the response`,
                answerHandler: `// Handle user's answer
const answer = getAnswer();
const user = getUser();

// Process the answer here
return sendMessage(\`🎨 Great choice! \${answer} is a beautiful color, \${user.first_name}!\`);`,
                icon: "⏳",
                tags: ["interactive", "advanced"],
                waitForAnswer: true
            },
            http: {
                name: "HTTP Request",
                pattern: "/http",
                description: "Make HTTP requests to external APIs",
                code: `// HTTP Request example
try {
    const response = await HTTP.get({
        url: "https://jsonplaceholder.typicode.com/posts/1"
    });
    
    return sendMessage(\`✅ HTTP Request Success! Response: \${JSON.stringify(response)}\`);
} catch (error) {
    return sendMessage(\`❌ Request failed: \${error.message}\`);
}`,
                icon: "🌐",
                tags: ["advanced", "api"]
            },
            media: {
                name: "Send Media",
                pattern: "/media",
                description: "Send photos, documents, and other media",
                code: `// Send media files
const user = getUser();

// Send photo
await sendPhoto("https://via.placeholder.com/150", {
    caption: "This is a sample photo"
});

// Send document
await sendDocument("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", {
    caption: "Sample PDF document"
});

return sendMessage("Media files sent successfully!");`,
                icon: "📷",
                tags: ["media", "advanced"]
            }
        };

        this.renderTemplates();
    }

    setupTemplateEvents() {
        document.addEventListener('click', (e) => {
            const templateCard = e.target.closest('.template-card');
            if (templateCard) {
                const templateName = templateCard.dataset.template;
                this.applyTemplate(templateName);
            }
        });
    }

    renderTemplates() {
        const templatesGrid = document.getElementById('templatesGrid');
        if (!templatesGrid) return;

        templatesGrid.innerHTML = Object.keys(this.templates).map(templateKey => {
            const template = this.templates[templateKey];
            return `
                <div class="template-card" data-template="${templateKey}">
                    <div class="template-icon">${template.icon}</div>
                    <h4>${template.name}</h4>
                    <p>${template.description}</p>
                    <div class="template-tags">
                        ${template.tags.map(tag => `<span class="template-tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    applyTemplate(templateName) {
        const template = this.templates[templateName];
        if (!template) return;

        // Create new command with template
        this.currentCommand = {
            id: 'new',
            name: template.name,
            pattern: template.pattern,
            description: template.description,
            code: template.code,
            is_active: true,
            wait_for_answer: template.waitForAnswer || false,
            answer_handler: template.answerHandler || ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        
        // Show success message
        this.showSuccess(`"${template.name}" template applied!`);
        
        // Scroll to editor
        document.getElementById('commandEditor').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        if (show) {
            section.style.display = 'block';
            // Add default answer handler if empty
            if (!document.getElementById('answerHandler').value.trim()) {
                document.getElementById('answerHandler').value = `// Handle user's answer
const answer = getAnswer();
const user = getUser();

// Process the answer here
return sendMessage(\`✅ Thank you for your answer: "\${answer}"\`);`;
            }
        } else {
            section.style.display = 'none';
        }
    }

    toggleCommandStatus(isActive) {
        if (this.currentCommand) {
            this.currentCommand.is_active = isActive;
            this.showSuccess(`Command ${isActive ? 'activated' : 'deactivated'}`);
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
            this.showError('Failed to load bot info: ' + error.message);
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            document.getElementById('botName').textContent = `Commands - ${this.currentBot.name}`;
            document.getElementById('botUsername').textContent = `@${this.currentBot.username}`;
            document.title = `Commands - ${this.currentBot.name} - Bot Maker Pro`;
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
                this.showError('Failed to load commands: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            this.showError('Network error while loading commands: ' + error.message);
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
        const isSelected = this.currentCommand?.id === command.id;
        
        return `
            <div class="command-item ${isSelected ? 'active' : ''}" 
                 onclick="commandEditor.selectCommand('${command.id}')">
                <div class="command-icon">
                    <i class="fas fa-code"></i>
                </div>
                <div class="command-content">
                    <div class="command-header">
                        <span class="command-name">${this.escapeHtml(command.name)}</span>
                        <span class="command-pattern">${this.escapeHtml(command.pattern)}</span>
                    </div>
                    <p class="command-description">${this.escapeHtml(command.description || 'No description')}</p>
                    <div class="command-meta">
                        <span class="command-status ${isActive ? 'active' : 'inactive'}">
                            <i class="fas fa-circle"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                        ${hasAnswerHandler ? '<span class="command-feature">⏳ Waits</span>' : ''}
                        ${command.wait_for_answer ? '<span class="command-feature">💬 Interactive</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    filterCommands(searchTerm) {
        const commandItems = document.querySelectorAll('.command-item');
        const lowerSearch = searchTerm.toLowerCase().trim();

        if (!lowerSearch) {
            commandItems.forEach(item => item.style.display = 'block');
            return;
        }

        commandItems.forEach(item => {
            const commandName = item.querySelector('.command-name').textContent.toLowerCase();
            const commandPattern = item.querySelector('.command-pattern').textContent.toLowerCase();
            const commandDesc = item.querySelector('.command-description').textContent.toLowerCase();
            
            const isVisible = commandName.includes(lowerSearch) || 
                            commandPattern.includes(lowerSearch) ||
                            commandDesc.includes(lowerSearch);
            
            item.style.display = isVisible ? 'block' : 'none';
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            name: 'New Command',
            pattern: '/start',
            description: '',
            code: '// Write your command code here\nconst user = getUser();\nreturn sendMessage(`Hello ${user.first_name}!`);',
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        
        // Focus on name field
        setTimeout(() => {
            document.getElementById('commandName').focus();
        }, 100);
    }

    async selectCommand(commandId) {
        // Don't reload if already selected
        if (this.currentCommand?.id === commandId) return;

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
                
                const selectedItem = document.querySelector(`[onclick*="${commandId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
                    // Scroll into view
                    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                this.showError('Failed to load command: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            this.showError('Network error while loading command: ' + error.message);
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

        // Basic fields
        document.getElementById('commandName').value = this.currentCommand.name;
        document.getElementById('commandPattern').value = this.currentCommand.pattern;
        document.getElementById('commandDescription').value = this.currentCommand.description || '';
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        // Wait for answer toggle
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        // Answer handler
        document.getElementById('answerHandler').value = this.currentCommand.answer_handler || '';
        
        // Command active toggle
        const activeToggle = document.getElementById('commandActive');
        if (activeToggle) {
            activeToggle.checked = this.currentCommand.is_active !== false;
        }
        
        // Update UI
        document.getElementById('currentCommandName').textContent = this.currentCommand.name;
        document.getElementById('commandStatus').textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
        document.getElementById('commandStatus').className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        
        // Update button states
        this.updateButtonStates();
    }

    updateButtonStates() {
        const isNew = this.currentCommand?.id === 'new';
        const deleteBtn = document.getElementById('deleteCommandBtn');
        const testBtn = document.getElementById('testCommandBtn');
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
            deleteBtn.title = isNew ? 'Save command first to enable delete' : 'Delete command';
        }
        
        if (testBtn) {
            testBtn.disabled = isNew;
            testBtn.title = isNew ? 'Save command first to test' : 'Test command';
        }
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
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

        // Enhanced Validation
        if (!formData.name) {
            this.showError('Command name is required');
            document.getElementById('commandName').focus();
            return false;
        }

        if (!formData.pattern) {
            this.showError('Command pattern is required');
            document.getElementById('commandPattern').focus();
            return false;
        }

        if (!formData.pattern.startsWith('/')) {
            this.showError('Command pattern should start with /');
            document.getElementById('commandPattern').focus();
            return false;
        }

        if (!formData.code) {
            this.showError('Command code is required');
            document.getElementById('commandCode').focus();
            return false;
        }

        if (formData.waitForAnswer && !formData.answerHandler) {
            this.showError('Answer handler code is required when "Wait for Answer" is enabled');
            document.getElementById('answerHandler').focus();
            return false;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            let response;
            let url;
            let method;

            if (this.currentCommand.id === 'new') {
                url = '/api/commands';
                method = 'POST';
            } else {
                url = `/api/commands/${this.currentCommand.id}`;
                method = 'PUT';
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

            if (response.ok) {
                this.showSuccess('Command saved successfully!');
                
                // Reload commands to get updated list
                await this.loadCommands();
                
                // Select the saved command
                if (data.command) {
                    this.currentCommand = data.command;
                    this.populateCommandForm();
                    
                    // Update the command in the list
                    const commandItem = document.querySelector(`[onclick*="${data.command.id}"]`);
                    if (commandItem) {
                        commandItem.outerHTML = this.getCommandItemHTML(data.command);
                    }
                }
                
                return true;
            } else {
                this.showError(data.error || 'Failed to save command');
                return false;
            }
        } catch (error) {
            this.showError('Network error while saving command: ' + error.message);
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            return;
        }

        if (!confirm('Are you sure you want to delete this command?\n\nThis action cannot be undone and will remove the command from your bot.')) {
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
            this.showError('Network error while deleting command: ' + error.message);
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
                this.showTestResult(`
                    <div class="test-success">
                        <h4>✅ Test Command Sent Successfully!</h4>
                        <div class="test-details">
                            <p><strong>Command:</strong> ${this.currentCommand.name}</p>
                            <p><strong>Pattern:</strong> ${this.currentCommand.pattern}</p>
                            <p><strong>Bot:</strong> ${this.currentBot.name}</p>
                        </div>
                        <p class="test-message">Check your Telegram bot for the test results.</p>
                        <div class="test-tips">
                            <p><strong>💡 Tips:</strong></p>
                            <ul>
                                <li>Make sure your bot is active</li>
                                <li>Check admin chat ID is set correctly</li>
                                <li>Wait a few seconds for the response</li>
                            </ul>
                        </div>
                    </div>
                `);
            } else {
                this.showTestResult(`
                    <div class="test-error">
                        <h4>❌ Test Failed</h4>
                        <p><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
                        <div class="troubleshooting">
                            <p><strong>🔧 Troubleshooting:</strong></p>
                            <ul>
                                <li>Verify bot token is valid</li>
                                <li>Check admin settings</li>
                                <li>Review command code for errors</li>
                                <li>Check server logs for details</li>
                            </ul>
                        </div>
                    </div>
                `);
            }
        } catch (error) {
            this.showTestResult(`
                <div class="test-error">
                    <h4>❌ Network Error</h4>
                    <p>Failed to connect to server: ${error.message}</p>
                    <p>Please check your internet connection and try again.</p>
                </div>
            `);
        } finally {
            this.showLoading(false);
        }
    }

    showTestResult(html) {
        const modal = document.getElementById('testCommandModal');
        const resultDiv = document.getElementById('testCommandResult');
        
        if (modal && resultDiv) {
            resultDiv.innerHTML = html;
            modal.style.display = 'flex';
        }
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

// Initialize enhanced command editor
let commandEditor;
document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new EnhancedCommandEditor();
});