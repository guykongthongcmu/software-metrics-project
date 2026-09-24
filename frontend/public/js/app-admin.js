// Sidebar toggle, chart helpers, kanban drag-and-drop
function toggleSidebar() {
    const body = document.body;
    const sidebar = document.getElementById('sidebar');
    if (!body || !sidebar) {
        console.warn('DOM elements for sidebar not found');
        return;
    }

    if (window.innerWidth >= 992) {
        body.classList.toggle('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', body.classList.contains('sidebar-collapsed'));
    } else {
        sidebar.classList.toggle('show');
    }
}

/**
 * Global Initialization Orchestrator: Head-Safe Loading
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Restore Sidebar State
    if (localStorage.getItem('sidebarCollapsed') === 'true' && window.innerWidth >= 992) {
        document.body.classList.add('sidebar-collapsed');
    }

    // 2. Initialize Mobile Overlay Click
    document.addEventListener('click', function (e) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('show') && !sidebar.contains(e.target) && !e.target.closest('.mobile-toggle', '#sidebarToggleBtn')) {
            sidebar.classList.remove('show');
        }
    });
});

// Auto-dismiss flash alerts
document.querySelectorAll('.flash-alert').forEach(alert => {
    setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-10px)';
        setTimeout(() => alert.remove(), 300);
    }, 4000);
});

// Chart helper
function createChart(canvasId, config) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    return new Chart(ctx, config);
}


document.addEventListener('DOMContentLoaded', () => {

    // ============================================
    // LiquidGL Initialization
    // ============================================
    if (typeof liquidGL !== 'undefined') {
        try {
            // --- 1. Glassify sidebar & topbar (fixed elements via WebGL) ---
            liquidGL({
                target: '.liquidGL-sidebar, .liquidGL-topbar',
                snapshot: 'body',
                resolution: 2.0,
                refraction: 0.008,
                bevelDepth: 0.045,
                bevelWidth: 0.18,
                frost: 1.5,
                shadow: true,
                specular: true,
                tilt: false,
                reveal: 'fade',
                magnify: 1,
                on: {
                    init(instance) {
                        console.log('liquidGL nav ready!', instance);
                        document.body.classList.add('liquidGL-loaded');
                    }
                }
            });

            // --- 2. Apply CSS Liquid Glass to content cards ---
            // liquidGL shares a single canvas, so we use enhanced CSS for scrolling cards
            document.querySelectorAll('.stat-card, .glass-card-solid, .glass-card').forEach(card => {
                card.classList.add('liquid-glass-card');
            });

        } catch (e) {
            console.warn('liquidGL initialization error:', e);
        }
    }
});

// ============================================
// Topbar Search Navigation
// ============================================
function showSearchDropdown() {
    const dd = document.getElementById('searchDropdown');
    if (dd) dd.style.display = 'block';
}
function hideSearchDropdown() {
    const dd = document.getElementById('searchDropdown');
    if (dd) dd.style.display = 'none';
}
function filterSearchResults(query) {
    const dd = document.getElementById('searchDropdown');
    if (!dd) return;
    const items = dd.querySelectorAll('.search-result-item');
    const q = query.toLowerCase().trim();
    let anyVisible = false;
    items.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (!q || text.includes(q)) {
            item.style.display = 'flex';
            anyVisible = true;
        } else {
            item.style.display = 'none';
        }
    });
    dd.style.display = anyVisible ? 'block' : 'none';
}

// ============================================
// Bell Badge (Red Dot) Logic
// ============================================
(function initBellBadge() {
    const dot = document.getElementById('bellBadgeDot');
    if (!dot) return;
    const readAll = localStorage.getItem('notificationsReadAll');
    const hasUnread = !readAll || readAll !== 'true';
    dot.style.display = hasUnread ? 'block' : 'none';
})();

function updateBellBadge(hasUnread) {
    const dot = document.getElementById('bellBadgeDot');
    if (dot) dot.style.display = hasUnread ? 'block' : 'none';
    localStorage.setItem('notificationsReadAll', hasUnread ? 'false' : 'true');
}

// ============================================
// Dropdown & Search Hover Styles (injected CSS)
// ============================================
(function injectHoverCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .dropdown-item:hover, .dropdown-item:focus {
            background: rgba(200, 167, 125, 0.12) !important;
            color: var(--golden-straw) !important;
        }
        .search-result-item:hover {
            background: rgba(200, 167, 125, 0.12) !important;
            color: var(--golden-straw) !important;
        }
    `;
    document.head.appendChild(style);
})();

// ============================================
// Global Toast Notification System
// ============================================
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `glass-toast ${type}`;
    
    const icon = type === 'success' ? 'bi-check-circle' : (type === 'error' || type === 'danger' ? 'bi-exclamation-circle' : 'bi-info-circle');
    
    toast.innerHTML = `
        <div class="toast-icon"><i class="bi ${icon}"></i></div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <div class="toast-close" onclick="this.parentElement.remove()"><i class="bi bi-x"></i></div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
    `;
    document.body.appendChild(container);
    
    // Inject Toast CSS
    const style = document.createElement('style');
    style.textContent = `
        .glass-toast {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            padding: 12px 18px;
            min-width: 280px;
            max-width: 400px;
            display: flex;
            align-items: center;
            gap: 14px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
            pointer-events: auto;
            animation: toast-in 0.3s ease-out;
        }
        @keyframes toast-in {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .glass-toast.success { border-left: 4px solid #2ecc71; }
        .glass-toast.error, .glass-toast.danger { border-left: 4px solid #e74c3c; }
        .glass-toast.warning { border-left: 4px solid #f1c40f; }
        
        .toast-icon { font-size: 20px; }
        .success .toast-icon { color: #2ecc71; }
        .error .toast-icon, .danger .toast-icon { color: #e74c3c; }
        
        .toast-title { font-weight: 600; font-size: 14px; color: var(--text-primary); }
        .toast-message { font-size: 12px; color: var(--text-muted); }
        .toast-close { margin-left: auto; cursor: pointer; color: var(--text-muted); }
    `;
    document.head.appendChild(style);
    
    return container;
}

// Map to window for iframe access
window.showToast = showToast;

/**
 * Handle Admin Logout with production-grade security and UX
 */
async function handleAdminLogout(event) {
    if (event) event.preventDefault();
    
    const logoutBtn = event?.currentTarget || document.querySelector('.sidebar-footer .sidebar-nav-link');
    if (!logoutBtn || logoutBtn.classList.contains('loading')) return;

    // 1. UI Feedback: Show loading state
    const originalContent = logoutBtn.innerHTML;
    logoutBtn.classList.add('loading');
    logoutBtn.style.pointerEvents = 'none';
    logoutBtn.innerHTML = `<i class="bi bi-hourglass-split"></i> <span>Logging out...</span>`;

    try {
        // 2. Network Request: Call the proxy logout endpoint
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // SECURITY: Include credentials to allow the browser to send HttpOnly session cookies.
            credentials: 'include'
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok || response.status === 401) {
            // 3. Cleanup: Clear all admin-related client state
            // Success (200) or Session Expired (401) both lead to logout
            
            // Clear all Storage (as per security standards for sensitive apps)
            // Note: We might want to keep some non-sensitive UI settings, 
            // but the requirement was strict on cleaning admin-related state.
            localStorage.clear(); 
            sessionStorage.clear();

            // 4. Redirect: Go to the admin signin immediately
            window.location.href = '/admin/login';
        } else {
            // 5. Error Handling: Show user-friendly feedback
            throw new Error(data.message || 'Unable to logout. Please try again.');
        }

    } catch (error) {
        console.error('Logout Error:', error);
        
        // Restore UI state
        logoutBtn.classList.remove('loading');
        logoutBtn.style.pointerEvents = 'auto';
        logoutBtn.innerHTML = originalContent;

        // Show subtle error notification
        if (window.showToast) {
            window.showToast('Logout Failed', error.message || 'System error. Please try again.', 'error');
        } else {
            alert('Logout Failed: ' + (error.message || 'System error.'));
        }
    }
}

/**
 * Standard Admin Fetch Wrapper (Top 0.1% Architecture)
 * Enforces session-only cookie auth and handle global 401 redirection.
 */
/**
 * adminFetch Orchestrator (Top 0.1% Security Refactor)
 * Routes admin requests through the frontend proxy with session persistence.
 */
async function adminFetch(url, options = {}) {
    // 1. Use same-origin /api paths so deployed browsers do not call backend localhost directly.
    const targetUrl = url.startsWith('http') ? url : (url.startsWith('/') ? url : `/${url}`);

    // 2. Enforce Cross-Origin Credentials (HttpOnly Session Forwarding)
    const fetchOptions = {
        ...options,
        credentials: 'include',
        headers: {
            'Accept': 'application/json',
            ...(options.headers || {})
        }
    };

    try {
        const response = await fetch(targetUrl, fetchOptions);

        // 3. Centralized Authorization Interception
        if (response.status === 401) {
            console.warn('--- AUTH_FAILURE --- Admin session expired.');
            if (window.showToast) {
                window.showToast('Session Expired', 'Redirecting to login...', 'danger');
            }
            
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/admin/login?expired=true';
            }, 2000);
            
            throw new Error('Unauthorized');
        }

        return response;
    } catch (error) {
        if (error.status === 401) throw error;
        console.error('--- ADMIN_FETCH_ERROR ---', error);
        throw error;
    }
}

window.adminFetch = adminFetch;
window.handleAdminLogout = handleAdminLogout;
