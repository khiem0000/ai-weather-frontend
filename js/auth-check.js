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
        } else if (response.status === 401 || response.status === 403) {
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

// Hàm kiểm tra xác thực (sync - chạy ngay)
async function checkAuth() {
    try {
        // Lấy token từ localStorage
        const token = localStorage.getItem(TOKEN_KEY);
        
        // Nếu không có token, chuyển hướng về trang login
        if (!token) {
            console.log('Auth Check: No token found. Redirecting to login...');
            window.location.href = LOGIN_PAGE;
            return false;
        }
        
        // Xác thực token với backend
        const verification = await verifyTokenWithBackend();
        
        if (!verification.valid) {
            // Token không hợp lệ hoặc user đã bị xóa
            console.log('Auth Check: Token invalid or user deleted. Clearing auth data...');
            clearAuthData();
            
            // Chuyển hướng về login với thông báo
            window.location.href = LOGIN_PAGE;
            return false;
        }
        
        // Token hợp lệ - kiểm tra onboarding từ API (để đảm bảo lấy dữ liệu mới nhất)
        const onboardingStatus = await checkOnboardingStatusFromAPI();
        
        if (!onboardingStatus.completed) {
            console.log('Auth Check: Onboarding not completed. Redirecting to onboarding...');
            window.location.href = ONBOARDING_PAGE;
            return false;
        }
        
        // Token hợp lệ và đã hoàn thành onboarding - cho phép truy cập
        console.log('Auth Check: Token verified and onboarding completed. Access granted.');
        return true;
    } catch (e) {
        console.error('Auth Check Error:', e);
        // Nếu có lỗi (ví dụ: localStorage không khả dụng), vẫn cho phép truy cập
        return true;
    }
}

// Thực hiện kiểm tra ngay lập tức - KHÔNG đợi DOMContentLoaded
checkAuth();

// Export hàm checkAuth để có thể sử dụng từ bên ngoài nếu cần
window.checkAuth = checkAuth;

