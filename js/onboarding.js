/* ============================================
   ONBOARDING PAGE JS
   ============================================ */

// API Base URL - Adjust based on your backend
const API_BASE_URL = 'https://ai-weather-backend-f8q6.onrender.com/api/auth';
const WEATHER_API_KEY = 'd96db3ca494c4a359b8135749260103';

// ========================================
// Helper Functions
// ========================================
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

// ========================================
// City Search & Dropdown Functions
// ========================================
let citySearchTimeout;

function initCitySearch() {
    const cityInput = document.getElementById('onboarding-city-input');
    const dropdown = document.getElementById('onboarding-search-dropdown');
    
    if (!cityInput || !dropdown) return;
    
    // Handle input event
    cityInput.addEventListener('input', function() {
        clearTimeout(citySearchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            dropdown.classList.remove('show');
            return;
        }
        
        // Debounce search
        citySearchTimeout = setTimeout(() => {
            searchCities(query);
        }, 300);
    });
    
    // Handle Enter key
    cityInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const dropdown = document.getElementById('onboarding-search-dropdown');
            if (dropdown && dropdown.classList.contains('show')) {
                const firstItem = dropdown.querySelector('.onboarding-dropdown-item');
                if (firstItem) {
                    firstItem.click();
                }
            } else if (this.value.trim() !== "") {
                // Just accept the typed value
                dropdown.classList.remove('show');
            }
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.onboarding-search-container')) {
            dropdown.classList.remove('show');
        }
    });
}

async function searchCities(query) {
    const dropdown = document.getElementById('onboarding-search-dropdown');
    if (!dropdown) return;
    
    try {
        const safeQuery = encodeURIComponent(removeVietnameseTones(query));
        const response = await fetch(
            `https://api.weatherapi.com/v1/search.json?key=${WEATHER_API_KEY}&q=${safeQuery}`
        );
        
        if (!response.ok) throw new Error("Search API failed");
        
        const locations = await response.json();
        
        // Clear previous results
        dropdown.innerHTML = '';
        
        if (locations.length > 0) {
            locations.forEach(location => {
                const item = document.createElement('div');
                item.className = 'onboarding-dropdown-item';
                
                const cityName = location.name;
                const region = location.region || location.country;
                
                item.innerHTML = `
                    <i class="fas fa-location-dot"></i>
                    <div>
                        <span>${cityName}</span>
                        <span class="region">${region}</span>
                    </div>
                `;
                
                item.addEventListener('click', () => {
                    const cityInput = document.getElementById('onboarding-city-input');
                    console.log('🔍 City suggestion clicked - cityName:', cityName);
                    console.log('🔍 City suggestion clicked - cityInput element:', cityInput);
                    if (cityInput) {
                        console.log('🔍 Setting input value to:', cityName);
                        cityInput.value = cityName;
                        console.log('🔍 After setting - input.value is now:', cityInput.value);
                    } else {
                        console.log('❌ PROBLEM: cityInput element is NULL!');
                    }
                    dropdown.classList.remove('show');
                });
                
                dropdown.appendChild(item);
            });
        } else {
            const mutedItem = document.createElement('div');
            mutedItem.className = 'onboarding-dropdown-muted';
            mutedItem.textContent = 'Không tìm thấy địa điểm...';
            dropdown.appendChild(mutedItem);
        }
        
        dropdown.classList.add('show');
        
    } catch (error) {
        console.error('City search error:', error);
    }
}

// ========================================
// Toast Notification Functions
// ========================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-msg');
    
    if (toast && toastMsg) {
        toastMsg.textContent = message;
        toast.classList.add('show');
        
        // Auto hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// ========================================
// Loading Overlay Functions
// ========================================
function showLoading(text = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    if (overlay) {
        if (loadingText) loadingText.textContent = text;
        overlay.classList.add('show');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

// ========================================
// GPS Location Functionality
// ========================================
async function initGPSButton() {
    const gpsBtn = document.getElementById('btn-gps-location');
    
    if (gpsBtn) {
        gpsBtn.addEventListener('click', function() {
            requestGPSLocation(this);
        });
    }
}

function requestGPSLocation(btnElement) {
    // Check if browser supports geolocation
    if (!navigator.geolocation) {
        showToast('Trình duyệt không hỗ trợ GPS!', 'error');
        return;
    }
    
    // Add loading state
    const originalContent = btnElement.innerHTML;
    btnElement.classList.add('loading');
    btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Đang xác định vị trí...</span>';
    
    // Request location
    navigator.geolocation.getCurrentPosition(
        // Success callback
        async function(position) {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            console.log('GPS Coordinates:', lat, lon);
            
            // Show loading
            showLoading('Đang lấy thông tin thành phố...');
            
            try {
                // Reverse geocoding using OpenStreetMap Nominatim (free, no API key needed)
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
                    {
                        headers: {
                            'Accept-Language': 'en'
                        }
                    }
                );
                
                const data = await response.json();
                
                hideLoading();
                
                if (data.address) {
                    // Try to get city name from different address levels
                    const cityName = data.address.city || 
                                    data.address.town || 
                                    data.address.village || 
                                    data.address.county || 
                                    data.address.state ||
                                    'Unknown Location';
                    
                    // Fill the input
                    const cityInput = document.getElementById('onboarding-city-input');
                    if (cityInput) {
                        cityInput.value = cityName;
                        // Trigger input event to show any suggestions if needed
                        cityInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    showToast(`Đã xác định vị trí: ${cityName}`, 'success');
                } else {
                    showToast('Không tìm thấy tên thành phố!', 'error');
                }
                
            } catch (error) {
                console.error('Reverse geocoding error:', error);
                hideLoading();
                showToast('Lỗi khi lấy tên thành phố!', 'error');
            }
            
            // Reset button
            btnElement.classList.remove('loading');
            btnElement.innerHTML = originalContent;
        },
        // Error callback
        function(error) {
            btnElement.classList.remove('loading');
            btnElement.innerHTML = originalContent;
            
            let errorMessage = 'Lỗi không xác định';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Bạn đã từ chối quyền truy cập vị trí!';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Không thể xác định vị trí của bạn!';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Hết thời gian chờ, vui lòng thử lại!';
                    break;
            }
            
            showToast(errorMessage, 'error');
        },
        // Options
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

// ========================================
// Account & Settings Management
// ========================================
function getCurrentAccount() {
    try {
        const account = localStorage.getItem('currentAccount');
        return account ? JSON.parse(account) : null;
    } catch (e) {
        console.error('Error getting current account:', e);
        return null;
    }
}

function saveCurrentAccount(account) {
    try {
        localStorage.setItem('currentAccount', JSON.stringify(account));
    } catch (e) {
        console.error('Error saving current account:', e);
    }
}

function getSavedAccounts() {
    try {
        const accounts = localStorage.getItem('savedAccounts');
        return accounts ? JSON.parse(accounts) : [];
    } catch (e) {
        console.error('Error getting saved accounts:', e);
        return [];
    }
}

function saveSavedAccounts(accounts) {
    try {
        localStorage.setItem('savedAccounts', JSON.stringify(accounts));
    } catch (e) {
        console.error('Error saving accounts:', e);
    }
}

async function saveUserSettingsToBackend(settings) {
    const account = getCurrentAccount();
    if (!account || !account.token) {
        console.error('No account or token found');
        return false;
    }

    try {
        const response = await fetch(API_BASE_URL + '/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${account.token}`
            },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Settings saved to backend:', data);
            return true;
        } else {
            console.error('Failed to save settings to backend');
            return false;
        }
    } catch (error) {
        console.error('Error saving settings to backend:', error);
        return false;
    }
}

// ========================================
// Initialize Onboarding Controls
// ========================================
function initOnboardingControls() {
    // Temperature control
    const tempControl = document.getElementById('onboarding-temp-control');
    if (tempControl) {
        const tempOptions = tempControl.querySelectorAll('.seg-option');
        tempOptions.forEach(option => {
            option.addEventListener('click', function() {
                tempOptions.forEach(o => o.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // Language control
    const langControl = document.getElementById('onboarding-lang-control');
    if (langControl) {
        const langOptions = langControl.querySelectorAll('.seg-option');
        langOptions.forEach(option => {
            option.addEventListener('click', function() {
                langOptions.forEach(o => o.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
    
    // Get Started button
    const getStartedBtn = document.getElementById('btn-get-started');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', handleOnboardingComplete);
    }
}

// ========================================
// Handle Onboarding Completion
// ========================================
async function handleOnboardingComplete() {
    const cityInput = document.getElementById('onboarding-city-input');
    console.log('🎯 handleOnboardingComplete - cityInput element:', cityInput);
    console.log('🎯 handleOnboardingComplete - cityInput.value:', cityInput?.value);
    console.log('🎯 handleOnboardingComplete - cityInput.value.trim():', cityInput?.value?.trim());
    
    const city = cityInput ? cityInput.value.trim() : 'Can Tho';
    
    console.log('🎯 handleOnboardingComplete - Final city value:', city);
    console.log('🎯 handleOnboardingComplete - Is city empty?:', !city);
    
    if (!city) {
        showToast('Vui lòng nhập tên thành phố!', 'error');
        cityInput.focus();
        return;
    }
    
    // Show loading
    showLoading('Đang lưu cài đặt...');
    
    // Get selected temperature unit
    const tempControl = document.getElementById('onboarding-temp-control');
    const tempUnit = tempControl ? tempControl.querySelector('.seg-option.active').getAttribute('data-value') : 'C';
    
    // Get selected language
    const langControl = document.getElementById('onboarding-lang-control');
    const language = langControl ? langControl.querySelector('.seg-option.active').getAttribute('data-value') : 'en';
    
    // Prepare settings object
    const settings = {
        city: city,
        tempUnit: tempUnit,
        language: language,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: new Date().toISOString()
    };
    
// Get current account
    const account = getCurrentAccount();
    
    console.log('🎯 handleOnboardingComplete - City value:', city);
    console.log('🎯 handleOnboardingComplete - Account before save:', account);
    
    if (account) {
        // Initialize settings if not exist
        if (!account.settings) {
            account.settings = {};
        }
        
        // Save to localStorage first (for immediate use)
        account.settings = settings;
        saveCurrentAccount(account);
        
        console.log('🎯 handleOnboardingComplete - Settings saved to localStorage:', settings);
        console.log('🎯 handleOnboardingComplete - Account after save:', getCurrentAccount());
        
        // Update in saved accounts
        const accounts = getSavedAccounts();
        const index = accounts.findIndex(acc => acc.email === account.email);
        if (index >= 0) {
            accounts[index].settings = settings;
            saveSavedAccounts(accounts);
        }
        
        // Try to save to backend
        await saveUserSettingsToBackend(settings);
    }
    
    // Hide loading
    hideLoading();
    
    // Show success toast
    showToast('Cài đặt hoàn tất! Chuyển đến trang chính...');
    
    // Redirect to index after a short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

// ========================================
// Check if user is authenticated
// ========================================
function checkAuth() {
    const token = localStorage.getItem('token');
    const account = localStorage.getItem('currentAccount');
    
    if (!token || !account) {
        // Not logged in, redirect to login
        window.location.href = 'login.html';
        return false;
    }
    
    return true;
}

// ========================================
// Check if onboarding should be shown
// ========================================
function shouldShowOnboarding() {
    const account = getCurrentAccount();
    
    if (!account) {
        return false; // No account, shouldn't be here
    }
    
    // Check if onboarding is already completed
    if (account.settings && account.settings.hasCompletedOnboarding) {
        // Already completed, redirect to index
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

// ========================================
// Initialize Onboarding Page
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!checkAuth()) {
        return;
    }
    
    // Check if should show onboarding
    if (!shouldShowOnboarding()) {
        return;
    }
    
    // Initialize controls
    initOnboardingControls();
    
    // Initialize GPS button
    initGPSButton();
    
    // Initialize city search with autocomplete
    initCitySearch();
    
    // Set username
    const account = getCurrentAccount();
    if (account) {
        const usernameEl = document.getElementById('onboarding-username');
        if (usernameEl) {
            const firstName = account.full_name ? account.full_name.split(' ')[0] : 'User';
            usernameEl.textContent = `Welcome, ${firstName}!`;
        }
    }
    
    console.log('Onboarding page initialized');
});

