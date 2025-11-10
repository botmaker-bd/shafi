document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('userName').textContent = user.email.split('@')[0];
    await loadDashboardData(user.id);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.clear();
        window.location.href = 'index.html';
    });
});

async function loadDashboardData(userId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/bots/user/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            displayBots(data.bots);
            document.getElementById('totalBots').textContent = data.bots?.length || 0;
        }
    } catch (error) {
        console.error('Load error:', error);
    }
}

function displayBots(bots) {
    const botsList = document.getElementById('botsList');
    
    if (!bots || bots.length === 0) {
        botsList.innerHTML = `
            <div class="empty-state">
                <p>No bots yet</p>
                <a href="bot-management.html" class="btn btn-primary">Add Your First Bot</a>
            </div>
        `;
        return;
    }

    botsList.innerHTML = bots.slice(0, 4).map(bot => `
        <div class="bot-card">
            <h4>${bot.name}</h4>
            <p>@${bot.username}</p>
            <p class="bot-status ${bot.is_active ? 'active' : 'inactive'}">
                ${bot.is_active ? 'Active' : 'Inactive'}
            </p>
            <div class="bot-actions">
                <a href="command-editor.html?bot=${bot.id}" class="btn btn-primary">Manage</a>
                <button onclick="removeBot('${bot.id}')" class="btn btn-danger">Remove</button>
            </div>
        </div>
    `).join('');
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
            location.reload();
        } else {
            alert('Failed to remove bot');
        }
    } catch (error) {
        alert('Failed to remove bot');
    }
}