// =========================================================================
// 1. GLOBAL VARIABLES, i18n DICTIONARY & CONFIGURATIONS
// =========================================================================
const API_KEY = 'd96db3ca494c4a359b8135749260103'; 
const OWM_API_KEY = '9f4ba5569ae9a82d8dbdf44e30e374b9';

// ============================================================
// WEB PUSH NOTIFICATIONS CONFIGURATION
// ============================================================

// VAPID Public Key - Dùng để đăng ký push notification
// LẤY TỪ: node generate-vapid-keys.js (Backend)
// Copy key từ console output và paste vào đây
const VAPID_PUBLIC_KEY = 'BGjg4V_qQS5vUwy3Er937Vl6mGajbivK6E-JgCBWpARQdXYmwgXXpiruHgh8chFwgAxqGYXSxGr93JIXBpcNbb8';

// API Base URL for Push
const PUSH_API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/push';

// Biến lưu trữ service worker registration
let swRegistration = null;

// Biến kiểm tra trạng thái đăng ký push
let isPushEnabled = false;

/**
 * Chuyển đổi VAPID key từ base64 sang Uint8Array
 * @param {string} base64String - Chuỗi base64
 * @returns {Uint8Array} - Mảng uint8
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Đăng ký Service Worker
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker đã đăng ký:', swRegistration);
            
            // Notification state will be restored from applyUserSettings() when page loads
            // Don't check subscription status here - rely on saved settings instead
            
            return swRegistration;
        } catch (error) {
            console.error('❌ Đăng ký Service Worker thất bại:', error);
            return null;
        }
    } else {
        console.warn('⚠️ Trình duyệt không hỗ trợ Service Worker');
        return null;
    }
}


/**
 * Đăng ký Push Notifications
 * Hàm này được gọi khi user bật toggle notification
 * @param {string} notificationType - Loại notification: 'daily' hoặc 'planner'
 * @param {Element} toggleElement - DOM element của toggle button
 */
async function subscribeToPushNotifications(notificationType = 'daily', toggleElement = null) {
    // Lấy message key dựa trên loại notification
    const lang = window.appSettings.language || 'en';
    
    // Map notification type to success message key
    let successKey = 'toast_saved';
    if (notificationType === 'daily') {
        successKey = 'push_daily_enabled';
    } else if (notificationType === 'planner') {
        successKey = 'push_planner_enabled';
    } else if (notificationType === 'severe') {
        successKey = 'push_severe_enabled';
    }
    const errorNoLoginKey = 'push_error_no_login';
    const errorNoSupportKey = 'push_error_no_support';
    const errorPermissionKey = 'push_error_permission';
    const errorFailedKey = 'push_error_failed';
    const errorSwKey = 'push_error_sw';
    
    // Kiểm tra Service Worker support
    if (!swRegistration) {
        swRegistration = await registerServiceWorker();
    }
    
    if (!swRegistration) {
        showToast(i18n[lang][errorSwKey] || i18n[lang].push_error_sw);
        // Revert the toggle if it failed
        if (toggleElement) {
            toggleElement.classList.remove('active');
        }
        return false;
    }
    
    // Kiểm tra PushManager support
    if (!('PushManager' in window)) {
        showToast(i18n[lang][errorNoSupportKey] || i18n[lang].push_error_no_support);
        // Revert the toggle if it failed
        if (toggleElement) {
            toggleElement.classList.remove('active');
        }
        return false;
    }
    
    try {
        // Lấy quyền push từ user
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
            console.warn('⚠️ User từ chối quyền nhận thông báo:', permission);
            showToast(i18n[lang][errorPermissionKey] || i18n[lang].push_error_permission);
            // Revert the toggle if user denied permission
            if (toggleElement) {
                toggleElement.classList.remove('active');
            }
            return false;
        }
        
        console.log('✅ Quyền thông báo đã được cấp');
        
        // Đăng ký push với VAPID public key
        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true, // Bắt buộc phải hiển thị notification
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
        
        console.log('✅ Push subscription thành công!', subscription);
        console.log('📍 Endpoint:', subscription.endpoint);
        
        // Gửi subscription lên server
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.warn('⚠️ User chưa đăng nhập, không thể lưu subscription');
            showToast(i18n[lang][errorNoLoginKey] || i18n[lang].push_error_no_login);
            // Revert the toggle if user not logged in
            if (toggleElement) {
                toggleElement.classList.remove('active');
            }
            return false;
        }
        
        const response = await fetch(`${PUSH_API_BASE_URL}/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                subscription: subscription,
                notificationType: notificationType
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Subscription đã được lưu vào database');
            isPushEnabled = true;
            
            // Lưu trạng thái vào localStorage
            localStorage.setItem('pushEnabled', 'true');
            
            // Lưu subscription key để kiểm tra sau
            localStorage.setItem('pushEndpoint', subscription.endpoint);
            
            // Hiển thị toast thành công với message phù hợp
            showToast(i18n[lang][successKey]);
            return true;
        } else {
            console.error('❌ Lỗi lưu subscription:', result.message);
            showToast(i18n[lang][errorFailedKey] || i18n[lang].push_error_failed);
            // Revert the toggle if save failed
            if (toggleElement) {
                toggleElement.classList.remove('active');
            }
            return false;
        }
        
    } catch (error) {
        console.error('❌ Lỗi đăng ký push:', error);
        
        if (error.name === 'NotAllowedError') {
            showToast(i18n[lang][errorPermissionKey] || i18n[lang].push_error_permission);
        } else if (error.name === 'NotSupportedError') {
            showToast(i18n[lang][errorNoSupportKey] || i18n[lang].push_error_no_support);
        } else {
            showToast(i18n[lang][errorFailedKey] || i18n[lang].push_error_failed);
        }
        
        // Revert the toggle if error occurred
        if (toggleElement) {
            toggleElement.classList.remove('active');
        }
        
        return false;
    }
}

/**
 * Hủy đăng ký Push Notifications
 * Hàm này được gọi khi user tắt toggle notification
 * @param {string} notificationType - Loại notification: 'severe', 'daily', 'planner'
 */
async function unsubscribeFromPush(notificationType = 'daily') {
    if (!swRegistration) {
        console.warn('⚠️ Service Worker chưa được đăng ký');
        return false;
    }
    
    try {
        // Lấy subscription hiện tại
        const subscription = await swRegistration.pushManager.getSubscription();
        
        if (!subscription) {
            console.log('⚠️ Không có subscription để hủy');
            isPushEnabled = false;
            return true;
        }
        
        // Xóa subscription khỏi PushManager
        await subscription.unsubscribe();
        console.log('✅ Đã unsubscribe khỏi PushManager');
        
        // Xóa khỏi database
        const token = localStorage.getItem('token');
        
        if (token) {
            try {
                const response = await fetch(`${PUSH_API_BASE_URL}/unsubscribe`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        endpoint: subscription.endpoint
                    })
                });
                
                const result = await response.json();
                console.log('📡 Server response:', result);
            } catch (apiError) {
                console.warn('⚠️ Không thể xóa subscription từ server:', apiError);
            }
        }
        
        // Cập nhật state
        isPushEnabled = false;
        
        // Xóa khỏi localStorage
        localStorage.setItem('pushEnabled', 'false');
        localStorage.removeItem('pushEndpoint');
        
        // Hiển thị toast thành công với message phù hợp
        const lang = window.appSettings.language || 'en';
        
        // Map notification type to disabled message key
        let disabledKey = 'toast_saved';
        if (notificationType === 'daily') {
            disabledKey = 'push_daily_disabled';
        } else if (notificationType === 'planner') {
            disabledKey = 'push_planner_disabled';
        } else if (notificationType === 'severe') {
            disabledKey = 'push_severe_disabled';
        }
        showToast(i18n[lang][disabledKey] || i18n[lang].toast_saved);
        
        console.log('✅ Đã hủy đăng ký thông báo');
        return true;
        
    } catch (error) {
        console.error('❌ Lỗi hủy đăng ký:', error);
        const lang = window.appSettings.language || 'en';
        showToast(i18n[lang].push_error_failed || i18n[lang].toast_saved);
        return false;
    }
}

/**
 * Toggle Push Notifications
 * Được gọi từ UI toggle button
 */
async function togglePushNotifications() {
    if (isPushEnabled) {
        // Nếu đang bật -> tắt
        const confirmed = confirm('Bạn có muốn tắt thông báo không?');
        if (confirmed) {
            await unsubscribeFromPush();
        }
    } else {
        // Nếu đang tắt -> bật
        await subscribeToPushNotifications();
    }
}

/**
 * Khởi tạo Push Notifications
 * Được gọi khi page load
 */
async function initPushNotifications() {
    console.log('🚀 Khởi tạo Push Notifications...');
    
    // Đăng ký Service Worker
    await registerServiceWorker();
    
    // Lắng nghe sự kiện message từ Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function(event) {
            console.log('📨 Message từ Service Worker:', event.data);
            
            // Xử lý notification click
            if (event.data && event.data.type === 'notification-clicked') {
                handleNotificationClick(event.data.data);
            }
        });
    }
}

/**
 * Xử lý khi user click vào notification
 * @param {Object} data - Dữ liệu từ notification
 */
function handleNotificationClick(data) {
    console.log('👆 Notification clicked with data:', data);
    
    // Xử lý theo loại notification
    if (data) {
        switch (data.type) {
            case 'daily-weather':
                // Chuyển đến tab thời tiết
                if (typeof navigateToTab === 'function') {
                    navigateToTab('weather');
                }
                break;
                
            case 'planner-tasks':
            case 'planner-empty':
                // Chuyển đến tab lịch trình
                if (typeof navigateToTab === 'function') {
                    navigateToTab('planner');
                }
                break;
                
            case 'confirmation':
                // Notification xác nhận, không cần làm gì
                break;
                
            default:
                // Mở app bình thường
                break;
        }
    }
}

// ============================================================
// END WEB PUSH NOTIFICATIONS
// ============================================================

let miniMap, mapMarker; 
let largeMap, largeMapMarker, rainLayer, windLayer, cloudLayer;
window.currentLat = null;
window.currentLon = null;
window.currentWeatherData = null; 
window.lastSearchedQuery = null;  

let aqiChartInst = null;
let sunChartInst = null;
let trendChartInst = null;

// STATE MANAGEMENT FOR TASKS 
window.plannerEvents = {};

// SETTINGS STATE
window.appSettings = {
    tempUnit: 'C', 
    timeFormat: '12h',
    language: 'en'
};

// --- i18n DICTIONARY ---
const i18n = {
    en: {
        nav_weather: "Weather", nav_map: "Satellite Map", nav_stats: "Statistics", nav_planner: "Planner", nav_settings: "Settings", theme_text: "Light/Dark",
        feels_like: "Feels Like", humidity: "Humidity", pressure: "Pressure", uv_index: "UV Index", temperature: "Temperature", next_24h: "Next 24 hours",
        daily_forecast: "Daily Forecast", mini_radar: "Mini Radar", search_placeholder: "Search for weather...",
        map_legend: "Map Legend", current_location: "Current Location", map_desc: "Rain (Colors) & Clouds (White):", map_light: "Light", map_mod: "Moderate", map_heavy: "Heavy",
        deep_analysis: "Deep Analysis / Statistics", guide_btn: "Guide", search_city: "Search city...",
        aqi_title: "Air Quality Index", sun_path: "Sun Path & Astro", sunrise: "Sunrise", sunset: "Sunset", daylight: "Daylight Duration",
        "7day_trend": "7-Day Trend", rain_chance: "Rain Chance",
        home: "Home", cal_planner: "Calendar & Planner", about: "About",
        sun: "SUN", mon: "MON", tue: "TUE", wed: "WED", thu: "THU", fri: "FRI", sat: "SAT",
        selected_date: "Selected Date:", weather_summary: "Weather Summary:", select_date_prompt: "Select a date",
        todays_plan: "Today's Plan:", add_task_ph: "Add new task and press Enter...",
        settings_title: "Settings", settings_sub: "Premium Weather & Planner", search_settings: "Search settings...",
        acc_settings: "Account Settings", member_since: "Member Since: Nov 2025", manage_profile: "Manage Profile",
        subscription: "Subscription", plan_name: "Premium Annual Plan", expires: "Expires: Nov 15, 2026", logout: "Log Out",
        app_prefs: "Application Preferences", lang_title: "Interface Language", lang_desc: "Select your preferred language.",
        temp_title: "Temperature Unit", temp_desc: "Affects all weather displays.", time_title: "Time Format", time_desc: "12-hour (AM/PM) or 24-hour clock.",
        notif_title: "Push Notifications", notif_severe: "Severe Weather Alerts", notif_daily: "Daily Morning Forecast", notif_planner: "Planner Task Reminders",
        edit_profile: "Edit Profile", full_name: "Full Name", cancel: "Cancel", save: "Save", edit_task: "Edit Task", delete_task: "Delete Task",
        delete_confirm: "Are you sure you want to delete this task? This action cannot be undone.", delete: "Delete",
        month_names: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        day_names: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        toast_saved: "Settings saved successfully!",
        notif_no_task: "You have no upcoming events for tomorrow.<br>Enjoy your day!",
        notif_has_task: "You have {N} task(s) scheduled for tomorrow:",
        notif_weather: "Weather Forecast:",
        // Modal titles
        security_login_history: "Security & Login History",
        email_address: "Email Address",
        planner_tasks: "Planner Tasks",
        planner_guide: "Planner Guide",
        chart_guide: "Chart Guide",
        notifications: "Notifications",
        // Planner guide content
        planner_guide_1: "View Weather: Click on any date in the calendar to see the forecast for that specific day.",
        planner_guide_2: "Add Tasks: Type a task in the 'Add new task...' box and press ENTER to save it.",
        planner_guide_3: "Manage Tasks: Check off completed tasks. Hover over a task to Edit or Delete it.",
        planner_guide_4: "Smart Alerts: The bell icon will display a red dot if you have tasks scheduled for tomorrow.",
        planner_guide_5: "Quick Navigation: Click 'Home' to view the yearly calendar and jump directly to any month.",
        // About modal content
        about_version: "Version 1.0.0",
        about_developer: "Developed by: Tran Hoang Khiem",
        about_university: "Nam Can Tho University",
        about_description: "A complete solution combining Real-time Weather API, Advanced Data Visualization, and Personal Planner State Management.",
        about_premium_weather: "Premium Weather",
        about_description_final: "A complete solution combining Real-time Weather API, Advanced Data Visualization, and Personal Planner State Management.",
        // Chart guide content
        chart_aqi_title: "Air Quality Index (AQI)",
        chart_aqi_desc: "The spider chart visualizes harmful pollutants in the air:",
        chart_aqi_pm: "Fine particulate matter.",
        chart_aqi_gases: "Factory and vehicle emissions.",
        chart_aqi_tip: "Tip: The wider the inner shape spreads, the more polluted the air is.",
        chart_sun_title: "Sun Path & Astro",
        chart_sun_desc: "The glowing dot represents the real-time sun position based on the location's timezone.",
        yearly_calendar: "Calendar",
        // Push notification messages
        push_severe_enabled: "Severe weather alerts enabled!",
        push_severe_disabled: "Severe weather alerts disabled.",
        push_daily_enabled: "Daily weather forecast enabled!",
        push_daily_disabled: "Daily weather forecast disabled.",
        push_planner_enabled: "Planner reminders enabled!",
        push_planner_disabled: "Planner reminders disabled.",
        push_error_no_login: "Please login to enable notifications!",
        push_error_no_support: "Browser does not support Push Notifications!",
        push_error_permission: "Please allow notification permission!",
        push_error_failed: "Failed to enable notifications. Please try again!",
        push_error_sw: "Service Worker not available. Please reload the page!"
    },
    vi: {
        nav_weather: "Thời tiết", nav_map: "Bản đồ Vệ tinh", nav_stats: "Thống kê", nav_planner: "Kế hoạch", nav_settings: "Cài đặt", theme_text: "Sáng/Tối",
        feels_like: "Cảm giác như", humidity: "Độ ẩm", pressure: "Áp suất", uv_index: "Chỉ số UV", temperature: "Nhiệt độ", next_24h: "24 giờ tới",
        daily_forecast: "Dự báo hàng ngày", mini_radar: "Radar thu nhỏ", search_placeholder: "Tìm kiếm thời tiết...",
        map_legend: "Chú thích Bản đồ", current_location: "Vị trí hiện tại", map_desc: "Mật độ Mưa (Màu sắc) & Mây (Trắng):", map_light: "Nhẹ", map_mod: "Vừa", map_heavy: "Nặng",
        deep_analysis: "Thống kê Chuyên sâu", guide_btn: "Hướng dẫn", search_city: "Tìm thành phố...",
        aqi_title: "Chỉ số Không khí (AQI)", sun_path: "Quỹ đạo Mặt trời", sunrise: "Bình minh", sunset: "Hoàng hôn", daylight: "Thời lượng Ban ngày",
        "7day_trend": "Xu hướng 7 Ngày", rain_chance: "Khả năng mưa",
        home: "Trang chủ", cal_planner: "Lịch & Kế hoạch", about: "Thông tin",
        sun: "CN", mon: "T2", tue: "T3", wed: "T4", thu: "T5", fri: "T6", sat: "T7",
        selected_date: "Ngày đã chọn:", weather_summary: "Tóm tắt thời tiết:", select_date_prompt: "Hãy chọn một ngày",
        todays_plan: "Kế hoạch hôm nay:", add_task_ph: "Thêm công việc và nhấn Enter...",
        settings_title: "Cài đặt", settings_sub: "Ứng dụng Thời tiết & Kế hoạch", search_settings: "Tìm kiếm cài đặt...",
        acc_settings: "Tài khoản", member_since: "Thành viên từ: Th11 2025", manage_profile: "Quản lý Hồ sơ",
        subscription: "Gói cước", plan_name: "Gói Premium Thường niên", expires: "Hết hạn: 15 Th11, 2026", logout: "Đăng xuất",
        app_prefs: "Tùy chọn Ứng dụng", lang_title: "Ngôn ngữ Giao diện", lang_desc: "Chọn ngôn ngữ hiển thị.",
        temp_title: "Đơn vị Nhiệt độ", temp_desc: "Áp dụng cho mọi hiển thị.", time_title: "Định dạng Thời gian", time_desc: "Đồng hồ 12h hoặc 24h.",
        notif_title: "Thông báo", notif_severe: "Cảnh báo Thời tiết Xấu", notif_daily: "Dự báo Sáng sớm", notif_planner: "Nhắc nhở Công việc",
        edit_profile: "Sửa Hồ sơ", full_name: "Họ và Tên", cancel: "Hủy", save: "Lưu", edit_task: "Sửa Kế hoạch", delete_task: "Xóa Kế hoạch",
        delete_confirm: "Bạn có chắc chắn muốn xóa công việc này? Thao tác không thể hoàn tác.", delete: "Xóa",
        month_names: ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"],
        day_names: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
        toast_saved: "Đã lưu cài đặt thành công!",
        notif_no_task: "Bạn không có lịch trình nào cho ngày mai.<br>Chúc một ngày tốt lành!",
        notif_has_task: "Bạn có {N} công việc cho ngày mai:",
        notif_weather: "Dự báo thời tiết:",
        // Modal titles
        security_login_history: "Bảo mật & Lịch sử Đăng nhập",
        email_address: "Địa chỉ Email",
        planner_tasks: "Công việc Kế hoạch",
        planner_guide: "Hướng dẫn Kế hoạch",
        chart_guide: "Hướng dẫn Biểu đồ",
        notifications: "Thông báo",
        // Planner guide content
        planner_guide_1: "Xem Thời tiết: Nhấp vào bất kỳ ngày nào trong lịch để xem dự báo cho ngày cụ thể đó.",
        planner_guide_2: "Thêm Công việc: Nhập công việc vào ô 'Thêm công việc...' và nhấn ENTER để lưu.",
        planner_guide_3: "Quản lý Công việc: Đánh dấu hoàn thành. Di chuột vào công việc để Sửa hoặc Xóa.",
        planner_guide_4: "Thông minh: Biểu tượng chuông sẽ hiển thị dấu chấm đỏ nếu bạn có công việc cho ngày mai.",
        planner_guide_5: "Điều hướng nhanh: Nhấp 'Trang chủ' để xem lịch năm và nhảy đến bất kỳ tháng nào.",
        // About modal content (Vietnamese)
        about_version: "Phiên bản 1.0.0",
        about_developer: "Phát triển bởi: Trần Hoàng Khiem",
        about_university: "Trường Đại học Nam Cần Thơ",
        about_description: "Giới thiệu: Ứng dụng kết hợp API Thời tiết Real-time, Trực quan hóa Dữ liệu Nâng cao và Quản lý Trạng thái Lịch trình Cá nhân.",
        about_premium_weather: "Thời tiết Premium",
        about_description_final: "Giới thiệu: Ứng dụng kết hợp API Thời tiết Real-time, Trực quan hóa Dữ liệu Nâng cao và Quản lý Trạng thái Lịch trình Cá nhân.",
        // Chart guide content (Vietnamese)
        chart_aqi_title: "Chỉ số Chất lượng Không khí (AQI)",
        chart_aqi_desc: "Biểu đồ radar hiển thị các chất ô nhiễm có hại trong không khí:",
        chart_aqi_pm: "Bụi mịn.",
        chart_aqi_gases: "Khí thải từ nhà máy và phương tiện.",
        chart_aqi_tip: "Mẹo: Hình dạng bên trong càng rộng, không khí càng ô nhiễm.",
        chart_sun_title: "Quỹ đạo Mặt trời & Thiên văn",
        chart_sun_desc: "Điểm sáng biểu diễn vị trí mặt trời thời gian thực dựa trên múi giờ của vị trí.",
        yearly_calendar: "Lịch Năm",
        // Push notification messages
        push_severe_enabled: "Đã bật cảnh báo thời tiết xấu!",
        push_severe_disabled: "Đã tắt cảnh báo thời tiết xấu.",
        push_daily_enabled: "Đã bật dự báo thời tiết hàng ngày!",
        push_daily_disabled: "Đã tắt dự báo thời tiết hàng ngày.",
        push_planner_enabled: "Đã bật nhắc nhở lịch trình!",
        push_planner_disabled: "Đã tắt nhắc nhở lịch trình.",
        push_error_no_login: "Vui lòng đăng nhập để bật thông báo!",
        push_error_no_support: "Trình duyệt không hỗ trợ Push Notifications!",
        push_error_permission: "Vui lòng cho phép quyền thông báo!",
        push_error_failed: "Bật thông báo thất bại. Vui lòng thử lại!",
        push_error_sw: "Service Worker không khả dụng. Vui lòng tải lại trang!"
    }
};

function translateApp(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) el.innerHTML = i18n[lang][key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (i18n[lang][key]) el.placeholder = i18n[lang][key];
    });
    if (window.currentWeatherData) {
        reRenderWeatherUI();
        if(isPlannerInitialized) generateLightCalendar();
    }
}

Chart.defaults.color = '#FFFFFF';
Chart.defaults.font.family = "'Inter', sans-serif";
if (typeof ChartDataLabels !== 'undefined') { Chart.register(ChartDataLabels); Chart.defaults.plugins.datalabels = { display: false }; }

function removeVietnameseTones(str) {
    if (!str) return "";
    str = str.replace(/đ/g, "d"); str = str.replace(/Đ/g, "D");
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    str = str.replace(/[^\x00-\x7F]/g, ""); 
    return str;
}

function getDayName(dateString) {
    const dayIndex = new Date(dateString).getDay();
    return i18n[window.appSettings.language].day_names[dayIndex];
}

function safeParseTime(timeStr) {
    try {
        const [time, period] = timeStr.trim().split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (period && period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (period && period.toUpperCase() === 'AM' && hours === 12) hours = 0;
        return { hours, minutes };
    } catch(e) {
        return { hours: 0, minutes: 0 };
    }
}

function calculateDaylightDuration(sunrise, sunset) {
    if (!sunrise || !sunset) return "-- hr -- min";
    try {
        const sr = safeParseTime(sunrise);
        const ss = safeParseTime(sunset);
        let durationMinutes = (ss.hours * 60 + ss.minutes) - (sr.hours * 60 + sr.minutes);
        if (durationMinutes < 0) durationMinutes += 24 * 60; 
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return `${hours} hr ${minutes} min`;
    } catch(e) { return "-- hr -- min"; }
}

function getSunProgress(sunriseStr, sunsetStr, currentHour, currentMinute) {
    if (!sunriseStr || !sunsetStr) return 0;
    try {
        const sr = safeParseTime(sunriseStr);
        const ss = safeParseTime(sunsetStr);
        const sunriseMins = sr.hours * 60 + sr.minutes;
        const sunsetMins = ss.hours * 60 + ss.minutes;
        const currentMins = currentHour * 60 + currentMinute;
        if (currentMins <= sunriseMins) return 0;
        if (currentMins >= sunsetMins) return 100;
        return ((currentMins - sunriseMins) / (sunsetMins - sunriseMins)) * 100;
    } catch(e) { return 0; }
}

function updateLastUpdatedTime() {
    const timeElement = document.getElementById('last-updated-time');
    if (timeElement) {
        const now = new Date();
        const prefix = window.appSettings.language === 'vi' ? 'Cập nhật: ' : 'Last Updated: ';
        timeElement.innerText = `${prefix}${now.toLocaleTimeString('en-US', {hour12: window.appSettings.timeFormat === '12h'})}`;
    }
}

function getOrdinal(n) {
    if(window.appSettings.language === 'vi') return ""; 
    if (isNaN(n)) return "";
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th"; }
}

function showToast(msg = null) {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-msg');
    if(toast && msgEl) {
        msgEl.innerText = msg || i18n[window.appSettings.language].toast_saved;
        toast.style.bottom = '30px';
        setTimeout(() => { toast.style.bottom = '-100px'; }, 3000);
    }
}

// =========================================================================
// 3. TAB NAVIGATION
// =========================================================================
function initTabs() {
    console.log('initTabs called - showing weather view');
    document.getElementById('main-weather-section').style.display = 'flex';
    document.getElementById('right-widgets-section').style.display = 'flex';
    document.getElementById('satellite-view').style.display = 'none';
    document.getElementById('statistics-view').style.display = 'none';
    document.getElementById('planner-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'none';
}

const menuItems = document.querySelectorAll('.menu-item');
const mainWeather = document.getElementById('main-weather-section');
const rightWidgets = document.getElementById('right-widgets-section');
const satelliteView = document.getElementById('satellite-view');
const statsView = document.getElementById('statistics-view');
const plannerView = document.getElementById('planner-view');

menuItems.forEach((item, index) => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        menuItems.forEach(m => m.classList.remove('active'));
        this.classList.add('active');

        mainWeather.style.display = 'none'; rightWidgets.style.display = 'none';
        satelliteView.style.display = 'none'; statsView.style.display = 'none';
        plannerView.style.display = 'none'; document.getElementById('settings-view').style.display = 'none';

        if (index === 0) { mainWeather.style.display = 'flex'; rightWidgets.style.display = 'flex'; } 
        else if (index === 1) { satelliteView.style.display = 'block'; if (window.currentLat && window.currentLon) loadCleanSatelliteMap(window.currentLat, window.currentLon); }
        else if (index === 2) { statsView.style.display = 'flex'; if (window.currentWeatherData) setTimeout(() => { drawStatistics(window.currentWeatherData); }, 50); }
        else if (index === 3) { plannerView.style.display = 'flex'; initPlannerView(); }
        else if (index === 4) { document.getElementById('settings-view').style.display = 'flex'; }
    });
});

// =========================================================================
// 4. WEATHER API FETCHING
// =========================================================================
async function fetchWeatherData(query) {
    console.log('fetchWeatherData called with query:', query);
    const startTime = Date.now(); // 1. BẮT ĐẦU BẤM GIỜ
    
    try {
        const safeQuery = encodeURIComponent(removeVietnameseTones(query));
        const langParam = window.appSettings.language; 
        const response = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${safeQuery}&days=7&aqi=yes&lang=${langParam}`);
        
        const responseTime = Date.now() - startTime; // Dừng bấm giờ

        if (!response.ok) {
            // Báo cáo lỗi (Dùng query cũ vì chưa có data)
            if (typeof reportApiLog === 'function') {
                reportApiLog('WeatherAPI', response.status, responseTime, query, "Lỗi từ API");
            }
            return;
        }

// 1. ĐỌC DỮ LIỆU JSON TRƯỚC
        // 1. ĐỌC DỮ LIỆU JSON TRƯỚC
        const data = await response.json();
        window.currentWeatherData = data; 
        
        // 2. LỌC TÊN THÀNH PHỐ CHUẨN (Khắc phục lỗi hiện Ấp/Xã)
        let realCityName = data.location.name;
        // Nếu API trả về Tỉnh/Thành phố trong cột "region" (VD: region = "Can Tho", name = "Ap Binh Thuong")
        if (data.location.region && data.location.region !== "") {
            realCityName = data.location.region;
        }

        window.lastSearchedQuery = realCityName; 

        // 3. NẾU ĐANG DÙNG GPS -> CẬP NHẬT LÀM QUÊ QUÁN
        if (window.isUpdatingHomeCity) {
            window.appSettings.city = realCityName;
            window.isUpdatingHomeCity = false; // Tắt cờ
            if (typeof saveCurrentUserSettings === 'function') saveCurrentUserSettings(); // Lưu thẳng lên SQL
        }

        // 4. BÁO CÁO THÀNH CÔNG VỀ SQL
        if (typeof reportApiLog === 'function') {
            reportApiLog('WeatherAPI', 200, responseTime, realCityName);
        }
        
        updateLastUpdatedTime();
        
        updateLastUpdatedTime();
        const isF = window.appSettings.tempUnit === 'F';

        document.getElementById('current-temp').innerText = Math.round(isF ? data.current.temp_f : data.current.temp_c) + '°' + (isF ? 'F' : 'C');
        document.getElementById('feels-like').innerText = Math.round(isF ? data.current.feelslike_f : data.current.feelslike_c) + '°';
        document.getElementById('humidity').innerText = data.current.humidity + '%';
        document.getElementById('pressure').innerHTML = data.current.pressure_mb + ' <small>hPa</small>';
        
        let uv = data.current.uv;
        let uvText = (uv <= 2) ? "Low" : (uv <= 5) ? "Moderate" : (uv <= 7) ? "High" : (uv <= 10) ? "Very High" : "Extreme";
        document.getElementById('uv-index').innerHTML = uv + ` <small>(${uvText})</small>`;
        document.querySelector('.main-card-visual').innerHTML = `<img src="https:${data.current.condition.icon.replace("64x64", "128x128")}" style="width: 180px; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5));">`;

        const forecastList = document.querySelector('.forecast-list');
        forecastList.innerHTML = ''; 
        const todayText = window.appSettings.language === 'vi' ? 'Hôm nay' : 'Today';

        data.forecast.forecastday.forEach((dayObj, index) => {
            let dayName = (index === 0) ? todayText : getDayName(dayObj.date);
            let activeClass = (index === 0) ? 'active-row fw-bold' : '';
            let arrowRotate = (index === 0) ? 'transform: rotate(180deg);' : '';
            let detailStyle = (index === 0) ? 'max-height: 50px; opacity: 1; padding: 10px 15px;' : 'max-height: 0; opacity: 0; padding: 0 15px;';
            const maxT = Math.round(isF ? dayObj.day.maxtemp_f : dayObj.day.maxtemp_c);
            const minT = Math.round(isF ? dayObj.day.mintemp_f : dayObj.day.mintemp_c);

            forecastList.innerHTML += `
                <div class="forecast-item" style="cursor: pointer; margin-bottom: 5px;">
                    <div class="forecast-row ${activeClass}" style="position: relative; z-index: 2; margin-bottom: 0;">
                        <span class="f-day">${dayName}</span>
                        <img src="https:${dayObj.day.condition.icon}" style="width: 35px;">
                        <div class="f-stats">
                            <span class="f-rain"><i class="fas fa-droplet text-blue"></i> ${dayObj.day.daily_chance_of_rain}%</span>
                            <span class="f-sun"><i class="fas fa-temperature-half text-yellow"></i> ${maxT}° / ${minT}°</span>
                            <i class="fas fa-chevron-down text-muted f-arrow" style="transition: 0.3s; margin-left: 10px; ${arrowRotate}"></i> 
                        </div>
                    </div>
                    <div class="forecast-details" style="transition: 0.3s all ease; overflow: hidden; font-size: 11px; background: rgba(0,0,0,0.15); border-radius: 0 0 12px 12px; margin-top: -10px; position: relative; z-index: 1; ${detailStyle}">
                        <div style="display: flex; justify-content: space-between; padding-top: 10px; color: var(--text-muted);">
                            <span><i class="fas fa-wind"></i> ${dayObj.day.maxwind_kph} km/h</span>
                            <span><i class="fas fa-sun"></i> UV: ${dayObj.day.uv}</span>
                            <span><i class="fas fa-tint"></i> Hum: ${dayObj.day.avghumidity}%</span>
                        </div>
                    </div>
                </div>`;
        });

        const temps = [0, 4, 8, 12, 16, 20, 23].map(h => isF ? data.forecast.forecastday[0].hour[h].temp_f : data.forecast.forecastday[0].hour[h].temp_c);
        const maxTemp = Math.max(...temps), minTemp = Math.min(...temps);
        const xCoords = [0, 50, 100, 150, 200, 250, 300];
        const yCoords = temps.map(t => (maxTemp === minTemp) ? 50 : 80 - ((t - minTemp) / (maxTemp - minTemp)) * 60);
        let linePath = `M ${xCoords[0]} ${yCoords[0]} `;
        for (let i = 1; i < 7; i++) linePath += `C ${xCoords[i-1] + 25} ${yCoords[i-1]}, ${xCoords[i] - 25} ${yCoords[i]}, ${xCoords[i]} ${yCoords[i]} `;
        document.getElementById('chart-line').setAttribute('d', linePath);
        document.getElementById('chart-area').setAttribute('d', linePath + ` L 300 100 L 0 100 Z`);
        
        const hour = new Date().getHours(); 
        const curTempAtHour = isF ? data.forecast.forecastday[0].hour[hour].temp_f : data.forecast.forecastday[0].hour[hour].temp_c;
        document.getElementById('chart-dot').setAttribute('cx', (hour / 24) * 300);
        document.getElementById('chart-dot').setAttribute('cy', (maxTemp === minTemp) ? 50 : 80 - ((curTempAtHour - minTemp) / (maxTemp - minTemp)) * 60);
        document.getElementById('chart-dot').setAttribute('r', '5');

        window.currentLat = data.location.lat;
        window.currentLon = data.location.lon;
        
        if (!miniMap) {
            miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView([window.currentLat, window.currentLon], 10);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, className: 'base-map-layer' }).addTo(miniMap);
            mapMarker = L.circleMarker([window.currentLat, window.currentLon], { radius: 8, color: '#4facfe', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }).addTo(miniMap);
            setTimeout(() => { miniMap.invalidateSize(); }, 300);
        } else {
            miniMap.flyTo([window.currentLat, window.currentLon], 10, { duration: 1.5 });
            mapMarker.setLatLng([window.currentLat, window.currentLon]);
        }

        if (document.getElementById('satellite-view').style.display === 'block') loadCleanSatelliteMap(window.currentLat, window.currentLon);
        if (document.getElementById('statistics-view').style.display === 'flex') drawStatistics(data);
        if (document.getElementById('planner-view').style.display === 'flex') { if(isPlannerInitialized) generateLightCalendar(); }

        checkSmartNotifications();

    } catch (err) { 
        console.error("Fetch Error:", err); 
        // BÁO CÁO LỖI MẠNG
        if (typeof reportApiLog === 'function') {
            reportApiLog('WeatherAPI', 500, Date.now() - startTime, query, err.message);
        }
    }
}

// =========================================================================
// 5. SATELLITE MAP LOGIC (RainViewer v8 + OWM Clouds)
// =========================================================================
function loadCleanSatelliteMap(lat, lon) {
    if (!largeMap) {
        largeMap = L.map('large-map', { zoomControl: true, attributionControl: false }).setView([lat, lon], 6);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, className: 'base-map-layer' }).addTo(largeMap);
        largeMapMarker = L.circleMarker([lat, lon], { radius: 8, color: '#4facfe', weight: 3, fillColor: '#ffffff', fillOpacity: 1 }).addTo(largeMap);
        
        if (OWM_API_KEY) {
            cloudLayer = L.tileLayer(`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { opacity: 0.7, zIndex: 6 }).addTo(largeMap);
        }
        
        fetch('https://api.rainviewer.com/public/api/v8/weather-maps.json')
        .then(res => res.json())
        .then(data => {
            if (data.radar && data.radar.past && data.radar.past.length > 0) {
                const path = data.radar.past[data.radar.past.length - 1].path;
                rainLayer = L.tileLayer(`${data.host}${path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.85, zIndex: 10, maxNativeZoom: 12, maxZoom: 19 }).addTo(largeMap);
            }
        }).catch(e => console.error("RainViewer Radar error:", e));

    } else {
        largeMap.flyTo([lat, lon], 6, { duration: 1.5 });
        largeMapMarker.setLatLng([lat, lon]);
    }
    setTimeout(() => { largeMap.invalidateSize(); }, 300);
}

// =========================================================================
// 6. DEEP ANALYSIS (PREMIUM LIGHT GLASSMORPHISM CHART.JS)
// =========================================================================
function drawStatistics(data) {
    if(!data) return;
    
    try {
        const cleanCityName = removeVietnameseTones(data.location.name);
        const cleanRegionName = removeVietnameseTones(data.location.region);
        let displayLocation = cleanCityName;
        if(cleanRegionName && cleanRegionName !== cleanCityName) displayLocation += `, ${cleanRegionName}`;
        else displayLocation += `, ${removeVietnameseTones(data.location.country)}`;
        
        if (document.getElementById('stat-city-name')) document.getElementById('stat-city-name').innerText = displayLocation;
        if (document.getElementById('stat-search-display')) document.getElementById('stat-search-display').innerText = cleanCityName;

        const aqi = data.current.air_quality || { pm2_5: 0, pm10: 0, o3: 0, no2: 0, co: 0, so2: 0 };
        const aqiMainValue = Math.round((aqi.pm2_5 || 0) * 10) / 10;
        let aqiText = "GOOD"; let aqiColor = "#4ade80"; 
        if(aqiMainValue > 12) { aqiText = "MODERATE"; aqiColor = "#facc15"; }
        if(aqiMainValue > 35) { aqiText = "UNHEALTHY"; aqiColor = "#fb923c"; } 
        if(aqiMainValue > 55) { aqiText = "HAZARDOUS"; aqiColor = "#f87171"; }
        
        if (document.getElementById('aqi-value') && document.getElementById('aqi-status')) {
            document.getElementById('aqi-value').innerText = aqiMainValue;
            document.getElementById('aqi-status').innerText = aqiText;
            document.getElementById('aqi-value').style.color = aqiColor;
            document.getElementById('aqi-status').style.color = aqiColor;
        }

        if(aqiChartInst) aqiChartInst.destroy();
        const ctxAqiEl = document.getElementById('aqiChart');
        if (ctxAqiEl && typeof Chart !== 'undefined') {
            aqiChartInst = new Chart(ctxAqiEl.getContext('2d'), {
                type: 'radar',
                data: { labels: ['PM2.5', 'PM10', 'O3', 'NO2', 'CO'], datasets: [{ data: [aqi.pm2_5 || 0, aqi.pm10 || 0, aqi.o3 || 0, aqi.no2 || 0, (aqi.co || 0)/100], backgroundColor: 'rgba(168, 192, 255, 0.4)', borderColor: '#ffffff', pointBackgroundColor: '#ffffff', borderWidth: 1.5, fill: true }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: {enabled: false}, datalabels: { display: false } }, scales: { r: { angleLines: { color: 'rgba(255, 255, 255, 0.2)' }, grid: { color: 'rgba(255, 255, 255, 0.2)', circular: true }, pointLabels: { color: '#FFFFFF', font: { size: 10 } }, ticks: { display: false } }} }
            });
        }

        const astro = data.forecast.forecastday[0].astro;
        const localTimeStr = data.location.localtime; 
        
        function convertAstroTime(t) {
            if (!t) return "--:--";
            if (window.appSettings.timeFormat === '12h') return t;
            try {
                let parts = t.trim().split(' ');
                let [h, m] = parts[0].split(':');
                h = parseInt(h, 10);
                if (parts[1] && parts[1].toUpperCase() === 'PM' && h !== 12) h += 12;
                if (parts[1] && parts[1].toUpperCase() === 'AM' && h === 12) h = 0;
                return `${String(h).padStart(2, '0')}:${m}`; 
            } catch(e) { return t; }
        }

        if (document.getElementById('stat-sunrise')) document.getElementById('stat-sunrise').innerText = convertAstroTime(astro.sunrise);
        if (document.getElementById('stat-sunset')) document.getElementById('stat-sunset').innerText = convertAstroTime(astro.sunset);
        
        const daylightStr = calculateDaylightDuration(astro.sunrise, astro.sunset);
        const finalDaylight = window.appSettings.language === 'vi' ? daylightStr.replace('hr', 'giờ').replace('min', 'phút') : daylightStr;
        if (document.getElementById('stat-daylight-sub')) document.getElementById('stat-daylight-sub').innerText = finalDaylight; 

        if(sunChartInst) sunChartInst.destroy();
        const ctxSunEl = document.getElementById('sunChart');
        if (ctxSunEl && typeof Chart !== 'undefined') {
            const ctxSun = ctxSunEl.getContext('2d');
            let sunGradient = ctxSun.createLinearGradient(0, 0, 300, 0);
            sunGradient.addColorStop(0, 'rgba(128, 255, 255, 0.8)'); sunGradient.addColorStop(1, '#fdfd96'); 
            sunChartInst = new Chart(ctxSun, {
                type: 'doughnut', data: { datasets: [{ data: [0, 100], backgroundColor: [sunGradient, 'rgba(255, 255, 255, 0.1)'], borderWidth: 0, borderRadius: 20 }]},
                options: { responsive: true, maintainAspectRatio: false, rotation: 270, circumference: 180, cutout: '88%', animation: { animateScale: true, animateRotate: true, duration: 1500 }, plugins: { tooltip: { enabled: false }, datalabels: { display: false } }, layout: { padding: { top: 20, bottom: -20, left: 20, right: 20 } } },
                plugins: [{
                    id: 'sunIcon', afterDraw: (chart) => {
                        const meta = chart.getDatasetMeta(0); if (!meta.data.length) return;
                        const arc = meta.data[0]; const currentProgress = chart.data.datasets[0].data[0];
                        if(currentProgress <= 0 || currentProgress >= 100) return; if(arc.endAngle === arc.startAngle) return; 
                        const angle = arc.endAngle; const r = (arc.outerRadius + arc.innerRadius) / 2; const x = arc.x + r * Math.cos(angle); const y = arc.y + r * Math.sin(angle);
                        const ctx = chart.ctx; ctx.save(); ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.fillStyle = '#fdfd96'; ctx.shadowColor = 'rgba(253, 253, 150, 0.8)'; ctx.shadowBlur = 10; ctx.fill(); ctx.restore();
                    }
                }]
            });
        }

        if(window.liveClockInterval) clearInterval(window.liveClockInterval);
        
        const timePart = localTimeStr.includes(' ') ? localTimeStr.split(' ')[1] : "00:00"; 
        let [currentH, currentM] = timePart.split(':').map(Number); 
        currentH = currentH || 0; currentM = currentM || 0;

        function formatAndDisplayTime(h, m) {
            const curTimeEl = document.getElementById('stat-current-time');
            if (!curTimeEl) return;
            if (window.appSettings.timeFormat === '12h') {
                const ampm = h >= 12 ? 'PM' : 'AM'; let displayH = h % 12; displayH = displayH ? displayH : 12;
                curTimeEl.innerText = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
            } else {
                curTimeEl.innerText = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
        }

        function updateLiveSun() {
            formatAndDisplayTime(currentH, currentM);
            const newProgress = getSunProgress(astro.sunrise, astro.sunset, currentH, currentM);
            if (sunChartInst && sunChartInst.data.datasets[0].data[0] !== newProgress) { sunChartInst.data.datasets[0].data = [newProgress, 100 - newProgress]; sunChartInst.update(); }
            currentM++; if (currentM >= 60) { currentM = 0; currentH++; if (currentH >= 24) currentH = 0; }
        }

        formatAndDisplayTime(currentH, currentM);
        setTimeout(() => {
            const newProgress = getSunProgress(astro.sunrise, astro.sunset, currentH, currentM);
            if (sunChartInst) { sunChartInst.data.datasets[0].data = [newProgress, 100 - newProgress]; sunChartInst.update(); }
            currentM++; if (currentM >= 60) { currentM = 0; currentH++; if(currentH >= 24) currentH = 0; }
            window.liveClockInterval = setInterval(updateLiveSun, 60000); 
        }, 300);

        const forecastDays = data.forecast.forecastday;
        const isF = window.appSettings.tempUnit === 'F';
        const labelsDay = forecastDays.map(d => getDayName(d.date).substring(0,3).toUpperCase());
        const maxTemps = forecastDays.map(d => isF ? (d.day.maxtemp_f || 0) : (d.day.maxtemp_c || 0));
        const minTemps = forecastDays.map(d => isF ? (d.day.mintemp_f || 0) : (d.day.mintemp_c || 0));
        const rainChances = forecastDays.map(d => d.day.daily_chance_of_rain || 0);

        if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
        if(trendChartInst) trendChartInst.destroy();
        
        const ctxTrendEl = document.getElementById('trendChart');
        if (ctxTrendEl && typeof Chart !== 'undefined') {
            trendChartInst = new Chart(ctxTrendEl.getContext('2d'), {
                type: 'line', 
                data: { labels: labelsDay, datasets: [
                    { type: 'bar', label: 'Rain %', data: rainChances, backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.3)', borderWidth: 1, borderRadius: {topLeft: 6, topRight: 6}, borderSkipped: false, yAxisID: 'y1', barPercentage: 0.6, minBarLength: 12, datalabels: { display: true, align: 'bottom', anchor: 'start', offset: -5, color: 'rgba(255,255,255,0.8)', font: { size: 10, weight: '600' }, formatter: (value) => value + '%' } },
                    { type: 'line', label: 'Max', data: maxTemps, borderColor: '#FFB380', borderWidth: 2, tension: 0.4, pointBackgroundColor: '#FFFFFF', pointBorderColor: '#FFB380', pointRadius: 4, pointBorderWidth: 2, yAxisID: 'y', datalabels: { display: true, align: 'top', offset: 5, color: '#FFFFFF', font: { weight: 'bold', size: 11 }, formatter: (value) => value + '°' } },
                    { type: 'line', label: 'Min', data: minTemps, borderColor: '#80FFFF', borderDash: [5, 5], borderWidth: 2, tension: 0.4, pointBackgroundColor: '#FFFFFF', pointBorderColor: '#80FFFF', pointRadius: 4, pointBorderWidth: 2, yAxisID: 'y', datalabels: { display: true, align: 'bottom', offset: 5, color: '#FFFFFF', font: { weight: 'bold', size: 11 }, formatter: (value) => value + '°' } }
                ]},
                options: { 
                    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, 
                    layout: { padding: { top: 30, bottom: 40, left: 10, right: 10 } }, 
                    plugins: { legend: { display: false } }, 
                    scales: { 
                        x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.9)', font: { size: 11, family: "'Inter', sans-serif", weight: '600' }, padding: 10 } }, 
                        y: { display: false, min: Math.min(...minTemps) - 5, max: Math.max(...maxTemps) + 10 }, 
                        y1: { display: false, min: 0, max: 100 } 
                    } 
                }
            });
        }
    } catch (e) { console.error("Render Statistics Failed:", e); }
}

// =========================================================================
// 7. SEARCH & ACCORDION (ROBUST FIX)
// =========================================================================

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-section')) {
        const sd = document.querySelector('.search-dropdown');
        if (sd) sd.classList.remove('show');
    }
    if (!e.target.closest('#stat-search-input') && !e.target.closest('#stat-search-dropdown')) {
        const ssd = document.getElementById('stat-search-dropdown');
        if (ssd) ssd.classList.remove('show');
    }
});

const searchInput = document.getElementById('search-input');
const searchDropdown = document.querySelector('.search-dropdown');
const searchBtn = document.querySelector('.search-btn'); 
let searchTimeout; 

if(searchInput && searchDropdown) {
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout); let q = this.value.trim(); 
        if (q.length < 2) { searchDropdown.classList.remove('show'); return; }
        
        searchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(removeVietnameseTones(q))}`);
                if (!res.ok) throw new Error("Search API failed");
                const locs = await res.json(); 
                searchDropdown.innerHTML = '';
                if (locs.length > 0) {
                    locs.forEach(l => {
                        let div = document.createElement('div'); 
                        div.className = 'dropdown-item'; 
                        div.innerHTML = `<i class="fas fa-location-dot"></i> ${removeVietnameseTones(l.name)}, ${removeVietnameseTones(l.country)}`;
                        div.onclick = () => { 
                            searchInput.value = l.name; 
                            searchDropdown.classList.remove('show'); 
                            fetchWeatherData(l.name); 
                        };
                        searchDropdown.appendChild(div);
                    });
                } else {
                    const notFoundTxt = window.appSettings.language === 'vi' ? 'Không tìm thấy...' : 'Not found...';
                    searchDropdown.innerHTML = `<div class="dropdown-item muted">${notFoundTxt}</div>`;
                }
                searchDropdown.classList.add('show');
            } catch(e) { console.error("Search Error:", e); }
        }, 300); 
    });

    searchInput.addEventListener('keypress', e => { 
        if (e.key === 'Enter' && searchInput.value.trim() !== "") { 
            fetchWeatherData(searchInput.value); 
            searchDropdown.classList.remove('show'); 
            searchInput.blur(); 
        }
    });

    if(searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (searchInput.value.trim() !== "") {
                fetchWeatherData(searchInput.value.trim());
                searchDropdown.classList.remove('show'); 
            }
        });
    }
}

const statSearchInput = document.getElementById('stat-search-input');
const statSearchDropdown = document.getElementById('stat-search-dropdown');
let statSearchTimeout;

if(statSearchInput && statSearchDropdown) {
    statSearchInput.addEventListener('input', function() {
        clearTimeout(statSearchTimeout); let q = this.value.trim(); 
        if (q.length < 2) { statSearchDropdown.classList.remove('show'); return; }
        
        statSearchTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(removeVietnameseTones(q))}`);
                if (!res.ok) throw new Error("Search API failed");
                const locs = await res.json(); 
                statSearchDropdown.innerHTML = '';
                if (locs.length > 0) {
                    locs.forEach(l => {
                        let div = document.createElement('div'); 
                        div.className = 'dropdown-item'; 
                        div.style.color = "#333"; 
                        div.innerHTML = `<i class="fas fa-location-dot"></i> ${removeVietnameseTones(l.name)}, ${removeVietnameseTones(l.country)}`;
                        div.onclick = () => { 
                            statSearchInput.value = ""; 
                            statSearchDropdown.classList.remove('show'); 
                            fetchWeatherData(l.name); 
                        };
                        statSearchDropdown.appendChild(div);
                    });
                } else {
                    const notFoundTxt = window.appSettings.language === 'vi' ? 'Không tìm thấy...' : 'Not found...';
                    statSearchDropdown.innerHTML = `<div class="dropdown-item muted" style="color: #666;">${notFoundTxt}</div>`;
                }
                statSearchDropdown.classList.add('show');
            } catch(e) { console.error("Search Error:", e); }
        }, 300); 
    });

    statSearchInput.addEventListener('keypress', e => { 
        if (e.key === 'Enter' && statSearchInput.value.trim() !== "") { 
            fetchWeatherData(statSearchInput.value); 
            statSearchDropdown.classList.remove('show'); 
            statSearchInput.blur(); 
            statSearchInput.value = ""; 
        }
    });
}

// Khởi tạo các event Accordion
const forecastListEl = document.querySelector('.forecast-list');
if(forecastListEl) {
    forecastListEl.addEventListener('click', function(e) {
        const row = e.target.closest('.forecast-row'); if (!row) return;
        document.querySelectorAll('.forecast-row').forEach(r => { if (r !== row) { r.classList.remove('active-row', 'fw-bold'); r.querySelector('.f-arrow').style.transform = 'rotate(0deg)'; r.nextElementSibling.style.maxHeight = '0'; r.nextElementSibling.style.opacity = '0'; r.nextElementSibling.style.padding = '0 15px'; }});
        row.classList.toggle('active-row'); row.classList.toggle('fw-bold');
        const arrow = row.querySelector('.f-arrow'), details = row.nextElementSibling;
        if (row.classList.contains('active-row')) { arrow.style.transform = 'rotate(180deg)'; details.style.maxHeight = '50px'; details.style.opacity = '1'; details.style.padding = '10px 15px'; } else { arrow.style.transform = 'rotate(0deg)'; details.style.maxHeight = '0'; details.style.opacity = '0'; details.style.padding = '0 15px'; }
    });
}

const togglePillEl = document.querySelector('.toggle-pill');
if (togglePillEl) {
    togglePillEl.addEventListener('click', () => {
        document.body.classList.toggle('light-theme'); document.querySelectorAll('.toggle-pill i').forEach(i => i.classList.toggle('active-icon'));
        Chart.defaults.color = document.body.classList.contains('light-theme') ? '#2F3542' : '#FFFFFF';
        if(window.currentWeatherData && document.getElementById('statistics-view').style.display === 'flex') drawStatistics(window.currentWeatherData);
    });
}

// QUẢN LÝ EVENT CLICK GLOBAL (BẬT/TẮT MODAL)
document.addEventListener('click', function(e) {
    // Mở Modal
    if (e.target.closest('#open-stat-info')) { document.getElementById('stat-info-modal')?.classList.add('show'); return; }
    if (e.target.closest('#nav-btn-info')) { document.getElementById('info-modal')?.classList.add('show'); return; }
    if (e.target.closest('#nav-link-about')) { document.getElementById('about-modal')?.classList.add('show'); return; }
    if (e.target.closest('#nav-btn-bell')) { 
        const mod = document.getElementById('notification-modal'); const cnt = document.getElementById('notification-content');
        if(mod && cnt) { cnt.innerHTML = tomorrowNotificationMsgHTML; mod.classList.add('show'); } return;
    }
    if (e.target.closest('#nav-btn-menu')) { document.getElementById('all-tasks-modal')?.classList.add('show'); return; }
    if (e.target.closest('#nav-link-home')) { document.getElementById('yearly-calendar-modal')?.classList.add('show'); return; }
    if (e.target.closest('#open-edit-profile')) { document.getElementById('edit-profile-modal')?.classList.add('show'); return; }
    if (e.target.closest('#settings-bell-btn')) { 
        loadLoginHistory(); // Load real login history
        document.getElementById('login-history-modal')?.classList.add('show'); 
        return; 
    }

    // Đóng Modal khi bấm X hoặc Cancel
    if (e.target.closest('.close-custom-modal') || e.target.id === 'cancel-edit-btn' || e.target.id === 'cancel-delete-btn' || e.target.id === 'cancel-profile-btn') { 
        const modal = e.target.closest('.modal-overlay'); if(modal) modal.classList.remove('show'); return; 
    }
    // Đóng Modal khi bấm ra ngoài viền đen
    if (e.target.classList.contains('modal-overlay')) { e.target.classList.remove('show'); }
});


// =========================================================================
// 8. PLANNER CALENDAR & STATE MANAGEMENT
// =========================================================================
let plannerViewDate = new Date(); 
let selectedDateString = ""; 
let isPlannerInitialized = false; 

let activeEditingTaskId = null;
let activeDeletingTaskId = null;

function initPlannerView() {
    if (isPlannerInitialized) { generateLightCalendar(); return; }

    const prevBtn = document.getElementById('prev-month-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => { plannerViewDate.setMonth(plannerViewDate.getMonth() - 1); generateLightCalendar(); });
    
    const nextBtn = document.getElementById('next-month-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => { plannerViewDate.setMonth(plannerViewDate.getMonth() + 1); generateLightCalendar(); });
    
    const taskInput = document.getElementById('new-task-input');
    if (taskInput) {
        taskInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && this.value.trim() !== "") { addNewTask(this.value.trim()); this.value = ''; }
        });
    }

    const taskListContainer = document.getElementById('task-list-container');
    if (taskListContainer) {
        taskListContainer.addEventListener('change', function(e) {
            if(e.target.type === 'checkbox') {
                const taskId = e.target.id;
                if(window.plannerEvents[selectedDateString]) {
                    let task = window.plannerEvents[selectedDateString].find(t => t.id === taskId);
                    if(task) task.checked = e.target.checked;
                }
            }
        });

        taskListContainer.addEventListener('click', function(e) {
            const editBtn = e.target.closest('.btn-edit'); const deleteBtn = e.target.closest('.btn-delete');
            if (editBtn || deleteBtn) {
                const taskItem = e.target.closest('.todo-item-light'); const taskId = taskItem.getAttribute('data-task-id');
                if (deleteBtn) { activeDeletingTaskId = taskId; document.getElementById('delete-task-modal').classList.add('show'); }
                if (editBtn) {
                    activeEditingTaskId = taskId; const task = window.plannerEvents[selectedDateString].find(t => t.id === taskId);
                    document.getElementById('edit-task-input').value = task.text;
                    document.getElementById('edit-task-modal').classList.add('show');
                    document.getElementById('edit-task-input').focus();
                }
            }
        });
    }

    const saveEditBtn = document.getElementById('save-edit-btn');
    if(saveEditBtn) {
        saveEditBtn.addEventListener('click', async () => {
            const newText = document.getElementById('edit-task-input').value.trim();
            if (newText !== "" && activeEditingTaskId) {
                const token = localStorage.getItem('token');
                const task = window.plannerEvents[selectedDateString].find(t => t.id === activeEditingTaskId);
                
                // Nếu có token và task ID không bắt đầu bằng "task-" (tức là task từ database)
                if (task && token && !activeEditingTaskId.startsWith('task-')) {
                    try {
                        const response = await fetch(`${AUTH_API_BASE_URL}/tasks/${activeEditingTaskId}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': 'Bearer ' + token
                            },
                            body: JSON.stringify({
                                task_text: newText,
                                color: task.color,
                                is_completed: task.checked ? 1 : 0
                            })
                        });
                        
                        if (!response.ok) {
                            console.error('❌ Lỗi cập nhật task vào database');
                        }
                    } catch (error) {
                        console.error('❌ Lỗi khi cập nhật task:', error);
                    }
                }
                
                // Cập nhật local state
                if(task) { task.text = newText; renderTasksForDate(selectedDateString); checkSmartNotifications(); }
            }
            document.getElementById('edit-task-modal').classList.remove('show');
        });
    }

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if(confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            const token = localStorage.getItem('token');
            
            // If user is logged in, delete from database first
            if (token && activeDeletingTaskId && !activeDeletingTaskId.startsWith('task-')) {
                try {
                    const response = await fetch(`${AUTH_API_BASE_URL}/tasks/${activeDeletingTaskId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    
                    if (!response.ok) {
                        console.error('Failed to delete task from database');
                    }
                } catch (error) {
                    console.error('Error deleting task from database:', error);
                }
            }
            
            // Then update local state
            if (activeDeletingTaskId && selectedDateString) {
                window.plannerEvents[selectedDateString] = window.plannerEvents[selectedDateString].filter(t => t.id !== activeDeletingTaskId);
                renderTasksForDate(selectedDateString); 
                checkSmartNotifications(); 
                generateLightCalendar(); 
            }
            document.getElementById('delete-task-modal').classList.remove('show');
            activeDeletingTaskId = null;
        });
    }

    const calendarDays = document.getElementById('calendar-days-light');
    if (calendarDays) {
        calendarDays.addEventListener('click', (e) => {
            const cell = e.target.closest('.date-cell-light'); if (!cell || cell.classList.contains('muted')) return;
            document.querySelectorAll('.date-cell-light').forEach(c => c.classList.remove('active'));
            cell.classList.add('active'); selectedDateString = cell.getAttribute('data-date');
            try { updatePlannerSidebar(selectedDateString); } catch (err) {}
        });
    }

    generateLightCalendar();
    isPlannerInitialized = true;
}

function generateLightCalendar() {
    const grid = document.getElementById('calendar-days-light'); const monthLabel = document.getElementById('current-month-name-light');
    if(!grid || !monthLabel) return; grid.innerHTML = '';
    
    const year = plannerViewDate.getFullYear(); const month = plannerViewDate.getMonth();
    const currentMonthsArr = i18n[window.appSettings.language].month_names;
    monthLabel.innerText = `${currentMonthsArr[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const today = new Date(); const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let forecastArray = [];
    if (window.currentWeatherData && window.currentWeatherData.forecast) forecastArray = window.currentWeatherData.forecast.forecastday;

    for (let x = firstDayIndex; x > 0; x--) grid.innerHTML += `<div class="date-cell-light glass-panel-light muted"><span class="day-num">${daysInPrevMonth - x + 1}</span></div>`;

    const currentViewMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    if (!selectedDateString || !selectedDateString.startsWith(currentViewMonthStr)) {
        if (currentViewMonthStr === todayStr.substring(0,7)) selectedDateString = todayStr; else selectedDateString = `${currentViewMonthStr}-01`; 
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const loopDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        let iconHTML = ''; let cellClass = ''; let todayIndicator = ''; let taskIndicator = '';

        if (loopDateStr === todayStr) todayIndicator = `<i class="fas fa-circle today-indicator"></i>`;
        if (loopDateStr === selectedDateString) cellClass = 'active';
        if (window.plannerEvents[loopDateStr] && window.plannerEvents[loopDateStr].length > 0) taskIndicator = `<div class="task-indicator"></div>`;

        const matchedForecast = forecastArray.find(d => d.date === loopDateStr);
        if (matchedForecast) iconHTML = `<img src="https:${matchedForecast.day.condition.icon}" style="width: 24px; filter: drop-shadow(0 0 4px rgba(255,255,255,0.5)); align-self: flex-end;">`;
        grid.innerHTML += `<div class="date-cell-light glass-panel-light ${cellClass}" data-date="${loopDateStr}">${taskIndicator}${todayIndicator}<span class="day-num">${i}</span>${iconHTML}</div>`;
    }

    const totalCells = firstDayIndex + daysInMonth;
    if (42 - totalCells < 7) { for (let j = 1; j <= 42 - totalCells; j++) grid.innerHTML += `<div class="date-cell-light glass-panel-light muted"><span class="day-num">${j}</span></div>`; }

    if(selectedDateString) updatePlannerSidebar(selectedDateString);
}

function renderTasksForDate(dateStr) {
    const taskContainer = document.getElementById('task-list-container');
    if (!taskContainer) return;
    
    if(!window.plannerEvents[dateStr] || window.plannerEvents[dateStr].length === 0) {
        const emptyTxt = window.appSettings.language === 'vi' ? 'Không có kế hoạch.' : 'No tasks for this day.';
        taskContainer.innerHTML = `<div style="opacity: 0.5; font-size: 13px; font-style: italic;">${emptyTxt}</div>`;
        return;
    }

    let html = '';
    window.plannerEvents[dateStr].forEach(task => {
        const isChecked = task.checked ? 'checked' : '';
        html += `
            <div class="todo-item-light" data-task-id="${task.id}">
                <div class="todo-item-left"><input type="checkbox" id="${task.id}" class="${task.color}" ${isChecked}><label for="${task.id}">${task.text}</label></div>
                <div class="task-actions">
                    <button class="task-btn btn-edit" title="Edit"><i class="fas fa-pen"></i></button>
                    <button class="task-btn btn-delete" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
    });
    taskContainer.innerHTML = html;
}

function updatePlannerSidebar(dateStr) {
    try {
        if (!dateStr) return; 
        const dateLabel = document.getElementById('selected-date-label-light');
        const weatherDesc = document.getElementById('day-weather-desc-light');
        const weatherIcon = document.getElementById('day-weather-icon-light');

        const parts = dateStr.split('-');
        if (parts.length === 3 && dateLabel) {
            const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            const mNames = i18n[window.appSettings.language].month_names;
            const ord = getOrdinal(dateObj.getDate());
            dateLabel.innerText = window.appSettings.language === 'en' ? `${mNames[dateObj.getMonth()].substring(0,3)} ${dateObj.getDate()}${ord}` : `${dateObj.getDate()} ${mNames[dateObj.getMonth()]}`;
        }

        let forecastArray = [];
        if (window.currentWeatherData && window.currentWeatherData.forecast) forecastArray = window.currentWeatherData.forecast.forecastday;
        const matchedForecast = forecastArray.find(item => item.date === dateStr);

        if (matchedForecast) {
            if (weatherDesc) weatherDesc.innerText = matchedForecast.day.condition.text;
            if (weatherIcon) weatherIcon.innerHTML = `<img src="https:${matchedForecast.day.condition.icon.replace('64x64', '128x128')}" style="width: 50px;">`;
        } else {
            if (weatherDesc) weatherDesc.innerText = window.appSettings.language === 'vi' ? "Chưa có dự báo" : "No forecast available";
            if (weatherIcon) weatherIcon.innerHTML = `<i class="fas fa-calendar-times" style="color: rgba(255,255,255,0.3);"></i>`;
        }
        renderTasksForDate(dateStr);
    } catch (e) { }
}

function addNewTask(taskText) {
    if(!selectedDateString) return;
    
    const token = localStorage.getItem('token');
    const colors = ['cb-pastel-blue', 'cb-pastel-white', 'cb-pastel-yellow'];
    const selectedColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Nếu có token (user đã đăng nhập), gọi API để lưu vào database
    if (token) {
        fetch(`${AUTH_API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                task_date: selectedDateString,
                task_text: taskText,
                color: selectedColor
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.task) {
                // Thêm task vào local state với ID từ database
                if(!window.plannerEvents[selectedDateString]) window.plannerEvents[selectedDateString] = [];
                window.plannerEvents[selectedDateString].push({
                    id: data.task.id.toString(),
                    text: taskText,
                    color: selectedColor,
                    checked: false
                });
                renderTasksForDate(selectedDateString); 
                checkSmartNotifications(); 
                generateLightCalendar();
            }
        })
        .catch(err => {
            console.error("Error creating task:", err);
            // Fallback: lưu vào local state nếu API lỗi
            addNewTaskLocal(taskText, selectedColor);
        });
    } else {
        // Không có token: lưu vào local state (chế độ không đăng nhập)
        addNewTaskLocal(taskText, selectedColor);
    }
}

function addNewTaskLocal(taskText, selectedColor) {
    if(!window.plannerEvents[selectedDateString]) window.plannerEvents[selectedDateString] = [];
    const randomId = 'task-' + Math.floor(Math.random() * 10000);
    window.plannerEvents[selectedDateString].push({ id: randomId, text: taskText, color: selectedColor, checked: false });
    renderTasksForDate(selectedDateString); checkSmartNotifications(); generateLightCalendar();
}

// =========================================================================
// 9. PLANNER NAVBAR LOGIC (SMART NOTIFICATION & YEARLY VIEW)
// =========================================================================
let tomorrowNotificationMsgHTML = "";

function checkSmartNotifications() {
    let tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
    let tmrwStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;
    let tmrwTasks = window.plannerEvents[tmrwStr] || [];
    let notifBadge = document.getElementById('bell-badge');
    const lang = window.appSettings.language;

    if(tmrwTasks.length > 0) {
        if(notifBadge) notifBadge.style.display = 'block';
        let weatherTxt = "unknown";
        if(window.currentWeatherData && window.currentWeatherData.forecast) {
            let fc = window.currentWeatherData.forecast.forecastday.find(d => d.date === tmrwStr);
            if(fc) weatherTxt = fc.day.condition.text;
        }

        let taskListHTML = tmrwTasks.map(t => `<div style="margin-left: 10px; color: #0088ff; margin-bottom: 4px; font-weight: 400;">• ${t.text}</div>`).join('');
        let msgTitle = i18n[lang].notif_has_task.replace('{N}', tmrwTasks.length);
        
        tomorrowNotificationMsgHTML = `
            <div style="margin-bottom: 10px; font-weight: 600;">${msgTitle}</div>
            ${taskListHTML}
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed rgba(0,0,0,0.1);">
                <strong style="color: #ff4757;">${i18n[lang].notif_weather}</strong> ${weatherTxt}
            </div>`;
    } else {
        if(notifBadge) notifBadge.style.display = 'none';
        tomorrowNotificationMsgHTML = `<div style='text-align: center; opacity: 0.8; padding: 20px 0;'>${i18n[lang].notif_no_task}</div>`;
    }
}

document.getElementById('nav-btn-menu')?.addEventListener('click', () => {
    const content = document.getElementById('all-tasks-content'); if(!content) return;
    let html = ''; const dates = Object.keys(window.plannerEvents).sort();
    if(dates.length === 0 || dates.every(d => window.plannerEvents[d].length === 0)) {
        const emptyTxt = window.appSettings.language === 'vi' ? 'Bạn chưa có kế hoạch nào.' : 'Your planner is currently empty.';
        html = `<p style="text-align:center; opacity:0.6;">${emptyTxt}</p>`;
    } else {
        dates.forEach(date => {
            let tasks = window.plannerEvents[date];
            if(tasks.length > 0) {
                html += `<h4 style="margin-top:15px; margin-bottom:5px; color:#0088ff; border-bottom:1px solid rgba(0,0,0,0.1); padding-bottom:5px;">${date}</h4>`;
                tasks.forEach(t => { let doneStyle = t.checked ? 'text-decoration:line-through; opacity:0.6;' : ''; html += `<div style="margin-bottom:5px; ${doneStyle}">• ${t.text}</div>`; });
            }
        });
    }
    content.innerHTML = html;
});

document.getElementById('nav-link-home')?.addEventListener('click', () => {
    const grid = document.getElementById('yearly-calendar-grid'); const title = document.getElementById('yearly-title');
    if(!grid) return;
    const displayYear = plannerViewDate.getFullYear(); title.innerText = window.appSettings.language === 'vi' ? `Năm ${displayYear}` : `Calendar ${displayYear}`; grid.innerHTML = '';
    const mNames = i18n[window.appSettings.language].month_names;
    const today = new Date(); const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    for(let m = 0; m < 12; m++) {
        let firstDay = new Date(displayYear, m, 1).getDay(); let daysInM = new Date(displayYear, m + 1, 0).getDate();
        let html = `<div class="month-mini-cal" data-month="${m}"><h4>${mNames[m]}</h4><div class="mini-days-header"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div><div class="mini-days-grid">`;
        for(let i=0; i<firstDay; i++) html += `<div></div>`;
        for(let d=1; d<=daysInM; d++) {
            let dateStr = `${displayYear}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            let classStr = "mini-day";
            if(dateStr === todayStr) classStr += " active";
            if(window.plannerEvents[dateStr] && window.plannerEvents[dateStr].length > 0) classStr += " has-event";
            html += `<div class="${classStr}">${d}</div>`;
        }
        html += `</div></div>`; grid.innerHTML += html;
    }
});

// LỊCH NĂM BẤM ĐỂ NHẢY
document.addEventListener('click', (e) => {
    const monthCard = e.target.closest('.month-mini-cal');
    if (monthCard && document.getElementById('yearly-calendar-modal')?.classList.contains('show')) {
        const selectedMonth = parseInt(monthCard.getAttribute('data-month'));
        plannerViewDate.setMonth(selectedMonth);
        const y = plannerViewDate.getFullYear();
        selectedDateString = `${y}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        document.getElementById('yearly-calendar-modal').classList.remove('show');
        generateLightCalendar();
    }
});

document.getElementById('nav-btn-map')?.addEventListener('click', () => { const menuItems = document.querySelectorAll('.menu-item'); if(menuItems.length > 1) menuItems[1].click(); });

// =========================================================================
// 11. SETTINGS TAB LOGIC (Live Settings, i18n, Avatar Upload)
// =========================================================================

document.getElementById('language-select')?.addEventListener('change', async function(e) {
    window.appSettings.language = e.target.value; 
    translateApp(window.appSettings.language); 
    // Lưu settings vào database
    await saveCurrentUserSettings();
    showToast();
    if(window.lastSearchedQuery) fetchWeatherData(window.lastSearchedQuery); 
});

document.getElementById('btn-temp-c')?.addEventListener('click', async function() {
    document.getElementById('btn-temp-f').classList.remove('active'); this.classList.add('active'); window.appSettings.tempUnit = 'C'; 
    await saveCurrentUserSettings();
    reRenderWeatherUI(); showToast();
});

document.getElementById('btn-temp-f')?.addEventListener('click', async function() {
    document.getElementById('btn-temp-c').classList.remove('active'); this.classList.add('active'); window.appSettings.tempUnit = 'F'; 
    await saveCurrentUserSettings();
    reRenderWeatherUI(); showToast();
});

document.getElementById('btn-time-12')?.addEventListener('click', async function() {
    document.getElementById('btn-time-24').classList.remove('active'); this.classList.add('active'); window.appSettings.timeFormat = '12h'; 
    await saveCurrentUserSettings();
    if(document.getElementById('statistics-view').style.display === 'flex') drawStatistics(window.currentWeatherData);
    showToast();
});

document.getElementById('btn-time-24')?.addEventListener('click', async function() {
    document.getElementById('btn-time-12').classList.remove('active'); this.classList.add('active'); window.appSettings.timeFormat = '24h'; 
    await saveCurrentUserSettings();
    if(document.getElementById('statistics-view').style.display === 'flex') drawStatistics(window.currentWeatherData);
    showToast();
});

document.querySelectorAll('.setting-toggle').forEach(toggle => {
    let isProcessing = false; // Prevent multiple simultaneous toggles
    
    toggle.addEventListener('click', async function() { 
        if (isProcessing) return; // Prevent double-clicks
        isProcessing = true;
        
        try {
            // Lưu trạng thái trước khi toggle
            const wasActive = this.classList.contains('active');
            
            // Toggle class ngay lập tức cho phản hồi UI tức thì
            this.classList.toggle('active'); 
            
            // Get current language for translations
            const lang = window.appSettings.language || 'en';
            
            // Hiện toast với message đã được translate
            if (wasActive) {
                // Translated message for disabled
                const disabledKey = Array.from(document.querySelectorAll('.setting-toggle')).indexOf(this) === 0 
                    ? 'push_severe_disabled' 
                    : Array.from(document.querySelectorAll('.setting-toggle')).indexOf(this) === 1 
                        ? 'push_daily_disabled' 
                        : 'push_planner_disabled';
                showToast(i18n[lang][disabledKey] || i18n[lang].toast_saved);
            } else {
                // Translated message for enabled
                const enabledKey = Array.from(document.querySelectorAll('.setting-toggle')).indexOf(this) === 0 
                    ? 'push_severe_enabled' 
                    : Array.from(document.querySelectorAll('.setting-toggle')).indexOf(this) === 1 
                        ? 'push_daily_enabled' 
                        : 'push_planner_enabled';
                showToast(i18n[lang][enabledKey] || i18n[lang].toast_saved);
            }
            
            // Save settings first
            await saveCurrentUserSettings();

            // XỬ LÝ PUSH NOTIFICATIONS RIÊNG BIỆT
            const index = Array.from(document.querySelectorAll('.setting-toggle')).indexOf(this);
            
            if (index === 0) { // Severe Weather
                if (!wasActive) {
                    console.log('🔔 Severe Weather Alerts Toggle BẬT');
                    await subscribeToPushNotifications('severe', this);
                } else {
                    console.log('🔕 Severe Weather Alerts Toggle TẮT');
                    await unsubscribeFromPush('severe');
                }
            } else if (index === 1) { // Daily Forecast
                if (!wasActive) {
                    console.log('🔔 Daily Forecast Toggle BẬT');
                    await subscribeToPushNotifications('daily', this);
                } else {
                    console.log('🔕 Daily Forecast Toggle TẮT');
                    await unsubscribeFromPush('daily');
                }
            } else if (index === 2) { // Planner
                if (!wasActive) {
                    console.log('🔔 Planner Toggle BẬT');
                    await subscribeToPushNotifications('planner', this);
                } else {
                    console.log('🔕 Planner Toggle TẮT');
                    await unsubscribeFromPush('planner');
                }
            }
        } catch (e) {
            console.error('Error processing toggle:', e);
        } finally {
            isProcessing = false;
        }
    });
});

document.getElementById('avatar-upload')?.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64String = event.target.result; document.getElementById('preview-avatar').src = base64String;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('save-profile-btn')?.addEventListener('click', () => {
    const newName = document.getElementById('edit-name-input').value;
    const newEmail = document.getElementById('edit-email-input').value;
    const newAvatarSrc = document.getElementById('preview-avatar').src;

    document.getElementById('display-name').innerText = newName;
    document.getElementById('display-email').innerHTML = `<i class="fas fa-envelope"></i> ${newEmail}`;
    document.getElementById('profile-avatar').src = newAvatarSrc;
    document.getElementById('header-avatar').src = newAvatarSrc; 
    
    document.getElementById('edit-profile-modal').classList.remove('show');
    showToast();
});

document.getElementById('btn-logout')?.addEventListener('click', () => { 
    logout();
});

// =========================================================================
// 12. MULTI-ACCOUNT MANAGEMENT (Facebook-style switching)
// =========================================================================

// Storage keys
const SAVED_ACCOUNTS_KEY = 'savedAccounts';
const CURRENT_ACCOUNT_KEY = 'currentAccount';

// Note: AUTH_API_BASE_URL is already declared in auth-check.js

// Initialize account system
function initAccountSystem() {
    // Hide onboarding view FIRST - before any early returns!
    const onboardingView = document.getElementById('onboarding-view');
    if (onboardingView) {
        onboardingView.style.display = 'none';
        onboardingView.style.visibility = 'hidden';
        onboardingView.style.pointerEvents = 'none';
        onboardingView.style.zIndex = '-1';
    }
    
    const userMenuContainer = document.getElementById('user-menu-container');
    const userDropdown = document.getElementById('user-dropdown');
    const accountsList = document.getElementById('dropdown-accounts-list');
    const addAccountBtn = document.getElementById('btn-add-account');
    
    if (!userMenuContainer || !userDropdown) return;
    
    // Click on avatar to toggle dropdown
    userMenuContainer.addEventListener('click', function(e) {
        e.stopPropagation();
        const isShown = userDropdown.style.display === 'block';
        userDropdown.style.display = isShown ? 'none' : 'block';
        
        if (!isShown) {
            renderAccountDropdown();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!userMenuContainer.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.style.display = 'none';
        }
    });
    
    // Add account button
    if (addAccountBtn) {
        addAccountBtn.addEventListener('click', function() {
            userDropdown.style.display = 'none';
            // Clear current account to force login
            localStorage.removeItem(CURRENT_ACCOUNT_KEY);
            window.location.href = 'login.html';
        });
    }
    
    // Load current account on init
    loadCurrentAccount().then(() => {
        console.log('Account system initialized. Starting UI initialization...');
        // Now initialize tabs and weather AFTER account/tasks are loaded
        initTabs();
        // Weather will be fetched by applyUserSettings if city is saved in settings
        // Only fetch default city if no settings found
        const currentAccount = getCurrentAccount();
        console.log('📋 In .then() - currentAccount:', currentAccount);
        console.log('📋 In .then() - currentAccount.settings:', currentAccount?.settings);
        console.log('📋 In .then() - currentAccount.settings.city:', currentAccount?.settings?.city);
        console.log('📋 In .then() - Check condition: !currentAccount || !currentAccount.settings || !currentAccount.settings.city:', !currentAccount || !currentAccount.settings || !currentAccount.settings.city);
        
        if (!currentAccount || !currentAccount.settings || !currentAccount.settings.city) {
            console.log('❌ FALLBACK: Fetching Can Tho in .then()');
            fetchWeatherData('Can Tho');
        } else {
            console.log('✅ City already loaded, not fetching Can Tho');
        }
    }).catch(err => {
        console.error('Error during account initialization:', err);
        // FALLBACK: Show the page anyway even if account loading fails
        initTabs();
        fetchWeatherData('Can Tho'); // Load default weather
    });
}

// Get saved accounts from localStorage
function getSavedAccounts() {
    const accounts = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return accounts ? JSON.parse(accounts) : [];
}

// Save accounts to localStorage
function saveSavedAccounts(accounts) {
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// Get current account
function getCurrentAccount() {
    const account = localStorage.getItem(CURRENT_ACCOUNT_KEY);
    return account ? JSON.parse(account) : null;
}

// Save current account
function saveCurrentAccount(account) {
    localStorage.setItem(CURRENT_ACCOUNT_KEY, JSON.stringify(account));
}

// Add or update account in saved accounts
function addOrUpdateAccount(userData) {
    const accounts = getSavedAccounts();
    const existingIndex = accounts.findIndex(acc => acc.email === userData.email);
    
    const accountInfo = {
        id: userData.id,
        full_name: userData.full_name,
        email: userData.email,
        avatar: userData.avatar || null,
        token: userData.token,
        settings: userData.settings || null
    };
    
    if (existingIndex >= 0) {
        accounts[existingIndex] = accountInfo;
    } else {
        accounts.push(accountInfo);
    }
    
    saveSavedAccounts(accounts);
    saveCurrentAccount(accountInfo);
}

// Switch to another account
function switchAccount(account) {
    console.log('Switching to account:', account.email);
    
    // Save current account settings before switching
    saveCurrentUserSettings();
    
    // Save new account as current
    saveCurrentAccount(account);
    
    // Update token in localStorage for API calls
    if (!account.token) {
        console.warn('Account has no token, attempting to retrieve from localStorage');
        const accounts = getSavedAccounts();
        const savedAccount = accounts.find(acc => acc.email === account.email);
        if (savedAccount && savedAccount.token) {
            localStorage.setItem('token', savedAccount.token);
        }
    } else {
        localStorage.setItem('token', account.token);
    }
    
    console.log('Token set. Reloading page...');
    
    // Apply settings from the new account
    if (account.settings) {
        applyUserSettings(account.settings);
    } else {
        // If no settings saved, load from database
        loadUserSettingsFromAPI();
    }
    
    // Reload the page to reflect the new account
    window.location.reload();
}

// Load current account and update UI
async function loadCurrentAccount() {
    const account = getCurrentAccount();
    console.log('🔍 loadCurrentAccount - Account loaded from localStorage:', account);
    console.log('🔍 loadCurrentAccount - Settings:', account?.settings);
    console.log('🔍 loadCurrentAccount - City from settings:', account?.settings?.city);
    
    if (account) {
        // LUỒNG KIỂM SOÁT 1: LUÔN LOAD SETTINGS MỚI TỪ API
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch(`${AUTH_API_BASE_URL}/settings`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    }
                });
                if (response.ok) {
                    const settings = await response.json();
                    console.log('📡 API returned settings:', settings);
                    if (settings.hasCompletedOnboarding) {
                        const oldSettings = account.settings;
                        account.settings = {
                            ...account.settings,
                            ...settings
                        };
                        saveCurrentAccount(account);
                    } else {
                        // Let auth-check handle missing onboarding
                    }
                } else {
                    // API Error, let auth-check handle
                }
            } catch (error) {
                console.error('Error loading settings from API:', error);
            }
        } else {
            // No token, let auth-check handle
        }

        // IMPORTANT: Clear old tasks when switching accounts to prevent stale data
        window.plannerEvents = {};
        
        // Update header avatar
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) {
            if (account.avatar) {
                headerAvatar.src = account.avatar;
            } else {
                const initial = account.full_name ? account.full_name.charAt(0).toUpperCase() : 'U';
                headerAvatar.src = `https://ui-avatars.com/api/?name=${initial}&background=4facfe&color=fff`;
            }
        }
        
        // Update profile section
        const displayName = document.getElementById('display-name');
        const displayEmail = document.getElementById('display-email');
        const profileAvatar = document.getElementById('profile-avatar');
        
        if (displayName) displayName.textContent = account.full_name || 'User';
        if (displayEmail) displayEmail.innerHTML = `<i class="fas fa-envelope"></i> ${account.email}`;
        if (profileAvatar) {
            if (account.avatar) {
                profileAvatar.src = account.avatar;
            } else {
                const initial = account.full_name ? account.full_name.charAt(0).toUpperCase() : 'U';
                profileAvatar.src = `https://ui-avatars.com/api/?name=${initial}&background=e0c3fc&color=fff`;
            }
        }
        
        // Load profile and settings data from API
        loadProfileData();
        
        // LUỒNG KIỂM SOÁT 2: Nạp đúng thành phố để hiển thị dữ liệu thời tiết
        console.log('🏙️ Final check - account.settings:', account.settings);
        console.log('🏙️ Final check - account.settings.city:', account.settings?.city);
        
        if (account.settings && account.settings.city) {
            console.log('✅ City found in settings, applying settings and trying GPS first:', account.settings.city);
            applyUserSettings(account.settings);
            // Gọi fetchWeatherByGPS với city từ settings làm fallback
            fetchWeatherByGPS(account.settings.city);
        } else {
            // Đề phòng lỗi DB, tự động Fallback về Cần Thơ để web không bị trống trơn
            console.log('❌ NO CITY FOUND! Falling back to Can Tho');
            fetchWeatherData('Can Tho');
        }
        
        // Load tasks from database
        console.log('Starting to load tasks for account:', account.email);
        await loadTasksFromAPI();
        console.log('Tasks loaded. Current plannerEvents:', Object.keys(window.plannerEvents || {}).length, 'dates');
    } else {
        // No account - redirect to login
        console.log('No account found, redirecting to login');
        window.location.href = 'login.html';
    }
}

// Load tasks from database
async function loadTasksFromAPI() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/tasks`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        if (response.ok) {
            const data = await response.json();
            
            // 1. XÓA SẠCH DỮ LIỆU CŨ ĐỂ TRÁNH RÁC
            window.plannerEvents = {};
            let rawTasks = [];

            // 2. GOM MỌI DỮ LIỆU VỀ 1 MẢNG DUY NHẤT (Bất chấp Backend trả về dạng gì)
            if (data.plannerEvents && Object.keys(data.plannerEvents).length > 0) {
                // Nếu backend trả về Object đã group sẵn theo ngày
                Object.entries(data.plannerEvents).forEach(([keyDate, tasksArray]) => {
                    tasksArray.forEach(t => {
                        t.fallbackDate = keyDate; // Giữ lại ngày từ key
                        rawTasks.push(t);
                    });
                });
            } else if (data.tasks && Array.isArray(data.tasks)) {
                // Nếu backend trả về Array thô
                rawTasks = data.tasks;
            }

            // 3. MAP DỮ LIỆU & FIX LỖI TIMEZONE
            rawTasks.forEach(task => {
                // Lấy ngày (quét mọi tên biến có thể có)
                let rawDate = task.date || task.task_date || task.fallbackDate;
                if (!rawDate) return;

                // Tuyệt chiêu trị múi giờ: parse qua Date object để ép về giờ Local thay vì cắt chuỗi 'T'
                let dateObj = new Date(rawDate);
                let dateStr = "";
                
                if (!isNaN(dateObj.getTime())) {
                    // Trả về chuẩn YYYY-MM-DD theo giờ thực tế của máy tính
                    const y = dateObj.getFullYear();
                    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const d = String(dateObj.getDate()).padStart(2, '0');
                    dateStr = `${y}-${m}-${d}`;
                } else {
                    dateStr = String(rawDate).split('T')[0]; // Cứu cánh cuối cùng
                }

                // Khởi tạo mảng sự kiện cho ngày đó nếu chưa có
                if (!window.plannerEvents[dateStr]) {
                    window.plannerEvents[dateStr] = [];
                }

                // Map dữ liệu chuẩn để đẩy lên UI
                window.plannerEvents[dateStr].push({
                    id: task.id ? task.id.toString() : ('task-' + Math.random().toString().slice(2, 8)),
                    text: task.task_text || task.text || "No title",
                    color: task.color || "cb-pastel-blue",
                    checked: task.is_completed == 1 || task.completed === true || task.checked === true
                });
            });

            console.log('✅ Lịch trình đã load thành công:', window.plannerEvents);

            // 4. RENDER LẠI GIAO DIỆN
            if (typeof generateLightCalendar === 'function') generateLightCalendar();
            if (typeof checkSmartNotifications === 'function') checkSmartNotifications();
            if (selectedDateString && typeof renderTasksForDate === 'function') renderTasksForDate(selectedDateString);

        } else {
            console.error('❌ Lỗi tải tasks, status:', response.status);
            window.plannerEvents = {};
            if (typeof generateLightCalendar === 'function') generateLightCalendar();
        }
    } catch (error) {
        console.error('❌ Lỗi mạng hoặc server khi loadTasksFromAPI:', error);
        window.plannerEvents = {};
        if (typeof generateLightCalendar === 'function') generateLightCalendar();
    }
}

// Load user settings from API and save to localStorage
async function loadUserSettingsFromAPI() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/settings`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (response.ok) {
            const settings = await response.json();
            applyUserSettings(settings);
            
            // Save settings to current account in localStorage
            const currentAccount = getCurrentAccount();
            if (currentAccount) {
                currentAccount.settings = settings;
                saveCurrentAccount(currentAccount);
                
                // Also update in saved accounts
                const accounts = getSavedAccounts();
                const index = accounts.findIndex(acc => acc.email === currentAccount.email);
                if (index >= 0) {
                    accounts[index].settings = settings;
                    saveSavedAccounts(accounts);
                }
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

// Apply settings to UI
function applyUserSettings(settings) {
    if (!settings) return;
    
    console.log('✅ applyUserSettings called with:', settings);
    console.log('✅ applyUserSettings - City:', settings.city);
    
    // Apply language
    if (settings.language) {
        window.appSettings.language = settings.language;
        const langSelect = document.getElementById('language-select');
        if (langSelect) langSelect.value = settings.language;
        translateApp(settings.language);
    }
    
    // Apply temperature unit
    if (settings.tempUnit) {
        window.appSettings.tempUnit = settings.tempUnit;
        document.getElementById('btn-temp-c')?.classList.toggle('active', settings.tempUnit === 'C');
        document.getElementById('btn-temp-f')?.classList.toggle('active', settings.tempUnit === 'F');
    }
    
    // Apply time format
    if (settings.timeFormat) {
        window.appSettings.timeFormat = settings.timeFormat;
        document.getElementById('btn-time-12')?.classList.toggle('active', settings.timeFormat === '12h');
        document.getElementById('btn-time-24')?.classList.toggle('active', settings.timeFormat === '24h');
    }
    
    // Apply notification settings
    const notifySevere = document.querySelectorAll('.setting-toggle')[0];
    const notifyDaily = document.querySelectorAll('.setting-toggle')[1];
    const notifyPlanner = document.querySelectorAll('.setting-toggle')[2];
    
    // Debug logging
    console.log('🔔 applyUserSettings - Notification toggle states from settings:');
    console.log('  - notifySevere:', settings.notifySevere, '(type:', typeof settings.notifySevere, ')');
    console.log('  - notifyDaily:', settings.notifyDaily, '(type:', typeof settings.notifyDaily, ')');
    console.log('  - notifyPlanner:', settings.notifyPlanner, '(type:', typeof settings.notifyPlanner, ')');
    
    // Default to OFF if undefined
    if (notifySevere) {
        notifySevere.classList.toggle('active', settings.notifySevere === true);
        console.log('✅ notifySevere toggle updated. Now active?', notifySevere.classList.contains('active'));
    }
    if (notifyDaily) {
        notifyDaily.classList.toggle('active', settings.notifyDaily === true);
        console.log('✅ notifyDaily toggle updated. Now active?', notifyDaily.classList.contains('active'));
    }
    if (notifyPlanner) {
        notifyPlanner.classList.toggle('active', settings.notifyPlanner === true);
        console.log('✅ notifyPlanner toggle updated. Now active?', notifyPlanner.classList.contains('active'));
    }
    
    // Apply city - fetch weather for the saved city
    if (settings.city && typeof fetchWeatherData === 'function') {
        console.log('Applying city from settings:', settings.city);
        window.lastSearchedQuery = settings.city;
        fetchWeatherData(settings.city);
    }
}

// Save current user settings to API
async function saveCurrentUserSettings() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    const settings = {
        language: window.appSettings.language,
        tempUnit: window.appSettings.tempUnit,
        timeFormat: window.appSettings.timeFormat,
        // ĐÃ FIX: Chỉ lấy vị trí gốc, không lấy lịch sử tìm kiếm (lastSearchedQuery) nữa
        city: window.appSettings.city || 'Can Tho',
        notifySevere: document.querySelectorAll('.setting-toggle')[0]?.classList.contains('active'),
        notifyDaily: document.querySelectorAll('.setting-toggle')[1]?.classList.contains('active'),
        notifyPlanner: document.querySelectorAll('.setting-toggle')[2]?.classList.contains('active')
    };
    
    // Update window.appSettings with city
    window.appSettings.city = settings.city;
    
    try {
        await fetch(`${AUTH_API_BASE_URL}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(settings)
        });
        
        // Also save to localStorage
        const currentAccount = getCurrentAccount();
        if (currentAccount) {
            currentAccount.settings = settings;
            saveCurrentAccount(currentAccount);
            
            // Update in saved accounts
            const accounts = getSavedAccounts();
            const index = accounts.findIndex(acc => acc.email === currentAccount.email);
            if (index >= 0) {
                accounts[index].settings = settings;
                saveSavedAccounts(accounts);
            }
        }
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

// Render account dropdown list
function renderAccountDropdown() {
    const accountsList = document.getElementById('dropdown-accounts-list');
    if (!accountsList) return;
    
    const accounts = getSavedAccounts();
    const currentAccount = getCurrentAccount();
    
    if (accounts.length === 0) {
        accountsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 13px;">Chưa có tài khoản nào</div>';
        return;
    }
    
    let html = '';
    accounts.forEach(account => {
        const isActive = currentAccount && currentAccount.email === account.email;
        const initial = account.full_name ? account.full_name.charAt(0).toUpperCase() : 'U';
        const avatarUrl = account.avatar || `https://ui-avatars.com/api/?name=${initial}&background=4facfe&color=fff`;
        
        html += `
            <div class="dropdown-account-item ${isActive ? 'active-account' : ''}" data-email="${account.email}">
                <img src="${avatarUrl}" alt="Avatar">
                <div class="dropdown-account-info">
                    <div class="dropdown-account-name">${account.full_name || 'User'}</div>
                    <div class="dropdown-account-email">${account.email}</div>
                </div>
                ${isActive ? '<i class="fas fa-check dropdown-account-check"></i>' : ''}
            </div>
        `;
    });
    
    accountsList.innerHTML = html;
    
    // Add click handlers for each account
    document.querySelectorAll('.dropdown-account-item').forEach(item => {
        item.addEventListener('click', function() {
            const email = this.getAttribute('data-email');
            const account = accounts.find(acc => acc.email === email);
            if (account) {
                switchAccount(account);
            }
        });
    });
}

// Override logout function to show modal confirmation first
function logout() {
    // Gọi modal xác nhận đăng xuất từ profile.js (nếu đã load)
    if (typeof showLogoutModal === 'function') {
        showLogoutModal();
        return;
    }
    
    // Fallback: đăng xuất trực tiếp nếu profile.js chưa load
    const currentAccount = getCurrentAccount();
    const accounts = getSavedAccounts();
    
    if (accounts.length > 1) {
        // Remove current account from saved accounts
        const updatedAccounts = accounts.filter(acc => acc.email !== currentAccount.email);
        saveSavedAccounts(updatedAccounts);
        
        // Switch to another account if available
        if (updatedAccounts.length > 0) {
            switchAccount(updatedAccounts[0]);
            showToast('Đã đăng xuất khỏi tài khoản: ' + currentAccount.full_name);
            return;
        }
    }
    
    // Clear everything if only one account
    localStorage.removeItem(SAVED_ACCOUNTS_KEY);
    localStorage.removeItem(CURRENT_ACCOUNT_KEY);
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

// Load profile data from API
async function loadProfileData() {
    const token = localStorage.getItem('token') || getCurrentAccount()?.token;
    if (!token) return;
    
    try {
        const response = await fetch('https://ai-weather-backend-f8q6.onrender.com/api/auth/profile', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Update UI
            const displayName = document.getElementById('display-name');
            const displayEmail = document.getElementById('display-email');
            const profileAvatar = document.getElementById('profile-avatar');
            
            if (displayName) displayName.textContent = data.full_name || 'User';
            if (displayEmail) displayEmail.innerHTML = `<i class="fas fa-envelope"></i> ${data.email}`;
            
            if (profileAvatar && data.avatar) {
                profileAvatar.src = data.avatar;
            }
            
            // Update saved accounts with latest data
            const currentAccount = getCurrentAccount();
            if (currentAccount && currentAccount.email === data.email) {
                currentAccount.full_name = data.full_name;
                currentAccount.avatar = data.avatar;
                saveCurrentAccount(currentAccount);
                
                // Also update in saved accounts
                const accounts = getSavedAccounts();
                const index = accounts.findIndex(acc => acc.email === data.email);
                if (index >= 0) {
                    accounts[index] = currentAccount;
                    saveSavedAccounts(accounts);
                }
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Modify login success to save account
const originalLoginSuccess = window.loginSuccess;
window.loginSuccess = function(userData, token) {
    // Save token
    localStorage.setItem('token', token);
    
    // Add to saved accounts and set as current
    // Lưu ý: settings sẽ được tạo sau khi user hoàn thành onboarding
    // nên ban đầu settings sẽ là null, user sẽ được chuyển sang onboarding.html
    addOrUpdateAccount({
        id: userData.id,
        full_name: userData.full_name,
        email: userData.email,
        avatar: userData.avatar,
        token: token,
        settings: null // Chưa có settings, buộc phải làm onboarding
    });
    
    // Redirect to onboarding to complete setup
    window.location.href = 'onboarding.html';
};

// 🚀 FIXED: UNBLOCKING INIT SEQUENCE
// 1. Show UI immediately + tabs
// 2. Lazy load heavy features after 500ms
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOMContentLoaded - UNBLOCKING INIT');
    
    // IMMEDIATE: Show loading + basic UI
    showLoadingScreen();
    initTabs(); // UI visible NOW
    
    // LAZY: Heavy features after DOM settled
    setTimeout(() => {
        console.log('⏳ Lazy init: account + weather');
        initAccountSystem();
        getPreciseLocationWithFallback();
    }, 500);
});

// Show loading screen immediately (non-blocking)
function showLoadingScreen() {
    const loadingEl = document.getElementById('loading-screen');
    if (loadingEl) {
        loadingEl.style.display = 'flex';
    }
    
    // Auto hide after 2s or when weather loads
    setTimeout(() => {
        hideLoadingScreen();
    }, 2000);
}

// Hide loading screen
function hideLoadingScreen() {
    const loadingEl = document.getElementById('loading-screen');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// GPS with shorter timeout + fallback (non-blocking)
function getPreciseLocationWithFallback() {
    const account = getCurrentAccount();
    const fallbackCity = account?.settings?.city || 'Can Tho';
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => fetchWeatherData(`${pos.coords.latitude},${pos.coords.longitude}`),
            () => fetchWeatherData(fallbackCity),
            { timeout: 2000, enableHighAccuracy: false } // 2s + low accuracy = fast
        );
    } else {
        fetchWeatherData(fallbackCity);
    }
}

// Also init if DOM already ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    showLoadingScreen();
    initTabs();
    setTimeout(initAccountSystem, 500);
}

function reRenderWeatherUI() {
    const data = window.currentWeatherData; if(!data) return;
    const u = window.appSettings.tempUnit; const isF = u === 'F';
    document.getElementById('current-temp').innerText = Math.round(isF ? data.current.temp_f : data.current.temp_c) + '°' + u;
    document.getElementById('feels-like').innerText = Math.round(isF ? data.current.feelslike_f : data.current.feelslike_c) + '°';
    const forecastList = document.querySelector('.forecast-list');
    if (forecastList) {
        let rows = forecastList.querySelectorAll('.forecast-row');
        data.forecast.forecastday.forEach((dayObj, index) => {
            if(rows[index]) {
                const maxT = Math.round(isF ? dayObj.day.maxtemp_f : dayObj.day.maxtemp_c); const minT = Math.round(isF ? dayObj.day.mintemp_f : dayObj.day.mintemp_c);
                rows[index].querySelector('.f-sun').innerHTML = `<i class="fas fa-temperature-half text-yellow"></i> ${maxT}° / ${minT}°`;
            }
        });
    }
    if(document.getElementById('statistics-view').style.display === 'flex') drawStatistics(data);
}

// =========================================================================
// 10. GPS LOCATION - Waterfall Fallback (GPS -> Default City)
// =========================================================================

/**
 * Hàm lấy thời tiết theo vị trí GPS với Waterfall Fallback
 * @param {string} fallbackCity - Tên thành phố mặc định khi GPS thất bại
 */
function fetchWeatherByGPS(fallbackCity) {
    if (!navigator.geolocation) { fetchWeatherData(fallbackCity); return; }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            window.isUpdatingHomeCity = true; // CỜ BÁO HIỆU: Đang dùng GPS
            fetchWeatherData(`${latitude},${longitude}`);
        },
        (error) => { fetchWeatherData(fallbackCity); },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// Bắt sự kiện click cho nút GPS
document.addEventListener('DOMContentLoaded', function() {
    const gpsBtn = document.getElementById('btn-gps-locate');
    if (gpsBtn) {
        gpsBtn.addEventListener('click', function() {
            // Lấy thông tin user hiện tại
            const account = getCurrentAccount();
            // Fallback city: ưu tiên từ settings, nếu không có thì dùng Cần Thơ
            const fallbackCity = (account?.settings?.city) ? account.settings.city : 'Can Tho';
            console.log('🛰️ GPS button clicked, fallback city:', fallbackCity);
            fetchWeatherByGPS(fallbackCity);
        });
        
        // Thêm hiệu ứng hover cho nút GPS
        gpsBtn.addEventListener('mouseenter', function() {
            this.style.color = '#00c3ff';
        });
        gpsBtn.addEventListener('mouseleave', function() {
            this.style.color = '#0088ff';
        });
    }
});

// =========================================================================
// 10. APP INITIALIZATION & AUTO REFRESH
// =========================================================================

// Moved to initAccountSystem to ensure it runs AFTER account/tasks are loaded 

function getPreciseLocation() {
    const currentAccount = getCurrentAccount();
    if (currentAccount?.settings?.city) return;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                window.isUpdatingHomeCity = true; // CỜ BÁO HIỆU: Đang dùng GPS
                fetchWeatherData(`${pos.coords.latitude},${pos.coords.longitude}`);
            },
            err => console.log("User denied GPS."), { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
}

// Call getPreciseLocation after initial setup
setTimeout(() => {
    getPreciseLocation();
}, 500);

setInterval(() => {
    if (window.lastSearchedQuery) fetchWeatherData(window.lastSearchedQuery);
    else if (window.currentLat && window.currentLon) fetchWeatherData(`${window.currentLat},${window.currentLon}`);
}, 10 * 60 * 1000);

// =========================================================================
// LOGIN HISTORY - Load and display real login history
// =========================================================================

async function loadLoginHistory() {
    const token = localStorage.getItem('token');
    const modalContent = document.querySelector('#login-history-modal .modal-content');
    
    if (!token) {
        if (modalContent) {
            modalContent.innerHTML = `<p style="font-size: 13px; opacity: 0.7;">Vui lòng đăng nhập để xem lịch sử.</p>`;
        }
        return;
    }

    try {
        const response = await fetch(`${AUTH_API_BASE_URL}/login-history`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        });

        const data = await response.json();

        if (response.ok && data.loginHistory && data.loginHistory.length > 0) {
            let html = '';
            
            data.loginHistory.forEach((item, index) => {
                const isCurrent = item.isCurrent;
                const date = new Date(item.loginTime);
                const formattedDate = date.toLocaleDateString('vi-VN', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const formattedTime = date.toLocaleTimeString('vi-VN', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const borderColor = isCurrent ? '#4facfe' : 'rgba(0,0,0,0.1)';
                const dotColor = isCurrent ? '#4facfe' : '#ccc';
                const currentLabel = isCurrent ? `<span style="color: #4facfe; font-weight: 600;"> - Active Now</span>` : '';
                
                html += `
                    <div style="border-left: 2px solid ${borderColor}; padding-left: 15px; margin-bottom: 20px; position: relative;">
                        <div style="position: absolute; left: -6px; top: 0; width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; box-shadow: ${isCurrent ? '0 0 5px #4facfe;' : 'none;'}"></div>
                        <h4 style="margin: 0; font-size: 14px; color: #0f172a;">${item.device || 'Unknown Device'}</h4>
                        <p style="margin: 3px 0 0 0; font-size: 12px; opacity: 0.8;"><i class="fas fa-location-dot" style="color: #ff4757;"></i> ${item.location || 'Unknown Location'}</p>
                        <p style="margin: 3px 0 0 0; font-size: 12px; color: ${isCurrent ? '#4facfe' : '#666'}; font-weight: ${isCurrent ? '600' : '400'};">${formattedDate} - ${formattedTime}${currentLabel}</p>
                    </div>
                `;
            });
            
            if (modalContent) {
                modalContent.innerHTML = html;
            }
        } else {
            if (modalContent) {
                modalContent.innerHTML = `<p style="font-size: 13px; opacity: 0.7;">Chưa có lịch sử đăng nhập.</p>`;
            }
        }
    } catch (error) {
        console.error('Lỗi tải lịch sử đăng nhập:', error);
        if (modalContent) {
            modalContent.innerHTML = `<p style="font-size: 13px; opacity: 0.7; color: red;">Không thể tải lịch sử đăng nhập.</p>`;
        }
    }
}

// =========================================================================
// SYSTEM ANNOUNCEMENT POPUP - Glassmorphism Modal
// =========================================================================

/**
 * Kiểm tra và hiển thị thông báo hệ thống (System Announcement)
 * * Logic hoạt động:
 * 1. Khi load trang index.html, JS sẽ kiểm tra biến muteSystemNotifUntil trong localStorage
 * 2. Nếu thời gian hiện tại (Date.now()) vẫn NHỎ HƠN thời gian trong localStorage -> Bỏ qua
 * 3. Nếu chưa bị tắt hoặc đã hết 8 tiếng -> Gọi API Backend để lấy thông báo
 * 4. Nếu có thông báo, hiển thị Modal popup ra giữa màn hình
 * * Trên Popup có 2 nút:
 * - Nút 'Đóng': Chỉ Ẩn Modal hiện tại (lần sau F5 vẫn hiện lại)
 * - Nút 'Không hiện lại trong 8 tiếng': Ẩn Modal và set localStorage thời gian hiện tại + 8 tiếng
 */
function checkAndShowSystemAnnouncement() {
    // ============================================================
    // 1. LẤY THỜI GIAN TỪ localStorage
    // ============================================================
    const muteUntilStr = localStorage.getItem('muteSystemNotifUntil');
    
    // ============================================================
    // 2. KIỂM TRA XEM CÓ NÊN HIỂN THỊ THÔNG BÁO KHÔNG
    // ============================================================
    // Tính thời gian hiện tại
    const now = Date.now();
    
    // Nếu có giá trị mute trong localStorage và thời gian hiện tại VẪN NHỎ HƠN thời gian mute
    // -> Tức là user đã chọn "Không hiện lại trong 8h" và thời hạn chưa hết
    // -> Bỏ qua, không làm gì cả
    if (muteUntilStr) {
        const muteUntil = parseInt(muteUntilStr, 10);
        if (now < muteUntil) {
            console.log('⏰ System notification đang trong thời gian mute (đến ' + new Date(muteUntil).toLocaleString() + ')');
            return;
        }
    }
    
    // ============================================================
    // 3. GỌI API ĐỂ LẤY THÔNG BÁO HỆ THỐNG
    // ============================================================
    console.log('📡 Đang gọi API lấy thông báo hệ thống...');
    
    // Gọi API Backend: GET /api/notifications/system
    fetch('https://ai-weather-backend-f8q6.onrender.com/api/notifications/system')
        .then(response => {
            if (!response.ok) {
                throw new Error('API request failed with status: ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            console.log('📬 API Response:', data);
            
            // Kiểm tra nếu có thông báo hệ thống
            if (data && data.success && data.notification) {
                const notification = data.notification;
                
                // ============================================================
                // 4. HIỂN THỊ MODAL POPUP
                // ============================================================
                showSystemAnnouncementModal(notification);
            } else {
                console.log('ℹ️ Không có thông báo hệ thống nào');
            }
        })
        .catch(error => {
            console.error('❌ Lỗi khi gọi API lấy thông báo:', error);
            // Không hiển thị gì khi API lỗi (fail silently)
        });
}

/**
 * Hiển thị Modal System Announcement
 * @param {Object} notification - Object chứa thông báo { title, message }
 */
function showSystemAnnouncementModal(notification) {
    // Lấy các element cần thiết
    const modal = document.getElementById('system-announcement-modal');
    const messageEl = document.getElementById('system-announcement-message');
    const closeBtn = document.getElementById('btn-close-announcement');
    const muteBtn = document.getElementById('btn-mute-8h');
    
    if (!modal) {
        console.error('❌ Không tìm thấy modal #system-announcement-modal');
        return;
    }
    
    // Đổ dữ liệu vào HTML
    if (messageEl && notification.message) {
        messageEl.textContent = notification.message;
    }
    
    // Thêm class .show để hiện Modal với animation
    modal.classList.add('show');
    
    // ============================================================
    // XỬ LÝ SỰ KIỆN CLICK CHO 2 NÚT BẤM
    // ============================================================
    
    // Nút 'Đóng' - Chỉ Ẩn Modal (lần sau F5 vẫn hiện lại)
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.classList.remove('show');
            console.log('🔒 Modal đã đóng (sẽ hiện lại khi F5)');
        };
    }
    
    // Nút 'Không hiện lại trong 8h'
    // Ẩn Modal VÀ set localStorage thời gian hiện tại + 8 tiếng
    if (muteBtn) {
        muteBtn.onclick = function() {
            // ============================================================
            // TÍNH TOÁN THỜI GIAN: 8 tiếng = 8 * 60 * 60 * 1000 mili-giây
            // ============================================================
            const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000; // 28,800,000 ms
            const muteUntil = Date.now() + EIGHT_HOURS_MS;
            
            // Lưu vào localStorage
            localStorage.setItem('muteSystemNotifUntil', muteUntil.toString());
            
            // Ẩn Modal
            modal.classList.remove('show');
            
            console.log('🔇 Đã set mute đến: ' + new Date(muteUntil).toLocaleString());
            console.log('⏰ Thời gian hiện tại: ' + new Date().toLocaleString());
            console.log('⏳ Khoảng thời gian: 8 tiếng (' + EIGHT_HOURS_MS + ' ms)');
        };
    }
}

// ============================================================
// KHỞI TẠO: GỌI HÀM VỚI SETTIMEOUT 1.5 GIÂY
// ============================================================
// Delay 1.5 giây sau khi DOM load xong để tạo cảm giác mượt mà
document.addEventListener('DOMContentLoaded', function() {
    // Delay 1.5 giây để web load xong trước khi hiện popup
    setTimeout(function() {
        checkAndShowSystemAnnouncement();
    }, 1500); // 1500ms = 1.5 giây
});

// Hàm để Frontend báo cáo log về cho Backend (ĐÃ FIX BỘ LỌC TỌA ĐỘ)
async function reportApiLog(apiName, statusCode, responseTime, searchedLocation, errorMsg = null) {
    try {
        let userId = null;
        let trueLocation = searchedLocation; // Mặc định là tên thành phố (VD: Can Tho) truyền vào

        // Hàm kiểm tra xem chuỗi có phải là tọa độ không (VD: "10.0175,105.7255")
        const isCoordinate = (str) => /^[0-9.-]+,[0-9.-]+$/.test(str);

        // 1. Lục tìm ID và Vị trí thật trong hồ sơ tài khoản
        const accountStr = localStorage.getItem('currentAccount');
        if (accountStr) {
            const account = JSON.parse(accountStr);
            userId = account.id || null;
            
            // CHỈ LẤY SETTING NẾU NÓ KHÔNG PHẢI LÀ TỌA ĐỘ
            if (account.settings && account.settings.city && !isCoordinate(account.settings.city)) {
                trueLocation = account.settings.city;
            }
        } 
        // 2. Nếu chưa đăng nhập, thử lấy từ cài đặt web hiện tại
        else if (window.appSettings && window.appSettings.city && !isCoordinate(window.appSettings.city)) {
            trueLocation = window.appSettings.city;
        }

        // 3. Nếu trueLocation bằng cách nào đó vẫn dính tọa độ, chặn luôn!
        if (isCoordinate(trueLocation)) {
            trueLocation = "Unknown";
        }

        // 4. Gửi dữ liệu SẠCH về Backend
        await fetch('https://ai-weather-backend-f8q6.onrender.com/api/admin/log-api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                apiName: apiName,
                statusCode: statusCode,
                responseTimeMs: responseTime,
                location: trueLocation, // Đảm bảo 100% không còn tọa độ
                errorMessage: errorMsg
            })
        });
    } catch (e) {
        console.log("Lỗi gửi log:", e);
    }
}

// ==========================================
// CÁCH SỬ DỤNG TRONG HÀM GỌI THỜI TIẾT CỦA BẠN:
// ==========================================
// const startTime = Date.now();
// const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?...`);
// const responseTime = Date.now() - startTime;
//
// if (response.ok) {
//     reportApiLog(200, responseTime, city_name);
// } else {
//     reportApiLog(response.status, responseTime, city_name, "Lỗi fetch thời tiết");
// }

