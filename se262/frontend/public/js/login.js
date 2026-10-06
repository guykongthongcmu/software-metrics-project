/**
 * Admin Login Support Script
 * Implements production-grade security and robust error handling.
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginAlert = document.getElementById('loginAlert');
    const loginAlertText = document.getElementById('loginAlertText');
    const passwordToggle = document.getElementById('passwordToggle');

    // UI State
    let isLoading = false;

    // Email Validation Regex (RFC 5322)
    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    /**
     * Toggles the loading state of the UI
     */
    function setLoading(state) {
        isLoading = state;
        loginBtn.disabled = state;
        loginEmail.disabled = state;
        loginPassword.disabled = state;
        
        if (state) {
            loginBtn.classList.add('loading');
        } else {
            loginBtn.classList.remove('loading');
        }
    }

    /**
     * Shows a global error message
     */
    function showError(message) {
        if (!message) {
            loginAlert.style.display = 'none';
            return;
        }
        loginAlertText.textContent = message;
        loginAlert.style.display = 'flex';
        // Add shake animation
        loginAlert.classList.add('shake');
        setTimeout(() => loginAlert.classList.remove('shake'), 400);
    }

    /**
     * Clears field-specific errors
     */
    function clearFieldErrors() {
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('visible'));
        document.querySelectorAll('.glass-input').forEach(el => el.classList.remove('invalid'));
    }

    /**
     * Toggle Password Visibility
     */
    if (passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const isPassword = loginPassword.type === 'password';
            loginPassword.type = isPassword ? 'text' : 'password';
            passwordToggle.querySelector('i').className = isPassword ? 'bi bi-eye-slash' : 'bi bi-eye';
        });
    }

    /**
     * Main Login Handler
     */
    async function handleAdminLogin(event) {
        event.preventDefault();
        if (isLoading) return;

        // Reset UI
        showError(null);
        clearFieldErrors();

        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        let hasError = false;

        // 1. Client-side Validation (Pre-flight checks)
        if (!email) {
            const emailErr = document.getElementById('emailError');
            emailErr.textContent = "Email is required.";
            emailErr.classList.add('visible');
            loginEmail.classList.add('invalid');
            hasError = true;
        } else if (!EMAIL_REGEX.test(email)) {
            const emailErr = document.getElementById('emailError');
            emailErr.textContent = "Invalid email format.";
            emailErr.classList.add('visible');
            loginEmail.classList.add('invalid');
            hasError = true;
        }

        if (!password) {
            const passErr = document.getElementById('passwordError');
            passErr.classList.add('visible');
            loginPassword.classList.add('invalid');
            hasError = true;
        }

        if (hasError) return;

        // 2. Network Request
        setLoading(true);

        try {
            // Route through the frontend proxy so deployed browsers never talk to backend localhost directly.
            const response = await fetch('/api/auth/admin/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password }),
                credentials: 'include'
            });

            // Parse response body
            let data = {};
            try {
                data = await response.json();
            } catch (e) {
                console.error('Failed to parse response JSON');
            }

            if (response.ok) {
                // 3. Success Handling (200 OK)
                // Redirect exactly to the path provided by the API (e.g., /admin/dashboard)
                window.location.href = data.redirectTo || '/admin/dashboard';
            } else {
                // 4. Error Handling (Map exactly to API Error Codes)
                switch (response.status) {
                    case 400:
                        showError(data.errorCode === 'INVALID_EMAIL_FORMAT' ? "Invalid email format." : "Check your input and try again.");
                        break;
                    case 401:
                        showError("Incorrect email or password.");
                        break;
                    case 403:
                        showError("Your admin account is inactive. Please contact support.");
                        break;
                    case 500:
                        showError("System error. Please try again later.");
                        break;
                    default:
                        showError(data.message || "An unexpected error occurred.");
                }
            }
        } catch (error) {
            console.error('Login Network Error:', error);
            // Handling Network/CORS errors
            showError("Unable to connect to the server.");
        } finally {
            setLoading(false);
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleAdminLogin);
    }
});
