/**
 * Full Screen Code Editor Class
 * Advanced code editor with syntax highlighting, find/replace, and more
 */
class FullScreenEditor {
    constructor() {
        this.editor = null;
        this.lineNumbers = null;
        this.currentTheme = 'dark';
        this.findState = {
            query: '',
            results: [],
            currentIndex: -1
        };
        
        this.init();
    }

    init() {
        this.initializeElements();
        this.setupEventListeners();
        this.loadInitialCode();
        this.updateUI();
        
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
            editorMode: document.getElementById('editorMode'),
            
            // Toolbar buttons
            themeToggle: document.getElementById('themeToggle'),
            closeEditor: document.getElementById('closeEditor'),
            undoBtn: document.getElementById('undoBtn'),
            redoBtn: document.getElementById('redoBtn'),
            cutBtn: document.getElementById('cutBtn'),
            copyBtn: document.getElementById('copyBtn'),
            pasteBtn: document.getElementById('pasteBtn'),
            selectAllBtn: document.getElementById('selectAllBtn'),
            formatBtn: document.getElementById('formatBtn'),
            clearBtn: document.getElementById('clearBtn'),
            findBtn: document.getElementById('findBtn'),
            
            // Footer buttons
            saveBtn: document.getElementById('saveBtn'),
            
            // Find panel
            findPanel: document.getElementById('findPanel'),
            findInput: document.getElementById('findInput'),
            findResults: document.getElementById('findResults'),
            findPrevBtn: document.getElementById('findPrevBtn'),
            findNextBtn: document.getElementById('findNextBtn'),
            closeFindPanel: document.getElementById('closeFindPanel')
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
        
        // Find panel events
        this.setupFindEvents();
        
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
        this.elements.clearBtn.addEventListener('click', () => this.clearEditor());
        
        // UI operations
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.closeEditor.addEventListener('click', () => this.closeEditor());
        this.elements.findBtn.addEventListener('click', () => this.showFindPanel());
        
        // Footer buttons
        this.elements.saveBtn.addEventListener('click', () => this.saveAndClose());
    }

    setupFindEvents() {
        this.elements.findInput.addEventListener('input', () => this.performFind());
        this.elements.findPrevBtn.addEventListener('click', () => this.findPrevious());
        this.elements.findNextBtn.addEventListener('click', () => this.findNext());
        this.elements.closeFindPanel.addEventListener('click', () => this.hideFindPanel());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveAndClose();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.showFindPanel();
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
                    case 'h':
                        e.preventDefault();
                        this.toggleTheme();
                        break;
                }
            }
            
            // Escape key
            if (e.key === 'Escape') {
                if (this.elements.findPanel.style.display === 'block') {
                    this.hideFindPanel();
                }
            }
        });
    }

    // Editor Core Functions
    onEditorChange() {
        this.updateLineNumbers();
        this.updateStats();
        this.updateCursorPosition();
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
        
        this.elements.cursorLine.textContent = currentLine;
        this.elements.cursorColumn.textContent = currentColumn;
    }

    updateSelectionInfo() {
        // Selection info can be added here if needed
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
        }
    }

    // Code Operations
    formatCode() {
        const code = this.editor.value;
        try {
            const formatted = this.formatJavaScript(code);
            this.editor.value = formatted;
            this.onEditorChange();
        } catch (error) {
            console.error('Formatting error:', error);
        }
    }

    formatJavaScript(code) {
        // Basic JavaScript formatting
        let formatted = code;
        
        // Add spaces around operators
        formatted = formatted.replace(/([=+*/-])(?!=)/g, ' $1 ');
        
        // Add newlines after braces and semicolons
        formatted = formatted.replace(/;/g, ';\n');
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

    // Find & Replace
    showFindPanel() {
        this.elements.findPanel.classList.add('show');
        this.elements.findInput.focus();
        this.elements.findInput.select();
    }

    hideFindPanel() {
        this.elements.findPanel.classList.remove('show');
        this.clearFindResults();
        this.editor.focus();
    }

    performFind() {
        const query = this.elements.findInput.value;
        if (!query) {
            this.clearFindResults();
            return;
        }
        
        this.findState.query = query;
        this.findAllMatches();
    }

    findAllMatches() {
        const text = this.editor.value;
        const query = this.findState.query;
        
        try {
            const searchRegex = new RegExp(this.escapeRegex(query), 'gi');
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
            console.error('Find error:', error);
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
        
        this.elements.findResults.textContent = `${index + 1} of ${this.findState.results.length}`;
    }

    scrollToSelection() {
        const lineHeight = 21;
        const cursorLine = this.editor.value.substring(0, this.editor.selectionStart).split('\n').length;
        const scrollTop = (cursorLine - 5) * lineHeight;
        this.editor.scrollTop = Math.max(0, scrollTop);
    }

    clearFindResults() {
        this.findState.results = [];
        this.findState.currentIndex = -1;
        this.elements.findResults.textContent = '0 results';
        this.clearSelection();
    }

    clearSelection() {
        this.editor.selectionStart = this.editor.selectionEnd;
    }

    // UI Operations
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = this.currentTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }

    saveAndClose() {
        // Send code back to parent window
        if (window.opener) {
            window.opener.postMessage({
                type: 'FULL_EDITOR_SAVE',
                code: this.editor.value,
                fileName: this.elements.fileName.textContent
            }, '*');
        }
        window.close();
    }

    closeEditor() {
        if (confirm('Are you sure you want to close without saving?')) {
            window.close();
        }
    }

    // Utility Functions
    handleKeydown(e) {
        // Handle tab key for indentation
        if (e.key === 'Tab') {
            e.preventDefault();
            this.insertTextAtCursor('    ');
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

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    loadInitialCode() {
        // Get initial code from URL parameters or default
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code') || '// Welcome to Full Screen Code Editor\n// Start writing your code here...\n\nfunction hello() {\n    Api.sendMessage("Hello world!");\n}';
        const fileName = urlParams.get('fileName') || 'command.js';
        
        this.editor.value = decodeURIComponent(code);
        this.elements.fileName.textContent = fileName;
        this.detectLanguage(fileName);
        
        this.onEditorChange();
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

    updateUI() {
        this.updateLineNumbers();
        this.updateStats();
        this.updateCursorPosition();
    }
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.fullEditor = new FullScreenEditor();
});