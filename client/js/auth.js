function showTab(tabName) {
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tabName + 'Form').classList.add('active');
    event.target.classList.add('active');
}

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberLogin').checked;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            if (remember) localStorage.setItem('rememberLogin', 'true');
            window.location.href = 'dashboard.html';
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        alert('Login failed. Please try again.');
    }
});

// Signup
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Account created! Please login.');
            showTab('login');
        } else {
            alert(data.error || 'Signup failed');
        }
    } catch (error) {
        alert('Signup failed. Please try again.');
    }
});

// Reset password
document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = prompt('Enter your email:');
    if (!email) return;
    
    const securityQuestion = document.getElementById('securityQuestion').value;
    const securityAnswer = document.getElementById('securityAnswer').value;
    const newPassword = document.getElementById('newPassword').value;

    try {
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, securityQuestion, securityAnswer, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Password reset! Please login.');
            showTab('login');
        } else {
            alert(data.error || 'Reset failed');
        }
    } catch (error) {
        alert('Reset failed. Please try again.');
    }
});

// Check login
if (localStorage.getItem('token') && localStorage.getItem('user')) {
    window.location.href = 'dashboard.html';
}