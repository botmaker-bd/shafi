/**
 * Enhanced Command Editor Class
 * Optimized and restructured version with improved functionality
 */
class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
        this.isModified = false;
        
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
        
        console.log('🚀 Command Editor initialized successfully');
        
        // Warn before leaving if there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isModified) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    // Event Listeners Setup
    setupEventListeners() {
        this.setupNavigationEvents();
        this.setupCommandEvents();
        this.setupFormEvents();
        this.setupModalEvents();
        this.setupSearchEvents();
        this.setupCommandListEvents();
    }

    setupCommandListEvents() {
        document.addEventListener('click', (e) => {
            const commandItem = e.target.closest('.command-item');
            if (commandItem && commandItem.dataset.commandId) {
                const commandId = commandItem.dataset.commandId;
                if (this.currentCommand?.id !== commandId) {
                    if (this.isModified && !confirm('You have unsaved changes. Switch command?')) {
                        return;
                    }
                    this.selectCommand(commandId);
                }
            }
        });
    }

    setupNavigationEvents() {
        const backToBots = document.getElementById('backToBots');
        if (backToBots) {
            backToBots.addEventListener('click', () => {
                if (this.isModified && !confirm('You have unsaved changes. Are you sure you want to leave?')) {
                    return;
                }
                window.location.href = 'bot-management.html';
            });
        }

        const quickTest = document.getElementById('quickTest');
        if (quickTest) {
            quickTest.addEventListener('click', () => {
                this.quickTest();
            });
        }
    }

    setupCommandEvents() {
        const commandButtons = [
            'addCommandBtn', 'createFirstCommand', 'addFirstCommand'
        ];

        commandButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.addNewCommand());
            }
        });

        const refreshBtn = document.getElementById('refreshCommandsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadCommands();
            });
        }
    }

    setupFormEvents() {
        // Save actions
        const saveButtons = ['saveCommandBtn', 'saveFooterBtn'];
        saveButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.saveCommand();
                });
            }
        });

        // Test actions
        const testButtons = ['testCommandBtn', 'testFooterBtn'];
        testButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.testCommand();
                });
            }
        });

        // Run test button
        const runTestBtn = document.getElementById('runTestBtn');
        if (runTestBtn) {
            runTestBtn.addEventListener('click', () => {
                this.runCustomTest();
            });
        }

        // Toggle actions
        const toggleButtons = ['toggleCommandBtn', 'activateFooterBtn'];
        toggleButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.toggleCommand());
            }
        });

        // Delete action
        const deleteBtn = document.getElementById('deleteCommandBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteCommand();
            });
        }

        // Form input changes
        const formInputs = ['commandCode', 'answerHandler', 'moreCommands'];
        formInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => {
                    this.setModified(true);
                });
            }
        });

        // Wait for answer toggle
        const waitForAnswerToggle = document.getElementById('waitForAnswer');
        if (waitForAnswerToggle) {
            waitForAnswerToggle.addEventListener('change', (e) => {
                this.toggleAnswerHandler(e.target.checked);
                this.setModified(true);
            });
        }

        // Advanced options toggle
        const advancedToggle = document.getElementById('advancedOptionsToggle');
        const advancedContent = document.getElementById('advancedOptionsContent');
        const advancedIcon = document.getElementById('advancedOptionsIcon');
        
        if (advancedToggle && advancedContent) {
            advancedToggle.addEventListener('click', () => {
                advancedContent.classList.toggle('show');
                if (advancedIcon) {
                    advancedIcon.classList.toggle('fa-chevron-down');
                    advancedIcon.classList.toggle('fa-chevron-up');
                }
            });
        }

        // Clear buttons
        const clearPatternsBtn = document.getElementById('clearPatternsBtn');
        if (clearPatternsBtn) {
            clearPatternsBtn.addEventListener('click', () => {
                this.clearCommandPatterns();
            });
        }

        const clearCodeBtn = document.getElementById('clearCodeBtn');
        if (clearCodeBtn) {
            clearCodeBtn.addEventListener('click', () => {
                this.clearCommandCode();
            });
        }

        // Snippet button
        const insertSnippetBtn = document.getElementById('insertSnippetBtn');
        if (insertSnippetBtn) {
            insertSnippetBtn.addEventListener('click', () => {
                this.showSnippetsModal();
            });
        }

        // Format code button
        const formatCodeBtn = document.getElementById('formatCodeBtn');
        if (formatCodeBtn) {
            formatCodeBtn.addEventListener('click', () => {
                this.formatCode();
            });
        }

        // Full editor buttons
        const openFullEditor = document.getElementById('openFullEditor');
        const openAnswerFullEditor = document.getElementById('openAnswerFullEditor');
        
        if (openFullEditor) {
            openFullEditor.addEventListener('click', () => {
                this.openFullScreenEditor('main');
            });
        }
        
        if (openAnswerFullEditor) {
            openAnswerFullEditor.addEventListener('click', () => {
                this.openFullScreenEditor('answer');
            });
        }

        // Templates
        const showTemplatesBtn = document.getElementById('showTemplates');
        if (showTemplatesBtn) {
            showTemplatesBtn.addEventListener('click', () => {
                this.showTemplates();
            });
        }
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'templatesModal', 'snippetsModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal(modalId));
            }
        });

        // Specific modal close buttons
        const closeTestBtn = document.getElementById('closeTestCommand');
        const closeTemplatesBtn = document.getElementById('closeTemplates');
        const closeSnippetsBtn = document.getElementById('closeSnippets');
        
        if (closeTestBtn) {
            closeTestBtn.addEventListener('click', () => this.closeModal('testCommandModal'));
        }
        if (closeTemplatesBtn) {
            closeTemplatesBtn.addEventListener('click', () => this.closeModal('templatesModal'));
        }
        if (closeSnippetsBtn) {
            closeSnippetsBtn.addEventListener('click', () => this.closeModal('snippetsModal'));
        }

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modals.forEach(modalId => {
                    const modal = document.getElementById(modalId);
                    if (modal && modal.style.display === 'flex') {
                        this.closeModal(modalId);
                    }
                });
            }
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }

    setupSearchEvents() {
        let searchTimeout;
        const searchInput = document.getElementById('commandSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterCommands(e.target.value);
                }, 300);
            });
        }

        // Snippets search
        const snippetsSearch = document.getElementById('snippetsSearch');
        if (snippetsSearch) {
            snippetsSearch.addEventListener('input', (e) => {
                this.filterSnippets(e.target.value);
            });
        }
    }

    setupCodeEditor() {
        const commandCodeEl = document.getElementById('commandCode');
        if (commandCodeEl) {
            commandCodeEl.addEventListener('input', () => {
                this.updateCodeStats();
                this.setModified(true);
            });
        }
        
        this.updateCodeStats();
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        const commandsTags = document.getElementById('commandsTags');

        if (!moreCommandsInput || !commandsTags) return;

        moreCommandsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const command = moreCommandsInput.value.trim();
                if (command) {
                    if (this.commandExistsInTags(command)) {
                        this.showError(`Pattern "${command}" is already added`);
                        return;
                    }
                    
                    const existingCommand = this.commands.find(cmd => 
                        cmd.id !== this.currentCommand?.id && 
                        cmd.command_patterns.split(',').map(p => p.trim()).includes(command)
                    );
                    
                    if (existingCommand) {
                        this.showError(`Pattern "${command}" already exists in another command`);
                        return;
                    }
                    
                    this.addCommandTag(command);
                    moreCommandsInput.value = '';
                    this.setModified(true);
                }
            }
        });

        // Handle paste event for multiple commands
        moreCommandsInput.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedText = e.clipboardData.getData('text');
            const commands = pastedText.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
            
            commands.forEach(command => {
                if (!this.commandExistsInTags(command)) {
                    this.addCommandTag(command);
                }
            });
            
            this.setModified(true);
        });
    }

    // Core Functionality
    async loadCommands() {
        if (!this.currentBot) {
            console.log('❌ No current bot found');
            return;
        }

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            console.log(`🔄 Loading commands for bot: ${this.currentBot.token}`);
            
            const response = await fetch(`/api/commands/bot/${this.currentBot.token}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📦 Commands API response:', data);

            if (data.success) {
                this.commands = data.commands || [];
                console.log(`✅ Loaded ${this.commands.length} commands`);
                this.displayCommands();
            } else {
                throw new Error(data.error || 'Failed to load commands');
            }
        } catch (error) {
            console.error('❌ Load commands error:', error);
            this.showError('Failed to load commands: ' + error.message);
            this.commands = [];
            this.displayCommands();
        } finally {
            this.showLoading(false);
        }
    }

    displayCommands() {
        const commandsList = document.getElementById('commandsList');
        const emptyCommands = document.getElementById('emptyCommands');
        const noCommandSelected = document.getElementById('noCommandSelected');
        const commandEditor = document.getElementById('commandEditor');

        if (!this.commands || this.commands.length === 0) {
            console.log('📭 No commands to display');
            if (emptyCommands) emptyCommands.style.display = 'flex';
            if (noCommandSelected && !this.currentCommand) noCommandSelected.style.display = 'flex';
            if (commandEditor) commandEditor.style.display = 'none';
            if (commandsList) commandsList.innerHTML = '';
            return;
        }

        console.log(`🎯 Displaying ${this.commands.length} commands`);
        
        if (emptyCommands) emptyCommands.style.display = 'none';
        
        if (noCommandSelected) {
            noCommandSelected.style.display = this.currentCommand ? 'none' : 'flex';
        }
        
        if (commandEditor) {
            commandEditor.style.display = this.currentCommand ? 'block' : 'none';
        }

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            const patterns = command.command_patterns.split(',').slice(0, 3).join(', ');
            const hasMorePatterns = command.command_patterns.split(',').length > 3;
            
            html += `
                <div class="command-item ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-patterns" title="${command.command_patterns}">
                        ${this.escapeHtml(patterns)}${hasMorePatterns ? '...' : ''}
                    </div>
                    <div class="command-meta">
                        <span class="command-status ${isActive ? 'status-active' : 'status-inactive'}">
                            <i class="fas fa-circle"></i>
                            ${isActive ? 'Active' : 'Inactive'}
                        </span>
                        ${command.wait_for_answer ? '<span class="command-feature">⏳ Waits</span>' : ''}
                    </div>
                </div>
            `;
        });
        
        if (commandsList) {
            commandsList.innerHTML = html;
            console.log('✅ Command list updated in DOM');
        }
    }

    addNewCommand() {
        if (this.isModified && !confirm('You have unsaved changes. Create new command?')) {
            return;
        }

        let defaultPattern = '/mycommand';
        let counter = 1;
        
        while (this.commands.some(cmd => 
            cmd.command_patterns.split(',').map(p => p.trim()).includes(defaultPattern)
        )) {
            defaultPattern = `/mycommand${counter}`;
            counter++;
        }

        this.currentCommand = {
            id: 'new',
            command_patterns: defaultPattern,
            code: '// Write your command code here\nApi.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        this.setModified(false);
        
        document.querySelectorAll('.command-item').forEach(item => {
            item.classList.remove('active');
        });
        
        setTimeout(() => {
            const moreCommandsInput = document.getElementById('moreCommands');
            if (moreCommandsInput) {
                moreCommandsInput.focus();
                moreCommandsInput.select();
            }
        }, 100);
    }

    commandExistsInTags(command) {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        return tags.some(tag => tag.textContent.trim() === command);
    }

    addCommandTag(command) {
        if (!command || this.commandExistsInTags(command)) return;

        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags) return;

        const isDuplicate = this.commands.some(cmd => 
            cmd.id !== this.currentCommand?.id && 
            cmd.command_patterns.split(',').map(p => p.trim()).includes(command)
        );

        const tag = document.createElement('div');
        tag.className = `command-tag ${isDuplicate ? 'duplicate' : ''}`;
        tag.innerHTML = `
            <span class="tag-text">${this.escapeHtml(command)}</span>
            ${isDuplicate ? '<span class="duplicate-warning" title="This pattern already exists in another command">⚠️</span>' : ''}
            <button type="button" class="remove-tag">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        tag.querySelector('.remove-tag').addEventListener('click', () => {
            tag.remove();
            this.setModified(true);
        });
        
        commandsTags.appendChild(tag);
        
        if (isDuplicate) {
            this.showError(`Warning: Pattern "${command}" already exists in another command`);
        }
    }

    getCommandsFromTags() {
        const tags = Array.from(document.querySelectorAll('.command-tag .tag-text'));
        return tags.map(tag => tag.textContent.trim()).filter(cmd => cmd);
    }

    setCommandsToTags(commands) {
        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags) return;
        
        commandsTags.innerHTML = '';
        
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

    async selectCommand(commandId) {
        if (this.currentCommand?.id === commandId) return;

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            console.log(`🔄 Loading command: ${commandId}`);
            
            const response = await fetch(`/api/commands/${commandId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📦 Command API response:', data);

            if (data.success) {
                this.currentCommand = data.command;
                this.showCommandEditor();
                this.populateCommandForm();
                
                document.querySelectorAll('.command-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                const selectedItem = document.querySelector(`[data-command-id="${commandId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
                    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                
                console.log(`✅ Command ${commandId} loaded successfully`);
            } else {
                throw new Error(data.error || 'Failed to load command');
            }
        } catch (error) {
            console.error('❌ Load command error:', error);
            this.showError('Failed to load command: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    showCommandEditor() {
        const noCommandSelected = document.getElementById('noCommandSelected');
        const commandEditor = document.getElementById('commandEditor');
        
        if (noCommandSelected) noCommandSelected.style.display = 'none';
        if (commandEditor) commandEditor.style.display = 'block';
    }

    populateCommandForm() {
        if (!this.currentCommand) return;
        
        console.log(`📝 Populating form for command: ${this.currentCommand.id}`);
        
        this.setCommandsToTags(this.currentCommand.command_patterns);
        
        const commandCodeEl = document.getElementById('commandCode');
        if (commandCodeEl) commandCodeEl.value = this.currentCommand.code || '';
        
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        const answerHandlerEl = document.getElementById('answerHandler');
        if (answerHandlerEl) answerHandlerEl.value = this.currentCommand.answer_handler || '';
        
        const currentCommandNameEl = document.getElementById('currentCommandName');
        if (currentCommandNameEl) {
            currentCommandNameEl.textContent = this.currentCommand.id === 'new' ? 'New Command' : 'Edit Command';
        }
        
        const commandIdEl = document.getElementById('commandId');
        if (commandIdEl) commandIdEl.textContent = `ID: ${this.currentCommand.id}`;
        
        const statusBadge = document.getElementById('commandStatus');
        if (statusBadge) {
            statusBadge.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            statusBadge.className = `command-status ${this.currentCommand.is_active ? 'status-active' : 'status-inactive'}`;
        }
        
        this.updateButtonStates();
        this.updateCodeStats();
        this.updateLastSaved();
        
        console.log('✅ Form populated successfully');
    }

    updateButtonStates() {
        const isNew = this.currentCommand?.id === 'new';
        const deleteBtn = document.getElementById('deleteCommandBtn');
        const toggleBtn = document.getElementById('toggleCommandBtn');
        const activateFooterBtn = document.getElementById('activateFooterBtn');
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
            deleteBtn.style.opacity = isNew ? '0.6' : '1';
        }
        
        if (toggleBtn) {
            const text = this.currentCommand?.is_active ? 'Deactivate' : 'Activate';
            toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${text}`;
        }
        
        if (activateFooterBtn) {
            const text = this.currentCommand?.is_active ? 'Deactivate' : 'Activate';
            activateFooterBtn.innerHTML = `<i class="fas fa-power-off"></i> ${text}`;
        }
    }

    // Command Management
    clearCommandPatterns() {
        if (confirm('Are you sure you want to clear all command patterns?')) {
            const commandsTags = document.getElementById('commandsTags');
            if (commandsTags) {
                commandsTags.innerHTML = '';
                this.setModified(true);
            }
        }
    }

    clearCommandCode() {
        if (confirm('Are you sure you want to clear the command code?')) {
            const codeEditor = document.getElementById('commandCode');
            if (codeEditor) {
                codeEditor.value = '';
                this.updateCodeStats();
                this.setModified(true);
            }
        }
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        const answerHandlerEl = document.getElementById('answerHandler');
        
        if (section) {
            section.style.display = show ? 'block' : 'none';
            
            if (show) {
                section.classList.add('required-field');
                if (answerHandlerEl) {
                    answerHandlerEl.placeholder = '⚠️ Required: Code to handle user\'s answer...';
                    answerHandlerEl.required = true;
                }
            } else {
                section.classList.remove('required-field');
                if (answerHandlerEl) {
                    answerHandlerEl.placeholder = 'Code to handle user\'s answer...';
                    answerHandlerEl.required = false;
                }
            }
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
            const moreCommandsInput = document.getElementById('moreCommands');
            if (moreCommandsInput) moreCommandsInput.focus();
            return false;
        }

        const commandCodeEl = document.getElementById('commandCode');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';

        if (!commandCode) {
            this.showError('Command code is required');
            if (commandCodeEl) commandCodeEl.focus();
            return false;
        }

        const waitForAnswerEl = document.getElementById('waitForAnswer');
        const answerHandlerEl = document.getElementById('answerHandler');
        
        const waitForAnswer = waitForAnswerEl ? waitForAnswerEl.checked : false;
        const answerHandler = waitForAnswer && answerHandlerEl ? answerHandlerEl.value.trim() : '';

        if (waitForAnswer && !answerHandler) {
            this.showError('Answer handler code is required when "Wait for Answer" is enabled');
            if (answerHandlerEl) {
                answerHandlerEl.focus();
                const answerSection = document.getElementById('answerHandlerSection');
                if (answerSection) answerSection.style.display = 'block';
            }
            return false;
        }

        // Client-side duplicate check
        if (this.currentCommand.id === 'new') {
            for (const pattern of commands) {
                const existingCommand = this.commands.find(cmd => 
                    cmd.command_patterns.split(',').map(p => p.trim()).includes(pattern)
                );
                
                if (existingCommand) {
                    this.showError(`Command pattern "${pattern}" already exists in another command. Please use a different pattern.`);
                    return false;
                }
            }
        } else {
            for (const pattern of commands) {
                const existingCommand = this.commands.find(cmd => 
                    cmd.id !== this.currentCommand.id && 
                    cmd.command_patterns.split(',').map(p => p.trim()).includes(pattern)
                );
                
                if (existingCommand) {
                    this.showError(`Command pattern "${pattern}" already exists in another command. Please use a different pattern.`);
                    return false;
                }
            }
        }

        const formData = {
            commandPatterns: commands.join(','),
            code: commandCode,
            waitForAnswer: waitForAnswer,
            answerHandler: answerHandler,
            botToken: this.currentBot.token
        };

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

            console.log(`🔄 Saving command: ${method} ${url}`, formData);
            
            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            console.log('📦 Save command response:', data);

            if (response.ok) {
                this.showSuccess('Command saved successfully!');
                
                await this.loadCommands();
                
                if (data.command) {
                    this.currentCommand = data.command;
                    this.populateCommandForm();
                    
                    setTimeout(() => {
                        const commandItem = document.querySelector(`[data-command-id="${this.currentCommand.id}"]`);
                        if (commandItem) {
                            commandItem.click();
                        }
                    }, 500);
                }
                
                this.setModified(false);
                return true;
            } else {
                if (data.error && data.error.includes('already exists')) {
                    const patternMatch = data.error.match(/"(.*?)"/);
                    const duplicatePattern = patternMatch ? patternMatch[1] : 'the pattern';
                    this.showError(`Command pattern "${duplicatePattern}" already exists. Please use a different pattern.`);
                } else {
                    throw new Error(data.error || 'Failed to save command');
                }
                return false;
            }
        } catch (error) {
            console.error('❌ Save command error:', error);
            this.showError('Failed to save command: ' + error.message);
            return false;
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
                const data = await response.json();
                throw new Error(data.error || 'Failed to toggle command status');
            }
        } catch (error) {
            console.error('❌ Toggle command error:', error);
            this.showError('Failed to toggle command: ' + error.message);
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
                throw new Error(data.error || 'Failed to delete command');
            }
        } catch (error) {
            console.error('❌ Delete command error:', error);
            this.showError('Failed to delete command: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    hideCommandEditor() {
        const noCommandSelected = document.getElementById('noCommandSelected');
        const commandEditor = document.getElementById('commandEditor');
        
        if (noCommandSelected) noCommandSelected.style.display = 'flex';
        if (commandEditor) commandEditor.style.display = 'none';
        this.currentCommand = null;
    }

    // Test Functionality
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

        const commandCodeEl = document.getElementById('commandCode');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';
        
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const waitForAnswerEl = document.getElementById('waitForAnswer');
            const answerHandlerEl = document.getElementById('answerHandler');
            
            const response = await fetch('/api/commands/test/temp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    code: commandCode,
                    botToken: this.currentBot.token,
                    testInput: commands[0],
                    waitForAnswer: waitForAnswerEl ? waitForAnswerEl.checked : false,
                    answerHandler: answerHandlerEl ? answerHandlerEl.value || '' : ''
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
                        ${data.chatId ? `<p><strong>Test Chat:</strong> ${data.chatId}</p>` : ''}
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
            console.error('❌ Test command error:', error);
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

        const testInputEl = document.getElementById('testInput');
        const testInput = testInputEl ? testInputEl.value.trim() : '';
        const commands = this.getCommandsFromTags();
        
        if (!testInput && commands.length === 0) {
            this.showError('Please add commands or enter test input');
            return;
        }

        const commandCodeEl = document.getElementById('commandCode');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';
        
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const waitForAnswerEl = document.getElementById('waitForAnswer');
            const answerHandlerEl = document.getElementById('answerHandler');
            
            const response = await fetch('/api/commands/test/temp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    code: commandCode,
                    botToken: this.currentBot.token,
                    testInput: testInput || commands[0],
                    waitForAnswer: waitForAnswerEl ? waitForAnswerEl.checked : false,
                    answerHandler: answerHandlerEl ? answerHandlerEl.value || '' : ''
                })
            });

            const data = await response.json();

            if (response.ok) {
                let resultText = data.result || 'Command executed successfully';
                
                if (typeof resultText === 'object') {
                    resultText = JSON.stringify(resultText, null, 2);
                }
                
                this.showTestSuccess(`
                    <h4>✅ Test Command Executed Successfully!</h4>
                    <div class="test-details">
                        <p><strong>Test Input:</strong> ${testInput || commands.join(', ')}</p>
                        <p><strong>Bot:</strong> ${this.currentBot.name}</p>
                        <p><strong>Result:</strong> ${resultText}</p>
                        ${data.chatId ? `<p><strong>Test Chat:</strong> ${data.chatId}</p>` : ''}
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
            console.error('❌ Run custom test error:', error);
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

    // Full Screen Editor Integration
    // command-editor.js-তে এই ফাংশন যোগ করুন
openFullScreenEditor(code = '', type = 'main') {
    const editorWindow = window.open('full-editor.html', 'fullEditor', 
        'width=1200,height=800,resizable=yes,scrollbars=yes');
    
    // Editor লোড হওয়ার পর code সেট করুন
    const checkEditor = setInterval(() => {
        if (editorWindow && editorWindow.fullEditor) {
            clearInterval(checkEditor);
            editorWindow.fullEditor.setCode(code);
            editorWindow.fullEditor.setFileName(type === 'main' ? 'command.js' : 'answer-handler.js');
        }
    }, 100);
    
    // Code save/update হ্যান্ডেল করুন
    window.addEventListener('message', (event) => {
        if (event.data.type === 'CODE_SAVED' || event.data.type === 'CODE_UPDATED') {
            if (type === 'main') {
                document.getElementById('commandCode').value = event.data.code;
            } else {
                document.getElementById('answerHandler').value = event.data.code;
            }
            this.setModified(true);
            this.updateCodeStats();
        }
    });
}

    // Snippets Functionality
    showSnippetsModal() {
        const snippets = this.getSnippets();
        const snippetsGrid = document.getElementById('snippetsGrid');
        
        if (!snippetsGrid) return;
        
        let html = '';
        snippets.forEach((snippet, index) => {
            html += `
                <div class="snippet-card" data-snippet-index="${index}">
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
                        <span class="snippet-type ${snippet.type}">${snippet.type}</span>
                        <button class="btn-apply" data-code="${this.escapeHtml(snippet.code)}">
                            <i class="fas fa-plus"></i> Insert
                        </button>
                    </div>
                </div>
            `;
        });
        
        snippetsGrid.innerHTML = html;
        
        // Add event listeners
        snippetsGrid.querySelectorAll('.btn-apply').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const code = e.target.closest('.btn-apply').dataset.code;
                this.insertSnippet(code);
                this.closeModal('snippetsModal');
            });
        });
        
        this.showModal('snippetsModal');
    }

    getSnippets() {
        return [
            {
                name: 'Send Message',
                description: 'Send a simple text message to user',
                code: 'Api.sendMessage("Hello world!");',
                icon: 'fas fa-comment',
                type: 'basic'
            },
            {
                name: 'User Info',
                description: 'Get user information and send greeting',
                code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Your ID: ${user.id}`);',
                icon: 'fas fa-user',
                type: 'user'
            },
            {
                name: 'Inline Buttons',
                description: 'Send message with inline keyboard buttons',
                code: 'const buttons = [\n  { text: "Button 1", callback_data: "btn1" },\n  { text: "Button 2", callback_data: "btn2" }\n];\nApi.sendMessage("Choose an option:", { inline_keyboard: [buttons] });',
                icon: 'fas fa-th',
                type: 'buttons'
            },
            {
                name: 'Wait for Answer',
                description: 'Wait for user response and handle it',
                code: 'Api.sendMessage("Please enter your name:");\nconst answer = waitForAnswer();\nApi.sendMessage(`Hello ${answer}!`);',
                icon: 'fas fa-clock',
                type: 'interactive'
            },
            {
                name: 'HTTP Request',
                description: 'Make an HTTP GET request to external API',
                code: 'const response = HTTP.get("https://api.example.com/data");\nconst data = JSON.parse(response);\nApi.sendMessage(`Data: ${data.result}`);',
                icon: 'fas fa-globe',
                type: 'api'
            },
            {
                name: 'Save User Data',
                description: 'Save and retrieve user-specific data',
                code: 'const userData = User.getData("preferences") || {};\nuserData.language = "en";\nUser.saveData("preferences", userData);\nApi.sendMessage("Preferences saved!");',
                icon: 'fas fa-save',
                type: 'data'
            }
        ];
    }

    filterSnippets(searchTerm) {
        const snippetsGrid = document.getElementById('snippetsGrid');
        if (!snippetsGrid) return;
        
        const snippetCards = snippetsGrid.querySelectorAll('.snippet-card');
        const lowerSearch = searchTerm.toLowerCase().trim();
        
        snippetCards.forEach(card => {
            const title = card.querySelector('h4').textContent.toLowerCase();
            const desc = card.querySelector('p').textContent.toLowerCase();
            const code = card.querySelector('.snippet-code').textContent.toLowerCase();
            
            const isVisible = title.includes(lowerSearch) || 
                            desc.includes(lowerSearch) || 
                            code.includes(lowerSearch);
            
            card.style.display = isVisible ? 'block' : 'none';
        });
    }

    insertSnippet(code) {
        const commandCodeEl = document.getElementById('commandCode');
        if (!commandCodeEl) return;

        const currentCode = commandCodeEl.value;
        const cursorPos = commandCodeEl.selectionStart;
        
        const newCode = currentCode.substring(0, cursorPos) + 
                       '\n' + code + '\n' + 
                       currentCode.substring(cursorPos);
        
        commandCodeEl.value = newCode;
        
        const newCursorPos = cursorPos + code.length + 2;
        commandCodeEl.setSelectionRange(newCursorPos, newCursorPos);
        
        commandCodeEl.focus();
        
        this.setModified(true);
        this.updateCodeStats();
        
        this.showSuccess('Snippet inserted successfully!');
    }

    // Templates Functionality
    async loadTemplates() {
        try {
            const token = localStorage.getItem('token');
            console.log('🔄 Loading templates from API...');
            
            const response = await fetch('/api/templates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📦 Templates API response:', data);

            if (data.success) {
                this.templates = data.templates || {};
                console.log(`✅ Loaded ${Object.keys(this.templates).length} template categories`);
                this.populateTemplatesModal();
            } else {
                throw new Error(data.error || 'Failed to load templates');
            }
        } catch (error) {
            console.error('❌ Load templates error:', error);
            this.showError('Failed to load templates: ' + error.message);
            this.templates = {
                'basic': [
                    {
                        id: 'fallback_welcome',
                        name: 'Welcome Message',
                        patterns: '/start, hello',
                        description: 'Basic welcome template',
                        code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
                        waitForAnswer: false,
                        answerHandler: ''
                    }
                ]
            };
            this.populateTemplatesModal();
        }
    }

    populateTemplatesModal() {
        const templatesContent = document.querySelector('.templates-content');
        const categoryTabsContainer = document.querySelector('.category-tabs');
        
        if (!templatesContent || !categoryTabsContainer) {
            console.error('❌ Templates modal elements not found');
            return;
        }

        templatesContent.innerHTML = '';
        categoryTabsContainer.innerHTML = '';

        if (!this.templates || Object.keys(this.templates).length === 0) {
            templatesContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-layer-group"></i>
                    </div>
                    <h3>No Templates Available</h3>
                    <p>Templates could not be loaded. Please check your connection.</p>
                    <button class="btn btn-primary" onclick="commandEditor.loadTemplates()">
                        <i class="fas fa-sync"></i> Reload Templates
                    </button>
                </div>
            `;
            return;
        }

        let categoriesHTML = '';
        let templatesHTML = '';
        let firstCategory = true;

        Object.entries(this.templates).forEach(([category, templates]) => {
            if (!Array.isArray(templates) || templates.length === 0) {
                return;
            }

            const categoryId = `${category}-templates`;
            const isActive = firstCategory ? 'active' : '';
            const displayName = this.formatCategoryName(category);
            
            categoriesHTML += `
                <button class="category-tab ${isActive}" data-category="${category}">
                    ${displayName} (${templates.length})
                </button>
            `;

            const categoryTemplatesHTML = templates.map(template => {
                return this.createTemplateCard(template);
            }).join('');

            templatesHTML += `
                <div id="${categoryId}" class="template-category ${isActive}">
                    <div class="templates-grid">
                        ${categoryTemplatesHTML}
                    </div>
                </div>
            `;

            firstCategory = false;
        });

        categoryTabsContainer.innerHTML = categoriesHTML;
        templatesContent.innerHTML = templatesHTML;

        this.setupTemplateEvents();
    }

    createTemplateCard(template) {
        const safeTemplate = {
            id: template.id,
            name: template.name,
            patterns: template.patterns || '/command',
            code: template.code,
            description: template.description || 'No description available',
            waitForAnswer: Boolean(template.waitForAnswer),
            answerHandler: template.answerHandler || ''
        };

        const templateIcon = this.getTemplateIcon(safeTemplate.name);
        const templateJson = JSON.stringify(safeTemplate);

        return `
            <div class="template-card" data-template-id="${safeTemplate.id}">
                <div class="template-content">
                    <div class="template-icon">
                        <i class="${templateIcon}"></i>
                    </div>
                    <div class="template-details">
                        <h4>${this.escapeHtml(safeTemplate.name)}</h4>
                        <p>${this.escapeHtml(safeTemplate.description)}</p>
                        <div class="template-patterns">${this.escapeHtml(safeTemplate.patterns)}</div>
                    </div>
                </div>
                <div class="template-footer">
                    <span class="template-type ${safeTemplate.waitForAnswer ? 'interactive' : 'simple'}">
                        ${safeTemplate.waitForAnswer ? 'Interactive' : 'Simple'}
                    </span>
                    <button class="btn-apply" data-template='${this.escapeHtml(templateJson)}'>
                        Apply Template
                    </button>
                </div>
            </div>
        `;
    }

    setupTemplateEvents() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-apply')) {
                const button = e.target;
                const templateData = button.getAttribute('data-template');
                
                if (templateData) {
                    try {
                        const template = JSON.parse(templateData);
                        this.applyTemplate(template);
                    } catch (error) {
                        this.showError('Failed to parse template data');
                    }
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-tab')) {
                const category = e.target.dataset.category;
                const categoryTabs = document.querySelectorAll('.category-tab');
                const templateCategories = document.querySelectorAll('.template-category');
                
                categoryTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                templateCategories.forEach(cat => cat.classList.remove('active'));
                const targetCategory = document.getElementById(`${category}-templates`);
                if (targetCategory) {
                    targetCategory.classList.add('active');
                }
            }
        });
    }

    getTemplateIcon(templateName) {
        const iconMap = {
            'welcome': 'fas fa-hand-wave',
            'help': 'fas fa-question-circle',
            'info': 'fas fa-info-circle',
            'echo': 'fas fa-comment-alt',
            'feedback': 'fas fa-star',
            'calculator': 'fas fa-calculator'
        };

        const lowerName = templateName.toLowerCase();
        for (const [key, icon] of Object.entries(iconMap)) {
            if (lowerName.includes(key)) {
                return icon;
            }
        }

        return 'fas fa-code';
    }

    formatCategoryName(category) {
        const nameMap = {
            'basic': 'Basic',
            'interactive': 'Interactive',
            'media': 'Media',
            'buttons': 'Buttons',
            'data': 'Data'
        };
        
        return nameMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    applyTemplate(template) {
        try {
            if (!template || typeof template !== 'object') {
                throw new Error('Template data is invalid');
            }

            if (!template.code) {
                throw new Error('Template code is missing');
            }

            if (!this.currentCommand || this.currentCommand.id !== 'new') {
                this.addNewCommand();
                
                setTimeout(() => {
                    this.finalizeTemplateApplication(template);
                }, 100);
            } else {
                this.finalizeTemplateApplication(template);
            }

        } catch (error) {
            this.showError('Template application failed: ' + error.message);
        }
    }

    finalizeTemplateApplication(template) {
        try {
            if (template.patterns) {
                this.setCommandsToTags(template.patterns);
            }

            const commandCodeEl = document.getElementById('commandCode');
            if (commandCodeEl && template.code) {
                commandCodeEl.value = template.code;
            }

            const waitForAnswerEl = document.getElementById('waitForAnswer');
            if (waitForAnswerEl) {
                const shouldWait = Boolean(template.waitForAnswer);
                waitForAnswerEl.checked = shouldWait;
                this.toggleAnswerHandler(shouldWait);
            }

            const answerHandlerEl = document.getElementById('answerHandler');
            if (answerHandlerEl && template.answerHandler) {
                answerHandlerEl.value = template.answerHandler;
            }

            this.closeModal('templatesModal');

            setTimeout(() => {
                const commandCodeEl = document.getElementById('commandCode');
                if (commandCodeEl) {
                    commandCodeEl.focus();
                }
            }, 200);

            this.showSuccess(`"${template.name}" template applied successfully!`);
            this.setModified(true);

        } catch (error) {
            this.showError('Failed to apply template: ' + error.message);
        }
    }

    showTemplates() {
        this.showModal('templatesModal');
    }

    // Utility Methods
    filterCommands(searchTerm) {
        const commandItems = document.querySelectorAll('.command-item');
        const lowerSearch = searchTerm.toLowerCase().trim();

        if (!lowerSearch) {
            commandItems.forEach(item => item.style.display = 'block');
            return;
        }

        commandItems.forEach(item => {
            const commandPatternEl = item.querySelector('.command-patterns');
            if (commandPatternEl) {
                const commandPattern = commandPatternEl.textContent.toLowerCase();
                const isVisible = commandPattern.includes(lowerSearch);
                item.style.display = isVisible ? 'block' : 'none';
            }
        });
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
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

    showTestModal() {
        this.showModal('testCommandModal');
    }

    showTestLoading() {
        const testCommandResult = document.getElementById('testCommandResult');
        if (testCommandResult) {
            testCommandResult.innerHTML = `
                <div class="test-loading">
                    <div class="spinner"></div>
                    <p>Testing command execution...</p>
                </div>
            `;
        }
    }

    showTestSuccess(html) {
        const testCommandResult = document.getElementById('testCommandResult');
        if (testCommandResult) {
            testCommandResult.innerHTML = `
                <div class="test-success">
                    ${html}
                </div>
            `;
        }
    }

    showTestError(html) {
        const testCommandResult = document.getElementById('testCommandResult');
        if (testCommandResult) {
            testCommandResult.innerHTML = `
                <div class="test-error">
                    ${html}
                </div>
            `;
        }
    }

    formatCode() {
        const editor = document.getElementById('commandCode');
        if (!editor) return;
        
        let code = editor.value;
        const formattedCode = this.formatCodeText(code);
        editor.value = formattedCode;
        this.updateCodeStats();
        this.setModified(true);
        
        this.showSuccess('Code formatted successfully!');
    }

    formatCodeText(code) {
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.endsWith('}') || trimmedLine.endsWith(']') || trimmedLine.endsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            formattedLines.push('    '.repeat(indentLevel) + trimmedLine);
            
            if (trimmedLine.endsWith('{') || trimmedLine.endsWith('[') || trimmedLine.endsWith('(')) {
                indentLevel++;
            }
        }
        
        return formattedLines.join('\n');
    }

    updateCodeStats() {
        const codeEditor = document.getElementById('commandCode');
        const statsElement = document.getElementById('codeStats');
        
        if (!codeEditor || !statsElement) return;
        
        const code = codeEditor.value;
        const lines = code.split('\n').length;
        const chars = code.length;
        const words = code.trim() ? code.trim().split(/\s+/).length : 0;
        
        statsElement.textContent = `Lines: ${lines}, Chars: ${chars}, Words: ${words}`;
    }

    updateLastSaved() {
        const lastSavedElement = document.getElementById('lastSaved');
        if (lastSavedElement) {
            if (this.currentCommand?.id === 'new') {
                lastSavedElement.textContent = 'Not saved yet';
            } else {
                lastSavedElement.textContent = `Last saved: ${new Date().toLocaleString()}`;
            }
        }
    }

    async loadBotInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const botId = urlParams.get('bot');

        if (!botId) {
            this.showError('No bot specified');
            setTimeout(() => {
                window.location.href = 'bot-management.html';
            }, 2000);
            return;
        }

        try {
            const token = localStorage.getItem('token');
            console.log(`🔄 Loading bot info: ${botId}`);
            
            const response = await fetch(`/api/bots/${botId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('📦 Bot API response:', data);

            if (data.success) {
                this.currentBot = data.bot;
                this.updateBotInfo();
                console.log(`✅ Bot loaded: ${this.currentBot.name}`);
            } else {
                throw new Error(data.error || 'Bot not found');
            }
        } catch (error) {
            console.error('❌ Load bot info error:', error);
            this.showError('Failed to load bot info: ' + error.message);
            setTimeout(() => {
                window.location.href = 'bot-management.html';
            }, 2000);
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            const botNameEl = document.getElementById('botName');
            const botUsernameEl = document.getElementById('botUsername');
            
            if (botNameEl) botNameEl.textContent = `Commands - ${this.currentBot.name}`;
            if (botUsernameEl) botUsernameEl.textContent = `@${this.currentBot.username}`;
        }
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    }

    // UI Helper Methods
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
        if (typeof commonApp !== 'undefined' && commonApp.showNotification) {
            commonApp.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
            
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
                color: white;
                z-index: 10000;
                max-width: 400px;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            `;
            
            const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
            notification.innerHTML = `
                <span>${icon}</span>
                <span>${message}</span>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
        }
    }

    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) {
            return '';
        }
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize the command editor
let commandEditor;

document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
});