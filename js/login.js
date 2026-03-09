/* ============================================
   LOGIN PAGE JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const emailValue = document.getElementById('email').value;
            const passwordValue = document.getElementById('password').value;
            const btnSubmit = document.getElementById('btn-submit');
            
            // Đổi trạng thái nút khi đang gọi API
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            btnSubmit.disabled = true;
            showLoading('Đang đăng nhập...');

            try {
                // Gọi xuống Backend MySQL
                const response = await fetch(API_BASE_URL + '/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailValue, password: passwordValue })
                });

                const data = await response.json();
                hideLoading();

                if (response.ok) {
                    // Nếu đúng tài khoản
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // Lưu tài khoản vào danh sách đã lưu (multi-account)
                    const savedAccounts = JSON.parse(localStorage.getItem('savedAccounts') || '[]');
                    const existingIndex = savedAccounts.findIndex(acc => acc.email === data.user.email);
                    
                    const accountInfo = {
                        id: data.user.id,
                        full_name: data.user.full_name,
                        email: data.user.email,
                        avatar: data.user.avatar,
                        token: data.token,
                        settings: data.user.settings || {}
                    };
                    
                    if (existingIndex >= 0) {
                        savedAccounts[existingIndex] = accountInfo;
                    } else {
                        savedAccounts.push(accountInfo);
                    }
                    
                    localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
                    localStorage.setItem('currentAccount', JSON.stringify(accountInfo));
                    
                    showToast('Đăng nhập thành công!', 'success');
                    
                    // Check if user has completed onboarding
                    setTimeout(() => {
                        if (accountInfo.settings && accountInfo.settings.hasCompletedOnboarding) {
                            // Already completed onboarding - go to index
                            window.location.href = 'index.html';
                        } else {
                            // Not completed onboarding - go to onboarding page
                            window.location.href = 'onboarding.html';
                        }
                    }, 1000);
                } else {
                    // Sai mật khẩu
                    showToast(data.message || 'Email hoặc mật khẩu không đúng!', 'error');
                    btnSubmit.innerHTML = 'Login';
                    btnSubmit.disabled = false;
                }

            } catch (error) {
                console.error("Lỗi:", error);
                hideLoading();
                showToast('Không thể kết nối đến Server Backend. Vui lòng bật Node.js!', 'error');
                btnSubmit.innerHTML = 'Login';
                btnSubmit.disabled = false;
            }
        });
    }
});

