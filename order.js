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
        
        // Add event listener for the holiday mode toggle
        document.getElementById('holiday-mode-toggle').addEventListener('change', () => {
            const selectedLogId = document.getElementById('order-history-select').value;
            if (selectedLogId) {
                generateOrderList(selectedLogId);
            }
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
    currentItemCategory = category;
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
    
    const result = await apiRequest('GET', { action: 'getLogById', logId });
    if (!result || !result.data) return;
    const log = result.data;
    
    document.getElementById('order-subtitle').textContent = `${log.category}叫貨單`;
    document.getElementById('order-date').textContent = `${getFormattedDate(log.timestamp)}`;
    
    const container = document.getElementById('order-list-container');
    container.innerHTML = '';

    const isHolidayMode = document.getElementById('holiday-mode-toggle').checked;
    const itemsToOrder = [];
    const categoryItems = allItems.filter(item => item.Category === log.category);
    const logItemsMap = new Map(log.items.map(item => [item.itemId, item.quantity]));

    categoryItems.forEach(itemInfo => {
        const minStockKey = isHolidayMode ? 'MinStock_Holiday' : 'MinStock_Normal';
        
        // Skip items that were not in the log or don't have a minimum stock set for the current mode
        if (!logItemsMap.has(itemInfo.ItemID) || !itemInfo[minStockKey]) return;

        const quantity = logItemsMap.get(itemInfo.ItemID);
        const minStock = itemInfo[minStockKey]; 
        const packageFactor = itemInfo.PackageFactor || 1;
        
        const needed = minStock - quantity;
        if (needed <= 0) return;

        const orderQuantity = Math.ceil(needed / packageFactor);
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
            <div class="flex justify-between border-b-2 border-slate-300 pb-2 mb-2 font-bold text-slate-700">
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