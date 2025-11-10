// Command Editor functionality
let currentBot = null;
let currentCommand = null;
let codeEditor = null;
let commandHistory = [];
let historyPointer = -1;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Initialize CodeMirror
    codeEditor = CodeMirror.fromTextArea(document.getElementById('commandCode'), {
        mode: 'javascript',
        theme: 'monokai',
        lineNumbers: true,
        indentUnit: 4,
        smartIndent: true,
        matchBrackets: true,
        autoCloseBrackets: true,
        lineWrapping: true
    });

    // Get bot ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const botId = urlParams.get('bot');
    
    if (!botId) {
        alert('No bot specified');
        window.location.href = 'bot-management.html';
        return;
    }

    await loadBotInfo(botId);
    await loadCommands(botId);

    // Event listeners
    document.getElementById('addCommandBtn').addEventListener('click', addNewCommand);
    document.getElementById('saveCommandBtn').addEventListener('click', saveCommand);
    document.getElementById('deleteCommandBtn').addEventListener('click', deleteCommand);
    document.getElementById('testCommandBtn').addEventListener('click', testCommand);
    document.getElementById('undoBtn').addEventListener('click', undoAction);
    document.getElementById('redoBtn').addEventListener('click', redoAction);
});

async function loadBotInfo(botId) {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        const response = await fetch(`/api/bots/user/${user.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const bot = data.bots.find(b => b.id === botId);
            
            if (bot) {
                currentBot = bot;
                document.getElementById('botName').textContent = `Command Editor - ${bot.name}`;
                document.getElementById('botUsername').textContent = `Managing commands for @${bot.username}`;
            } else {
                alert('Bot not found');
                window.location.href = 'bot-management.html';
            }
        }
    } catch (error) {
        console.error('Load bot info error:', error);
    }
}

async function loadCommands(botId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/commands/bot/${currentBot.token}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayCommands(data.commands);
        }
    } catch (error) {
        console.error('Load commands error:', error);
    }
}

function displayCommands(commands) {
    const commandsList = document.getElementById('commandsList');
    
    if (!commands || commands.length === 0) {
        commandsList.innerHTML = `
            <div class="empty-commands">
                <p>No commands yet</p>
                <p>Click "Add Command" to create your first command</p>
            </div>
        `;
        return;
    }

    commandsList.innerHTML = commands.map(command => `
        <div class="command-item ${currentCommand?.id === command.id ? 'active' : ''}" 
             onclick="selectCommand('${command.id}')">
            <div class="command-header">
                <h4>${command.name}</h4>
                <span class="command-pattern">${command.pattern}</span>
            </div>
            <p class="command-desc">${command.description || 'No description'}</p>
            <div class="command-status ${command.is_active ? 'active' : 'inactive'}">
                ${command.is_active ? '🟢 Active' : '🔴 Inactive'}
            </div>
        </div>
    `).join('');
}

function addNewCommand() {
    currentCommand = {
        id: 'new',
        name: 'New Command',
        pattern: '^/command$',
        description: '',
        code: `// Write your command code here
// Use these functions:
// bot.sendMessage("Hello World!")
// bot.sendPhoto(photoUrl)
// bot.sendDocument(documentUrl)

const message = "Hello from your bot!";
return bot.sendMessage(message);`
    };

    showCommandEditor();
    populateCommandForm();
    addToHistory('create', currentCommand);
}

function selectCommand(commandId) {
    // Find command in the list (in a real app, you'd fetch from API)
    const commandItem = document.querySelector(`[onclick="selectCommand('${commandId}')"]`);
    const commandName = commandItem.querySelector('h4').textContent;
    
    // For demo purposes - in real app, you'd fetch command details
    currentCommand = {
        id: commandId,
        name: commandName,
        pattern: '^/' + commandName.toLowerCase() + '$',
        description: 'Command description',
        code: `// ${commandName} command code\nreturn bot.sendMessage("This is ${commandName} command!");`
    };

    showCommandEditor();
    populateCommandForm();
    updateCommandListSelection();
}

function showCommandEditor() {
    document.getElementById('noCommandSelected').style.display = 'none';
    document.getElementById('commandEditor').style.display = 'block';
}

function populateCommandForm() {
    if (!currentCommand) return;

    document.getElementById('commandName').value = currentCommand.name;
    document.getElementById('commandPattern').value = currentCommand.pattern;
    document.getElementById('commandDescription').value = currentCommand.description || '';
    document.getElementById('currentCommandName').textContent = currentCommand.name;
    
    if (codeEditor) {
        codeEditor.setValue(currentCommand.code || '');
    }
}

async function saveCommand() {
    if (!currentCommand || !currentBot) return;

    const commandData = {
        botToken: currentBot.token,
        name: document.getElementById('commandName').value,
        pattern: document.getElementById('commandPattern').value,
        description: document.getElementById('commandDescription').value,
        code: codeEditor.getValue()
    };

    try {
        const token = localStorage.getItem('token');
        let response;

        if (currentCommand.id === 'new') {
            response = await fetch('/api/commands', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(commandData)
            });
        } else {
            response = await fetch(`/api/commands/${currentCommand.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(commandData)
            });
        }

        if (response.ok) {
            alert('Command saved successfully!');
            addToHistory('save', currentCommand);
            await loadCommands(currentBot.id);
        } else {
            alert('Failed to save command');
        }
    } catch (error) {
        console.error('Save command error:', error);
        alert('Failed to save command');
    }
}

async function deleteCommand() {
    if (!currentCommand || currentCommand.id === 'new') return;

    if (!confirm('Are you sure you want to delete this command?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/commands/${currentCommand.id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Command deleted successfully');
            addToHistory('delete', currentCommand);
            hideCommandEditor();
            await loadCommands(currentBot.id);
        } else {
            alert('Failed to delete command');
        }
    } catch (error) {
        console.error('Delete command error:', error);
        alert('Failed to delete command');
    }
}

async function testCommand() {
    if (!currentCommand) return;

    // This would send a test message to your bot
    alert('Test functionality would be implemented here. It would send a test message to your bot.');
}

function hideCommandEditor() {
    document.getElementById('noCommandSelected').style.display = 'block';
    document.getElementById('commandEditor').style.display = 'none';
    currentCommand = null;
}

function updateCommandListSelection() {
    document.querySelectorAll('.command-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (currentCommand) {
        const selectedItem = document.querySelector(`[onclick="selectCommand('${currentCommand.id}')