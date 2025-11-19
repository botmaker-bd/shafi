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
        
        // ✅ NEW: Snippets button event
        this.setupSnippetsButton();
    }

    // ✅ NEW: Setup snippets button
    setupSnippetsButton() {
        const insertSnippetBtn = document.getElementById('insertSnippetBtn');
        if (insertSnippetBtn) {
            insertSnippetBtn.addEventListener('click', () => {
                this.showQuickSnippets();
            });
        }
    }

    // ✅ NEW: Quick snippets menu
    showQuickSnippets() {
        const snippets = [
            {
                name: 'Send Message',
                code: 'Api.sendMessage("Hello World!");',
                description: 'Basic message sending'
            },
            {
                name: 'Get User Info',
                code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Your ID: ${user.id}`);',
                description: 'Get user information'
            },
            {
                name: 'Wait for Answer',
                code: 'const answer = await waitForAnswer("What is your name?");\nApi.sendMessage(`Hello ${answer}!`);',
                description: 'Ask user and wait for response'
            },
            {
                name: 'Save User Data',
                code: 'User.saveData("last_command", "example");\nconst data = User.getData("last_command");\nApi.sendMessage(`Saved data: ${data}`);',
                description: 'Save and retrieve user data'
            },
            {
                name: 'Python Code',
                code: 'const result = runPython("2 + 2");\nApi.sendMessage(`Python result: ${result}`);',
                description: 'Execute Python code'
            }
        ];

        // Create snippets menu
        let snippetsHTML = snippets.map(snippet => `
            <div class="snippet-item" onclick="commandEditor.insertSnippet('${this.escapeHtml(snippet.code)}')">
                <div class="snippet-header">
                    <h4>${snippet.name}</h4>
                    <span class="snippet-badge">Snippet</span>
                </div>
                <p class="snippet-desc">${snippet.description}</p>
                <pre class="snippet-code">${this.escapeHtml(snippet.code)}</pre>
            </div>
        `).join('');

        // Show in modal or dropdown
        const modal = document.getElementById('templatesModal');
        if (modal) {
            const templatesContent = modal.querySelector('.templates-content');
            if (templatesContent) {
                templatesContent.innerHTML = `
                    <div class="snippets-container">
                        <h4>Quick Code Snippets</h4>
                        <p>Click any snippet to insert into your code</p>
                        <div class="snippets-grid">
                            ${snippetsHTML}
                        </div>
                    </div>
                `;
                modal.style.display = 'flex';
            }
        } else {
            // Fallback: insert first snippet directly
            this.insertSnippet(snippets[0].code);
        }
    }

    // ✅ NEW: Insert snippet into code editor
    insertSnippet(code) {
        const commandCodeEl = document.getElementById('commandCode');
        if (commandCodeEl) {
            const currentCode = commandCodeEl.value;
            const cursorPos = commandCodeEl.selectionStart;
            
            // Insert code at cursor position
            const newCode = currentCode.substring(0, cursorPos) + 
                           '\n' + code + '\n' + 
                           currentCode.substring(cursorPos);
            
            commandCodeEl.value = newCode;
            this.setModified(true);
            this.updateCodeStats();
            
            // Close modal if open
            this.closeModal('templatesModal');
            
            this.showSuccess('Snippet inserted successfully!');
        }
    }

    // ✅ FIXED: Command list click events
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
        if (!this.currentBot) {
            this.showError('Please select a bot first');
            return;
        }

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
                console.log(`✅ Loaded ${this.commands.length} commands`);
            } else {
                this.showError('Failed to load commands: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('❌ Load commands error:', error);
            this.showError('Network error while loading commands');
        } finally {
            this.showLoading(false);
        }
    }

    // ✅ FIXED: Command display with proper selectors
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
        
        // Update UI selection - ✅ FIXED: Use correct selector
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

    // ✅ FIXED: selectCommand with correct selectors
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
                
                // ✅ FIXED: Update UI selection with correct selector
                document.querySelectorAll('.command-item').forEach(item => {
                    item.classList.remove('active');
                });
                
                const selectedItem = document.querySelector(`[data-command-id="${commandId}"]`);
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

    // ... (বাকি মেথডগুলো একই থাকবে, শুধু উপরের fixes গুলো apply করুন)

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

    // // ... (বাকি utility methods একই থাকবে)
// }

// // Initialize the command editor
// let commandEditor;

// document.addEventListener('DOMContentLoaded', () => {
    // commandEditor = new CommandEditor();
// });

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
                top: '20px',
                right: '20px',
                padding: '1rem 1.5rem',
                borderRadius: '0.5rem',
                background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'},
                color: 'white',
                zIndex: '10000',
                maxWidth: '400px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
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