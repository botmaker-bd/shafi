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
                document.getElementById('botName').textContent = `Commands - ${bot.name}`;
                document.getElementById('botUsername').textContent = `@${bot.username}`;
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

async function selectCommand(commandId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/commands/${commandId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentCommand = data.command;
            showCommandEditor();
            populateCommandForm();
        }
    } catch (error) {
        console.error('Select command error:', error);
        alert('Failed to load command');
    }
}

function addNewCommand() {
    currentCommand = {
        id: 'new',
        name: 'New Command',
        pattern: '/start',
        description: '',
        code: `// Welcome command
const user = getUser();
return sendMessage(\`Hello \${user.first_name}! Welcome to our bot. 😊\`);`
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
        botToken: currentBot.token, // ✅ Ensure botToken is sent
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
            // ✅ Include botToken in update too
            commandData.botToken = currentBot.token;
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
            alert('Command saved! Cache updated.');
            await loadCommands(currentBot.id);
            
            // ✅ Force reload the bot to ensure latest commands
            setTimeout(() => {
                location.reload();
            }, 1000);
            
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