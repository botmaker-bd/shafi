/**
 * Enhanced Command Editor Class
 * Optimized and restructured version
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
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Navigation
        this.setupNavigationEvents();
        
        // Command Actions
        this.setupCommandEvents();
        
        // Form Actions
        this.setupFormEvents();
        
        // Modal Events
        this.setupModalEvents();
        
        // Search Functionality
        this.setupSearchEvents();
    }

    setupNavigationEvents() {
        document.getElementById('backToBots').addEventListener('click', () => {
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

        // Command selection
        document.addEventListener('click', (e) => {
            const commandItem = e.target.closest('.command-item');
            if (commandItem && commandItem.dataset.commandId) {
                const commandId = commandItem.dataset.commandId;
                if (this.currentCommand?.id !== commandId) {
                    this.selectCommand(commandId);
                }
            }
        });
    }

    setupFormEvents() {
        // Save actions
        document.getElementById('saveCommandBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveCommand();
        });

        // Test actions
        document.getElementById('testCommandBtn').addEventListener('click', () => {
            this.testCommand();
        });

        document.getElementById('runTestBtn').addEventListener('click', () => {
            this.runCustomTest();
        });

        // Toggle actions
        document.getElementById('toggleCommandBtn').addEventListener('click', () => {
            this.toggleCommand();
        });

        // Delete action
        document.getElementById('deleteCommandBtn').addEventListener('click', () => {
            this.deleteCommand();
        });

        // Advanced options
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

        // Wait for answer toggle
        const waitForAnswerToggle = document.getElementById('waitForAnswer');
        if (waitForAnswerToggle) {
            waitForAnswerToggle.addEventListener('change', (e) => {
                this.toggleAnswerHandler(e.target.checked);
            });
        }
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

    // Core Functionality
    async loadCommands() {
        if (!this.currentBot) return;

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            
            // Simulate API call - replace with actual endpoint
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Sample data
            this.commands = [
                {
                    id: 'cmd_1',
                    command_patterns: '/start, hello',
                    code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                },
                {
                    id: 'cmd_2',
                    command_patterns: '/help, assistance',
                    code: 'const helpText = `Available commands:\\n/start - Welcome\\n/help - Help\\n/settings - Settings`;\nApi.sendMessage(helpText);',
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                }
            ];

            this.displayCommands();
            this.showSuccess('Commands loaded successfully!');
        } catch (error) {
            this.showError('Failed to load commands');
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
            if (emptyCommands) emptyCommands.style.display = 'flex';
            if (noCommandSelected) noCommandSelected.style.display = 'flex';
            if (commandEditor) commandEditor.style.display = 'none';
            return;
        }

        if (emptyCommands) emptyCommands.style.display = 'none';
        if (noCommandSelected) noCommandSelected.style.display = 'none';
        if (commandEditor && this.currentCommand) commandEditor.style.display = 'block';

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            
            html += `
                <div class="command-item ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-patterns">
                        ${this.escapeHtml(command.command_patterns)}
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
        }
    }

    addNewCommand() {
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
                if (selectedItem) {
                    selectedItem.classList.add('active');
                    selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        } catch (error) {
            this.showError('Failed to load command');
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
        if (currentCommandNameEl) currentCommandNameEl.textContent = this.currentCommand.id === 'new' ? 'New Command' : 'Edit Command';
        
        const commandIdEl = document.getElementById('commandId');
        if (commandIdEl) commandIdEl.textContent = `ID: ${this.currentCommand.id}`;
        
        const statusBadge = document.getElementById('commandStatus');
        if (statusBadge) {
            statusBadge.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            statusBadge.className = `command-status ${this.currentCommand.is_active ? 'status-active' : 'status-inactive'}`;
        }
        
        this.updateButtonStates();
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

        // Client-side validation
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

        this.showLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (this.currentCommand.id === 'new') {
                // Create new command
                const newCommand = {
                    id: 'cmd_' + Date.now(),
                    command_patterns: commands.join(','),
                    code: commandCode,
                    is_active: true,
                    wait_for_answer: waitForAnswer,
                    answer_handler: answerHandler
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
                        code: commandCode,
                        wait_for_answer: waitForAnswer,
                        answer_handler: answerHandler
                    };
                }
            }
            
            this.showSuccess('Command saved successfully!');
            this.displayCommands();
            this.populateCommandForm();
            
            return true;
        } catch (error) {
            this.showError('Failed to save command');
            return false;
        } finally {
            this.showLoading(false);
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
            if (modalId === 'codeEditorModal') {
                document.body.style.overflow = '';
            }
        }
    }

    async loadBotInfo() {
        // Simulate bot info loading
        this.currentBot = {
            id: 'bot_123',
            name: 'My Test Bot',
            username: 'test_bot',
            token: 'bot_token_123'
        };
        this.updateBotInfo();
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

        this.user = JSON.parse(userData);
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
            alert(`${type.toUpperCase()}: ${message}`);
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
            .replace(/'/g, "&#039;")
            .replace(/\//g, "&#x2F;");
    }

    // Placeholder methods for unimplemented features
    async loadTemplates() {
        // Template loading logic
        console.log('📦 Loading templates...');
    }

    setupCodeEditor() {
        // Code editor setup logic
        console.log('⚙️ Setting up code editor...');
    }

    async testCommand() {
        // Test command logic
        console.log('🧪 Testing command...');
    }

    async runCustomTest() {
        // Custom test logic
        console.log('🔧 Running custom test...');
    }

    async quickTest() {
        // Quick test logic
        console.log('⚡ Quick testing...');
    }

    async toggleCommand() {
        // Toggle command logic
        console.log('🔄 Toggling command...');
    }

    async deleteCommand() {
        // Delete command logic
        console.log('🗑️ Deleting command...');
    }
}

// Initialize the command editor
let commandEditor;

document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
});