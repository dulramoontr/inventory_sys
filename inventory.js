// =================================================================
// INVENTORY PAGE LOGIC (`inventory.html`)
// =================================================================
async function initInventoryPage() {
    showLoader();
    try {
        setupFAB('fab-container'); // Initialize floating button
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
        
        // --- MODIFICATION START: Add event listener for clear buttons via delegation ---
        const inventoryListContainer = document.getElementById('inventory-list');
        inventoryListContainer.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('clear-input-btn')) {
                const inputField = e.target.nextElementSibling;
                if (inputField && inputField.tagName === 'INPUT') {
                    inputField.value = '';
                    inputField.focus(); // Set focus back to the input for better UX
                }
            }
        });
        // --- MODIFICATION END ---

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
        itemDiv.className = 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-800/50 rounded-lg';
        itemDiv.dataset.itemId = item.ItemID;
        const inventoryUnit = item.Unit_Inventory || item.Unit;
        
        // --- MODIFICATION START: Added clear button to the HTML structure ---
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-200">${item.ItemName} ${item.IsRequired ? '<span class="text-red-500">*</span>' : ''}</span>
                <p class="text-sm text-slate-400">${item.Description || ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" class="clear-input-btn" title="清除數量">&times;</button>
                <input type="number" step="0.1" inputmode="decimal" class="inventory-quantity text-right p-2 border rounded-md focus:ring-2 focus:ring-sky-500 w-24" value="${item.DefaultStock || ''}" placeholder="數量">
                <span class="text-slate-400 w-12 text-left">${inventoryUnit}</span>
            </div>
        `;
        // --- MODIFICATION END ---
        container.appendChild(itemDiv);
    });
}

async function loadHistoricalInventory(logId) {
    if (!logId) {
        const activeTab = document.querySelector('.tabs .tab-link.active') || document.querySelector('.tabs .tab-link');
        if (activeTab) renderInventoryList(activeTab.dataset.category);
        return;
    }
    
    // Use API to get single log for efficiency, instead of searching in global `inventoryLogs`
    showLoader(); // Show loader while fetching historical data
    try {
        const result = await apiRequest('GET', { action: 'getLogById', logId });
        const log = result ? result.data : null;

        if (!log) {
            return;
        }

        // Activate the correct tab
        document.querySelectorAll('.tabs .tab-link').forEach(tab => {
            if(tab.dataset.category === log.category) {
               if (!tab.classList.contains('active')) tab.click();
            }
        });

        // Need a slight delay for the tab's render to complete
        setTimeout(() => {
            log.items.forEach(item => {
                const itemDiv = document.querySelector(`div[data-item-id="${item.itemId}"]`);
                if (itemDiv) {
                    itemDiv.querySelector('.inventory-quantity').value = item.quantity;
                }
            });
        }, 100); 
    } finally {
        hideLoader();
    }
}

async function saveInventory() {
    const itemsToSave = [];
    let validationFailed = false;
    let firstInvalidElement = null;

    document.querySelectorAll('#inventory-list div[data-item-id]').forEach(el => {
        const itemId = el.dataset.itemId;
        const itemInfo = allItems.find(i => i.ItemID === itemId);
        const quantityInput = el.querySelector('.inventory-quantity');
        const quantity = quantityInput.value;

        quantityInput.classList.remove('border-red-500', 'ring-2', 'ring-red-500/50');

        if (itemInfo.IsRequired && (quantity === '' || quantity === null)) {
            validationFailed = true;
            quantityInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            if (!firstInvalidElement) {
                firstInvalidElement = quantityInput;
            }
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
        if (firstInvalidElement) {
            firstInvalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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