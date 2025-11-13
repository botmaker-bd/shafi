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
        document.getElementById('userEmail').textContent = this.user.email;
        document.getElementById('userAvatar').textContent = this.user.email.charAt(0).toUpperCase();
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
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bots/${botId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.currentBot = data.bot;
                    this.updateBotInfo();
                } else {
                    throw new Error('Bot not found');
                }
            } else {
                throw new Error('Failed to load bot');
            }
        } catch (error) {
            console.error('Load bot error:', error);
            // Fallback for demo
            this.currentBot = {
                id: botId,
                name: "Demo Bot",
                username: "demobot",
                token: "demo_token_123"
            };
            this.updateBotInfo();
        }
    }

    updateBotInfo() {
        if (this.currentBot) {
            document.getElementById('botName').textContent = `Commands - ${this.currentBot.name}`;
            document.getElementById('botUsername').textContent = `@${this.currentBot.username}`;
        }
    }

    async loadCommands() {
        if (!this.currentBot) return;

        this.showLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/commands/bot/${this.currentBot.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.commands = data.commands || [];
                } else {
                    this.commands = [];
                }
            } else {
                this.commands = [];
            }
        } catch (error) {
            console.error('Load commands error:', error);
            this.commands = [];
        } finally {
            this.displayCommands();
            this.showLoading(false);
        }
    }

    displayCommands() {
        const commandsList = document.getElementById('commandsList');
        const emptyCommands = document.getElementById('emptyCommands');
        const noCommandSelected = document.getElementById('noCommandSelected');

        if (!this.commands || this.commands.length === 0) {
            commandsList.style.display = 'none';
            emptyCommands.style.display = 'block';
            noCommandSelected.style.display = 'block';
            document.getElementById('commandEditor').style.display = 'none';
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
    }

    setupCommandListClick() {
        document.addEventListener('click', (e) => {
            const commandGroup = e.target.closest('.command-group');
            if (commandGroup) {
                const commandId = commandGroup.dataset.commandId;
                this.selectCommand(commandId);
            }
        });
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

            if (response.ok) {
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
                    }
                } else {
                    this.showError('Failed to load command');
                }
            } else {
                // Fallback: find in local array
                const command = this.commands.find(cmd => cmd.id === commandId);
                if (command) {
                    this.currentCommand = command;
                    this.showCommandEditor();
                    this.populateCommandForm();
                    
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
            }
        } catch (error) {
            console.error('Select command error:', error);
            // Fallback to local command
            const command = this.commands.find(cmd => cmd.id === commandId);
            if (command) {
                this.currentCommand = command;
                this.showCommandEditor();
                this.populateCommandForm();
                
                document.querySelectorAll('.command-group').forEach(group => {
                    group.classList.remove('active');
                });
                
                const selectedGroup = document.querySelector(`[data-command-id="${commandId}"]`);
                if (selectedGroup) {
                    selectedGroup.classList.add('active');
                }
            } else {
                this.showError('Failed to load command');
            }
        } finally {
            this.showLoading(false);
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
        document.getElementById('showTemplates').addEventListener('click', async () => {
            await this.showTemplates();
        });

        document.getElementById('refreshTemplates').addEventListener('click', async () => {
            await this.loadTemplatesFromServer();
        });

        // Search
        let searchTimeout;
        document.getElementById('commandSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.filterCommands(e.target.value);
            }, 300);
        });

        // Copy result button
        document.getElementById('copyResultBtn').addEventListener('click', () => {
            this.copyTestResult();
        });

        // Modal events
        this.setupModalEvents();
        this.setupTemplateCategories();
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
            const token = localStorage.getItem('token');
            const response = await fetch('/api/templates', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.templates = data.templates;
                    this.populateTemplatesModal();
                    return true;
                }
            }
            throw new Error('Failed to load templates');
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
                },
                {
                    name: "Bot Information",
                    patterns: "/info, info, about, status",
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
                    description: "Show bot and user information"
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
                },
                {
                    name: "User Registration",
                    patterns: "/register, signup, join",
                    code: `bot.sendMessage(getChatId(), "Let's create your profile! What's your full name?");`,
                    description: "Collect user information step by step", 
                    waitForAnswer: true,
                    answerHandler: `const step = User.getData('reg_step') || 'name';

if (step === 'name') {
    User.saveData('reg_name', getUserResponse());
    User.saveData('reg_step', 'email');
    bot.sendMessage(getChatId(), "Great! What's your email address?");
} else if (step === 'email') {
    User.saveData('reg_email', getUserResponse()); 
    User.saveData('reg_step', 'complete');
    
    const name = User.getData('reg_name');
    const email = User.getData('reg_email');
    
    bot.sendMessage(getChatId(), \\`✅ Registration Complete!\\\\nName: \\${name}\\\\nEmail: \\${email}\\`);
    
    // Clear registration data
    User.saveData('reg_step', null);
    User.saveData('reg_name', null);
    User.saveData('reg_email', null);
}`
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
                },
                {
                    name: "Send Document",
                    patterns: "/doc, document, file", 
                    code: `// Send file/document
bot.sendDocument(getChatId(), 'https://example.com/file.pdf', {
    caption: "Here's your document 📄"
});`,
                    description: "Send file/document to user"
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
                },
                {
                    name: "Reply Keyboard", 
                    patterns: "/keyboard, keys, reply",
                    code: `bot.sendMessage(getChatId(), "Choose from the keyboard below:", {
    reply_markup: {
        keyboard: [
            ["📊 Profile", "🛠️ Settings"],
            ["📞 Contact", "ℹ️ About"],
            ["🎮 Games", "🔧 Tools"]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
});`,
                    description: "Custom reply keyboard"
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
                },
                {
                    name: "Data Retrieval",
                    patterns: "/mydata, getdata, profile",
                    code: `// Get user data
const userData = User.getData('profile') || {};

if (Object.keys(userData).length === 0) {
    bot.sendMessage(getChatId(), "No user data found. Use /data to save some data.");
} else {
    const dataText = \\`
📊 **Your Data:**
├ Name: \\${userData.name || 'Not set'}
├ Age: \\${userData.age || 'Not set'}  
├ Theme: \\${userData.preferences?.theme || 'default'}
└ Language: \\${userData.preferences?.language || 'en'}
\\`;
    bot.sendMessage(getChatId(), dataText);
}`,
                    description: "Retrieve and display stored data"
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
                },
                {
                    name: "Weather Info",
                    patterns: "/weather, climate, temp",
                    code: `const city = "London"; // You can make this dynamic

try {
    // Note: You need to add your API key
    const response = await HTTP.get(\`https://api.openweathermap.org/data/2.5/weather?q=\${city}&appid=YOUR_API_KEY&units=metric\`);
    const data = JSON.parse(response);
    
    const weatherInfo = \\`
🌤️ **Weather in \\${data.name}:**
├ Temperature: \\${data.main.temp}°C
├ Feels like: \\${data.main.feels_like}°C  
├ Humidity: \\${data.main.humidity}%
├ Condition: \\${data.weather[0].description}
└ Wind: \\${data.wind.speed} m/s
\\`;
    
    bot.sendMessage(getChatId(), weatherInfo);
} catch (error) {
    bot.sendMessage(getChatId(), "❌ Could not fetch weather data.");
}`,
                    description: "Get weather information from API"
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
                },
                {
                    name: "Error Handling",
                    patterns: "/error, debug, test",
                    code: `try {
    // Your code that might throw errors
    const result = someFunctionThatMightFail();
    bot.sendMessage(getChatId(), "✅ Operation successful: " + result);
} catch (error) {
    console.error("Command error:", error);
    bot.sendMessage(getChatId(), \\`❌ Error occurred: \\${error.message}\\\\n\\\\nPlease try again or contact support.\\`);
    
    // You can also log errors to your database
    User.saveData('last_error', {
        message: error.message,
        timestamp: new Date().toISOString(),
        command: getMessageText()
    });
}`,
                    description: "Comprehensive error handling example"
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
        document.getElementById('templatesModal').style.display = 'flex';
    }

    applyTemplate(template) {
        this.setCommandsToTags(template.patterns);
        document.getElementById('commandCode').value = template.code;
        
        if (template.waitForAnswer) {
            document.getElementById('waitForAnswer').checked = true;
            this.toggleAnswerHandler(true);
            document.getElementById('answerHandler').value = template.answerHandler || '';
        } else {
            document.getElementById('waitForAnswer').checked = false;
            this.toggleAnswerHandler(false);
        }
        
        document.getElementById('templatesModal').style.display = 'none';
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
            document.getElementById('moreCommands').focus();
        }, 100);
    }

    showCommandEditor() {
        document.getElementById('noCommandSelected').style.display = 'none';
        document.getElementById('commandEditor').style.display = 'block';
    }

    hideCommandEditor() {
        document.getElementById('noCommandSelected').style.display = 'block';
        document.getElementById('commandEditor').style.display = 'none';
        this.currentCommand = null;
    }

    populateCommandForm() {
        if (!this.currentCommand) return;
        
        document.getElementById('commandName').value = this.currentCommand.name;
        document.getElementById('commandDescription').value = this.currentCommand.description;
        this.setCommandsToTags(this.currentCommand.command_patterns);
        document.getElementById('commandCode').value = this.currentCommand.code;
        
        const waitToggle = document.getElementById('waitForAnswer');
        if (waitToggle) {
            waitToggle.checked = this.currentCommand.wait_for_answer || false;
            this.toggleAnswerHandler(waitToggle.checked);
        }
        
        document.getElementById('answerHandler').value = this.currentCommand.answer_handler || '';
        document.getElementById('currentCommandName').textContent = this.currentCommand.name;
        document.getElementById('commandId').textContent = `ID: ${this.currentCommand.id}`;
        
        const statusBadge = document.getElementById('commandStatus');
        statusBadge.textContent = this.currentCommand.is_active ? 'Active' : 'Inactive';
        statusBadge.className = `status-badge ${this.currentCommand.is_active ? 'active' : 'inactive'}`;
        
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
        section.style.display = show ? 'block' : 'none';
    }

    setupCodeEditor() {
        const advancedEditor = document.getElementById('advancedCodeEditor');
        
        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeCodeEditor();
        });

        document.getElementById('saveCode').addEventListener('click', () => {
            this.saveCodeFromEditor();
        });

        advancedEditor.addEventListener('input', (e) => {
            this.updateLineCount(e.target.value);
        });

        this.updateLineCount(advancedEditor.value);
    }

    updateLineCount(code) {
        const lines = code.split('\n').length;
        const chars = code.length;
        document.getElementById('lineCount').textContent = `Line: ${lines}`;
        document.getElementById('charCount').textContent = `Chars: ${chars}`;
    }

    openCodeEditor(editorType) {
        this.currentEditorType = editorType;
        let code = '';
        
        if (editorType === 'main') {
            code = document.getElementById('commandCode').value;
            document.getElementById('editorType').textContent = 'Editor: Main Code';
        } else if (editorType === 'answer') {
            code = document.getElementById('answerHandler').value;
            document.getElementById('editorType').textContent = 'Editor: Answer Handler';
        }
        
        document.getElementById('advancedCodeEditor').value = code;
        this.updateLineCount(code);
        document.getElementById('codeEditorModal').style.display = 'flex';
        
        setTimeout(() => {
            const editor = document.getElementById('advancedCodeEditor');
            editor.focus();
            editor.setSelectionRange(0, 0);
        }, 100);
    }

    closeCodeEditor() {
        document.getElementById('codeEditorModal').style.display = 'none';
    }

    saveCodeFromEditor() {
        const code = document.getElementById('advancedCodeEditor').value;
        
        if (this.currentEditorType === 'main') {
            document.getElementById('commandCode').value = code;
        } else if (this.currentEditorType === 'answer') {
            document.getElementById('answerHandler').value = code;
        }
        
        this.closeCodeEditor();
        this.showSuccess('Code saved successfully!');
    }

    async saveCommand() {
        if (!this.currentCommand || !this.currentBot) {
            this.showError('No command selected or bot not loaded');
            return false;
        }

        const commandName = document.getElementById('commandName').value.trim();
        const commandDescription = document.getElementById('commandDescription').value.trim();
        const commands = this.getCommandsFromTags();
        
        if (!commandName) {
            this.showError('Command name is required');
            document.getElementById('commandName').focus();
            return false;
        }

        if (commands.length === 0) {
            this.showError('Please add at least one command pattern');
            document.getElementById('moreCommands').focus();
            return false;
        }

        const commandCode = document.getElementById('commandCode').value.trim();
        if (!commandCode) {
            this.showError('Command code is required');
            document.getElementById('commandCode').focus();
            return false;
        }

        const waitForAnswer = document.getElementById('waitForAnswer').checked;
        const answerHandler = waitForAnswer ? document.getElementById('answerHandler').value.trim() : '';

        if (waitForAnswer && !answerHandler) {
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

            const commandData = {
                name: commandName,
                description: commandDescription,
                command_patterns: commands.join(','),
                code: commandCode,
                wait_for_answer: waitForAnswer,
                answer_handler: answerHandler,
                bot_token: this.currentBot.token,
                is_active: this.currentCommand.is_active || true
            };

            if (this.currentCommand.id === 'new') {
                url = '/api/commands';
                method = 'POST';
            } else {
                url = `/api/commands/${this.currentCommand.id}`;
                method = 'PUT';
                commandData.id = this.currentCommand.id;
            }

            response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(commandData)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showSuccess('Command saved successfully!');
                
                // Reload commands to get updated list
                await this.loadCommands();
                
                // Update current command if it was edited
                if (this.currentCommand.id !== 'new') {
                    this.currentCommand = data.command;
                    this.populateCommandForm();
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
                    isActive: newStatus
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

        const commandCode = document.getElementById('commandCode').value.trim();
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const tempCommand = {
                command_patterns: commands.join(','),
                code: commandCode,
                wait_for_answer: document.getElementById('waitForAnswer').checked,
                answer_handler: document.getElementById('answerHandler').value || ''
            };

            const response = await fetch('/api/commands/test', {
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

            if (response.ok && data.success) {
                this.showTestSuccess(`
✅ Test Command Sent Successfully!

📋 Command Details:
├ Commands: ${commands.join(', ')}
├ Bot: ${this.currentBot.name}
└ Status: Command executed without errors

📨 Telegram Response:
${data.telegramResponse || 'Message sent successfully to Telegram'}

🤖 Bot Response:
${data.botResponse || 'Check your Telegram bot for the response'}

🔍 Execution Result:
${data.executionResult || 'Command executed successfully'}

⏰ Test completed at: ${new Date().toLocaleString()}
                `);
            } else {
                this.showTestError(`
❌ Test Failed

Error: ${data.error || 'Unknown error occurred'}
${data.details ? `Details: ${data.details}` : ''}
                `);
            }
        } catch (error) {
            this.showTestError(`
❌ Network Error

Failed to connect to server: ${error.message}
Please check your connection and try again.
            `);
        }
    }

    async runCustomTest() {
        if (!this.currentBot) {
            this.showError('Bot information not loaded');
            return;
        }

        const testInput = document.getElementById('testInput').value.trim();
        const commands = this.getCommandsFromTags();
        
        if (!testInput && commands.length === 0) {
            this.showError('Please add commands or enter test input');
            return;
        }

        const commandCode = document.getElementById('commandCode').value.trim();
        if (!commandCode) {
            this.showError('Please add command code to test');
            return;
        }

        this.showTestModal();
        this.showTestLoading();

        try {
            const token = localStorage.getItem('token');
            
            const tempCommand = {
                command_patterns: testInput || commands.join(','),
                code: commandCode,
                wait_for_answer: document.getElementById('waitForAnswer').checked,
                answer_handler: document.getElementById('answerHandler').value || ''
            };

            const response = await fetch('/api/commands/test', {
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

            if (response.ok && data.success) {
                this.showTestSuccess(`
✅ Custom Test Executed Successfully!

📋 Test Details:
├ Test Input: "${testInput || commands.join(', ')}"
├ Bot: ${this.currentBot.name}
└ Status: Test completed successfully

🤖 Bot Response:
${data.botResponse || 'Command executed with custom input'}

🔍 Execution Result:
${data.executionResult || 'Custom test executed successfully'}

⏰ Test completed at: ${new Date().toLocaleString()}
                `);
            } else {
                this.showTestError(`
❌ Test Failed

Error: ${data.error || 'Unknown error occurred'}
${data.details ? `Details: ${data.details}` : ''}
                `);
            }
        } catch (error) {
            this.showTestError(`
❌ Network Error

Failed to connect to server: ${error.message}
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
        document.getElementById('testCommandModal').style.display = 'flex';
    }

    showTestLoading() {
        document.getElementById('testCommandResult').innerHTML = `
            <div class="test-loading">
                <div class="spinner"></div>
                <p>Testing command execution...</p>
            </div>
        `;
    }

    showTestSuccess(html) {
        const resultDiv = document.getElementById('testCommandResult');
        resultDiv.innerHTML = `
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

    showTestError(html) {
        const resultDiv = document.getElementById('testCommandResult');
        resultDiv.innerHTML = `
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
            const commandName = group.querySelector('.command-name').textContent.toLowerCase();
            const commandPatterns = group.querySelector('.command-patterns').textContent.toLowerCase();
            const isVisible = commandName.includes(lowerSearch) || commandPatterns.includes(lowerSearch);
            group.style.display = isVisible ? 'block' : 'none';
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