/**
 * Full Screen Code Editor Class
 * Handles the full-screen code editor functionality
 */
class FullEditor {
    constructor() {
        this.originalCode = '';
        this.currentEditorType = null;
        this.isModified = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('🚀 Full Editor initialized');
    }

    setupEventListeners() {
        // Full editor open buttons
        const openEditorBtn = document.getElementById('openEditor');
        const openAnswerEditorBtn = document.getElementById('openAnswerEditor');
        
        if (openEditorBtn) {
            openEditorBtn.addEventListener('click', () => {
                this.openCodeEditor('main');
            });
        }

        if (openAnswerEditorBtn) {
            openAnswerEditorBtn.addEventListener('click', () => {
                this.openCodeEditor('answer');
            });
        }

        // Modal events
        this.setupModalEvents();
        this.setupToolbarEvents();
    }

    setupModalEvents() {
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (!codeEditorModal) return;

        const closeBtn = codeEditorModal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancelEdit');
        const saveBtn = document.getElementById('saveCode');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeCodeEditor());
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeCodeEditor());
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCodeFromEditor());
        }

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && codeEditorModal.style.display === 'flex') {
                this.closeCodeEditor();
            }
        });

        // Close when clicking outside
        codeEditorModal.addEventListener('click', (e) => {
            if (e.target === codeEditorModal) {
                this.closeCodeEditor();
            }
        });
    }

    setupToolbarEvents() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;

        const toolbarButtons = {
            'undoBtn': () => this.execCommand('undo'),
            'redoBtn': () => this.execCommand('redo'),
            'selectAllBtn': () => this.selectAllText(editor),
            'cutBtn': () => this.execCommand('cut'),
            'copyBtn': () => this.execCommand('copy'),
            'pasteBtn': () => this.pasteText(editor),
            'clearBtn': () => this.clearEditor(editor),
            'formatBtn': () => this.formatAdvancedCode(),
            'snippetsBtn': () => this.showSnippetsInFullEditor()
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

        // Editor input events
        editor.addEventListener('input', () => {
            this.updateEditorStats();
            this.updateSaveButtonState();
        });

        // Initial stats
        this.updateEditorStats();
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
            this.originalCode = code;
            this.updateEditorStats();
            this.updateSaveButtonState();
        }
        
        const codeEditorModal = document.getElementById('codeEditorModal');
        if (codeEditorModal) {
            codeEditorModal.style.display = 'flex';
            // Focus and set cursor to end
            setTimeout(() => {
                if (advancedEditor) {
                    advancedEditor.focus();
                    advancedEditor.setSelectionRange(advancedEditor.value.length, advancedEditor.value.length);
                }
            }, 100);
        }
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
            if (commandCodeEl) {
                commandCodeEl.value = code;
                // Trigger input event to update stats
                commandCodeEl.dispatchEvent(new Event('input'));
            }
        } else if (this.currentEditorType === 'answer') {
            const answerHandlerEl = document.getElementById('answerHandler');
            if (answerHandlerEl) {
                answerHandlerEl.value = code;
                answerHandlerEl.dispatchEvent(new Event('input'));
            }
        }
        
        this.originalCode = code;
        this.updateSaveButtonState();
        this.closeCodeEditor();
        
        if (typeof commandEditor !== 'undefined') {
            commandEditor.setModified(true);
            commandEditor.showSuccess('Code saved successfully!');
        }
    }

    // Toolbar Functions
    execCommand(command) {
        document.execCommand(command);
    }

    selectAllText(element) {
        element.select();
    }

    async pasteText(element) {
        try {
            const text = await navigator.clipboard.readText();
            const start = element.selectionStart;
            const end = element.selectionEnd;
            
            element.value = element.value.substring(0, start) + 
                           text + 
                           element.value.substring(end);
            
            // Set cursor position after pasted text
            element.setSelectionRange(start + text.length, start + text.length);
            this.updateEditorStats();
        } catch (err) {
            document.execCommand('paste');
        }
    }

    clearEditor(element) {
        if (confirm('Are you sure you want to clear all code?')) {
            element.value = '';
            this.updateEditorStats();
            this.updateSaveButtonState();
        }
    }

    formatAdvancedCode() {
        const editor = document.getElementById('advancedCodeEditor');
        if (!editor) return;
        
        let code = editor.value;
        const formattedCode = this.formatCodeText(code);
        editor.value = formattedCode;
        this.updateEditorStats();
        this.updateSaveButtonState();
        
        this.showMessage('Code formatted successfully!', 'success');
    }

    formatCodeText(code) {
        // Simple code formatter
        const lines = code.split('\n');
        let formattedLines = [];
        let indentLevel = 0;
        const indentSize = 4;
        
        for (let line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) {
                formattedLines.push('');
                continue;
            }
            
            // Decrease indent for closing braces
            if (trimmedLine.endsWith('}') || trimmedLine.endsWith(']') || trimmedLine.endsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
            
            // Add line with proper indentation
            formattedLines.push(' '.repeat(indentLevel * indentSize) + trimmedLine);
            
            // Increase indent for opening braces
            if (trimmedLine.endsWith('{') || trimmedLine.endsWith('[') || trimmedLine.endsWith('(')) {
                indentLevel++;
            }
        }
        
        return formattedLines.join('\n');
    }

    showSnippetsInFullEditor() {
        if (typeof commandEditor !== 'undefined') {
            commandEditor.showSnippetsModal();
        }
    }

    // Stats and State Management
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

    showMessage(message, type = 'info') {
        // Use common notification system if available
        if (typeof commonApp !== 'undefined' && commonApp.showNotification) {
            commonApp.showNotification(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize full editor
let fullEditor;

document.addEventListener('DOMContentLoaded', () => {
    fullEditor = new FullEditor();
});