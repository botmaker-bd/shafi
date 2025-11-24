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
        const testButtons = ['testCommandBtn', 'fullEditorRunBtn', 'testFooterBtn'];
        testButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.testCommand();
                });
            }
        });

        // ✅ FIXED: Separate run test button
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

        // Clear buttons
        document.getElementById('clearPatternsBtn').addEventListener('click', () => {
            this.clearCommandPatterns();
        });

        document.getElementById('clearCodeBtn').addEventListener('click', () => {
            this.clearCommandCode();
        });

        // ✅ FIXED: Snippet button - এখন টেমপ্লেট থেকে লোড হবে
        const insertSnippetBtn = document.getElementById('insertSnippetBtn');
        if (insertSnippetBtn) {
            insertSnippetBtn.addEventListener('click', () => {
                this.showSnippetsFromTemplates();
            });
        }

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
        const searchInput = document.getElementById('commandSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterCommands(e.target.value);
                }, 300);
            });
        }
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
            // Fallback with empty commands
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
                
                // Update UI selection
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
                    
                    // Auto-select the saved command
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
                throw new Error(data.error || 'Failed to save command');
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

    // Test Functionality - COMPLETELY FIXED VERSION
// client/js/command-editor.js - শুধু গুরুত্বপূর্ণ ফিক্স

// Test Functionality - FIXED VERSION
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
            
            // ✅ FIXED: Use the correct API endpoint and data structure
            const response = await fetch('/api/commands/test/temp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    code: commandCode, // ✅ সরাসরি code পাঠান
                    botToken: this.currentBot.token, // ✅ সরাসরি botToken পাঠান
                    testInput: testInput || commands[0], // ✅ কাস্টম ইনপুট অথবা প্রথম কমান্ড
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

    // ✅ FIXED: Snippets functionality - এখন টেমপ্লেট থেকে লোড হবে
    async showSnippetsFromTemplates() {
        try {
            // Ensure templates are loaded
            if (Object.keys(this.templates).length === 0) {
                await this.loadTemplates();
            }

            // Collect all templates as snippets
            const allSnippets = [];
            Object.values(this.templates).forEach(categoryTemplates => {
                if (Array.isArray(categoryTemplates)) {
                    categoryTemplates.forEach(template => {
                        if (template.code) {
                            allSnippets.push({
                                name: template.name,
                                code: template.code,
                                description: template.description || 'No description available',
                                category: template.category || 'General'
                            });
                        }
                    });
                }
            });

            // If no templates found, use fallback snippets
            if (allSnippets.length === 0) {
                console.log('📝 No templates found, using fallback snippets');
                this.showSnippetsFallback();
                return;
            }

            console.log(`📝 Found ${allSnippets.length} snippets from templates`);

            // Create snippets modal
            this.createSnippetsModal(allSnippets);

        } catch (error) {
            console.error('❌ Error loading snippets from templates:', error);
            // Fallback to basic snippets
            this.showSnippetsFallback();
        }
    }

    // Fallback snippets if templates fail to load
    showSnippetsFallback() {
        const fallbackSnippets = [
            {
                name: 'Send Message',
                code: 'Api.sendMessage("Hello world!");',
                description: 'Send a simple text message',
                category: 'Basic'
            },
            {
                name: 'Get User Info',
                code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Your ID: ${user.id}`);',
                description: 'Get user information and send greeting',
                category: 'User'
            },
            {
                name: 'Send Button',
                code: 'const buttons = [\n  { text: "Button 1", callback_data: "btn1" },\n  { text: "Button 2", callback_data: "btn2" }\n];\nApi.sendMessage("Choose an option:", { inline_keyboard: [buttons] });',
                description: 'Send message with inline buttons',
                category: 'Buttons'
            },
            {
                name: 'Save User Data',
                code: 'const user = getUser();\nUser.saveData("last_command", "/start");\nApi.sendMessage("Your data has been saved!");',
                description: 'Save user data to database',
                category: 'Data'
            },
            {
                name: 'HTTP Request',
                code: 'try {\n  const response = await HTTP.get("https://api.example.com/data");\n  Api.sendMessage(`Data: ${response.data}`);\n} catch (error) {\n  Api.sendMessage("Error fetching data");\n}',
                description: 'Make HTTP GET request',
                category: 'HTTP'
            }
        ];

        this.createSnippetsModal(fallbackSnippets);
    }

    createSnippetsModal(snippets) {
        // Remove existing snippets modal if any
        const existingModal = document.querySelector('.snippets-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Group snippets by category
        const snippetsByCategory = {};
        snippets.forEach(snippet => {
            const category = snippet.category || 'General';
            if (!snippetsByCategory[category]) {
                snippetsByCategory[category] = [];
            }
            snippetsByCategory[category].push(snippet);
        });

        // Create modal HTML
        const snippetsHTML = `
            <div class="snippets-modal">
                <div class="snippets-header">
                    <h3>Code Snippets</h3>
                    <span class="snippets-count">${snippets.length} snippets available</span>
                    <button class="snippets-close">&times;</button>
                </div>
                <div class="snippets-body">
                    <div class="snippets-categories">
                        ${Object.entries(snippetsByCategory).map(([category, categorySnippets]) => `
                            <div class="snippets-category">
                                <h4 class="category-title">${category} (${categorySnippets.length})</h4>
                                <div class="snippets-grid">
                                    ${categorySnippets.map(snippet => `
                                        <div class="snippet-card" data-code="${this.escapeHtml(snippet.code)}">
                                            <div class="snippet-header">
                                                <h5>${snippet.name}</h5>
                                                <button class="btn-insert" title="Insert snippet">
                                                    <i class="fas fa-code"></i> Insert
                                                </button>
                                            </div>
                                            <p class="snippet-desc">${snippet.description}</p>
                                            <pre class="snippet-code">${this.escapeHtml(snippet.code)}</pre>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="snippets-footer">
                    <button class="btn btn-secondary" id="closeSnippets">Close</button>
                </div>
            </div>
        `;

        // Create and show modal
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'snippets-modal-overlay';
        modalOverlay.innerHTML = snippetsHTML;
        document.body.appendChild(modalOverlay);

        // Add CSS for snippets modal
        this.addSnippetsModalStyles();

        // Add event listeners
        modalOverlay.querySelector('.snippets-close').addEventListener('click', () => {
            modalOverlay.remove();
        });

        modalOverlay.querySelector('#closeSnippets').addEventListener('click', () => {
            modalOverlay.remove();
        });

        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });

        // Insert snippet functionality
        modalOverlay.querySelectorAll('.btn-insert').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const snippetCard = e.target.closest('.snippet-card');
                const code = snippetCard.dataset.code;
                this.insertSnippet(code);
                modalOverlay.remove();
            });
        });

        // ESC key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modalOverlay.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    addSnippetsModalStyles() {
        if (document.getElementById('snippets-modal-styles')) return;

        const styles = `
            <style id="snippets-modal-styles">
                .snippets-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 2rem;
                    backdrop-filter: blur(4px);
                }

                .snippets-modal {
                    background: var(--bg-primary);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-xl);
                    max-width: 900px;
                    width: 100%;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--border-color);
                }

                .snippets-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--bg-tertiary);
                    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
                }

                .snippets-header h3 {
                    margin: 0;
                    color: var(--text-primary);
                    font-size: 1.25rem;
                }

                .snippets-count {
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }

                .snippets-close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: var(--text-muted);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: var(--transition);
                }

                .snippets-close:hover {
                    background: var(--bg-secondary);
                    color: var(--error-color);
                }

                .snippets-body {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                }

                .snippets-categories {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .category-title {
                    margin: 0 0 1rem 0;
                    color: var(--text-primary);
                    font-size: 1.1rem;
                    font-weight: 600;
                    padding-bottom: 0.5rem;
                    border-bottom: 2px solid var(--primary-color);
                }

                .snippets-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1rem;
                }

                .snippet-card {
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                    background: var(--bg-primary);
                    transition: var(--transition);
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .snippet-card:hover {
                    border-color: var(--primary-color);
                    box-shadow: var(--shadow-md);
                    transform: translateY(-2px);
                }

                .snippet-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 1rem;
                }

                .snippet-header h5 {
                    margin: 0;
                    color: var(--text-primary);
                    font-size: 1rem;
                    font-weight: 600;
                    flex: 1;
                }

                .btn-insert {
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    padding: 0.5rem 0.75rem;
                    border-radius: var(--radius-md);
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: var(--transition);
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    white-space: nowrap;
                }

                .btn-insert:hover {
                    background: var(--primary-dark);
                    transform: translateY(-1px);
                }

                .snippet-desc {
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    line-height: 1.4;
                    margin: 0;
                }

                .snippet-code {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-light);
                    border-radius: var(--radius-md);
                    padding: 0.75rem;
                    font-family: 'Courier New', monospace;
                    font-size: 0.75rem;
                    color: var(--text-primary);
                    overflow-x: auto;
                    margin: 0;
                    max-height: 120px;
                    overflow-y: auto;
                }

                .snippets-footer {
                    padding: 1.25rem 1.5rem;
                    border-top: 1px solid var(--border-color);
                    background: var(--bg-tertiary);
                    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
                    display: flex;
                    justify-content: flex-end;
                }

                @media (max-width: 768px) {
                    .snippets-modal-overlay {
                        padding: 1rem;
                    }
                    
                    .snippets-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .snippets-modal {
                        max-height: 90vh;
                    }
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
    }

    insertSnippet(code) {
        const commandCodeEl = document.getElementById('commandCode');
        if (!commandCodeEl) return;

        const currentCode = commandCodeEl.value;
        const cursorPos = commandCodeEl.selectionStart;
        
        // Insert code at cursor position
        const newCode = currentCode.substring(0, cursorPos) + 
                       '\n' + code + '\n' + 
                       currentCode.substring(cursorPos);
        
        commandCodeEl.value = newCode;
        
        // Set cursor position after inserted code
        const newCursorPos = cursorPos + code.length + 2;
        commandCodeEl.setSelectionRange(newCursorPos, newCursorPos);
        
        // Focus back to editor
        commandCodeEl.focus();
        
        this.setModified(true);
        this.updateCodeStats();
        
        this.showSuccess('Snippet inserted successfully!');
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