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
        this.originalCode = '';
        this.currentEditorType = null;
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
        
        // ✅ NEW: Command list click event setup
        this.setupCommandListEvents();
    }

    // ✅ NEW: Separate method for command list events
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
        document.getElementById('backToBots').addEventListener('click', () => {
            if (this.isModified && !confirm('You have unsaved changes. Are you sure you want to leave?')) {
                return;
            }
            window.location.href = 'bot-management.html';
        });

        document.getElementById('quickTest').addEventListener('click', () => {
            this.quickTest();
        });
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

        document.getElementById('refreshCommandsBtn').addEventListener('click', () => {
            this.loadCommands();
        });
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
        const testButtons = ['testCommandBtn', 'testFooterBtn', 'runTestBtn'];
        testButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    if (btnId === 'runTestBtn') {
                        this.runCustomTest();
                    } else {
                        this.testCommand();
                    }
                });
            }
        });

        // Toggle actions
        const toggleButtons = ['toggleCommandBtn', 'activateFooterBtn'];
        toggleButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => this.toggleCommand());
            }
        });

        // Delete action
        document.getElementById('deleteCommandBtn').addEventListener('click', () => {
            this.deleteCommand();
        });

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

        // Code formatting
        document.getElementById('formatCode').addEventListener('click', () => {
            this.formatCode();
        });

        // Clear buttons
        document.getElementById('clearPatternsBtn').addEventListener('click', () => {
            this.clearCommandPatterns();
        });

        document.getElementById('clearCodeBtn').addEventListener('click', () => {
            this.clearCommandCode();
        });

        // Templates
        document.getElementById('showTemplates').addEventListener('click', () => {
            this.showTemplates();
        });

        // ✅ FIXED: Full editor buttons
        document.getElementById('openEditor').addEventListener('click', () => {
            this.openCodeEditor('main');
        });

        document.getElementById('openAnswerEditor').addEventListener('click', () => {
            this.openCodeEditor('answer');
        });
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal', 'templatesModal'];
        
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
        if (closeTestBtn) {
            closeTestBtn.addEventListener('click', () => this.closeModal('testCommandModal'));
        }

        const closeTemplatesBtn = document.getElementById('closeTemplates');
        if (closeTemplatesBtn) {
            closeTemplatesBtn.addEventListener('click', () => this.closeModal('templatesModal'));
        }

        // ✅ FIXED: Code editor buttons
        const cancelEditBtn = document.getElementById('cancelEdit');
        const saveCodeBtn = document.getElementById('saveCode');
        
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.closeCodeEditor();
            });
        }
        
        if (saveCodeBtn) {
            saveCodeBtn.addEventListener('click', () => {
                this.saveCodeFromEditor();
            });
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
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });
    }

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) {
            console.error('❌ Advanced code editor not found');
            return;
        }

        // Setup toolbar buttons
        this.setupToolbarButtons();

        advancedEditor.addEventListener('input', () => {
            this.updateEditorStats();
            this.updateSaveButtonState();
        });

        // Initial stats update
        this.updateEditorStats();
    }

    setupToolbarButtons() {
        const editor = document.getElementById('advancedCodeEditor');
        const toolbarButtons = {
            'undoBtn': () => document.execCommand('undo'),
            'redoBtn': () => document.execCommand('redo'),
            'selectAllBtn': () => editor.select(),
            'cutBtn': () => document.execCommand('cut'),
            'copyBtn': () => document.execCommand('copy'),
            'pasteBtn': async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
                    this.updateEditorStats();
                } catch (err) {
                    document.execCommand('paste');
                }
            },
            'clearBtn': () => {
                if (confirm('Are you sure you want to clear all code?')) {
                    editor.value = '';
                    this.updateEditorStats();
                }
            },
            'formatBtn': () => this.formatAdvancedCode()
        };

        Object.entries(toolbarButtons).forEach(([btnId, handler]) => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    handler();
                    editor.focus();
                });
            }
        });
    }

    // ✅ FIXED: Core Functionality - Improved command loading
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
        
        // Show no command selected only if no command is selected
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

        this.currentCommand = {
            id: 'new',
            command_patterns: '/start',
            code: '// Write your command code here\nconst user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        this.setModified(false);
        
        // Update UI selection
        document.querySelectorAll('.command-item').forEach(item => {
            item.classList.remove('active');
        });
        
        setTimeout(() => {
            const moreCommandsInput = document.getElementById('moreCommands');
            if (moreCommandsInput) {
                moreCommandsInput.focus();
            }
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

    // Command Tags Management
    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        const commandsTags = document.getElementById('commandsTags');

        if (!moreCommandsInput || !commandsTags) return;

        moreCommandsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const command = moreCommandsInput.value.trim();
                if (command) {
                    this.addCommandTag(command);
                    moreCommandsInput.value = '';
                    this.setModified(true);
                }
            }
        });

        moreCommandsInput.addEventListener('blur', () => {
            const command = moreCommandsInput.value.trim();
            if (command) {
                this.addCommandTag(command);
                moreCommandsInput.value = '';
                this.setModified(true);
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
            this.setModified(true);
        });
    }

    addCommandTag(command) {
        if (!command || this.commandExistsInTags(command)) return;

        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags) return;

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

    // Advanced Options
    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        const answerHandlerEl = document.getElementById('answerHandler');
        
        if (section) {
            section.style.display = show ? 'block' : 'none';
            
            // Add visual indication for required field
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

    // Save Command with Validation
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

    // ✅ NEW: Client-side validation
    if (waitForAnswer && !answerHandler) {
        this.showError('Answer handler code is required when "Wait for Answer" is enabled');
        if (answerHandlerEl) {
            answerHandlerEl.focus();
            // Show the answer handler section if hidden
            const answerSection = document.getElementById('answerHandlerSection');
            if (answerSection) answerSection.style.display = 'block';
        }
        return false;
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
            
            const tempCommand = {
                command_patterns: commands.join(','),
                code: commandCode,
                wait_for_answer: waitForAnswerEl ? waitForAnswerEl.checked : false,
                answer_handler: answerHandlerEl ? answerHandlerEl.value || '' : ''
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
            
            const tempCommand = {
                command_patterns: testInput || commands.join(','),
                code: commandCode,
                wait_for_answer: waitForAnswerEl ? waitForAnswerEl.checked : false,
                answer_handler: answerHandlerEl ? answerHandlerEl.value || '' : ''
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
                let resultText = data.result || 'Command executed successfully';
                
                // Handle object results
                if (typeof resultText === 'object') {
                    if (resultText.message) {
                        resultText = resultText.message;
                    } else {
                        resultText = JSON.stringify(resultText, null, 2);
                    }
                }
                
                this.showTestSuccess(`
                    <h4>✅ Test Command Executed Successfully!</h4>
                    <div class="test-details">
                        <p><strong>Test Input:</strong> ${testInput || commands.join(', ')}</p>
                        <p><strong>Bot:</strong> ${this.currentBot.name}</p>
                        <p><strong>Result:</strong> ${resultText}</p>
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

    // ✅ FIXED: Code Editor Functionality - Updated for better modal
    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        
        if (editorType === 'main') {
            const commandCodeEl = document.getElementById('commandCode');
            code = commandCodeEl ? commandCodeEl.value : '';
        } else if (editorType === 'answer') {
            const answerHandlerEl = document.getElementById('answerHandler');
            code = answerHandlerEl ? answerHandlerEl.value : '';
        }
        
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (advancedEditor) {
            advancedEditor.value = code;
            this.originalCode = code;
            this.updateEditorStats();
            this.updateSaveButtonState();
        }
        
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (codeEditorModal) {
            codeEditorModal.style.display = 'flex';
            // Don't hide body scroll for partial modal
        }
        
        setTimeout(() => {
            const editor = document.getElementById('advancedCodeEditor');
            if (editor) {
                editor.focus();
                editor.setSelectionRange(editor.value.length, editor.value.length);
            }
        }, 100);
    }

    closeCodeEditor() {
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (codeEditorModal) {
            codeEditorModal.style.display = 'none';
        }
    }

    saveCodeFromEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) return;
        
        const code = advancedEditor.value;
        
        if (this.currentEditorType === 'main') {
            const commandCodeEl = document.getElementById('commandCode');
            if (commandCodeEl) commandCodeEl.value = code;
        } else if (this.currentEditorType === 'answer') {
            const answerHandlerEl = document.getElementById('answerHandler');
            if (answerHandlerEl) answerHandlerEl.value = code;
        }
        
        this.originalCode = code;
        this.updateSaveButtonState();
        this.closeCodeEditor();
        this.setModified(true);
        this.showSuccess('Code saved successfully!');
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

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;
        
        let code = editor.value;
        const formattedCode = this.formatCodeText(code);
        editor.value = formattedCode;
        this.updateEditorStats();
        this.updateSaveButtonState();
        
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

    updateEditorStats() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) return;
        
        const code = advancedEditor.value;
        const lines = code.split('\n').length;
        const chars = code.length;
        const words = code.trim() ? code.trim().split(/\s+/).length : 0;
        
        const lineCountEl = document.getElementById('lineCount');
        const charCountEl = document.getElementById('charCount');
        const wordCountEl = document.getElementById('wordCount');
        
        if (lineCountEl) lineCountEl.textContent = `Lines: ${lines}`;
        if (charCountEl) charCountEl.textContent = `Chars: ${chars}`;
        if (wordCountEl) wordCountEl.textContent = `Words: ${words}`;
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

    updateSaveButtonState() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        const saveBtn = document.getElementById('saveCode');
        
        if (!advancedEditor || !saveBtn) return;
        
        const hasChanged = advancedEditor.value !== this.originalCode;
        const hasContent = advancedEditor.value.trim().length > 0;
        
        const shouldEnable = hasContent && hasChanged;
        
        saveBtn.disabled = !shouldEnable;
        saveBtn.style.opacity = shouldEnable ? '1' : '0.6';
        
        if (shouldEnable) {
            saveBtn.classList.add('btn-pulse');
        } else {
            saveBtn.classList.remove('btn-pulse');
        }
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

    // ✅ FIXED: Bot Info Loading - Improved sequence
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
                setTimeout(() => {
                    window.location.href = 'bot-management.html';
                }, 2000);
            }
        } catch (error) {
            this.showError('Failed to load bot info');
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
                
                // Debug: Log template counts
                Object.entries(this.templates).forEach(([category, templates]) => {
                    console.log(`📁 ${category}: ${templates?.length || 0} templates`);
                });
                
                this.populateTemplatesModal();
            } else {
                throw new Error(data.error || 'Failed to load templates');
            }
        } catch (error) {
            console.error('❌ Load templates error:', error);
            this.showError('Failed to load templates: ' + error.message);
            // Fallback with basic templates
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

        // Clear existing content
        templatesContent.innerHTML = '';
        categoryTabsContainer.innerHTML = '';

        // If no templates available
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
            
            // Category tab
            categoriesHTML += `
                <button class="category-tab ${isActive}" data-category="${category}">
                    ${displayName} (${templates.length})
                </button>
            `;

            // Template category content
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

        // Setup template events
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
        // Template apply button events
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

        // Category tab events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('category-tab')) {
                const category = e.target.dataset.category;
                const categoryTabs = document.querySelectorAll('.category-tab');
                const templateCategories = document.querySelectorAll('.template-category');
                
                // Update tabs
                categoryTabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update content
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

            // Create new command if none exists
            if (!this.currentCommand || this.currentCommand.id !== 'new') {
                this.addNewCommand();
                
                // Wait for form to be ready
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
            // Set command patterns
            if (template.patterns) {
                this.setCommandsToTags(template.patterns);
            }

            // Set main code
            const commandCodeEl = document.getElementById('commandCode');
            if (commandCodeEl && template.code) {
                commandCodeEl.value = template.code;
            }

            // Handle wait for answer
            const waitForAnswerEl = document.getElementById('waitForAnswer');
            if (waitForAnswerEl) {
                const shouldWait = Boolean(template.waitForAnswer);
                waitForAnswerEl.checked = shouldWait;
                this.toggleAnswerHandler(shouldWait);
            }

            // Set answer handler if needed
            const answerHandlerEl = document.getElementById('answerHandler');
            if (answerHandlerEl && template.answerHandler) {
                answerHandlerEl.value = template.answerHandler;
            }

            // Close templates modal
            this.closeModal('templatesModal');

            // Focus on code editor
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
        const modal = document.getElementById('templatesModal');
        if (modal) {
            modal.style.display = 'flex';
        }
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

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    setModified(modified) {
        this.isModified = modified;
        
        // Update UI to show modified state
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
        const testCommandModal = document.getElementById('testCommandModal');
        if (testCommandModal) {
            testCommandModal.style.display = 'flex';
        }
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
            // Fallback notification
            console.log(`${type.toUpperCase()}: ${message}`);
            
            // Simple inline notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 0.5rem;
                color: white;
                background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
                z-index: 10000;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                font-family: inherit;
            `;
            notification.textContent = message;
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