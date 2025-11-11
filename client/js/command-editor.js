class EnhancedCommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.codeHistory = [];
        this.historyIndex = -1;
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        this.setupCodeEditor();
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
        document.getElementById('waitForAnswer').addEventListener('change', (e) => {
            this.toggleAnswerHandler(e.target.checked);
        });

        document.getElementById('commandActive').addEventListener('change', (e) => {
            if (this.currentCommand) {
                this.currentCommand.is_active = e.target.checked;
                const statusBadge = document.getElementById('commandStatus');
                statusBadge.textContent = e.target.checked ? 'Active' : 'Inactive';
                statusBadge.className = `status-badge ${e.target.checked ? 'active' : 'inactive'}`;
                this.showSuccess(`Command ${e.target.checked ? 'activated' : 'deactivated'}`);
            }
        });

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

        // Command search
        let searchTimeout;
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Code editor buttons
        document.getElementById('openEditor').addEventListener('click', () => {
            this.openCodeEditor();
        });

        document.getElementById('formatCode').addEventListener('click', () => {
            this.formatCode();
        });

        // Modal events
        this.setupModalEvents();
    }

    setupCodeEditor() {
        // Setup code editor modal functionality
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undoCode();
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redoCode();
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyCode();
        });

        document.getElementById('pasteBtn').addEventListener('click', () => {
            this.pasteCode();
        });

        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatAdvancedCode();
        });

        document.getElementById('suggestBtn').addEventListener('click', () => {
            this.showSuggestions();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeCodeEditor();
        });

        document.getElementById('saveCode').addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        // Track code changes for undo/redo
        const advancedEditor = document.getElementById('advancedCodeEditor');
        advancedEditor.addEventListener('input', () => {
            this.saveToHistory(advancedEditor.value);
        });
    }

    saveToHistory(code) {
        this.codeHistory = this.codeHistory.slice(0, this.historyIndex + 1);
        this.codeHistory.push(code);
        this.historyIndex = this.codeHistory.length - 1;
    }

    undoCode() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            document.getElementById('advancedCodeEditor').value = this.codeHistory[this.historyIndex];
        }
    }

    redoCode() {
        if (this.historyIndex < this.codeHistory.length - 1) {
            this.historyIndex++;
            document.getElementById('advancedCodeEditor').value = this.codeHistory[this.historyIndex];
        }
    }

    copyCode() {
        const code = document.getElementById('advancedCodeEditor').value;
        navigator.clipboard.writeText(code).then(() => {
            this.showSuccess('Code copied to clipboard!');
        });
    }

    async pasteCode() {
        try {
            const text = await navigator.clipboard.readText();
            const editor = document.getElementById('advancedCodeEditor');
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + text.length;
            editor.focus();
            this.saveToHistory(editor.value);
        } catch (err) {
            this.showError('Failed to paste from clipboard');
        }
    }

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        const code = editor.value;
        
        try {
            // Simple formatting - in a real app you might use a proper formatter
            const formatted = code
                .replace(/\n\s*\n/g, '\n\n')
                .replace(/\{\s*\n/g, '{\n')
                .replace(/\n\s*\}/g, '\n}')
                .replace(/;\s*\n/g, ';\n')
                .replace(/\s+/g, ' ')
                .replace(/([{};])\s+/g, '$1\n')
                .trim();
            
            editor.value = formatted;
            this.saveToHistory(formatted);
            this.showSuccess('Code formatted!');
        } catch (error) {
            this.showError('Formatting failed');
        }
    }

    showSuggestions() {
        const code = document.getElementById('advancedCodeEditor').value;
        const suggestionsPanel = document.getElementById('suggestionsPanel');
        const suggestionsList = document.getElementById('suggestionsList');
        
        // Simple suggestions based on common patterns
        const suggestions = this.generateSuggestions(code);
        
        if (suggestions.length > 0) {
            suggestionsList.innerHTML = suggestions.map(suggestion => `
                <div class="suggestion-item" onclick="commandEditor.applySuggestion('${suggestion.code.replace(/'/g, "\\'")}')">
                    <strong>${suggestion.title}</strong>
                    <p>${suggestion.description}</p>
                </div>
            `).join('');
            suggestionsPanel.style.display = 'block';
        } else {
            suggestionsPanel.style.display = 'none';
            this.showInfo('No suggestions available for this code');
        }
    }

    generateSuggestions(code) {
        const suggestions = [];
        
        if (!code.includes('sendMessage')) {
            suggestions.push({
                title: 'Add sendMessage',
                description: 'Send a message to the user',
                code: 'sendMessage("Hello! This is your bot speaking.");'
            });
        }
        
        if (!code.includes('getUser')) {
            suggestions.push({
                title: 'Get user info',
                description: 'Retrieve information about the user',
                code: 'const user = getUser();\nsendMessage(`Hello ${user.first_name}!`);'
            });
        }
        
        if (code.includes('HTTP') && !code.includes('try')) {
            suggestions.push({
                title: 'Add error handling',
                description: 'Wrap HTTP calls in try-catch',
                code: 'try {\n  // Your HTTP code here\n} catch (error) {\n  sendMessage("Error: " + error.message);\n}'
            });
        }
        
        return suggestions;
    }

    applySuggestion(code) {
        const editor = document.getElementById('advancedCodeEditor');
        const currentCode = editor.value;
        editor.value = currentCode + '\n\n' + code;
        this.saveToHistory(editor.value);
        document.getElementById('suggestionsPanel').style.display = 'none';
    }

    openCodeEditor() {
        const code = document.getElementById('commandCode').value;
        document.getElementById('advancedCodeEditor').value = code;
        this.codeHistory = [code];
        this.historyIndex = 0;
        document.getElementById('codeEditorModal').style.display = 'flex';
    }

    closeCodeEditor() {
        document.getElementById('codeEditorModal').style.display = 'none';
        document.getElementById('suggestionsPanel').style.display = 'none';
    }

    saveCodeFromEditor() {
        const code = document.getElementById('advancedCodeEditor').value;
        document.getElementById('commandCode').value = code;
        this.closeCodeEditor();
        this.showSuccess('Code saved from editor!');
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeBtn = modal?.querySelector('.modal-close');
            const closeActionBtn = modal?.querySelector(`#close${modalId.replace('Modal', '')}`);
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
            
            if (closeActionBtn) {
                closeActionBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        section.style.display = show ? 'block' : 'none';
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
                    <div class="command-meta">
                        <span class="command-status ${isActive ? 'active' : 'inactive'}">
                            <i class="fas fa-circle"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                        ${hasAnswerHandler ? '<span class="command-feature">⏳ Waits</span>' : ''}
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
            
            const isVisible = commandName.includes(lowerSearch) || 
                            commandPattern.includes(lowerSearch);
            
            item.style.display = isVisible ? 'block' : 'none';
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            name: 'New Command',
            pattern: '/start',
            code: '// Write your command code here\nconst user = getUser();\nreturn sendMessage(`Hello ${user.first_name}!`);',
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        
        setTimeout(() => {
            document.getElementById('moreCommands').focus();
        }, 100);
    }

    async selectCommand(commandId) {
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
                
                document.querySelectorAll('.command-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                const selectedItem = document.querySelector(`[onclick*="${commandId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
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

        document.getElementById('moreCommands').value = this.currentCommand.pattern;
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        document.getElementById('answerHandler').value = this.currentCommand.answer_handler || '';
        
        const activeToggle = document.getElementById('commandActive');
        if (activeToggle) {
            activeToggle.checked = this.currentCommand.is_active !== false;
        }
        
        document.getElementById('currentCommandName').textContent = this.currentCommand.name;
        document.getElementById('commandStatus').textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
        document.getElementById('commandStatus').className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        
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

    formatCode() {
        const codeTextarea = document.getElementById('commandCode');
        const code = codeTextarea.value;
        
        try {
            // Simple formatting
            const formatted = code
                .replace(/\n\s*\n/g, '\n\n')
                .replace(/\{\s*\n/g, '{\n')
                .replace(/\n\s*\}/g, '\n}')
                .replace(/;\s*\n/g, ';\n')
                .trim();
            
            codeTextarea.value = formatted;
            this.showSuccess('Code formatted!');
        } catch (error) {
            this.showError('Formatting failed');
        }
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
        }

        const moreCommands = document.getElementById('moreCommands').value.trim();
        const commands = moreCommands.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
        
        if (commands.length === 0) {
            this.showError('Please enter at least one command');
            document.getElementById('moreCommands').focus();
            return false;
        }

        const formData = {
            name: commands[0], // Use first command as name
            pattern: commands.join(', '), // Join all commands
            code: document.getElementById('commandCode').value.trim(),
            waitForAnswer: document.getElementById('waitForAnswer').checked,
            answerHandler: document.getElementById('waitForAnswer').checked ? 
                          document.getElementById('answerHandler').value.trim() : '',
            botToken: this.currentBot.token
        };

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
                
                await this.loadCommands();
                
                if (data.command) {
                    this.currentCommand = data.command;
                    this.populateCommandForm();
                    
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
                    </div>
                `);
            } else {
                this.showTestResult(`
                    <div class="test-error">
                        <h4>❌ Test Failed</h4>
                        <p><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
                    </div>
                `);
            }
        } catch (error) {
            this.showTestResult(`
                <div class="test-error">
                    <h4>❌ Network Error</h4>
                    <p>Failed to connect to server: ${error.message}</p>
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
        commonApp?.showError(message) || this.showNotification(message, 'error');
    }

    showSuccess(message) {
        commonApp?.showSuccess(message) || this.showNotification(message, 'success');
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