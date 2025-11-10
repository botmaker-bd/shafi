document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    await loadBots(user.id);

    document.getElementById('addBotForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addNewBot(user.id);
    });

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });
});

async function loadBots(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/bots/user/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            displayBots(data.bots);
        }
    } catch (error) {
        console.error('Load error:', error);
    }
}

function displayBots(bots) {
    const container = document.getElementById('botsContainer');
    
    if (!bots || bots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No bots yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bots.map(bot => `
        <div class="bot-card">
            <div class="bot-info">
                <div class="bot-avatar">🤖</div>
                <div class="bot-details">
                    <h4>${bot.name}</h4>
                    <p class="bot-username">@${bot.username}</p>
                    <p class="bot-status ${bot.is_active ? 'active' : 'inactive'}">
                        ${bot.is_active ? 'Active' : 'Inactive'}
                    </p>
                </div>
            </div>
            <div class="bot-actions">
                <a href="command-editor.html?bot=${bot.id}" class="btn btn-primary">Manage Commands</a>
                <button onclick="removeBot('${bot.id}')" class="btn btn-danger">Remove</button>
            </div>
        </div>
    `).join('');
}

async function addNewBot(userId) {
    const token = document.getElementById('botToken').value.trim();
    const name = document.getElementById('botName').value.trim();

    if (!token) {
        alert('Please enter bot token');
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
            body: JSON.stringify({ token, name, userId })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Bot added!');
            document.getElementById('botToken').value = '';
            document.getElementById('botName').value = '';
            await loadBots(userId);
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Failed to add bot');
    }
}

async function removeBot(botId) {
    if (!confirm('Remove this bot?')) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/bots/${botId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            alert('Bot removed');
            const user = JSON.parse(localStorage.getItem('user'));
            await loadBots(user.id);
        } else {
            alert('Failed to remove bot');
        }
    } catch (error) {
        alert('Failed to remove bot');
    }
}