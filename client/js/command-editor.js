// Enhanced Command Editor JavaScript - Fixed Version
class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
        this.currentEditorType = 'main';
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

    async loadTemplatesFromServer() {
        try {
            this.showLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('/api/templates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.templates = data.templates;
                    this.populateTemplatesModal();
                    return true;
                } else {
                    throw new Error(data.error || 'Failed to load templates');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Load templates error:', error);
            this.showTemplatesError(`Failed to load templates: ${error.message}`);
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    populateTemplatesModal() {
        const templatesContent = document.querySelector('.templates-content');
        if (!templatesContent) return;

        if (!this.templates || Object.keys(this.templates).length === 0) {
            templatesContent.innerHTML = `
                <div class="template-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No templates available</p>
                    <p class="template-help">Templates will be loaded from the server</p>
                </div>
            `;
            return;
        }

        let html = '';

        for (const [category, templates] of Object.entries(this.templates)) {
            const categoryId = `${category}-templates`;
            const isActive = category === 'basic' ? 'active' : '';
            
            if (templates && templates.length > 0) {
                html += `
                    <div id="${categoryId}" class="template-category ${isActive}">
                        <div class="templates-grid">
                            ${templates.map(template => `
                                <div class="template-card" data-template='${JSON.stringify(template).replace(/'/g, "&#39;")}'>
                                    <div class="template-icon">
                                        <i class="fas fa-${this.getTemplateIcon(category)}"></i>
                                    </div>
                                    <h4>${this.escapeHtml(template.name)}</h4>
                                    <p>${this.escapeHtml(template.description)}</p>
                                    <div class="template-preview">
                                        <strong>Patterns:</strong> ${this.escapeHtml(template.patterns)}
                                        <div class="template-code-preview">
                                            ${this.escapeHtml(template.code.substring(0, 100))}...
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // If no templates were added, show empty state
        if (!html) {
            html = `
                <div class="template-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No templates found in any category</p>
                </div>
            `;
        }

        templatesContent.innerHTML = html;
    }

    showTemplatesError(message) {
        const templatesContent = document.querySelector('.templates-content');
        if (templatesContent) {
            templatesContent.innerHTML = `
                <div class="template-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button class="btn btn-primary btn-small" id="retryTemplates">
                        <i class="fas fa-redo"></i> Retry Loading
                    </button>
                </div>
            `;

            document.getElementById('retryTemplates')?.addEventListener('click', () => {
                this.loadTemplatesFromServer();
            });
        }
    }

    getTemplateIcon(category) {
        const icons = {
            'basic': 'code',
            'interactive': 'comments',
            'media': 'image',
            'buttons': 'th',
            'data': 'database',
            'http': 'cloud',
            'advanced': 'cogs'
        };
        return icons[category] || 'code';
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

        // Quick test button
        document.getElementById('runQuickTestBtn').addEventListener('click', () => {
            this.runQuickTest();
        });

        // Enter key for quick test
        document.getElementById('quickTestInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.runQuickTest();
            }
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
        document.getElementById('showTemplates').addEventListener('click', async () => {
            await this.showTemplates();
        });

        document.getElementById('refreshTemplates').addEventListener('click', async () => {
            await this.loadTemplatesFromServer();
        });

        // Search
        let searchTimeout;
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Copy result button
        document.getElementById('copyResultBtn').addEventListener('click', () => {
            this.copyTestResult();
        });

        // Modal events
        this.setupModalEvents();
        this.setupTemplateCategories();

        // Command group click events
        document.addEventListener('click', (e) => {
            const commandGroup = e.target.closest('.command-group');
            if (commandGroup) {
                const commandId = commandGroup.dataset.commandId;
                if (commandId) {
                    this.selectCommand(commandId);
                }
            }
        });
    }

    async showTemplates() {
        // Show loading state
        const templatesContent = document.querySelector('.templates-content');
        if (templatesContent) {
            templatesContent.innerHTML = `
                <div class="template-loading">
                    <div class="spinner"></div>
                    <p>Loading templates from server...</p>
                </div>
            `;
        }

        // Show modal first
        document.getElementById('templatesModal').style.display = 'flex';
        
        // Then load templates
        await this.loadTemplatesFromServer();
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
                        const template = JSON.parse(templateData);
                        this.applyTemplate(template);
                    } catch (error) {
                        console.error('Error parsing template:', error);
                        this.showError('Failed to apply template');
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

    setupTemplateCategories() {
        const categoryTabs = document.querySelectorAll('.category-tab');

        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                
                // Update tabs
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update content
                const templateCategories = document.querySelectorAll('.template-category');
                templateCategories.forEach(cat => cat.classList.remove('active'));
                
                const targetCategory = document.getElementById(`${category}-templates`);
                if (targetCategory) {
                    targetCategory.classList.add('active');
                }
            });
        });
    }

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        
        // Cancel button
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeCodeEditor();
        });

        // Save button
        document.getElementById('saveCode').addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        // Editor input events
        advancedEditor.addEventListener('input', (e) => {
            this.updateLineCount(e.target.value);
        });

        // Editor toolbar buttons
        this.setupEditorToolbar();

        this.updateLineCount(advancedEditor.value);
    }

    setupEditorToolbar() {
        const editor = document.getElementById('advancedCodeEditor');
        
        // Undo/Redo functionality
        document.getElementById('undoBtn').addEventListener('click', () => {
            document.execCommand('undo');
            editor.focus();
        });

        document.getElementById('redoBtn').addEventListener('click', () => {
            document.execCommand('redo');
            editor.focus();
        });

        // Select All
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            editor.select();
            editor.focus();
        });

        // Cut
        document.getElementById('cutBtn').addEventListener('click', () => {
            document.execCommand('cut');
            editor.focus();
        });

        // Copy
        document.getElementById('copyBtn').addEventListener('click', () => {
            document.execCommand('copy');
            editor.focus();
        });

        // Paste
        document.getElementById('pasteBtn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                editor.focus();
                document.execCommand('insertText', false, text);
            } catch (err) {
                // Fallback for browsers that don't support clipboard API
                document.execCommand('paste');
                editor.focus();
            }
        });

        // Clear
        document.getElementById('clearBtn').addEventListener('click', () => {
            editor.value = '';
            this.updateLineCount('');
            editor.focus();
        });

        // Format (basic indentation)
        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatCode();
            editor.focus();
        });
    }

    formatCode() {
        const editor = document.getElementById('advancedCodeEditor');
        let code = editor.value;
        
        // Basic formatting - add proper indentation
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        
        for (let line of lines) {
            line = line.trim();
            
            // Decrease indent for closing braces
            if (line.includes('}') || line.includes(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add current line with proper indentation
            formattedLines.push('    '.repeat(indentLevel) + line);
            
            // Increase indent for opening braces
            if (line.includes('{') || line.includes('(')) {
                indentLevel++;
            }
        }
        
        editor.value = formattedLines.join('\n');
        this.updateLineCount(editor.value);
        this.showSuccess('Code formatted!');
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');

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

    async runQuickTest() {
        const testInput = document.getElementById('quickTestInput').value.trim();
        
        if (!testInput) {
            this.showError('Please enter a command to test');
            return;
        }

        if (!this.currentCommand || this.currentCommand.id === 'new') {
            this.showError('Please save the command first before testing');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const response = await fetch('/api/commands/test-input', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    commandId: this.currentCommand.id,
                    testInput: testInput,
                    botToken: this.currentBot.token
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showTestSuccess(`
                    ✅ Command Test Executed Successfully!

                    🎯 Test Input: ${testInput}
                    🤖 Bot: ${this.currentBot.name}
                    📊 Status: Command executed successfully

                    📨 Telegram Response:
                    ${data.telegramResponse || 'Message sent to Telegram bot'}

                    🔍 Execution Details:
                    ${data.executionDetails || 'Command processed without errors'}

                    💬 Bot Reply:
                    ${data.botReply || 'Check your Telegram bot for the response'}
                `);
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
                    botToken: this.currentBot.token
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showTestSuccess(`
                    ✅ Test Command Sent Successfully!

                    Commands: ${commands.join(', ')}
                    Bot: ${this.currentBot.name}
                    Status: Command executed without errors

                    📨 Message sent to Telegram:
                    ${data.telegramResponse || 'Check your bot for results'}

                    🔍 Execution Result:
                    ${data.executionResult || 'No specific result returned'}
                `);
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
        const resultDiv = document.getElementById('testCommandResult');
        resultDiv.innerHTML = `
            <div class="test-success">
                <div class="result-header">
                    <h4>✅ Test Successful</h4>
                </div>
                <div class="test-result-container">
                    <button class="copy-btn" onclick="commandEditor.copyTestResult()">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <div class="test-result-content">${html}</div>
                </div>
            </div>
        `;
    }

    showTestError(html) {
        const resultDiv = document.getElementById('testCommandResult');
        resultDiv.innerHTML = `
            <div class="test-error">
                <div class="result-header">
                    <h4>❌ Test Failed</h4>
                </div>
                <div class="test-result-container">
                    <button class="copy-btn" onclick="commandEditor.copyTestResult()">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <div class="test-result-content">${html}</div>
                </div>
            </div>
        `;
    }

    copyTestResult() {
        const resultContent = document.querySelector('.test-result-content');
        if (resultContent) {
            const text = resultContent.textContent || resultContent.innerText;
            navigator.clipboard.writeText(text).then(() => {
                this.showSuccess('Result copied to clipboard!');
            }).catch(() => {
                this.showError('Failed to copy result');
            });
        }
    }

    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        
        if (editorType === 'main') {
            code = document.getElementById('commandCode').value;
            document.getElementById('editorType').textContent = 'Editor: Main Code';
        } else if (editorType === 'answer') {
            code = document.getElementById('answerHandler').value;
            document.getElementById('editorType').textContent = 'Editor: Answer Handler';
        }
        
        const advancedEditor = document.getElementById('advancedCodeEditor');
        advancedEditor.value = code;
        this.updateLineCount(code);
        
        // Show modal
        document.getElementById('codeEditorModal').style.display = 'flex';
        
        // Focus and set cursor position after a short delay
        setTimeout(() => {
            advancedEditor.focus();
            advancedEditor.setSelectionRange(0, 0);
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
        this.showSuccess('Code saved successfully!');
    }

    updateLineCount(code) {
        const lines = code.split('\n').length;
        const chars = code.length;
        document.getElementById('lineCount').textContent = `Line: ${lines}`;
        document.getElementById('charCount').textContent = `Chars: ${chars}`;
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        section.style.display = show ? 'block' : 'none';
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

    async loadCommands() {
        if (!this.currentBot) return;

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/bot/${this.currentBot.id}`, {
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

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            
            html += `
                <div class="command-group ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-icon">
                        <i class="fas fa-code"></i>
                    </div>
                    <div class="command-content">
                        <div class="command-patterns">
                            ${this.escapeHtml(command.command_patterns)}
                        </div>
                        <div class="command-meta">
                            <span class="command-status ${isActive ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i>
                                ${isActive ? 'Active' : 'Inactive'}
                            </span>
                            ${command.wait_for_answer ? '<span class="command-feature">⏳ Waits</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        commandsList.innerHTML = html;
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
            const isVisible = commandPattern.includes(lowerSearch);
            group.style.display = isVisible ? 'block' : 'none';
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            command_patterns: '/start',
            code: '// Write your command code here\nconst user = getUser();\nconst chatId = getChatId();\n\nbot.sendMessage(chatId, `Hello ${user.first_name}! Welcome to our bot.`);',
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
        
        this.setCommandsToTags(this.currentCommand.command_patterns);
        document.getElementById('commandCode').value = this.currentCommand.code || '';
        
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        document.getElementById('answerHandler').value = this.currentCommand.answer_handler || '';
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

    quickTest() {
        if (this.currentCommand) {
            this.testCommand();
        } else {
            this.showError('Please select a command first');
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

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        if (commonApp) {
            commonApp.showError(message);
        } else {
            alert(message);
        }
    }

    showSuccess(message) {
        if (commonApp) {
            commonApp.showSuccess(message);
        } else {
            alert(message);
        }
    }

    logout() {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// Initialize command editor
let commandEditor;
document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
});