class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.codeHistory = [];
        this.historyIndex = -1;
        this.currentEditorType = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        this.setupCodeEditor();
        this.setupCommandsTags();
        this.setupTemplateEvents();
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

        document.getElementById('quickTest').addEventListener('click', () => {
            this.quickTest();
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

        // Form actions
        document.getElementById('saveCommandBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveCommand();
        });

        document.getElementById('deleteCommandBtn').addEventListener('click', () => {
            this.deleteCommand();
        });

        document.getElementById('toggleCommandBtn').addEventListener('click', () => {
            this.toggleCommand();
        });

        document.getElementById('testCommandBtn').addEventListener('click', () => {
            this.testCommand();
        });

        document.getElementById('runTestBtn').addEventListener('click', () => {
            this.runCustomTest();
        });

        // Toggle switches
        document.getElementById('waitForAnswer').addEventListener('change', (e) => {
            this.toggleAnswerHandler(e.target.checked);
        });

        // Code editor buttons
        document.getElementById('openEditor').addEventListener('click', () => {
            this.openCodeEditor('main');
        });

        document.getElementById('openAnswerEditor').addEventListener('click', () => {
            this.openCodeEditor('answer');
        });

        // Templates
        document.getElementById('showTemplates').addEventListener('click', () => {
            this.showTemplates();
        });

        // Search
        let searchTimeout;
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Modal events
        this.setupModalEvents();
        
        // Template categories
        this.setupTemplateCategories();
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

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        const commandsTags = document.getElementById('commandsTags');

        moreCommandsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const command = moreCommandsInput.value.trim();
                if (command) {
                    this.addCommandTag(command);
                    moreCommandsInput.value = '';
                }
            }
        });

        moreCommandsInput.addEventListener('blur', () => {
            const command = moreCommandsInput.value.trim();
            if (command) {
                this.addCommandTag(command);
                moreCommandsInput.value = '';
            }
        });

        moreCommandsInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            const commands = pastedText.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
            
            commands.forEach(command => {
                if (command && !this.commandExistsInTags(command)) {
                    this.addCommandTag(command);
                }
            });
            
            moreCommandsInput.value = '';
        });
    }

    addCommandTag(command) {
        if (!command || this.commandExistsInTags(command)) return;

        const commandsTags = document.getElementById('commandsTags');
        const tag = document.createElement('div');
        tag.className = 'command-tag';
        tag.innerHTML = `
            <span class="tag-text">${this.escapeHtml(command)}</span>
            <button type="button" class="remove-tag">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        tag.querySelector('.remove-tag').addEventListener('click', () => {
            tag.remove();
        });
        
        commandsTags.appendChild(tag);
    }

    commandExistsInTags(command) {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        return tags.some(tag => tag.textContent.trim() === command);
    }

    getCommandsFromTags() {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        return tags.map(tag => tag.textContent.trim()).filter(cmd => cmd);
    }

    setCommandsToTags(commands) {
        const commandsTags = document.getElementById('commandsTags');
        commandsTags.innerHTML = '';
        
        if (typeof commands === 'string') {
            commands = commands.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
        }
        
        commands.forEach(command => {
            if (command) {
                this.addCommandTag(command);
            }
        });
    }

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        
        // Editor functionality
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undoCode();
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redoCode();
        });

        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.selectAllCode();
        });

        document.getElementById('cutBtn').addEventListener('click', () => {
            this.cutSelectedCode();
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copySelectedCode();
        });

        document.getElementById('pasteBtn').addEventListener('click', () => {
            this.pasteCode();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAllCode();
        });

        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatAdvancedCode();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeCodeEditor();
        });

        document.getElementById('saveCode').addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        // Real-time line counting
        advancedEditor.addEventListener('input', (e) => {
            this.saveToHistory(e.target.value);
            this.updateLineCount(e.target.value);
        });

        // Keyboard shortcuts
        advancedEditor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'z':
                        e.preventDefault();
                        this.undoCode();
                        break;
                    case 'y':
                        e.preventDefault();
                        this.redoCode();
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAllCode();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveCodeFromEditor();
                        break;
                }
            }
            
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertTab();
            }
        });

        this.updateLineCount(advancedEditor.value);
    }

    updateLineCount(code) {
        const lines = code.split('\n').length;
        const chars = code.length;
        document.getElementById('lineCount').textContent = `Line: ${lines}`;
        document.getElementById('charCount').textContent = `Chars: ${chars}`;
    }

    insertTab() {
        const editor = document.getElementById('advancedCodeEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        editor.focus();
        
        this.saveToHistory(editor.value);
        this.updateLineCount(editor.value);
    }

    saveToHistory(code) {
        this.codeHistory = this.codeHistory.slice(0, this.historyIndex + 1);
        this.codeHistory.push(code);
        this.historyIndex = this.codeHistory.length - 1;
    }

    undoCode() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const code = this.codeHistory[this.historyIndex];
            document.getElementById('advancedCodeEditor').value = code;
            this.updateLineCount(code);
            this.showInfo('Undo performed');
        } else {
            this.showInfo('Nothing to undo');
        }
    }

    redoCode() {
        if (this.historyIndex < this.codeHistory.length - 1) {
            this.historyIndex++;
            const code = this.codeHistory[this.historyIndex];
            document.getElementById('advancedCodeEditor').value = code;
            this.updateLineCount(code);
            this.showInfo('Redo performed');
        } else {
            this.showInfo('Nothing to redo');
        }
    }

    selectAllCode() {
        const editor = document.getElementById('advancedCodeEditor');
        editor.select();
        this.showInfo('All code selected');
    }

    cutSelectedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).then(() => {
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start;
                editor.focus();
                
                this.saveToHistory(editor.value);
                this.updateLineCount(editor.value);
                this.showSuccess(`Cut ${selectedText.length} characters!`);
            });
        } else {
            this.showInfo('No text selected to cut');
        }
    }

    copySelectedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).then(() => {
                this.showSuccess(`Copied ${selectedText.length} characters!`);
            });
        } else {
            this.showInfo('No text selected to copy');
        }
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
            this.updateLineCount(editor.value);
            this.showSuccess(`Pasted ${text.length} characters!`);
        } catch (err) {
            this.showError('Failed to paste from clipboard');
        }
    }

    clearAllCode() {
        if (confirm('Are you sure you want to clear all code?')) {
            const editor = document.getElementById('advancedCodeEditor');
            editor.value = '';
            editor.focus();
            
            this.saveToHistory('');
            this.updateLineCount('');
            this.showSuccess('Code cleared!');
        }
    }

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        const code = editor.value;
        
        try {
            const formatted = this.formatJavaScript(code);
            editor.value = formatted;
            this.saveToHistory(formatted);
            this.updateLineCount(formatted);
            this.showSuccess('Code formatted!');
        } catch (error) {
            this.showError('Formatting failed');
        }
    }

    formatJavaScript(code) {
        return code
            .replace(/\$\s*{\s*/g, '${')
            .replace(/\s*}\s*/g, '}')
            .replace(/(\w+)\s*\(\s*/g, '$1(')
            .replace(/\s*\)/g, ')')
            .replace(/\s*;/g, ';')
            .replace(/\r\n/g, '\n')
            .replace(/\n+/g, '\n')
            .trim();
    }

    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        
        if (editorType === 'main') {
            code = document.getElementById('commandCode').value;
        } else if (editorType === 'answer') {
            code = document.getElementById('answerHandler').value;
        }
        
        document.getElementById('advancedCodeEditor').value = code;
        this.codeHistory = [code];
        this.historyIndex = 0;
        this.updateLineCount(code);
        document.getElementById('codeEditorModal').style.display = 'flex';
        
        setTimeout(() => {
            const editor = document.getElementById('advancedCodeEditor');
            editor.focus();
        }, 100);
    }

    closeCodeEditor() {
        document.getElementById('codeEditorModal').style.display = 'none';
    }

    saveCodeFromEditor() {
        const code = document.getElementById('advancedCodeEditor').value;
        
        if (this.currentEditorType === 'main') {
            document.getElementById('commandCode').value = code;
        } else if (this.currentEditorType === 'answer') {
            document.getElementById('answerHandler').value = code;
        }
        
        this.closeCodeEditor();
        this.showSuccess('Code saved!');
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal', 'templatesModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeBtn = modal?.querySelector('.modal-close');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
        });

        document.getElementById('closeTestCommand')?.addEventListener('click', () => {
            document.getElementById('testCommandModal').style.display = 'none';
        });

        document.getElementById('closeTemplates')?.addEventListener('click', () => {
            document.getElementById('templatesModal').style.display = 'none';
        });

        document.getElementById('viewLogs')?.addEventListener('click', () => {
            this.viewLogs();
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }

    setupTemplateCategories() {
        const categoryTabs = document.querySelectorAll('.category-tab');
        const templateCategories = document.querySelectorAll('.template-category');

        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                
                // Update tabs
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update content
                templateCategories.forEach(cat => cat.classList.remove('active'));
                document.getElementById(`${category}-templates`).classList.add('active');
            });
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
            this.showError('Failed to load bot info');
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            document.getElementById('botName').textContent = `Commands - ${this.currentBot.name}`;
            document.getElementById('botUsername').textContent = `@${this.currentBot.username}`;
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
        const noCommandSelected = document.getElementById('noCommandSelected');

        if (!this.commands || this.commands.length === 0) {
            commandsList.style.display = 'none';
            emptyCommands.style.display = 'block';
            noCommandSelected.style.display = 'block';
            document.getElementById('commandEditor').style.display = 'none';
            return;
        }

        commandsList.style.display = 'block';
        emptyCommands.style.display = 'none';

        commandsList.innerHTML = this.commands.map(command => this.getCommandItemHTML(command)).join('');
    }

    getCommandItemHTML(command) {
        const isActive = command.is_active;
        const isSelected = this.currentCommand?.id === command.id;
        const patterns = command.pattern.split(',').map(p => p.trim());
        
        return `
            <div class="command-item ${isSelected ? 'active' : ''}" 
                 onclick="commandEditor.selectCommand('${command.id}')">
                <div class="command-icon">
                    <i class="fas fa-code"></i>
                </div>
                <div class="command-content">
                    <div class="command-patterns">
                        ${patterns.map(pattern => `<span class="pattern-tag">${this.escapeHtml(pattern)}</span>`).join('')}
                    </div>
                    <div class="command-meta">
                        <span class="command-status ${isActive ? 'active' : 'inactive'}">
                            <i class="fas fa-circle"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                        ${command.wait_for_answer ? '<span class="command-feature">⏳ Waits</span>' : ''}
                        <span class="command-id">ID: ${command.id.substring(0, 8)}</span>
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
            const patterns = item.querySelectorAll('.pattern-tag');
            let isVisible = false;
            
            patterns.forEach(pattern => {
                if (pattern.textContent.toLowerCase().includes(lowerSearch)) {
                    isVisible = true;
                }
            });
            
            item.style.display = isVisible ? 'block' : 'none';
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            pattern: '/start',
            code: '// Write your command code here\nconst user = getUser();\nbot.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
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
                this.showError('Failed to load command');
            }
        } catch (error) {
            this.showError('Network error while loading command');
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

        this.setCommandsToTags(this.currentCommand.pattern);
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        document.getElementById('answerHandler').value = this.currentCommand.answer_handler || '';
        
        // Set command name based on first pattern
        const patterns = this.currentCommand.pattern.split(',').map(p => p.trim());
        const commandName = patterns[0] || 'Unnamed Command';
        document.getElementById('currentCommandName').textContent = commandName;
        document.getElementById('commandId').textContent = `ID: ${this.currentCommand.id}`;
        
        const statusBadge = document.getElementById('commandStatus');
        statusBadge.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
        statusBadge.className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        
        this.updateButtonStates();
    }

    updateButtonStates() {
        const isNew = this.currentCommand?.id === 'new';
        const deleteBtn = document.getElementById('deleteCommandBtn');
        const toggleBtn = document.getElementById('toggleCommandBtn');
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
        }
        
        if (toggleBtn) {
            toggleBtn.textContent = this.currentCommand?.is_active ? ' Deactivate' : ' Activate';
            toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${this.currentCommand?.is_active ? 'Deactivate' : 'Activate'}`;
        }
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
        }

        const commands = this.getCommandsFromTags();
        
        if (commands.length === 0) {
            this.showError('Please add at least one command pattern');
            document.getElementById('moreCommands').focus();
            return false;
        }

        const commandPattern = commands.join(', ');
        const commandCode = document.getElementById('commandCode').value.trim();
        
        if (!commandCode) {
            this.showError('Command code is required');
            document.getElementById('commandCode').focus();
            return false;
        }

        const formData = {
            pattern: commandPattern,
            code: commandCode,
            waitForAnswer: document.getElementById('waitForAnswer').checked,
            answerHandler: document.getElementById('waitForAnswer').checked ? 
                          document.getElementById('answerHandler').value.trim() : '',
            botToken: this.currentBot.token
        };

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
                formData.commandId = this.currentCommand.id;
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
                    this.currentCommand = Array.isArray(data.command) ? data.command[0] : data.command;
                    this.populateCommandForm();
                }
                
                return true;
            } else {
                this.showError(data.error || 'Failed to save command');
                return false;
            }
        } catch (error) {
            this.showError('Network error while saving command');
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            return;
        }

        if (!confirm('Are you sure you want to delete this command?\n\nThis action cannot be undone.')) {
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

    async toggleCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            return;
        }

        const newStatus = !this.currentCommand.is_active;

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/${this.currentCommand.id}/toggle`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    isActive: newStatus,
                    botToken: this.currentBot.token
                })
            });

            if (response.ok) {
                this.currentCommand.is_active = newStatus;
                this.populateCommandForm();
                await this.loadCommands();
                this.showSuccess(`Command ${newStatus ? 'activated' : 'deactivated'} successfully!`);
            } else {
                this.showError('Failed to toggle command status');
            }
        } catch (error) {
            this.showError('Network error while toggling command');
        } finally {
            this.showLoading(false);
        }
    }

    async testCommand() {
        if (!this.currentBot) {
            this.showError('Bot information not loaded');
            return;
        }

        const commands = this.getCommandsFromTags();
        if (commands.length === 0) {
            this.showError('Please add at least one command to test');
            return;
        }

        const commandCode = document.getElementById('commandCode').value.trim();
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const tempCommand = {
                pattern: commands.join(', '),
                code: commandCode,
                wait_for_answer: document.getElementById('waitForAnswer').checked,
                answer_handler: document.getElementById('answerHandler').value || ''
            };

            const response = await fetch('/api/commands/test-temp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    command: tempCommand,
                    botToken: this.currentBot.token
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showTestSuccess(`
                    <h4>✅ Test Command Sent Successfully!</h4>
                    <div class="test-details">
                        <p><strong>Commands:</strong> ${commands.join(', ')}</p>
                        <p><strong>Bot:</strong> ${this.currentBot.name}</p>
                        <p><strong>Status:</strong> Command executed without errors</p>
                    </div>
                    <p class="test-message">Check your Telegram bot for the test results.</p>
                `);
            } else {
                this.showTestError(`
                    <h4>❌ Test Failed</h4>
                    <p><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
                    ${data.details ? `<p><strong>Details:</strong> ${data.details}</p>` : ''}
                `);
            }
        } catch (error) {
            this.showTestError(`
                <h4>❌ Network Error</h4>
                <p>Failed to connect to server: ${error.message}</p>
            `);
        }
    }

    async runCustomTest() {
        if (!this.currentBot) {
            this.showError('Bot information not loaded');
            return;
        }

        const testInput = document.getElementById('testInput').value.trim();
        const commands = this.getCommandsFromTags();
        
        if (!testInput && commands.length === 0) {
            this.showError('Please add commands or enter test input');
            return;
        }

        const commandCode = document.getElementById('commandCode').value.trim();
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const tempCommand = {
                pattern: testInput || commands.join(', '),
                code: commandCode,
                wait_for_answer: document.getElementById('waitForAnswer').checked,
                answer_handler: document.getElementById('answerHandler').value || ''
            };

            const response = await fetch('/api/commands/test-temp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    command: tempCommand,
                    botToken: this.currentBot.token,
                    testInput: testInput
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showTestSuccess(`
                    <h4>✅ Test Command Executed Successfully!</h4>
                    <div class="test-details">
                        <p><strong>Test Input:</strong> ${testInput || commands.join(', ')}</p>
                        <p><strong>Bot:</strong> ${this.currentBot.name}</p>
                        <p><strong>Result:</strong> ${data.result || 'Command executed successfully'}</p>
                    </div>
                    <p class="test-message">Command executed without errors.</p>
                `);
            } else {
                this.showTestError(`
                    <h4>❌ Test Failed</h4>
                    <div class="error-details">
                        <p><strong>Error:</strong> ${data.error || 'Unknown error occurred'}</p>
                        ${data.details ? `<p><strong>Details:</strong> ${data.details}</p>` : ''}
                    </div>
                `);
            }
        } catch (error) {
            this.showTestError(`
                <h4>❌ Network Error</h4>
                <p>Failed to connect to server: ${error.message}</p>
            `);
        }
    }

    async quickTest() {
        if (this.currentCommand) {
            await this.testCommand();
        } else {
            this.showError('Please select a command first');
        }
    }

    showTestModal() {
        document.getElementById('testCommandModal').style.display = 'flex';
    }

    showTestLoading() {
        document.getElementById('testCommandResult').innerHTML = `
            <div class="test-loading">
                <div class="spinner"></div>
                <p>Testing command execution...</p>
            </div>
        `;
    }

    showTestSuccess(html) {
        document.getElementById('testCommandResult').innerHTML = `
            <div class="test-success">
                ${html}
            </div>
        `;
    }

    showTestError(html) {
        document.getElementById('testCommandResult').innerHTML = `
            <div class="test-error">
                ${html}
            </div>
        `;
    }

    viewLogs() {
        this.showInfo('Logs feature coming soon!');
    }

    formatCode() {
        const code = document.getElementById('commandCode').value;
        try {
            const formatted = this.formatJavaScript(code);
            document.getElementById('commandCode').value = formatted;
            this.showSuccess('Code formatted successfully!');
        } catch (error) {
            this.showError('Formatting failed');
        }
    }

    showTemplates() {
        document.getElementById('templatesModal').style.display = 'flex';
    }

    applyTemplate(templateName) {
        let code = '';
        let patterns = '';
        
        switch(templateName) {
            case 'welcome':
                patterns = '/start, start, hello';
                code = `// Welcome message template
const user = getUser();
const welcomeMessage = \`Hello \${user.first_name}! 👋

Welcome to our bot! Here's what you can do:
• Use /help to see all commands
• Use /info to get bot information

Your User ID: \${user.id}
Username: @\${user.username || 'Not set'}\`;

bot.sendMessage(welcomeMessage, {
    parse_mode: 'Markdown'
});`;
                break;
                
            case 'help':
                patterns = '/help, help, commands';
                code = `// Help command template
const helpText = \`🤖 *Bot Help Menu*

*Available Commands:*
• /start - Start the bot
• /help - Show this help message
• /info - Bot information

*Features:*
• Multiple command patterns
• Wait for answer functionality
• Media support
• Interactive buttons

*Need Help?*
Contact support if you need assistance.\`;

bot.sendMessage(helpText, {
    parse_mode: 'Markdown'
});`;
                break;
                
            case 'info':
                patterns = '/info, about, bot';
                code = `// Bot information template
const botInfo = \`🤖 *Bot Information*

*Name:* ${this.currentBot?.name || 'My Bot'}
*Username:* @${this.currentBot?.username || 'mybot'}
*Status:* ✅ Active
*Version:* 2.0.0

*Features:*
• Advanced command system
• User data management
• Media support
• Interactive conversations

*Created with:* Bot Maker Pro\`;

bot.sendMessage(botInfo, {
    parse_mode: 'Markdown'
});`;
                break;
                
            case 'echo':
                patterns = '/echo, echo, repeat';
                code = `// Echo command with wait for answer
bot.sendMessage('Please send me a message to echo:');

// Using then/catch instead of await for compatibility
waitForAnswer(60000).then(function(userMessage) {
    if (userMessage && userMessage.trim()) {
        bot.sendMessage("You said: " + userMessage);
    } else {
        bot.sendMessage('You did not send any message!');
    }
}).catch(function(error) {
    bot.sendMessage('Timeout! Please try again.');
});`;
                break;
                
            case 'user_data':
                patterns = '/data, /save, /get';
                code = `// User data management example

// Save user data
User.saveData('name', 'John Doe');
User.saveData('age', '25');

// Get user data
const userName = User.getData('name');
const userAge = User.getData('age');

// Use in message
if (userName) {
    bot.sendMessage("Welcome back, " + userName + "!");
} else {
    bot.sendMessage("What's your name?");
    waitForAnswer().then(function(name) {
        User.saveData('name', name);
        bot.sendMessage("Nice to meet you, " + name + "!");
    });
}`;
                break;
                
            case 'inline_buttons':
                patterns = '/menu, /buttons';
                code = `// Inline keyboard example
const inlineKeyboard = {
    inline_keyboard: [
        [
            {
                text: "Button 1",
                callback_data: "button_1"
            },
            {
                text: "Button 2", 
                callback_data: "button_2"
            }
        ],
        [
            {
                text: "Visit Website",
                url: "https://example.com"
            }
        ]
    ]
};

bot.sendMessage("Choose an option:", {
    reply_markup: inlineKeyboard
});`;
                break;
                
            case 'http_get':
                patterns = '/fetch, /api';
                code = `// HTTP GET request example
bot.sendMessage("Fetching data from API...");

// Using then/catch instead of await
HTTP.get("https://jsonplaceholder.typicode.com/posts/1").then(function(data) {
    const result = bunchify(data);
    bot.sendMessage("📊 API Response:\\nTitle: " + result.title + "\\nBody: " + result.body);
}).catch(function(error) {
    bot.sendMessage("❌ Error: " + error.message);
});`;
                break;
                
            case 'conversation':
                patterns = '/conversation, chat';
                code = `// Interactive conversation without async/await
bot.sendMessage("Hello! What's your name?");

waitForAnswer(60000).then(function(userName) {
    if (userName && userName.trim()) {
        bot.sendMessage("Nice to meet you, " + userName + "!");
        
        bot.sendMessage("How old are you?");
        return waitForAnswer(60000);
    } else {
        bot.sendMessage("You didn't provide a name!");
        throw new Error('No name provided');
    }
}).then(function(ageText) {
    var age = parseInt(ageText);
    
    if (!isNaN(age)) {
        if (age >= 18) {
            bot.sendMessage("Great! You're an adult.");
        } else {
            bot.sendMessage("Hello young friend!");
        }
    } else {
        bot.sendMessage("Please enter a valid age!");
    }
}).catch(function(error) {
    if (error.message !== 'No name provided') {
        bot.sendMessage("Conversation timeout!");
    }
});`;
                break;
                
            case 'send_photo':
                patterns = '/photo, picture, image';
                code = `// Send photo example
bot.sendPhoto("https://via.placeholder.com/400x300", {
    caption: "Here's a beautiful photo for you! 📸",
    parse_mode: "Markdown"
});`;
                break;

            case 'send_video':
                patterns = '/video, clip, movie';
                code = `// Send video example  
bot.sendVideo("https://example.com/video.mp4", {
    caption: "Check out this video! 🎥",
    parse_mode: "Markdown"
});`;
                break;

            case 'send_document':
                patterns = '/document, file, doc';
                code = `// Send document example
bot.sendDocument("https://example.com/document.pdf", {
    caption: "Here's your document! 📄",
    parse_mode: "Markdown"
});`;
                break;

            case 'media_gallery':
                patterns = '/gallery, media, photos';
                code = `// Media gallery example
bot.sendMediaGroup([
    {
        type: "photo",
        media: "https://via.placeholder.com/400x300",
        caption: "Photo 1"
    },
    {
        type: "photo", 
        media: "https://via.placeholder.com/400x300",
        caption: "Photo 2"
    }
]);`;
                break;

            case 'reply_keyboard':
                patterns = '/keyboard, keys, reply';
                code = `// Reply keyboard example
const replyKeyboard = {
    keyboard: [
        [
            { text: "Option 1" },
            { text: "Option 2" }
        ],
        [
            { text: "Option 3" },
            { text: "Cancel" }
        ]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
};

bot.sendMessage("Choose an option:", {
    reply_markup: replyKeyboard
});`;
                break;

            case 'weather':
                patterns = '/weather, climate';
                code = `// Weather API example
bot.sendMessage("Fetching weather data...");

HTTP.get("https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY").then(function(weatherData) {
    const weather = bunchify(weatherData);
    const tempCelsius = (weather.main.temp - 273.15).toFixed(1);
    
    bot.sendMessage("🌤️ Weather in " + weather.name + ":\\nTemperature: " + tempCelsius + "°C\\nCondition: " + weather.weather[0].description + "\\nHumidity: " + weather.main.humidity + "%");
}).catch(function(error) {
    bot.sendMessage("❌ Weather data unavailable: " + error.message);
});`;
                break;

            case 'broadcast':
                patterns = '/broadcast, announce';
                code = `// Broadcast message (admin only)
const user = getUser();

// Check if user is admin
if (user.id === 123456789) { // Replace with actual admin ID
    bot.sendMessage("Please enter the broadcast message:");
    
    waitForAnswer(60000).then(function(broadcastMessage) {
        if (broadcastMessage && broadcastMessage.trim()) {
            // In a real implementation, you would send to all users
            bot.sendMessage("📢 Broadcast Sent:\\n" + broadcastMessage);
        }
    }).catch(function(error) {
        bot.sendMessage("Broadcast cancelled.");
    });
} else {
    bot.sendMessage("❌ Admin access required.");
}`;
                break;

            case 'scheduler':
                patterns = '/schedule, timer, delay';
                code = `// Message scheduler example
bot.sendMessage("Message will be sent after 5 seconds...");

// Wait function for delays
wait(5000).then(function() {
    bot.sendMessage("⏰ 5 seconds have passed! This is your scheduled message.");
});`;
                break;

            default:
                patterns = '/template';
                code = `// Basic template
const user = getUser();
bot.sendMessage("Hello " + user.first_name + "! This is a basic command.");`;
        }
        
        this.setCommandsToTags(patterns);
        document.getElementById('commandCode').value = code;
        document.getElementById('templatesModal').style.display = 'none';
        this.showSuccess('Template applied successfully!');
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

// Initialize command editor
let commandEditor;
document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
});