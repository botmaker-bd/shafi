/**
 * Full Screen Code Editor Class
 * Advanced code editor with syntax highlighting, snippets, and more
 */
class FullScreenEditor {
    constructor() {
        this.editor = null;
        this.lineNumbers = null;
        this.isModified = false;
        this.currentTheme = 'dark';
        this.fontSize = 14;
        this.cursorPosition = { line: 1, column: 1 };
        this.selection = { start: 0, end: 0 };
        this.findState = {
            query: '',
            results: [],
            currentIndex: -1,
            caseSensitive: false,
            wholeWord: false,
            regex: false
        };
        this.snippets = [];
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadSnippets();
        this.updateUI();
        this.setupSyntaxHighlighting();
        
        console.log('🚀 Full Screen Editor initialized');
        
        // Focus editor
        setTimeout(() => {
            this.editor.focus();
        }, 100);
    }

    initializeElements() {
        this.editor = document.getElementById('codeEditor');
        this.lineNumbers = document.getElementById('lineNumbers');
        
        // Core UI elements
        this.elements = {
            // Header
            editorTitle: document.getElementById('editorTitle'),
            fileName: document.getElementById('fileName'),
            
            // Stats
            lineCount: document.getElementById('lineCount'),
            charCount: document.getElementById('charCount'),
            wordCount: document.getElementById('wordCount'),
            cursorLine: document.getElementById('cursorLine'),
            cursorColumn: document.getElementById('cursorColumn'),
            selectionInfo: document.getElementById('selectionInfo'),
            editorMode: document.getElementById('editorMode'),
            fontSizeDisplay: document.getElementById('fontSizeDisplay'),
            
            // Toolbar buttons
            themeToggle: document.getElementById('themeToggle'),
            fullscreenToggle: document.getElementById('fullscreenToggle'),
            closeEditor: document.getElementById('closeEditor'),
            undoBtn: document.getElementById('undoBtn'),
            redoBtn: document.getElementById('redoBtn'),
            cutBtn: document.getElementById('cutBtn'),
            copyBtn: document.getElementById('copyBtn'),
            pasteBtn: document.getElementById('pasteBtn'),
            selectAllBtn: document.getElementById('selectAllBtn'),
            findReplaceBtn: document.getElementById('findReplaceBtn'),
            formatBtn: document.getElementById('formatBtn'),
            commentBtn: document.getElementById('commentBtn'),
            snippetsBtn: document.getElementById('snippetsBtn'),
            clearBtn: document.getElementById('clearBtn'),
            fontSizeDown: document.getElementById('fontSizeDown'),
            fontSizeUp: document.getElementById('fontSizeUp'),
            
            // Footer buttons
            minimizeBtn: document.getElementById('minimizeBtn'),
            saveBtn: document.getElementById('saveBtn'),
            
            // Panels
            findReplacePanel: document.getElementById('findReplacePanel'),
            findInput: document.getElementById('findInput'),
            replaceInput: document.getElementById('replaceInput'),
            findResults: document.getElementById('findResults'),
            findPrevBtn: document.getElementById('findPrevBtn'),
            findNextBtn: document.getElementById('findNextBtn'),
            replaceBtn: document.getElementById('replaceBtn'),
            replaceAllBtn: document.getElementById('replaceAllBtn'),
            caseSensitive: document.getElementById('caseSensitive'),
            wholeWord: document.getElementById('wholeWord'),
            regexSearch: document.getElementById('regexSearch'),
            closeFindPanel: document.getElementById('closeFindPanel'),
            
            // Snippets modal
            snippetsModal: document.getElementById('snippetsModal'),
            snippetsSearch: document.getElementById('snippetsSearch'),
            snippetsContent: document.getElementById('snippetsContent'),
            closeSnippets: document.getElementById('closeSnippets'),
            
            // Notifications
            statusNotification: document.getElementById('statusNotification'),
            notificationMessage: document.getElementById('notificationMessage'),
            notificationClose: document.getElementById('notificationClose')
        };
    }

    setupEventListeners() {
        // Editor events
        this.editor.addEventListener('input', () => this.onEditorChange());
        this.editor.addEventListener('scroll', () => this.syncScroll());
        this.editor.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.editor.addEventListener('click', () => this.updateCursorPosition());
        this.editor.addEventListener('select', () => this.updateSelectionInfo());
        
        // Toolbar events
        this.setupToolbarEvents();
        
        // Find & Replace events
        this.setupFindReplaceEvents();
        
        // Snippets events
        this.setupSnippetsEvents();
        
        // UI events
        this.setupUIEvents();
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }

    setupToolbarEvents() {
        // Edit operations
        this.elements.undoBtn.addEventListener('click', () => this.execCommand('undo'));
        this.elements.redoBtn.addEventListener('click', () => this.execCommand('redo'));
        this.elements.cutBtn.addEventListener('click', () => this.execCommand('cut'));
        this.elements.copyBtn.addEventListener('click', () => this.execCommand('copy'));
        this.elements.pasteBtn.addEventListener('click', () => this.pasteText());
        this.elements.selectAllBtn.addEventListener('click', () => this.selectAll());
        
        // Code operations
        this.elements.formatBtn.addEventListener('click', () => this.formatCode());
        this.elements.commentBtn.addEventListener('click', () => this.toggleComment());
        this.elements.clearBtn.addEventListener('click', () => this.clearEditor());
        
        // UI operations
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.fullscreenToggle.addEventListener('click', () => this.toggleFullscreen());
        this.elements.closeEditor.addEventListener('click', () => this.closeEditor());
        this.elements.fontSizeDown.addEventListener('click', () => this.changeFontSize(-1));
        this.elements.fontSizeUp.addEventListener('click', () => this.changeFontSize(1));
        
        // Modal triggers
        this.elements.findReplaceBtn.addEventListener('click', () => this.showFindReplace());
        this.elements.snippetsBtn.addEventListener('click', () => this.showSnippets());
        
        // Footer buttons
        this.elements.minimizeBtn.addEventListener('click', () => this.minimize());
        this.elements.saveBtn.addEventListener('click', () => this.saveChanges());
    }

    setupFindReplaceEvents() {
        this.elements.findInput.addEventListener('input', () => this.performFind());
        this.elements.findPrevBtn.addEventListener('click', () => this.findPrevious());
        this.elements.findNextBtn.addEventListener('click', () => this.findNext());
        this.elements.replaceBtn.addEventListener('click', () => this.replace());
        this.elements.replaceAllBtn.addEventListener('click', () => this.replaceAll());
        this.elements.closeFindPanel.addEventListener('click', () => this.hideFindReplace());
        
        // Option changes
        this.elements.caseSensitive.addEventListener('change', () => this.performFind());
        this.elements.wholeWord.addEventListener('change', () => this.performFind());
        this.elements.regexSearch.addEventListener('change', () => this.performFind());
    }

    setupSnippetsEvents() {
        this.elements.snippetsSearch.addEventListener('input', () => this.filterSnippets());
        this.elements.closeSnippets.addEventListener('click', () => this.hideSnippets());
        
        // Close snippets when clicking outside
        this.elements.snippetsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.snippetsModal) {
                this.hideSnippets();
            }
        });
    }

    setupUIEvents() {
        this.elements.notificationClose.addEventListener('click', () => this.hideNotification());
        
        // Close find panel with Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.findReplacePanel.style.display === 'block') {
                    this.hideFindReplace();
                }
                if (this.elements.snippetsModal.style.display === 'flex') {
                    this.hideSnippets();
                }
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveChanges();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.showFindReplace();
                        break;
                    case 'z':
                        if (!e.shiftKey) {
                            e.preventDefault();
                            this.execCommand('undo');
                        }
                        break;
                    case 'y':
                        e.preventDefault();
                        this.execCommand('redo');
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAll();
                        break;
                    case '/':
                        e.preventDefault();
                        this.toggleComment();
                        break;
                }
                
                if (e.shiftKey && e.key === 'F') {
                    e.preventDefault();
                    this.formatCode();
                }
            }
        });
    }

    // Editor Core Functions
    onEditorChange() {
        this.isModified = true;
        this.updateLineNumbers();
        this.updateStats();
        this.updateCursorPosition();
        this.updateSelectionInfo();
        this.applySyntaxHighlighting();
    }

    updateLineNumbers() {
        const lines = this.editor.value.split('\n');
        let numbersHTML = '';
        
        for (let i = 1; i <= lines.length; i++) {
            numbersHTML += `<span>${i}</span>`;
        }
        
        this.lineNumbers.innerHTML = numbersHTML;
        this.syncScroll();
    }

    syncScroll() {
        this.lineNumbers.scrollTop = this.editor.scrollTop;
    }

    updateStats() {
        const text = this.editor.value;
        const lines = text.split('\n').length;
        const chars = text.length;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        
        this.elements.lineCount.textContent = lines;
        this.elements.charCount.textContent = chars;
        this.elements.wordCount.textContent = words;
    }

    updateCursorPosition() {
        const cursorPos = this.editor.selectionStart;
        const textBeforeCursor = this.editor.value.substring(0, cursorPos);
        const currentLine = textBeforeCursor.split('\n').length;
        const currentColumn = textBeforeCursor.split('\n').pop().length + 1;
        
        this.cursorPosition = { line: currentLine, column: currentColumn };
        
        this.elements.cursorLine.textContent = currentLine;
        this.elements.cursorColumn.textContent = currentColumn;
    }

    updateSelectionInfo() {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        this.selection = { start, end };
        
        if (start === end) {
            this.elements.selectionInfo.textContent = 'No selection';
        } else {
            const selectedText = this.editor.value.substring(start, end);
            const lines = selectedText.split('\n').length;
            const chars = selectedText.length;
            this.elements.selectionInfo.textContent = `${lines} line${lines > 1 ? 's' : ''}, ${chars} chars selected`;
        }
    }

    // Edit Operations
    execCommand(command) {
        document.execCommand(command);
        this.editor.focus();
        this.onEditorChange();
    }

    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            this.insertTextAtCursor(text);
        } catch (err) {
            this.execCommand('paste');
        }
    }

    insertTextAtCursor(text) {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const currentText = this.editor.value;
        
        this.editor.value = currentText.substring(0, start) + text + currentText.substring(end);
        this.editor.selectionStart = this.editor.selectionEnd = start + text.length;
        this.editor.focus();
        this.onEditorChange();
    }

    selectAll() {
        this.editor.select();
        this.updateSelectionInfo();
    }

    clearEditor() {
        if (confirm('Are you sure you want to clear all code?')) {
            this.editor.value = '';
            this.onEditorChange();
            this.showNotification('Editor cleared', 'success');
        }
    }

    // Code Operations
    formatCode() {
        const code = this.editor.value;
        try {
            const formatted = this.formatJavaScript(code);
            this.editor.value = formatted;
            this.onEditorChange();
            this.showNotification('Code formatted successfully', 'success');
        } catch (error) {
            this.showNotification('Formatting failed: ' + error.message, 'error');
        }
    }

    formatJavaScript(code) {
        // Basic JavaScript formatting - can be enhanced with a proper formatter
        let formatted = code;
        
        // Add spaces around operators
        formatted = formatted.replace(/([=+*/-])(?!=)/g, ' $1 ');
        
        // Add newlines after braces
        formatted = formatted.replace(/{/g, '{\n');
        formatted = formatted.replace(/}/g, '\n}');
        
        // Basic indentation
        const lines = formatted.split('\n');
        let indentLevel = 0;
        const formattedLines = [];
        
        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {
                formattedLines.push('');
                continue;
            }
            
            // Decrease indent for closing braces
            if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add line with proper indentation
            formattedLines.push('    '.repeat(indentLevel) + trimmed);
            
            // Increase indent for opening braces
            if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
                indentLevel++;
            }
        }
        
        return formattedLines.join('\n');
    }

    toggleComment() {
        const start = this.editor.selectionStart;
        const end = this.editor.selectionEnd;
        const selectedText = this.editor.value.substring(start, end);
        
        if (selectedText.includes('\n')) {
            // Multiple lines - toggle line comments
            const lines = selectedText.split('\n');
            const allCommented = lines.every(line => line.trim().startsWith('//'));
            
            const newLines = lines.map(line => {
                if (allCommented) {
                    return line.replace(/^\/\//, '');
                } else {
                    return line.trim() ? '//' + line : line;
                }
            });
            
            this.insertTextAtCursor(newLines.join('\n'));
        } else {
            // Single line or no selection
            if (selectedText.startsWith('//')) {
                this.insertTextAtCursor(selectedText.substring(2));
            } else {
                this.insertTextAtCursor('//' + selectedText);
            }
        }
    }

    // Find & Replace
    showFindReplace() {
        this.elements.findReplacePanel.classList.add('show');
        this.elements.findInput.focus();
        this.elements.findInput.select();
    }

    hideFindReplace() {
        this.elements.findReplacePanel.classList.remove('show');
        this.editor.focus();
    }

    performFind() {
        const query = this.elements.findInput.value;
        if (!query) {
            this.clearFindResults();
            return;
        }
        
        this.findState.query = query;
        this.findState.caseSensitive = this.elements.caseSensitive.checked;
        this.findState.wholeWord = this.elements.wholeWord.checked;
        this.findState.regex = this.elements.regexSearch.checked;
        
        this.findAllMatches();
    }

    findAllMatches() {
        const text = this.editor.value;
        const query = this.findState.query;
        let searchRegex;
        
        try {
            if (this.findState.regex) {
                searchRegex = new RegExp(query, this.findState.caseSensitive ? 'g' : 'gi');
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let pattern = escapedQuery;
                
                if (this.findState.wholeWord) {
                    pattern = `\\b${pattern}\\b`;
                }
                
                searchRegex = new RegExp(pattern, this.findState.caseSensitive ? 'g' : 'gi');
            }
            
            this.findState.results = [];
            let match;
            
            while ((match = searchRegex.exec(text)) !== null) {
                this.findState.results.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    text: match[0]
                });
            }
            
            this.findState.currentIndex = -1;
            this.updateFindResults();
            
        } catch (error) {
            this.showNotification('Invalid regex pattern', 'error');
        }
    }

    updateFindResults() {
        const count = this.findState.results.length;
        this.elements.findResults.textContent = `${count} result${count !== 1 ? 's' : ''}`;
        
        if (count > 0) {
            this.findNext();
        } else {
            this.clearSelection();
        }
    }

    findNext() {
        if (this.findState.results.length === 0) return;
        
        this.findState.currentIndex = (this.findState.currentIndex + 1) % this.findState.results.length;
        this.selectFindResult(this.findState.currentIndex);
    }

    findPrevious() {
        if (this.findState.results.length === 0) return;
        
        this.findState.currentIndex = this.findState.currentIndex <= 0 ? 
            this.findState.results.length - 1 : this.findState.currentIndex - 1;
        this.selectFindResult(this.findState.currentIndex);
    }

    selectFindResult(index) {
        const result = this.findState.results[index];
        if (!result) return;
        
        this.editor.selectionStart = result.start;
        this.editor.selectionEnd = result.end;
        this.editor.focus();
        
        // Scroll to selection
        this.scrollToSelection();
        
        this.updateSelectionInfo();
        this.elements.findResults.textContent = `${index + 1} of ${this.findState.results.length}`;
    }

    scrollToSelection() {
        const lineHeight = 21; // Approximate line height in pixels
        const cursorLine = this.editor.value.substring(0, this.editor.selectionStart).split('\n').length;
        const scrollTop = (cursorLine - 5) * lineHeight;
        this.editor.scrollTop = Math.max(0, scrollTop);
    }

    replace() {
        if (this.findState.results.length === 0) return;
        
        const replaceText = this.elements.replaceInput.value;
        const currentResult = this.findState.results[this.findState.currentIndex];
        
        if (currentResult) {
            const before = this.editor.value.substring(0, currentResult.start);
            const after = this.editor.value.substring(currentResult.end);
            this.editor.value = before + replaceText + after;
            
            // Adjust selection
            this.editor.selectionStart = currentResult.start;
            this.editor.selectionEnd = currentResult.start + replaceText.length;
            
            this.onEditorChange();
            this.performFind(); // Refresh find results
        }
    }

    replaceAll() {
        if (this.findState.results.length === 0) return;
        
        const replaceText = this.elements.replaceInput.value;
        let newText = this.editor.value;
        let offset = 0;
        
        // Replace all occurrences
        this.findState.results.forEach(result => {
            const start = result.start + offset;
            const end = result.end + offset;
            newText = newText.substring(0, start) + replaceText + newText.substring(end);
            offset += replaceText.length - (result.end - result.start);
        });
        
        this.editor.value = newText;
        this.onEditorChange();
        this.clearFindResults();
        this.showNotification(`Replaced ${this.findState.results.length} occurrences`, 'success');
    }

    clearFindResults() {
        this.findState.results = [];
        this.findState.currentIndex = -1;
        this.elements.findResults.textContent = '0 results';
        this.clearSelection();
    }

    clearSelection() {
        this.editor.selectionStart = this.editor.selectionEnd;
        this.updateSelectionInfo();
    }

    // Snippets Management
    loadSnippets() {
        this.snippets = [
            {
                name: 'Send Message',
                description: 'Send a message to the user',
                code: 'Api.sendMessage("Hello world!");',
                language: 'javascript',
                icon: 'fas fa-comment'
            },
            {
                name: 'User Info',
                description: 'Get user information',
                code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}!`);',
                language: 'javascript',
                icon: 'fas fa-user'
            },
            {
                name: 'Inline Keyboard',
                description: 'Create inline keyboard buttons',
                code: 'const keyboard = [\n  [{ text: "Button 1", callback_data: "btn1" }],\n  [{ text: "Button 2", callback_data: "btn2" }]\n];\nApi.sendMessage("Choose:", { inline_keyboard: keyboard });',
                language: 'javascript',
                icon: 'fas fa-th'
            },
            {
                name: 'Wait for Answer',
                description: 'Wait for user response',
                code: 'Api.sendMessage("Please enter your name:");\nconst name = waitForAnswer();\nApi.sendMessage(`Hello ${name}!`);',
                language: 'javascript',
                icon: 'fas fa-clock'
            },
            {
                name: 'HTTP Request',
                description: 'Make HTTP GET request',
                code: 'const response = HTTP.get("https://api.example.com/data");\nconst data = JSON.parse(response);\nApi.sendMessage(`Data: ${data.value}`);',
                language: 'javascript',
                icon: 'fas fa-globe'
            },
            {
                name: 'Save Data',
                description: 'Save user data',
                code: 'const userData = User.getData("settings") || {};\nuserData.language = "en";\nUser.saveData("settings", userData);\nApi.sendMessage("Settings saved!");',
                language: 'javascript',
                icon: 'fas fa-save'
            },
            {
                name: 'Condition Check',
                description: 'Check user condition',
                code: 'if (user.id === 12345) {\n  Api.sendMessage("Welcome admin!");\n} else {\n  Api.sendMessage("Welcome user!");\n}',
                language: 'javascript',
                icon: 'fas fa-code-branch'
            },
            {
                name: 'Loop Example',
                description: 'For loop example',
                code: 'for (let i = 0; i < 5; i++) {\n  Api.sendMessage(`Message ${i + 1}`);\n}',
                language: 'javascript',
                icon: 'fas fa-redo'
            }
        ];
    }

    showSnippets() {
        this.renderSnippets();
        this.elements.snippetsModal.classList.add('show');
        this.elements.snippetsSearch.focus();
    }

    hideSnippets() {
        this.elements.snippetsModal.classList.remove('show');
        this.editor.focus();
    }

    renderSnippets() {
        const filteredSnippets = this.filterSnippetsBySearch();
        let html = '';
        
        filteredSnippets.forEach((snippet, index) => {
            html += `
                <div class="snippet-item" data-index="${index}">
                    <div class="snippet-header">
                        <div class="snippet-title">
                            <i class="${snippet.icon}"></i>
                            ${snippet.name}
                        </div>
                        <span class="snippet-language">${snippet.language}</span>
                    </div>
                    <div class="snippet-description">${snippet.description}</div>
                    <div class="snippet-code">${this.escapeHtml(snippet.code)}</div>
                </div>
            `;
        });
        
        this.elements.snippetsContent.innerHTML = html;
        
        // Add click events
        this.elements.snippetsContent.querySelectorAll('.snippet-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.insertSnippet(filteredSnippets[index].code);
                this.hideSnippets();
            });
        });
    }

    filterSnippetsBySearch() {
        const searchTerm = this.elements.snippetsSearch.value.toLowerCase();
        if (!searchTerm) return this.snippets;
        
        return this.snippets.filter(snippet => 
            snippet.name.toLowerCase().includes(searchTerm) ||
            snippet.description.toLowerCase().includes(searchTerm) ||
            snippet.code.toLowerCase().includes(searchTerm)
        );
    }

    filterSnippets() {
        this.renderSnippets();
    }

    insertSnippet(code) {
        this.insertTextAtCursor(code);
        this.showNotification('Snippet inserted', 'success');
    }

    // UI Operations
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = this.currentTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        
        this.showNotification(`Switched to ${this.currentTheme} theme`, 'info');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.showNotification('Fullscreen failed: ' + err.message, 'error');
            });
        } else {
            document.exitFullscreen();
        }
    }

    changeFontSize(delta) {
        this.fontSize = Math.max(8, Math.min(24, this.fontSize + delta));
        this.editor.style.fontSize = this.fontSize + 'px';
        this.elements.fontSizeDisplay.textContent = this.fontSize + 'px';
        this.updateLineNumbers();
    }

    minimize() {
        // In a real app, this would minimize the window
        this.showNotification('Minimize feature would work in desktop app', 'info');
    }

    saveChanges() {
        // In a real app, this would save to file or send to parent window
        this.isModified = false;
        this.showNotification('Changes saved successfully', 'success');
        
        // If opened from command editor, send code back
        if (window.opener) {
            window.opener.postMessage({
                type: 'CODE_SAVED',
                code: this.editor.value
            }, '*');
        }
    }

    closeEditor() {
        if (this.isModified) {
            if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
                return;
            }
        }
        
        // If opened from command editor, send code back before closing
        if (window.opener) {
            window.opener.postMessage({
                type: 'CODE_UPDATED',
                code: this.editor.value
            }, '*');
        }
        
        window.close();
    }

    // Syntax Highlighting (Basic)
    setupSyntaxHighlighting() {
        this.applySyntaxHighlighting();
    }

    applySyntaxHighlighting() {
        // This is a basic implementation
        // In a real app, you might want to use a library like Prism.js or Highlight.js
        const code = this.editor.value;
        
        // Simple keyword highlighting (very basic)
        const keywords = ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'class'];
        let highlighted = code;
        
        keywords.forEach(keyword => {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            highlighted = highlighted.replace(regex, `<span class="keyword">${keyword}</span>`);
        });
        
        // This would need to be applied to a separate display element
        // For now, we'll just log that highlighting was applied
        console.log('Syntax highlighting applied');
    }

    // Utility Functions
    showNotification(message, type = 'info') {
        this.elements.notificationMessage.textContent = message;
        this.elements.statusNotification.className = `status-notification show ${type}`;
        
        setTimeout(() => {
            this.hideNotification();
        }, 3000);
    }

    hideNotification() {
        this.elements.statusNotification.classList.remove('show');
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    handleKeydown(e) {
        // Handle tab key for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            this.insertTextAtCursor('    '); // 4 spaces
        }
        
        // Handle Enter key for auto-indentation
        if (e.key === 'Enter') {
            const beforeCursor = this.editor.value.substring(0, this.editor.selectionStart);
            const currentLine = beforeCursor.split('\n').pop();
            const indentMatch = currentLine.match(/^(\s*)/);
            const currentIndent = indentMatch ? indentMatch[1] : '';
            
            setTimeout(() => {
                this.insertTextAtCursor(currentIndent);
            }, 0);
        }
    }

    updateUI() {
        this.updateLineNumbers();
        this.updateStats();
        this.updateCursorPosition();
        this.elements.fontSizeDisplay.textContent = this.fontSize + 'px';
        this.editor.style.fontSize = this.fontSize + 'px';
    }

    // Public methods for external use
    setCode(code) {
        this.editor.value = code;
        this.onEditorChange();
    }

    getCode() {
        return this.editor.value;
    }

    setFileName(name) {
        this.elements.fileName.textContent = name;
        this.detectLanguage(name);
    }

    detectLanguage(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const languageMap = {
            'js': 'JavaScript',
            'html': 'HTML',
            'css': 'CSS',
            'json': 'JSON',
            'py': 'Python',
            'java': 'Java',
            'cpp': 'C++',
            'c': 'C',
            'php': 'PHP',
            'rb': 'Ruby'
        };
        
        const language = languageMap[ext] || 'Text';
        this.elements.editorMode.textContent = language;
    }
}

// Initialize the editor when DOM is loaded
let fullEditor;

document.addEventListener('DOMContentLoaded', () => {
    fullEditor = new FullScreenEditor();
    
    // Handle messages from parent window (if opened from command editor)
    window.addEventListener('message', (event) => {
        if (event.data.type === 'SET_CODE') {
            fullEditor.setCode(event.data.code);
            if (event.data.fileName) {
                fullEditor.setFileName(event.data.fileName);
            }
        }
    });
    
    // Example: Set some initial code
    fullEditor.setCode('// Welcome to Full Screen Code Editor\n// Start writing your code here...\n\nfunction hello() {\n    Api.sendMessage("Hello world!");\n}');
    fullEditor.setFileName('command.js');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FullScreenEditor;
}