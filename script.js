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
const loader = document.getElementById('loader');
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
        case 'veg-order.html':
            initVegOrderPage();
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
        setupMainTabs();
        
        const [itemsResult, logsResult] = await Promise.all([
            apiRequest('GET', { action: 'getItems' }),
            apiRequest('GET', { action: 'getInventoryLogs' })
        ]);

        if (itemsResult && itemsResult.data) {
            allItems = itemsResult.data;
            setupItemSettingsSubTabs();
            renderItemsForCategory('央廚');
            ['item-tab-ck', 'item-tab-sf', 'item-tab-vg'].forEach(id => {
                 const el = document.getElementById(id);
                 if (el) {
                    new Sortable(el, { animation: 150, handle: '.drag-handle', ghostClass: 'sortable-ghost' });
                 }
            });
        }
        
        if (logsResult && logsResult.data) {
            inventoryLogs = logsResult.data;
            renderInventoryLogList();
        }

        // Event Listeners
        document.getElementById('save-code-btn').addEventListener('click', saveAccessCode);
        document.getElementById('save-items-btn').addEventListener('click', saveItemSettings);
        document.getElementById('delete-logs-btn').addEventListener('click', handleDeleteSelectedLogs);
        document.getElementById('add-item-btn').addEventListener('click', () => openItemModal());
        document.querySelector('.modal .close-btn').addEventListener('click', closeItemModal);
        document.getElementById('item-form').addEventListener('submit', handleFormSubmit);

    } finally {
        hideLoader();
    }
}

function setupMainTabs() {
    const tabs = document.querySelectorAll('.main-tab-link');
    const contents = document.querySelectorAll('.main-tab-content');
    
    // Set default tab state
    const defaultTab = tabs[0];
    if (defaultTab) {
        defaultTab.classList.add('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold');
    }
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold'));
            tab.classList.add('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold');
            
            contents.forEach(content => content.classList.add('hidden'));
            const targetContent = document.getElementById(tab.dataset.tab);
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
        });
    });
}

function renderInventoryLogList() {
    const container = document.getElementById('inventory-log-list');
    const selectAllCheckbox = document.getElementById('select-all-logs');
    if (!container || !selectAllCheckbox) return;

    container.innerHTML = '';
    selectAllCheckbox.checked = false;

    if (inventoryLogs.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-4">目前沒有任何盤點紀錄。</p>`;
        return;
    }

    inventoryLogs.forEach(log => {
        const logDiv = document.createElement('div');
        logDiv.className = 'flex items-center justify-between p-2 hover:bg-blue-100/50 rounded-lg';
        logDiv.innerHTML = `
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" class="log-checkbox rounded" data-log-id="${log.logId}">
                <div class="flex flex-col">
                    <span class="font-semibold text-slate-800">${log.category}</span>
                    <span class="text-sm text-slate-500">${getFormattedDateTime(log.timestamp)}</span>
                </div>
            </label>
        `;
        container.appendChild(logDiv);
    });
    
    // Add event listeners for checkboxes
    const checkboxes = container.querySelectorAll('.log-checkbox');
    checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateDeleteButtonState));
    selectAllCheckbox.addEventListener('change', () => {
        checkboxes.forEach(checkbox => checkbox.checked = selectAllCheckbox.checked);
        updateDeleteButtonState();
    });
    updateDeleteButtonState();
}

function updateDeleteButtonState() {
    const deleteBtn = document.getElementById('delete-logs-btn');
    const selectedCheckboxes = document.querySelectorAll('.log-checkbox:checked');
    deleteBtn.disabled = selectedCheckboxes.length === 0;
}

async function handleDeleteSelectedLogs() {
    const selectedLogIds = Array.from(document.querySelectorAll('.log-checkbox:checked'))
                                .map(cb => cb.dataset.logId);

    if (selectedLogIds.length === 0) {
        alert('請先選取要刪除的紀錄。');
        return;
    }

    if (!confirm(`確定要刪除選取的 ${selectedLogIds.length} 筆紀錄嗎？此操作無法復原。`)) {
        return;
    }

    const code = prompt('請輸入存取碼以確認刪除操作：');
    if (!code) {
        alert('已取消刪除操作。');
        return;
    }

    const payload = {
        action: 'deleteInventoryLogs',
        payload: {
            logIds: selectedLogIds,
            accessCode: code
        }
    };

    const result = await apiRequest('POST', payload);
    if (result && result.success) {
        alert(result.message || '紀錄已成功刪除！');
        inventoryLogs = inventoryLogs.filter(log => !selectedLogIds.includes(log.logId.toString()));
        renderInventoryLogList();
    }
}

function setupItemSettingsSubTabs() {
    const tabs = document.querySelectorAll('.sub-tab-link');
    const contents = document.querySelectorAll('.sub-tab-content');
    
    const defaultTab = tabs[0];
    if (defaultTab) {
        defaultTab.classList.add('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold'));
            tab.classList.add('active', 'bg-white', 'shadow', 'text-blue-600', 'font-semibold');

            contents.forEach(content => content.classList.add('hidden'));
            const targetContent = document.getElementById(tab.dataset.tab);
            if (targetContent) targetContent.classList.remove('hidden');
            
            const categoryMap = {'item-tab-ck': '央廚', 'item-tab-sf': '海鮮廠商', 'item-tab-vg': '菜商'};
            renderItemsForCategory(categoryMap[tab.dataset.tab]);
        });
    });
}

function renderItemsForCategory(category) {
    currentItemCategory = category;
    const containerId = category === '央廚' ? 'item-tab-ck' : category === '海鮮廠商' ? 'item-tab-sf' : 'item-tab-vg';
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; 

    const categoryItems = allItems.filter(item => item.Category === category);
    categoryItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));

    if (categoryItems.length === 0) {
        container.innerHTML = `<p class="text-slate-500 text-center py-4">此分類下尚無品項。</p>`;
    } else {
        categoryItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center justify-between p-3 bg-white/60 rounded-lg shadow-sm';
            itemDiv.dataset.itemId = item.ItemID;
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
                if (action === 'edit') openItemModal(itemId);
                else if (action === 'delete') deleteItem(itemId);
            });
        });
    }
}

function openItemModal(itemId = null) {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    form.reset();
    
    const commonFields = document.querySelector('.modal-fields-common');
    const vegFields = document.querySelector('.modal-fields-veg');
    const packageFactorField = document.getElementById('modal-package-factor').parentElement;

    commonFields.style.display = 'block';
    vegFields.style.display = 'none';
    packageFactorField.style.display = 'block';

    if (currentItemCategory === '菜商') {
        commonFields.style.display = 'none';
        vegFields.style.display = 'block';
    } else if (currentItemCategory === '海鮮廠商') {
        packageFactorField.style.display = 'none';
    }

    if (itemId) {
        const item = allItems.find(i => i.ItemID === itemId);
        document.getElementById('modal-title').innerText = '編輯品項';
        document.getElementById('modal-item-id').value = item.ItemID;
        document.getElementById('modal-item-name').value = item.ItemName;
        document.getElementById('modal-item-desc').value = item.Description;
        document.getElementById('modal-unit-inventory').value = item.Unit_Inventory || item.Unit;
        document.getElementById('modal-unit-order').value = item.Unit_Order || '';
        document.getElementById('modal-min-stock').value = item.MinStock_Normal;
        document.getElementById('modal-min-stock-holiday').value = item.MinStock_Holiday;
        document.getElementById('modal-default-stock').value = item.DefaultStock || '';
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
    
    const defaultStockValue = document.getElementById('modal-default-stock').value;
    const unitInventory = document.getElementById('modal-unit-inventory').value;
    const unitOrder = document.getElementById('modal-unit-order').value;

    const newItem = {
        ItemID: itemId,
        ItemName: document.getElementById('modal-item-name').value,
        Description: document.getElementById('modal-item-desc').value,
        Category: currentItemCategory,
        SubCategory: document.getElementById('modal-subcategory').value,
        Unit_Inventory: unitInventory,
        Unit_Order: unitOrder || unitInventory,
        IsRequired: document.getElementById('modal-is-required').checked,
        MinStock_Normal: parseFloat(document.getElementById('modal-min-stock').value) || 0,
        MinStock_Holiday: parseFloat(document.getElementById('modal-min-stock-holiday').value) || 0,
        DefaultStock: defaultStockValue ? parseFloat(defaultStockValue) : '',
        PackageFactor: currentItemCategory === '海鮮廠商' ? 1 : (document.getElementById('modal-package-factor').value || 1)
    };
    
    if (currentItemCategory === '菜商') {
        newItem.MinStock_Normal = '';
        newItem.MinStock_Holiday = '';
        newItem.PackageFactor = '';
        newItem.IsRequired = false;
        newItem.DefaultStock = '';
    }

    if (existingItemIndex > -1) {
        newItem.SortOrder = allItems[existingItemIndex].SortOrder;
        allItems[existingItemIndex] = newItem;
    } else {
        const categoryItems = allItems.filter(i => i.Category === currentItemCategory);
        newItem.SortOrder = categoryItems.length > 0 ? Math.max(...categoryItems.map(i => i.SortOrder || 0)) + 1 : 1;
        allItems.push(newItem);
    }
    
    renderItemsForCategory(currentItemCategory);
    closeItemModal();
}

function deleteItem(itemId) {
    if (confirm('確定要刪除這個品項嗎？此變更將在按下「儲存品項變更」後生效。')) {
        allItems = allItems.filter(i => i.ItemID !== itemId);
        renderItemsForCategory(currentItemCategory);
    }
}

function updateItemsOrderFromDOM() {
    const categories = ['央廚', '海鮮廠商', '菜商'];
    categories.forEach(category => {
        const containerId = category === '央廚' ? 'item-tab-ck' : category === '海鮮廠商' ? 'item-tab-sf' : 'item-tab-vg';
        const container = document.getElementById(containerId);
        if (container) {
            const itemElements = container.querySelectorAll('div[data-item-id]');
            itemElements.forEach((el, index) => {
                const itemId = el.dataset.itemId;
                const itemInState = allItems.find(i => i.ItemID === itemId);
                if (itemInState) itemInState.SortOrder = index + 1;
            });
        }
    });
}

async function saveAccessCode() {
    const oldAccessCode = document.getElementById('old-access-code').value;
    const newAccessCode = document.getElementById('new-access-code').value;

    if (newAccessCode && !oldAccessCode) {
        alert('若要修改存取碼，必須輸入舊存取碼！');
        return;
    }
    if (!newAccessCode) {
        alert('請輸入新的存取碼！');
        return;
    }
    
    const payload = {
        action: 'updateSettings',
        payload: {
            oldAccessCode: oldAccessCode,
            newAccessCode: newAccessCode
        }
    };
    
    const result = await apiRequest('POST', payload);
    if (result) {
        alert('存取碼已成功更新！');
        document.getElementById('old-access-code').value = '';
        document.getElementById('new-access-code').value = '';
    }
}

async function saveItemSettings() {
    updateItemsOrderFromDOM();
    
    const payload = {
        action: 'updateSettings',
        payload: { items: allItems }
    };

    const result = await apiRequest('POST', payload);
    if (result) {
        alert('品項設定已成功儲存！');
    }
}

// =================================================================
// INVENTORY PAGE LOGIC & OTHER PAGES
// (No changes needed for other pages, so the rest of the file remains the same)
// =================================================================
async function initInventoryPage() {
    showLoader();
    try {
        const itemsResult = await apiRequest('GET', { action: 'getItems' });
        if (itemsResult) {
            allItems = itemsResult.data;
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
    currentItemCategory = category;
    const container = document.getElementById('inventory-list');
    container.innerHTML = '';
    const categoryItems = allItems.filter(item => item.Category === category);

    categoryItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-white/60 rounded-lg';
        itemDiv.dataset.itemId = item.ItemID;
        const inventoryUnit = item.Unit_Inventory || item.Unit;
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-800">${item.ItemName} ${item.IsRequired ? '<span class="text-red-500">*</span>' : ''}</span>
                <p class="text-sm text-slate-500">${item.Description || ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" step="0.1" inputmode="decimal" class="inventory-quantity text-right p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 w-24" value="${item.DefaultStock || ''}" placeholder="數量">
                <span class="text-slate-600 w-12 text-left">${inventoryUnit}</span>
            </div>
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
        option.textContent = `${log.category} - ${getFormattedDateTime(log.timestamp)}`;
        select.appendChild(option);
    });
}

function loadHistoricalInventory(logId) {
    if (!logId) {
        const activeTab = document.querySelector('.tabs .tab-link.active') || document.querySelector('.tabs .tab-link');
        if (activeTab) renderInventoryList(activeTab.dataset.category);
        return;
    }
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
    
    document.querySelectorAll('#inventory-list div[data-item-id]').forEach(el => {
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
        payload: { category: currentItemCategory, items: itemsToSave }
    };

    const result = await apiRequest('POST', payload);
    if (result && result.success) {
        alert('盤點儲存成功！');
        window.location.href = `order.html?logId=${result.logId}`;
    }
}

// =================================================================
// ORDER PAGE LOGIC (`order.html` - CK/Seafood)
// =================================================================
async function initOrderPage() {
    showLoader();
    try {
        const itemsResult = await apiRequest('GET', { action: 'getItems' });
        if (itemsResult) {
             allItems = itemsResult.data;
             allItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
        }

        const logsResult = await apiRequest('GET', { action: 'getInventoryLogs' });
        if (logsResult) {
            inventoryLogs = logsResult.data;
            populateHistoryDropdown(inventoryLogs, 'order-history-select');
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
                if (targetTab) targetTab.click();
                document.getElementById('order-history-select').value = logId;
                await generateOrderList(logId);
            }
        } else {
           handleOrderTabClick('央廚'); // Default to the first tab
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

    const todayStr = new Date().toISOString().slice(0, 10);
    const hasTodayLog = inventoryLogs.some(log => log.category === category && log.timestamp.startsWith(todayStr));
    const warningEl = document.getElementById('today-inventory-warning');

    if (!hasTodayLog) {
        warningEl.textContent = `注意：今日尚無「${category}」的盤點紀錄，叫貨單可能非最新狀態。`;
        warningEl.classList.remove('hidden');
    } else {
        warningEl.classList.add('hidden');
    }

    const latestLog = inventoryLogs.find(log => log.category === category);
    if(latestLog) {
        document.getElementById('order-history-select').value = latestLog.logId;
        generateOrderList(latestLog.logId);
    } else {
        document.getElementById('order-history-select').value = '';
        document.getElementById('order-subtitle').textContent = `${category}叫貨單`;
        document.getElementById('order-date').textContent = '';
        document.getElementById('order-list-container').innerText = '此分類尚無盤點紀錄可產生叫貨單。';
        document.getElementById('order-preview').classList.remove('hidden');
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
    
    document.getElementById('order-subtitle').textContent = `${log.category}叫貨單`;
    document.getElementById('order-date').textContent = `${getFormattedDate(log.timestamp)}`;
    
    const container = document.getElementById('order-list-container');
    container.innerHTML = '';

    const itemsToOrder = [];
    const categoryItems = allItems.filter(item => item.Category === log.category);
    const logItemsMap = new Map(log.items.map(item => [item.itemId, item.quantity]));

    categoryItems.forEach(itemInfo => {
        if (!logItemsMap.has(itemInfo.ItemID) || !itemInfo.MinStock_Normal) return;

        const quantity = logItemsMap.get(itemInfo.ItemID);
        const minStock = itemInfo.MinStock_Normal;
        const packageFactor = itemInfo.PackageFactor || 1;
        const orderQuantity = Math.ceil((minStock - quantity) / packageFactor);
        const orderUnit = itemInfo.Unit_Order || itemInfo.Unit_Inventory || itemInfo.Unit;

        if (orderQuantity > 0) {
            itemsToOrder.push({
                name: itemInfo.ItemName,
                qty: orderQuantity,
                unit: orderUnit
            });
        }
    });

    if (itemsToOrder.length === 0) {
        container.innerText = '所有品項庫存充足，無需叫貨。';
    } else {
        container.innerHTML = `
            <div class="flex justify-between border-b-2 border-slate-400 pb-2 mb-2 font-bold text-slate-700">
                <span>品項</span>
                <span>數量</span>
            </div>
        `;
        itemsToOrder.forEach(item => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center py-2 border-b border-slate-200';
            row.innerHTML = `
                <span class="text-slate-800">${item.name}</span>
                <span class="text-slate-800 text-right">${item.qty}${item.unit}</span>
            `;
            container.appendChild(row);
        });
    }

    document.getElementById('order-preview').classList.remove('hidden');
    document.getElementById('action-buttons').classList.remove('hidden');
}

// =================================================================
// VEGETABLE ORDER PAGE LOGIC (`veg-order.html`)
// =================================================================
async function initVegOrderPage() {
    showLoader();
    try {
        const itemsResult = await apiRequest('GET', { action: 'getItems' });
        if (itemsResult) {
             allItems = itemsResult.data;
             allItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
        }

        currentCategory = '菜商';
        renderManualOrderForm();

        document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
        document.getElementById('share-line-text-btn').addEventListener('click', shareToLineText);
        document.getElementById('share-line-img-btn').addEventListener('click', shareToLineImage);

    } finally {
        hideLoader();
    }
}

function renderManualOrderForm() {
    const container = document.getElementById('manual-order-section');
    container.innerHTML = '';
    const vegItems = allItems.filter(i => i.Category === '菜商');

    vegItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between p-3 bg-white/60 rounded-lg';
        const orderUnit = item.Unit_Order || item.Unit_Inventory || item.Unit;
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-800">${item.ItemName}</span>
                <p class="text-sm text-slate-500">${item.Description || ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" step="0.1" inputmode="decimal" class="order-quantity text-right p-2 border border-slate-300 rounded-md w-24" data-item-name="${item.ItemName}" data-unit="${orderUnit}" data-subcategory="${item.SubCategory || '其他'}" placeholder="數量">
                <span class="text-slate-600 w-12 text-left">${orderUnit}</span>
            </div>
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
    document.getElementById('order-subtitle').textContent = '菜商叫貨單';
    document.getElementById('order-date').textContent = `日期：${getFormattedDateTime(new Date().toISOString())}`;
    
    const container = document.getElementById('order-list-container');
    container.innerHTML = '';

    const itemsToOrder = [];
    document.querySelectorAll('#manual-order-section .order-quantity').forEach(input => {
        const quantity = input.value;
        if (quantity && parseFloat(quantity) > 0) {
            itemsToOrder.push({
                name: input.dataset.itemName,
                qty: quantity,
                unit: input.dataset.unit,
                subcategory: input.dataset.subcategory
            });
        }
    });

    if (itemsToOrder.length === 0) {
        container.innerText = '尚未輸入任何叫貨數量。';
    } else {
        const groupedItems = itemsToOrder.reduce((acc, item) => {
            const key = item.subcategory;
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        let orderText = '';
        const categoryOrder = ['蔬菜', '火鍋料', '其他'];
        const sortedKeys = Object.keys(groupedItems).sort((a, b) => {
            const indexA = categoryOrder.indexOf(a);
            const indexB = categoryOrder.indexOf(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        for (const subcategory of sortedKeys) {
            orderText += `\n【${subcategory}】\n`;
            groupedItems[subcategory].forEach(item => {
                orderText += `${item.name}: ${item.qty}${item.unit}\n`;
            });
        }
        
        const textDiv = document.createElement('div');
        textDiv.className = 'whitespace-pre-wrap font-mono text-slate-800 text-sm';
        textDiv.innerText = orderText.trim();
        container.appendChild(textDiv);
    }
    
    document.getElementById('order-preview').classList.remove('hidden');
    document.getElementById('action-buttons').classList.remove('hidden');
}


// =================================================================
// SHARED FUNCTIONS (used by order.html and veg-order.html)
// =================================================================
function getFullOrderText() {
    const mainTitle = document.getElementById('order-main-title').textContent;
    const subtitle = document.getElementById('order-subtitle').textContent;
    const date = document.getElementById('order-date').textContent;
    
    const listContainer = document.getElementById('order-list-container');
    let listContent = '';

    const rows = listContainer.querySelectorAll('.flex.justify-between');

    if (rows.length > 1) { // Table format for CK/SF
        rows.forEach(row => {
            const left = row.children[0]?.textContent || '';
            const right = row.children[1]?.textContent || '';
            listContent += `${left}\t${right}\n`;
        });
    } else { // Text format for Veg or empty messages
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

function shareToLineText() {
    const text = getFullOrderText();
    if (!text) return;
    const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(lineUrl, '_blank');
}

async function shareToLineImage() {
    showLoader();
    const orderPreview = document.getElementById('order-preview');
    const title = document.getElementById('order-subtitle').textContent || '叫貨單';

    try {
        const canvas = await html2canvas(orderPreview, { scale: 2 });
        if (navigator.share && navigator.canShare) {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], `${title}.png`, { type: blob.type });
                const shareData = { files: [file], title: title, text: `你好，這是今天的${title}。` };
                if (navigator.canShare(shareData)) {
                    await navigator.share(shareData);
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

function fallbackShare(canvas, title) {
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `${title}.png`;
    link.click();
    alert("您的瀏覽器不支援直接分享。圖片已為您下載，請手動分享至 LINE。");
}