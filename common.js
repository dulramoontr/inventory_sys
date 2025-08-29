// =================================================================
// COMMON FUNCTIONS & VARIABLES
// =================================================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycby5tT6k0d2zLXq7syYPH--uQYV_7fDkhtCAGf-v1h_m_m_oztXw273zZsmJNN_xxnF_/exec';
let allItems = [];
let inventoryLogs = [];
let currentItemCategory = '央廚';

// --- API Request ---
async function apiRequest(method, payload) {
    showLoader();
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'text/plain;charset=utf-t' },
        };
        let url = GAS_URL;

        if (method === 'GET') {
            const params = new URLSearchParams(payload);
            url += `?${params.toString()}`;
        } else { // POST
            options.body = JSON.stringify(payload);
        }

        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Request Failed: ${response.status} ${errorText}`);
        }
        const result = await response.json();

        if (!result.success) {
            const message = result.message || '發生未知錯誤';
            console.error('API Error:', message, 'Payload:', payload);
            alert(`錯誤: ${message}`);
            return null;
        }
        return result;

    } catch (error) {
        console.error('Fetch Error:', error);
        alert(`網路連線或伺服器發生問題: ${error.message}`);
        return null;
    } finally {
        hideLoader();
    }
}

// --- UI Helpers ---
function showLoader() { document.getElementById('loader')?.classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader')?.classList.add('hidden'); }

function getFormattedDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
}

function getFormattedDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const datePart = getFormattedDate(isoString);
    const timePart = date.toTimeString().split(' ')[0].substring(0, 5);
    return `${datePart} ${timePart}`;
}


function populateHistoryDropdown(logs, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- 選擇紀錄 --</option>';
    
    const categorizedLogs = logs.reduce((acc, log) => {
        acc[log.category] = acc[log.category] || [];
        acc[log.category].push(log);
        return acc;
    }, {});
    
    Object.keys(categorizedLogs).forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        categorizedLogs[category].forEach(log => {
            const option = document.createElement('option');
            option.value = log.logId;
            option.textContent = getFormattedDateTime(log.timestamp);
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    });
}

// --- Share Functionality (Optimized) ---

/**
 * Universal share function that uses Web Share API if available,
 * otherwise falls back to a URL-based share.
 * @param {object} shareData - The data to share { title, text, url }
 * @param {string} fallbackUrl - The URL to open if Web Share API is not supported.
 */
async function shareContent(shareData, fallbackUrl) {
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            console.log('Content shared successfully via Web Share API.');
        } catch (error) {
            // Log error, but don't show an alert for user cancellations.
            if (error.name !== 'AbortError') {
                console.error('Error using Web Share API:', error);
            }
        }
    } else {
        console.log('Web Share API not supported, falling back to URL.');
        window.open(fallbackUrl, '_blank');
    }
}

function copyOrderText() {
    const preview = document.getElementById('order-preview');
    if (!preview) return;

    const title = document.getElementById('order-subtitle').textContent;
    const date = document.getElementById('order-date').textContent;
    const itemsContainer = document.getElementById('order-list-container');
    
    let itemsText;
    if (itemsContainer.children.length > 1 && itemsContainer.querySelector('.flex.justify-between')) { // has items in rows
        itemsText = Array.from(itemsContainer.querySelectorAll('.flex.justify-between'))
            .slice(1) // skip header
            .map(row => `${row.children[0].textContent}\t${row.children[1].textContent}`)
            .join('\n');
    } else { // no items message
        itemsText = itemsContainer.textContent;
    }

    const fullText = `${title}\n${date}\n-------------------\n${itemsText}`;

    navigator.clipboard.writeText(fullText).then(() => {
        alert('叫貨單文字已複製！');
    }, (err) => {
        alert('複製失敗，請稍後再試。');
        console.error('Could not copy text: ', err);
    });
}

async function shareToLineText() {
    const preview = document.getElementById('order-preview');
    if (!preview) return;
    
    const title = document.getElementById('order-subtitle').textContent;
    const date = document.getElementById('order-date').textContent;
    const itemsContainer = document.getElementById('order-list-container');
    
    let itemsText;
    if (itemsContainer.children.length > 1 && itemsContainer.querySelector('.flex.justify-between')) { // has items in rows
        itemsText = Array.from(itemsContainer.querySelectorAll('.flex.justify-between'))
            .slice(1) // skip header
            .map(row => `${row.children[0].textContent} ${row.children[1].textContent}`)
            .join('\n');
    } else { // no items message
        itemsText = itemsContainer.textContent;
    }
    
    const fullText = `${title}\n${date}\n-------------------\n${itemsText}`;
    const fallbackUrl = `https://line.me/R/msg/text/?${encodeURIComponent(fullText)}`;
    
    await shareContent({ title: title, text: fullText }, fallbackUrl);
}

async function shareToLineImage() {
    const element = document.getElementById('order-preview');
    if (!element) return;
    showLoader();
    try {
        const canvas = await html2canvas(element, { scale: 2 });
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (navigator.canShare && navigator.canShare({ files: [new File([blob], 'order.png', { type: 'image/png' })] })) {
            const file = new File([blob], 'order.png', { type: 'image/png' });
            await navigator.share({
                files: [file],
                title: document.getElementById('order-subtitle').textContent || '叫貨單',
            });
        } else {
            alert('您的瀏覽器不支援分享圖片功能。');
        }
    } catch (err) {
        console.error('分享截圖失敗:', err);
        alert('產生或分享圖片時發生錯誤。');
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