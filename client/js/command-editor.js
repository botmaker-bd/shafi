/**
 * Enhanced Command Editor Class with Auto Snippets System
 * Snippets will be automatically loaded from templates and applied
 */
class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
        this.snippets = [];
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
        await this.loadSnippets(); // ✅ Auto load snippets
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
        const testButtons = ['testCommandBtn', 'testFooterBtn'];
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

        // ✅ FIXED: Snippet button - Now auto applies from templates
        const insertSnippetBtn = document.getElementById('insertSnippetBtn');
        if (insertSnippetBtn) {
            insertSnippetBtn.addEventListener('click', () => {
                this.showAutoSnippets();
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

    // ✅ NEW: Auto Load Snippets from Templates
    async loadSnippets() {
        console.log('🔄 Auto-loading snippets from templates...');
        
        try {
            // Wait for templates to load first
            if (Object.keys(this.templates).length === 0) {
                console.log('⏳ Templates not loaded yet, waiting...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Extract snippets from templates
            this.snippets = this.extractSnippetsFromTemplates();
            console.log(`✅ Auto-loaded ${this.snippets.length} snippets from templates`);
            
        } catch (error) {
            console.error('❌ Failed to load snippets:', error);
            // Fallback to default snippets
            this.snippets = this.getDefaultSnippets();
        }
    }

    // ✅ NEW: Extract code snippets from templates
    extractSnippetsFromTemplates() {
        const snippets = [];
        
        if (!this.templates || Object.keys(this.templates).length === 0) {
            console.log('📭 No templates available for snippets extraction');
            return this.getDefaultSnippets();
        }

        // Extract common code patterns from all templates
        Object.values(this.templates).forEach(categoryTemplates => {
            if (Array.isArray(categoryTemplates)) {
                categoryTemplates.forEach(template => {
                    if (template.code) {
                        // Extract individual code blocks from template
                        const templateSnippets = this.extractCodeBlocks(template.code, template.name);
                        snippets.push(...templateSnippets);
                    }
                });
            }
        });

        // Remove duplicates and ensure we have snippets
        const uniqueSnippets = this.removeDuplicateSnippets(snippets);
        
        // If no snippets found, use defaults
        if (uniqueSnippets.length === 0) {
            return this.getDefaultSnippets();
        }

        console.log(`📦 Extracted ${uniqueSnippets.length} unique snippets from templates`);
        return uniqueSnippets;
    }

    // ✅ NEW: Extract individual code blocks from template code
    extractCodeBlocks(templateCode, templateName) {
        const snippets = [];
        const lines = templateCode.split('\n');
        let currentBlock = [];
        let blockName = '';
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Detect common code patterns
            if (trimmedLine.startsWith('Api.sendMessage') || 
                trimmedLine.startsWith('const user = getUser()') ||
                trimmedLine.startsWith('User.saveData') ||
                trimmedLine.startsWith('HTTP.') ||
                trimmedLine.includes('inline_keyboard') ||
                trimmedLine.includes('reply_markup')) {
                
                // Create snippet for this line
                const snippet = {
                    name: this.generateSnippetName(trimmedLine, templateName),
                    code: trimmedLine,
                    description: `From ${templateName}: ${this.getSnippetDescription(trimmedLine)}`,
                    category: this.detectSnippetCategory(trimmedLine)
                };
                snippets.push(snippet);
            }
            
            // Detect multi-line patterns
            if (trimmedLine.startsWith('const') && trimmedLine.includes('=') && 
                (trimmedLine.includes('Api.') || trimmedLine.includes('User.') || trimmedLine.includes('HTTP.'))) {
                const snippet = {
                    name: `Variable Setup - ${templateName}`,
                    code: trimmedLine,
                    description: `Variable declaration from ${templateName}`,
                    category: 'variables'
                };
                snippets.push(snippet);
            }
            
            // Detect function calls
            if ((trimmedLine.includes('(') && trimmedLine.includes(')')) && 
                !trimmedLine.startsWith('//') && !trimmedLine.startsWith('/*')) {
                const snippet = {
                    name: `Function Call - ${templateName}`,
                    code: trimmedLine,
                    description: `Function call from ${templateName}`,
                    category: 'functions'
                };
                snippets.push(snippet);
            }
        });

        return snippets;
    }

    // ✅ NEW: Generate meaningful snippet names
    generateSnippetName(codeLine, templateName) {
        if (codeLine.includes('Api.sendMessage')) {
            return 'Send Message';
        } else if (codeLine.includes('getUser()')) {
            return 'Get User Info';
        } else if (codeLine.includes('User.saveData')) {
            return 'Save User Data';
        } else if (codeLine.includes('HTTP.')) {
            return 'HTTP Request';
        } else if (codeLine.includes('inline_keyboard')) {
            return 'Inline Buttons';
        } else if (codeLine.includes('reply_markup')) {
            return 'Reply Markup';
        } else {
            return `Code from ${templateName}`;
        }
    }

    // ✅ NEW: Get snippet description
    getSnippetDescription(codeLine) {
        if (codeLine.includes('Api.sendMessage')) {
            return 'Send a message to user';
        } else if (codeLine.includes('getUser()')) {
            return 'Get current user information';
        } else if (codeLine.includes('User.saveData')) {
            return 'Save data for current user';
        } else if (codeLine.includes('HTTP.')) {
            return 'Make HTTP request';
        } else if (codeLine.includes('inline_keyboard')) {
            return 'Create inline keyboard buttons';
        } else {
            return 'Useful code snippet';
        }
    }

    // ✅ NEW: Detect snippet category
    detectSnippetCategory(codeLine) {
        if (codeLine.includes('Api.')) return 'api';
        if (codeLine.includes('User.')) return 'user';
        if (codeLine.includes('HTTP.')) return 'http';
        if (codeLine.includes('Keyboard') || codeLine.includes('Button')) return 'ui';
        return 'general';
    }

    // ✅ NEW: Remove duplicate snippets
    removeDuplicateSnippets(snippets) {
        const unique = [];
        const seen = new Set();
        
        snippets.forEach(snippet => {
            const key = snippet.code.trim().toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(snippet);
            }
        });
        
        return unique;
    }

    // ✅ NEW: Default fallback snippets
    getDefaultSnippets() {
        return [
            {
                name: 'Send Message',
                code: 'Api.sendMessage("Hello world!");',
                description: 'Send a simple text message to user',
                category: 'api'
            },
            {
                name: 'Get User Info',
                code: 'const user = getUser();',
                description: 'Get current user information',
                category: 'user'
            },
            {
                name: 'Send Formatted Message',
                code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Your ID: ${user.id}`);',
                description: 'Send message with user information',
                category: 'api'
            },
            {
                name: 'Save User Data',
                code: 'User.saveData("key", "value");',
                description: 'Save data for current user',
                category: 'user'
            },
            {
                name: 'Inline Buttons',
                code: 'const buttons = [\n  { text: "Button 1", callback_data: "btn1" },\n  { text: "Button 2", callback_data: "btn2" }\n];\nApi.sendMessage("Choose option:", { inline_keyboard: [buttons] });',
                description: 'Send message with inline buttons',
                category: 'ui'
            },
            {
                name: 'HTTP GET Request',
                code: 'const response = await HTTP.get("https://api.example.com/data");\nApi.sendMessage(`Data: ${response.data}`);',
                description: 'Make HTTP GET request',
                category: 'http'
            },
            {
                name: 'Error Handling',
                code: 'try {\n  // Your code here\n} catch (error) {\n  Api.sendMessage("Error: " + error.message);\n}',
                description: 'Basic error handling structure',
                category: 'general'
            }
        ];
    }

    // ✅ NEW: Auto Snippets System - Shows snippets extracted from templates
    showAutoSnippets() {
        if (this.snippets.length === 0) {
            this.showError('No snippets available. Please check templates are loaded.');
            return;
        }

        console.log(`🎯 Showing ${this.snippets.length} auto-loaded snippets`);

        // Group snippets by category
        const groupedSnippets = this.groupSnippetsByCategory(this.snippets);

        // Create snippets modal HTML
        const snippetsHTML = `
            <div class="snippets-modal-overlay">
                <div class="snippets-modal">
                    <div class="snippets-header">
                        <h3>✨ Auto Code Snippets</h3>
                        <p class="snippets-subtitle">Extracted from your templates - Click to auto-insert</p>
                        <button class="snippets-close">&times;</button>
                    </div>
                    <div class="snippets-body">
                        ${this.createSnippetsCategoriesHTML(groupedSnippets)}
                    </div>
                    <div class="snippets-footer">
                        <div class="snippets-stats">
                            <span>📦 ${this.snippets.length} snippets loaded from templates</span>
                        </div>
                        <button class="btn btn-secondary" id="refreshSnippets">
                            <i class="fas fa-sync"></i> Reload from Templates
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Remove existing snippets modal if any
        const existingModal = document.querySelector('.snippets-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Create and show modal
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'snippets-modal-overlay';
        modalOverlay.innerHTML = snippetsHTML;
        document.body.appendChild(modalOverlay);

        // Add event listeners
        this.setupSnippetsModalEvents(modalOverlay);
    }

    // ✅ NEW: Group snippets by category
    groupSnippetsByCategory(snippets) {
        const grouped = {};
        
        snippets.forEach(snippet => {
            const category = snippet.category || 'general';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(snippet);
        });
        
        return grouped;
    }

    // ✅ NEW: Create categories HTML for snippets
    createSnippetsCategoriesHTML(groupedSnippets) {
        let html = '';
        
        Object.entries(groupedSnippets).forEach(([category, snippets]) => {
            const categoryName = this.formatCategoryName(category);
            const categoryIcon = this.getCategoryIcon(category);
            
            html += `
                <div class="snippets-category">
                    <div class="category-header">
                        <i class="${categoryIcon}"></i>
                        <h4>${categoryName}</h4>
                        <span class="snippet-count">${snippets.length}</span>
                    </div>
                    <div class="snippets-grid">
                        ${snippets.map(snippet => this.createSnippetCard(snippet)).join('')}
                    </div>
                </div>
            `;
        });
        
        return html;
    }

    // ✅ NEW: Create individual snippet card
    createSnippetCard(snippet) {
        return `
            <div class="snippet-card" data-snippet='${JSON.stringify(snippet)}'>
                <div class="snippet-header">
                    <h5>${snippet.name}</h5>
                    <button class="btn-insert-auto" title="Auto-insert snippet">
                        <i class="fas fa-bolt"></i> Insert
                    </button>
                </div>
                <p class="snippet-desc">${snippet.description}</p>
                <pre class="snippet-code">${this.escapeHtml(snippet.code)}</pre>
                <div class="snippet-footer">
                    <span class="snippet-source">🔗 From Templates</span>
                </div>
            </div>
        `;
    }

    // ✅ NEW: Setup snippets modal events
    setupSnippetsModalEvents(modalOverlay) {
        // Close button
        modalOverlay.querySelector('.snippets-close').addEventListener('click', () => {
            modalOverlay.remove();
        });

        // Close on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.remove();
            }
        });

        // Auto-insert snippet functionality
        modalOverlay.querySelectorAll('.btn-insert-auto').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const snippetCard = e.target.closest('.snippet-card');
                const snippetData = snippetCard.dataset.snippet;
                
                try {
                    const snippet = JSON.parse(snippetData);
                    this.autoInsertSnippet(snippet);
                    modalOverlay.remove();
                } catch (error) {
                    this.showError('Failed to parse snippet data');
                }
            });
        });

        // Refresh snippets button
        const refreshBtn = modalOverlay.querySelector('#refreshSnippets');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reloading...';
                await this.loadSnippets();
                modalOverlay.remove();
                this.showAutoSnippets(); // Refresh the modal
            });
        }

        // ESC key to close
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modalOverlay.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // ✅ NEW: Auto insert snippet with smart positioning
    autoInsertSnippet(snippet) {
        const commandCodeEl = document.getElementById('commandCode');
        if (!commandCodeEl) {
            this.showError('Code editor not found');
            return;
        }

        const currentCode = commandCodeEl.value;
        const cursorPos = commandCodeEl.selectionStart;
        const currentLine = this.getCurrentLine(currentCode, cursorPos);
        
        // Smart insertion based on current context
        const newCode = this.insertSnippetSmartly(currentCode, cursorPos, snippet.code, currentLine);
        
        commandCodeEl.value = newCode.code;
        
        // Set cursor position after inserted code
        commandCodeEl.setSelectionRange(newCode.cursorPos, newCode.cursorPos);
        
        // Focus back to editor
        commandCodeEl.focus();
        
        this.setModified(true);
        this.updateCodeStats();
        
        this.showSuccess(`✨ "${snippet.name}" snippet inserted automatically!`);
    }

    // ✅ NEW: Smart snippet insertion
    insertSnippetSmartly(currentCode, cursorPos, snippetCode, currentLine) {
        const lines = currentCode.split('\n');
        const currentLineIndex = this.getCurrentLineIndex(lines, cursorPos);
        
        // If current line is empty or comment, replace it
        if (currentLine.trim() === '' || currentLine.trim().startsWith('//')) {
            lines[currentLineIndex] = snippetCode;
            const newCode = lines.join('\n');
            const newCursorPos = this.getPositionAfterInsertion(newCode, currentLineIndex, snippetCode);
            return { code: newCode, cursorPos: newCursorPos };
        }
        
        // Otherwise insert after current line
        lines.splice(currentLineIndex + 1, 0, snippetCode);
        const newCode = lines.join('\n');
        const newCursorPos = this.getPositionAfterInsertion(newCode, currentLineIndex + 1, snippetCode);
        
        return { code: newCode, cursorPos: newCursorPos };
    }

    // ✅ NEW: Helper methods for smart insertion
    getCurrentLine(code, cursorPos) {
        const textBeforeCursor = code.substring(0, cursorPos);
        const lines = textBeforeCursor.split('\n');
        return lines[lines.length - 1];
    }

    getCurrentLineIndex(lines, cursorPos) {
        let currentPos = 0;
        for (let i = 0; i < lines.length; i++) {
            currentPos += lines[i].length + 1; // +1 for newline
            if (currentPos >= cursorPos) {
                return i;
            }
        }
        return lines.length - 1;
    }

    getPositionAfterInsertion(code, lineIndex, insertedCode) {
        const lines = code.split('\n');
        let position = 0;
        
        for (let i = 0; i <= lineIndex; i++) {
            position += lines[i].length;
            if (i < lineIndex) {
                position += 1; // newline character
            }
        }
        
        return position;
    }

    // ✅ NEW: Category icons for snippets
    getCategoryIcon(category) {
        const icons = {
            'api': 'fas fa-code',
            'user': 'fas fa-user',
            'http': 'fas fa-globe',
            'ui': 'fas fa-th-large',
            'general': 'fas fa-cube',
            'variables': 'fas fa-tag',
            'functions': 'fas fa-cogs'
        };
        return icons[category] || 'fas fa-code';
    }

    // Rest of the existing methods remain the same...
    // [Previous methods like loadCommands, saveCommand, testCommand, etc. remain unchanged]

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

    // ... [Rest of the existing methods remain exactly the same]

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

    // ... [All other existing methods remain exactly the same]

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