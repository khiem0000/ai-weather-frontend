// ============================================================
// CHAT BOT FUNCTIONALITY - Enhanced Version
// ============================================================

// Chat state
let chatMessages = [];
let isChatInitialized = false;

// LocalStorage key for chat history
const CHAT_STORAGE_KEY = 'chatbot_messages';

// ============================================================
// LOCAL STORAGE FUNCTIONS
// ============================================================

// Load chat history from localStorage
function loadChatHistory() {
    try {
        const stored = localStorage.getItem(CHAT_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading chat history:', e);
    }
    return [];
}

// Save chat history to localStorage
function saveChatHistory(messages) {
    try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
        console.error('Error saving chat history:', e);
    }
}

// Clear chat history - Trash button - Glassmorphism Modal
function clearChatHistory() {
    // Check if modal already exists, remove if so
    const existingModal = document.getElementById('chat-delete-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create glassmorphism modal
    const modalHTML = `
        <div class="chat-delete-modal-overlay" id="chat-delete-modal-overlay">
            <div class="chat-delete-modal-content" id="chat-delete-modal-content">
                <div class="chat-delete-icon">
                    <i class="fas fa-trash-alt"></i>
                </div>
                <h3 class="chat-delete-title">Xóa lịch sử chat?</h3>
                <p class="chat-delete-message">Tất cả tin nhắn sẽ bị xóa vĩnh viễn và không thể khôi phục.</p>
                <div class="chat-delete-buttons">
                    <button class="btn-chat-delete-cancel" id="btn-chat-delete-cancel">Hủy</button>
                    <button class="btn-chat-delete-confirm" id="btn-chat-delete-confirm">Xóa</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Get modal elements
    const modalOverlay = document.getElementById('chat-delete-modal-overlay');
    const modalContent = document.getElementById('chat-delete-modal-content');
    const cancelBtn = document.getElementById('btn-chat-delete-cancel');
    const confirmBtn = document.getElementById('btn-chat-delete-confirm');
    
    // Show modal with animation
    setTimeout(() => {
        modalOverlay.classList.add('show');
    }, 10);
    
    // Cancel button - close modal
    cancelBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('show');
        setTimeout(() => {
            modalOverlay.remove();
        }, 300);
    });
    
    // Confirm button - delete chat
    confirmBtn.addEventListener('click', () => {
        // Perform deletion
        localStorage.removeItem(CHAT_STORAGE_KEY);
        chatMessages = [];
        const chatMessagesContainer = document.getElementById('chat-messages');
        if (chatMessagesContainer) {
            chatMessagesContainer.innerHTML = '';
            showWelcomeMessage();
        }
        
        // Close modal
        modalOverlay.classList.remove('show');
        setTimeout(() => {
            modalOverlay.remove();
        }, 300);
    });
    
    // Close when clicking overlay
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.classList.remove('show');
            setTimeout(() => {
                modalOverlay.remove();
            }, 300);
        }
    });
}

// ============================================================
// FORMAT FUNCTIONS
// ============================================================

// Format AI message: convert **text** to <strong>text</strong> and \n to <br>
function formatAIMessage(text) {
    if (!text) return '';
    
    // First escape HTML to prevent XSS
    let formatted = text.replace(/&/g, '&amp;')
                       .replace(/</g, '<')
                       .replace(/>/g, '>');
    
    // Convert **text** to <strong>text</strong>
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert \n to <br>
    formatted = formatted.replace(/\\n/g, '<br>');
    
    // Convert newlines in actual text
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// Get user avatar from localStorage
function getUserAvatar() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user && user.avatar) {
            return user.avatar;
        }
    } catch (e) {
        console.error('Error getting user avatar:', e);
    }
    // Default avatar
    return 'https://ui-avatars.com/api/?name=TK&background=4facfe&color=fff';
}

// ============================================================
// INITIALIZATION
// ============================================================

// Initialize Chat Bot
function initChatBot() {
    if (isChatInitialized) return;
    
    const chatFab = document.getElementById('chat-fab');
    const chatModalOverlay = document.getElementById('chat-modal-overlay');
    const chatCloseBtn = document.getElementById('chat-close-btn');
    const chatTrashBtn = document.getElementById('chat-trash-btn');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');
    
// Open chat modal
    if (chatFab) {
        chatFab.addEventListener('click', () => {
            if (chatModalOverlay) {
                chatModalOverlay.classList.add('show');
                // Focus on input
                setTimeout(() => {
                    if (chatInput) chatInput.focus();
                }, 300);
                
                // Load chat history when opening
                renderChatHistory();
                
                // Auto-greeting: Check if chat history is empty and show welcome message
                checkAndShowAutoGreeting();
            }
        });
    }
    
    // Close chat modal
    if (chatCloseBtn) {
        chatCloseBtn.addEventListener('click', () => {
            if (chatModalOverlay) {
                chatModalOverlay.classList.remove('show');
            }
        });
    }
    
// Clear chat history - Trash button - Opens glassmorphism modal
    if (chatTrashBtn) {
        chatTrashBtn.addEventListener('click', () => {
            clearChatHistory();
        });
    }
    
    // Close when clicking on overlay
    if (chatModalOverlay) {
        chatModalOverlay.addEventListener('click', (e) => {
            if (e.target === chatModalOverlay) {
                chatModalOverlay.classList.remove('show');
            }
        });
    }
    
    // Send message on button click
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', () => {
            sendChatMessage();
        });
    }
    
    // Send message on Enter key
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    // Initialize suggestion chips
    initSuggestionChips();
    
    isChatInitialized = true;
}

// ============================================================
    // SUGGESTION CHIPS - Mouse drag scrolling for PC
    // ============================================================
    
    // Initialize suggestion chips - hỗ trợ cả suggestion_chip và suggestion-chip
    function initSuggestionChips() {
        // Try both class names to ensure compatibility
        const chipsWithDash = document.querySelectorAll('.suggestion-chip');
        const chipsWithUnderscore = document.querySelectorAll('.suggestion_chip');
        
        // Combine both NodeLists
        const allChips = [...chipsWithDash, ...chipsWithUnderscore];
        
        allChips.forEach(chip => {
            // Remove event listeners to avoid duplicates
            chip.removeEventListener('click', handleChipClick);
            chip.addEventListener('click', handleChipClick);
            
            // Also support touch events for mobile
            chip.addEventListener('touchend', handleChipClick);
        });
        
        // Add mouse drag scrolling for PC
        initChipsDragScroll();
    }
    
    // Mouse drag scrolling for suggestion chips
    function initChipsDragScroll() {
        const chipsContainers = document.querySelectorAll('.suggestion-chips');
        
        chipsContainers.forEach(container => {
            let isDown = false;
            let startX;
            let scrollLeft;
            
            container.addEventListener('mousedown', (e) => {
                // Only handle if clicking on the container itself, not on a chip
                if (e.target.classList.contains('suggestion-chips') || e.target.classList.contains('suggestion_chip')) {
                    isDown = true;
                    container.style.cursor = 'grabbing';
                    startX = e.pageX - container.offsetLeft;
                    scrollLeft = container.scrollLeft;
                }
            });
            
            container.addEventListener('mouseleave', () => {
                isDown = false;
                container.style.cursor = 'grab';
            });
            
            container.addEventListener('mouseup', () => {
                isDown = false;
                container.style.cursor = 'grab';
            });
            
            container.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const walk = (x - startX) * 2; // Scroll speed multiplier
                container.scrollLeft = scrollLeft - walk;
            });
            
            // Set initial cursor style
            container.style.cursor = 'grab';
        });
    }

// Handler for chip click
function handleChipClick(e) {
    // Prevent double firing on devices that fire both click and touchend
    if (e.type === 'touchend') {
        e.preventDefault();
    }
    
    const chip = e.currentTarget;
    const message = chip.textContent.trim();
    const chatInput = document.getElementById('chat-input');
    if (chatInput && message) {
        chatInput.value = message;
        sendChatMessage();
    }
}

// Show welcome message
function showWelcomeMessage() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return;
    
    const welcomeHTML = `
        <div class="chat-welcome" id="chat-welcome">
            <i class="fas fa-robot"></i>
            <h4>Chào bạn, tôi là khiewcokk AI</h4>
            <p>Bạn cần giúp đỡ gì về thời tiết hôm nay không?</p>
        </div>
    `;
    
    chatMessagesContainer.innerHTML = welcomeHTML;
}

// Render chat history from localStorage
function renderChatHistory() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return;
    
    const history = loadChatHistory();
    
    // If no history, show welcome message
    if (history.length === 0) {
        showWelcomeMessage();
        return;
    }
    
    // Clear container and render history
    chatMessagesContainer.innerHTML = '';
    
    history.forEach(msg => {
        addMessageToUI(msg.text, msg.type, msg.time, false);
    });
    
    chatMessages = history;
}

// ============================================================
// AUTO GREETING - Show welcome message when chat is opened
// ============================================================

// Check and show auto greeting when chat is opened
function checkAndShowAutoGreeting() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatWelcome = document.getElementById('chat-welcome');
    if (!chatMessagesContainer) return;
    
    // Check if chat history is empty
    const history = loadChatHistory();
    
    // If history is empty, show auto greeting from AI
    if (history.length === 0) {
        // Remove welcome message if exists
        if (chatWelcome) {
            chatWelcome.style.display = 'none';
        }
        
        // Clear container first
        chatMessagesContainer.innerHTML = '';
        
        // Show auto greeting message from AI
        const greetingMessage = "Chào bạn! Tên tôi là khiewcokk AI, trợ lý thời tiết của ứng dụng AI Weather. Bạn có câu hỏi nào về thời tiết hôm nay không?";
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        // Add greeting to localStorage
        chatMessages.push({
            text: greetingMessage,
            type: 'ai',
            time: timeString
        });
        saveChatHistory(chatMessages);
        
        // Add to UI with animation
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message ai';
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-bubble">
                ${formatAIMessage(greetingMessage)}
                <div class="message-time">${timeString}</div>
            </div>
        `;
        
        chatMessagesContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        setTimeout(() => {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, 100);
    }
}

// ============================================================
// SEND MESSAGE TO AI (Real API Integration)
// ============================================================

// Send message function - Kết nối API thực tế
async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatWelcome = document.getElementById('chat-welcome');
    
    if (!chatInput || !chatMessagesContainer) return;
    
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Remove welcome message if exists
    if (chatWelcome) {
        chatWelcome.style.display = 'none';
    }
    
    // Kiểm tra xác thực TRƯỚC KHI gửi - nếu không có token thì không gọi API
    const token = localStorage.getItem('token');
    if (!token) {
        // Hiển thị thông báo yêu cầu đăng nhập
        const lang = window.appSettings?.language || 'en';
        const loginMsg = lang === 'vi' 
            ? "🔒 Bạn cần đăng nhập để sử dụng AI Chat. Vui lòng đăng nhập trước nhé!" 
            : "🔒 You need to login to use AI Chat. Please login first!";
        
        addMessage(message, 'user');
        addMessage(loginMsg, 'ai');
        chatInput.value = '';
        return;
    }
    
    // 1. Hiển thị tin nhắn của user lên giao diện
    addMessage(message, 'user');
    
    // Clear input
    chatInput.value = '';
    
    // 2. Hiển thị trạng thái 'AI đang phân tích dữ liệu thời tiết...' (Loading bubble)
    const loadingId = addLoadingMessage();
    
    // 3. Lấy dữ liệu thời tiết từ biến toàn cục
    const weatherData = window.currentWeatherData;
    
    try {
        // Gọi API POST /api/chat
        const response = await fetch('http://127.0.0.1:5000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                userMessage: message,
                weatherContext: weatherData
            })
        });
        
        // Xử lý response - không để 401 gây ra redirect
        if (response.status === 401 || response.status === 403) {
            // Token hết hạn hoặc không hợp lệ
            removeLoadingMessage(loadingId);
            const lang = window.appSettings?.language || 'en';
            const expiredMsg = lang === 'vi' 
                ? "🔒 Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!" 
                : "🔒 Session expired. Please login again!";
            addMessage(expiredMsg, 'ai');
            return;
        }
        
        const result = await response.json();
        
        // 4. Xóa loading bubble và hiển thị câu trả lời của AI
        removeLoadingMessage(loadingId);
        
        if (result.success && result.reply) {
            addMessage(result.reply, 'ai');
        } else {
            // Xử lý lỗi từ server
            const errorMsg = result.message || "Xin lỗi, đã có lỗi xảy ra. Bạn có thể thử lại không?";
            addMessage(errorMsg, 'ai');
        }
        
    } catch (error) {
        console.error('❌ Chat API Error:', error);
        
        // Xóa loading bubble
        removeLoadingMessage(loadingId);
        
        // Hiển thị thông báo lỗi thân thiện - KHÔNG redirect
        const lang = window.appSettings?.language || 'en';
        const errorMessage = lang === 'vi' 
            ? "Xin lỗi, tôi đang gặp sự cố kết nối. Bạn có muốn thử lại không?" 
            : "Sorry, I'm having connection issues. Would you like to try again?";
        
        addMessage(errorMessage, 'ai');
    }
    
    // 5. Tự động cuộn khung chat xuống dưới cùng
    setTimeout(() => {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }, 100);
}

/**
 * Thêm tin nhắn loading vào chat
 * @returns {string} - ID của message element để xóa sau
 */
function addLoadingMessage() {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return null;
    
    const loadingId = 'loading-' + Date.now();
    const now = new Date();
    const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message ai loading-message';
    messageDiv.id = loadingId;
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <div class="message-time">${timeString}</div>
        </div>
    `;
    
    chatMessagesContainer.appendChild(messageDiv);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    
    return loadingId;
}

/**
 * Xóa tin nhắn loading
 * @param {string} loadingId - ID của loading message cần xóa
 */
function removeLoadingMessage(loadingId) {
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) {
        loadingEl.remove();
    }
}

// Add message to chat and localStorage
function addMessage(text, type) {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    
    // Add to chatMessages array
    chatMessages.push({
        text: text,
        type: type,
        time: timeString
    });
    
    // Save to localStorage
    saveChatHistory(chatMessages);
    
    // Add to UI
    addMessageToUI(text, type, timeString, true);
}

// Add message to UI
function addMessageToUI(text, type, timeString, scrollToBottom) {
    const chatMessagesContainer = document.getElementById('chat-messages');
    if (!chatMessagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${type}`;
    
    if (type === 'ai') {
        // Format AI message with **text** and \n
        const formattedText = formatAIMessage(text);
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-bubble">
                ${formattedText}
                <div class="message-time">${timeString}</div>
            </div>
        `;
    } else {
        // User message - get avatar from localStorage
        const userAvatar = getUserAvatar();
        
        messageDiv.innerHTML = `
            <div class="message-bubble">
                ${text}
                <div class="message-time">${timeString}</div>
            </div>
            <div class="message-avatar">
                <img src="${userAvatar}" alt="User" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">
            </div>
        `;
    }
    
    chatMessagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    if (scrollToBottom) {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
}

// Initialize chat when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat bot
    setTimeout(() => {
        initChatBot();
    }, 100);
});

