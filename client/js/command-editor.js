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
            }
        }
    } catch (error) {
        console.error('Load bot error:', error);
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
            <div class="empty-state">
                <p>No commands yet</p>
            </div>
        `;
        return;
    }

    commandsList.innerHTML = commands.map(command => `
        <div class="command-item" onclick="selectCommand('${command.id}')">
            <div class="command-header">
                <h4>${command.name}</h4>
                <span class="command-pattern">${command.pattern}</span>
            </div>
            <p class="command-desc">${command.description || 'No description'}</p>
        </div>
    `).join('');
}

function addNewCommand() {
    currentCommand = {
        id: 'new',
        name: 'New Command',
        pattern: '^/command$',
        description: '',
        code: '// Write your command code here\nreturn bot.sendMessage("Hello World!");'
    };

    showCommandEditor();
    populateCommandForm();
}

function selectCommand(commandId) {
    // For demo - in real app, fetch command details
    currentCommand = {
        id: commandId,
        name: 'Selected Command',
        pattern: '^/start$',
        description: 'Start command',
        code: 'return bot.sendMessage("Welcome!");'
    };

    showCommandEditor();
    populateCommandForm();
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
    if (!currentCommand || !currentBot) return;

    const commandData = {
        botToken: currentBot.token,
        name: document.getElementById('commandName').value,
        pattern: document.getElementById('commandPattern').value,
        description: document.getElementById('commandDescription').value,
        code: document.getElementById('commandCode').value
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
            alert('Command saved!');
            await loadCommands(currentBot.id);
        } else {
            alert('Failed to save command');
        }
    } catch (error) {
        alert('Failed to save command');
    }
}

async function deleteCommand() {
    if (!currentCommand || currentCommand.id === 'new') return;

    if (!confirm('Delete this command?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/commands/${currentCommand.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('Command deleted');
            hideCommandEditor();
            await loadCommands(currentBot.id);
        } else {
            alert('Failed to delete command');
        }
    } catch (error) {
        alert('Failed to delete command');
    }
}

function hideCommandEditor() {
    document.getElementById('noCommandSelected').style.display = 'block';
    document.getElementById('commandEditor').style.display = 'none';
    currentCommand = null;
}