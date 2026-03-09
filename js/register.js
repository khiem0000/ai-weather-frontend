/* ============================================
   REGISTER PAGE JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            const fullnameValue = document.getElementById('fullname').value;
            const emailValue = document.getElementById('email').value;
            const passwordValue = document.getElementById('password').value;
            const btnSubmit = document.getElementById('btn-submit');
            
            // Đổi trạng thái nút khi đang gọi API
            btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
            btnSubmit.disabled = true;
            showLoading('Đang đăng ký...');

            try {
                // Gọi xuống Backend MySQL
                const response = await fetch(API_BASE_URL + '/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        full_name: fullnameValue,
                        email: emailValue, 
                        password: passwordValue 
                    })
                });

                const data = await response.json();
                hideLoading();

                if (response.ok) {
                    // Đăng ký thành công
                    showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                } else {
                    // Đăng ký thất bại (Vd: Trùng email)
                    showToast(data.message || 'Đăng ký thất bại. Vui lòng thử lại!', 'error');
                    btnSubmit.innerHTML = 'Register';
                    btnSubmit.disabled = false;
                }

            } catch (error) {
                console.error("Lỗi:", error);
                hideLoading();
                showToast('Không thể kết nối đến Server Backend. Vui lòng bật Node.js!', 'error');
                btnSubmit.innerHTML = 'Register';
                btnSubmit.disabled = false;
            }
        });
    }
});

