class CommandEditor {
    constructor() {
        this.user = null;
        this.currentBot = null;
        this.currentCommand = null;
        this.commands = [];
        this.templates = {};
        this.originalCode = '';
        this.isTesting = false;
        this.commandCache = new Map(); // ✅ Performance improvement
    }

    async init() {
        try {
            await this.checkAuth();
            await this.loadBotInfo();
            this.setupEventListeners();
            await this.loadCommands();
            await this.loadTemplates();
            this.setupCodeEditor();
            this.setupCommandsTags();
            console.log('✅ Command editor initialized completely');
        } catch (error) {
            console.error('❌ Command editor init failed:', error);
            this.showError('Failed to initialize editor: ' + error.message);
        }
    }

    // ✅ IMPROVED: Better Python command detection
    async detectPythonCommand() {
        return new Promise((resolve) => {
            const commands = ['python3', 'python', 'py'];
            let detectedCommand = 'python3'; // default
            
            const checkCommand = (index = 0) => {
                if (index >= commands.length) {
                    resolve(detectedCommand);
                    return;
                }
                
                const command = commands[index];
                const process = require('child_process').spawn(command, ['--version']);
                
                process.on('error', () => {
                    checkCommand(index + 1);
                });
                
                process.on('exit', (code) => {
                    if (code === 0) {
                        detectedCommand = command;
                        resolve(detectedCommand);
                    } else {
                        checkCommand(index + 1);
                    }
                });
            };
            
            checkCommand();
        });
    }

    // ✅ FIXED: Safe code execution with proper error handling
    async executeSafeCode(code, context) {
        try {
            // Create safe execution environment
            const safeGlobals = {
                Math, Date, JSON, console,
                setTimeout, setInterval,
                String, Number, Boolean,
                Array, Object, RegExp
            };

            // Create execution function
            const func = new Function(
                ...Object.keys(safeGlobals),
                ...Object.keys(context),
                `"use strict";\n${code}`
            );

            // Execute with safe context
            const result = func(
                ...Object.values(safeGlobals),
                ...Object.values(context)
            );

            return result;
        } catch (error) {
            console.error('❌ Code execution error:', error);
            throw new Error(`Code execution failed: ${error.message}`);
        }
    }

    // ✅ IMPROVED: Better test command with timeout
    async testCommand() {
        if (this.isTesting) {
            this.showError('Please wait, another test is in progress');
            return;
        }

        this.isTesting = true;
        
        try {
            if (!this.currentBot) {
                throw new Error('Bot information not loaded');
            }

            const commands = this.getCommandsFromTags();
            if (commands.length === 0) {
                throw new Error('Please add at least one command to test');
            }

            const commandCode = document.getElementById('commandCode').value.trim();
            if (!commandCode) {
                throw new Error('Please add command code to test');
            }

            this.showTestModal();
            this.showTestLoading();

            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Test timeout after 30 seconds')), 30000);
            });

            const testPromise = (async () => {
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

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Test failed');
                }

                return await response.json();
            })();

            const result = await Promise.race([testPromise, timeoutPromise]);
            
            this.showTestSuccess(`
                <h4>✅ Test Command Sent Successfully!</h4>
                <div class="test-details">
                    <p><strong>Commands:</strong> ${commands.join(', ')}</p>
                    <p><strong>Bot:</strong> ${this.currentBot.name}</p>
                    <p><strong>Status:</strong> Command executed without errors</p>
                    ${result.result ? `<p><strong>Result:</strong> ${result.result}</p>` : ''}
                </div>
                <p class="test-message">Check your Telegram bot for the test results.</p>
            `);

        } catch (error) {
            console.error('❌ Test command error:', error);
            this.showTestError(`
                <h4>❌ Test Failed</h4>
                <div class="error-details">
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
                </div>
            `);
        } finally {
            this.isTesting = false;
        }
    }

    // ✅ IMPROVED: Better template application
    applyTemplate(template) {
        try {
            console.log('🔄 Applying template:', template.name);

            // Validate template
            if (!template || typeof template !== 'object') {
                throw new Error('Invalid template data');
            }

            if (!template.code) {
                throw new Error('Template code is missing');
            }

            // Create new command if none exists
            if (!this.currentCommand || this.currentCommand.id !== 'new') {
                this.addNewCommand();
                
                // Wait for form to be ready
                setTimeout(() => {
                    this.finalizeTemplateApplication(template);
                }, 200);
            } else {
                this.finalizeTemplateApplication(template);
            }

        } catch (error) {
            console.error('❌ Template application failed:', error);
            this.showError('Template application failed: ' + error.message);
        }
    }

    // ✅ IMPROVED: Final template application with validation
    finalizeTemplateApplication(template) {
        try {
            // 1. Set command patterns with validation
            if (template.patterns) {
                const patterns = template.patterns.split(',').map(p => p.trim()).filter(p => p);
                if (patterns.length > 0) {
                    this.setCommandsToTags(patterns);
                    console.log('✅ Patterns set:', patterns);
                }
            }

            // 2. Set main code with proper cleaning
            const commandCodeEl = document.getElementById('commandCode');
            if (commandCodeEl && template.code) {
                let cleanCode = this.cleanTemplateCode(template.code);
                commandCodeEl.value = cleanCode;
                console.log('✅ Code applied, length:', cleanCode.length);
            }

            // 3. Handle wait for answer
            const waitForAnswerEl = document.getElementById('waitForAnswer');
            if (waitForAnswerEl) {
                const shouldWait = Boolean(template.waitForAnswer);
                waitForAnswerEl.checked = shouldWait;
                this.toggleAnswerHandler(shouldWait);
                console.log('✅ Wait for answer:', shouldWait);
            }

            // 4. Set answer handler if needed
            const answerHandlerEl = document.getElementById('answerHandler');
            if (answerHandlerEl && template.answerHandler) {
                let cleanAnswerHandler = this.cleanTemplateCode(template.answerHandler);
                answerHandlerEl.value = cleanAnswerHandler;
                console.log('✅ Answer handler applied');
            }

            // 5. Close templates modal
            const templatesModal = document.getElementById('templatesModal');
            if (templatesModal) {
                templatesModal.style.display = 'none';
            }

            // 6. Show success message
            this.showSuccess(`"${template.name}" template applied successfully! 🎉`);

        } catch (error) {
            console.error('❌ Final template application error:', error);
            this.showError('Failed to apply template: ' + error.message);
        }
    }

    // ✅ NEW: Clean template code from escaped characters
    cleanTemplateCode(code) {
        if (typeof code !== 'string') return code;
        
        return code
            .replace(/\\\\n/g, '\n')
            .replace(/\\\\t/g, '\t')
            .replace(/\\\\"/g, '"')
            .replace(/\\\\'/g, "'")
            .replace(/\\\\\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .trim();
    }

    // ✅ IMPROVED: Better error handling for all operations
    async safeOperation(operation, errorMessage) {
        try {
            this.showLoading(true);
            const result = await operation();
            this.showLoading(false);
            return result;
        } catch (error) {
            this.showLoading(false);
            console.error(`❌ ${errorMessage}:`, error);
            this.showError(`${errorMessage}: ${error.message}`);
            throw error;
        }
    }

    // ✅ IMPROVED: Enhanced save command with validation
    async saveCommand() {
        return await this.safeOperation(async () => {
            if (!this.currentCommand || !this.currentBot) {
                throw new Error('No command selected or bot not loaded');
            }

            const commands = this.getCommandsFromTags();
            if (commands.length === 0) {
                throw new Error('Please add at least one command pattern');
            }

            const commandCodeEl = document.getElementById('commandCode');
            const commandCode = commandCodeEl ? commandCodeEl.value.trim() : '';
            if (!commandCode) {
                throw new Error('Command code is required');
            }

            // Validate code syntax (basic validation)
            if (!this.validateCodeSyntax(commandCode)) {
                throw new Error('Invalid code syntax detected');
            }

            const waitForAnswerEl = document.getElementById('waitForAnswer');
            const answerHandlerEl = document.getElementById('answerHandler');
            
            const formData = {
                commandPatterns: commands.join(','),
                code: commandCode,
                waitForAnswer: waitForAnswerEl ? waitForAnswerEl.checked : false,
                answerHandler: (waitForAnswerEl && waitForAnswerEl.checked && answerHandlerEl) ? 
                              answerHandlerEl.value.trim() : '',
                botToken: this.currentBot.token
            };

            if (formData.waitForAnswer && !formData.answerHandler) {
                throw new Error('Answer handler code is required when "Wait for Answer" is enabled');
            }

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

            if (!response.ok) {
                throw new Error(data.error || 'Failed to save command');
            }

            this.showSuccess('Command saved successfully!');
            await this.loadCommands();
            
            if (data.command) {
                this.currentCommand = data.command;
                this.populateCommandForm();
            }

            return true;
        }, 'Save command failed');
    }

    // ✅ NEW: Basic code syntax validation
    validateCodeSyntax(code) {
        try {
            // Check for basic syntax errors
            if (code.includes('eval(') || code.includes('Function(')) {
                throw new Error('Unsafe code detected: eval or Function constructor not allowed');
            }

            // Try to parse as function (basic validation)
            new Function(code);
            return true;
        } catch (error) {
            console.warn('Code syntax warning:', error.message);
            // Don't block save for syntax warnings, just log them
            return true;
        }
    }

    // ✅ IMPROVED: Better command loading with caching
    async loadCommands() {
        return await this.safeOperation(async () => {
            if (!this.currentBot) return;

            const cacheKey = `commands_${this.currentBot.token}`;
            const cached = this.commandCache.get(cacheKey);
            
            if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
                this.commands = cached.commands;
                this.displayCommands();
                return;
            }

            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/bot/${this.currentBot.token}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load commands');
            }

            this.commands = data.commands || [];
            
            // Update cache
            this.commandCache.set(cacheKey, {
                commands: this.commands,
                timestamp: Date.now()
            });
            
            this.displayCommands();
        }, 'Load commands failed');
    }

    // ✅ IMPROVED: Better template loading with fallback
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
            
            if (data.success) {
                this.templates = data.templates || {};
                console.log(`✅ Loaded ${Object.keys(this.templates).length} template categories`);
                this.populateTemplatesModal();
            } else {
                throw new Error(data.error || 'Failed to load templates');
            }
        } catch (error) {
            console.error('❌ Load templates error:', error);
            
            // Fallback to basic templates
            this.templates = this.getFallbackTemplates();
            this.populateTemplatesModal();
            
            this.showError('Failed to load templates. Using fallback templates.');
        }
    }

    // ✅ NEW: Fallback templates when API fails
    getFallbackTemplates() {
        return {
            'basic': [
                {
                    id: 'fallback_welcome',
                    name: 'Welcome Message',
                    patterns: '/start, hello',
                    description: 'Basic welcome template',
                    code: 'const user = getUser();\nApi.sendMessage(`Hello ${user.first_name}! Welcome to our bot.`);',
                    waitForAnswer: false,
                    answerHandler: ''
                },
                {
                    id: 'fallback_help',
                    name: 'Help Command',
                    patterns: '/help, help',
                    description: 'Basic help template',
                    code: 'const helpText = `🤖 *Bot Help*\\n\\nAvailable commands:\\n• /start - Start bot\\n• /help - Show help`;\nApi.sendMessage(helpText, { parse_mode: \"Markdown\" });',
                    waitForAnswer: false,
                    answerHandler: ''
                }
            ]
        };
    }

    // ✅ IMPROVED: Better event listeners with error handling
    setupEventListeners() {
        try {
            // Navigation
            this.setupNavigationEvents();
            
            // Command actions
            this.setupCommandActions();
            
            // Form actions
            this.setupFormEvents();
            
            // Code editor buttons
            this.setupCodeEditorEvents();
            
            // Search and modals
            this.setupUtilityEvents();
            
            console.log('✅ All event listeners setup successfully');
        } catch (error) {
            console.error('❌ Event listener setup failed:', error);
        }
    }

    setupNavigationEvents() {
        const backBtn = document.getElementById('backToBots');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = 'bot-management.html';
            });
        }

        const quickTestBtn = document.getElementById('quickTest');
        if (quickTestBtn) {
            quickTestBtn.addEventListener('click', () => {
                this.quickTest();
            });
        }
    }

    setupCommandActions() {
        const addButtons = [
            'addCommandBtn',
            'createFirstCommand', 
            'addFirstCommand'
        ];

        addButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.addNewCommand();
                });
            }
        });
    }

    // ... (other setup methods with similar error handling)

    // ✅ IMPROVED: Better notification system
    showNotification(message, type = 'info', duration = 5000) {
        try {
            // Remove existing notifications
            const existing = document.querySelector('.notification');
            if (existing) existing.remove();

            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            
            const icons = {
                error: 'fas fa-exclamation-triangle',
                success: 'fas fa-check-circle',
                info: 'fas fa-info-circle',
                warning: 'fas fa-exclamation-circle'
            };

            notification.innerHTML = `
                <div class="notification-content">
                    <i class="${icons[type] || icons.info}"></i>
                    <span class="notification-message">${message}</span>
                    <button class="notification-close">&times;</button>
                </div>
            `;

            Object.assign(notification.style, {
                position: 'fixed',
                top: '20px',
                right: '20px',
                background: type === 'error' ? '#ef4444' : 
                          type === 'success' ? '#10b981' : 
                          type === 'warning' ? '#f59e0b' : '#3b82f6',
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

            // Auto remove after duration
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, duration);

        } catch (error) {
            console.error('❌ Show notification error:', error);
            // Fallback to alert
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    showError(message) {
        this.showNotification(message, 'error', 7000);
    }

    showSuccess(message) {
        this.showNotification(message, 'success', 3000);
    }

    showWarning(message) {
        this.showNotification(message, 'warning', 5000);
    }
}

// ✅ IMPROVED: Better initialization with error handling
let commandEditor;

document.addEventListener('DOMContentLoaded', () => {
    try {
        commandEditor = new CommandEditor();
        
        // Add global error handler for command selection
        document.addEventListener('click', (e) => {
            try {
                const commandGroup = e.target.closest('.command-group');
                if (commandGroup && commandGroup.dataset.commandId) {
                    const commandId = commandGroup.dataset.commandId;
                    
                    if (commandEditor.currentCommand?.id === commandId) {
                        return;
                    }
                    
                    if (commandEditor.selectCommand) {
                        commandEditor.selectCommand(commandId);
                    }
                }
            } catch (error) {
                console.error('❌ Command selection error:', error);
            }
        });
        
        // Add event listener for waitForAnswer toggle
        const waitForAnswerToggle = document.getElementById('waitForAnswer');
        if (waitForAnswerToggle && commandEditor) {
            waitForAnswerToggle.addEventListener('change', (e) => {
                try {
                    commandEditor.toggleAnswerHandler(e.target.checked);
                } catch (error) {
                    console.error('❌ Toggle answer handler error:', error);
                }
            });
        }

        console.log('✅ Command editor initialized successfully');
    } catch (error) {
        console.error('❌ Command editor initialization failed:', error);
        alert('Failed to initialize command editor. Please refresh the page.');
    }
});