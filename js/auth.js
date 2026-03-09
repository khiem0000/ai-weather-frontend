/* ============================================
   AUTH JS - SHARED FUNCTIONS
   Used for: login, register, forgot-password, reset-password
   ============================================ */

// Hàm hiển thị toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        info: 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="${icons[type]}"></i>
        <span>${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 4000);
}

// Hàm hiển thị loading
function showLoading(text = 'Đang xử lý...') {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    if (loadingText) {
        loadingText.textContent = text;
    }
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

// Hàm ẩn loading
function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

// API Base URL
const API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/auth';

// Hàm toggle hiển thị/ẩn mật khẩu
function togglePassword(inputId, iconElement) {
    const passwordInput = document.getElementById(inputId);
    
    if (!passwordInput) {
        console.error('Password input not found:', inputId);
        return;
    }
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        iconElement.classList.remove('fa-eye');
        iconElement.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        iconElement.classList.remove('fa-eye-slash');
        iconElement.classList.add('fa-eye');
    }
}

