// Bot Management functionality
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    await loadBots(user.id);

    // Add bot form submission
    document.getElementById('addBotForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewBot(user.id);
    });
});

async function loadBots(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/bots/user/${userId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            displayBots(data.bots);
        } else {
            console.error('Failed to load bots');
        }
    } catch (error) {
        console.error('Load bots error:', error);
    }
}

function displayBots(bots) {
    const container = document.getElementById('botsContainer');
    
    if (!bots || bots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No bots yet</h3>
                <p>Add your first bot using the form above</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bots.map(bot => `
        <div class="bot-card" data-bot-id="${bot.id}">
            <div class="bot-info">
                <div class="bot-avatar">🤖</div>
                <div class="bot-details">
                    <h4>${bot.name}</h4>
                    <p class="bot-username">@${bot.username}</p>
                    <p class="bot-status ${bot.is_active ? 'active' : 'inactive'}">
                        ${bot.is_active ? '🟢 Active' : '🔴 Inactive'}
                    </p>
                    <p class="bot-added">Added: ${new Date(bot.created_at).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="bot-actions">
                <a href="command-editor.html?bot=${bot.id}" class="btn btn-primary">✏️ Manage Commands</a>
                <button onclick="testBot('${bot.token}')" class="btn btn-success">🧪 Test Bot</button>
                <button onclick="removeBot('${bot.id}')" class="btn btn-danger">🗑️ Remove</button>
            </div>
        </div>
    `).join('');
}

async function addNewBot(userId) {
    const tokenInput = document.getElementById('botToken');
    const nameInput = document.getElementById('botName');
    
    const botToken = tokenInput.value.trim();
    const botName = nameInput.value.trim();

    if (!botToken) {
        alert('Please enter a bot token');
        return;
    }

    try {
        const userToken = localStorage.getItem('token');
        const response = await fetch('/api/bots/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`
            },
            body: JSON.stringify({
                token: botToken,
                name: botName,
                userId: userId
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Bot added successfully!');
            tokenInput.value = '';
            nameInput.value = '';
            await loadBots(userId);
        } else {
            alert(data.error || 'Failed to add bot. Please check your token.');
        }
    } catch (error) {
        console.error('Add bot error:', error);
        alert('Failed to add bot. Please try again.');
    }
}

async function removeBot(botId) {
    if (!confirm('Are you sure you want to remove this bot? This will delete all associated commands.')) {
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/bots/${botId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Bot removed successfully');
            const user = JSON.parse(localStorage.getItem('user'));
            await loadBots(user.id);
        } else {
            alert('Failed to remove bot');
        }
    } catch (error) {
        console.error('Remove bot error:', error);
        alert('Failed to remove bot');
    }
}

async function testBot(botToken) {
    try {
        // Test bot by getting bot info
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data = await response.json();
        
        if (data.ok) {
            alert(`✅ Bot is working!\nName: ${data.result.first_name}\nUsername: @${data.result.username}`);
        } else {
            alert('❌ Bot token is invalid or bot is not accessible');
        }
    } catch (error) {
        console.error('Test bot error:', error);
        alert('❌ Failed to test bot. Please check your token.');
    }
}

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberLogin');
    window.location.href = 'index.html';
});