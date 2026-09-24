/**
 * Admin Chat Logic
 */

const socket = io();
let currentUserId = 'user-001';

const messageContainer = document.getElementById('messageContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const conversationSearch = document.getElementById('conversationSearch');
const conversationList = document.getElementById('conversationList');
const typingIndicator = document.getElementById('typingIndicator');

// Auto-scroll to bottom
function scrollToBottom() {
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Initial scroll
scrollToBottom();

// Select Conversation
function selectConversation(userId) {
    const conv = conversationsData.find(c => c.id === userId);
    if (!conv) return;

    currentUserId = userId;

    // Update UI active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.userId === userId);
    });

    // Update Header
    document.getElementById('activeUserName').textContent = conv.name;
    document.getElementById('activeUserImg').src = conv.img;
    document.getElementById('activeUserStatus').className = `status-indicator ${conv.status}`;
    
    const statusText = document.getElementById('activeUserStatusText');
    statusText.textContent = conv.status;
    statusText.setAttribute('data-status', conv.status);
    // Remove the inline style color since it's now handled by CSS [data-status]
    statusText.style.color = '';

    // Load History
    renderHistory(conv.history);
    scrollToBottom();
}

function renderHistory(history) {
    // Clear current except typing indicator
    const messages = messageContainer.querySelectorAll('.message-row:not(#typingIndicator)');
    messages.forEach(m => m.remove());

    const separator = document.createElement('div');
    separator.className = 'chat-date-separator';
    separator.innerHTML = '<span>TODAY, 10:45 AM</span>';
    messageContainer.insertBefore(separator, typingIndicator);

    history.forEach(msg => {
        addMessageToUI(msg.sender, msg.text, msg.time, false);
    });
}

function addMessageToUI(sender, text, time, scroll = true) {
    const row = document.createElement('div');
    row.className = `message-row ${sender}`;
    
    row.innerHTML = `
        <div class="message-bubble">
            ${text}
        </div>
        <span class="message-time">${time}</span>
    `;

    messageContainer.insertBefore(row, typingIndicator);
    if (scroll) scrollToBottom();
}

// Send Message
function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add to UI
    addMessageToUI('admin', text, time);
    messageInput.value = '';

    // Emit to server
    socket.emit('admin_send_message', {
        to: currentUserId,
        text: text,
        time: time
    });

    // Mock response for demo
    simulateResponse(text);
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Mocking some interactions
function simulateResponse(adminText) {
    // Simulate typing
    setTimeout(() => {
        typingIndicator.style.display = 'flex';
        scrollToBottom();

        setTimeout(() => {
            typingIndicator.style.display = 'none';
            const responses = {
                'hello': 'Hi there! How can I help you?',
                'status': 'I checked and it should be arriving Soon.',
                'thanks': 'You\'re very welcome! Let me know if you need anything else.'
            };
            
            const lowerText = adminText.toLowerCase();
            let reply = "I'll look into that for you right away.";
            for (const key in responses) {
                if (lowerText.includes(key)) reply = responses[key];
            }

            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            addMessageToUI('customer', reply, time);
            
            // Sync with Top Header Notification (Mock)
            updateNotificationBadge();
        }, 2000);
    }, 1000);
}

function updateNotificationBadge() {
    // This would typically involve communicating with the layout via a global event or another socket emit
    const badge = parent.document.querySelector('.topbar-icon-btn .badge-dot');
    if (badge) {
        badge.style.display = 'block';
    }
}

// Search Filter
conversationSearch.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-item').forEach(item => {
        const name = item.querySelector('.chat-item-name').textContent.toLowerCase();
        item.style.display = name.includes(term) ? 'flex' : 'none';
    });
});

// Socket Events
socket.on('customer_message', (data) => {
    if (data.from === currentUserId) {
        addMessageToUI('customer', data.text, data.time);
    } else {
        // Update unread badge in sidebar
        const item = document.querySelector(`.chat-item[data-user-id="${data.from}"]`);
        if (item) {
            let badge = item.querySelector('.unread-badge');
            if (!badge) {
                const footer = item.querySelector('.chat-item-footer');
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                footer.appendChild(badge);
                badge.textContent = '0';
            }
            badge.textContent = parseInt(badge.textContent) + 1;
        }
    }
});

socket.on('customer_typing', (data) => {
    if (data.from === currentUserId) {
        typingIndicator.style.display = data.isTyping ? 'flex' : 'none';
        if (data.isTyping) scrollToBottom();
    }
});
