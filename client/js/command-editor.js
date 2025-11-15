class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
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
    }

    async loadTemplates() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/templates', { // ✅ সঠিক endpoint
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                this.templates = data.templates;
                console.log(`✅ Loaded ${Object.keys(this.templates).length} template categories`);
                this.populateTemplatesModal();
            } else {
                throw new Error(data.error || 'Failed to load templates');
            }
        } catch (error) {
            console.error('❌ Load templates error:', error);
            this.showError('Failed to load templates: ' + error.message);
            // Fallback empty templates
            this.templates = {};
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
                </div>
            `;
            return;
        }

        let categoriesHTML = '';
        let templatesHTML = '';
        let firstCategory = true;

        // Generate category tabs and template content
        Object.entries(this.templates).forEach(([category, templates]) => {
            if (!Array.isArray(templates) || templates.length === 0) {
                console.warn(`⚠️ No templates found for category: ${category}`);
                return;
            }

            const categoryId = `${category}-templates`;
            const isActive = firstCategory ? 'active' : '';
            const displayName = this.formatCategoryName(category);
            
            // Category tab
            categoriesHTML += `
                <button class="category-tab ${isActive}" data-category="${category}">
                    ${displayName}
                </button>
            `;

            // Template category content
            templatesHTML += `
                <div id="${categoryId}" class="template-category ${isActive}">
                    <div class="templates-grid">
                        ${templates.map(template => this.createTemplateCard(template)).join('')}
                    </div>
                </div>
            `;

            firstCategory = false;
        });

        categoryTabsContainer.innerHTML = categoriesHTML;
        templatesContent.innerHTML = templatesHTML;

        // Setup category tab events
        this.setupTemplateCategories();
    }

    // File: /client/js/command-editor.js - createTemplateCard method
createTemplateCard(template) {
    if (!template || typeof template !== 'object') {
        return '<!-- Invalid template -->';
    }
    
    const safeTemplate = {
        id: template.id || 'unknown',
        name: template.name || 'Unnamed Template',
        patterns: template.patterns || '/unknown',
        code: template.code || '// No code',
        description: template.description || 'No description available',
        waitForAnswer: Boolean(template.waitForAnswer),
        answerHandler: template.answerHandler || ''
    };

    // Get appropriate icon
    const templateIcon = this.getTemplateIcon(safeTemplate.name);

    // FIXED: Proper JSON stringification without HTML entities
    const templateJson = JSON.stringify(safeTemplate)
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');

    return `
        <div class="template-card" data-template='${templateJson}'>
            <div class="template-icon">
                <i class="${templateIcon}"></i>
            </div>
            <h4>${this.escapeHtml(safeTemplate.name)}</h4>
            <p>${this.escapeHtml(safeTemplate.description)}</p>
            <div class="template-patterns">${this.escapeHtml(safeTemplate.patterns)}</div>
            <div class="template-footer">
                <span class="template-type">${safeTemplate.waitForAnswer ? 'Interactive' : 'Simple'}</span>
                <button class="btn-apply">Apply</button>
            </div>
        </div>
    `;
}

    getTemplateIcon(templateName) {
        const iconMap = {
            'welcome': 'fas fa-hand-wave',
            'help': 'fas fa-question-circle',
            'info': 'fas fa-info-circle',
            'echo': 'fas fa-comment-alt',
            'conversation': 'fas fa-comments',
            'registration': 'fas fa-user-plus',
            'feedback': 'fas fa-star',
            'quiz': 'fas fa-brain',
            'photo': 'fas fa-image',
            'video': 'fas fa-video',
            'document': 'fas fa-file',
            'buttons': 'fas fa-th',
            'keyboard': 'fas fa-keyboard',
            'url': 'fas fa-link',
            'data': 'fas fa-database',
            'cleanup': 'fas fa-broom',
            'export': 'fas fa-file-export',
            'http': 'fas fa-cloud-download-alt',
            'weather': 'fas fa-cloud-sun',
            'news': 'fas fa-newspaper',
            'admin': 'fas fa-shield-alt',
            'broadcast': 'fas fa-bullhorn',
            'scheduler': 'fas fa-clock',
            'error': 'fas fa-bug',
            'calculator': 'fas fa-calculator',
            'python': 'fab fa-python'
        };

        const lowerName = templateName.toLowerCase();
        for (const [key, icon] of Object.entries(iconMap)) {
            if (lowerName.includes(key)) {
                return icon;
            }
        }

        return 'fas fa-code'; // Default icon
    }

    formatCategoryName(category) {
        const nameMap = {
            'basic': 'Basic',
            'interactive': 'Interactive',
            'media': 'Media',
            'buttons': 'Buttons',
            'data': 'Data',
            'http': 'HTTP',
            'advanced': 'Advanced',
            'python': 'Python'
        };
        
        return nameMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
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

        document.getElementById('runTestBtn').addEventListener('click', () => {
            this.runCustomTest();
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
        document.getElementById('showTemplates').addEventListener('click', () => {
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

        // Modal events
        this.setupModalEvents();
        this.setupTemplateCategories();
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        const commandsTags = document.getElementById('commandsTags');

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

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) {
            console.error('❌ Advanced code editor not found');
            return;
        }
        
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

        advancedEditor.addEventListener('input', (e) => {
            this.updateLineCount(e.target.value);
        });

        this.updateLineCount(advancedEditor.value);
    }

    updateLineCount(code) {
        const lines = code.split('\n').length;
        const chars = code.length;
        
        const lineCountEl = document.getElementById('lineCount');
        const charCountEl = document.getElementById('charCount');
        
        if (lineCountEl) lineCountEl.textContent = `Line: ${lines}`;
        if (charCountEl) charCountEl.textContent = `Chars: ${chars}`;
    }

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
            this.updateLineCount(code);
        }
        
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (codeEditorModal) {
            codeEditorModal.style.display = 'flex';
        }
        
        setTimeout(() => {
            const editor = document.getElementById('advancedCodeEditor');
            if (editor) {
                editor.focus();
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
        
        this.closeCodeEditor();
        this.showSuccess('Code saved!');
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
                });
            }
            
            // ESC key to close modal
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.style.display === 'flex') {
                    modal.style.display = 'none';
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
                        console.error('❌ Template data parse error:', error);
                        this.showError('Invalid template data');
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
        const templateCategories = document.querySelectorAll('.template-category');

        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                if (!category) return;
                
                // Update tabs
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update content
                templateCategories.forEach(cat => cat.classList.remove('active'));
                const targetCategory = document.getElementById(`${category}-templates`);
                if (targetCategory) {
                    targetCategory.classList.add('active');
                }
            });
        });
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        if (section) {
            section.style.display = show ? 'block' : 'none';
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
        const commandEditor = document.getElementById('commandEditor');

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
        
        if (commandsList) {
            commandsList.innerHTML = html;
        }
    }

    filterCommands(searchTerm) {
        const commandGroups = document.querySelectorAll('.command-group');
        const lowerSearch = searchTerm.toLowerCase().trim();

        if (!lowerSearch) {
            commandGroups.forEach(group => group.style.display = 'block');
            return;
        }

        commandGroups.forEach(group => {
            const commandPatternEl = group.querySelector('.command-patterns');
            if (commandPatternEl) {
                const commandPattern = commandPatternEl.textContent.toLowerCase();
                const isVisible = commandPattern.includes(lowerSearch);
                group.style.display = isVisible ? 'block' : 'none';
            }
        });
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            command_patterns: '/start',
            code: '// Write your command code here\nconst user = getUser();\nBot.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        
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

    hideCommandEditor() {
        const noCommandSelected = document.getElementById('noCommandSelected');
        const commandEditor = document.getElementById('commandEditor');
        
        if (noCommandSelected) noCommandSelected.style.display = 'block';
        if (commandEditor) commandEditor.style.display = 'none';
        this.currentCommand = null;
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
        if (currentCommandNameEl) currentCommandNameEl.textContent = 'Command Editor';
        
        const commandIdEl = document.getElementById('commandId');
        if (commandIdEl) commandIdEl.textContent = `ID: ${this.currentCommand.id}`;
        
        const statusBadge = document.getElementById('commandStatus');
        if (statusBadge) {
            statusBadge.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            statusBadge.className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        }
        
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
            const text = this.currentCommand?.is_active ? 'Deactivate' : 'Activate';
            toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${text}`;
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

        const commandPatterns = commands.join(',');
        const commandCodeEl = document.getElementById('commandCode');
        const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';

        if (!commandCode) {
            this.showError('Command code is required');
            if (commandCodeEl) commandCodeEl.focus();
            return false;
        }

        const waitForAnswerEl = document.getElementById('waitForAnswer');
        const answerHandlerEl = document.getElementById('answerHandler');
        
        const formData = {
            commandPatterns: commandPatterns,
            code: commandCode,
            waitForAnswer: waitForAnswerEl ? waitForAnswerEl.checked : false,
            answerHandler: (waitForAnswerEl && waitForAnswerEl.checked && answerHandlerEl) ? 
                          answerHandlerEl.value.trim() : '',
            botToken: this.currentBot.token
        };

        if (formData.waitForAnswer && !formData.answerHandler) {
            this.showError('Answer handler code is required when "Wait for Answer" is enabled');
            if (answerHandlerEl) answerHandlerEl.focus();
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
}
 else {
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

// Update the test response handling in runCustomTest method:

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

    showTemplates() {
        const modal = document.getElementById('templatesModal');
        if (!modal) {
            this.showError('Templates modal not found');
            return;
        }
        
        modal.style.display = 'flex';
        
        // Load templates if not already loaded
        if (Object.keys(this.templates).length === 0) {
            this.loadTemplates();
        }
    }

applyTemplate(template) {
    try {
        if (!template || typeof template !== 'object') {
            throw new Error('Invalid template data');
        }

        console.log('🔄 Applying template:', template.name);

        // Ensure we're editing a command (create new if none selected)
        if (!this.currentCommand || this.currentCommand.id === 'new') {
            this.addNewCommand();
        }

        // Set command patterns
        if (template.patterns) {
            this.setCommandsToTags(template.patterns);
            console.log('✅ Patterns applied:', template.patterns);
        }

        // Set main code - FIXED: Use proper code from template
        const commandCodeEl = document.getElementById('commandCode');
        if (commandCodeEl && template.code) {
            // Clean and format the code
            let cleanedCode = template.code;
            
            // Fix escaped newlines if present
            cleanedCode = cleanedCode.replace(/\\\\n/g, '\n');
            cleanedCode = cleanedCode.replace(/\\\\`/g, '`');
            
            commandCodeEl.value = cleanedCode;
            console.log('✅ Code applied, length:', cleanedCode.length);
        }

        // Handle wait for answer
        const waitForAnswerEl = document.getElementById('waitForAnswer');
        if (waitForAnswerEl) {
            const waitForAnswer = Boolean(template.waitForAnswer);
            waitForAnswerEl.checked = waitForAnswer;
            this.toggleAnswerHandler(waitForAnswer);
            console.log('✅ Wait for answer:', waitForAnswer);
        }

        // Set answer handler if available
        const answerHandlerEl = document.getElementById('answerHandler');
        if (template.waitForAnswer && template.answerHandler && answerHandlerEl) {
            let cleanedAnswerHandler = template.answerHandler;
            cleanedAnswerHandler = cleanedAnswerHandler.replace(/\\\\n/g, '\n');
            cleanedAnswerHandler = cleanedAnswerHandler.replace(/\\\\`/g, '`');
            answerHandlerEl.value = cleanedAnswerHandler;
            console.log('✅ Answer handler applied');
        } else if (answerHandlerEl) {
            answerHandlerEl.value = '';
        }

        // Update form fields with template data
        if (template.name) {
            const commandNameEl = document.getElementById('commandName');
            if (commandNameEl) {
                commandNameEl.value = template.name;
            }
        }

        if (template.description) {
            const commandDescEl = document.getElementById('commandDescription');
            if (commandDescEl) {
                commandDescEl.value = template.description;
            }
        }

        // Close template modal
        const templatesModal = document.getElementById('templatesModal');
        if (templatesModal) {
            templatesModal.style.display = 'none';
        }

        // Focus on command code editor
        setTimeout(() => {
            if (commandCodeEl) {
                commandCodeEl.focus();
                commandCodeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);

        this.showSuccess(`Template "${template.name}" applied successfully!`);

    } catch (error) {
        console.error('❌ Apply template error:', error);
        this.showError('Failed to apply template: ' + error.message);
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

// Initialize command editor
let commandEditor;

document.addEventListener('DOMContentLoaded', () => {
    commandEditor = new CommandEditor();
    
    // Add click event for command groups
    document.addEventListener('click', (e) => {
        const commandGroup = e.target.closest('.command-group');
        if (commandGroup && commandGroup.dataset.commandId) {
            const commandId = commandGroup.dataset.commandId;
            
            // Prevent multiple rapid clicks
            if (commandEditor.currentCommand?.id === commandId) {
                return;
            }
            
            if (commandEditor.selectCommand) {
                commandEditor.selectCommand(commandId);
            }
        }
    });
    
    // Add event listener for waitForAnswer toggle
    const waitForAnswerToggle = document.getElementById('waitForAnswer');
    if (waitForAnswerToggle && commandEditor) {
        waitForAnswerToggle.addEventListener('change', (e) => {
            commandEditor.toggleAnswerHandler(e.target.checked);
        });
    }
    
    // Template category tabs event delegation
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
});