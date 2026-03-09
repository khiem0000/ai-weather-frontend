/* ============================================
   FORGOT PASSWORD PAGE JS
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    let countdownTimer;
    let otpVerified = false;
    
    // Xử lý nút gửi mã OTP
    const btnSendOtp = document.getElementById('btn-send-otp');
    
    if (btnSendOtp) {
        btnSendOtp.addEventListener('click', async function() {
            const emailValue = document.getElementById('email').value;
            const emailInput = document.getElementById('email');
            
            // Xóa trạng thái cũ
            if (emailInput) {
                emailInput.classList.remove('input-error', 'input-success');
            }
            
            if (!emailValue) {
                if (emailInput) emailInput.classList.add('input-error');
                showToast('Vui lòng nhập email!', 'error');
                return;
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailValue)) {
                if (emailInput) emailInput.classList.add('input-error');
                showToast('Vui lòng nhập đúng định dạng email!', 'error');
                return;
            }
            
            // Kiểm tra email có tồn tại trong hệ thống không
            showLoading('Đang kiểm tra email...');
            
            try {
                const checkResponse = await fetch(API_BASE_URL + '/check-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailValue })
                });
                
                const checkData = await checkResponse.json();
                console.log('Check email response:', checkResponse.status, checkData);
                
                // Kiểm tra phản hồi từ backend - hỗ trợ nhiều định dạng response
                const emailExists = checkData.exists || checkData.success || (checkResponse.ok && checkData.user) || (checkData.message && checkData.message.toLowerCase().includes('found'));
                
                if (!checkResponse.ok || !emailExists) {
                    hideLoading();
                    if (emailInput) emailInput.classList.add('input-error');
                    console.log('Email check failed:', { status: checkResponse.status, data: checkData });
                    showToast('Email này chưa được đăng ký! Vui lòng đăng ký trước.', 'error');
                    return;
                }
                
                // Email hợp lệ, tiến hành gửi OTP
                if (emailInput) emailInput.classList.add('input-success');
                showLoading('Đang gửi mã OTP...');
                
                // Đổi trạng thái nút khi đang gọi API
                btnSendOtp.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
                btnSendOtp.disabled = true;
                
                // Gọi API gửi OTP
                const response = await fetch(API_BASE_URL + '/send-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailValue })
                });

                const data = await response.json();
                console.log('Send OTP response:', response.status, data);
                hideLoading();

                if (response.ok) {
                    showToast('Mã OTP đã được gửi đến email của bạn!', 'success');
                    startCountdown();
                } else {
                    console.error('Send OTP error:', { status: response.status, data: data });
                    showToast(data.message || 'Không thể gửi mã OTP. Vui lòng thử lại! Lỗi: ' + response.status, 'error');
                    btnSendOtp.innerHTML = 'Gửi mã OTP';
                    btnSendOtp.disabled = false;
                }

            } catch (error) {
                console.error("Lỗi:", error);
                hideLoading();
                showToast('Không thể kết nối đến Server Backend. Vui lòng bật Node.js!', 'error');
                btnSendOtp.innerHTML = 'Gửi mã OTP';
                btnSendOtp.disabled = false;
            }
        });
    }
    
    // Hàm đếm ngược thời gian gửi lại OTP
    function startCountdown() {
        const otpTimer = document.getElementById('otp-timer');
        const countdownSpan = document.getElementById('countdown');
        const btnSendOtp = document.getElementById('btn-send-otp');
        
        if (!otpTimer || !countdownSpan || !btnSendOtp) return;
        
        let seconds = 60;
        otpTimer.style.display = 'block';
        countdownSpan.textContent = seconds;
        
        countdownTimer = setInterval(function() {
            seconds--;
            countdownSpan.textContent = seconds;
            
            if (seconds <= 0) {
                clearInterval(countdownTimer);
                otpTimer.style.display = 'none';
                btnSendOtp.innerHTML = 'Gửi mã OTP';
                btnSendOtp.disabled = false;
            }
        }, 1000);
    }

    // Tự động kiểm tra OTP khi nhập đủ 6 ký tự
    const otpInput = document.getElementById('otp');
    
    if (otpInput) {
        otpInput.addEventListener('input', async function(e) {
            const otpValue = e.target.value;
            const emailInput = document.getElementById('email');
            const emailValue = emailInput ? emailInput.value : '';
            const otpInputEl = e.target;
            
            // Reset trạng thái
            otpInputEl.classList.remove('input-error', 'input-success');
            
            // Chỉ kiểm tra khi nhập đủ 6 ký tự
            if (otpValue.length === 6 && emailValue && !otpVerified) {
                otpInputEl.classList.add('input-success');
                showLoading('Đang xác thực mã OTP...');
                
                try {
                    const response = await fetch(API_BASE_URL + '/verify-otp', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailValue, otp: otpValue })
                    });

                    const data = await response.json();
                    hideLoading();

                    if (response.ok) {
                        otpVerified = true;
                        otpInputEl.classList.add('input-success');
                        showToast('Xác thực thành công!', 'success');
                        
                        // Lưu email vào localStorage
                        localStorage.setItem('reset_email', emailValue);
                        
                        // Chuyển sang trang đặt lại mật khẩu sau 1 giây
                        setTimeout(() => {
                            window.location.href = 'reset-password.html';
                        }, 1000);
                    } else {
                        otpInputEl.classList.add('input-error');
                        showToast(data.message || 'Mã OTP không đúng hoặc đã hết hạn!', 'error');
                    }

                } catch (error) {
                    console.error("Lỗi:", error);
                    hideLoading();
                    otpInputEl.classList.add('input-error');
                    showToast('Không thể kết nối đến Server Backend!', 'error');
                }
            }
        });
    }

    // Xử lý form submit (backup - nút đã ẩn nhưng giữ lại để tương thích)
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async function(e) {
            e.preventDefault(); 
            
            // Nếu đã xác thực OTP thành công thì chuyển trang luôn
            if (otpVerified) {
                window.location.href = 'reset-password.html';
                return;
            }
            
            const emailValue = document.getElementById('email').value;
            const otpValue = document.getElementById('otp').value;
            const btnSubmit = document.getElementById('btn-submit');
            
            if (!otpValue) {
                showToast('Vui lòng nhập mã OTP!', 'error');
                return;
            }
            
            // Đổi trạng thái nút khi đang gọi API
            if (btnSubmit) {
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
                btnSubmit.disabled = true;
            }
            showLoading('Đang xác thực...');

            try {
                const response = await fetch(API_BASE_URL + '/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailValue, otp: otpValue })
                });

                const data = await response.json();
                hideLoading();

                if (response.ok) {
                    localStorage.setItem('reset_email', emailValue);
                    showToast('Xác thực thành công!', 'success');
                    setTimeout(() => {
                        window.location.href = 'reset-password.html';
                    }, 1000);
                } else {
                    showToast(data.message || 'Mã OTP không đúng hoặc đã hết hạn!', 'error');
                    if (btnSubmit) {
                        btnSubmit.innerHTML = 'Xác thực & Đặt lại mật khẩu';
                        btnSubmit.disabled = false;
                    }
                }

            } catch (error) {
                console.error("Lỗi:", error);
                hideLoading();
                showToast('Không thể kết nối đến Server Backend!', 'error');
                if (btnSubmit) {
                    btnSubmit.innerHTML = 'Xác thực & Đặt lại mật khẩu';
                    btnSubmit.disabled = false;
                }
            }
        });
    }
});

