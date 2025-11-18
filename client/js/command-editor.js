/**
 * Enhanced Command Editor Class
 * With New Full Screen Code Editor
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
        this.isFullscreen = false;
        this.editorMode = 'light';
        
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
        this.setupFullscreenEditorEvents();
    }

    setupFullscreenEditorEvents() {
        // Fullscreen toggle
        const fullscreenToggle = document.getElementById('fullscreenToggle');
        if (fullscreenToggle) {
            fullscreenToggle.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Editor mode toggle
        const modeButtons = document.querySelectorAll('.editor-mode-toggle .btn-icon');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.closest('.btn-icon').dataset.mode;
                this.setEditorMode(mode);
            });
        });

        // Snippet buttons
        const snippetItems = document.querySelectorAll('.snippet-item');
        snippetItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const snippetType = e.target.dataset.snippet;
                this.insertSnippet(snippetType);
            });
        });

        // Find & Replace
        const findReplaceBtn = document.getElementById('findReplaceBtn');
        if (findReplaceBtn) {
            findReplaceBtn.addEventListener('click', () => {
                this.showFindReplace();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.id === 'advancedCodeEditor') {
                this.handleEditorShortcuts(e);
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

        // Command selection
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

        // Full editor buttons
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

        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Don't close if in fullscreen mode
                if (this.isFullscreen) {
                    this.toggleFullscreen();
                    return;
                }
                
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

    // Full Screen Code Editor Functionality
    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) {
            console.error('❌ Advanced code editor not found');
            return;
        }
        
        // Setup editor buttons
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

        // Setup toolbar buttons
        this.setupToolbarButtons();

        advancedEditor.addEventListener('input', () => {
            this.updateEditorStats();
            this.updateLineNumbers();
            this.updateSaveButtonState();
        });

        advancedEditor.addEventListener('scroll', () => {
            this.syncLineNumbersScroll();
        });

        advancedEditor.addEventListener('click', () => {
            this.updateCursorPosition();
        });

        advancedEditor.addEventListener('keyup', () => {
            this.updateCursorPosition();
        });

        // Initial setup
        this.updateEditorStats();
        this.updateLineNumbers();
        this.setEditorMode('light');
    }

    setupToolbarButtons() {
        const editor = document.getElementById('advancedCodeEditor');
        const toolbarButtons = {
            'undoBtn': () => document.execCommand('undo'),
            'redoBtn': () => document.execCommand('redo'),
            'selectAllBtn': () => {
                editor.select();
                this.updateCursorPosition();
            },
            'cutBtn': () => document.execCommand('cut'),
            'copyBtn': () => document.execCommand('copy'),
            'pasteBtn': async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    this.insertTextAtCursor(text);
                    this.updateEditorStats();
                } catch (err) {
                    document.execCommand('paste');
                }
            },
            'clearBtn': () => {
                if (confirm('Are you sure you want to clear all code?')) {
                    editor.value = '';
                    this.updateEditorStats();
                    this.updateLineNumbers();
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
                    this.updateCursorPosition();
                });
            }
        });
    }

    handleEditorShortcuts(e) {
        // Ctrl+S - Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveCodeFromEditor();
        }
        
        // Ctrl+F - Find
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            this.showFindReplace();
        }
        
        // Ctrl+Z - Undo
        if (e.ctrlKey && e.key === 'z') {
            // Let browser handle default undo
        }
        
        // Ctrl+Y - Redo
        if (e.ctrlKey && e.key === 'y') {
            // Let browser handle default redo
        }
        
        // Ctrl+A - Select All
        if (e.ctrlKey && e.key === 'a') {
            // Let browser handle default select all
        }
        
        // Ctrl+Shift+F - Format
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            this.formatAdvancedCode();
        }
    }

    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        let title = '';
        let subtitle = '';
        
        if (editorType === 'main') {
            const commandCodeEl = document.getElementById('commandCode');
            code = commandCodeEl ? commandCodeEl.value : '';
            title = 'Command Code Editor';
            subtitle = 'Main Command Logic';
        } else if (editorType === 'answer') {
            const answerHandlerEl = document.getElementById('answerHandler');
            code = answerHandlerEl ? answerHandlerEl.value : '';
            title = 'Answer Handler Editor';
            subtitle = 'User Response Handling';
        }
        
        const advancedEditor = document.getElementById('advancedCodeEditor');
        const editorTitle = document.getElementById('fullscreenEditorTitle');
        const editorSubtitle = document.getElementById('fullscreenEditorSubtitle');
        
        if (advancedEditor) {
            advancedEditor.value = code;
            this.originalCode = code;
            
            if (editorTitle) editorTitle.textContent = title;
            if (editorSubtitle) editorSubtitle.textContent = subtitle;
            
            this.updateEditorStats();
            this.updateLineNumbers();
            this.updateSaveButtonState();
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
                this.updateCursorPosition();
            }
        }, 100);
    }

    closeCodeEditor() {
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (codeEditorModal) {
            codeEditorModal.style.display = 'none';
            document.body.style.overflow = '';
            
            // Exit fullscreen if active
            if (this.isFullscreen) {
                this.toggleFullscreen();
            }
        }
    }

    toggleFullscreen() {
        const modal = document.getElementById('codeEditorModal');
        const fullscreenBtn = document.getElementById('fullscreenToggle');
        
        if (!document.fullscreenElement) {
            modal.requestFullscreen?.().catch(err => {
                console.log('Fullscreen failed:', err);
            });
            this.isFullscreen = true;
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
                fullscreenBtn.title = 'Exit Fullscreen (Esc)';
            }
        } else {
            document.exitFullscreen?.();
            this.isFullscreen = false;
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenBtn.title = 'Enter Fullscreen';
            }
        }
    }

    setEditorMode(mode) {
        this.editorMode = mode;
        const modal = document.getElementById('codeEditorModal');
        const modeButtons = document.querySelectorAll('.editor-mode-toggle .btn-icon');
        
        // Update active button
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        // Apply mode styles
        modal.classList.toggle('editor-dark-mode', mode === 'dark');
        
        // Update editor theme
        const editor = document.getElementById('advancedCodeEditor');
        if (mode === 'dark') {
            editor.style.backgroundColor = '#1a1b26';
            editor.style.color = '#c0caf5';
        } else {
            editor.style.backgroundColor = '';
            editor.style.color = '';
        }
    }

    updateLineNumbers() {
        const editor = document.getElementById('advancedCodeEditor');
        const lineNumbers = document.querySelector('.line-numbers-content');
        
        if (!editor || !lineNumbers) return;
        
        const lines = editor.value.split('\n');
        let numbersHTML = '';
        
        for (let i = 1; i <= lines.length; i++) {
            numbersHTML += `<div class="line-number">${i}</div>`;
        }
        
        lineNumbers.innerHTML = numbersHTML;
    }

    syncLineNumbersScroll() {
        const editor = document.getElementById('advancedCodeEditor');
        const lineNumbers = document.querySelector('.editor-line-numbers');
        
        if (editor && lineNumbers) {
            lineNumbers.scrollTop = editor.scrollTop;
        }
    }

    updateCursorPosition() {
        const editor = document.getElementById('advancedCodeEditor');
        const cursorPosition = document.getElementById('cursorPosition');
        
        if (!editor || !cursorPosition) return;
        
        const lines = editor.value.substr(0, editor.selectionStart).split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;
        
        cursorPosition.textContent = `Ln ${line}, Col ${column}`;
    }

    insertTextAtCursor(text) {
        const editor = document.getElementById('advancedCodeEditor');
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        
        editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + text.length;
        editor.focus();
    }

    insertSnippet(snippetType) {
        const snippets = {
            'function': `function functionName(parameters) {
    // Your code here
    return result;
}`,
            'ifelse': `if (condition) {
    // Code to execute if condition is true
} else {
    // Code to execute if condition is false
}`,
            'loop': `for (let i = 0; i < array.length; i++) {
    // Code to execute for each element
    console.log(array[i]);
}`,
            'api': `// Make API call
const response = await fetch('https://api.example.com/data', {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
});

if (response.ok) {
    const data = await response.json();
    // Process data
} else {
    console.error('API call failed');
}`,
            'message': `// Send message to user
const user = getUser();
Api.sendMessage(\`Hello \${user.first_name}! 👋\`);`
        };

        const snippet = snippets[snippetType];
        if (snippet) {
            this.insertTextAtCursor(snippet);
            this.showSuccess(`Inserted ${snippetType} snippet`);
        }
    }

    showFindReplace() {
        // Simple find functionality
        const searchText = prompt('Enter text to find:');
        if (searchText) {
            const editor = document.getElementById('advancedCodeEditor');
            const content = editor.value;
            const index = content.indexOf(searchText);
            
            if (index !== -1) {
                editor.focus();
                editor.setSelectionRange(index, index + searchText.length);
                this.showSuccess(`Found "${searchText}"`);
            } else {
                this.showError(`"${searchText}" not found`);
            }
        }
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
        
        if (lineCountEl) lineCountEl.textContent = `Line: ${lines}`;
        if (charCountEl) charCountEl.textContent = `Chars: ${chars}`;
        if (wordCountEl) wordCountEl.textContent = `Words: ${words}`;
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

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;
        
        let code = editor.value;
        const formattedCode = this.formatCodeText(code);
        editor.value = formattedCode;
        this.updateEditorStats();
        this.updateLineNumbers();
        this.updateSaveButtonState();
        
        this.showSuccess('Code formatted successfully!');
    }

    // ... (বাকি মেথডগুলি আগের মতোই থাকবে, শুধু Full Screen Editor সম্পর্কিত অংশ যোগ করা হয়েছে)

    // Core Functionality (একই থাকবে)
    async loadCommands() {
        if (!this.currentBot) return;

        this.showLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Sample data
            this.commands = [
                {
                    id: 'cmd_1',
                    command_patterns: '/start, hello',
                    code: '// Welcome command\nconst user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                },
                {
                    id: 'cmd_2',
                    command_patterns: '/help, assistance',
                    code: '// Help command\nconst helpText = `Available commands:\\n/start - Welcome message\\n/help - Show this help\\n/settings - Bot settings`;\nApi.sendMessage(helpText);',
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                }
            ];

            this.displayCommands();
            this.showSuccess('Commands loaded successfully!');
        } catch (error) {
            this.showError('Failed to load commands: ' + error.message);
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
        
        // Only hide noCommandSelected if we have a current command
        if (noCommandSelected && this.currentCommand) {
            noCommandSelected.style.display = 'none';
        }
        
        if (commandEditor && this.currentCommand) {
            commandEditor.style.display = 'block';
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
        }
    }

    // ... (বাকি সকল মেথড আগের মতোই থাকবে)

    // Utility Methods
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

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            if (modalId === 'codeEditorModal') {
                document.body.style.overflow = '';
                
                // Exit fullscreen if active
                if (this.isFullscreen) {
                    this.toggleFullscreen();
                }
            }
        }
    }

    // ... (বাকি ইউটিলিটি মেথডগুলি একই থাকবে)

    // UI Helper Methods
    
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

    async loadBotInfo() {
        // Simulate bot info loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
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
    
    // Additional event listeners for dynamic elements
    document.addEventListener('click', (e) => {
        // Open code editors
        if (e.target.id === 'openEditor' || e.target.closest('#openEditor')) {
            commandEditor.openCodeEditor('main');
        }
        if (e.target.id === 'openAnswerEditor' || e.target.closest('#openAnswerEditor')) {
            commandEditor.openCodeEditor('answer');
        }
    });

    // Handle fullscreen change events
    document.addEventListener('fullscreenchange', () => {
        const modal = document.getElementById('codeEditorModal');
        const fullscreenBtn = document.getElementById('fullscreenToggle');
        
        if (!document.fullscreenElement) {
            commandEditor.isFullscreen = false;
            if (fullscreenBtn) {
                fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
                fullscreenBtn.title = 'Enter Fullscreen';
            }
        }
    });
});
