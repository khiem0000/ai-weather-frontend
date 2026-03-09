/* ============================================
   PROFILE JS - Quản lý Profile người dùng
   Kết nối với Backend API
   ============================================ */

// API Base URL
const API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/auth';

// Biến lưu thông tin user hiện tại
window.currentUser = null;

// Hàm hiển thị toast notification (sử dụng sẵn từ main.js)
function showProfileToast(message, isError = false) {
    // Gọi hàm toast có sẵn nếu đã load
    if (typeof showToast === 'function') {
        showToast(message);
    } else {
        // Fallback: sử dụng alert nếu chưa load main.js
        if (isError) {
            alert('Lỗi: ' + message);
        } else {
            alert(message);
        }
    }
}

// ============================================
// 1. LẤY THÔNG TIN PROFILE KHI LOAD TRANG
// ============================================
async function loadUserProfile() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.log('No token found, redirecting to login...');
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(API_BASE_URL + '/profile', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        const data = await response.json();

        if (response.ok) {
            window.currentUser = data;
            updateProfileUI(data);
        } else {
            // Token hết hạn hoặc không hợp lệ
            console.log('Profile fetch failed:', data.message);
            if (response.status === 401) {
                logout();
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// ============================================
// 2. CẬP NHẬT GIAO DIỆN PROFILE
// ============================================
function updateProfileUI(user) {
    // Cập nhật tên
    const displayName = document.getElementById('display-name');
    if (displayName) displayName.textContent = user.full_name || 'User';

    // Cập nhật email
    const displayEmail = document.getElementById('display-email');
    if (displayEmail) displayEmail.innerHTML = `<i class="fas fa-envelope"></i> ${user.email || 'email@example.com'}`;

    // Cập nhật ngày tham gia
    const memberSinceElem = document.querySelector('[data-i18n="member_since"]');
    if (memberSinceElem) {
        const lang = window.appSettings?.language || 'en';
        const prefix = lang === 'vi' ? 'Thành viên từ: ' : 'Member Since: ';
        memberSinceElem.textContent = prefix + (user.member_since || 'Unknown');
    }

    // Cập nhật avatar
    const headerAvatar = document.getElementById('header-avatar');
    const profileAvatar = document.getElementById('profile-avatar');
    const previewAvatar = document.getElementById('preview-avatar');

    const avatarUrl = user.avatar 
        ? user.avatar 
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name || 'U')}&background=4facfe&color=fff`;

    if (headerAvatar) headerAvatar.src = avatarUrl;
    if (profileAvatar) profileAvatar.src = avatarUrl;
    if (previewAvatar) previewAvatar.src = avatarUrl;

    // Cập nhật form edit
    const editNameInput = document.getElementById('edit-name-input');
    const editEmailInput = document.getElementById('edit-email-input');
    if (editNameInput) editNameInput.value = user.full_name || '';
    if (editEmailInput) editEmailInput.value = user.email || '';
}

// ============================================
// 3. CẬP NHẬT PROFILE VỚI BẢO MẬT OTP CHO EMAIL
// ============================================
async function updateProfile(name, email, avatar) {
    const token = localStorage.getItem('token');
    
    if (!token) {
        showProfileToast('Vui lòng đăng nhập lại!', true);
        return false;
    }

    // Lấy email hiện tại từ currentUser
    const currentEmail = window.currentUser?.email || '';
    const newEmail = email.trim().toLowerCase();
    const originalEmail = currentEmail.toLowerCase();

    // So sánh email cũ và mới
    const emailChanged = newEmail !== originalEmail;

    if (emailChanged) {
        // ============================================================
        // EMAIL THAY ĐỔI - CẦN XÁC THỰC OTP
        // ============================================================
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showProfileToast('Email không hợp lệ!', true);
            return false;
        }

        // Gọi API request-email-change để gửi OTP
        showProfileToast('Đang gửi mã xác thực...');
        
        try {
            const response = await fetch(API_BASE_URL + '/request-email-change', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ newEmail: email })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Mở Modal OTP
                openOTPModal(email, name, avatar);
                return 'otp_required';
            } else {
                showProfileToast(data.message || 'Không thể gửi mã xác thực!', true);
                return false;
            }
        } catch (error) {
            console.error('Error requesting email change:', error);
            showProfileToast('Lỗi kết nối server!', true);
            return false;
        }
    } else {
        // ============================================================
        // EMAIL KHÔNG THAY ĐỔI - CẬP NHẬT BÌNH THƯỜNG
        // ============================================================
        return await updateProfileNormal(name, email, avatar);
    }
}

// Hàm cập nhật profile bình thường (không cần OTP)
async function updateProfileNormal(name, email, avatar) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(API_BASE_URL + '/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                full_name: name,
                email: email,
                avatar: avatar
            })
        });

        const data = await response.json();

        if (response.ok) {
            showProfileToast('Cập nhật thông tin thành công!');
            
            // Cập nhật localStorage user info
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.full_name = name;
            storedUser.email = email;
            storedUser.avatar = avatar;
            localStorage.setItem('user', JSON.stringify(storedUser));
            
            // Cập nhật UI
            if (data.user) {
                updateProfileUI(data.user);
                window.currentUser = data.user;
            }
            
            return true;
        } else {
            showProfileToast(data.message || 'Cập nhật thất bại!', true);
            return false;
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        showProfileToast('Lỗi kết nối server!', true);
        return false;
    }
}

// ============================================
// 3B. OTP MODAL FUNCTIONS
// ============================================
let otpTimerInterval = null;
let pendingEmailChange = null;

// Mở Modal OTP
function openOTPModal(newEmail, name, avatar) {
    const modal = document.getElementById('otp-email-modal');
    const targetEmailSpan = document.getElementById('otp-target-email');
    const otpInput = document.getElementById('otp-input');
    const timerText = document.getElementById('otp-timer-text');
    const resendBtn = document.getElementById('otp-resend-btn');
    const confirmBtn = document.getElementById('otp-confirm-btn');
    const cancelBtn = document.getElementById('otp-cancel-btn');

    if (!modal) {
        console.error('OTP Modal not found!');
        return;
    }

    // Lưu thông tin thay đổi pending
    pendingEmailChange = { newEmail, name, avatar };

    // Set email target
    targetEmailSpan.textContent = newEmail;

    // Reset input
    otpInput.value = '';
    otpInput.disabled = false;

    // Reset buttons
    confirmBtn.disabled = false;
    document.getElementById('otp-btn-text').style.display = 'inline';
    document.getElementById('otp-btn-loading').style.display = 'none';

    // Show modal
    modal.classList.remove('hidden');
    modal.classList.add('show');

    // Focus vào input
    setTimeout(() => otpInput.focus(), 300);

    // Start timer
    startOTPTimer();

    // Xử lý nút Hủy
    cancelBtn.onclick = function() {
        closeOTPModal();
    };

    // Xử lý nút Xác nhận
    confirmBtn.onclick = async function() {
        await verifyOTP();
    };

    // Xử lý nút Gửi lại
    resendBtn.onclick = async function() {
        await resendOTP();
    };

    // Xử lý Enter key
    otpInput.onkeypress = async function(e) {
        if (e.key === 'Enter') {
            await verifyOTP();
        }
    };

    // Đóng modal khi click ra ngoài
    modal.onclick = function(e) {
        if (e.target === modal) {
            // Không đóng modal khi click ra ngoài để tránh mất dữ liệu
        }
    };
}

// Đóng Modal OTP
function closeOTPModal() {
    const modal = document.getElementById('otp-email-modal');
    
    if (modal) {
        modal.classList.remove('show');
        modal.classList.add('hidden');
    }

    // Clear timer
    if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
        otpTimerInterval = null;
    }

    // Clear pending
    pendingEmailChange = null;
}

// Timer đếm ngược 5 phút
function startOTPTimer() {
    const timerText = document.getElementById('otp-timer-text');
    const resendBtn = document.getElementById('otp-resend-btn');
    
    let timeLeft = 5 * 60; // 5 phút = 300 giây
    
    if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
    }

    resendBtn.style.display = 'none';
    
    otpTimerInterval = setInterval(() => {
        timeLeft--;
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        timerText.textContent = `Mã hết hạn sau: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(otpTimerInterval);
            timerText.textContent = 'Mã đã hết hạn!';
            resendBtn.style.display = 'inline';
            
            // Disable input
            document.getElementById('otp-input').disabled = true;
            document.getElementById('otp-confirm-btn').disabled = true;
        }
    }, 1000);
}

// Xác thực OTP
async function verifyOTP() {
    const token = localStorage.getItem('token');
    const otpInput = document.getElementById('otp-input');
    const otp = otpInput.value.trim();
    const confirmBtn = document.getElementById('otp-confirm-btn');
    const btnText = document.getElementById('otp-btn-text');
    const btnLoading = document.getElementById('otp-btn-loading');

    if (!pendingEmailChange) {
        showProfileToast('Phiên xác thực đã hết hạn!', true);
        closeOTPModal();
        return;
    }

    if (!otp || otp.length !== 6) {
        showProfileToast('Vui lòng nhập đủ 6 chữ số!', true);
        return;
    }

    // Show loading
    confirmBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';

    try {
        const response = await fetch(API_BASE_URL + '/verify-email-change', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                newEmail: pendingEmailChange.newEmail,
                otp: otp
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Thành công - đóng modal và cập nhật UI
            showProfileToast('Thay đổi email thành công!');
            
            // Kiểm tra pendingEmailChange tồn tại trước khi sử dụng
            if (!pendingEmailChange) {
                showProfileToast('Lỗi: Không có thông tin thay đổi!', true);
                closeOTPModal();
                return;
            }
            
            // Cập nhật localStorage (Lấy dữ liệu TRƯỚC KHI đóng modal)
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            storedUser.full_name = pendingEmailChange.name;
            storedUser.email = pendingEmailChange.newEmail;
            storedUser.avatar = pendingEmailChange.avatar;
            localStorage.setItem('user', JSON.stringify(storedUser));

            // Cập nhật UI
            if (window.currentUser) {
                // Lưu trữ member_since trước khi cập nhật
                const memberSince = window.currentUser.member_since;
                
                window.currentUser.full_name = pendingEmailChange.name;
                window.currentUser.email = pendingEmailChange.newEmail;
                window.currentUser.avatar = pendingEmailChange.avatar;
                
                // Khôi phục member_since sau khi cập nhật
                window.currentUser.member_since = memberSince;
            }
            updateProfileUI(window.currentUser);

            // 🟢 CHUYỂN HÀM ĐÓNG MODAL XUỐNG ĐÂY!
            closeOTPModal();

            // Đóng modal edit profile
            const editModal = document.getElementById('edit-profile-modal');
            if (editModal) editModal.classList.remove('show');

            // Hiển thị toast thông báo thành công và đăng nhập lại bắt buộc
            showProfileToast('Thay đổi email thành công! Đang đăng nhập lại...');
            
            // Đăng nhập lại bắt buộc sau 1.5 giây
            setTimeout(() => {
                performLogout();
            }, 1500);

        } else {
            // Thất bại
            showProfileToast(data.message || 'Mã OTP không chính xác!', true);
            otpInput.value = '';
            otpInput.focus();
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        showProfileToast('Lỗi kết nối server!', true);
    } finally {
        // Hide loading
        confirmBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

// Gửi lại OTP
async function resendOTP() {
    if (!pendingEmailChange) return;

    const token = localStorage.getItem('token');
    const resendBtn = document.getElementById('otp-resend-btn');
    
    resendBtn.disabled = true;
    resendBtn.textContent = 'Đang gửi...';

    try {
        const response = await fetch(API_BASE_URL + '/request-email-change', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ newEmail: pendingEmailChange.newEmail })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showProfileToast('Mã OTP đã được gửi lại!');
            
            // Reset input
            document.getElementById('otp-input').value = '';
            document.getElementById('otp-input').disabled = false;
            document.getElementById('otp-confirm-btn').disabled = false;
            
            // Restart timer
            startOTPTimer();
        } else {
            showProfileToast(data.message || 'Không thể gửi lại mã!', true);
            resendBtn.disabled = false;
            resendBtn.textContent = 'Gửi lại mã';
        }
    } catch (error) {
        console.error('Error resending OTP:', error);
        showProfileToast('Lỗi kết nối server!', true);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Gửi lại mã';
    }
}

// Export các hàm OTP
window.openOTPModal = openOTPModal;
window.closeOTPModal = closeOTPModal;

// ============================================
// 4. ĐĂNG XUẤT VỚI MODAL XÁC NHẬN
// ============================================
// Hàm hiển thị modal xác nhận đăng xuất (phong cách kính)
function showLogoutModal() {
    // Tạo modal nếu chưa tồn tại
    let modal = document.getElementById('logout-confirm-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'logout-confirm-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content glass-modal" style="max-width: 400px; padding: 30px; text-align: center; border-radius: 20px;">
                <div class="glass-modal-icon" style="width: 70px; height: 70px; margin: 0 auto 20px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-sign-out-alt" style="font-size: 30px; color: #ff6b6b;"></i>
                </div>
                <h3 style="margin-bottom: 15px; color: #fff; font-size: 22px;">Xác nhận đăng xuất</h3>
                <p style="color: rgba(255,255,255,0.7); margin-bottom: 25px;">Bạn có chắc chắn muốn đăng xuất khỏi tài khoản không?</p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="logout-cancel-btn" class="glass-btn" style="padding: 12px 30px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: #fff; border-radius: 25px; cursor: pointer; font-size: 15px; transition: all 0.3s;">Hủy</button>
                    <button id="logout-confirm-btn" class="glass-btn-danger" style="padding: 12px 30px; border: none; background: linear-gradient(135deg, #ff6b6b, #ee5a5a); color: #fff; border-radius: 25px; cursor: pointer; font-size: 15px; font-weight: 600; transition: all 0.3s;">Đăng xuất</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Xử lý sự kiện nút Hủy
        document.getElementById('logout-cancel-btn').addEventListener('click', function() {
            closeLogoutModal();
        });
        
        // Xử lý sự kiện nút Đăng xuất
        document.getElementById('logout-confirm-btn').addEventListener('click', function() {
            performLogout();
        });
        
        // Đóng modal khi click ra ngoài
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeLogoutModal();
            }
        });
    }
    
    // Hiển modal
    modal.classList.add('show');
}

// Hàm đóng modal đăng xuất
function closeLogoutModal() {
    const modal = document.getElementById('logout-confirm-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Hàm thực hiện đăng xuất
function performLogout() {
    // Xóa token và user trong localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Hiển thị toast thông báo
    if (typeof showToast === 'function') {
        showToast('Đăng xuất thành công!');
    }
    
    // Chuyển về trang login sau 1.5 giây
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1500);
}

// Hàm logout cũ (giữ lại để tương thích)
function logout() {
    showLogoutModal();
}

// ============================================
// 5. KHỞI TẠO
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    // Load profile khi trang đã sẵn sàng
    loadUserProfile();

    // Xử lý nút Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logout();
        });
    }

    // Xử lý lưu profile
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async function() {
            const name = document.getElementById('edit-name-input')?.value;
            const email = document.getElementById('edit-email-input')?.value;
            const avatar = document.getElementById('preview-avatar')?.src;

            if (!name || !email) {
                showProfileToast('Vui lòng nhập đầy đủ thông tin!', true);
                return;
            }

            // Validate email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showProfileToast('Email không hợp lệ!', true);
                return;
            }

            // Gọi API cập nhật
            const result = await updateProfile(name, email, avatar);
            
            // Chỉ đóng modal khi cập nhật thành công (true), KHÔNG đóng khi cần OTP ('otp_required')
            if (result === true) {
                // Đóng modal
                const modal = document.getElementById('edit-profile-modal');
                if (modal) modal.classList.remove('show');
            }
        });
    }

    // Xử lý upload avatar
    const avatarUpload = document.getElementById('avatar-upload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const previewAvatar = document.getElementById('preview-avatar');
                    if (previewAvatar) {
                        previewAvatar.src = event.target.result;
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Xử lý đóng modal edit profile
    const cancelProfileBtn = document.getElementById('cancel-profile-btn');
    if (cancelProfileBtn) {
        cancelProfileBtn.addEventListener('click', function() {
            // Khôi phục lại thông tin ban đầu
            if (window.currentUser) {
                updateProfileUI(window.currentUser);
            }
        });
    }
});

// Export các hàm để sử dụng từ bên ngoài
window.loadUserProfile = loadUserProfile;
window.updateProfileUI = updateProfileUI;
window.updateProfile = updateProfile;
window.logout = logout;

