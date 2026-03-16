/* ============================================
   ADMIN DASHBOARD - JavaScript
   API Integration for User Management & System Alerts
   ============================================ */

const API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/admin';
const SYSTEM_NOTIF_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/notifications/system';

// BIẾN TOÀN CỤC CHO USERS
let currentPage = 1;
let totalPages = 1;
let users = [];
let filteredUsers = [];

// BIẾN TOÀN CỤC CHO SUPPORT (ĐÃ FIX THIẾU BIẾN)
const ticketsTbody = document.getElementById('support-table-body');
let allTickets = [];
let filteredTickets = [];
let currentTicketId = null;
let loading = false;

function getToken() { 
    return localStorage.getItem('token') || localStorage.getItem('adminToken'); 
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
// SETTINGS & MAINTENANCE
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
                const wApiEl = document.getElementById('setting-weatherapi');
                if (wApiEl) wApiEl.value = data.settings.weatherapi_key || ''; 
                
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
        
        const body = {
            gemini_api_key: document.getElementById('setting-gemini').value,
            weather_api_key: document.getElementById('setting-weather').value,
            weatherapi_key: document.getElementById('setting-weatherapi').value,
            maintenance_mode: isMaintained ? 1 : 0
        };
        const response = await fetch(`${API_BASE_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
        if (response.ok) showToast('Cài đặt đã được lưu!', 'success'); else showToast('Lỗi lưu cài đặt', 'error');
    } catch (e) { showToast('Lỗi lưu cài đặt', 'error'); } finally { hideLoading(); }
}

// ============================================
// KIỂM TRA API KEY SIÊU CẤP
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
        const response = await fetch(`${API_BASE_URL}/settings`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(response.ok) {
            const data = await response.json();
            if (data.success && data.settings) {
                const wOk = await checkApiHealthSilent('weather', data.settings.weather_api_key);
                const gOk = await checkApiHealthSilent('gemini', data.settings.gemini_api_key);
                const waOk = await checkApiHealthSilent('weatherapi', data.settings.weatherapi_key); 

                const waDot = document.getElementById('dash-weatherapi-dot');
                const waText = document.getElementById('dash-weatherapi-text');
                if(waDot) waDot.style.background = waOk ? '#10b981' : '#ef4444';
                if(waText) waText.innerHTML = `WeatherAPI: <strong style="color:${waOk ? '#10b981' : '#ef4444'}">${waOk ? 'Online' : 'Offline'}</strong>`;

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
// INITIALIZATION QUAN TRỌNG NHẤT
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    fetchUsers();
    fetchSettings();
    refreshDashboardApiStatus();
    
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
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            if(!page) return;

            document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
            const target = document.getElementById(`${page}-content`); 
            if (target) target.style.display = 'block';
            
            menuItems.forEach(m => m.classList.remove('active')); 
            this.classList.add('active');

            const titles = {
                dashboard: 'Dashboard Hệ thống',
                users: 'Quản lý Người dùng',
                analytics: 'Thống kê & Hiệu suất',
                settings: 'Cài đặt API',
                support: 'Trung tâm Hỗ trợ (Support)'
            };
            const pageTitle = document.getElementById('page-title');
            if(pageTitle && titles[page]) pageTitle.textContent = titles[page];
            
            if (page === 'settings') fetchSettings();
            if (page === 'users') fetchUsers();
            if (page === 'dashboard') { 
                renderDashboardChart(); 
                refreshDashboardApiStatus();
            }
            
            if (page === 'analytics') { 
                initAnalyticsCharts(); 
            } else {
                clearAnalyticsInterval(); // ĐÃ CÓ HÀM NÀY Ở DƯỚI
            }
            
            if (page === 'support') fetchSupportTickets();
        });
    });

    if (document.getElementById('btn-logout')) document.getElementById('btn-logout').addEventListener('click', () => { if (confirm('Đăng xuất khỏi hệ thống?')) { localStorage.clear(); window.location.href = 'login.html'; } });

    // Gạt bảo trì
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
let analyticsCharts = { traffic: null };
let analyticsInterval = null; 

async function initAnalyticsCharts() {
    if (analyticsInterval) clearInterval(analyticsInterval);
    await fetchAnalyticsData();
    analyticsInterval = setInterval(fetchAnalyticsData, 5000);
}

// FIX LỖI 1: KHAI BÁO HÀM DỌN DẸP ANALYTICS ĐỂ KHÔNG BỊ CRASH KHI CHUYỂN TAB
function clearAnalyticsInterval() {
    if (analyticsInterval) {
        clearInterval(analyticsInterval);
        analyticsInterval = null;
    }
}

async function fetchAnalyticsData() {
    const token = getToken();
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            updateAnalyticsUI(data);
        }
    } catch (error) {
        console.error('Lỗi tải Analytics:', error);
    }
}

function updateAnalyticsUI(data) {
    if (document.querySelector('[data-kpi="total"]')) document.querySelector('[data-kpi="total"]').textContent = data.totalRequests || 0;
    if (document.querySelector('[data-kpi="success"]')) document.querySelector('[data-kpi="success"]').textContent = (data.successRate || 0) + '%';
    if (document.querySelector('[data-kpi="latency"]')) document.querySelector('[data-kpi="latency"]').textContent = (data.avgLatency || 0) + 'ms';
    if (document.querySelector('[data-kpi="sessions"]')) document.querySelector('[data-kpi="sessions"]').textContent = data.activeSessions || 0;

    const trafficCtx = document.getElementById('apiTrafficChart');
    if (trafficCtx && data.apiTraffic) {
        if (analyticsCharts.traffic) {
            analyticsCharts.traffic.data.labels = data.apiTraffic.labels || [];
            analyticsCharts.traffic.data.datasets[0].data = data.apiTraffic.openweather || [];
            analyticsCharts.traffic.data.datasets[1].data = data.apiTraffic.weatherapi || [];
            analyticsCharts.traffic.data.datasets[2].data = data.apiTraffic.gemini || [];
            analyticsCharts.traffic.update('none'); 
        } else {
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
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } }, animation: false } 
            });
        }
    }

    if (data.systemHealth) {
        const cpuEl = document.getElementById('sh-cpu');
        const cpuBar = document.getElementById('sh-cpu-bar');
        const memEl = document.getElementById('sh-mem');
        const uptimeEl = document.getElementById('sh-uptime');
        const renderSpeedEl = document.getElementById('sh-render-speed');

        if (cpuEl) cpuEl.textContent = `${data.systemHealth.cpuPercent}%`;
        if (cpuBar) {
            cpuBar.style.width = `${data.systemHealth.cpuPercent}%`;
            cpuBar.style.background = data.systemHealth.cpuPercent > 80 ? 'var(--danger)' : 'var(--primary-blue)';
        }
        if (memEl) memEl.textContent = `${data.systemHealth.memoryUsedGB} GB`;
        if (uptimeEl) uptimeEl.textContent = data.systemHealth.uptime;
        if (renderSpeedEl) renderSpeedEl.textContent = `${data.avgLatency || 0} ms`;
    }

    const apiPerfList = document.getElementById('api-performance-list');
    if (apiPerfList && data.apiPerformance) {
        if (data.apiPerformance.length === 0) {
            apiPerfList.innerHTML = '<p style="text-align:center; color:#9ca3af; padding: 20px;">Chưa có dữ liệu API</p>';
        } else {
            const sortedApis = data.apiPerformance.sort((a, b) => a.avg_time - b.avg_time);
            const maxTime = Math.max(...sortedApis.map(a => a.avg_time), 1); 

            apiPerfList.innerHTML = sortedApis.map(api => {
                const widthPercent = (api.avg_time / maxTime) * 100;
                let colorClass = '#4facfe'; 
                let apiNameLower = (api.api_name || '').toLowerCase();
                if (apiNameLower.includes('gemini')) colorClass = '#f59e0b'; 
                else if (apiNameLower.includes('weatherapi')) colorClass = '#10b981'; 
                
                return `
                    <div class="location-item" style="display: flex; align-items: center; padding: 10px 0;">
                        <span class="location-name" style="min-width: 100px;">${api.api_name}</span>
                        <div class="progress-wrapper" style="flex:1; background: var(--gray-200); height: 8px; border-radius: 4px; margin: 0 10px;">
                            <div class="progress-bar" style="width: ${widthPercent}%; height: 100%; background: ${colorClass}; border-radius: 4px;"></div>
                        </div>
                        <span class="location-count">${api.avg_time} ms</span>
                    </div>
                `;
            }).join('');
        }
    }

    const logsTbody = document.querySelector('.error-logs-table tbody');
    if (logsTbody && data.recentErrors) {
        if (data.recentErrors.length === 0) {
            logsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #10b981;"><i class="fas fa-shield-check"></i> Không có lỗi nào.</td></tr>';
        } else {
            logsTbody.innerHTML = data.recentErrors.map(err => {
                const timeStr = new Date(err.created_at).toLocaleTimeString('vi-VN');
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

// ============================================
// QUẢN LÝ HỖ TRỢ (SUPPORT TICKETS)
// ============================================

async function fetchSupportTickets() {
    const token = getToken();
    if (!token) return;
    if (loading) return;
    loading = true;

    if (ticketsTbody) {
        ticketsTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px;"><i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #4facfe;"></i><br>Đang tải dữ liệu...</td></tr>`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/support`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success) {
            allTickets = data.tickets || [];
            renderTicketTable();
        }
    } catch (error) {
        console.error("Lỗi fetch Support:", error);
    } finally {
        loading = false;
    }
}

function renderTicketTable() {
    if (!ticketsTbody) return;

    if (allTickets.length === 0) {
        ticketsTbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="text-align:center; padding: 40px;"><i class="fas fa-inbox" style="font-size: 32px; color: var(--gray-400);"></i><h3 style="margin-top: 10px; color: var(--gray-500);">Không có phiếu hỗ trợ nào</h3></div></td></tr>`;
        return;
    }

    const statusMap = {
        'pending': { text: 'ĐANG CHỜ', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.2)' },
        'in_progress': { text: 'ĐANG XỬ LÝ', color: 'var(--primary-blue)', bg: 'rgba(79, 172, 254, 0.2)' },
        'resolved': { text: 'ĐÃ XỬ LÝ', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.2)' },
        'rejected': { text: 'TỪ CHỐI', color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.2)' }
    };

    ticketsTbody.innerHTML = allTickets.map(ticket => {
        const st = statusMap[ticket.status] || statusMap['pending'];
        const statusBadge = `<span class="badge" style="background: ${st.bg}; color: ${st.color}; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">${st.text}</span>`;
        
        let actionBtns = `
            <button class="action-btn" onclick="openTicketDetails(${ticket.id})" title="Xem chi tiết" style="background: transparent; border: none; cursor: pointer; color: #4facfe; font-size: 16px; margin: 0 5px;">
                <i class="fas fa-eye"></i>
            </button>
        `;

        if (ticket.status !== 'resolved' && ticket.status !== 'rejected') {
            actionBtns += `
                <button class="action-btn" onclick="changeTicketStatus(${ticket.id}, 'resolved')" title="Đánh dấu Đã xử lý" style="background: transparent; border: none; cursor: pointer; color: var(--success); font-size: 16px; margin: 0 5px;">
                    <i class="fas fa-check"></i>
                </button>
                <button class="action-btn" onclick="changeTicketStatus(${ticket.id}, 'rejected')" title="Từ chối hỗ trợ" style="background: transparent; border: none; cursor: pointer; color: var(--danger); font-size: 16px; margin: 0 5px;">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }
        
        return `
            <tr>
                <td style="padding: 12px 15px;"><strong>${ticket.email}</strong></td>
                <td style="padding: 12px 15px;">${ticket.title}</td>
                <td style="padding: 12px 15px;">${statusBadge}</td>
                <td style="padding: 12px 15px;">${new Date(ticket.created_at).toLocaleDateString('vi-VN')}</td>
                <td style="padding: 12px 15px; text-align: center;">
                    <div style="display: flex; justify-content: center;">${actionBtns}</div>
                </td>
            </tr>
        `;
    }).join('');
}

async function openTicketDetails(ticketId) {
    const token = getToken();
    if (!token) return;
    
    if(typeof showLoading === 'function') showLoading('Đang tải chi tiết...');
    currentTicketId = ticketId;
    
    try {
        const response = await fetch(`${API_BASE_URL}/support/${ticketId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.success && data.ticket) {
            const ticket = Array.isArray(data.ticket) ? data.ticket[0] : data.ticket;
            
            if(!ticket) throw new Error("Dữ liệu rỗng");

            document.getElementById('ticket-modal-title').textContent = ticket.title || 'Không có tiêu đề';
            document.getElementById('ticket-modal-email').textContent = ticket.email || '';
            document.getElementById('ticket-modal-date').textContent = ticket.created_at ? new Date(ticket.created_at).toLocaleString('vi-VN') : '';
            document.getElementById('ticket-modal-message').textContent = ticket.message || '';
            
            const imgContainer = document.getElementById('ticket-modal-images');
            if(imgContainer) {
                imgContainer.innerHTML = '';
                [ticket.image1, ticket.image2, ticket.image3].forEach(img => {
                    if (img && img.trim() !== '') {
                        imgContainer.innerHTML += `<img src="${img}" style="height: 100px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); object-fit: cover; cursor: pointer; margin-right: 10px;" onclick="window.open(this.src)">`;
                    }
                });
            }

            const replyBox = document.getElementById('ticket-reply-text');
            const btnSubmit = document.getElementById('btn-submit-reply'); 

            if(replyBox) {
                if (ticket.status === 'resolved' || ticket.status === 'rejected') {
                    replyBox.value = ticket.admin_reply || `Thư ở trạng thái: ${ticket.status.toUpperCase()}`;
                    replyBox.disabled = true;
                    if(btnSubmit) btnSubmit.style.display = 'none';
                } else {
                    replyBox.value = ticket.admin_reply || ''; 
                    replyBox.disabled = false;
                    if(btnSubmit) btnSubmit.style.display = 'inline-block';
                }
            }

            const modal = document.getElementById('ticket-detail-modal');
            if(modal) {
                modal.style.display = 'flex';
                setTimeout(() => modal.classList.add('show'), 10);
            }
        }
    } catch (error) {
        console.error("Lỗi load details:", error);
        if(typeof showToast === 'function') showToast("Lỗi tải chi tiết thư", "error");
    } finally {
        if(typeof hideLoading === 'function') hideLoading();
    }
}

function closeTicketModal() {
    const modal = document.getElementById('ticket-detail-modal');
    if(modal) {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
    currentTicketId = null;
}

async function submitTicketReply() {
    const token = getToken();
    if (!token || !currentTicketId) return;
    
    const replyText = document.getElementById('ticket-reply-text')?.value.trim();
    if (!replyText) {
        if(typeof showToast === 'function') showToast("Vui lòng nhập nội dung phản hồi!", "warning");
        return;
    }

    if(typeof showLoading === 'function') showLoading('Đang gửi phản hồi...');
    try {
        const response = await fetch(`${API_BASE_URL}/support/${currentTicketId}/reply`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ replyMessage: replyText }) 
        });
        
        const data = await response.json();
        if (data.success) {
            if(typeof showToast === 'function') showToast("Đã gửi phản hồi thành công!", "success");
            closeTicketModal();
            fetchSupportTickets();
        } else {
            if(typeof showToast === 'function') showToast(data.message || "Lỗi khi gửi", "error");
        }
    } catch (error) {
        if(typeof showToast === 'function') showToast("Lỗi kết nối", "error");
    } finally {
        if(typeof hideLoading === 'function') hideLoading();
    }
}

async function changeTicketStatus(ticketId, newStatus) {
    const actionName = newStatus === 'resolved' ? 'ĐÁNH DẤU ĐÃ XỬ LÝ' : 'TỪ CHỐI';
    if (!confirm(`Bạn có chắc chắn muốn ${actionName} yêu cầu này không?`)) return;

    const token = getToken();
    if(typeof showLoading === 'function') showLoading('Đang cập nhật...');
    
    try {
        const response = await fetch(`${API_BASE_URL}/support/${ticketId}/status`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        if (data.success) {
            if(typeof showToast === 'function') showToast("Đã cập nhật trạng thái!", "success");
            fetchSupportTickets(); 
        } else {
            if(typeof showToast === 'function') showToast(data.message || "Lỗi cập nhật", "error");
        }
    } catch (error) {
        if(typeof showToast === 'function') showToast("Lỗi kết nối máy chủ", "error");
    } finally {
        if(typeof hideLoading === 'function') hideLoading();
    }
}

// ==========================================
// UTILITIES: TOAST & LOADING (ĐÃ FIX TRÙNG LẶP)
// ==========================================

function showLoading(text = 'Đang xử lý...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (overlay) {
        if (textEl) textEl.textContent = text;
        overlay.classList.add('show');
        overlay.style.opacity = '1';
        overlay.style.visibility = 'visible';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.style.visibility = 'hidden', 300);
    }
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? 'rgba(16, 185, 129, 0.95)' : (type === 'warning' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(239, 68, 68, 0.95)')};
        color: white; padding: 12px 24px; border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3); backdrop-filter: blur(10px);
        display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 500;
        transform: translateX(120%); transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-times-circle');
    toast.innerHTML = `<i class="fas ${icon}" style="font-size: 18px;"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => setTimeout(() => { toast.style.transform = 'translateX(0)'; }, 10));
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// Global exposure để các nút HTML gọi được
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// Global exposure
window.toggleLock = typeof toggleLock !== 'undefined' ? toggleLock : () => {};
window.changeRole = typeof changeRole !== 'undefined' ? changeRole : () => {};
window.deleteUser = typeof deleteUser !== 'undefined' ? deleteUser : () => {};
window.closeDeleteModal = typeof closeDeleteModal !== 'undefined' ? closeDeleteModal : () => {};
window.executeDeleteUser = typeof executeDeleteUser !== 'undefined' ? executeDeleteUser : () => {};
window.sendBroadcast = typeof sendBroadcast !== 'undefined' ? sendBroadcast : () => {};
window.clearBroadcast = typeof clearBroadcast !== 'undefined' ? clearBroadcast : () => {};
window.saveSettings = typeof saveSettings !== 'undefined' ? saveSettings : () => {};
window.checkApiKey = typeof checkApiKey !== 'undefined' ? checkApiKey : () => {};

window.initAnalyticsCharts = initAnalyticsCharts;
window.fetchSupportTickets = fetchSupportTickets;
window.openTicketDetails = openTicketDetails;
window.closeTicketModal = closeTicketModal;
window.submitTicketReply = submitTicketReply;
window.changeTicketStatus = changeTicketStatus;