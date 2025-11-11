class EnhancedCommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.codeHistory = [];
        this.historyIndex = -1;
        this.suggestionTimeout = null;
        this.suggestionsEnabled = true;
        this.currentEditorType = null; // 'main' or 'answer'
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        this.setupCodeEditor();
        this.setupCommandsTags();
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
            this.openCodeEditor('main');
        });

        document.getElementById('openAnswerEditor').addEventListener('click', () => {
            this.openCodeEditor('answer');
        });

        document.getElementById('formatCode').addEventListener('click', () => {
            this.formatCode();
        });

        // Modal events
        this.setupModalEvents();
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        const commandsTags = document.getElementById('commandsTags');

        moreCommandsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                this.addCommandTag(moreCommandsInput.value.trim());
                moreCommandsInput.value = '';
            }
        });

        moreCommandsInput.addEventListener('blur', () => {
            if (moreCommandsInput.value.trim()) {
                this.addCommandTag(moreCommandsInput.value.trim());
                moreCommandsInput.value = '';
            }
        });
    }

    addCommandTag(command) {
        if (!command) return;

        // Validate command format
        if (!command.startsWith('/')) {
            this.showError('Commands must start with /');
            return;
        }

        // Check for duplicates
        const existingTags = Array.from(document.querySelectorAll('.command-tag .tag-text'))
            .map(tag => tag.textContent.trim());
        
        if (existingTags.includes(command)) {
            this.showError(`Command "${command}" already exists`);
            return;
        }

        const commandsTags = document.getElementById('commandsTags');
        const tag = document.createElement('div');
        tag.className = 'command-tag';
        tag.innerHTML = `
            <span class="tag-text">${this.escapeHtml(command)}</span>
            <button type="button" class="remove-tag" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        commandsTags.appendChild(tag);
    }

    getCommandsFromTags() {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        return tags.map(tag => tag.textContent.trim());
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
        
        // Setup editor functionality
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undoCode();
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redoCode();
        });

        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.selectAllCode();
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copySelectedCode();
        });

        document.getElementById('pasteBtn').addEventListener('click', () => {
            this.pasteCode();
        });

        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatAdvancedCode();
        });

        document.getElementById('suggestBtn').addEventListener('click', () => {
            this.toggleSuggestions();
        });

        document.getElementById('closeSuggestions').addEventListener('click', () => {
            this.hideSuggestionList();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeCodeEditor();
        });

        document.getElementById('saveCode').addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        // Real-time suggestions
        advancedEditor.addEventListener('input', (e) => {
            this.saveToHistory(e.target.value);
            if (this.suggestionsEnabled) {
                this.showRealTimeSuggestions(e.target.value, e.target.selectionStart);
            }
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
                    case 'c':
                        // Allow default copy behavior
                        break;
                    case 'v':
                        // Allow default paste behavior
                        break;
                    case 'f':
                        e.preventDefault();
                        this.formatAdvancedCode();
                        break;
                }
            }
            
            // Escape key to close suggestions
            if (e.key === 'Escape') {
                this.hideSuggestionList();
            }
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

    selectAllCode() {
        const editor = document.getElementById('advancedCodeEditor');
        editor.select();
    }

    copySelectedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).then(() => {
                this.showSuccess('Selected code copied to clipboard!');
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
            this.showSuccess('Text pasted from clipboard!');
        } catch (err) {
            this.showError('Failed to paste from clipboard');
        }
    }

    toggleSuggestions() {
        this.suggestionsEnabled = !this.suggestionsEnabled;
        const suggestBtn = document.getElementById('suggestBtn');
        
        if (this.suggestionsEnabled) {
            suggestBtn.classList.add('active');
            suggestBtn.title = 'Disable Suggestions';
            this.showInfo('Suggestions enabled');
        } else {
            suggestBtn.classList.remove('active');
            suggestBtn.title = 'Enable Suggestions';
            this.hideSuggestionList();
            this.showInfo('Suggestions disabled');
        }
    }

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        const code = editor.value;
        
        try {
            const formatted = this.formatJavaScript(code);
            editor.value = formatted;
            this.saveToHistory(formatted);
            this.showSuccess('Code formatted successfully!');
        } catch (error) {
            this.showError('Formatting failed: ' + error.message);
        }
    }

    formatJavaScript(code) {
        // Enhanced JavaScript formatting
        let formatted = code;
        
        // Remove extra whitespace
        formatted = formatted.replace(/\s+/g, ' ');
        
        // Add newlines after braces and semicolons
        formatted = formatted.replace(/\{/g, ' {\n  ');
        formatted = formatted.replace(/\}/g, '\n}\n');
        formatted = formatted.replace(/;/g, ';\n');
        
        // Fix indentation
        let lines = formatted.split('\n');
        let indentLevel = 0;
        
        lines = lines.map(line => {
            line = line.trim();
            if (!line) return '';
            
            // Decrease indent for closing braces
            if (line.startsWith('}') || line.startsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            const indentedLine = '  '.repeat(indentLevel) + line;
            
            // Increase indent for opening braces
            if (line.endsWith('{') || line.endsWith('(')) {
                indentLevel++;
            }
            
            return indentedLine;
        });
        
        // Remove empty lines at start and end
        formatted = lines.filter(line => line.trim()).join('\n');
        
        // Clean up extra newlines
        formatted = formatted.replace(/\n\s*\n/g, '\n\n');
        
        return formatted.trim();
    }

    showRealTimeSuggestions(code, cursorPos) {
        clearTimeout(this.suggestionTimeout);
        
        this.suggestionTimeout = setTimeout(() => {
            const currentLine = this.getCurrentLine(code, cursorPos);
            const suggestions = this.generateRealTimeSuggestions(currentLine);
            
            if (suggestions.length > 0 && this.suggestionsEnabled) {
                this.showSuggestionList(suggestions);
            } else {
                this.hideSuggestionList();
            }
        }, 300);
    }

    getCurrentLine(code, cursorPos) {
        const textUpToCursor = code.substring(0, cursorPos);
        const lines = textUpToCursor.split('\n');
        return lines[lines.length - 1];
    }

    generateRealTimeSuggestions(currentLine) {
        const suggestions = [];
        const words = currentLine.trim().split(/\s+/);
        const lastWord = words[words.length - 1].toLowerCase();

        // Function suggestions
        const functions = [
            { name: 'sendMessage', desc: 'Send a text message', example: 'sendMessage("Hello!");' },
            { name: 'sendPhoto', desc: 'Send a photo', example: 'sendPhoto("https://example.com/photo.jpg");' },
            { name: 'sendDocument', desc: 'Send a document', example: 'sendDocument("https://example.com/file.pdf");' },
            { name: 'getUser', desc: 'Get user information', example: 'const user = getUser();' },
            { name: 'getChatId', desc: 'Get chat ID', example: 'const chatId = getChatId();' },
            { name: 'isTest', desc: 'Check if running in test mode', example: 'if (isTest()) { ... }' },
            { name: 'wait', desc: 'Wait for specified milliseconds', example: 'await wait(1000);' },
            { name: 'getAnswer', desc: 'Get user answer (in answer handler)', example: 'const answer = getAnswer();' }
        ];

        // Text-based suggestions
        const textSuggestions = [
            { text: 'Hello! Welcome to our bot! 👋', desc: 'Welcome message' },
            { text: 'Please provide more information.', desc: 'Request more info' },
            { text: 'Thank you for using our bot!', desc: 'Thank you message' },
            { text: 'Error occurred while processing your request.', desc: 'Error message' },
            { text: 'Please wait...', desc: 'Loading message' },
            { text: 'Operation completed successfully!', desc: 'Success message' }
        ];

        // Match functions
        functions.forEach(func => {
            if (func.name.toLowerCase().includes(lastWord) || lastWord.length < 2) {
                suggestions.push({
                    type: 'function',
                    content: func.name,
                    description: func.desc,
                    example: func.example,
                    template: this.getFunctionTemplate(func.name)
                });
            }
        });

        // Match text suggestions
        if (lastWord.length > 0) {
            textSuggestions.forEach(suggestion => {
                if (suggestion.text.toLowerCase().includes(lastWord)) {
                    suggestions.push({
                        type: 'text',
                        content: suggestion.text,
                        description: suggestion.desc,
                        example: suggestion.text,
                        template: `"${suggestion.text}"`
                    });
                }
            });
        }

        return suggestions.slice(0, 8); // Limit to 8 suggestions
    }

    getFunctionTemplate(funcName) {
        const templates = {
            'sendMessage': 'text, options',
            'sendPhoto': 'photo, options',
            'sendDocument': 'document, options',
            'getUser': '',
            'getChatId': '',
            'isTest': '',
            'wait': 'milliseconds',
            'getAnswer': ''
        };
        return templates[funcName] || '';
    }

    showSuggestionList(suggestions) {
        const suggestionsPanel = document.getElementById('suggestionsPanel');
        const suggestionsList = document.getElementById('suggestionsList');
        
        suggestionsList.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" onclick="commandEditor.applySuggestion('${suggestion.template.replace(/'/g, "\\'")}')">
                <div class="suggestion-content">
                    <strong>${suggestion.content}</strong>
                    <span class="suggestion-type">${suggestion.type}</span>
                    <div class="suggestion-desc">${suggestion.description}</div>
                    <div class="suggestion-example">${suggestion.example}</div>
                </div>
            </div>
        `).join('');
        
        suggestionsPanel.style.display = 'block';
    }

    hideSuggestionList() {
        const suggestionsPanel = document.getElementById('suggestionsPanel');
        suggestionsPanel.style.display = 'none';
    }

    applySuggestion(template) {
        const editor = document.getElementById('advancedCodeEditor');
        const currentCode = editor.value;
        const cursorPos = editor.selectionStart;
        
        // Find the current word and replace it with the template
        const textBeforeCursor = currentCode.substring(0, cursorPos);
        const textAfterCursor = currentCode.substring(cursorPos);
        
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines[lines.length - 1];
        const words = currentLine.trim().split(/\s+/);
        
        let newLine;
        if (words.length > 0) {
            words.pop(); // Remove the last incomplete word
            newLine = words.join(' ') + ' ' + template;
        } else {
            newLine = template;
        }
        
        lines[lines.length - 1] = newLine;
        
        const newTextBeforeCursor = lines.join('\n');
        const newCode = newTextBeforeCursor + textAfterCursor;
        const newCursorPos = newTextBeforeCursor.length;
        
        editor.value = newCode;
        editor.setSelectionRange(newCursorPos, newCursorPos);
        editor.focus();
        
        this.saveToHistory(newCode);
        this.hideSuggestionList();
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
        document.getElementById('codeEditorModal').style.display = 'flex';
        
        // Update suggestions button state
        const suggestBtn = document.getElementById('suggestBtn');
        if (this.suggestionsEnabled) {
            suggestBtn.classList.add('active');
        } else {
            suggestBtn.classList.remove('active');
        }
        
        // Focus and select all
        setTimeout(() => {
            const editor = document.getElementById('advancedCodeEditor');
            editor.focus();
        }, 100);
    }

    closeCodeEditor() {
        document.getElementById('codeEditorModal').style.display = 'none';
        this.hideSuggestionList();
    }

    saveCodeFromEditor() {
        const code = document.getElementById('advancedCodeEditor').value;
        
        if (this.currentEditorType === 'main') {
            document.getElementById('commandCode').value = code;
        } else if (this.currentEditorType === 'answer') {
            document.getElementById('answerHandler').value = code;
        }
        
        this.closeCodeEditor();
        this.showSuccess('Code saved from editor!');
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeBtn = modal?.querySelector('.modal-close');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
        });

        // Close test command modal
        document.getElementById('closeTestCommand')?.addEventListener('click', () => {
            document.getElementById('testCommandModal').style.display = 'none';
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

        // Set commands tags
        this.setCommandsToTags(this.currentCommand.pattern);
        
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
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
            deleteBtn.title = isNew ? 'Save command first to enable delete' : 'Delete command';
        }
        
        // Test button is always enabled
        const testBtn = document.getElementById('testCommandBtn');
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.title = 'Test current command code';
        }
    }

    formatCode() {
        const codeTextarea = document.getElementById('commandCode');
        const code = codeTextarea.value;
        
        try {
            const formatted = this.formatJavaScript(code);
            codeTextarea.value = formatted;
            this.showSuccess('Code formatted successfully!');
        } catch (error) {
            this.showError('Formatting failed: ' + error.message);
        }
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
        }

        const commands = this.getCommandsFromTags();
        
        if (commands.length === 0) {
            this.showError('Please add at least one command');
            document.getElementById('moreCommands').focus();
            return false;
        }

        const commandPattern = commands.join(', ');
        
        const formData = {
            name: commands[0],
            pattern: commandPattern,
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

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            
            // Create a temporary command object for testing
            const tempCommand = {
                name: commands[0],
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
                this.showTestResult(`
                    <div class="test-success">
                        <h4>✅ Test Command Sent Successfully!</h4>
                        <div class="test-details">
                            <p><strong>Commands:</strong> ${commands.join(', ')}</p>
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