// Enhanced Command Editor JavaScript with Server Templates
class CommandEditor {
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
        this.setupCodeEditor();
        this.setupCommandsTags();
        this.setupCommandListClick();
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (!token || !userData) {
            window.location.href = 'login.html';
            return;
        }
        try {
            this.user = JSON.parse(userData);
            this.updateUserInfo();
        } catch (error) {
            this.logout();
        }
    }

    updateUserInfo() {
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userEmail) userEmail.textContent = this.user.email;
        if (userAvatar) userAvatar.textContent = this.user.email.charAt(0).toUpperCase();
    }

    async loadBotInfo() {
        const urlParams = new URLSearchParams(window.location.search);
        const botId = urlParams.get('bot');

        if (!botId) {
            this.showError('No bot specified');
            window.location.href = 'bot-management.html';
            return;
        }

        try {
            // For demo purposes - use mock data
            this.currentBot = {
                id: botId,
                name: "Demo Bot",
                username: "demobot",
                token: "demo_token_123"
            };
            
            this.updateBotInfo();
        } catch (error) {
            console.error('Load bot error:', error);
            this.showError('Failed to load bot info');
        }
    }

    updateBotInfo() {
        const botName = document.getElementById('botName');
        const botUsername = document.getElementById('botUsername');
        
        if (this.currentBot) {
            if (botName) botName.textContent = `Commands - ${this.currentBot.name}`;
            if (botUsername) botUsername.textContent = `@${this.currentBot.username}`;
        }
    }

    async loadCommands() {
        if (!this.currentBot) return;

        this.showLoading(true);

        try {
            // Mock commands data for demo
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.commands = [
                {
                    id: '1',
                    name: 'Welcome Command',
                    description: 'Welcome message for new users',
                    command_patterns: '/start,start,hello',
                    code: `const user = getUser();
const chatId = getChatId();

bot.sendMessage(chatId, \\`🎉 Hello \\${user.first_name}! Welcome to our bot!

🤖 I can help you with:
/start - Show this welcome message
/help - Get help
/info - Bot information

Choose a command or type your message!\\`);`,
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                },
                {
                    id: '2',
                    name: 'Help Command',
                    description: 'Show help information',
                    command_patterns: '/help,help,commands',
                    code: `const commands = [
    "/start - Welcome message",
    "/help - Show this help",
    "/info - Bot information", 
    "/echo - Repeat your message"
].join('\\\\n');

bot.sendMessage(getChatId(), \\`🤖 **Available Commands:**\\\\n\\\\n\\${commands}\\`);`,
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                },
                {
                    id: '3',
                    name: 'User Info',
                    description: 'Show user information',
                    command_patterns: '/info,info,about,status',
                    code: `const user = getUser();
const botInfo = await bot.getMe();

const infoText = \\`
🤖 **Bot Information:**
├ Name: \\${botInfo.first_name}
├ Username: @\\${botInfo.username}
├ ID: \\${botInfo.id}
└ User ID: \\${user.id}

💬 **Chat Info:**
├ Type: \\${getChat().type}
└ Language: \\${user.language_code || 'en'}
\\`;

bot.sendMessage(getChatId(), infoText);`,
                    is_active: true,
                    wait_for_answer: false,
                    answer_handler: ''
                }
            ];
            
            this.displayCommands();
        } catch (error) {
            console.error('Load commands error:', error);
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

        if (!commandsList || !emptyCommands || !noCommandSelected) {
            console.error('Required DOM elements not found');
            return;
        }

        if (!this.commands || this.commands.length === 0) {
            commandsList.style.display = 'none';
            emptyCommands.style.display = 'block';
            noCommandSelected.style.display = 'block';
            
            const commandEditor = document.getElementById('commandEditor');
            if (commandEditor) {
                commandEditor.style.display = 'none';
            }
            return;
        }

        commandsList.style.display = 'block';
        emptyCommands.style.display = 'none';

        let html = '';
        this.commands.forEach(command => {
            const isActive = command.is_active;
            const isSelected = this.currentCommand?.id === command.id;
            
            html += `
                <div class="command-group ${isSelected ? 'active' : ''}" 
                     data-command-id="${command.id}">
                    <div class="command-content">
                        <div class="command-name">${this.escapeHtml(command.name)}</div>
                        <div class="command-description">${this.escapeHtml(command.description)}</div>
                        <div class="command-patterns">${this.escapeHtml(command.command_patterns)}</div>
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
        
        commandsList.innerHTML = html;
        
        // If no command is selected, show the no command selected state
        if (!this.currentCommand) {
            noCommandSelected.style.display = 'block';
            const commandEditor = document.getElementById('commandEditor');
            if (commandEditor) {
                commandEditor.style.display = 'none';
            }
        }
    }

    setupCommandListClick() {
        document.addEventListener('click', (e) => {
            const commandGroup = e.target.closest('.command-group');
            if (commandGroup) {
                const commandId = commandGroup.dataset.commandId;
                if (commandId) {
                    this.selectCommand(commandId);
                }
            }
        });
    }

    async selectCommand(commandId) {
        if (this.currentCommand?.id === commandId) return;

        this.showLoading(true);

        try {
            // Find command in local array
            const command = this.commands.find(cmd => cmd.id === commandId);
            if (command) {
                this.currentCommand = command;
                this.showCommandEditor();
                this.populateCommandForm();
                
                // Update UI selection
                document.querySelectorAll('.command-group').forEach(group => {
                    group.classList.remove('active');
                });
                
                const selectedGroup = document.querySelector(`[data-command-id="${commandId}"]`);
                if (selectedGroup) {
                    selectedGroup.classList.add('active');
                }
            } else {
                this.showError('Command not found');
            }
        } catch (error) {
            console.error('Select command error:', error);
            this.showError('Failed to load command');
        } finally {
            this.showLoading(false);
        }
    }

    setupEventListeners() {
        // Navigation
        const backToBots = document.getElementById('backToBots');
        const quickTest = document.getElementById('quickTest');
        
        if (backToBots) {
            backToBots.addEventListener('click', () => {
                window.location.href = 'bot-management.html';
            });
        }
        
        if (quickTest) {
            quickTest.addEventListener('click', () => {
                this.quickTest();
            });
        }

        // Command actions
        const addCommandBtn = document.getElementById('addCommandBtn');
        const createFirstCommand = document.getElementById('createFirstCommand');
        const addFirstCommand = document.getElementById('addFirstCommand');
        
        if (addCommandBtn) {
            addCommandBtn.addEventListener('click', () => {
                this.addNewCommand();
            });
        }
        
        if (createFirstCommand) {
            createFirstCommand.addEventListener('click', () => {
                this.addNewCommand();
            });
        }
        
        if (addFirstCommand) {
            addFirstCommand.addEventListener('click', () => {
                this.addNewCommand();
            });
        }

        // Form actions
        const saveCommandBtn = document.getElementById('saveCommandBtn');
        const deleteCommandBtn = document.getElementById('deleteCommandBtn');
        const toggleCommandBtn = document.getElementById('toggleCommandBtn');
        const testCommandBtn = document.getElementById('testCommandBtn');
        const runTestBtn = document.getElementById('runTestBtn');
        
        if (saveCommandBtn) {
            saveCommandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveCommand();
            });
        }
        
        if (deleteCommandBtn) {
            deleteCommandBtn.addEventListener('click', () => {
                this.deleteCommand();
            });
        }
        
        if (toggleCommandBtn) {
            toggleCommandBtn.addEventListener('click', () => {
                this.toggleCommand();
            });
        }
        
        if (testCommandBtn) {
            testCommandBtn.addEventListener('click', () => {
                this.testCommand();
            });
        }
        
        if (runTestBtn) {
            runTestBtn.addEventListener('click', () => {
                this.runCustomTest();
            });
        }

        // Toggle switches
        const waitForAnswer = document.getElementById('waitForAnswer');
        if (waitForAnswer) {
            waitForAnswer.addEventListener('change', (e) => {
                this.toggleAnswerHandler(e.target.checked);
            });
        }

        // Code editor buttons
        const openEditor = document.getElementById('openEditor');
        const openAnswerEditor = document.getElementById('openAnswerEditor');
        
        if (openEditor) {
            openEditor.addEventListener('click', () => {
                this.openCodeEditor('main');
            });
        }
        
        if (openAnswerEditor) {
            openAnswerEditor.addEventListener('click', () => {
                this.openCodeEditor('answer');
            });
        }

        // Templates
        const showTemplates = document.getElementById('showTemplates');
        const refreshTemplates = document.getElementById('refreshTemplates');
        
        if (showTemplates) {
            showTemplates.addEventListener('click', async () => {
                await this.showTemplates();
            });
        }
        
        if (refreshTemplates) {
            refreshTemplates.addEventListener('click', async () => {
                await this.loadTemplatesFromServer();
            });
        }

        // Search
        const commandSearch = document.getElementById('commandSearch');
        if (commandSearch) {
            let searchTimeout;
            commandSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterCommands(e.target.value);
                }, 300);
            });
        }

        // Copy result button
        const copyResultBtn = document.getElementById('copyResultBtn');
        if (copyResultBtn) {
            copyResultBtn.addEventListener('click', () => {
                this.copyTestResult();
            });
        }

        // Modal events
        this.setupModalEvents();
        this.setupTemplateCategories();
    }

    setupModalEvents() {
        const modals = ['testCommandModal', 'codeEditorModal', 'templatesModal'];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                const closeBtn = modal.querySelector('.modal-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        modal.style.display = 'none';
                    });
                }
            }
        });

        const closeTestCommand = document.getElementById('closeTestCommand');
        if (closeTestCommand) {
            closeTestCommand.addEventListener('click', () => {
                const modal = document.getElementById('testCommandModal');
                if (modal) modal.style.display = 'none';
            });
        }

        const closeTemplates = document.getElementById('closeTemplates');
        if (closeTemplates) {
            closeTemplates.addEventListener('click', () => {
                const modal = document.getElementById('templatesModal');
                if (modal) modal.style.display = 'none';
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
                        console.error('Error parsing template:', error);
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

    async loadTemplatesFromServer() {
        try {
            // For demo - use local templates
            this.loadLocalTemplates();
            return true;
        } catch (error) {
            console.error('Load templates error:', error);
            // Fallback to local templates
            this.loadLocalTemplates();
            return true;
        }
    }

    loadLocalTemplates() {
        // Comprehensive template collection
        this.templates = {
            basic: [
                {
                    name: "Welcome Message",
                    patterns: "/start, start, hello",
                    code: `const user = getUser();
const chatId = getChatId();

bot.sendMessage(chatId, \\`🎉 Hello \\${user.first_name}! Welcome to our bot!

🤖 I can help you with:
/start - Show this welcome message
/help - Get help  
/info - Bot information

Choose a command or type your message!\\`);`,
                    description: "Simple welcome message with user info"
                },
                {
                    name: "Help Command",
                    patterns: "/help, help, commands", 
                    code: `const commands = [
    "/start - Welcome message",
    "/help - Show this help", 
    "/info - Bot information",
    "/echo - Repeat your message"
].join('\\\\n');

bot.sendMessage(getChatId(), \\`🤖 **Available Commands:**\\\\n\\\\n\\${commands}\\`);`,
                    description: "Display available commands"
                }
            ],
            interactive: [
                {
                    name: "Interactive Conversation",
                    patterns: "/conversation, chat, talk",
                    code: `// Main command code
bot.sendMessage(getChatId(), "Let's have a conversation! What's your name?");

// Enable Wait for Answer and use the answer handler below`,
                    description: "Multiple questions with wait for answer",
                    waitForAnswer: true,
                    answerHandler: `// Answer handler code
const userName = getUserResponse();
bot.sendMessage(getChatId(), \\`Nice to meet you, \\${userName}! How old are you?\\`);

// Set next wait for answer
User.saveData('conversation_step', 'age');
User.saveData('user_name', userName);`
                }
            ],
            media: [
                {
                    name: "Send Photo",
                    patterns: "/photo, picture, image",
                    code: `// Send photo from URL
bot.sendPhoto(getChatId(), 'https://example.com/image.jpg', {
    caption: "Here's your requested image! 📸"
});`,
                    description: "Send image with caption"
                }
            ],
            buttons: [
                {
                    name: "Inline Keyboard",
                    patterns: "/buttons, menu, options",
                    code: `bot.sendMessage(getChatId(), "Choose an option:", {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "✅ Yes", callback_data: "yes" },
                { text: "❌ No", callback_data: "no" }
            ],
            [
                { text: "ℹ️ Info", callback_data: "info" },
                { text: "⚙️ Settings", callback_data: "settings" }
            ]
        ]
    }
});`,
                    description: "Message with inline keyboard buttons"
                }
            ],
            data: [
                {
                    name: "User Data Storage",
                    patterns: "/data, profile, save",
                    code: `// Save user data
const userData = {
    name: "John Doe",
    age: 25,
    preferences: {
        theme: "dark",
        language: "en"
    }
};

User.saveData('profile', userData);
bot.sendMessage(getChatId(), "User data saved successfully! ✅");`,
                    description: "Save and retrieve user data"
                }
            ],
            http: [
                {
                    name: "HTTP GET Request",
                    patterns: "/fetch, get, api",
                    code: `try {
    const response = await HTTP.get('https://api.github.com/users/octocat');
    const data = JSON.parse(response);
    
    const userInfo = \\`
🐙 **GitHub User Info:**
├ Login: \\${data.login}
├ Name: \\${data.name || 'N/A'}
├ Followers: \\${data.followers}
└ Public Repos: \\${data.public_repos}
\\`;
    
    bot.sendMessage(getChatId(), userInfo);
} catch (error) {
    bot.sendMessage(getChatId(), "❌ Failed to fetch data: " + error.message);
}`,
                    description: "Fetch data from external API"
                }
            ],
            advanced: [
                {
                    name: "Admin Panel",
                    patterns: "/admin, panel, control",
                    code: `// Check if user is admin
const adminUsers = ['123456789', '987654321']; // Add admin user IDs

if (!adminUsers.includes(getUser().id.toString())) {
    bot.sendMessage(getChatId(), "❌ Access denied. Admin only.");
    return;
}

// Admin commands
const adminCommands = [
    "/stats - Bot statistics",
    "/broadcast - Send message to all users", 
    "/logs - View bot logs",
    "/maintenance - Toggle maintenance mode"
].join('\\\\n');

bot.sendMessage(getChatId(), \\`🛡️ **Admin Panel**\\\\n\\\\n\\${adminCommands}\\`);`,
                    description: "Admin-only commands and controls"
                }
            ]
        };
        
        this.populateTemplatesModal();
    }

    populateTemplatesModal() {
        const templatesContent = document.querySelector('.templates-content');
        if (!templatesContent) return;

        if (!this.templates || Object.keys(this.templates).length === 0) {
            templatesContent.innerHTML = `
                <div class="template-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No templates available</p>
                </div>
            `;
            return;
        }

        let html = '';

        for (const [category, templates] of Object.entries(this.templates)) {
            const categoryId = `${category}-templates`;
            const isActive = category === 'basic' ? 'active' : '';
            
            html += `
                <div id="${categoryId}" class="template-category ${isActive}">
                    <div class="templates-grid">
                        ${templates.map(template => `
                            <div class="template-card" data-template='${JSON.stringify(template).replace(/'/g, "&#39;")}'>
                                <div class="template-icon">
                                    <i class="fas fa-${this.getTemplateIcon(category)}"></i>
                                </div>
                                <h4>${this.escapeHtml(template.name)}</h4>
                                <p>${this.escapeHtml(template.description)}</p>
                                <div class="template-preview">
                                    <strong>Patterns:</strong> ${this.escapeHtml(template.patterns)}
                                    <div class="template-code-preview">
                                        ${this.escapeHtml(template.code.substring(0, 100))}...
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        templatesContent.innerHTML = html;
    }

    getTemplateIcon(category) {
        const icons = {
            'basic': 'code',
            'interactive': 'comments',
            'media': 'image',
            'buttons': 'th',
            'data': 'database',
            'http': 'cloud',
            'advanced': 'cogs'
        };
        return icons[category] || 'code';
    }

    async showTemplates() {
        // Show loading state
        const templatesContent = document.querySelector('.templates-content');
        if (templatesContent) {
            templatesContent.innerHTML = `
                <div class="template-loading">
                    <div class="spinner"></div>
                    <p>Loading templates from server...</p>
                </div>
            `;
        }

        // Load templates from server
        await this.loadTemplatesFromServer();
        const templatesModal = document.getElementById('templatesModal');
        if (templatesModal) {
            templatesModal.style.display = 'flex';
        }
    }

    applyTemplate(template) {
        this.setCommandsToTags(template.patterns);
        
        const commandCode = document.getElementById('commandCode');
        if (commandCode) {
            commandCode.value = template.code;
        }
        
        const waitForAnswer = document.getElementById('waitForAnswer');
        if (waitForAnswer) {
            waitForAnswer.checked = template.waitForAnswer || false;
            this.toggleAnswerHandler(waitForAnswer.checked);
        }
        
        const answerHandler = document.getElementById('answerHandler');
        if (answerHandler && template.answerHandler) {
            answerHandler.value = template.answerHandler;
        }
        
        const templatesModal = document.getElementById('templatesModal');
        if (templatesModal) {
            templatesModal.style.display = 'none';
        }
        
        this.showSuccess('Template applied successfully!');
    }

    addNewCommand() {
        this.currentCommand = {
            id: 'new',
            name: 'New Command',
            description: 'New command description',
            command_patterns: '/start',
            code: '// Write your command code here\nconst user = getUser();\nconst chatId = getChatId();\n\nbot.sendMessage(chatId, `Hello ${user.first_name}! Welcome to our bot!`);',
            is_active: true,
            wait_for_answer: false,
            answer_handler: ''
        };

        this.showCommandEditor();
        this.populateCommandForm();
        
        // Clear and focus on command patterns
        this.setCommandsToTags(['/start']);
        setTimeout(() => {
            const moreCommands = document.getElementById('moreCommands');
            if (moreCommands) {
                moreCommands.focus();
            }
        }, 100);
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
        
        const commandName = document.getElementById('commandName');
        const commandDescription = document.getElementById('commandDescription');
        const commandCode = document.getElementById('commandCode');
        const waitForAnswer = document.getElementById('waitForAnswer');
        const answerHandler = document.getElementById('answerHandler');
        const currentCommandName = document.getElementById('currentCommandName');
        const commandId = document.getElementById('commandId');
        const commandStatus = document.getElementById('commandStatus');
        
        if (commandName) commandName.value = this.currentCommand.name;
        if (commandDescription) commandDescription.value = this.currentCommand.description;
        this.setCommandsToTags(this.currentCommand.command_patterns);
        if (commandCode) commandCode.value = this.currentCommand.code;
        
        if (waitForAnswer) {
            waitForAnswer.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitForAnswer.checked);
        }
        
        if (answerHandler) answerHandler.value = this.currentCommand.answer_handler || '';
        if (currentCommandName) currentCommandName.textContent = this.currentCommand.name;
        if (commandId) commandId.textContent = `ID: ${this.currentCommand.id}`;
        
        if (commandStatus) {
            commandStatus.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
            commandStatus.className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        }
        
        this.updateButtonStates();
    }

    updateButtonStates() {
        const isNew = this.currentCommand?.id === 'new';
        const deleteBtn = document.getElementById('deleteCommandBtn');
        const toggleBtn = document.getElementById('toggleCommandBtn');
        
        if (deleteBtn) {
            deleteBtn.disabled = isNew;
            deleteBtn.style.opacity = isNew ? '0.5' : '1';
        }
        
        if (toggleBtn) {
            toggleBtn.innerHTML = `<i class="fas fa-power-off"></i> ${this.currentCommand?.is_active ? 'Deactivate' : 'Activate'}`;
        }
    }

    setupCommandsTags() {
        const moreCommandsInput = document.getElementById('moreCommands');
        const commandsTags = document.getElementById('commandsTags');

        if (!moreCommandsInput || !commandsTags) return;

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

        // Handle paste event
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
        
        commands.forEach(command => {
            if (command) {
                this.addCommandTag(command);
            }
        });
    }

    toggleAnswerHandler(show) {
        const section = document.getElementById('answerHandlerSection');
        if (section) {
            section.style.display = show ? 'block' : 'none';
        }
    }

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        if (!advancedEditor) return;
        
        const cancelEdit = document.getElementById('cancelEdit');
        const saveCode = document.getElementById('saveCode');
        
        if (cancelEdit) {
            cancelEdit.addEventListener('click', () => {
                this.closeCodeEditor();
            });
        }
        
        if (saveCode) {
            saveCode.addEventListener('click', () => {
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
        
        const lineCount = document.getElementById('lineCount');
        const charCount = document.getElementById('charCount');
        
        if (lineCount) lineCount.textContent = `Line: ${lines}`;
        if (charCount) charCount.textContent = `Chars: ${chars}`;
    }

    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        
        if (editorType === 'main') {
            const commandCode = document.getElementById('commandCode');
            if (commandCode) code = commandCode.value;
            
            const editorTypeElem = document.getElementById('editorType');
            if (editorTypeElem) editorTypeElem.textContent = 'Editor: Main Code';
        } else if (editorType === 'answer') {
            const answerHandler = document.getElementById('answerHandler');
            if (answerHandler) code = answerHandler.value;
            
            const editorTypeElem = document.getElementById('editorType');
            if (editorTypeElem) editorTypeElem.textContent = 'Editor: Answer Handler';
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
            if (advancedEditor) {
                advancedEditor.focus();
                advancedEditor.setSelectionRange(0, 0);
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
            const commandCode = document.getElementById('commandCode');
            if (commandCode) commandCode.value = code;
        } else if (this.currentEditorType === 'answer') {
            const answerHandler = document.getElementById('answerHandler');
            if (answerHandler) answerHandler.value = code;
        }
        
        this.closeCodeEditor();
        this.showSuccess('Code saved successfully!');
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
        }

        const commandName = document.getElementById('commandName');
        const commandDescription = document.getElementById('commandDescription');
        const commands = this.getCommandsFromTags();
        
        if (!commandName || !commandName.value.trim()) {
            this.showError('Command name is required');
            if (commandName) commandName.focus();
            return false;
        }

        if (commands.length === 0) {
            this.showError('Please add at least one command pattern');
            const moreCommands = document.getElementById('moreCommands');
            if (moreCommands) moreCommands.focus();
            return false;
        }

        const commandCode = document.getElementById('commandCode');
        if (!commandCode || !commandCode.value.trim()) {
            this.showError('Command code is required');
            if (commandCode) commandCode.focus();
            return false;
        }

        const waitForAnswer = document.getElementById('waitForAnswer');
        const answerHandler = document.getElementById('answerHandler');
        const waitForAnswerChecked = waitForAnswer ? waitForAnswer.checked : false;
        const answerHandlerValue = waitForAnswerChecked && answerHandler ? answerHandler.value.trim() : '';

        if (waitForAnswerChecked && !answerHandlerValue) {
            this.showError('Answer handler code is required when "Wait for Answer" is enabled');
            if (answerHandler) answerHandler.focus();
            return false;
        }

        this.showLoading(true);

        try {
            // Simulate API call for demo
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Update local command
            if (this.currentCommand.id === 'new') {
                this.currentCommand.id = Date.now().toString();
                this.commands.push({
                    ...this.currentCommand,
                    id: this.currentCommand.id,
                    name: commandName.value.trim(),
                    description: commandDescription ? commandDescription.value.trim() : '',
                    command_patterns: commands.join(','),
                    code: commandCode.value.trim(),
                    wait_for_answer: waitForAnswerChecked,
                    answer_handler: answerHandlerValue
                });
            } else {
                const index = this.commands.findIndex(cmd => cmd.id === this.currentCommand.id);
                if (index !== -1) {
                    this.commands[index] = {
                        ...this.commands[index],
                        name: commandName.value.trim(),
                        description: commandDescription ? commandDescription.value.trim() : '',
                        command_patterns: commands.join(','),
                        code: commandCode.value.trim(),
                        wait_for_answer: waitForAnswerChecked,
                        answer_handler: answerHandlerValue
                    };
                }
            }

            this.showSuccess('Command saved successfully!');
            await this.loadCommands();
            
            // Re-select the command
            if (this.currentCommand.id) {
                setTimeout(() => {
                    this.selectCommand(this.currentCommand.id);
                }, 500);
            }
            
            return true;
        } catch (error) {
            this.showError('Failed to save command: ' + error.message);
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
            // Simulate API call for demo
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Remove from local array
            this.commands = this.commands.filter(cmd => cmd.id !== this.currentCommand.id);
            
            this.showSuccess('Command deleted successfully');
            this.hideCommandEditor();
            await this.loadCommands();
        } catch (error) {
            this.showError('Failed to delete command');
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
            // Simulate API call for demo
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Update local status
            this.currentCommand.is_active = newStatus;
            const index = this.commands.findIndex(cmd => cmd.id === this.currentCommand.id);
            if (index !== -1) {
                this.commands[index].is_active = newStatus;
            }
            
            this.populateCommandForm();
            await this.loadCommands();
            this.showSuccess(`Command ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        } catch (error) {
            this.showError('Failed to toggle command status');
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

        const commandCode = document.getElementById('commandCode');
        if (!commandCode || !commandCode.value.trim()) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            // Simulate API call for demo
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulate successful response
            const mockResponse = {
                success: true,
                telegramResponse: "Message sent successfully to Telegram",
                executionResult: "Command executed without errors",
                botResponse: `Hello User! Welcome to ${this.currentBot.name}!`
            };

            this.showTestSuccess(`
✅ Test Command Sent Successfully!

📋 Command Details:
├ Commands: ${commands.join(', ')}
├ Bot: ${this.currentBot.name}
└ Status: Command executed without errors

📨 Telegram Response:
${mockResponse.telegramResponse}

🤖 Bot Response:
${mockResponse.botResponse}

🔍 Execution Result:
${mockResponse.executionResult}

⏰ Test completed at: ${new Date().toLocaleString()}
            `);
        } catch (error) {
            this.showTestError(`
❌ Test Failed

Error: ${error.message}
Please check your command code and try again.
            `);
        }
    }

    async runCustomTest() {
        if (!this.currentBot) {
            this.showError('Bot information not loaded');
            return;
        }

        const testInput = document.getElementById('testInput');
        const commands = this.getCommandsFromTags();
        
        if ((!testInput || !testInput.value.trim()) && commands.length === 0) {
            this.showError('Please add commands or enter test input');
            return;
        }

        const commandCode = document.getElementById('commandCode');
        if (!commandCode || !commandCode.value.trim()) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            // Simulate API call for demo
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Simulate response based on test input
            const inputValue = testInput ? testInput.value.trim() : '';
            let botResponse = "Default response from bot";
            
            if (inputValue.includes('/start') || inputValue.includes('start')) {
                botResponse = "🎉 Welcome to our bot! How can I help you today?";
            } else if (inputValue.includes('/help') || inputValue.includes('help')) {
                botResponse = "🤖 Available commands:\n/start - Welcome\n/help - Help\n/info - Information";
            } else if (inputValue.includes('/info') || inputValue.includes('info')) {
                botResponse = `ℹ️ Bot Information:\nName: ${this.currentBot.name}\nUsername: @${this.currentBot.username}`;
            } else {
                botResponse = `You said: "${inputValue}"\nThis is a test response from the bot.`;
            }

            this.showTestSuccess(`
✅ Custom Test Executed Successfully!

📋 Test Details:
├ Test Input: "${inputValue || commands.join(', ')}"
├ Bot: ${this.currentBot.name}
└ Status: Test completed successfully

🤖 Bot Response:
${botResponse}

🔍 Execution Result:
Command executed successfully with custom input

⏰ Test completed at: ${new Date().toLocaleString()}
            `);
        } catch (error) {
            this.showTestError(`
❌ Test Failed

Error: ${error.message}
Please check your input and try again.
            `);
        }
    }

    quickTest() {
        if (this.currentCommand) {
            this.testCommand();
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
                    <div class="result-header">
                        <h4>✅ Test Successful</h4>
                    </div>
                    <div class="test-result-container">
                        <div class="test-result-content">${html}</div>
                    </div>
                </div>
            `;
        }
    }

    showTestError(html) {
        const testCommandResult = document.getElementById('testCommandResult');
        if (testCommandResult) {
            testCommandResult.innerHTML = `
                <div class="test-error">
                    <div class="result-header">
                        <h4>❌ Test Failed</h4>
                    </div>
                    <div class="test-result-container">
                        <div class="test-result-content">${html}</div>
                    </div>
                </div>
            `;
        }
    }

    copyTestResult() {
        const resultContent = document.querySelector('.test-result-content');
        if (resultContent) {
            const text = resultContent.textContent || resultContent.innerText;
            navigator.clipboard.writeText(text).then(() => {
                this.showSuccess('Test result copied to clipboard!');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showSuccess('Result copied to clipboard!');
            });
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
            const commandName = group.querySelector('.command-name');
            const commandPatterns = group.querySelector('.command-patterns');
            
            if (commandName && commandPatterns) {
                const commandNameText = commandName.textContent.toLowerCase();
                const commandPatternsText = commandPatterns.textContent.toLowerCase();
                const isVisible = commandNameText.includes(lowerSearch) || commandPatternsText.includes(lowerSearch);
                group.style.display = isVisible ? 'block' : 'none';
            }
        });
    }

    escapeHtml(unsafe) {
        return unsafe
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

    logout() {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Initialize command editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.commandEditor = new CommandEditor();
});