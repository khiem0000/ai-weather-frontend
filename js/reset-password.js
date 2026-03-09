/* ============================================
   RESET PASSWORD PAGE JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    // Xử lý form submit - đặt lại mật khẩu
    const resetPasswordForm = document.getElementById('reset-password-form');
    
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const btnSubmit = document.getElementById('btn-submit');
            
            // Lấy email từ localStorage
            const email = localStorage.getItem('reset_email');
            
            if (!email) {
                showToast('Phiên làm việc đã hết hạn. Vui lòng thực hiện lại từ đầu!', 'error');
                setTimeout(() => {
                    window.location.href = 'forgot-password.html';
                }, 2000);
                return;
            }
            
            if (!newPassword) {
                showToast('Vui lòng nhập mật khẩu mới!', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                showToast('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                showToast('Mật khẩu nhập lại không khớp!', 'error');
                return;
            }
            
            // Đổi trạng thái nút khi đang gọi API
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            btnSubmit.disabled = true;
            showLoading('Đang đặt lại mật khẩu...');

            try {
                // Gọi API đặt lại mật khẩu
                const response = await fetch(API_BASE_URL + '/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email, password: newPassword })
                });

                const data = await response.json();
                hideLoading();

                if (response.ok) {
                    // Đặt lại mật khẩu thành công
                    showToast('Đặt lại mật khẩu thành công!', 'success');
                    localStorage.removeItem('reset_email');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                } else {
                    // Đặt lại mật khẩu thất bại
                    showToast(data.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại!', 'error');
                    btnSubmit.innerHTML = 'Đặt lại mật khẩu';
                    btnSubmit.disabled = false;
                }

            } catch (error) {
                console.error("Lỗi:", error);
                hideLoading();
                showToast('Không thể kết nối đến Server Backend. Vui lòng bật Node.js!', 'error');
                btnSubmit.innerHTML = 'Đặt lại mật khẩu';
                btnSubmit.disabled = false;
            }
        });
    }
});

