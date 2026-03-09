/**
 * PWA Installation Logic
 * Xử lý việc cài đặt PWA lên màn hình chính
 */

(function() {
    'use strict';

    // Biến lưu trữ sự kiện beforeinstallprompt
    let deferredPrompt = null;

    // DOM Elements
    const installButton = document.getElementById('btn-install-app');

    /**
     * Khởi tạo PWA install handler
     */
    function initPWAInstall() {
        if (!installButton) {
            console.warn('⚠️ Không tìm thấy nút cài đặt với id: btn-install-app');
            return;
        }

        // Lắng nghe sự kiện beforeinstallprompt
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Lắng nghe sự kiện appinstalled
        window.addEventListener('appinstalled', handleAppInstalled);

        console.log('✅ PWA Install Handler đã được khởi tạo');
    }

    /**
     * Xử lý sự kiện beforeinstallprompt
     * @param {Event} event - Sự kiện beforeinstallprompt
     */
    function handleBeforeInstallPrompt(event) {
        // Ngăn chặn hành vi mặc định (hiển thị mini-infobar tự động)
        event.preventDefault();

        // Lưu lại event để sử dụng sau
        deferredPrompt = event;

        console.log('📲 Sự kiện beforeinstallprompt đã được kích hoạt');

        // Hiển thị nút cài đặt
        showInstallButton();
    }

    /**
     * Hiển thị nút cài đặt app
     */
    function showInstallButton() {
        if (installButton) {
            installButton.style.display = 'flex';
            console.log('👆 Nút cài đặt đã được hiển thị');
        }
    }

    /**
     * Ẩn nút cài đặt app
     */
    function hideInstallButton() {
        if (installButton) {
            installButton.style.display = 'none';
            console.log('👆 Nút cài đặt đã được ẩn');
        }
    }

    /**
     * Xử lý khi người dùng click vào nút cài đặt
     */
    async function handleInstallClick() {
        if (!deferredPrompt) {
            console.log('❌ Không có sự kiện cài đặt nào đang chờ');
            return;
        }

        // Gọi hàm prompt() để hiển thị dialog cài đặt
        deferredPrompt.prompt();

        // Chờ người dùng lựa chọn
        const { outcome } = await deferredPrompt.userChoice;

        // In ra console kết quả người dùng chọn
        if (outcome === 'accepted') {
            console.log('✅ Người dùng đã ĐỒNG Ý cài đặt app');
            console.log('📱 App đang được cài đặt...');
        } else if (outcome === 'dismissed') {
            console.log('❌ Người dùng đã HỦY cài đặt app');
        } else {
            console.log('⚠️ Kết quả không xác định:', outcome);
        }

        // Xóa biến deferredPrompt sau khi sử dụng
        deferredPrompt = null;

        // Ẩn nút cài đặt (vì dialog đã đóng)
        hideInstallButton();
    }

    /**
     * Xử lý sự kiện appinstalled (cài đặt thành công)
     * @param {Event} event - Sự kiện appinstalled
     */
    function handleAppInstalled(event) {
        console.log('🎉 Sự kiện appinstalled đã được kích hoạt');
        console.log('✅ Cài đặt PWA thành công!');

        // Ẩn nút cài đặt
        hideInstallButton();

        // Hiển thị thông báo cài đặt thành công
        showInstallationSuccessMessage();

        // Xóa biến deferredPrompt nếu còn
        deferredPrompt = null;
    }

    /**
     * Hiển thị thông báo cài đặt thành công
     */
    function showInstallationSuccessMessage() {
        // Tạo toast notification
        const toast = document.getElementById('toast-notification');
        const toastMsg = document.getElementById('toast-msg');

        if (toast && toastMsg) {
            toastMsg.textContent = '🎉 Đã cài đặt AI Weather thành công!';
            toast.style.bottom = '20px';
            toast.style.background = 'rgba(79, 172, 254, 0.95)';
            toast.style.color = '#fff';

            // Tự động ẩn sau 4 giây
            setTimeout(() => {
                toast.style.bottom = '-100px';
                setTimeout(() => {
                    toast.style.background = 'rgba(255,255,255,0.9)';
                    toast.style.color = '#0088ff';
                }, 500);
            }, 4000);
        } else {
            // Fallback: Hiển thị alert nếu không có toast
            alert('🎉 Đã cài đặt AI Weather thành công!\n\nBạn có thể tìm app này trên màn hình chính của thiết bị.');
        }

        // Log thông báo chi tiết
        console.log('========================================');
        console.log('🎊 CHÚC MỪNG! PWA ĐÃ ĐƯỢC CÀI ĐẶT THÀNH CÔNG!');
        console.log('========================================');
        console.log('📱 Tìm icon "AI Weather" trên màn hình chính');
        console.log('⚡ App sẽ hoạt động như một ứng dụng native');
        console.log('📴 Có thể sử dụng offline (nếu đã bật Service Worker)');
        console.log('========================================');
    }

    // Thêm event listener cho nút cài đặt
    if (installButton) {
        installButton.addEventListener('click', handleInstallClick);
    }

    // Khởi tạo khi DOM đã sẵn sàng
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPWAInstall);
    } else {
        initPWAInstall();
    }

    // Export các hàm để có thể sử dụng từ bên ngoài (nếu cần)
    window.PWAInstall = {
        showButton: showInstallButton,
        hideButton: hideInstallButton,
        triggerInstall: handleInstallClick,
        isInstallAvailable: function() {
            return deferredPrompt !== null;
        }
    };

})();

