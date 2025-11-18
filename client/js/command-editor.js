// Compact Command Editor JavaScript
class CompactCommandEditor {
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
        await this.loadTemplates();
        this.setupCommandsTags();
        this.setupCodeEditor();
        console.log('✅ Compact command editor initialized completely');
    }

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
                
                Object.entries(this.templates).forEach(([category, templates]) => {
                    console.log(`📁 ${category}: ${templates?.length || 0} templates`);
                });
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
        }
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
        document.getElementById('saveCommandBtnCompact').addEventListener('click', (e) => {
            e.preventDefault();
            this.saveCommand();
        });

        document.getElementById('deleteCommandBtnCompact').addEventListener('click', () => {
            this.deleteCommand();
        });

        document.getElementById('toggleCommandBtnCompact').addEventListener('click', () => {
            this.toggleCommand();
        });

        document.getElementById('testCommandBtnCompact').addEventListener('click', () => {
            this.testCommand();
        });

        document.getElementById('runTestBtnCompact').addEventListener('click', () => {
            this.runCustomTest();
        });

        // Advanced options toggle
        const advancedToggle = document.getElementById('advancedOptionsToggle');
        const advancedContent = document.getElementById('advancedOptionsContent');
        const advancedIcon = document.getElementById('advancedOptionsIcon');
        
        if (advancedToggle && advancedContent) {
            advancedToggle.addEventListener('click', () => {
                advancedContent.classList.toggle('show');
                advancedIcon.classList.toggle('fa-chevron-down');
                advancedIcon.classList.toggle('fa-chevron-up');
            });
        }

        // Wait for answer toggle
        const waitForAnswerToggle = document.getElementById('waitForAnswerCompact');
        if (waitForAnswerToggle) {
            waitForAnswerToggle.addEventListener('change', (e) => {
                this.toggleAnswerHandler(e.target.checked);
            });
        }

        // Code editor stats
        const codeEditor = document.getElementById('commandCodeCompact');
        if (codeEditor) {
            codeEditor.addEventListener('input', () => {
                this.updateCodeStats();
            });
        }

        // Footer buttons
        const saveFooterBtn = document.getElementById('saveFooterBtn');
        const testFooterBtn = document.getElementById('testFooterBtn');
        const activateFooterBtn = document.getElementById('activateFooterBtn');
        
        if (saveFooterBtn) {
            saveFooterBtn.addEventListener('click', () => {
                this.saveCommand();
            });
        }
        
        if (testFooterBtn) {
            testFooterBtn.addEventListener('click', () => {
                this.testCommand();
            });
        }
        
        if (activateFooterBtn) {
            activateFooterBtn.addEventListener('click', () => {
                this.toggleCommand();
            });
        }

        // Format code button
        const formatBtn = document.getElementById('formatCodeCompact');
        if (formatBtn) {
            formatBtn.addEventListener('click', () => {
                this.formatCode();
            });
        }

        // Full editor buttons
        document.getElementById('openEditorCompact').addEventListener('click', () => {
            this.openCodeEditor('main');
        });

        document.getElementById('openAnswerEditorCompact').addEventListener('click', () => {
            this.openCodeEditor('answer');
        });

        // Templates
        document.getElementById('showTemplatesCompact').addEventListener('click', () => {
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

        // Command list click events
        document.addEventListener('click', (e) => {
            const commandGroup = e.target.closest('.command-group-compact');
            if (commandGroup && commandGroup.dataset.commandId) {
                const commandId = commandGroup.dataset.commandId;
                this.selectCommand(commandId);
            }
        });

        // Modal events
        this.setupModalEvents();
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommandsCompact');
        const commandsTags = document.getElementById('commandsTagsCompact');

        if (!moreCommandsInput || !commandsTags) {
            console.error('❌ Command tags elements not found');
            return;
        }

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

        const commandsTags = document.getElementById('commandsTagsCompact');
        if (!commandsTags) return;

        const tag = document.createElement('div');
        tag.className = 'command-tag-compact';
        tag.innerHTML = `
            <span class="tag-text">${this.escapeHtml(command)}</span>
            <button type="button" class="remove-tag-compact">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        tag.querySelector('.remove-tag-compact').addEventListener('click', () => {
            tag.remove();
        });
        
        commandsTags.appendChild(tag);
    }

    commandExistsInTags(command) {
        const tags = Array.from(document.querySelectorAll('.command-tag-compact .tag-text'));
        return tags.some(tag => tag.textContent.trim() === command);
    }

    getCommandsFromTags() {
        const tags = Array.from(document.querySelectorAll('.command-tag-compact .tag-text'));
        return tags.map(tag => tag.textContent.trim()).filter(cmd => cmd);
    }

    setCommandsToTags(commands) {
        const commandsTags = document.getElementById('commandsTagsCompact');
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

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) {
            console.error('❌ Advanced code editor not found');
            return;
        }
        
        // Setup cancel button
        const cancelEditBtn = document.getElementById('cancelEdit');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.closeCodeEditor();
            });
        }
        
        // Setup save button
        const saveCodeBtn = document.getElementById('saveCode');
        if (saveCodeBtn) {
            saveCodeBtn.addEventListener('click', () => {
                this.saveCodeFromEditor();
            });
        }

        // Setup toolbar buttons
        this.setupToolbarButtons();

        advancedEditor.addEventListener('input', (e) => {
            this.updateEditorStats(e.target.value);
        });

        // Initial stats update
        this.updateEditorStats(advancedEditor.value);
    }

    setupToolbarButtons() {
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
                editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, 'end');
                this.updateEditorStats(editor.value);
            } catch (err) {
                document.execCommand('paste');
            }
            editor.focus();
        });
        
        // Clear
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all code?')) {
                editor.value = '';
                this.updateEditorStats('');
                editor.focus();
            }
        });
        
        // Format (basic indentation)
        document.getElementById('formatBtn').addEventListener('click', () => {
            this.formatAdvancedCode();
            editor.focus();
        });
    }

    updateEditorStats(code) {
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
        const codeEditor = document.getElementById('commandCodeCompact');
        const statsElement = document.getElementById('codeStatsCompact');
        
        if (!codeEditor || !statsElement) return;
        
        const code = codeEditor.value;
        const lines = code.split('\n').length;
        const chars = code.length;
        
        statsElement.textContent = `Lines: ${lines}, Chars: ${chars}`;
        
        // Update last saved time when code changes
        const lastSavedElement = document.getElementById('lastSavedCompact');
        if (lastSavedElement && lastSavedElement.textContent !== 'Not saved yet') {
            lastSavedElement.textContent = 'Unsaved changes';
        }
    }

    formatCode() {
        const editor = document.getElementById('commandCodeCompact');
        if (!editor) return;
        
        let code = editor.value;
        
        // Basic formatting - add proper indentation
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            
            // Decrease indent for closing braces
            if (trimmedLine.endsWith('}') || trimmedLine.endsWith(']') || trimmedLine.endsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add current line with proper indentation
            formattedLines.push('    '.repeat(indentLevel) + trimmedLine);
            
            // Increase indent for opening braces
            if (trimmedLine.endsWith('{') || trimmedLine.endsWith('[') || trimmedLine.endsWith('(')) {
                indentLevel++;
            }
        }
        
        editor.value = formattedLines.join('\n');
        this.updateCodeStats();
        
        this.showSuccess('Code formatted!');
    }

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;
        
        let code = editor.value;
        
        // Basic formatting - add proper indentation
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            
            // Decrease indent for closing braces
            if (trimmedLine.endsWith('}') || trimmedLine.endsWith(']') || trimmedLine.endsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add current line with proper indentation
            formattedLines.push('    '.repeat(indentLevel) + trimmedLine);
            
            // Increase indent for opening braces
            if (trimmedLine.endsWith('{') || trimmedLine.endsWith('[') || trimmedLine.endsWith('(')) {
                indentLevel++;
            }
        }
        
        editor.value = formattedLines.join('\n');
        this.updateEditorStats(editor.value);
        
        this.showSuccess('Code formatted!');
    }

    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        
        if (editorType === 'main') {
            const commandCodeEl = document.getElementById('commandCodeCompact');
            code = commandCodeEl ? commandCodeEl.value : '';
        } else if (editorType === 'answer') {
            const answerHandlerEl = document.getElementById('answerHandlerCompact');
            code = answerHandlerEl ? answerHandlerEl.value : '';
        }
        
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (advancedEditor) {
            advancedEditor.value = code;
            this.updateEditorStats(code);
        }
        
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (codeEditorModal) {
            codeEditorModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
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
            document.body.style.overflow = '';
        }
    }

    saveCodeFromEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) return;
        
        const code = advancedEditor.value;
        
        if (this.currentEditorType === 'main') {
            const commandCodeEl = document.getElementById('commandCodeCompact');
            if (commandCodeEl) commandCodeEl.value = code;
        } else if (this.currentEditorType === 'answer') {
            const answerHandlerEl = document.getElementById('answerHandlerCompact');
            if (answerHandlerEl) answerHandlerEl.value = code;
        }
        
        this.updateCodeStats();
        this.closeCodeEditor();
        this.showSuccess('Code saved successfully!');
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSectionCompact');
        if (section) {
            section.style.display = show ? 'block' : 'none';
        }
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal', 'templatesModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    if (modalId === 'codeEditorModal') {
                        document.body.style.overflow = '';
                    }
                });
            }
            
            // ESC key to close modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.style.display === 'flex') {
                    modal.style.display = 'none';
                    if (modalId === 'codeEditorModal') {
                        document.body.style.overflow = '';
                    }
                }
            });
        });

        const closeTestCommandBtn = document.getElementById('closeTestCommand');
        if (closeTestCommandBtn) {
            closeTestCommandBtn.addEventListener('click', () => {
                const testCommandModal = document.getElementById('testCommandModal');
                if (testCommandModal) {
                    testCommandModal.style.display = 'none';
                }
            });
        }

        const closeTemplatesBtn = document.getElementById('closeTemplates');
        if (closeTemplatesBtn) {
            closeTemplatesBtn.addEventListener('click', () => {
                const templatesModal = document.getElementById('templatesModal');
                if (templatesModal) {
                    templatesModal.style.display = 'none';
                }
            });
        }

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
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
        const commandEditor = document.getElementById('commandEditorCompact');

        if (!this.commands || this.commands.length === 0) {
            if (commandsList) commandsList.style.display = 'none';
            if (emptyCommands) emptyCommands.style.display = 'block';
            if (noCommandSelected) noCommandSelected.style.display = 'block';
            if (commandEditor) commandEditor.style.display = 'none';
            return;
        }

        if (commandsList) commandsList.style.display = 'block';
        if (emptyCommands) emptyCommands.style.display = 'none';

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            
            html += `
                <div class="command-group-compact ${isSelected ? 'active' : ''}" 
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
        
        if (commandsList) {
            commandsList.innerHTML = html;
        }
    }

    filterCommands(searchTerm) {
        const commandGroups = document.querySelectorAll('.command-group-compact');
        const lowerSearch = searchTerm.toLowerCase().trim();

        if (!lowerSearch) {
            commandGroups.forEach(group => group.style.display = 'flex');
            return;
        }

        commandGroups.forEach(group => {
            const commandPatternEl = group.querySelector('.command-patterns');
            if (commandPatternEl) {
                const commandPattern = commandPatternEl.textContent.toLowerCase();
                const isVisible = commandPattern.includes(lowerSearch);
                group.style.display = isVisible ? 'flex' : 'none';
            }
        });
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
        
        setTimeout(() => {
            const moreCommandsInput = document.getElementById('moreCommandsCompact');
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
                document.querySelectorAll('.command-group-compact').forEach(group => {
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
        const commandEditor = document.getElementById('commandEditorCompact');
        
        if (noCommandSelected) noCommandSelected.style.display = 'none';
        if (commandEditor) commandEditor.style.display = 'block';
    }

    hideCommandEditor() {
        const noCommandSelected = document.getElementById('noCommandSelected');
        const commandEditor = document.getElementById('commandEditorCompact');
        
        if (noCommandSelected) noCommandSelected.style.display = 'block';
        if (commandEditor) commandEditor.style.display = 'none';
        this.currentCommand = null;
    }

    populateCommandForm() {
        if (!this.currentCommand) return;
        
        this.setCommandsToTags(this.currentCommand.command_patterns);
        
        const commandCodeEl = document.getElementById('commandCodeCompact');
        if (commandCodeEl) commandCodeEl.value = this.currentCommand.code || '';
        
        const waitToggle = document.getElementById('waitForAnswerCompact');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        const answerHandlerEl = document.getElementById('answerHandlerCompact');
        if (answerHandlerEl) answerHandlerEl.value = this.currentCommand.answer_handler || '';
        
        const currentCommandNameEl = document.getElementById('currentCommandNameCompact');
        if (currentCommandNameEl) currentCommandNameEl.textContent = 'Command Editor';
        
        const commandIdEl = document.getElementById('commandIdCompact');
        if (commandIdEl) commandIdEl.textContent = `ID: ${this.currentCommand.id}`;
        
        const statusBadge = document.getElementById('commandStatusCompact');
        if (statusBadge) {
            statusBadge.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            statusBadge.className = `command-status-badge ${this.currentCommand.is_active ? 'status-active' : 'status-inactive'}`;
        }
        
        // Update footer button
        const activateBtn = document.getElementById('activateFooterBtn');
        if (activateBtn) {
            activateBtn.innerHTML = this.currentCommand.is_active ? 
                '<i class="fas fa-power-off"></i> Deactivate' : 
                '<i class="fas fa-power-off"></i> Activate';
        }
        
        this.updateCodeStats();
        
        // Reset last saved
        const lastSavedElement = document.getElementById('lastSavedCompact');
        if (lastSavedElement) {
            lastSavedElement.textContent = 'Not saved yet';
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
            const moreCommandsInput = document.getElementById('moreCommandsCompact');
            if (moreCommandsInput) moreCommandsInput.focus();
            return false;
        }

        const commandCodeEl = document.getElementById('commandCodeCompact');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';

        if (!commandCode) {
            this.showError('Command code is required');
            if (commandCodeEl) commandCodeEl.focus();
            return false;
        }

        const waitForAnswerEl = document.getElementById('waitForAnswerCompact');
        const answerHandlerEl = document.getElementById('answerHandlerCompact');
        
        const waitForAnswer = waitForAnswerEl ? waitForAnswerEl.checked : false;
        const answerHandler = waitForAnswer && answerHandlerEl ? answerHandlerEl.value.trim() : '';

        if (waitForAnswer && !answerHandler) {
            this.showError('Answer handler code is required when "Wait for Answer" is enabled');
            if (answerHandlerEl) {
                answerHandlerEl.focus();
                const answerSection = document.getElementById('answerHandlerSectionCompact');
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
                
                // Update last saved time
                const lastSavedElement = document.getElementById('lastSavedCompact');
                if (lastSavedElement) {
                    const now = new Date();
                    lastSavedElement.textContent = `Last saved: ${now.toLocaleTimeString()}`;
                }
                
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
            this.showError('Please add at least one command to test');
            return;
        }

        const commandCodeEl = document.getElementById('commandCodeCompact');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';
        
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const waitForAnswerEl = document.getElementById('waitForAnswerCompact');
            const answerHandlerEl = document.getElementById('answerHandlerCompact');
            
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

        const testInputEl = document.getElementById('testInputCompact');
        const testInput = testInputEl ? testInputEl.value.trim() : '';
        const commands = this.getCommandsFromTags();
        
        if (!testInput && commands.length === 0) {
            this.showError('Please add commands or enter test input');
            return;
        }

        const commandCodeEl = document.getElementById('commandCodeCompact');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';
        
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const waitForAnswerEl = document.getElementById('waitForAnswerCompact');
            const answerHandlerEl = document.getElementById('answerHandlerCompact');
            
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

    showTemplates() {
        const modal = document.getElementById('templatesModal');
        if (!modal) {
            this.showError('Templates modal not found');
            return;
        }
        
        modal.style.display = 'flex';
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
}

// Initialize compact command editor
let compactCommandEditor;

document.addEventListener('DOMContentLoaded', () => {
    compactCommandEditor = new CompactCommandEditor();
});