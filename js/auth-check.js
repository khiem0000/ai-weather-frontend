let isCurrentlyMaintenance = false;
const MAINTENANCE_API_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/auth/status';

async function checkKillSwitch() {
    // Kim bài miễn tử cho trang Admin
    if (window.location.pathname.includes('admin.html')) return;

    try {
        // Ép API không được dùng cache
        const response = await fetch(MAINTENANCE_API_URL + `?t=${Date.now()}`);
        if (!response.ok) return;
        const data = await response.json();
        
        const isMaintenance = data.maintenance;
        const styleId = 'kill-switch-css';

        if (isMaintenance && !isCurrentlyMaintenance) {
            isCurrentlyMaintenance = true;
            
            // 1. TIÊM CSS: ĐỔI MÀU NÚT, TẠO TOOLTIP VÀ ẨN CỬA SỔ CHAT
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                    /* Ẩn hẳn cửa sổ chat nếu user đang mở */
                    #chat-modal-overlay { 
                        display: none !important; 
                        visibility: hidden !important; 
                    }
                    
                    /* Xóa hiệu ứng hào quang của nút */
                    #chat-fab-container::before,
                    #chat-fab-container::after {
                        display: none !important;
                        animation: none !important;
                    }

                    /* Biến nút thành màu xám tĩnh */
                    #chat-fab {
                        background: #475569 !important; /* Xám Slate */
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3) !important;
                        transform: none !important;
                        cursor: not-allowed !important;
                    }
                    #chat-fab i {
                        color: #94a3b8 !important; /* Icon xám nhạt */
                    }
                    
                    /* Tấm kính vô hình chặn đứng click */
                    #maintenance-blocker {
                        position: absolute !important;
                        top: 0; left: 0; right: 0; bottom: 0;
                        border-radius: 50%;
                        z-index: 999999;
                        cursor: not-allowed;
                    }

                    /* Tooltip Đỏ báo hiệu khi hover chuột */
                    #maintenance-blocker::after {
                        content: 'Hệ thống đang bảo trì';
                        position: absolute;
                        bottom: calc(100% + 15px);
                        right: 0;
                        background: #ef4444; /* Đỏ rực */
                        color: white;
                        padding: 6px 12px;
                        border-radius: 8px;
                        font-size: 12px;
                        white-space: nowrap;
                        font-family: 'Inter', sans-serif;
                        font-weight: 500;
                        opacity: 0;
                        visibility: hidden;
                        transition: 0.3s ease;
                        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
                        pointer-events: none;
                    }
                    #maintenance-blocker:hover::after {
                        opacity: 1;
                        visibility: visible;
                        bottom: calc(100% + 20px); /* Hiệu ứng nảy lên */
                    }
                `;
                document.head.appendChild(style);
            }

            // 2. CHÈN TẤM KÍNH TRONG SUỐT VÀO CHẶN CLICK
            const fabContainer = document.getElementById('chat-fab-container');
            if (fabContainer && !document.getElementById('maintenance-blocker')) {
                const blocker = document.createElement('div');
                blocker.id = 'maintenance-blocker';
                
                // Khi click vào tấm kính, văng Toast và CHẶN event lọt xuống nút gốc
                blocker.addEventListener('click', function(e) {
                    e.stopPropagation(); 
                    e.preventDefault();
                    
                    if (typeof showToast === 'function') {
                        showToast('AI Chatbot đang được nâng cấp. Vui lòng quay lại sau!');
                    } else {
                        alert('AI Chatbot đang được nâng cấp. Vui lòng quay lại sau!');
                    }
                });
                
                fabContainer.appendChild(blocker);
            }

            console.log('🚨 Đã kích hoạt UI bảo trì: Nút Chatbot chuyển xám!');
            
        } else if (!isMaintenance && isCurrentlyMaintenance) {
            isCurrentlyMaintenance = false;
            
            // Rút mũi kim CSS ra
            const style = document.getElementById(styleId);
            if (style) style.remove();
            
            // Xóa tấm kính chặn click
            const blocker = document.getElementById('maintenance-blocker');
            if (blocker) blocker.remove();

            console.log('✅ Đã tắt bảo trì - Chatbot xanh sáng trở lại');
        }
    } catch (e) {}
}

// Gọi ngay lập tức
checkKillSwitch();
setInterval(checkKillSwitch, 5000);

// ============================================
// AUTH CHECK - Protected Route Handler
// Kiểm tra xác thực trước khi cho phép truy cập trang
// ============================================

// Chạy ngay lập tức khi script được load - trước khi trang hiển thị
const LOGIN_PAGE = 'login.html';
const ONBOARDING_PAGE = 'onboarding.html';
const TOKEN_KEY = 'token';
const AUTH_API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/auth';

// Hàm xác thực token với backend (async)
async function verifyTokenWithBackend() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        return { valid: false, reason: 'no_token' };
    }

    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/verify-token`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            return { valid: true, user: data.user };
        } else if (response.status === 403) {
            // Kiểm tra nếu là tài khoản bị khóa
            const data = await response.json();
            if (data.message === "ACCOUNT_LOCKED") {
                console.log('Auth Check: Account is locked by admin. Redirecting to login...');
                handleAccountLocked();
                return { valid: false, reason: 'account_locked' };
            }
            return { valid: false, reason: 'invalid_token' };
        } else if (response.status === 401) {
            // Token invalid hoặc user đã bị xóa
            return { valid: false, reason: 'invalid_token' };
        } else {
            // Lỗi server - vẫn cho phép thử
            return { valid: true, reason: 'server_error' };
        }
    } catch (error) {
        console.error('Token verification error:', error);
        // Nếu không thể kết nối server, vẫn cho phép truy cập
        return { valid: true, reason: 'network_error' };
    }
}

// Hàm kiểm tra xem onboarding đã hoàn thành chưa từ API
async function checkOnboardingStatusFromAPI() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        return { completed: false, reason: 'no_token' };
    }

    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/settings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const settings = await response.json();
            
            // Cập nhật localStorage với settings mới nhất từ API
            const account = localStorage.getItem('currentAccount');
            if (account) {
                const accountData = JSON.parse(account);
                accountData.settings = {
                    ...accountData.settings,
                    ...settings
                };
                localStorage.setItem('currentAccount', JSON.stringify(accountData));
                
                // Cập nhật savedAccounts
                const savedAccounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
                const index = savedAccounts.findIndex(acc => acc.email === accountData.email);
                if (index >= 0) {
                    savedAccounts[index].settings = accountData.settings;
                    localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
                }
            }
            
            return { 
                completed: settings.hasCompletedOnboarding === true || settings.hasCompletedOnboarding === 1 || settings.hasCompletedOnboarding === '1',
                settings: settings
            };
        } else {
            return { completed: false, reason: 'api_error' };
        }
    } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Nếu lỗi, vẫn kiểm tra localStorage
        const account = localStorage.getItem('currentAccount');
        if (account) {
            const accountData = JSON.parse(account);
            return { 
                completed: accountData.settings && accountData.settings.hasCompletedOnboarding,
                reason: 'network_error_fallback'
            };
        }
        return { completed: false, reason: 'network_error' };
    }
}

// Hàm xóa tất cả dữ liệu đăng nhập
function clearAuthData() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('currentAccount');
    localStorage.removeItem('savedAccounts');
    localStorage.removeItem('userSettings');
}

// Hàm kiểm tra xem tài khoản có bị khóa không (dùng chung cho cả login và auth-check)
function handleAccountLocked() {
    clearAuthData();
    // Chuyển hướng về login
    window.location.href = LOGIN_PAGE;
}

// 🛡️ BƯỚC 1: Tạo một cờ khóa ở ngay trên hàm
let isCheckingAuth = false;

async function checkAuth() {
    // 🛡️ BƯỚC 2: BẢO VỆ CHỐNG ĐỆ QUY VÔ HẠN
    if (isCheckingAuth) {
        console.warn('🚨 Đã chặn một vòng lặp vô tận gọi checkAuth!');
        return true; 
    }
    
    isCheckingAuth = true; // Khóa cửa lại, không cho ai gọi checkAuth thêm nữa
    
    try {
        const token = localStorage.getItem('token');
        const LOGIN_PAGE = 'login.html';
        const ONBOARDING_PAGE = 'onboarding.html';

        if (!token) {
            if (!window.location.pathname.includes(LOGIN_PAGE) && !window.location.pathname.includes('register.html')) {
                window.location.href = LOGIN_PAGE;
            }
            return false;
        }
        
        // Xác thực token với backend
        const verification = await verifyTokenWithBackend();
        
        if (!verification.valid) {
            if (typeof clearAuthData === 'function') clearAuthData();
            window.location.href = LOGIN_PAGE;
            return false;
        }
        
        // Token hợp lệ - kiểm tra onboarding từ API
        const onboardingStatus = await checkOnboardingStatusFromAPI();
        
        try {
            let currentAccount = JSON.parse(localStorage.getItem('currentAccount') || '{}');
            if (!currentAccount.settings) currentAccount.settings = {};
            currentAccount.settings.hasCompletedOnboarding = onboardingStatus.completed;
            localStorage.setItem('currentAccount', JSON.stringify(currentAccount));
        } catch(e) {}
        
        const isCurrentlyOnOnboarding = window.location.pathname.includes('onboarding.html');
        
        if (!onboardingStatus.completed) {
            if (!isCurrentlyOnOnboarding) {
                window.location.href = ONBOARDING_PAGE;
                return false;
            }
            return true; 
        } else {
            if (isCurrentlyOnOnboarding) {
                window.location.href = 'index.html'; 
                return false;
            }
        }
        
        return true;
    } catch (e) {
        console.error('Auth Check Error:', e);
        return true;
    } finally {
        // 🛡️ BƯỚC 3: Mở khóa khi đã làm xong mọi việc
        isCheckingAuth = false; 
    }
}

// Thực hiện kiểm tra ngay lập tức - KHÔNG đợi DOMContentLoaded
checkAuth();

// Export hàm checkAuth để có thể sử dụng từ bên ngoài nếu cần
window.checkAuth = checkAuth;

// =========================================================================
// 🚔 TRỤC XUẤT TỨC THỜI (FORCE LOGOUT) - Kiểm tra tài khoản bị khóa
// =========================================================================
async function monitorAccountStatus() {
    // Không kiểm tra nếu đang ở trang Admin, Login hoặc Register
    if (window.location.pathname.includes('admin.html') || 
        window.location.pathname.includes('login.html') || 
        window.location.pathname.includes('register.html')) {
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        // Lấy profile để xem token còn sống và tài khoản còn mở không
        const response = await fetch('https://ai-weather-backend-f8q6.onrender.com/api/auth/profile', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        // Nếu Backend trả về 403 (Forbidden - Bị khóa) hoặc 401 (Unauthorized)
        if (response.status === 403 || response.status === 401) {
            console.log('🚨 Tài khoản đã bị khóa! Đang trục xuất...');
            
            // Xóa sạch thẻ ra vào
            localStorage.removeItem('token');
            localStorage.removeItem('currentAccount');
            
            // Đá văng ra trang login kèm theo "còi báo động" (tham số ?locked=true)
            window.location.href = 'login.html?locked=true';
        }
    } catch (error) {
        // Lỗi mạng thì im lặng bỏ qua, không tự ý đăng xuất user
    }
}

// Cứ 10 giây đi tuần tra 1 lần (dùng 10s để tránh làm mệt Server)
setInterval(monitorAccountStatus, 10000);
