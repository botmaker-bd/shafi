// Enhanced Command Editor JavaScript - Fixed Version
class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
        this.currentEditorType = 'main';
        this.editorHistory = {
            main: { past: [], future: [] },
            answer: { past: [], future: [] }
        };
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadBotInfo();
        this.setupEventListeners();
        await this.loadCommands();
        this.setupCodeEditor();
        this.setupCommandsTags();
    }

    async loadTemplatesFromServer() {
        try {
            this.showLoading(true);
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
                    this.populateTemplatesModal();
                    return true;
                } else {
                    throw new Error(data.error || 'Failed to load templates');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Load templates error:', error);
            this.showTemplatesError(`Failed to load templates: ${error.message}`);
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    populateTemplatesModal() {
        const templatesContent = document.querySelector('.templates-content');
        if (!templatesContent) return;

        // Check if templates are empty or not loaded properly
        if (!this.templates || Object.keys(this.templates).length === 0) {
            this.showTemplatesError('No templates available from server');
            return;
        }

        let html = '';
        let hasTemplates = false;

        for (const [category, templates] of Object.entries(this.templates)) {
            const categoryId = `${category}-templates`;
            const isActive = category === 'basic' ? 'active' : '';
            
            if (templates && Array.isArray(templates) && templates.length > 0) {
                hasTemplates = true;
                html += `
                    <div id="${categoryId}" class="template-category ${isActive}">
                        <div class="templates-grid">
                            ${templates.map(template => `
                                <div class="template-card" data-template='${JSON.stringify(template).replace(/'/g, "&apos;")}'>
                                    <div class="template-icon">
                                        <i class="fas fa-${this.getTemplateIcon(category)}"></i>
                                    </div>
                                    <h4>${this.escapeHtml(template.name || 'Unnamed Template')}</h4>
                                    <p>${this.escapeHtml(template.description || 'No description available')}</p>
                                    ${template.patterns ? `
                                    <div class="template-preview">
                                        <strong>Patterns:</strong> ${this.escapeHtml(template.patterns)}
                                        ${template.code ? `
                                        <div class="template-code-preview">
                                            ${this.escapeHtml(template.code.substring(0, 100))}...
                                        </div>
                                        ` : ''}
                                    </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        if (!hasTemplates) {
            html = `
                <div class="template-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No templates found in any category</p>
                    <p class="template-help">Check if template files exist on the server</p>
                </div>
            `;
        }

        templatesContent.innerHTML = html;
        
        // Re-attach event listeners to category tabs
        this.setupTemplateCategories();
    }

    showTemplatesError(message) {
        const templatesContent = document.querySelector('.templates-content');
        if (templatesContent) {
            templatesContent.innerHTML = `
                <div class="template-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${this.escapeHtml(message)}</p>
                    <button class="btn btn-primary btn-small" id="retryTemplates">
                        <i class="fas fa-redo"></i> Retry Loading
                    </button>
                </div>
            `;

            document.getElementById('retryTemplates')?.addEventListener('click', () => {
                this.loadTemplatesFromServer();
            });
        }
    }

    getTemplateIcon(category) {
        const icons = {
            'basic': 'code',
            'interactive': 'comments',
            'media': 'image',
            'buttons': 'th',
            'data': 'database',
            'http': 'cloud',
            'advanced': 'cogs',
            'python': 'python'
        };
        return icons[category] || 'code';
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('backToBots')?.addEventListener('click', () => {
            window.location.href = 'bot-management.html';
        });

        document.getElementById('quickTest')?.addEventListener('click', () => {
            this.quickTest();
        });

        // Command actions
        document.getElementById('addCommandBtn')?.addEventListener('click', () => {
            this.addNewCommand();
        });

        document.getElementById('createFirstCommand')?.addEventListener('click', () => {
            this.addNewCommand();
        });

        document.getElementById('addFirstCommand')?.addEventListener('click', () => {
            this.addNewCommand();
        });

        // Form actions
        document.getElementById('saveCommandBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveCommand();
        });

        document.getElementById('deleteCommandBtn')?.addEventListener('click', () => {
            this.deleteCommand();
        });

        document.getElementById('toggleCommandBtn')?.addEventListener('click', () => {
            this.toggleCommand();
        });

        document.getElementById('testCommandBtn')?.addEventListener('click', () => {
            this.testCommand();
        });

        // Quick test button
        document.getElementById('runQuickTestBtn')?.addEventListener('click', () => {
            this.runQuickTest();
        });

        // Enter key for quick test
        document.getElementById('quickTestInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.runQuickTest();
            }
        });

        // Toggle switches
        document.getElementById('waitForAnswer')?.addEventListener('change', (e) => {
            this.toggleAnswerHandler(e.target.checked);
        });

        // Code editor buttons
        document.getElementById('openEditor')?.addEventListener('click', () => {
            this.openCodeEditor('main');
        });

        document.getElementById('openAnswerEditor')?.addEventListener('click', () => {
            this.openCodeEditor('answer');
        });

        // Templates
        document.getElementById('showTemplates')?.addEventListener('click', async () => {
            await this.showTemplates();
        });

        document.getElementById('refreshTemplates')?.addEventListener('click', async () => {
            await this.loadTemplatesFromServer();
        });

        // Search
        let searchTimeout;
        document.getElementById('commandSearch')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Copy result button
        document.getElementById('copyResultBtn')?.addEventListener('click', () => {
            this.copyTestResult();
        });

        // Modal events
        this.setupModalEvents();
        this.setupTemplateCategories();

        // Command group click events
        document.addEventListener('click', (e) => {
            const commandGroup = e.target.closest('.command-group');
            if (commandGroup) {
                const commandId = commandGroup.dataset.commandId;
                if (commandId) {
                    this.selectCommand(commandId);
                }
            }
        });

        // Form validation
        this.setupFormValidation();
    }

    setupFormValidation() {
        const commandCode = document.getElementById('commandCode');
        const moreCommands = document.getElementById('moreCommands');
        
        if (commandCode) {
            commandCode.addEventListener('blur', () => {
                this.validateCommandCode();
            });
        }
        
        if (moreCommands) {
            moreCommands.addEventListener('blur', () => {
                this.validateCommandPatterns();
            });
        }
    }

    validateCommandCode() {
        const code = document.getElementById('commandCode').value.trim();
        if (!code) {
            this.showFieldError('commandCode', 'Command code is required');
            return false;
        }
        this.clearFieldError('commandCode');
        return true;
    }

    validateCommandPatterns() {
        const commands = this.getCommandsFromTags();
        if (commands.length === 0) {
            this.showFieldError('moreCommands', 'At least one command pattern is required');
            return false;
        }
        this.clearFieldError('moreCommands');
        return true;
    }

    showFieldError(fieldId, message) {
        this.clearFieldError(fieldId);
        
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.cssText = `
            color: #ef4444;
            font-size: 0.75rem;
            margin-top: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        `;
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        
        field.parentNode.appendChild(errorDiv);
        field.style.borderColor = '#ef4444';
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
        field.style.borderColor = '';
    }

    async showTemplates() {
        const templatesContent = document.querySelector('.templates-content');
        if (templatesContent) {
            templatesContent.innerHTML = `
                <div class="template-loading">
                    <div class="spinner"></div>
                    <p>Loading templates from server...</p>
                </div>
            `;
        }

        document.getElementById('templatesModal').style.display = 'flex';
        await this.loadTemplatesFromServer();
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal', 'templatesModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            const closeBtn = modal?.querySelector('.modal-close');
            
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }
        });

        document.getElementById('closeTestCommand')?.addEventListener('click', () => {
            document.getElementById('testCommandModal').style.display = 'none';
        });

        document.getElementById('closeTemplates')?.addEventListener('click', () => {
            document.getElementById('templatesModal').style.display = 'none';
        });

        // Template card click events
        document.addEventListener('click', (e) => {
            const templateCard = e.target.closest('.template-card');
            if (templateCard) {
                const templateData = templateCard.dataset.template;
                if (templateData) {
                    try {
                        // Replace &apos; with ' before parsing
                        const cleanData = templateData.replace(/&apos;/g, "'");
                        const template = JSON.parse(cleanData);
                        this.applyTemplate(template);
                    } catch (error) {
                        console.error('Error parsing template:', error);
                        this.showError('Failed to apply template: ' + error.message);
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

        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.dataset.category;
                
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
        const advancedEditor = document.getElementById('advancedCodeEditor');
        
        if (!advancedEditor) return;

        // Cancel button
        document.getElementById('cancelEdit')?.addEventListener('click', () => {
            this.closeCodeEditor();
        });

        // Save button
        document.getElementById('saveCode')?.addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        // Editor input events for undo/redo
        advancedEditor.addEventListener('input', (e) => {
            this.updateLineCount(e.target.value);
            this.saveToHistory(this.currentEditorType, e.target.value);
        });

        // Editor toolbar buttons
        this.setupEditorToolbar();

        this.updateLineCount(advancedEditor.value);
    }

    setupEditorToolbar() {
        const editor = document.getElementById('advancedCodeEditor');
        
        if (!editor) return;

        // Enhanced Undo/Redo functionality
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            this.undo(this.currentEditorType);
        });

        document.getElementById('redoBtn')?.addEventListener('click', () => {
            this.redo(this.currentEditorType);
        });

        // Select All
        document.getElementById('selectAllBtn')?.addEventListener('click', () => {
            editor.select();
            editor.focus();
        });

        // Cut
        document.getElementById('cutBtn')?.addEventListener('click', () => {
            const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            if (selectedText) {
                navigator.clipboard.writeText(selectedText).then(() => {
                    this.insertTextAtCursor(editor, '');
                    this.saveToHistory(this.currentEditorType, editor.value);
                });
            }
            editor.focus();
        });

        // Copy
        document.getElementById('copyBtn')?.addEventListener('click', () => {
            const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            if (selectedText) {
                navigator.clipboard.writeText(selectedText);
            }
            editor.focus();
        });

        // Paste
        document.getElementById('pasteBtn')?.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                this.insertTextAtCursor(editor, text);
                this.saveToHistory(this.currentEditorType, editor.value);
                editor.focus();
            } catch (err) {
                console.error('Paste failed:', err);
            }
        });

        // Clear
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            editor.value = '';
            this.updateLineCount('');
            this.saveToHistory(this.currentEditorType, '');
            editor.focus();
        });

        // Format (basic indentation)
        document.getElementById('formatBtn')?.addEventListener('click', () => {
            this.formatCode();
            editor.focus();
        });
    }

    // Enhanced Undo/Redo implementation
    saveToHistory(editorType, content) {
        if (!this.editorHistory[editorType]) return;
        
        this.editorHistory[editorType].past.push(content);
        this.editorHistory[editorType].future = []; // Clear redo stack
    }

    undo(editorType) {
        const history = this.editorHistory[editorType];
        if (!history || history.past.length <= 1) return;
        
        const current = history.past.pop();
        history.future.push(current);
        
        const previous = history.past[history.past.length - 1];
        this.setEditorContent(previous);
    }

    redo(editorType) {
        const history = this.editorHistory[editorType];
        if (!history || history.future.length === 0) return;
        
        const next = history.future.pop();
        history.past.push(next);
        
        this.setEditorContent(next);
    }

    setEditorContent(content) {
        const editor = document.getElementById('advancedCodeEditor');
        if (editor) {
            editor.value = content;
            this.updateLineCount(content);
        }
    }

    insertTextAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after = textarea.value.substring(end);
        
        textarea.value = before + text + after;
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }

    formatCode() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;
        
        let code = editor.value;
        
        // Basic formatting - add proper indentation
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        
        for (let line of lines) {
            line = line.trim();
            if (!line) {
                formattedLines.push('');
                continue;
            }
            
            // Decrease indent for closing braces
            if (line.includes('}') || line.includes(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add current line with proper indentation
            formattedLines.push('    '.repeat(indentLevel) + line);
            
            // Increase indent for opening braces
            if (line.includes('{') || line.includes('(')) {
                indentLevel++;
            }
        }
        
        editor.value = formattedLines.join('\n');
        this.updateLineCount(editor.value);
        this.saveToHistory(this.currentEditorType, editor.value);
        this.showSuccess('Code formatted!');
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        if (!moreCommandsInput) return;

        moreCommandsInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const command = moreCommandsInput.value.trim();
                if (command) {
                    this.addCommandTag(command);
                    moreCommandsInput.value = '';
                }
            }
            
            // Backspace to remove last tag
            if (e.key === 'Backspace' && moreCommandsInput.value === '') {
                this.removeLastCommandTag();
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
            const commands = pastedText.split(/[,|\n]/).map(cmd => cmd.trim()).filter(cmd => cmd);
            
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
            <button type="button" class="remove-tag" title="Remove command pattern">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        tag.querySelector('.remove-tag').addEventListener('click', () => {
            tag.remove();
            this.validateCommandPatterns();
        });
        
        commandsTags.appendChild(tag);
        this.validateCommandPatterns();
    }

    removeLastCommandTag() {
        const commandsTags = document.getElementById('commandsTags');
        if (!commandsTags || !commandsTags.lastChild) return;
        
        commandsTags.lastChild.remove();
        this.validateCommandPatterns();
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
        
        commands.forEach(command => {
            if (command) {
                this.addCommandTag(command);
            }
        });
    }

    // Rest of the methods remain largely the same but with additional error handling
    // ... [previous methods like runQuickTest, testCommand, etc.]

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
        }

        // Validate form before saving
        if (!this.validateCommandPatterns() || !this.validateCommandCode()) {
            this.showError('Please fix validation errors before saving');
            return false;
        }

        const commands = this.getCommandsFromTags();
        const commandPatterns = commands.join(',');
        const commandCode = document.getElementById('commandCode').value.trim();

        const formData = {
            commandPatterns: commandPatterns,
            code: commandCode,
            waitForAnswer: document.getElementById('waitForAnswer').checked,
            answerHandler: document.getElementById('waitForAnswer').checked ? 
                          document.getElementById('answerHandler').value.trim() : '',
            botToken: this.currentBot.token
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
            this.showError('Network error while saving command: ' + error.message);
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    // Utility methods
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
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showError(message) {
        if (typeof commonApp !== 'undefined' && commonApp.showError) {
            commonApp.showError(message);
        } else {
            alert('Error: ' + message);
        }
    }

    showSuccess(message) {
        if (typeof commonApp !== 'undefined' && commonApp.showSuccess) {
            commonApp.showSuccess(message);
        } else {
            alert('Success: ' + message);
        }
    }
}

// Initialize command editor with error handling
let commandEditor;
document.addEventListener('DOMContentLoaded', () => {
    try {
        commandEditor = new CommandEditor();
    } catch (error) {
        console.error('Failed to initialize command editor:', error);
        alert('Failed to initialize command editor. Please refresh the page.');
    }
});