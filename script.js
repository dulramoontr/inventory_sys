// =================================================================
// CONFIGURATION
// Google Apps Script URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZMCD8Sh3Vhx4dc0rpSUNTjhOdt-Sj7r9zQKN9AsvhfkJSvdstZWU9_IK8_3GDKz4GNg/exec';
// =================================================================

// --- Global State ---
let allItems = [];
let inventoryLogs = [];
let currentCategory = ''; // 用於設定頁面

// --- Utility Functions ---
const loader = document.getElementById('loader');
const showLoader = () => loader.style.display = 'block';
const hideLoader = () => loader.style.display = 'none';

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
        if (!response.ok) throw new Error('Network response was not ok');
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'API request failed');
        return result;
    } catch (error) {
        alert(`發生錯誤: ${error.message}`);
        console.error('API Error:', error);
        return null;
    } finally {
        hideLoader();
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
    // Access Code Verification
    const verified = sessionStorage.getItem('accessVerified');
    if (!verified) {
        const code = prompt('請輸入存取碼:');
        if (!code) {
             window.location.href = 'index.html';
             return;
        }
        const result = await apiRequest('POST', { action: 'verifyAccessCode', code: code });
        if (result && result.success) {
            sessionStorage.setItem('accessVerified', 'true');
        } else {
            alert('存取碼錯誤！');
            window.location.href = 'index.html';
            return;
        }
    }
    
    document.getElementById('settings-content').classList.remove('hidden');

    const result = await apiRequest('GET', { action: 'getItems' });
    if (result && result.data) {
        allItems = result.data;
        setupSettingsTabs();
        renderItemsForCategory('央廚');
    }

    document.getElementById('save-settings-btn').addEventListener('click', saveAllSettings);
    document.getElementById('add-item-btn').addEventListener('click', () => openItemModal());
    document.querySelector('.modal .close-btn').addEventListener('click', closeItemModal);
    document.getElementById('item-form').addEventListener('submit', handleFormSubmit);
}

function setupSettingsTabs() {
    const tabs = document.querySelectorAll('.tabs .tab-link');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const category = tab.dataset.tab === 'tab-ck' ? '央廚' : tab.dataset.tab === 'tab-sf' ? '海鮮廠商' : '菜商';
            document.getElementById(tab.dataset.tab).classList.add('active');
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

    if (categoryItems.length === 0) {
        container.innerHTML = '<p>此分類下尚無品項。</p>';
    } else {
        categoryItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-row';
            itemDiv.innerHTML = `
                <span>${item.ItemName}</span>
                <div>
                    <button class="btn-secondary" onclick="openItemModal('${item.ItemID}')">編輯</button>
                    <button class="btn-danger" onclick="deleteItem('${item.ItemID}')">刪除</button>
                </div>
            `;
            container.appendChild(itemDiv);
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
        // Edit mode
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
        // Add mode
        document.getElementById('modal-title').innerText = '新增品項';
        document.getElementById('modal-item-id').value = `ITEM_${Date.now()}`;
    }
    modal.style.display = 'block';
}

function closeItemModal() {
    document.getElementById('item-modal').style.display = 'none';
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
        allItems[existingItemIndex] = newItem;
    } else {
        allItems.push(newItem);
    }
    
    renderItemsForCategory(currentCategory);
    closeItemModal();
}

function deleteItem(itemId) {
    if (confirm('確定要刪除這個品項嗎？')) {
        allItems = allItems.filter(i => i.ItemID !== itemId);
        renderItemsForCategory(currentCategory);
    }
}

async function saveAllSettings() {
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
    const itemsResult = await apiRequest('GET', { action: 'getItems' });
    if (itemsResult) allItems = itemsResult.data;

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
    const categoryItems = allItems.filter(item => item.Category === category);

    categoryItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.dataset.itemId = item.ItemID;
        itemDiv.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.ItemName} ${item.IsRequired ? '*' : ''}</span>
                <p class="item-desc">${item.Description || ''}</p>
            </div>
            <input type="number" class="inventory-quantity" placeholder="數量">
        `;
        container.appendChild(itemDiv);
    });
}

function populateHistoryDropdown(logs, selectId) {
    const select = document.getElementById(selectId);
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
    const log = inventoryLogs.find(l => l.logId == logId);
    if (!log) return;

    // Switch tab to match log category
    document.querySelectorAll('.tabs .tab-link').forEach(tab => {
        if(tab.dataset.category === log.category) {
           tab.click();
        }
    });

    setTimeout(() => {
        log.items.forEach(item => {
            const itemRow = document.querySelector(`.inventory-item[data-item-id="${item.itemId}"]`);
            if (itemRow) {
                itemRow.querySelector('.inventory-quantity').value = item.quantity;
            }
        });
    }, 100); // Small delay to ensure tab content is rendered
}

async function saveInventory() {
    const itemsToSave = [];
    let validationFailed = false;
    
    const itemElements = document.querySelectorAll('#inventory-list .inventory-item');
    itemElements.forEach(el => {
        const itemId = el.dataset.itemId;
        const itemInfo = allItems.find(i => i.ItemID === itemId);
        const quantityInput = el.querySelector('.inventory-quantity');
        const quantity = quantityInput.value;

        if (itemInfo.IsRequired && (quantity === '' || quantity === null)) {
            validationFailed = true;
            quantityInput.style.border = '2px solid red';
        } else {
             quantityInput.style.border = '';
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
    if (result && result.success) {
        alert('盤點儲存成功！');
        window.location.href = `order.html?logId=${result.logId}`;
    }
}


// =================================================================
// ORDER PAGE LOGIC (`order.html`)
// =================================================================
async function initOrderPage() {
    const itemsResult = await apiRequest('GET', { action: 'getItems' });
    if (itemsResult) allItems = itemsResult.data;

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

    // Check for logId from URL
    const urlParams = new URLSearchParams(window.location.search);
    const logId = urlParams.get('logId');
    if (logId) {
        const log = (await apiRequest('GET', {action: 'getLogById', logId: logId})).data;
        if(log){
            // Switch tab
            const targetTab = document.querySelector(`.tab-link[data-category="${log.category}"]`);
            if (targetTab) {
                targetTab.click();
            }
            // Set dropdown and generate list
            document.getElementById('order-history-select').value = logId;
            generateOrderList(logId);
        }
    } else {
       // Default view
       handleOrderTabClick('央廚');
    }

    document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
    document.getElementById('share-line-text-btn').addEventListener('click', shareToLineText);
    document.getElementById('share-line-img-btn').addEventListener('click', shareToLineImage);

}

function setupOrderTabs() {
    document.querySelectorAll('.tabs .tab-link').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tabs .tab-link').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            handleOrderTabClick(tab.dataset.category);
        });
    });
}

function handleOrderTabClick(category) {
    currentCategory = category;
    document.getElementById('order-preview').innerHTML = `<h3 id="order-title">叫貨單</h3><div id="order-list"></div>`;
    document.getElementById('action-buttons').classList.add('hidden');

    if (category === '央廚' || category === '海鮮廠商') {
        document.getElementById('auto-order-section').classList.remove('hidden');
        document.getElementById('manual-order-section').classList.add('hidden');
        // Auto-select latest log for this category
        const latestLog = inventoryLogs.find(log => log.category === category);
        if(latestLog) {
            document.getElementById('order-history-select').value = latestLog.logId;
            generateOrderList(latestLog.logId);
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
    if (!hasTodayLog) {
        document.getElementById('no-today-log-warning').classList.remove('hidden');
    }
}

async function generateOrderList(logId) {
    if (!logId) return;
    const log = inventoryLogs.find(l => l.logId == logId);
    if (!log) return;
    
    let orderText = '';
    const title = `${log.category}叫貨單 - ${new Date(log.timestamp).toLocaleString('sv-SE')}`;
    document.getElementById('order-title').textContent = title;

    log.items.forEach(logItem => {
        const itemInfo = allItems.find(i => i.ItemID === logItem.itemId);
        if (!itemInfo) return;

        const minStock = itemInfo.MinStock_Normal; // Simplified: can add holiday logic later
        const packageFactor = itemInfo.PackageFactor || 1;
        
        let orderQuantity = Math.ceil((minStock - logItem.quantity) / packageFactor);

        if (orderQuantity > 0) {
            orderText += `${itemInfo.ItemName}：${orderQuantity} ${itemInfo.Unit}\n`;
        }
    });

    document.getElementById('order-list').innerText = orderText || '所有品項庫存充足，無需叫貨。';
    document.getElementById('action-buttons').classList.remove('hidden');
}

function renderManualOrderForm() {
    const container = document.getElementById('manual-order-section');
    container.innerHTML = '';
    const vegItems = allItems.filter(i => i.Category === '菜商');

    vegItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'order-item-manual';
        itemDiv.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.ItemName}</span>
                <p class="item-desc">${item.Description || ''}</p>
            </div>
            <input type="number" class="order-quantity" data-item-name="${item.ItemName}" data-unit="${item.Unit}" placeholder="數量">
        `;
        container.appendChild(itemDiv);
    });
    
    const generateBtn = document.createElement('button');
    generateBtn.className = 'btn-primary';
    generateBtn.textContent = '產生叫貨單';
    generateBtn.onclick = generateManualOrder;
    container.appendChild(generateBtn);
}

function generateManualOrder() {
    let orderText = '';
    const title = `菜商叫貨單 - ${new Date().toLocaleString('sv-SE').slice(0, 16)}`;
    document.getElementById('order-title').textContent = title;
    
    document.querySelectorAll('.order-quantity').forEach(input => {
        const quantity = input.value;
        if (quantity && parseFloat(quantity) > 0) {
            orderText += `${input.dataset.itemName}：${quantity} ${input.dataset.unit}\n`;
        }
    });

    document.getElementById('order-list').innerText = orderText || '尚未輸入任何叫貨數量。';
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
    const orderPreview = document.getElementById('order-preview');
    const title = document.getElementById('order-title').textContent || '叫貨單';

    // 檢查是否支援 Web Share API 且是否能分享檔案
    if (navigator.share && navigator.canShare) {
        // --- 使用 Web Share API 的新式分享流程 ---
        try {
            alert("正在產生圖片，請稍候...");
            const canvas = await html2canvas(orderPreview);
            
            // 將 canvas 轉換成 Blob 物件
            canvas.toBlob(async (blob) => {
                // 將 Blob 包裝成 File 物件
                const file = new File([blob], '叫貨單.png', { type: blob.type });

                // 準備要分享的資料
                const shareData = {
                    files: [file],
                    title: title,
                    text: `你好，這是今天的${title}。`,
                };

                // 檢查瀏覽器是否能分享我們準備的資料
                if (navigator.canShare(shareData)) {
                    // 呼叫原生分享功能
                    await navigator.share(shareData);
                    console.log('圖片分享成功！');
                } else {
                    console.warn('無法分享此類型的檔案。');
                    // 若因某些原因無法分享檔案，則退回舊方法
                    fallbackShare(canvas);
                }
            }, 'image/png');

        } catch (error) {
            // 使用者可能手動取消分享，或發生其他錯誤
            if (error.name !== 'AbortError') {
                 console.error('分享失敗:', error);
                 alert(`分享失敗: ${error.message}`);
            }
        }

    } else {
        // --- 不支援 Web Share API 時的舊方法 ---
        alert("您的瀏覽器不支援直接分享，將為您產生圖片供手動下載。");
        const canvas = await html2canvas(orderPreview);
        fallbackShare(canvas);
    }
}

// 舊的、用於手動下載的分享方式 (Fallback)
function fallbackShare(canvas) {
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = '叫貨單.png';
    
    // 在新分頁中顯示圖片和下載按鈕，引導使用者手動操作
    const newWindow = window.open();
    newWindow.document.write('<h3>長按圖片或點擊下載按鈕，即可儲存並分享至LINE</h3>');
    newWindow.document.write(`<img src="${image}" width="100%" style="border: 1px solid #ccc;">`);
    newWindow.document.write('<br>');
    const downloadBtn = newWindow.document.createElement('a');
    downloadBtn.href = image;
    downloadBtn.download = '叫貨單.png';
    downloadBtn.innerHTML = '<button style="padding:20px; font-size: 22px; width:100%; box-sizing: border-box;">點我下載圖片</button>';
    newWindow.document.body.appendChild(downloadBtn);
}