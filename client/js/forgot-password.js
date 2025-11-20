class ForgotPassword {
    constructor() {
        this.currentStep = 1;
        this.userId = null;
        this.resetToken = null;
        this.securityQuestion = '';
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailSubmit();
        });

        document.getElementById('verifyAnswerBtn').addEventListener('click', () => {
            this.handleAnswerSubmit();
        });

        document.getElementById('resetPasswordForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handlePasswordReset();
        });
    }

    async handleEmailSubmit() {
        const email = document.getElementById('forgotEmail').value.trim();

        if (!email) {
            this.showError('Please enter your email address');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/password/forgot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.userId && data.securityQuestion) {
                    this.userId = data.userId;
                    this.securityQuestion = data.securityQuestion;
                    this.showStep(2);
                    document.getElementById('securityQuestionLabel').textContent = this.securityQuestion;
                } else {
                    this.showSuccess('If the email exists, reset instructions have been sent.');
                }
            } else {
                this.showError(data.error || 'Failed to process request');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async handleAnswerSubmit() {
        const answer = document.getElementById('securityAnswer').value.trim();

        if (!answer) {
            this.showError('Please enter your security answer');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/password/verify-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    securityAnswer: answer
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.resetToken = data.resetToken;
                this.showStep(3);
                this.showSuccess('Security answer verified. You can now set your new password.');
            } else {
                this.showError(data.error || 'Incorrect security answer');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async handlePasswordReset() {
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (!newPassword || !confirmPassword) {
            this.showError('Please fill in all fields');
            return;
        }

        if (newPassword.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError('Passwords do not match');
            return;
        }

        this.showLoading(true);

        try {
            const response = await fetch('/api/password/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    resetToken: this.resetToken,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showSuccess('Password reset successfully! Redirecting to login...');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                this.showError(data.error || 'Failed to reset password');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    showStep(step) {
        this.currentStep = step;
        
        // Hide all steps
        document.querySelectorAll('.forgot-step').forEach(stepEl => {
            stepEl.classList.remove('active');
        });
        
        // Show current step
        document.getElementById(`step${step}`).classList.add('active');
    }

    showLoading(show) {
        // Simple loading implementation
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => {
            if (show) {
                btn.disabled = true;
                btn.innerHTML = '<div class="spinner"></div> Loading...';
            } else {
                btn.disabled = false;
                // Reset button text based on step
                if (this.currentStep === 1) {
                    btn.textContent = 'Continue';
                } else if (this.currentStep === 2) {
                    btn.textContent = 'Verify Answer';
                } else {
                    btn.textContent = 'Reset Password';
                }
            }
        });
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
                <span class="notification-message">${message}</span>
                <button class="notification-close">&times;</button>
            </div>
        `;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6',
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: '10000',
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
        });

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize forgot password
document.addEventListener('DOMContentLoaded', () => {
    new ForgotPassword();
});