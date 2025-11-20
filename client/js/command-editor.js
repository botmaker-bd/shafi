/**
 * Simple and Beautiful Command Editor
 * Easy to use with modern design
 */
class CommandEditor {
    constructor() {
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.isModified = false;
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        
        console.log('🚀 Command Editor ready!');
        
        // Warn before leaving if there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isModified) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    // Simple Event Listeners
    setupEventListeners() {
        // Navigation
        document.getElementById('backToBots')?.addEventListener('click', () => this.goBack());
        document.getElementById('quickTest')?.addEventListener('click', () => this.quickTest());

        // Command actions
        document.getElementById('addCommandBtn')?.addEventListener('click', () => this.addNewCommand());
        document.getElementById('createFirstCommand')?.addEventListener('click', () => this.addNewCommand());
        document.getElementById('addFirstCommand')?.addEventListener('click', () => this.addNewCommand());

        // Form actions
        document.getElementById('saveCommandBtn')?.addEventListener('click', () => this.saveCommand());
        document.getElementById('saveFooterBtn')?.addEventListener('click', () => this.saveCommand());
        document.getElementById('testCommandBtn')?.addEventListener('click', () => this.testCommand());
        document.getElementById('testFooterBtn')?.addEventListener('click', () => this.testCommand());
        document.getElementById('runTestBtn')?.addEventListener('click', () => this.runCustomTest());
        document.getElementById('toggleCommandBtn')?.addEventListener('click', () => this.toggleCommand());
        document.getElementById('deleteCommandBtn')?.addEventListener('click', () => this.deleteCommand());

        // Editor actions
        document.getElementById('openEditor')?.addEventListener('click', () => this.openFullEditor());
        document.getElementById('insertSnippetBtn')?.addEventListener('click', () => this.showSnippetsModal());
        document.getElementById('clearPatternsBtn')?.addEventListener('click', () => this.clearCommandPatterns());
        document.getElementById('showTemplates')?.addEventListener('click', () => this.showTemplates());

        // Quick actions
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Modal actions
        this.setupModalEvents();
        this.setupCommandTags();
        this.setupSearch();
    }

    setupModalEvents() {
        // Close modals
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) modal.style.display = 'none';
            });
        });

        document.getElementById('closeTestCommand')?.addEventListener('click', () => {
            document.getElementById('testCommandModal').style.display = 'none';
        });

        document.getElementById('closeSnippets')?.addEventListener('click', () => {
            document.getElementById('snippetsModal').style.display = 'none';
        });

        document.getElementById('cancelEdit')?.addEventListener('click', () => {
            document.getElementById('codeEditorModal').style.display = 'none';
        });

        document.getElementById('saveCode')?.addEventListener('click', () => this.saveFullEditorCode());

        // Format code in full editor
        document.getElementById('formatBtn')?.addEventListener('click', () => this.formatAdvancedCode());
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clearAdvancedEditor());

        // Close modals on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'flex') {
                        modal.style.display = 'none';
                    }
                });
            }
        });
    }

    setupCommandTags() {
        const input = document.getElementById('moreCommands');
        const tagsContainer = document.getElementById('commandsTags');

        if (!input || !tagsContainer) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const command = input.value.trim();
                if (command) {
                    this.addCommandTag(command);
                    input.value = '';
                    this.setModified(true);
                }
            }
        });

        // Allow pasting multiple commands
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            const commands = pastedText.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
            
            commands.forEach(command => {
                if (command && !this.commandExistsInTags(command)) {
                    this.addCommandTag(command);
                }
            });
            
            this.setModified(true);
        });
    }

    setupSearch() {
        let searchTimeout;
        const searchInput = document.getElementById('commandSearch');
        const snippetsSearch = document.getElementById('snippetsSearch');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterCommands(e.target.value);
                }, 300);
            });
        }

        if (snippetsSearch) {
            snippetsSearch.addEventListener('input', (e) => {
                this.filterSnippets(e.target.value);
            });
        }
    }

    // Core Functions
    async loadCommands() {
        this.showLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Mock data
            this.commands = [
                {
                    id: '1',
                    command_patterns: '/start,start,hello',
                    code: '// Welcome message\nconst user = getUser();\nbot.sendMessage(`Hello ${user.first_name}! 👋 Welcome to our bot.`);',
                    is_active: true
                },
                {
                    id: '2', 
                    command_patterns: '/help,help,support',
                    code: '// Help command\nconst helpText = `Available commands:\n/start - Welcome message\n/help - Show this help\n/info - Bot information`;\nbot.sendMessage(helpText);',
                    is_active: true
                },
                {
                    id: '3',
                    command_patterns: '/info,about',
                    code: '// Bot information\nbot.sendMessage("🤖 Bot Maker Pro\\nCreate amazing Telegram bots easily!\\n\\nVersion: 1.0.0");',
                    is_active: false
                }
            ];
            
            this.displayCommands();
            
        } catch (error) {
            console.error('Error loading commands:', error);
            this.showError('Failed to load commands');
            this.commands = [];
            this.displayCommands();
        } finally {
            this.showLoading(false);
        }
    }

    displayCommands() {
        const commandsList = document.getElementById('commandsList');
        const emptyState = document.getElementById('emptyCommands');
        const welcomeScreen = document.getElementById('noCommandSelected');
        const editor = document.getElementById('commandEditor');

        if (!this.commands.length) {
            if (emptyState) emptyState.style.display = 'flex';
            if (welcomeScreen) welcomeScreen.style.display = 'flex';
            if (editor) editor.style.display = 'none';
            if (commandsList) commandsList.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            const patterns = command.command_patterns.split(',').slice(0, 3).join(', ');
            
            html += `
                <div class="command-item ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-patterns">${this.escapeHtml(patterns)}</div>
                    <div class="command-meta">
                        <span class="command-status ${isActive ? 'status-active' : 'status-inactive'}">
                            <i class="fas fa-circle"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>
            `;
        });
        
        if (commandsList) commandsList.innerHTML = html;

        // Add click events to command items
        commandsList.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const commandId = item.dataset.commandId;
                if (this.currentCommand?.id !== commandId) {
                    if (this.isModified && !confirm('You have unsaved changes. Switch command?')) {
                        return;
                    }
                    this.selectCommand(commandId);
                }
            });
        });
    }

    addNewCommand() {
        if (this.isModified && !confirm('You have unsaved changes. Create new command?')) {
            return;
        }

        // Generate unique default pattern
        let defaultPattern = '/newcommand';
        let counter = 1;
        while (this.commands.some(cmd => 
            cmd.command_patterns.split(',').map(p => p.trim()).includes(defaultPattern)
        )) {
            defaultPattern = `/newcommand${counter}`;
            counter++;
        }

        this.currentCommand = {
            id: 'new',
            command_patterns: defaultPattern,
            code: '// Write your command code here\nconst user = getUser();\nbot.sendMessage(`Hello ${user.first_name}! 👋`);',
            is_active: true
        };

        this.showCommandEditor();
        this.populateCommandForm();
        this.setModified(false);
        
        // Clear selection from other commands
        document.querySelectorAll('.command-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Focus on command input
        setTimeout(() => {
            const input = document.getElementById('moreCommands');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    async selectCommand(commandId) {
        this.showLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const command = this.commands.find(cmd => cmd.id === commandId);
            if (command) {
                this.currentCommand = command;
                this.showCommandEditor();
                this.populateCommandForm();
                
                // Update UI selection
                document.querySelectorAll('.command-item').forEach(item => {
                    item.classList.remove('active');
                });
                const selectedItem = document.querySelector(`[data-command-id="${commandId}"]`);
                if (selectedItem) selectedItem.classList.add('active');
            }
        } catch (error) {
            console.error('Error loading command:', error);
            this.showError('Failed to load command');
        } finally {
            this.showLoading(false);
        }
    }

    showCommandEditor() {
        const welcomeScreen = document.getElementById('noCommandSelected');
        const editor = document.getElementById('commandEditor');
        
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (editor) editor.style.display = 'block';
    }

    populateCommandForm() {
        if (!this.currentCommand) return;
        
        // Set command patterns as tags
        this.setCommandsToTags(this.currentCommand.command_patterns);
        
        // Set code
        const codeEditor = document.getElementById('commandCode');
        if (codeEditor) codeEditor.value = this.currentCommand.code || '';
        
        // Update UI elements
        const nameElement = document.getElementById('currentCommandName');
        const idElement = document.getElementById('commandId');
        const statusElement = document.getElementById('commandStatus');
        
        if (nameElement) {
            nameElement.textContent = this.currentCommand.id === 'new' ? 'New Command' : 'Edit Command';
        }
        
        if (idElement) {
            idElement.textContent = `ID: ${this.currentCommand.id}`;
        }
        
        if (statusElement) {
            statusElement.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            statusElement.className = `command-status ${this.currentCommand.is_active ? 'status-active' : 'status-inactive'}`;
        }
        
        this.updateButtonStates();
        this.updateCodeStats();
        this.updateLastSaved();
    }

    // Command Tags Management
    addCommandTag(command) {
        if (!command) return;

        const tagsContainer = document.getElementById('commandsTags');
        if (!tagsContainer) return;

        // Check if already exists
        if (this.commandExistsInTags(command)) {
            this.showError(`"${command}" is already added`);
            return;
        }

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
            this.setModified(true);
        });
        
        tagsContainer.appendChild(tag);
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
        const tagsContainer = document.getElementById('commandsTags');
        if (!tagsContainer) return;
        
        tagsContainer.innerHTML = '';
        
        if (typeof commands === 'string') {
            commands = commands.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
        }
        
        if (Array.isArray(commands)) {
            commands.forEach(command => {
                if (command) {
                    this.addCommandTag(command);
                }
            });
        }
    }

    clearCommandPatterns() {
        if (confirm('Clear all command patterns?')) {
            const tagsContainer = document.getElementById('commandsTags');
            if (tagsContainer) {
                tagsContainer.innerHTML = '';
                this.setModified(true);
            }
        }
    }

    // Quick Actions
    handleQuickAction(action) {
        const codeEditor = document.getElementById('commandCode');
        if (!codeEditor) return;

        let snippet = '';
        
        switch (action) {
            case 'send-message':
                snippet = '// Send a message\nbot.sendMessage("Hello! This is your bot speaking. 👋");';
                break;
            case 'user-info':
                snippet = '// Get user info and send greeting\nconst user = getUser();\nbot.sendMessage(`Hello ${user.first_name}! Your ID: ${user.id}`);';
                break;
            case 'buttons':
                snippet = `// Send message with buttons
const buttons = [
    { text: "Option 1", callback_data: "opt1" },
    { text: "Option 2", callback_data: "opt2" }
];
bot.sendMessage("Choose an option:", { 
    reply_markup: {
        inline_keyboard: [buttons]
    }
});`;
                break;
            case 'wait-answer':
                snippet = `// Wait for user response
bot.sendMessage("Please tell me your name:");
const name = waitForAnswer();
bot.sendMessage(\`Nice to meet you, \${name}! 😊\`);`;
                break;
        }
        
        if (snippet) {
            this.insertCodeSnippet(snippet);
            this.showSuccess('Action added!');
        }
    }

    insertCodeSnippet(snippet) {
        const codeEditor = document.getElementById('commandCode');
        if (!codeEditor) return;

        const currentCode = codeEditor.value;
        const cursorPos = codeEditor.selectionStart;
        
        const newCode = currentCode.substring(0, cursorPos) + 
                       '\n' + snippet + '\n' + 
                       currentCode.substring(cursorPos);
        
        codeEditor.value = newCode;
        
        // Set cursor after inserted code
        const newCursorPos = cursorPos + snippet.length + 2;
        codeEditor.setSelectionRange(newCursorPos, newCursorPos);
        
        codeEditor.focus();
        this.setModified(true);
        this.updateCodeStats();
    }

    // Save Command
    async saveCommand() {
        if (!this.currentCommand) {
            this.showError('No command selected');
            return;
        }

        const commands = this.getCommandsFromTags();
        if (commands.length === 0) {
            this.showError('Please add at least one command pattern');
            document.getElementById('moreCommands')?.focus();
            return;
        }

        const codeEditor = document.getElementById('commandCode');
        const commandCode = codeEditor ? codeEditor.value.trim() : '';
        
        if (!commandCode) {
            this.showError('Command code is required');
            codeEditor?.focus();
            return;
        }

        this.showLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (this.currentCommand.id === 'new') {
                // Add new command
                const newCommand = {
                    id: Date.now().toString(),
                    command_patterns: commands.join(','),
                    code: commandCode,
                    is_active: true
                };
                this.commands.push(newCommand);
                this.currentCommand = newCommand;
            } else {
                // Update existing command
                const commandIndex = this.commands.findIndex(cmd => cmd.id === this.currentCommand.id);
                if (commandIndex !== -1) {
                    this.commands[commandIndex] = {
                        ...this.commands[commandIndex],
                        command_patterns: commands.join(','),
                        code: commandCode
                    };
                }
            }
            
            this.showSuccess('Command saved successfully! 🎉');
            await this.loadCommands();
            this.populateCommandForm();
            this.setModified(false);
            
        } catch (error) {
            console.error('Error saving command:', error);
            this.showError('Failed to save command');
        } finally {
            this.showLoading(false);
        }
    }

    // Test Command
    async testCommand() {
        const commands = this.getCommandsFromTags();
        if (commands.length === 0) {
            this.showError('Please add command patterns to test');
            return;
        }

        const codeEditor = document.getElementById('commandCode');
        const commandCode = codeEditor ? codeEditor.value.trim() : '';
        
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            // Simulate API test
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.showTestSuccess(`
                <h4>✅ Test Successful!</h4>
                <div class="test-details">
                    <p><strong>Command:</strong> ${commands[0]}</p>
                    <p><strong>Status:</strong> Executed successfully</p>
                    <p><strong>Response:</strong> "Hello! This is a test response from your bot."</p>
                </div>
                <p class="test-message">Your command is working perfectly! 🎉</p>
            `);
        } catch (error) {
            this.showTestError(`
                <h4>❌ Test Failed</h4>
                <p>There was an error executing your command. Please check your code.</p>
            `);
        }
    }

    async runCustomTest() {
        const testInput = document.getElementById('testInput');
        const input = testInput ? testInput.value.trim() : '';
        
        if (!input) {
            this.showError('Please enter a test command');
            testInput?.focus();
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            this.showTestSuccess(`
                <h4>✅ Test Complete!</h4>
                <div class="test-details">
                    <p><strong>Input:</strong> ${input}</p>
                    <p><strong>Result:</strong> Command processed successfully</p>
                    <p><strong>Response:</strong> "Test completed for: ${input}"</p>
                </div>
            `);
            
            // Clear input
            if (testInput) testInput.value = '';
        } catch (error) {
            this.showTestError(`
                <h4>❌ Test Failed</h4>
                <p>Could not process the test command.</p>
            `);
        }
    }

    async toggleCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') return;

        this.showLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.currentCommand.is_active = !this.currentCommand.is_active;
            this.populateCommandForm();
            await this.loadCommands();
            
            const status = this.currentCommand.is_active ? 'activated' : 'deactivated';
            this.showSuccess(`Command ${status} successfully!`);
        } catch (error) {
            this.showError('Failed to toggle command');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCommand() {
        if (!this.currentCommand || this.currentCommand.id === 'new') return;

        if (!confirm('Are you sure you want to delete this command? This action cannot be undone.')) {
            return;
        }

        this.showLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.commands = this.commands.filter(cmd => cmd.id !== this.currentCommand.id);
            this.showSuccess('Command deleted successfully');
            this.hideCommandEditor();
            await this.loadCommands();
        } catch (error) {
            this.showError('Failed to delete command');
        } finally {
            this.showLoading(false);
        }
    }

    hideCommandEditor() {
        const welcomeScreen = document.getElementById('noCommandSelected');
        const editor = document.getElementById('commandEditor');
        
        if (welcomeScreen) welcomeScreen.style.display = 'flex';
        if (editor) editor.style.display = 'none';
        this.currentCommand = null;
    }

    // Full Screen Editor
    openFullEditor() {
        const codeEditor = document.getElementById('commandCode');
        const fullEditor = document.getElementById('advancedCodeEditor');
        
        if (!codeEditor || !fullEditor) return;
        
        fullEditor.value = codeEditor.value;
        document.getElementById('codeEditorModal').style.display = 'flex';
        
        // Focus and set cursor to end
        setTimeout(() => {
            fullEditor.focus();
            fullEditor.setSelectionRange(fullEditor.value.length, fullEditor.value.length);
        }, 100);
    }

    saveFullEditorCode() {
        const fullEditor = document.getElementById('advancedCodeEditor');
        const codeEditor = document.getElementById('commandCode');
        
        if (!fullEditor || !codeEditor) return;
        
        codeEditor.value = fullEditor.value;
        document.getElementById('codeEditorModal').style.display = 'none';
        
        this.setModified(true);
        this.updateCodeStats();
        this.showSuccess('Code saved!');
    }

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;
        
        // Simple formatting - just basic indentation
        const code = editor.value;
        const lines = code.split('\n');
        let formatted = [];
        let indent = 0;
        
        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                formatted.push('');
                continue;
            }
            
            // Decrease indent for closing braces
            if (trimmed.endsWith('}') || trimmed.endsWith(']') || trimmed.endsWith(')')) {
                indent = Math.max(0, indent - 1);
            }
            
            formatted.push('    '.repeat(indent) + trimmed);
            
            // Increase indent for opening braces
            if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
                indent++;
            }
        }
        
        editor.value = formatted.join('\n');
        this.showSuccess('Code formatted!');
    }

    clearAdvancedEditor() {
        const editor = document.getElementById('advancedCodeEditor');
        if (editor && confirm('Clear all code?')) {
            editor.value = '';
        }
    }

    // Snippets System
    showSnippetsModal() {
        const snippets = this.getSnippets();
        const grid = document.getElementById('snippetsGrid');
        
        if (!grid) return;
        
        let html = '';
        snippets.forEach((snippet, index) => {
            html += `
                <div class="snippet-card">
                    <div class="snippet-content">
                        <div class="snippet-icon">
                            <i class="${snippet.icon}"></i>
                        </div>
                        <div class="snippet-details">
                            <h4>${snippet.name}</h4>
                            <p>${snippet.description}</p>
                            <div class="snippet-code">${this.escapeHtml(snippet.code)}</div>
                        </div>
                    </div>
                    <div class="snippet-footer">
                        <button class="btn-apply" data-code="${this.escapeHtml(snippet.code)}">
                            <i class="fas fa-plus"></i> Insert
                        </button>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        
        // Add event listeners
        grid.querySelectorAll('.btn-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.closest('.btn-apply').dataset.code;
                this.insertCodeSnippet(code);
                document.getElementById('snippetsModal').style.display = 'none';
            });
        });
        
        document.getElementById('snippetsModal').style.display = 'flex';
    }

    getSnippets() {
        return [
            {
                name: 'Send Welcome',
                description: 'Send a welcome message to users',
                code: '// Welcome message\nconst user = getUser();\nbot.sendMessage(`Welcome ${user.first_name}! 🎉`);',
                icon: 'fas fa-hand-wave'
            },
            {
                name: 'User Profile',
                description: 'Show user profile information',
                code: '// User profile\nconst user = getUser();\nconst profile = `👤 User Profile:\nName: ${user.first_name} ${user.last_name || ""}\nID: ${user.id}\nUsername: @${user.username || "none"}`;\nbot.sendMessage(profile);',
                icon: 'fas fa-user'
            },
            {
                name: 'Quick Reply',
                description: 'Send a message with quick reply buttons',
                code: '// Quick reply buttons\nconst buttons = [\n    [{ text: "Yes ✅", callback_data: "yes" }, { text: "No ❌", callback_data: "no" }]\n];\nbot.sendMessage("Do you like this bot?", { reply_markup: { inline_keyboard: buttons } });',
                icon: 'fas fa-reply'
            },
            {
                name: 'Random Number',
                description: 'Generate and send a random number',
                code: '// Random number\nconst random = Math.floor(Math.random() * 100) + 1;\nbot.sendMessage(`🎲 Your random number: ${random}`);',
                icon: 'fas fa-dice'
            },
            {
                name: 'Current Time',
                description: 'Send current date and time',
                code: '// Current time\nconst now = new Date();\nbot.sendMessage(`🕒 Current time: ${now.toLocaleString()}`);',
                icon: 'fas fa-clock'
            },
            {
                name: 'Echo Command',
                description: 'Repeat what the user says',
                code: '// Echo user message\nbot.sendMessage("What should I repeat?");\nconst message = waitForAnswer();\nbot.sendMessage(`You said: ${message}`);',
                icon: 'fas fa-comment-alt'
            }
        ];
    }

    filterSnippets(searchTerm) {
        const grid = document.getElementById('snippetsGrid');
        if (!grid) return;
        
        const cards = grid.querySelectorAll('.snippet-card');
        const search = searchTerm.toLowerCase().trim();
        
        cards.forEach(card => {
            const title = card.querySelector('h4').textContent.toLowerCase();
            const desc = card.querySelector('p').textContent.toLowerCase();
            const code = card.querySelector('.snippet-code').textContent.toLowerCase();
            
            const visible = title.includes(search) || desc.includes(search) || code.includes(search);
            card.style.display = visible ? 'block' : 'none';
        });
    }

    // Utility Functions
    filterCommands(searchTerm) {
        const items = document.querySelectorAll('.command-item');
        const search = searchTerm.toLowerCase().trim();
        
        if (!search) {
            items.forEach(item => item.style.display = 'block');
            return;
        }
        
        items.forEach(item => {
            const patterns = item.querySelector('.command-patterns').textContent.toLowerCase();
            const visible = patterns.includes(search);
            item.style.display = visible ? 'block' : 'none';
        });
    }

    updateButtonStates() {
        const isNew = this.currentCommand?.id === 'new';
        const deleteBtn = document.getElementById('deleteCommandBtn');
        const toggleBtn = document.getElementById('toggleCommandBtn');
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
            deleteBtn.style.opacity = isNew ? '0.6' : '1';
        }
        
        if (toggleBtn) {
            const text = this.currentCommand?.is_active ? 'Deactivate' : 'Activate';
            toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${text}`;
        }
    }

    updateCodeStats() {
        const codeEditor = document.getElementById('commandCode');
        const stats = document.getElementById('codeStats');
        
        if (!codeEditor || !stats) return;
        
        const code = codeEditor.value;
        const lines = code.split('\n').length;
        const chars = code.length;
        const words = code.trim() ? code.trim().split(/\s+/).length : 0;
        
        stats.textContent = `Lines: ${lines} • Words: ${words}`;
    }

    updateLastSaved() {
        const element = document.getElementById('lastSaved');
        if (element) {
            element.textContent = this.currentCommand?.id === 'new' ? 
                'Not saved yet' : 
                `Last saved: ${new Date().toLocaleTimeString()}`;
        }
    }

    setModified(modified) {
        this.isModified = modified;
        
        const saveButtons = ['saveCommandBtn', 'saveFooterBtn'];
        saveButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                if (modified) {
                    btn.classList.add('btn-pulse');
                    btn.innerHTML = `<i class="fas fa-save"></i> Save *`;
                } else {
                    btn.classList.remove('btn-pulse');
                    btn.innerHTML = `<i class="fas fa-save"></i> Save`;
                }
            }
        });
    }

    // Bot Info
    async loadBotInfo() {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Mock bot data
            this.currentBot = {
                name: 'My Awesome Bot',
                username: 'my_awesome_bot'
            };
            
            this.updateBotInfo();
        } catch (error) {
            console.error('Error loading bot info:', error);
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            const nameEl = document.getElementById('botName');
            const usernameEl = document.getElementById('botUsername');
            
            if (nameEl) nameEl.textContent = `Commands - ${this.currentBot.name}`;
            if (usernameEl) usernameEl.textContent = `@${this.currentBot.username}`;
        }
    }

    // Auth
    async checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }
        // In real app, verify token with server
    }

    // Navigation
    goBack() {
        if (this.isModified && !confirm('You have unsaved changes. Are you sure you want to leave?')) {
            return;
        }
        window.location.href = 'bot-management.html';
    }

    quickTest() {
        if (this.currentCommand) {
            this.testCommand();
        } else {
            this.showError('Please select or create a command first');
        }
    }

    showTemplates() {
        this.showSnippetsModal();
    }

    // UI Helpers
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showTestModal() {
        document.getElementById('testCommandModal').style.display = 'flex';
    }

    showTestLoading() {
        const result = document.getElementById('testCommandResult');
        if (result) {
            result.innerHTML = `
                <div class="test-loading">
                    <div class="spinner"></div>
                    <p>Testing command execution...</p>
                </div>
            `;
        }
    }

    showTestSuccess(html) {
        const result = document.getElementById('testCommandResult');
        if (result) {
            result.innerHTML = `
                <div class="test-success">
                    ${html}
                </div>
            `;
        }
    }

    showTestError(html) {
        const result = document.getElementById('testCommandResult');
        if (result) {
            result.innerHTML = `
                <div class="test-error">
                    ${html}
                </div>
            `;
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Use common notification system if available
        if (typeof commonApp !== 'undefined' && commonApp.showNotification) {
            commonApp.showNotification(message, type);
        } else {
            // Simple fallback
            console.log(`${type}: ${message}`);
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
                color: white;
                z-index: 10000;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 4000);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize the editor when page loads
let commandEditor;

document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
});