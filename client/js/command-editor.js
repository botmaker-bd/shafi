// Enhanced Command Editor JavaScript - Fixed Version with Logging
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
        console.log('🚀 CommandEditor initialization started');
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        this.setupCodeEditor();
        this.setupCommandsTags();
        console.log('✅ CommandEditor initialization completed');
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners');
        
        // Navigation
        document.getElementById('backToBots')?.addEventListener('click', () => {
            console.log('🔙 Back to bots clicked');
            window.location.href = 'bot-management.html';
        });

        document.getElementById('quickTest')?.addEventListener('click', () => {
            console.log('⚡ Quick test clicked');
            this.quickTest();
        });

        // Command actions
        document.getElementById('addCommandBtn')?.addEventListener('click', () => {
            console.log('➕ Add command button clicked');
            this.addNewCommand();
        });

        document.getElementById('createFirstCommand')?.addEventListener('click', () => {
            console.log('🆕 Create first command clicked');
            this.addNewCommand();
        });

        document.getElementById('addFirstCommand')?.addEventListener('click', () => {
            console.log('🆕 Add first command clicked');
            this.addNewCommand();
        });

        // Form actions
        document.getElementById('saveCommandBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('💾 Save command clicked');
            this.saveCommand();
        });

        document.getElementById('deleteCommandBtn')?.addEventListener('click', () => {
            console.log('🗑️ Delete command clicked');
            this.deleteCommand();
        });

        document.getElementById('toggleCommandBtn')?.addEventListener('click', () => {
            console.log('🔘 Toggle command clicked');
            this.toggleCommand();
        });

        document.getElementById('testCommandBtn')?.addEventListener('click', () => {
            console.log('🧪 Test command clicked');
            this.testCommand();
        });

        // Quick test button
        document.getElementById('runQuickTestBtn')?.addEventListener('click', () => {
            console.log('🎯 Run quick test clicked');
            this.runQuickTest();
        });

        // Enter key for quick test
        document.getElementById('quickTestInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                console.log('↩️ Quick test input enter pressed');
                this.runQuickTest();
            }
        });

        // Toggle switches
        document.getElementById('waitForAnswer')?.addEventListener('change', (e) => {
            console.log('⏳ Wait for answer toggled:', e.target.checked);
            this.toggleAnswerHandler(e.target.checked);
        });

        // Code editor buttons
        document.getElementById('openEditor')?.addEventListener('click', () => {
            console.log('📝 Open main code editor');
            this.openCodeEditor('main');
        });

        document.getElementById('openAnswerEditor')?.addEventListener('click', () => {
            console.log('📝 Open answer handler editor');
            this.openCodeEditor('answer');
        });

        // Templates
        document.getElementById('showTemplates')?.addEventListener('click', async () => {
            console.log('📋 Show templates clicked');
            await this.showTemplates();
        });

        document.getElementById('refreshTemplates')?.addEventListener('click', async () => {
            console.log('🔄 Refresh templates clicked');
            await this.loadTemplatesFromServer();
        });

        // Search
        let searchTimeout;
        document.getElementById('commandSearch')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                console.log('🔍 Command search:', e.target.value);
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Copy result button
        document.getElementById('copyResultBtn')?.addEventListener('click', () => {
            console.log('📋 Copy result clicked');
            this.copyTestResult();
        });

        // Modal events
        this.setupModalEvents();
        this.setupTemplateCategories();
        
        console.log('✅ Event listeners setup completed');
    }

    setupModalEvents() {
        console.log('🔧 Setting up modal events');
        
        const modals = ['testCommandModal', 'codeEditorModal', 'templatesModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeBtn = modal?.querySelector('.modal-close');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    console.log(`❌ Close ${modalId} clicked`);
                    modal.style.display = 'none';
                });
            }
        });

        document.getElementById('closeTestCommand')?.addEventListener('click', () => {
            console.log('❌ Close test command modal clicked');
            document.getElementById('testCommandModal').style.display = 'none';
        });

        document.getElementById('closeTemplates')?.addEventListener('click', () => {
            console.log('❌ Close templates modal clicked');
            document.getElementById('templatesModal').style.display = 'none';
        });

        // Template card click events
        document.addEventListener('click', (e) => {
            const templateCard = e.target.closest('.template-card');
            if (templateCard) {
                const templateData = templateCard.dataset.template;
                if (templateData) {
                    try {
                        console.log('📋 Template card clicked');
                        const cleanData = templateData.replace(/&apos;/g, "'");
                        const template = JSON.parse(cleanData);
                        this.applyTemplate(template);
                    } catch (error) {
                        console.error('❌ Error parsing template:', error);
                        this.showError('Failed to apply template: ' + error.message);
                    }
                }
            }
        });

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                console.log('🌐 Modal background clicked');
                e.target.style.display = 'none';
            }
        });
        
        console.log('✅ Modal events setup completed');
    }

    setupTemplateCategories() {
        console.log('🔧 Setting up template categories');
        
        const categoryTabs = document.querySelectorAll('.category-tab');

        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                console.log(`📑 Template category clicked: ${category}`);
                
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
        console.log('🔧 Setting up code editor');
        
        const advancedEditor = document.getElementById('advancedCodeEditor');
        
        if (!advancedEditor) {
            console.error('❌ Advanced code editor element not found');
            return;
        }

        // Cancel button
        document.getElementById('cancelEdit')?.addEventListener('click', () => {
            console.log('❌ Cancel edit clicked');
            this.closeCodeEditor();
        });

        // Save button
        document.getElementById('saveCode')?.addEventListener('click', () => {
            console.log('💾 Save code from editor clicked');
            this.saveCodeFromEditor();
        });

        // Editor input events
        advancedEditor.addEventListener('input', (e) => {
            this.updateLineCount(e.target.value);
        });

        this.updateLineCount(advancedEditor.value);
        console.log('✅ Code editor setup completed');
    }

    setupCommandsTags() {
        console.log('🔧 Setting up commands tags');
        
        const moreCommandsInput = document.getElementById('moreCommands');
        if (!moreCommandsInput) {
            console.error('❌ More commands input element not found');
            return;
        }

        moreCommandsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const command = moreCommandsInput.value.trim();
                console.log(`🏷️ Adding command tag: ${command}`);
                if (command) {
                    this.addCommandTag(command);
                    moreCommandsInput.value = '';
                }
            }
            
            if (e.key === 'Backspace' && moreCommandsInput.value === '') {
                console.log('⌫ Removing last command tag');
                this.removeLastCommandTag();
            }
        });

        moreCommandsInput.addEventListener('blur', () => {
            const command = moreCommandsInput.value.trim();
            if (command) {
                console.log(`🏷️ Adding command tag from blur: ${command}`);
                this.addCommandTag(command);
                moreCommandsInput.value = '';
            }
        });

        moreCommandsInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            const commands = pastedText.split(/[,|\n]/).map(cmd => cmd.trim()).filter(cmd => cmd);
            console.log(`📋 Pasting commands:`, commands);
            
            commands.forEach(command => {
                if (command && !this.commandExistsInTags(command)) {
                    this.addCommandTag(command);
                }
            });
            
            moreCommandsInput.value = '';
        });
        
        console.log('✅ Commands tags setup completed');
    }

    addCommandTag(command) {
        if (!command || this.commandExistsInTags(command)) {
            console.log(`⚠️ Command tag already exists or empty: ${command}`);
            return;
        }

        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags) {
            console.error('❌ Commands tags container not found');
            return;
        }

        console.log(`🏷️ Creating command tag: ${command}`);

        const tag = document.createElement('div');
        tag.className = 'command-tag';
        tag.innerHTML = `
            <span class="tag-text">${this.escapeHtml(command)}</span>
            <button type="button" class="remove-tag" title="Remove command pattern">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        tag.querySelector('.remove-tag').addEventListener('click', () => {
            console.log(`🗑️ Removing command tag: ${command}`);
            tag.remove();
        });
        
        commandsTags.appendChild(tag);
    }

    removeLastCommandTag() {
        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags || !commandsTags.lastChild) {
            console.log('⚠️ No command tags to remove');
            return;
        }
        
        console.log('🗑️ Removing last command tag');
        commandsTags.lastChild.remove();
    }

    commandExistsInTags(command) {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        const exists = tags.some(tag => tag.textContent.trim() === command);
        console.log(`🔍 Command exists in tags: ${command} -> ${exists}`);
        return exists;
    }

    getCommandsFromTags() {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        const commands = tags.map(tag => tag.textContent.trim()).filter(cmd => cmd);
        console.log(`📋 Getting commands from tags:`, commands);
        return commands;
    }

    setCommandsToTags(commands) {
        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags) {
            console.error('❌ Commands tags container not found');
            return;
        }
        
        console.log(`🏷️ Setting commands to tags:`, commands);
        
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
        console.log(`🎯 Running quick test with input: ${testInput}`);
        
        if (!testInput) {
            this.showError('Please enter a command to test');
            return;
        }

        const commands = this.getCommandsFromTags();
        const commandCode = document.getElementById('commandCode').value.trim();

        if (commands.length === 0) {
            this.showError('Please add at least one command pattern to test');
            return;
        }

        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        console.log(`🧪 Quick test parameters:`, {
            commands,
            codeLength: commandCode.length,
            waitForAnswer: document.getElementById('waitForAnswer').checked
        });

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

            console.log('📤 Sending quick test request to server');
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
            console.log('📥 Quick test response:', data);

            if (response.ok) {
                this.showTestSuccess(`
                    ✅ Test Command Executed Successfully!

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
            console.error('❌ Quick test network error:', error);
            this.showTestError(`
                ❌ Network Error

                Failed to connect to server: ${error.message}
            `);
        }
    }

    async testCommand() {
        console.log('🧪 Testing current command');
        
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

        console.log(`🧪 Test command parameters:`, {
            commands,
            codeLength: commandCode.length,
            currentCommand: this.currentCommand
        });

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

            console.log('📤 Sending test command request to server');
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
            console.log('📥 Test command response:', data);

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
            console.error('❌ Test command network error:', error);
            this.showTestError(`
                ❌ Network Error

                Failed to connect to server: ${error.message}
            `);
        }
    }

    showTestModal() {
        console.log('📊 Showing test modal');
        document.getElementById('testCommandModal').style.display = 'flex';
    }

    showTestLoading() {
        console.log('⏳ Showing test loading');
        document.getElementById('testCommandResult').innerHTML = `
            <div class="test-loading">
                <div class="spinner"></div>
                <p>Testing command execution...</p>
            </div>
        `;
    }

    showTestSuccess(html) {
        console.log('✅ Showing test success');
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
        console.log('❌ Showing test error');
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
        console.log('📋 Copying test result');
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
        console.log(`📝 Opening code editor for: ${editorType}`);
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
        
        document.getElementById('codeEditorModal').classList.add('code-editor-modal');
        document.getElementById('codeEditorModal').style.display = 'flex';
        
        setTimeout(() => {
            advancedEditor.focus();
            advancedEditor.setSelectionRange(0, 0);
        }, 100);
    }

    closeCodeEditor() {
        console.log('❌ Closing code editor');
        document.getElementById('codeEditorModal').style.display = 'none';
    }

    saveCodeFromEditor() {
        console.log('💾 Saving code from editor');
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
        console.log(`⏳ Toggle answer handler: ${show}`);
        const section = document.getElementById('answerHandlerSection');
        section.style.display = show ? 'block' : 'none';
    }

    async showTemplates() {
        console.log('📋 Showing templates modal');
        const templatesContent = document.querySelector('.templates-content');
        if (templatesContent) {
            templatesContent.innerHTML = `
                <div class="template-loading">
                    <div class="spinner"></div>
                    <p>Loading templates from server...</p>
                </div>
            `;
        }

        document.getElementById('templatesModal').classList.add('templates-modal');
        document.getElementById('templatesModal').style.display = 'flex';
        await this.loadTemplatesFromServer();
    }

    applyTemplate(template) {
        console.log('📋 Applying template:', template.name);
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
        console.log('🔐 Checking authentication');
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');

        if (!token || !userData) {
            console.log('❌ No token or user data found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        try {
            this.user = JSON.parse(userData);
            console.log('✅ User authenticated:', this.user.email);
        } catch (error) {
            console.error('❌ Error parsing user data:', error);
            this.logout();
        }
    }

    async loadBotInfo() {
        console.log('🤖 Loading bot info');
        const urlParams = new URLSearchParams(window.location.search);
        const botId = urlParams.get('bot');

        console.log('📝 URL parameters:', { botId });

        if (!botId) {
            this.showError('No bot specified');
            window.location.href = 'bot-management.html';
            return;
        }

        try {
            const token = localStorage.getItem('token');
            console.log('📤 Fetching bot info for ID:', botId);
            
            const response = await fetch(`/api/bots/${botId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log('📥 Bot info response:', data);

            if (data.success) {
                this.currentBot = data.bot;
                console.log('✅ Bot loaded successfully:', this.currentBot.name);
                this.updateBotInfo();
            } else {
                console.error('❌ Bot not found in response');
                this.showError('Bot not found');
                window.location.href = 'bot-management.html';
            }
        } catch (error) {
            console.error('❌ Failed to load bot info:', error);
            this.showError('Failed to load bot info');
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            document.getElementById('botName').textContent = `Commands - ${this.currentBot.name}`;
            document.getElementById('botUsername').textContent = `@${this.currentBot.username}`;
            console.log('✅ Bot info updated in UI');
        }
    }

    async loadCommands() {
        console.log('📋 Loading commands');
        
        if (!this.currentBot) {
            console.error('❌ No current bot available');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            console.log('📤 Fetching commands for bot:', this.currentBot.id);
            
            const response = await fetch(`/api/commands/bot/${this.currentBot.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log('📥 Commands response:', data);

            if (data.success) {
                this.commands = data.commands || [];
                console.log(`✅ Loaded ${this.commands.length} commands`);
                this.displayCommands();
            } else {
                console.error('❌ Failed to load commands:', data.error);
                this.showError('Failed to load commands');
            }
        } catch (error) {
            console.error('❌ Error loading commands:', error);
            this.showError('Network error while loading commands');
        } finally {
            this.showLoading(false);
        }
    }

    displayCommands() {
        console.log('📋 Displaying commands in UI');
        
        const commandsList = document.getElementById('commandsList');
        const emptyCommands = document.getElementById('emptyCommands');
        const noCommandSelected = document.getElementById('noCommandSelected');

        console.log('🔍 DOM elements:', {
            commandsList: !!commandsList,
            emptyCommands: !!emptyCommands,
            noCommandSelected: !!noCommandSelected
        });

        if (!commandsList || !emptyCommands || !noCommandSelected) {
            console.error('❌ Required DOM elements not found');
            return;
        }

        if (!this.commands || this.commands.length === 0) {
            console.log('📭 No commands to display, showing empty state');
            commandsList.style.display = 'none';
            emptyCommands.style.display = 'block';
            noCommandSelected.style.display = 'block';
            document.getElementById('commandEditor').style.display = 'none';
            return;
        }

        console.log(`📝 Displaying ${this.commands.length} commands`);
        commandsList.style.display = 'block';
        emptyCommands.style.display = 'none';

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            const patterns = command.command_patterns || '';
            const shortPatterns = patterns.length > 30 ? patterns.substring(0, 30) + '...' : patterns;
            
            html += `
                <div class="command-group ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-icon">
                        <i class="fas fa-code"></i>
                    </div>
                    <div class="command-content">
                        <div class="command-header">
                            <div class="command-name">${this.escapeHtml(patterns.split(',')[0] || 'Unnamed Command')}</div>
                            <div class="command-patterns">${this.escapeHtml(shortPatterns)}</div>
                        </div>
                        <div class="command-description">
                            ${command.code ? this.escapeHtml(command.code.substring(0, 100) + (command.code.length > 100 ? '...' : '')) : 'No code'}
                        </div>
                        <div class="command-meta">
                            <span class="command-status ${isActive ? 'active' : 'inactive'}">
                                <i class="fas fa-circle"></i>
                                ${isActive ? 'Active' : 'Inactive'}
                            </span>
                            ${command.wait_for_answer ? '<span class="command-feature">⏳ Waits</span>' : ''}
                            <span class="command-id">ID: ${command.id}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        commandsList.innerHTML = html;
        console.log('✅ Commands HTML generated and inserted');
        
        // Add click event listeners to command groups
        this.setupCommandClickEvents();
    }

    setupCommandClickEvents() {
        console.log('🔧 Setting up command click events');
        const commandGroups = document.querySelectorAll('.command-group');
        console.log(`🎯 Found ${commandGroups.length} command groups`);
        
        commandGroups.forEach((group, index) => {
            group.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const commandId = group.dataset.commandId;
                console.log(`🖱️ Command group clicked: ${commandId} (index: ${index})`);
                if (commandId) {
                    this.selectCommand(commandId);
                }
            });
        });
    }

    filterCommands(searchTerm) {
        console.log(`🔍 Filtering commands with: "${searchTerm}"`);
        const commandGroups = document.querySelectorAll('.command-group');
        const lowerSearch = searchTerm.toLowerCase().trim();

        if (!lowerSearch) {
            console.log('🔍 No search term, showing all commands');
            commandGroups.forEach(group => group.style.display = 'block');
            return;
        }

        let visibleCount = 0;
        commandGroups.forEach(group => {
            const commandPattern = group.querySelector('.command-patterns').textContent.toLowerCase();
            const commandName = group.querySelector('.command-name').textContent.toLowerCase();
            const isVisible = commandPattern.includes(lowerSearch) || commandName.includes(lowerSearch);
            group.style.display = isVisible ? 'block' : 'none';
            if (isVisible) visibleCount++;
        });

        console.log(`🔍 Filter result: ${visibleCount} commands visible`);
    }

    addNewCommand() {
        console.log('🆕 Creating new command');
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
        console.log(`🎯 Selecting command: ${commandId}`);
        
        if (this.currentCommand?.id === commandId) {
            console.log('⚠️ Command already selected');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            console.log(`📤 Fetching command details: ${commandId}`);
            
            const response = await fetch(`/api/commands/${commandId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            console.log('📥 Command details response:', data);

            if (data.success) {
                this.currentCommand = data.command;
                console.log('✅ Command loaded successfully');
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
                    console.log('✅ Command selection updated in UI');
                }
            } else {
                console.error('❌ Failed to load command:', data.error);
                this.showError('Failed to load command');
            }
        } catch (error) {
            console.error('❌ Network error while loading command:', error);
            this.showError('Network error while loading command');
        } finally {
            this.showLoading(false);
        }
    }

    showCommandEditor() {
        console.log('📝 Showing command editor');
        document.getElementById('noCommandSelected').style.display = 'none';
        document.getElementById('commandEditor').style.display = 'block';
    }

    hideCommandEditor() {
        console.log('📝 Hiding command editor');
        document.getElementById('noCommandSelected').style.display = 'block';
        document.getElementById('commandEditor').style.display = 'none';
        this.currentCommand = null;
    }

    populateCommandForm() {
        console.log('📝 Populating command form');
        
        if (!this.currentCommand) {
            console.error('❌ No current command to populate');
            return;
        }
        
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
        console.log('✅ Command form populated');
    }

    updateButtonStates() {
        const isNew = this.currentCommand?.id === 'new';
        const deleteBtn = document.getElementById('deleteCommandBtn');
        const toggleBtn = document.getElementById('toggleCommandBtn');
        
        console.log(`🔘 Updating button states - isNew: ${isNew}`);
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
        }
        
        if (toggleBtn) {
            toggleBtn.textContent = this.currentCommand?.is_active ? ' Deactivate' : ' Activate';
            toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${this.currentCommand?.is_active ? 'Deactivate' : 'Activate'}`;
        }
    }

    async saveCommand() {
        console.log('💾 Saving command');
        
        if (!this.currentCommand || !this.currentBot) {
            console.error('❌ No command selected or bot not loaded');
            this.showError('No command selected or bot not loaded');
            return false;
        }

        const commands = this.getCommandsFromTags();
        const commandPatterns = commands.join(',');
        const commandCode = document.getElementById('commandCode').value.trim();

        console.log('📋 Save command data:', {
            commandsCount: commands.length,
            codeLength: commandCode.length,
            waitForAnswer: document.getElementById('waitForAnswer').checked
        });

        if (commands.length === 0) {
            this.showError('Please add at least one command pattern');
            return false;
        }

        if (!commandCode) {
            this.showError('Please add command code');
            return false;
        }

        const formData = {
            botToken: this.currentBot.token,
            commandPatterns: commandPatterns,
            code: commandCode,
            waitForAnswer: document.getElementById('waitForAnswer').checked,
            answerHandler: document.getElementById('waitForAnswer').checked ? 
                          document.getElementById('answerHandler').value.trim() : ''
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
                console.log('🆕 Creating new command');
            } else {
                url = `/api/commands/${this.currentCommand.id}`;
                method = 'PUT';
                console.log('✏️ Updating existing command');
            }

            console.log('📤 Sending save request:', { url, method });
            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log('📥 Save response:', data);

            if (response.ok) {
                this.showSuccess('Command saved successfully!');
                
                await this.loadCommands();
                
                if (data.command) {
                    this.currentCommand = data.command;
                    this.populateCommandForm();
                    
                    setTimeout(() => {
                        const commandGroup = document.querySelector(`[data-command-id="${this.currentCommand.id}"]`);
                        if (commandGroup) {
                            commandGroup.click();
                        }
                    }, 500);
                }
                
                return true;
            } else {
                console.error('❌ Save failed:', data.error);
                this.showError(data.error || 'Failed to save command');
                return false;
            }
        } catch (error) {
            console.error('❌ Network error while saving command:', error);
            this.showError('Network error while saving command: ' + error.message);
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    async deleteCommand() {
        console.log('🗑️ Deleting command');
        
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            console.log('⚠️ No command to delete or command is new');
            return;
        }

        if (!confirm('Are you sure you want to delete this command?\n\nThis action cannot be undone.')) {
            console.log('❌ Delete cancelled by user');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            console.log(`📤 Sending delete request for command: ${this.currentCommand.id}`);
            
            const response = await fetch(`/api/commands/${this.currentCommand.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                console.log('✅ Command deleted successfully');
                this.showSuccess('Command deleted successfully');
                this.hideCommandEditor();
                await this.loadCommands();
            } else {
                const data = await response.json();
                console.error('❌ Delete failed:', data.error);
                this.showError(data.error || 'Failed to delete command');
            }
        } catch (error) {
            console.error('❌ Network error while deleting command:', error);
            this.showError('Network error while deleting command');
        } finally {
            this.showLoading(false);
        }
    }

    async toggleCommand() {
        console.log('🔘 Toggling command status');
        
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            console.log('⚠️ No command to toggle or command is new');
            return;
        }

        const newStatus = !this.currentCommand.is_active;
        console.log(`🔄 Toggling command to: ${newStatus ? 'active' : 'inactive'}`);

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
                console.log(`✅ Command ${newStatus ? 'activated' : 'deactivated'} successfully`);
                this.showSuccess(`Command ${newStatus ? 'activated' : 'deactivated'} successfully!`);
            } else {
                console.error('❌ Toggle command failed');
                this.showError('Failed to toggle command status');
            }
        } catch (error) {
            console.error('❌ Network error while toggling command:', error);
            this.showError('Network error while toggling command');
        } finally {
            this.showLoading(false);
        }
    }

    quickTest() {
        console.log('⚡ Quick test triggered');
        if (this.currentCommand) {
            this.testCommand();
        } else {
            console.log('⚠️ No command selected for quick test');
            this.showError('Please select a command first');
        }
    }

    async loadTemplatesFromServer() {
        console.log('📋 Loading templates from server');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/templates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.templates = data.templates || {};
                    console.log('✅ Templates loaded successfully');
                    this.populateTemplatesModal();
                }
            }
        } catch (error) {
            console.error('❌ Failed to load templates:', error);
        }
    }

    populateTemplatesModal() {
        console.log('📋 Populating templates modal');
        const templatesContent = document.querySelector('.templates-content');
        if (!templatesContent) {
            console.error('❌ Templates content container not found');
            return;
        }

        // Mock templates for demonstration
        const mockTemplates = {
            basic: [
                {
                    name: "Welcome Message",
                    patterns: "/start, start, hello",
                    code: "const user = getUser();\nconst chatId = getChatId();\n\nbot.sendMessage(chatId, `🎉 Hello ${user.first_name}! Welcome to our bot!`);",
                    description: "Simple welcome message with user info"
                },
                {
                    name: "Help Command",
                    patterns: "/help, help, commands",
                    code: "const commands = [\n    '/start - Welcome message',\n    '/help - Show this help'\n].join('\\n');\n\nbot.sendMessage(getChatId(), `Available Commands:\\n${commands}`);",
                    description: "Display available commands"
                }
            ],
            interactive: [
                {
                    name: "Wait for Answer",
                    patterns: "/survey, survey",
                    code: "bot.sendMessage(getChatId(), 'Please tell us your favorite color:');\nwaitForAnswer();",
                    description: "Ask question and wait for user response",
                    waitForAnswer: true,
                    answerHandler: "const answer = getAnswer();\nbot.sendMessage(getChatId(), `You said: ${answer}`);"
                }
            ]
        };

        let html = '';
        for (const [category, templates] of Object.entries(mockTemplates)) {
            const categoryId = `${category}-templates`;
            const isActive = category === 'basic' ? 'active' : '';
            
            html += `
                <div id="${categoryId}" class="template-category ${isActive}">
                    <div class="templates-grid">
                        ${templates.map(template => `
                            <div class="template-card" data-template='${JSON.stringify(template).replace(/'/g, "&apos;")}'>
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

        templatesContent.innerHTML = html;
        console.log(`✅ Templates modal populated with ${Object.keys(mockTemplates).length} categories`);
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

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    showLoading(show) {
        console.log(`⏳ Loading overlay: ${show ? 'show' : 'hide'}`);
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        console.error('❌ Showing error:', message);
        if (typeof commonApp !== 'undefined' && commonApp.showError) {
            commonApp.showError(message);
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        console.log('✅ Showing success:', message);
        if (typeof commonApp !== 'undefined' && commonApp.showSuccess) {
            commonApp.showSuccess(message);
        } else {
            alert('Success: ' + message);
        }
    }

    logout() {
        console.log('🚪 Logging out');
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// Initialize command editor with error handling
let commandEditor;
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded - Initializing CommandEditor');
    try {
        commandEditor = new CommandEditor();
        console.log('🎉 CommandEditor initialized successfully');
    } catch (error) {
        console.error('💥 Failed to initialize command editor:', error);
        alert('Failed to initialize command editor. Please refresh the page.');
    }
});