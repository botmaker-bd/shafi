class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
        this.currentEditorType = null;
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        await this.loadTemplates();
        this.setupCodeEditor();
        this.setupCommandsTags();
    }

    async loadTemplates() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/templates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to load templates');
            }

            const data = await response.json();
            if (data.success) {
                this.templates = data.templates;
                this.populateTemplatesModal();
            } else {
                console.error('❌ Failed to load templates:', data.error);
                this.loadDefaultTemplates();
            }
        } catch (error) {
            console.error('❌ Load templates error:', error);
            this.loadDefaultTemplates();
        }
    }

    loadDefaultTemplates() {
        this.templates = {
            basic: [
                {
                    name: "Welcome Message",
                    patterns: "/start, start, hello",
                    code: `const user = getUser();\nconst chatId = getChatId();\n\nbot.sendMessage(chatId, \\`🎉 Hello \\${user.first_name}! Welcome to our bot!\\\\n\\\\n🤖 I can help you with:\\\\n/start - Show this welcome message\\\\n/help - Get help\\\\n/info - Bot information\\\\n\\\\nChoose a command or type your message!\\`);`,
                    description: "Simple welcome message with user info"
                },
                {
                    name: "Help Command",
                    patterns: "/help, help, commands",
                    code: `const commands = [\n    "/start - Welcome message",\n    "/help - Show this help", \n    "/info - Bot information",\n    "/echo - Repeat your message"\n].join('\\\\n');\n\nbot.sendMessage(getChatId(), \\`🤖 **Available Commands:**\\\\n\\\\n\\${commands}\\`);`,
                    description: "Display available commands"
                }
            ],
            interactive: [
                {
                    name: "Interactive Conversation",
                    patterns: "/conversation, chat, talk",
                    code: `const user = getUser();\n\n// Ask first question\nawait bot.sendMessage(\\`Hello \\${user.first_name}! What's your name?\\`);\n\n// Wait for answer\nconst name = await waitForAnswer();\n\n// Ask second question\nawait bot.sendMessage(\\`Nice to meet you, \\${name}! How old are you?\\`);\n\n// Wait for age\nconst age = await waitForAnswer();\n\n// Send final message\nbot.sendMessage(\\`Thank you! Your name is \\${name} and you are \\${age} years old.\\`);`,
                    description: "Multiple questions with wait for answer",
                    waitForAnswer: true,
                    answerHandler: `// This code handles user's answers\nconst userInput = getUserInput();\nconst currentQuestion = getCurrentQuestion();\n\nif (currentQuestion === 'name') {\n    // Save name and ask next question\n    User.saveData('name', userInput);\n    bot.sendMessage("Nice! Now, what's your age?");\n} else if (currentQuestion === 'age') {\n    // Save age and show summary\n    User.saveData('age', userInput);\n    const name = User.getData('name');\n    bot.sendMessage(\\`Great! \\${name}, you are \\${userInput} years old.\\`);\n}`
                }
            ]
        };
        this.populateTemplatesModal();
    }

    populateTemplatesModal() {
        const categoryTabs = document.querySelector('.category-tabs');
        const templatesContent = document.querySelector('.templates-content');
        
        if (!categoryTabs || !templatesContent) return;

        // Clear existing content
        categoryTabs.innerHTML = '';
        templatesContent.innerHTML = '';

        let firstCategory = true;

        for (const [category, templates] of Object.entries(this.templates)) {
            if (!templates || templates.length === 0) continue;

            // Create category tab
            const tab = document.createElement('button');
            tab.className = `category-tab ${firstCategory ? 'active' : ''}`;
            tab.textContent = this.capitalizeFirstLetter(category);
            tab.dataset.category = category;
            
            tab.addEventListener('click', () => {
                document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.template-category').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const categoryElement = document.getElementById(`${category}-templates`);
                if (categoryElement) {
                    categoryElement.classList.add('active');
                }
            });

            categoryTabs.appendChild(tab);

            // Create category content
            const categoryDiv = document.createElement('div');
            categoryDiv.id = `${category}-templates`;
            categoryDiv.className = `template-category ${firstCategory ? 'active' : ''}`;
            
            const templatesGrid = document.createElement('div');
            templatesGrid.className = 'templates-grid';

            templates.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'template-card';
                templateCard.dataset.template = JSON.stringify(template).replace(/'/g, "&#39;");
                
                templateCard.innerHTML = `
                    <div class="template-icon">
                        <i class="fas fa-${this.getTemplateIcon(category)}"></i>
                    </div>
                    <h4>${this.escapeHtml(template.name)}</h4>
                    <p>${this.escapeHtml(template.description || 'No description')}</p>
                    <div class="template-patterns">${this.escapeHtml(template.patterns)}</div>
                `;

                templatesGrid.appendChild(templateCard);
            });

            categoryDiv.appendChild(templatesGrid);
            templatesContent.appendChild(categoryDiv);

            firstCategory = false;
        }

        // If no templates found
        if (categoryTabs.children.length === 0) {
            templatesContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h3>No Templates Available</h3>
                    <p>Templates will be loaded from server/templates/ directory</p>
                </div>
            `;
        }
    }

    getTemplateIcon(category) {
        const icons = {
            basic: 'code',
            interactive: 'comments',
            media: 'image',
            buttons: 'th',
            data: 'database',
            http: 'cloud',
            advanced: 'cogs',
            python: 'python',
            games: 'gamepad',
            utility: 'tools'
        };
        return icons[category] || 'code';
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
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

        // Copy result button
        document.getElementById('copyResultBtn').addEventListener('click', () => {
            this.copyTestResult();
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
        
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeCodeEditor();
        });

        document.getElementById('saveCode').addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        // Editor toolbar functionality
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            advancedEditor.select();
        });

        document.getElementById('cutBtn').addEventListener('click', () => {
            document.execCommand('cut');
        });

        document.getElementById('copyBtn').addEventListener('click', () => {
            document.execCommand('copy');
        });

        document.getElementById('pasteBtn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                advancedEditor.value += text;
            } catch (error) {
                document.execCommand('paste');
            }
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            advancedEditor.value = '';
            this.updateLineCount('');
        });

        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatCode(advancedEditor);
        });

        advancedEditor.addEventListener('input', (e) => {
            this.updateLineCount(e.target.value);
        });

        this.updateLineCount(advancedEditor.value);
    }

    formatCode(textarea) {
        const code = textarea.value;
        try {
            // Simple formatting - you can enhance this with a proper formatter
            const formatted = code
                .replace(/\n\s*\n/g, '\n\n') // Remove extra empty lines
                .replace(/\t/g, '    ') // Convert tabs to spaces
                .replace(/;\s*\n/g, ';\n') // Clean up semicolons
                .trim() + '\n';
            
            textarea.value = formatted;
            this.updateLineCount(formatted);
            this.showSuccess('Code formatted!');
        } catch (error) {
            this.showError('Formatting failed');
        }
    }

    updateLineCount(code) {
        const lines = code.split('\n').length;
        const chars = code.length;
        document.getElementById('lineCount').textContent = `Line: ${lines}`;
        document.getElementById('charCount').textContent = `Chars: ${chars}`;
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

        // Template card click events
        document.addEventListener('click', (e) => {
            const templateCard = e.target.closest('.template-card');
            if (templateCard) {
                const templateData = templateCard.dataset.template;
                if (templateData) {
                    try {
                        const template = JSON.parse(templateData.replace(/&#39;/g, "'"));
                        this.applyTemplate(template);
                    } catch (error) {
                        console.error('❌ Template parsing error:', error);
                    }
                }
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

            if (!response.ok) {
                throw new Error('Bot not found');
            }

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
            window.location.href = 'bot-management.html';
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

            if (!response.ok) {
                throw new Error('Failed to load commands');
            }

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

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            const patterns = command.command_patterns.split(',').slice(0, 2).join(', ');
            const hasMorePatterns = command.command_patterns.split(',').length > 2;
            
            html += `
                <div class="command-group ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-icon">
                        <i class="fas fa-code"></i>
                    </div>
                    <div class="command-content">
                        <div class="command-header">
                            <div class="command-name">${this.escapeHtml(command.command_patterns.split(',')[0])}</div>
                            <div class="command-patterns" title="${this.escapeHtml(command.command_patterns)}">
                                ${this.escapeHtml(patterns)}${hasMorePatterns ? '...' : ''}
                            </div>
                        </div>
                        ${command.description ? `<div class="command-description">${this.escapeHtml(command.description)}</div>` : ''}
                        <div class="command-meta">
                            <span class="command-status ${isActive ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i>
                                ${isActive ? 'Active' : 'Inactive'}
                            </span>
                            ${command.wait_for_answer ? '<span class="command-feature">⏳ Waits</span>' : ''}
                            <span class="command-id">ID: ${command.id.substring(0, 8)}...</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        commandsList.innerHTML = html;

        // Add click event listeners to command groups
        document.querySelectorAll('.command-group').forEach(group => {
            group.addEventListener('click', () => {
                const commandId = group.dataset.commandId;
                this.selectCommand(commandId);
            });
        });
    }

    filterCommands(searchTerm) {
        const commandGroups = document.querySelectorAll('.command-group');
        const lowerSearch = searchTerm.toLowerCase().trim();

        if (!lowerSearch) {
            commandGroups.forEach(group => group.style.display = 'block');
            return;
        }

        commandGroups.forEach(group => {
            const commandPattern = group.querySelector('.command-patterns').textContent.toLowerCase();
            const commandName = group.querySelector('.command-name').textContent.toLowerCase();
            const isVisible = commandPattern.includes(lowerSearch) || commandName.includes(lowerSearch);
            group.style.display = isVisible ? 'block' : 'none';
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            command_patterns: '/start',
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

            if (!response.ok) {
                throw new Error('Failed to load command');
            }

            const data = await response.json();

            if (data.success) {
                this.currentCommand = data.command;
                this.showCommandEditor();
                this.populateCommandForm();
                
                // Update UI selection
                document.querySelectorAll('.command-group').forEach(group => {
                    group.classList.remove('active');
                });
                
                const selectedGroup = document.querySelector(`[data-command-id="${commandId}"]`);
                if (selectedGroup) {
                    selectedGroup.classList.add('active');
                    selectedGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        
        document.getElementById('commandName').value = this.currentCommand.command_patterns.split(',')[0] || '';
        document.getElementById('commandDescription').value = this.currentCommand.description || '';
        this.setCommandsToTags(this.currentCommand.command_patterns);
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        document.getElementById('answerHandler').value = this.currentCommand.answer_handler || '';
        document.getElementById('currentCommandName').textContent = this.currentCommand.command_patterns.split(',')[0] || 'Command Editor';
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
        const commandName = document.getElementById('commandName').value.trim();
        const commandDescription = document.getElementById('commandDescription').value.trim();
        
        if (commands.length === 0) {
            this.showError('Please add at least one command pattern');
            document.getElementById('moreCommands').focus();
            return false;
        }

        if (!commandName) {
            this.showError('Command name is required');
            document.getElementById('commandName').focus();
            return false;
        }

        const commandPatterns = commands.join(',');
        const commandCode = document.getElementById('commandCode').value.trim();

        if (!commandCode) {
            this.showError('Command code is required');
            document.getElementById('commandCode').focus();
            return false;
        }

        const formData = {
            commandPatterns: commandPatterns,
            code: commandCode,
            description: commandDescription,
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
                    
                    // Auto-select the saved command
                    setTimeout(() => {
                        const commandGroup = document.querySelector(`[data-command-id="${this.currentCommand.id}"]`);
                        if (commandGroup) {
                            commandGroup.click();
                        }
                    }, 500);
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
            this.showError('Please add at least one command pattern to test');
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
                command_patterns: commands.join(','),
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
                    testInput: commands[0] // Use first command pattern for testing
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showDetailedTestResult(data, commands[0]);
            } else {
                this.showTestError(`
                    ❌ Test Failed

                    Error: ${data.error || 'Unknown error occurred'}
                    ${data.details ? `Details: ${data.details}` : ''}
                `);
            }
        } catch (error) {
            this.showTestError(`
                ❌ Network Error

                Failed to connect to server: ${error.message}
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
                command_patterns: testInput || commands.join(','),
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
                this.showDetailedTestResult(data, testInput || commands[0]);
            } else {
                this.showTestError(`
                    ❌ Test Failed

                    Error: ${data.error || 'Unknown error occurred'}
                    ${data.details ? `Details: ${data.details}` : ''}
                `);
            }
        } catch (error) {
            this.showTestError(`
                ❌ Network Error

                Failed to connect to server: ${error.message}
            `);
        }
    }

    showDetailedTestResult(data, testInput) {
        const resultDiv = document.getElementById('testCommandResult');
        
        // Determine result type
        const isSuccess = data.success && !data.rawResult?.error;
        const hasTelegramResponse = data.telegramResponse && data.telegramResponse !== 'Command executed without return value';
        const hasBotReply = data.botReply && data.botReply !== 'Command executed without return value';

        let html = `
            <div class="test-result-container">
                <div class="result-header">
                    <h4 class="${isSuccess ? 'text-success' : 'text-error'}">
                        ${isSuccess ? '✅ Test Successful' : '⚠️ Test Completed with Issues'}
                    </h4>
                </div>

                <div class="test-result-grid">
        `;

        // Telegram Request Section
        html += `
            <div class="test-result-item ${isSuccess ? 'success' : 'warning'}">
                <div class="result-title">
                    <i class="fas fa-paper-plane"></i>
                    <span>Telegram Request</span>
                    <span class="response-type">📤 Outgoing</span>
                </div>
                <div class="result-content">
                    <strong>Message:</strong> ${testInput}<br>
                    <strong>Bot:</strong> ${this.currentBot.name}<br>
                    <strong>Time:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
        `;

        // Telegram Response Section
        if (hasTelegramResponse) {
            html += `
                <div class="test-result-item success">
                    <div class="result-title">
                        <i class="fas fa-reply"></i>
                        <span>Telegram Response</span>
                        <span class="response-type">📥 Incoming</span>
                    </div>
                    <div class="result-content">
                        ${data.telegramResponse.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // Execution Details Section
        if (data.executionDetails) {
            html += `
                <div class="test-result-item">
                    <div class="result-title">
                        <i class="fas fa-cogs"></i>
                        <span>Execution Details</span>
                        <span class="response-type">🔧 Technical</span>
                    </div>
                    <div class="result-content">
                        ${data.executionDetails.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // Bot Reply Section
        if (hasBotReply) {
            const replyType = data.botReply.includes('❌') || data.botReply.includes('Error') ? 'error' : 'success';
            html += `
                <div class="test-result-item ${replyType}">
                    <div class="result-title">
                        <i class="fas fa-robot"></i>
                        <span>Bot Response</span>
                        <span class="response-type">🤖 AI</span>
                    </div>
                    <div class="result-content">
                        ${data.botReply.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // Raw Result Section (for debugging)
        if (data.rawResult) {
            html += `
                <div class="test-result-item">
                    <div class="result-title">
                        <i class="fas fa-code"></i>
                        <span>Raw Execution Result</span>
                        <span class="response-type">📊 Debug</span>
                    </div>
                    <div class="result-content">
                        <pre style="font-size: 0.75rem; margin: 0;">${JSON.stringify(data.rawResult, null, 2)}</pre>
                    </div>
                </div>
            `;
        }

        html += `
                </div>

                <div class="test-summary" style="margin-top: 1rem; padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md);">
                    <div class="result-title">
                        <i class="fas fa-chart-bar"></i>
                        <span>Test Summary</span>
                    </div>
                    <div class="result-content">
                        <strong>Status:</strong> ${isSuccess ? '✅ Success' : '⚠️ Completed with issues'}<br>
                        <strong>Command:</strong> ${testInput}<br>
                        <strong>Bot:</strong> ${this.currentBot.name}<br>
                        <strong>Execution Time:</strong> ${new Date().toLocaleString()}<br>
                        ${data.rawResult?.error ? `<strong>Error:</strong> ${data.rawResult.error}` : ''}
                    </div>
                </div>
            </div>
        `;

        resultDiv.innerHTML = html;
    }

    showTestError(html) {
        const resultDiv = document.getElementById('testCommandResult');
        resultDiv.innerHTML = `
            <div class="test-error">
                <div class="result-header">
                    <h4>❌ Test Failed</h4>
                </div>
                <div class="test-result-container">
                    <div class="test-result-grid">
                        <div class="test-result-item error">
                            <div class="result-title">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span>Error Details</span>
                            </div>
                            <div class="result-content">${html.replace(/\n/g, '<br>')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    copyTestResult() {
        const resultContainer = document.querySelector('.test-result-container');
        if (!resultContainer) return;

        let text = '🤖 Bot Maker Pro - Test Results\n';
        text += '='.repeat(50) + '\n\n';

        // Collect all result items
        const resultItems = resultContainer.querySelectorAll('.test-result-item');
        resultItems.forEach(item => {
            const title = item.querySelector('.result-title')?.textContent?.trim();
            const content = item.querySelector('.result-content')?.textContent?.trim();
            
            if (title && content) {
                text += `📋 ${title}:\n`;
                text += content + '\n';
                text += '-'.repeat(30) + '\n\n';
            }
        });

        // Add summary if available
        const summary = resultContainer.querySelector('.test-summary');
        if (summary) {
            const summaryContent = summary.querySelector('.result-content')?.textContent?.trim();
            if (summaryContent) {
                text += '📊 Test Summary:\n';
                text += summaryContent + '\n';
            }
        }

        navigator.clipboard.writeText(text).then(() => {
            this.showSuccess('Test results copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('Test results copied to clipboard!');
        });
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

    showTemplates() {
        document.getElementById('templatesModal').style.display = 'flex';
    }

    applyTemplate(template) {
        this.setCommandsToTags(template.patterns);
        document.getElementById('commandCode').value = template.code;
        
        if (template.waitForAnswer) {
            document.getElementById('waitForAnswer').checked = true;
            this.toggleAnswerHandler(true);
            document.getElementById('answerHandler').value = template.answerHandler || '';
        } else {
            document.getElementById('waitForAnswer').checked = false;
            this.toggleAnswerHandler(false);
        }
        
        document.getElementById('templatesModal').style.display = 'none';
        this.showSuccess('Template applied successfully!');
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
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
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