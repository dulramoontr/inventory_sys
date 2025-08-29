// =================================================================
// CONFIGURATION
// Google Apps Script URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZMCD8Sh3Vhx4dc0rpSUNTjhOdt-Sj7r9zQKN9AsvhfkJSvdstZWU9_IK8_3GDKz4GNg/exec';
// =================================================================

// --- Global State ---
let allItems = [];
let inventoryLogs = [];
let currentItemCategory = ''; 

// --- Utility Functions ---
let loader; // **** CHANGED: Declare loader here, but don't assign it yet.
const showLoader = () => loader && loader.classList.remove('hidden');
const hideLoader = () => loader && loader.classList.add('hidden');

function getFormattedDate(timestampStr) {
    const date = new Date(timestampStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const weekday = date.toLocaleDateString('zh-TW', { weekday: 'long' });
    return `${year}年${month}月${day}日 ${weekday}`;
}

function getFormattedDateTime(timestampStr) {
    const date = new Date(timestampStr);
    if (isNaN(date)) return '無效日期';
    return date.toLocaleString('sv-SE'); // YYYY-MM-DD HH:MM:SS
}

// --- API Request ---
async function apiRequest(method, payload) {
    showLoader();
    try {
        let url = new URL(GAS_URL);
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            redirect: 'follow',
        };

        if (method === 'GET' && payload) {
            Object.keys(payload).forEach(key => url.searchParams.append(key, payload[key]));
        } else if (method === 'POST') {
            options.body = JSON.stringify(payload);
        }

        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        if (!result.success) {
            console.error('API Error:', result.message);
            alert(`API 請求失敗: ${result.message}`);
        }
        return result;

    } catch (error) {
        console.error('Fetch/API Error:', error);
        alert(`網路或伺服器錯誤: ${error.message}`);
        return { success: false, message: error.message };
    } finally {
        hideLoader();
    }
}

// --- UI Components ---
function populateHistoryDropdown(logs, selectId, filterByCategory = null) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    let filteredLogs = logs;
    if (filterByCategory) {
        filteredLogs = logs.filter(log => log.category === filterByCategory);
    }
    
    select.innerHTML = `<option value="">-- 從歷史紀錄載入 --</option>`;
    filteredLogs.forEach(log => {
        const option = document.createElement('option');
        option.value = log.logId;
        option.textContent = getFormattedDateTime(log.timestamp);
        select.appendChild(option);
    });
}

function setupFAB(containerId) {
    const fabContainer = document.getElementById(containerId);
    if (!fabContainer) return;

    const fabButton = fabContainer.querySelector('.fab');
    const fabActions = fabContainer.querySelector('.fab-actions');

    fabButton.addEventListener('click', () => {
        fabActions.classList.toggle('hidden');
        fabButton.classList.toggle('active');
    });

    // Hide actions if clicked outside
    document.addEventListener('click', (event) => {
        if (!fabContainer.contains(event.target)) {
            fabActions.classList.add('hidden');
            fabButton.classList.remove('active');
        }
    });
}

// --- Action Functions ---
function copyOrderText() {
    const preview = document.getElementById('order-preview');
    if (!preview) return;

    const titleElement = document.getElementById('order-subtitle');
    const dateElement = document.getElementById('order-date');
    const listElement = document.getElementById('order-list-container');
    
    const title = titleElement ? titleElement.textContent : '';
    const date = dateElement ? dateElement.textContent : '';
    let itemsText = listElement ? listElement.innerText : '';

    const fullText = `${title}\n${date}\n-------------------\n${itemsText}`;

    navigator.clipboard.writeText(fullText).then(() => {
        alert('叫貨單文字已複製！');
    }).catch(err => {
        alert('複製失敗！');
        console.error('Could not copy text: ', err);
    });
}

async function shareToLineText() {
    const preview = document.getElementById('order-preview');
    if (!preview) {
        alert('沒有可分享的內容。');
        return;
    }

    const titleElement = document.getElementById('order-subtitle');
    const dateElement = document.getElementById('order-date');
    const listElement = document.getElementById('order-list-container');

    const title = titleElement ? titleElement.textContent : '叫貨單';
    const date = dateElement ? dateElement.textContent : '';
    let itemsText = listElement ? listElement.innerText.replace(/\t/g, ' ') : ''; 

    const fullText = `${title}\n${date}\n-------------------\n${itemsText}`;

    const shareData = {
        title: title,
        text: fullText,
    };

    // 檢查瀏覽器是否支援 Web Share API
    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            // 如果使用者取消分享，則不顯示錯誤訊息
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        }
    } else {
        // 如果不支援，則使用傳統的 LINE URL Scheme 作為備用方案
        const fallbackUrl = `https://line.me/R/msg/text/?${encodeURIComponent(fullText)}`;
        window.open(fallbackUrl, '_blank');
    }
}


// Fallback function for browsers not supporting sharing files
function fallbackShare(canvas, title) {
    const link = document.createElement('a');
    link.download = `${title}.png`;
    link.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    link.click();
}


async function shareToLineImage() {
    showLoader();
    const element = document.getElementById('order-preview');
    if (!element) {
        hideLoader();
        return;
    }
    const title = document.getElementById('order-subtitle')?.textContent || '叫貨單';

    try {
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        if (navigator.share) {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], `${title}.png`, { type: blob.type });
                const shareData = { files: [file], title: title, text: `你好，這是今天的${title}。` };
                if (navigator.canShare(shareData)) {
                    try {
                        await navigator.share(shareData);
                    } catch (err) {
                        console.log("分享被取消或失敗:", err);
                    }
                } else {
                    fallbackShare(canvas, title);
                }
            }, 'image/png');
        } else {
            fallbackShare(canvas, title);
        }
    } catch (error) {
        console.error('分享失敗:', error);
        alert(`產生圖片失敗: ${error.message}`);
    } finally {
        hideLoader();
    }
}


// --- Page Initializer Router ---
document.addEventListener('DOMContentLoaded', () => {
    // **** CHANGED: Assign loader now that the DOM is fully loaded.
    loader = document.getElementById('loader');

    const path = window.location.pathname.split("/").pop();
    switch (path) {
        case 'settings.html':
            initSettingsPage();
            break;
        case 'inventory.html':
            initInventoryPage();
            break;
        case 'order.html':
            initOrderPage();
            break;
        case 'veg-order.html':
            initVegOrderPage();
            break;
        case 'index.html':
            // No init for index page
            break;
    }
});