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
    return date.toLocaleString('sv-SE'); // YYYY-MM-DD HH:MM:SS format
}

async function apiRequest(method, payload) {
    showLoader();
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        };
        if (method === 'POST') {
            options.body = JSON.stringify(payload);
        }
        
        let url = GAS_URL;
        if (method === 'GET') {
           url += `?action=${payload.action}`;
           if(payload.logId) url += `&logId=${payload.logId}`;
        }

        const response = await fetch(url, options);
        if (!response.ok) throw new Error('網路回應錯誤，請檢查您的網路連線。');
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'API 請求失敗，請稍後再試。');
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        alert(`發生錯誤: ${error.message}`);
        return null;
    } finally {
        hideLoader();
    }
}

// --- Floating Action Button (FAB) Logic ---
function setupFAB(containerId) {
    const fabContainer = document.getElementById(containerId);
    if (!fabContainer) return;

    if (document.body.scrollHeight > window.innerHeight) {
        fabContainer.classList.add('visible');
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            fabContainer.classList.add('visible');
        } else {
            fabContainer.classList.remove('visible');
        }
    }, { passive: true });
}

function populateHistoryDropdown(logs, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">請選擇...</option>';
    logs.forEach(log => {
        const option = document.createElement('option');
        option.value = log.logId;
        option.textContent = `${log.category} - ${getFormattedDateTime(log.timestamp)}`;
        select.appendChild(option);
    });
}

function getFullOrderText() {
    const mainTitleEl = document.getElementById('order-main-title');
    const subtitleEl = document.getElementById('order-subtitle');
    const dateEl = document.getElementById('order-date');
    const listContainer = document.getElementById('order-list-container');

    const mainTitle = mainTitleEl ? mainTitleEl.textContent : '';
    const subtitle = subtitleEl ? subtitleEl.textContent : '叫貨單';
    const date = dateEl ? dateEl.textContent : '';
    
    let listContent = '';
    const rows = listContainer.querySelectorAll('.flex.justify-between');

    if (listContainer.querySelector('.whitespace-pre-wrap')) {
        listContent = listContainer.innerText;
    } else if (rows.length > 0) {
        let content = [];
        rows.forEach(row => {
            const left = row.children[0]?.textContent || '';
            const right = row.children[1]?.textContent || '';
            content.push(`${left}\t${right}`);
        });
        listContent = content.join('\n');
    } else {
        listContent = listContainer.innerText;
    }

    return `${mainTitle} ${subtitle}\n${date}\n\n${listContent.trim()}`;
}


function copyOrderText() {
    const textToCopy = getFullOrderText();
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('清單文字已複製！');
    }, (err) => {
        alert('複製失敗: ', err);
    });
}

async function shareToLineText() {
    const textToCopy = getFullOrderText();
    if (!textToCopy) return;

    const subtitleEl = document.getElementById('order-subtitle');
    const title = subtitleEl ? subtitleEl.textContent : '叫貨單';

    // Fallback function for browsers that don't support Web Share API
    const fallbackShare = () => {
        const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(textToCopy)}`;
        window.open(lineUrl, '_blank');
    };

    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: textToCopy,
            });
        } catch (error) {
            console.log('分享被取消或失敗:', error);
        }
    } else {
        fallbackShare();
    }
}

async function shareToLineImage() {
    showLoader();
    const orderPreview = document.getElementById('order-preview');
    const titleEl = document.getElementById('order-subtitle');
    const title = titleEl ? titleEl.textContent : '叫貨單';

    try {
        const canvas = await html2canvas(orderPreview, { scale: 2, backgroundColor: '#f8fafc' });
        const fallbackShare = (canvas, title) => {
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `${title}.png`;
            link.click();
            alert("您的瀏覽器不支援直接分享。圖片已為您下載，請手動分享至 LINE。");
        };

        if (navigator.share && navigator.canShare) {
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
            // No initialization needed for index page
            break;
    }
});