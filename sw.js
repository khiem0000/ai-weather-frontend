/**
 * sw.js - Service Worker cho Web Push Notifications
 * 
 * File này chạy ở background và xử lý:
 * 1. Nhận push events từ server
 * 2. Hiển thị notification trên màn hình
 * 3. Xử lý khi user click vào notification
 */

// ============================================================
// SỰ KIỆN PUSH - NHẬN THÔNG BÁO TỪ SERVER
// ============================================================

/**
 * Sự kiện 'push' được kích hoạt khi:
 * - Server gửi push notification
 * - App đang mở hoặc đã đóng hoàn toàn (background)
 */
self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push event nhận được!', event);
    
    // Lấy dữ liệu từ notification
    let data = {
        title: 'AI Weather',
        body: 'Bạn có thông báo mới',
        icon: '/assets/icon-192.png',
        badge: '/assets/badge-72.png',
        tag: 'default',
        data: {}
    };
    
    // Nếu có dữ liệu từ server, sử dụng dữ liệu đó
    if (event.data) {
        try {
            const payload = event.data.json();
            data = {
                ...data,
                ...payload
            };
            console.log('[Service Worker] Dữ liệu Push:', data);
        } catch (e) {
            console.log('[Service Worker] Dữ liệu Push (text):', event.data.text());
            data.body = event.data.text();
        }
    }
    
    // Cấu hình options cho notification
    const options = {
        body: data.body,
        icon: data.icon || '/assets/icon-192.png',
        badge: data.badge || '/assets/badge-72.png',
        image: data.image || null, // Ảnh thumbnail (VD: thời tiết)
        tag: data.tag || 'default', // Dùng để nhóm notification
        data: data.data || {}, // Dữ liệu custom để xử lý sau
        requireInteraction: data.requireInteraction || false, // Bắt buộc user tương tác
        actions: data.actions || [ // Các nút hành động
            { action: 'open', title: 'Mở App' },
            { action: 'dismiss', title: 'Đóng' }
        ],
        vibrate: [100, 50, 100], // Rung (nếu thiết bị hỗ trợ)
        timestamp: Date.now()
    };
    
    // Hiển thị notification
    event.waitUntil(
        self.registration.showNotification(data.title, options)
            .then(() => {
                console.log('[Service Worker] ✅ Notification đã hiển thị!');
            })
            .catch((error) => {
                console.error('[Service Worker] ❌ Lỗi hiển thị notification:', error);
            })
    );
});

// ============================================================
// SỰ KIỆN NOTIFICATIONCLICK - XỬ LÝ KHI USER CLICK
// ============================================================

/**
 * Sự kiện 'notificationclick' được kích hoạt khi:
 * - User click vào notification
 * - User click vào action button trong notification
 */
self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click!', event);
    
    // Ngăn chặn hành động mặc định
    event.notification.close();
    
    // Lấy action từ event
    const action = event.action;
    console.log('[Service Worker] Action:', action);
    
    // Xử lý theo từng loại action
    if (action === 'dismiss') {
        // User chọn đóng notification - không làm gì cả
        console.log('[Service Worker] User đã đóng notification');
        return;
    }
    
    // Mặc định: Mở app
    // URL mặc định để mở app
    const urlToOpen = '/index.html';
    
    // Kiểm tra xem app đã mở chưa và focus vào tab đó
    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then(function(clientList) {
            // Tìm tab đã mở app
            for (const client of clientList) {
                // Nếu app đã mở, focus vào và navigate đến URL
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    console.log('[Service Worker] Focus vào tab đã mở');
                    
                    // Gửi message cho client (nếu cần truyền dữ liệu)
                    if (event.notification.data) {
                        client.postMessage({
                            type: 'notification-clicked',
                            data: event.notification.data
                        });
                    }
                    
                    return client.focus();
                }
            }
            
            // Nếu app chưa mở, mở tab mới
            console.log('[Service Worker] Mở tab mới');
            return clients.openWindow(urlToOpen);
        })
        .then(function(client) {
            // Gửi message sau khi mở window (nếu cần)
            if (client && event.notification.data) {
                // Đợi một chút để window load xong
                setTimeout(() => {
                    client.postMessage({
                        type: 'notification-clicked',
                        data: event.notification.data
                    });
                }, 1000);
            }
        })
        .catch(function(error) {
            console.error('[Service Worker] ❌ Lỗi khi xử lý click:', error);
        })
    );
});

// ============================================================
// SỰ KIỆN NOTIFICATIONCLOSE - XỬ LÝ KHI USER ĐÓNG NOTIF
// ============================================================

/**
 * Sự kiện 'notificationclose' được kích hoạt khi:
 * - User click X hoặc swipe away notification (không click)
 */
self.addEventListener('notificationclose', function(event) {
    console.log('[Service Worker] Notification đã đóng');
    // Có thể gửi analytics event ở đây nếu cần
});

// ============================================================
// SỰ KIỆN INSTALL - SERVICE WORKER ĐƯỢC CÀI ĐẶT
// ============================================================

self.addEventListener('install', function(event) {
    console.log('[Service Worker] 🔄 Đang cài đặt Service Worker...');
    // Skip waiting để activate ngay lập tức
    self.skipWaiting();
});

// ============================================================
// SỰ KIỆN ACTIVATE - SERVICE WORKER ĐƯỢC KÍCH HOẠT
// ============================================================

self.addEventListener('activate', function(event) {
    console.log('[Service Worker] ✅ Service Worker đã được kích hoạt!');
    // Claim all clients ngay lập tức
    event.waitUntil(clients.claim());
});

// ============================================================
// MESSAGE LISTENER - NHẬN MESSAGE TỪ FRONTEND
// ============================================================

/**
 * Nhận message từ main.js (frontend)
 * Dùng để trigger notification thủ công từ frontend
 */
self.addEventListener('message', function(event) {
    console.log('[Service Worker] Message nhận được:', event.data);
    
    if (event.data && event.data.type === 'show-notification') {
        const { title, body, icon, badge, data } = event.data;
        
        self.registration.showNotification(title, {
            body: body,
            icon: icon || '/assets/icon-192.png',
            badge: badge || '/assets/badge-72.png',
            data: data || {},
            tag: 'manual-push',
            requireInteraction: false
        }).then(() => {
            console.log('[Service Worker] ✅ Manual notification đã hiển thị');
        }).catch((error) => {
            console.error('[Service Worker] ❌ Lỗi manual notification:', error);
        });
    }
});

console.log('[Service Worker] ✅ SW.js đã được load!');

