let currentBot = null;
let currentCommand = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const botId = urlParams.get('bot');
    
    if (!botId) {
        alert('No bot specified');
        window.location.href = 'bot-management.html';
        return;
    }

    await loadBotInfo(botId);
    await loadCommands(botId);

    document.getElementById('addCommandBtn').addEventListener('click', addNewCommand);
    document.getElementById('saveCommandBtn').addEventListener('click', saveCommand);
    document.getElementById('deleteCommandBtn').addEventListener('click', deleteCommand);
    document.getElementById('testCommandBtn').addEventListener('click', testCommand);

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });
});

async function loadBotInfo(botId) {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        const response = await fetch(`/api/bots/user/${user.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
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
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                displayCommands(data.commands);
            } else {
                console.error('Failed to load commands:', data.error);
            }
        }
    } catch (error) {
        console.error('Load commands error:', error);
    }
}

function displayCommands(commands) {
    const commandsList = document.getElementById('commandsList');
    
    if (!commands || commands.length === 0) {
        commandsList.innerHTML = `
            <div class="empty-state">
                <p>No commands yet</p>
                <p>Click "Add Command" to create your first command</p>
            </div>
        `;
        return;
    }

    commandsList.innerHTML = commands.map(command => `
        <div class="command-item" onclick="selectCommand('${command.id}')" data-command-id="${command.id}">
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

async function selectCommand(commandId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/commands/${commandId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                currentCommand = data.command;
                showCommandEditor();
                populateCommandForm();
                updateCommandListSelection(commandId);
            } else {
                alert('Failed to load command: ' + data.error);
            }
        }
    } catch (error) {
        console.error('Select command error:', error);
        alert('Failed to load command');
    }
}

function updateCommandListSelection(commandId) {
    // Remove active class from all items
    document.querySelectorAll('.command-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected item
    const selectedItem = document.querySelector(`[data-command-id="${commandId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
}

function addNewCommand() {
    currentCommand = {
        id: 'new',
        name: 'New Command',
        pattern: '/start',
        description: '',
        code: `// Simple start command example
const user = getMessage().from;
const welcomeMessage = \`
👋 Hello \${user.first_name}!

Welcome to our bot! I'm here to help you.

Available commands:
/start - Show this welcome message
/help - Get help information

Feel free to explore! 😊
\`;

return bot.sendMessage(welcomeMessage, {
    parse_mode: "Markdown"
});`
    };

    showCommandEditor();
    populateCommandForm();
    
    // Clear selection when adding new command
    updateCommandListSelection(null);
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
    document.getElementById('commandCode').value = currentCommand.code || '';
    document.getElementById('currentCommandName').textContent = currentCommand.name;
}

async function saveCommand() {
    if (!currentCommand || !currentBot) {
        alert('No command or bot selected');
        return;
    }

    const commandData = {
        botToken: currentBot.token,
        name: document.getElementById('commandName').value,
        pattern: document.getElementById('commandPattern').value,
        description: document.getElementById('commandDescription').value,
        code: document.getElementById('commandCode').value
    };

    // Validation
    if (!commandData.name || !commandData.pattern || !commandData.code) {
        alert('Please fill in all required fields');
        return;
    }

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

        const data = await response.json();

        if (response.ok && data.success) {
            alert('Command saved successfully!');
            await loadCommands(currentBot.id);
            
            // If it was a new command, select it after save
            if (currentCommand.id === 'new' && data.command) {
                await selectCommand(data.command.id);
            }
        } else {
            alert(data.error || 'Failed to save command');
        }
    } catch (error) {
        console.error('Save command error:', error);
        alert('Failed to save command. Please try again.');
    }
}

async function deleteCommand() {
    if (!currentCommand || currentCommand.id === 'new') {
        alert('No command selected to delete');
        return;
    }

    if (!confirm('Are you sure you want to delete this command?')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/commands/${currentCommand.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert('Command deleted successfully');
            hideCommandEditor();
            await loadCommands(currentBot.id);
        } else {
            alert(data.error || 'Failed to delete command');
        }
    } catch (error) {
        console.error('Delete command error:', error);
        alert('Failed to delete command');
    }
}

async function testCommand() {
    alert('Test functionality: This would send a test message to your bot with the current command.');
}

function hideCommandEditor() {
    document.getElementById('noCommandSelected').style.display = 'block';
    document.getElementById('commandEditor').style.display = 'none';
    currentCommand = null;
    updateCommandListSelection(null);
}