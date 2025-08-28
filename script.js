// =================================================================
// CONFIGURATION
// Google Apps Script URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZMCD8Sh3Vhx4dc0rpSUNTjhOdt-Sj7r9zQKN9AsvhfkJSvdstZWU9_IK8_3GDKz4GNg/exec';
// =================================================================

// --- Global State ---
let allItems = [];
let inventoryLogs = [];
let currentCategory = ''; // 用於設定頁面

// --- Utility Functions (CORRECTED LOADER LOGIC) ---
const loader = document.getElementById('loader');
const showLoader = () => loader && loader.classList.remove('hidden');
const hideLoader = () => loader && loader.classList.add('hidden');

/**
 * --- API Request Function (OPTIMIZED) ---
 * This function is updated to ensure the loader is hidden BEFORE any alert message is shown.
 */
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
        hideLoader();
        alert(`發生錯誤: ${error.message}`);
        return null;
    }
}


// --- Page Initializers ---
document.addEventListener('DOMContentLoaded', () => {
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
    }
});

// =================================================================
// SETTINGS PAGE LOGIC (`settings.html`)
// =================================================================
async function initSettingsPage() {
    showLoader();
    try {
        const verified = sessionStorage.getItem('accessVerified');
        if (!verified) {
            hideLoader();
            const code = prompt('請輸入存取碼:');
            if (!code) {
                 window.location.href = 'index.html';
                 return;
            }
            showLoader();
            const result = await apiRequest('POST', { action: 'verifyAccessCode', code: code });
            if (result && result.success) {
                sessionStorage.setItem('accessVerified', 'true');
            } else {
                if(!alert) window.location.href = 'index.html';
                return;
            }
        }
        
        document.getElementById('settings-content').classList.remove('hidden');

        const result = await apiRequest('GET', { action: 'getItems' });
        if (result && result.data) {
            allItems = result.data;
            setupSettingsTabs();
            renderItemsForCategory('央廚');
            // *** NEW: Initialize sortable functionality for all tabs ***
            ['tab-ck', 'tab-sf', 'tab-vg'].forEach(id => {
                 const el = document.getElementById(id);
                 new Sortable(el, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'sortable-ghost',
                });
            });
        }

        document.getElementById('save-settings-btn').addEventListener('click', saveAllSettings);
        document.getElementById('add-item-btn').addEventListener('click', () => openItemModal());
        document.querySelector('.modal .close-btn').addEventListener('click', closeItemModal);
        document.getElementById('item-form').addEventListener('submit', handleFormSubmit);
    } finally {
        hideLoader();
    }
}

function setupSettingsTabs() {
    const tabs = document.querySelectorAll('.tabs .tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabContents.forEach(content => content.classList.add('hidden'));

            const targetId = tab.dataset.tab;
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }

            const category = tab.dataset.tab === 'tab-ck' ? '央廚' : tab.dataset.tab === 'tab-sf' ? '海鮮廠商' : '菜商';
            renderItemsForCategory(category);
        });
    });
}


function renderItemsForCategory(category) {
    currentCategory = category;
    const containerId = category === '央廚' ? 'tab-ck' : category === '海鮮廠商' ? 'tab-sf' : 'tab-vg';
    const container = document.getElementById(containerId);
    container.innerHTML = ''; 

    const categoryItems = allItems.filter(item => item.Category === category);
    // *** NEW: Sort items by SortOrder property ***
    categoryItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));

    if (categoryItems.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-4">此分類下尚無品項。</p>`;
    } else {
        categoryItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center justify-between p-3 bg-white/60 rounded-lg shadow-sm';
            // *** NEW: Added data-item-id attribute for reordering ***
            itemDiv.dataset.itemId = item.ItemID;
            // *** NEW: Added drag handle icon ***
            itemDiv.innerHTML = `
                <div class="flex items-center">
                    <span class="drag-handle material-symbols-outlined">drag_indicator</span>
                    <div class="flex flex-col ml-2">
                        <span class="font-semibold text-slate-800">${item.ItemName}</span>
                    </div>
                </div>
                <div class="flex space-x-3">
                    <button data-action="edit" data-item-id="${item.ItemID}" class="text-sm text-slate-600 hover:text-blue-600 font-medium transition">編輯</button>
                    <button data-action="delete" data-item-id="${item.ItemID}" class="text-sm text-slate-600 hover:text-red-600 font-medium transition">刪除</button>
                </div>
            `;
            container.appendChild(itemDiv);
        });
        
        container.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const itemId = e.target.dataset.itemId;
                if (action === 'edit') {
                    openItemModal(itemId);
                } else if (action === 'delete') {
                    deleteItem(itemId);
                }
            });
        });
    }
}


function openItemModal(itemId = null) {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    form.reset();
    
    document.querySelector('.modal-fields-common').style.display = 'block';
    document.querySelector('.modal-fields-veg').style.display = 'none';

    if (currentCategory === '菜商') {
        document.querySelector('.modal-fields-common').style.display = 'none';
        document.querySelector('.modal-fields-veg').style.display = 'block';
    } else if (currentCategory === '海鮮廠商') {
        document.getElementById('modal-package-factor').parentElement.style.display = 'none';
    } else {
         document.getElementById('modal-package-factor').parentElement.style.display = 'block';
    }

    if (itemId) {
        const item = allItems.find(i => i.ItemID === itemId);
        document.getElementById('modal-title').innerText = '編輯品項';
        document.getElementById('modal-item-id').value = item.ItemID;
        document.getElementById('modal-item-name').value = item.ItemName;
        document.getElementById('modal-item-desc').value = item.Description;
        document.getElementById('modal-item-unit').value = item.Unit;
        document.getElementById('modal-min-stock').value = item.MinStock_Normal;
        document.getElementById('modal-min-stock-holiday').value = item.MinStock_Holiday;
        document.getElementById('modal-package-factor').value = item.PackageFactor;
        document.getElementById('modal-is-required').checked = item.IsRequired;
        document.getElementById('modal-subcategory').value = item.SubCategory || '-';

    } else {
        document.getElementById('modal-title').innerText = '新增品項';
        document.getElementById('modal-item-id').value = `ITEM_${Date.now()}`;
    }
    modal.classList.remove('hidden');
}

function closeItemModal() {
    document.getElementById('item-modal').classList.add('hidden');
}

function handleFormSubmit(event) {
    event.preventDefault();
    const itemId = document.getElementById('modal-item-id').value;
    const existingItemIndex = allItems.findIndex(i => i.ItemID === itemId);
    
    const newItem = {
        ItemID: itemId,
        ItemName: document.getElementById('modal-item-name').value,
        Description: document.getElementById('modal-item-desc').value,
        Category: currentCategory,
        SubCategory: document.getElementById('modal-subcategory').value,
        Unit: document.getElementById('modal-item-unit').value,
        IsRequired: document.getElementById('modal-is-required').checked,
        MinStock_Normal: document.getElementById('modal-min-stock').value || 0,
        MinStock_Holiday: document.getElementById('modal-min-stock-holiday').value || 0,
        PackageFactor: currentCategory === '海鮮廠商' ? 1 : (document.getElementById('modal-package-factor').value || 1)
    };
    
    if (currentCategory === '菜商') {
        newItem.MinStock_Normal = '';
        newItem.MinStock_Holiday = '';
        newItem.PackageFactor = '';
        newItem.IsRequired = false;
    }

    if (existingItemIndex > -1) {
        // *** MODIFIED: Preserve SortOrder when editing ***
        newItem.SortOrder = allItems[existingItemIndex].SortOrder;
        allItems[existingItemIndex] = newItem;
    } else {
        // *** NEW: Assign a new SortOrder for new items ***
        const categoryItems = allItems.filter(i => i.Category === currentCategory);
        newItem.SortOrder = categoryItems.length > 0 ? Math.max(...categoryItems.map(i => i.SortOrder || 0)) + 1 : 1;
        allItems.push(newItem);
    }
    
    renderItemsForCategory(currentCategory);
    closeItemModal();
}

function deleteItem(itemId) {
    if (confirm('確定要刪除這個品項嗎？此變更將在按下「儲存所有變更」後生效。')) {
        allItems = allItems.filter(i => i.ItemID !== itemId);
        renderItemsForCategory(currentCategory);
    }
}

// *** NEW: Function to update SortOrder based on DOM position ***
function updateItemsOrderFromDOM() {
    const categories = ['央廚', '海鮮廠商', '菜商'];
    categories.forEach(category => {
        const containerId = category === '央廚' ? 'tab-ck' : category === '海鮮廠商' ? 'tab-sf' : 'tab-vg';
        const container = document.getElementById(containerId);
        const itemElements = container.querySelectorAll('div[data-item-id]');
        
        itemElements.forEach((el, index) => {
            const itemId = el.dataset.itemId;
            const itemInState = allItems.find(i => i.ItemID === itemId);
            if (itemInState) {
                itemInState.SortOrder = index + 1; // Use 1-based indexing for order
            }
        });
    });
}

async function saveAllSettings() {
    // *** NEW: Update order before saving ***
    updateItemsOrderFromDOM();

    const oldAccessCode = document.getElementById('old-access-code').value;
    const newAccessCode = document.getElementById('new-access-code').value;

    if (newAccessCode && !oldAccessCode) {
        alert('若要修改存取碼，必須輸入舊存取碼！');
        return;
    }
    
    const payload = {
        action: 'updateSettings',
        payload: {
            items: allItems
        }
    };
    if (newAccessCode) {
        payload.payload.oldAccessCode = oldAccessCode;
        payload.payload.newAccessCode = newAccessCode;
    }

    const result = await apiRequest('POST', payload);
    hideLoader();
    if (result) {
        alert('設定已成功儲存！');
        document.getElementById('old-access-code').value = '';
        document.getElementById('new-access-code').value = '';
    }
}

// =================================================================
// INVENTORY PAGE LOGIC (`inventory.html`)
// =================================================================
async function initInventoryPage() {
    showLoader();
    try {
        const itemsResult = await apiRequest('GET', { action: 'getItems' });
        if (itemsResult) {
            allItems = itemsResult.data;
            // *** NEW: Sort all items globally after fetching ***
            allItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
        }

        const logsResult = await apiRequest('GET', { action: 'getInventoryLogs' });
        if (logsResult) {
            inventoryLogs = logsResult.data;
            populateHistoryDropdown(inventoryLogs, 'history-select');
        }

        document.querySelector('#history-select').addEventListener('change', (e) => {
            loadHistoricalInventory(e.target.value);
        });
        
        setupInventoryTabs();
        renderInventoryList('央廚');

        document.getElementById('save-inventory-btn').addEventListener('click', saveInventory);
    } finally {
        hideLoader();
    }
}

function setupInventoryTabs() {
    const tabs = document.querySelectorAll('.tabs .tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderInventoryList(tab.dataset.category);
        });
    });
}

function renderInventoryList(category) {
    currentCategory = category;
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';
    // *** MODIFIED: The allItems array is now pre-sorted ***
    const categoryItems = allItems.filter(item => item.Category === category);

    categoryItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-white/60 rounded-lg';
        itemDiv.dataset.itemId = item.ItemID;
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-800">${item.ItemName} ${item.IsRequired ? '<span class="text-red-500">*</span>' : ''}</span>
                <p class="text-sm text-slate-500">${item.Description || ''}</p>
            </div>
            <input type="number" class="inventory-quantity text-right p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 w-24" placeholder="數量">
        `;
        container.appendChild(itemDiv);
    });
}

function populateHistoryDropdown(logs, selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">請選擇...</option>';
    logs.forEach(log => {
        const option = document.createElement('option');
        option.value = log.logId;
        option.textContent = `${log.category} - ${new Date(log.timestamp).toLocaleString('sv-SE')}`;
        select.appendChild(option);
    });
}


function loadHistoricalInventory(logId) {
    if (!logId) return;
    showLoader();
    const log = inventoryLogs.find(l => l.logId == logId);
    if (!log) {
        hideLoader();
        return;
    }

    document.querySelectorAll('.tabs .tab-link').forEach(tab => {
        if(tab.dataset.category === log.category) {
           document.querySelectorAll('.tabs .tab-link').forEach(t => t.classList.remove('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold'));
           tab.classList.add('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold');
           renderInventoryList(log.category);
        }
    });

    setTimeout(() => {
        log.items.forEach(item => {
            const itemDiv = document.querySelector(`div[data-item-id="${item.itemId}"]`);
            if (itemDiv) {
                itemDiv.querySelector('.inventory-quantity').value = item.quantity;
            }
        });
        hideLoader();
    }, 100); 
}

async function saveInventory() {
    const itemsToSave = [];
    let validationFailed = false;
    
    const itemElements = document.querySelectorAll('#inventory-list div[data-item-id]');
    itemElements.forEach(el => {
        const itemId = el.dataset.itemId;
        const itemInfo = allItems.find(i => i.ItemID === itemId);
        const quantityInput = el.querySelector('.inventory-quantity');
        const quantity = quantityInput.value;

        if (itemInfo.IsRequired && (quantity === '' || quantity === null)) {
            validationFailed = true;
            quantityInput.classList.add('border-red-500', 'ring', 'ring-red-200');
        } else {
             quantityInput.classList.remove('border-red-500', 'ring', 'ring-red-200');
        }

        if (quantity !== '' && quantity !== null) {
            itemsToSave.push({
                itemId: itemId,
                itemName: itemInfo.ItemName,
                quantity: parseFloat(quantity)
            });
        }
    });

    if (validationFailed) {
        alert('有必填品項尚未填寫盤點數量！');
        return;
    }

    if (itemsToSave.length === 0) {
        alert('請至少輸入一項盤點數量。');
        return;
    }

    const payload = {
        action: 'saveInventory',
        payload: {
            category: currentCategory,
            items: itemsToSave
        }
    };

    const result = await apiRequest('POST', payload);
    hideLoader();
    if (result && result.success) {
        alert('盤點儲存成功！');
        window.location.href = `order.html?logId=${result.logId}`;
    }
}


// =================================================================
// ORDER PAGE LOGIC (`order.html`)
// =================================================================
async function initOrderPage() {
    showLoader();
    try {
        const itemsResult = await apiRequest('GET', { action: 'getItems' });
        if (itemsResult) {
             allItems = itemsResult.data;
             // *** NEW: Sort all items globally after fetching ***
             allItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
        }

        const logsResult = await apiRequest('GET', { action: 'getInventoryLogs' });
        if (logsResult) {
            inventoryLogs = logsResult.data;
            populateHistoryDropdown(inventoryLogs, 'order-history-select');
            checkTodayLog();
        }
        
        setupOrderTabs();

        document.getElementById('order-history-select').addEventListener('change', (e) => {
            generateOrderList(e.target.value);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const logId = urlParams.get('logId');
        if (logId) {
            const logResult = await apiRequest('GET', {action: 'getLogById', logId: logId});
            if(logResult && logResult.data){
                const log = logResult.data;
                const targetTab = document.querySelector(`.tab-link[data-category="${log.category}"]`);
                if (targetTab) {
                    targetTab.click();
                }
                document.getElementById('order-history-select').value = logId;
                await generateOrderList(logId);
            }
        } else {
           handleOrderTabClick('央廚');
        }

        document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
        document.getElementById('share-line-text-btn').addEventListener('click', shareToLineText);
        document.getElementById('share-line-img-btn').addEventListener('click', shareToLineImage);
    } finally {
        hideLoader();
    }
}

function setupOrderTabs() {
    document.querySelectorAll('.tabs .tab-link').forEach(tab => {
        tab.addEventListener('click', () => {
            handleOrderTabClick(tab.dataset.category);
        });
    });
}

function handleOrderTabClick(category) {
    currentCategory = category;
    document.getElementById('order-preview').classList.add('hidden');
    document.getElementById('action-buttons').classList.add('hidden');

    if (category === '央廚' || category === '海鮮廠商') {
        document.getElementById('auto-order-section').classList.remove('hidden');
        document.getElementById('manual-order-section').classList.add('hidden');
        
        const latestLog = inventoryLogs.find(log => log.category === category);
        if(latestLog) {
            document.getElementById('order-history-select').value = latestLog.logId;
            generateOrderList(latestLog.logId);
        } else {
            document.getElementById('order-history-select').value = '';
            document.getElementById('order-list').innerText = '此分類尚無盤點紀錄可產生叫貨單。';
            document.getElementById('order-preview').classList.remove('hidden');
        }
    } else { // 菜商
        document.getElementById('auto-order-section').classList.add('hidden');
        document.getElementById('manual-order-section').classList.remove('hidden');
        renderManualOrderForm();
    }
}

function checkTodayLog() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const hasTodayLog = inventoryLogs.some(log => log.timestamp.startsWith(todayStr));
    const warningEl = document.getElementById('no-today-log-warning');
    if (!hasTodayLog) {
        warningEl.classList.remove('hidden');
    } else {
        warningEl.classList.add('hidden');
    }
}

async function generateOrderList(logId) {
    if (!logId) {
        document.getElementById('order-preview').classList.add('hidden');
        document.getElementById('action-buttons').classList.add('hidden');
        return;
    };
    
    const log = inventoryLogs.find(l => l.logId == logId);
    if (!log) return;
    
    let orderText = '';
    const title = `${log.category}叫貨單 - ${new Date(log.timestamp).toLocaleString('sv-SE')}`;
    document.getElementById('order-title').textContent = title;

    // *** NEW: Create a map for quick lookup of quantities from the log ***
    const logItemsMap = new Map(log.items.map(item => [item.itemId, item.quantity]));

    // *** MODIFIED: Iterate over the presorted allItems array to generate the order list in the correct order ***
    const categoryItems = allItems.filter(item => item.Category === log.category);

    categoryItems.forEach(itemInfo => {
        if (!logItemsMap.has(itemInfo.ItemID) || !itemInfo.MinStock_Normal) return;

        const quantity = logItemsMap.get(itemInfo.ItemID);
        const minStock = itemInfo.MinStock_Normal;
        const packageFactor = itemInfo.PackageFactor || 1;
        
        let orderQuantity = Math.ceil((minStock - quantity) / packageFactor);

        if (orderQuantity > 0) {
            orderText += `${itemInfo.ItemName}：${orderQuantity} ${itemInfo.Unit}\n`;
        }
    });

    document.getElementById('order-list').innerText = orderText || '所有品項庫存充足，無需叫貨。';
    document.getElementById('order-preview').classList.remove('hidden');
    document.getElementById('action-buttons').classList.remove('hidden');
}

function renderManualOrderForm() {
    const container = document.getElementById('manual-order-section');
    container.innerHTML = '';
    // *** MODIFIED: The allItems array is now pre-sorted ***
    const vegItems = allItems.filter(i => i.Category === '菜商');

    vegItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between p-3 bg-white/60 rounded-lg';
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-800">${item.ItemName}</span>
                <p class="text-sm text-slate-500">${item.Description || ''}</p>
            </div>
            <input type="number" class="order-quantity text-right p-2 border border-slate-300 rounded-md w-24" data-item-name="${item.ItemName}" data-unit="${item.Unit}" placeholder="數量">
        `;
        container.appendChild(itemDiv);
    });
    
    const generateBtn = document.createElement('button');
    generateBtn.className = 'w-full flex items-center justify-center gap-2 py-3 px-4 mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg shadow-md';
    generateBtn.textContent = '產生叫貨單';
    generateBtn.onclick = generateManualOrder;
    container.appendChild(generateBtn);
}

function generateManualOrder() {
    let orderText = '';
    const title = `菜商叫貨單 - ${new Date().toLocaleString('sv-SE').slice(0, 16)}`;
    document.getElementById('order-title').textContent = title;
    
    document.querySelectorAll('#manual-order-section .order-quantity').forEach(input => {
        const quantity = input.value;
        if (quantity && parseFloat(quantity) > 0) {
            orderText += `${input.dataset.itemName}：${quantity} ${input.dataset.unit}\n`;
        }
    });

    document.getElementById('order-list').innerText = orderText || '尚未輸入任何叫貨數量。';
    document.getElementById('order-preview').classList.remove('hidden');
    document.getElementById('action-buttons').classList.remove('hidden');
}

function getFullOrderText() {
    const title = document.getElementById('order-title').textContent;
    const list = document.getElementById('order-list').innerText;
    return `${title}\n--------------------\n${list}`;
}

function copyOrderText() {
    const textToCopy = getFullOrderText();
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('清單文字已複製！');
    }, (err) => {
        alert('複製失敗: ', err);
    });
}

function shareToLineText() {
    const text = getFullOrderText();
    if (!text) return;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
}

async function shareToLineImage() {
    showLoader();
    const orderPreview = document.getElementById('order-preview');
    const title = document.getElementById('order-title').textContent || '叫貨單';

    try {
        const canvas = await html2canvas(orderPreview, { scale: 2 });
        if (navigator.share && navigator.canShare) {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], '叫貨單.png', { type: blob.type });
                const shareData = { files: [file], title: title, text: `你好，這是今天的${title}。` };
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                } else {
                    fallbackShare(canvas);
                }
            }, 'image/png');
        } else {
            fallbackShare(canvas);
        }
    } catch (error) {
        console.error('分享失敗:', error);
        alert(`產生圖片失敗: ${error.message}`);
    } finally {
        hideLoader();
    }
}

function fallbackShare(canvas) {
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = '叫貨單.png';
    link.click();
    alert("您的瀏覽器不支援直接分享。圖片已為您下載，請手動分享至 LINE。");
}