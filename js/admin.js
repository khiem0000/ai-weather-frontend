/* ============================================
   ADMIN DASHBOARD - JavaScript
   API Integration for User Management & System Alerts
   ============================================ */

const API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/admin';
const SYSTEM_NOTIF_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/notifications/system';

let currentPage = 1;
let totalPages = 1;
let users = [];
let filteredUsers = [];

function getToken() { 
    return localStorage.getItem('token'); 
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) { 
        alert(message); 
        return; 
    }
    const icons = { 
        success: 'fa-check-circle', 
        error: 'fa-times-circle', 
        warning: 'fa-exclamation-circle', 
        info: 'fa-info-circle' 
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => { 
        toast.style.animation = 'slideOut 0.3s ease forwards'; 
        setTimeout(() => toast.remove(), 300); 
    }, 4000);
}

function showLoading(text = 'Processing...') { 
    const overlay = document.getElementById('loading-overlay'); 
    if (overlay) overlay.classList.add('show'); 
}

function hideLoading() { 
    const overlay = document.getElementById('loading-overlay'); 
    if (overlay) overlay.classList.remove('show'); 
}

function formatDate(dateString) { 
    if (!dateString) return '--'; 
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); 
}

function getAvatarUrl(name) { 
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=4facfe&color=fff&size=40`; 
}

// ============================================
// USER MANAGEMENT & UI
// ============================================
async function fetchUsers() {
    try {
        const token = getToken();
        if (!token) {
            showToast('Vui lòng đăng nhập để tiếp tục.', 'error');
            setTimeout(() => window.location.href = 'login.html', 1500);
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'GET', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401 || response.status === 403) {
            showToast('⛔ Truy cập bị từ chối! Chỉ Admin mới được vào đây.', 'error');
            setTimeout(() => window.location.href = 'login.html', 2000);
            return;
        }

        const data = await response.json();
        users = data.users || [];
        filteredUsers = [...users];
        
        updateKPICards(); 
        renderUsersTable();
        renderDashboardChart();
        
    } catch (error) {
        showToast('❌ Lỗi kết nối đến máy chủ!', 'error');
        users = []; filteredUsers = [];
        updateKPICards(); renderUsersTable();
    }
}

async function toggleLock(userId, isLocked) {
    try {
        const token = getToken(); 
        showLoading(isLocked ? 'Locking user...' : 'Unlocking user...');
        const response = await fetch(`${API_BASE_URL}/users/${userId}/lock`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ is_locked: isLocked }) 
        });
        
        if (response.ok) { showToast(isLocked ? 'User locked' : 'User unlocked', 'success'); await fetchUsers(); } 
        else { showToast('Update failed', 'error'); }
    } catch (error) { showToast('Update failed', 'error'); } finally { hideLoading(); }
}

async function changeRole(userId, newRole) {
    try {
        const token = getToken(); 
        showLoading(`Changing role to ${newRole}...`);
        const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, { 
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ role: newRole }) 
        });
        
        if (response.ok) { showToast(`Role updated to ${newRole}`, 'success'); await fetchUsers(); } 
        else { showToast('Failed to update role', 'error'); }
    } catch (error) { showToast('Failed to update role', 'error'); } finally { hideLoading(); }
}

let userToDeleteId = null;
function deleteUser(userId) { userToDeleteId = userId; const modal = document.getElementById('delete-confirm-modal'); if (modal) modal.style.display = 'flex'; }
function closeDeleteModal() { userToDeleteId = null; const modal = document.getElementById('delete-confirm-modal'); if (modal) modal.style.display = 'none'; }

async function executeDeleteUser() {
    if (!userToDeleteId) return; 
    const userId = userToDeleteId; closeDeleteModal();
    try {
        const token = getToken(); showLoading('Deleting user...');
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) { showToast('User deleted successfully', 'success'); await fetchUsers(); } 
        else { showToast('Failed to delete user', 'error'); }
    } catch (error) { showToast('Failed to delete user', 'error'); } finally { hideLoading(); }
}

function updateKPICards() {
    if (document.getElementById('total-users')) document.getElementById('total-users').textContent = users.length;
    if (document.getElementById('active-users')) document.getElementById('active-users').textContent = users.filter(u => !u.is_locked && !u.isLocked).length;
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-body'); 
    if (!tbody) return;
    
    if (filteredUsers.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>No users found</h3></div></td></tr>`; 
        return; 
    }
    
    const itemsPerPage = 10; 
    totalPages = Math.ceil(filteredUsers.length / itemsPerPage); 
    const start = (currentPage - 1) * itemsPerPage; 
    const pageUsers = filteredUsers.slice(start, start + itemsPerPage);
    
    tbody.innerHTML = pageUsers.map(user => {
        const fullName = user.full_name || user.fullName || 'Unknown'; 
        const isLocked = user.is_locked === 1 || user.isLocked; 
        const userId = user.id || user._id;
        
        const statusColor = isLocked ? '#ef4444' : '#10b981';
        const statusText = isLocked ? 'Locked' : 'Active';
        
        return `<tr>
            <td><div class="user-cell"><img src="${getAvatarUrl(fullName)}" class="user-avatar"><span>${fullName}</span></div></td>
            <td>${user.email || '--'}</td>
            <td><span class="role-badge ${user.role || 'user'}">${user.role || 'user'}</span></td>
            <td>
                <span class="status-dot ${isLocked ? 'locked' : 'active'}" style="background-color: ${statusColor};"></span> 
                <span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td><div class="actions-cell">
                <button class="action-btn" onclick="toggleLock('${userId}', ${!isLocked})"><i class="fas ${isLocked ? 'fa-lock-open' : 'fa-lock'}"></i></button>
                <button class="action-btn" onclick="changeRole('${userId}', '${user.role === 'admin' ? 'user' : 'admin'}')"><i class="fas fa-user-shield"></i></button>
                <button class="action-btn delete-btn" onclick="deleteUser('${userId}')"><i class="fas fa-trash"></i></button>
            </div></td></tr>`;
    }).join('');
    
    updatePagination();
}

function updatePagination() {
    if (document.getElementById('current-page')) document.getElementById('current-page').textContent = currentPage;
    if (document.getElementById('prev-page')) document.getElementById('prev-page').disabled = currentPage === 1; 
    if (document.getElementById('next-page')) document.getElementById('next-page').disabled = currentPage >= totalPages;
}

// ============================================
// BIỂU ĐỒ TRÒN (DOUGHNUT CHART)
// ============================================
function renderDashboardChart() {
    const ctx = document.getElementById('usersChart');
    if (!ctx) return;
    if (typeof Chart === 'undefined') return;
    if (window.myChart) window.myChart.destroy();
    
    const activeCount = users.filter(u => !u.is_locked && !u.isLocked).length;
    const lockedCount = users.length - activeCount;
    
    window.myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Đang hoạt động (Active)', 'Bị khóa (Locked)'],
            datasets: [{
                data: [activeCount, lockedCount],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0, hoverOffset: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// ============================================
// SYSTEM ALERT & BROADCAST
// ============================================
function sendBroadcast() {
    const input = document.getElementById('broadcast-input') || document.getElementById('broadcast-message');
    const messageStr = input ? input.value.trim() : "";
    if (!messageStr) { showToast('Vui lòng nhập nội dung thông báo', 'warning'); return; }
    
    const modalHTML = `
    <div class="glass-modal-overlay" id="push-confirm-modal">
        <div class="glass-modal-content">
            <div class="glass-modal-icon warning"><i class="fas fa-bell"></i></div>
            <h3>Đẩy Thông Báo!</h3>
            <p>Bạn có muốn đẩy thông báo này lên <strong>MÀN HÌNH KHÓA</strong> của tất cả người dùng không?</p>
            <div class="glass-modal-buttons">
                <button class="btn-glass cancel" id="btn-push-no">Chỉ hiện ở Web</button>
                <button class="btn-glass confirm" id="btn-push-yes">Đẩy lên ĐT</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML); 
    const modal = document.getElementById('push-confirm-modal'); 
    setTimeout(() => { if (modal) modal.classList.add('show'); }, 10);
    
    if (document.getElementById('btn-push-no')) document.getElementById('btn-push-no').onclick = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); executeSystemAnnouncement(messageStr, false); };
    if (document.getElementById('btn-push-yes')) document.getElementById('btn-push-yes').onclick = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); executeSystemAnnouncement(messageStr, true); };
}

async function executeSystemAnnouncement(messageStr, isSendPush) {
    showLoading('Đang phát sóng thông báo...'); const token = getToken();
    try {
        const response = await fetch(SYSTEM_NOTIF_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ message: messageStr, sendPush: isSendPush }) });
        if (response.ok) { showToast('✅ Đã phát sóng thành công!', 'success'); const input = document.getElementById('broadcast-input'); if (input) input.value = ''; } 
        else { showToast('❌ Lỗi gửi thông báo!', 'error'); }
    } catch (error) { showToast('❌ Lỗi kết nối.', 'error'); } finally { hideLoading(); }
}

async function clearBroadcast() {
    if (!confirm('Bạn có chắc muốn gỡ thông báo hiện tại trên toàn hệ thống?')) return;
    showLoading('Đang gỡ thông báo...'); const token = getToken();
    try {
        const response = await fetch(SYSTEM_NOTIF_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ message: "", sendPush: false }) });
        if (response.ok) showToast('Đã gỡ thông báo', 'success');
    } catch (e) { showToast('Lỗi khi gỡ', 'error'); } finally { hideLoading(); }
}

// ============================================
// SETTINGS & MAINTENANCE (ĐÃ FIX: XÓA CHỖ THỪA)
// ============================================
async function fetchSettings() {
    try {
        const token = getToken();
        if(!token) return;
        const response = await fetch(`${API_BASE_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(response.ok) {
            const data = await response.json();
            if (data.success && data.settings) {
                const geminiEl = document.getElementById('setting-gemini'); 
                const weatherEl = document.getElementById('setting-weather');
                if (geminiEl) geminiEl.value = data.settings.gemini_api_key || '';
                if (weatherEl) weatherEl.value = data.settings.weather_api_key || '';
                // Thêm dòng này để load key thứ 3
                const wApiEl = document.getElementById('setting-weatherapi');
                if (wApiEl) wApiEl.value = data.settings.weatherapi_key || ''; // Giả sử backend lưu cột này
                
                const mtMain = document.getElementById('maintenance-toggle'); 
                if (mtMain) mtMain.checked = (data.settings.maintenance_mode === 1); 
            }
        }
    } catch (e) { console.error('Lỗi fetchSettings:', e); }
}


async function saveSettings() {
    showLoading('Đang lưu cài đặt...'); const token = getToken();
    try {
        const mtMain = document.getElementById('maintenance-toggle'); 
        const isMaintained = (mtMain && mtMain.checked);
        
        const geminiVal = document.getElementById('setting-gemini') ? document.getElementById('setting-gemini').value : '';
        const weatherVal = document.getElementById('setting-weather') ? document.getElementById('setting-weather').value : '';
        
        const body = {
            gemini_api_key: document.getElementById('setting-gemini').value,
            weather_api_key: document.getElementById('setting-weather').value,
            weatherapi_key: document.getElementById('setting-weatherapi').value, // Thêm key mới
            maintenance_mode: isMaintained ? 1 : 0
        };
        const response = await fetch(`${API_BASE_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
        if (response.ok) showToast('Cài đặt đã được lưu!', 'success'); else showToast('Lỗi lưu cài đặt', 'error');
    } catch (e) { showToast('Lỗi lưu cài đặt', 'error'); } finally { hideLoading(); }
}


// ============================================
// KIỂM TRA API KEY SIÊU CẤP (CÓ ĐỌC LỖI CHI TIẾT)
// ============================================
async function checkApiKey(type, btn) {
    const inputId = type === 'weather' ? 'setting-weather' : (type === 'gemini' ? 'setting-gemini' : 'setting-weatherapi');
    const inputEl = document.getElementById(inputId);
    const key = inputEl ? inputEl.value.trim() : '';

    if (!key) { 
        showToast('⚠️ Vui lòng nhập Key trước khi thử!', 'warning'); 
        return; 
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
    btn.disabled = true;

    let url = '';
    if (type === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    } else if (type === 'weather') {
        url = `https://api.openweathermap.org/data/2.5/weather?q=Hanoi&appid=${key}`;
    } else if (type === 'weatherapi') {
        url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=Hanoi`;
    }

    try {
        const res = await fetch(url);
        let data;
        try {
            data = await res.json();
        } catch (jsonError) {
            throw new Error('Invalid JSON response');
        }

        if (res.ok) {
            showToast(`✅ ${type.toUpperCase()} Key hoạt động tốt!`, 'success');
            btn.style.background = '#10b981';
        } else {
            let errorMsg = data.error?.message || data.message || 'Key không hợp lệ';
            showToast(`❌ ${type.toUpperCase()}: ${errorMsg}`, 'error');
            btn.style.background = '#ef4444';
        }
    } catch (error) {
        console.error("API Check Error:", error);
        const errorMsg = error.message.includes('Failed to fetch') ? 'Lỗi kết nối! Kiểm tra Internet/Adblock.' : error.message;
        showToast(`❌ ${type.toUpperCase()}: ${errorMsg}`, 'error');
        btn.style.background = '#f59e0b';
    } finally {
        // LUÔN LUÔN reset nút sau ĐÚNG 3 GIÂY
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = '';
        }, 3000);
    }
}


function resetBtn(btn, text) {
    if (!btn) return;
    btn.innerHTML = text; btn.disabled = false; btn.style.opacity = "1";
    btn.style.background = ''; btn.style.color = ''; btn.style.border = '';
}

// ============================================
// GIÁM SÁT SỨC KHỎE API TỰ ĐỘNG Ở DASHBOARD
// ============================================
async function checkApiHealthSilent(type, key) {
    if (!key) return false;
    let url = '';
    if (type === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    } else if (type === 'weather') {
        url = `https://api.openweathermap.org/data/2.5/weather?q=Hanoi&appid=${key}`;
    } else if (type === 'weatherapi') {
        url = `https://api.weatherapi.com/v1/current.json?key=${key}&q=Hanoi`;
    }
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) { return false; }
}

async function refreshDashboardApiStatus() {
    const token = getToken();
    if(!token) return;
    try {
        // ... (lấy settings từ DB)
        const response = await fetch(`${API_BASE_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(response.ok) {
            const data = await response.json();
            if (data.success && data.settings) {
                const wOk = await checkApiHealthSilent('weather', data.settings.weather_api_key);
                const gOk = await checkApiHealthSilent('gemini', data.settings.gemini_api_key);
                const waOk = await checkApiHealthSilent('weatherapi', data.settings.weatherapi_key); // Check key thứ 3

                // Cập nhật đèn báo WeatherAPI (Backup)
                const waDot = document.getElementById('dash-weatherapi-dot');
                const waText = document.getElementById('dash-weatherapi-text');
                if(waDot) waDot.style.background = waOk ? '#10b981' : '#ef4444';
                if(waText) waText.innerHTML = `WeatherAPI: <strong style="color:${waOk ? '#10b981' : '#ef4444'}">${waOk ? 'Online' : 'Offline'}</strong>`;

                // Cập nhật giao diện: Xanh = Online, Đỏ = Offline
                const wDot = document.getElementById('dash-weather-dot'); const wText = document.getElementById('dash-weather-text');
                const gDot = document.getElementById('dash-gemini-dot'); const gText = document.getElementById('dash-gemini-text');
                
                if(wDot) wDot.style.background = wOk ? '#10b981' : '#ef4444';
                if(wText) wText.innerHTML = `OpenWeather: <strong style="color:${wOk ? '#10b981' : '#ef4444'}">${wOk ? 'Online' : 'Offline'}</strong>`;
                
                if(gDot) gDot.style.background = gOk ? '#10b981' : '#ef4444';
                if(gText) gText.innerHTML = `Gemini: <strong style="color:${gOk ? '#10b981' : '#ef4444'}">${gOk ? 'Online' : 'Offline'}</strong>`;
            }
        }
    } catch(e) { console.error('Lỗi check health:', e); }
}


// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    fetchUsers();
    fetchSettings();
    refreshDashboardApiStatus(); // Chạy check tự động khi vừa vào web
    
    const searchInput = document.getElementById('search-users');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            filteredUsers = users.filter(u => (u.email && u.email.toLowerCase().includes(q)) || (u.full_name && u.full_name.toLowerCase().includes(q)));
            currentPage = 1; renderUsersTable();
        });
    }

    if (document.getElementById('prev-page')) document.getElementById('prev-page').addEventListener('click', () => { if(currentPage > 1) { currentPage--; renderUsersTable(); } });
    if (document.getElementById('next-page')) document.getElementById('next-page').addEventListener('click', () => { if(currentPage < totalPages) { currentPage++; renderUsersTable(); } });

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
            const target = document.getElementById(`${page}-content`); 
            if (target) target.style.display = 'block';
            
            menuItems.forEach(m => m.classList.remove('active')); this.classList.add('active');
            
            if (page === 'settings') fetchSettings();
            if (page === 'users') fetchUsers();
            if (page === 'dashboard') { 
                renderDashboardChart(); 
                refreshDashboardApiStatus();
            }
            
            // DÒNG QUAN TRỌNG: Kích hoạt tải dữ liệu khi vào tab Analytics
            if (page === 'analytics') { 
                initAnalyticsCharts(); 
            }
        });
    });

    if (document.getElementById('btn-logout')) document.getElementById('btn-logout').addEventListener('click', () => { if (confirm('Đăng xuất khỏi hệ thống?')) { localStorage.clear(); window.location.href = 'login.html'; } });

    // Gạt bảo trì (Chỉ có 1 nút duy nhất ở Dashboard)
    const toggleBtn = document.getElementById('maintenance-toggle'); 
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault(); 
            const targetState = this.checked; 
            const modalHTML = `<div class="glass-modal-overlay" id="maintenance-confirm-modal"><div class="glass-modal-content"><div class="glass-modal-icon ${targetState ? 'danger' : 'success'}"><i class="fas ${targetState ? 'fa-tools' : 'fa-check-circle'}"></i></div><h3>Xác nhận ${targetState ? 'Bật' : 'Tắt'} Bảo trì?</h3><p>${targetState ? 'Khi bật, người dùng sẽ <strong>KHÔNG THỂ</strong> sử dụng Chatbot AI.' : 'Khi tắt, Chatbot AI sẽ hoạt động lại bình thường.'}</p><div class="glass-modal-buttons"><button class="btn-glass cancel" id="btn-maint-cancel">Hủy</button><button class="btn-glass confirm" id="btn-maint-confirm">Xác nhận</button></div></div></div>`;
            document.body.insertAdjacentHTML('beforeend', modalHTML); const modal = document.getElementById('maintenance-confirm-modal'); setTimeout(() => { if (modal) modal.classList.add('show'); }, 10);
            
            if (document.getElementById('btn-maint-cancel')) document.getElementById('btn-maint-cancel').onclick = () => { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); };
            if (document.getElementById('btn-maint-confirm')) document.getElementById('btn-maint-confirm').onclick = () => {
                modal.classList.remove('show'); setTimeout(() => modal.remove(), 300);
                toggleBtn.checked = targetState;
                saveSettings(); 
            };
        });
    }
});

// ============================================
// REAL ANALYTICS DATA INTEGRATION
// ============================================
let analyticsCharts = { traffic: null, error: null };

async function initAnalyticsCharts() {
    const timeFilter = document.getElementById('time-filter');
    const period = timeFilter ? timeFilter.value : 'today';
    await fetchAnalyticsData(period);
}

async function fetchAnalyticsData(timeRange) {
    const token = getToken();
    if (!token) return;

    try {
        // Gọi API thật từ Backend mà BlackboxAI vừa tạo
        const response = await fetch(`${API_BASE_URL}/analytics?range=${timeRange}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateAnalyticsUI(data);
        }
    } catch (error) {
        console.error('Lỗi tải Analytics:', error);
        showToast('Không thể tải dữ liệu thống kê!', 'error');
    }
}

function updateAnalyticsUI(data) {
    // 1. Cập nhật thẻ KPI
    if (document.querySelector('[data-kpi="total"]')) document.querySelector('[data-kpi="total"]').textContent = data.totalRequests || 0;
    if (document.querySelector('[data-kpi="success"]')) document.querySelector('[data-kpi="success"]').textContent = (data.successRate || 0) + '%';
    if (document.querySelector('[data-kpi="latency"]')) document.querySelector('[data-kpi="latency"]').textContent = (data.avgLatency || 0) + 'ms';
    // Active Sessions tạm thời đếm số user đang không bị khóa
    if (document.querySelector('[data-kpi="sessions"]')) document.querySelector('[data-kpi="sessions"]').textContent = users.filter(u => !u.is_locked).length || 1;

    // 2. Cập nhật Biểu đồ đường (Traffic)
    const trafficCtx = document.getElementById('apiTrafficChart');
    if (trafficCtx && data.apiTraffic) {
        if (analyticsCharts.traffic) analyticsCharts.traffic.destroy();
        analyticsCharts.traffic = new Chart(trafficCtx, {
            type: 'line',
            data: {
                labels: data.apiTraffic.labels || [],
                datasets: [
                    { label: 'OpenWeather', data: data.apiTraffic.openweather || [], borderColor: '#4facfe', backgroundColor: 'rgba(79, 172, 254, 0.1)', tension: 0.4, fill: true },
                    { label: 'WeatherAPI', data: data.apiTraffic.weatherapi || [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.4, fill: true },
                    { label: 'Gemini', data: data.apiTraffic.gemini || [], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.4, fill: true }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }
        });
    }

    // 3. Cập nhật Biểu đồ tròn (Lỗi)
    const errorCtx = document.getElementById('errorPieChart');
    if (errorCtx && data.successRate !== undefined) {
        if (analyticsCharts.error) analyticsCharts.error.destroy();
        const successVal = parseFloat(data.successRate);
        const errorVal = 100 - successVal;
        
        analyticsCharts.error = new Chart(errorCtx, {
            type: 'doughnut',
            data: {
                labels: ['Thành công', 'Lỗi (Từ chối/Hết key)'],
                datasets: [{
                    data: [successVal, errorVal],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0, hoverOffset: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // 4. Cập nhật Top Locations
    const locationsList = document.querySelector('.locations-list');
    if (locationsList && data.topLocations) {
        if (data.topLocations.length === 0) {
            locationsList.innerHTML = '<p style="text-align:center; color:#9ca3af; padding: 20px;">Chưa có dữ liệu vị trí</p>';
        } else {
            locationsList.innerHTML = data.topLocations.map(loc => `
                <div class="location-item">
                    <span class="location-name">${loc.name}</span>
                    <div class="progress-wrapper">
                        <div class="progress-bar" style="width: ${loc.percentage}%"></div>
                    </div>
                    <span class="location-count">${loc.percentage}%</span>
                </div>
            `).join('');
        }
    }

    // 5. Cập nhật Error Logs
    const logsTbody = document.querySelector('.error-logs-table tbody');
    if (logsTbody && data.recentErrors) {
        if (data.recentErrors.length === 0) {
            logsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #10b981;"><i class="fas fa-shield-check"></i> Tuyệt vời! Hệ thống không có lỗi nào.</td></tr>';
        } else {
            logsTbody.innerHTML = data.recentErrors.map(err => {
                const timeStr = new Date(err.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                const badgeClass = err.status_code >= 500 ? 'warning' : 'error';
                return `
                    <tr>
                        <td>${timeStr}</td>
                        <td>${err.api_name}</td>
                        <td><span class="badge ${badgeClass}">${err.status_code}</span></td>
                        <td>${err.error_message || 'Lỗi không xác định'}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}

// Bắt sự kiện khi đổi bộ lọc thời gian
document.addEventListener('change', function(e) {
    if (e.target.id === 'time-filter') {
        fetchAnalyticsData(e.target.value);
    }
});

// Global exposure
window.toggleLock = toggleLock;
window.changeRole = changeRole;
window.deleteUser = deleteUser;
window.closeDeleteModal = closeDeleteModal;
window.executeDeleteUser = executeDeleteUser;
window.sendBroadcast = sendBroadcast;
window.clearBroadcast = clearBroadcast;
window.saveSettings = saveSettings;
window.checkApiKey = checkApiKey;
window.initAnalyticsCharts = initAnalyticsCharts;

