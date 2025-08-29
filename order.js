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
           handleOrderTabClick('央廚'); 
        }

        // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 修正區塊 1 開始 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
        // 說明：修改 'share-line-text-btn' 的事件監聽器，
        //      使其呼叫我們在這個檔案中新增的專用分享函數 shareOrderToLine。

        document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
        // 修改這一行：
        document.getElementById('share-line-text-btn').addEventListener('click', shareOrderToLine);
        document.getElementById('share-line-img-btn').addEventListener('click', shareToLineImage);

        // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 修正區塊 1 結束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

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
    
    const warningContainer = document.getElementById('quantity-warning');
    if(warningContainer) warningContainer.classList.add('hidden');

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
    const warningContainer = document.getElementById('quantity-warning');
    if (warningContainer) {
        warningContainer.classList.add('hidden');
        warningContainer.innerHTML = '';
    }

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
    const highQuantityItems = [];
    const categoryItems = allItems.filter(item => item.Category === log.category);
    const logItemsMap = new Map(log.items.map(item => [item.itemId, parseFloat(item.quantity)]));

    categoryItems.forEach(itemInfo => {
        const checkQty = itemInfo.CheckQuantity === true || itemInfo.CheckQuantity === 'TRUE';
        if (checkQty && logItemsMap.has(itemInfo.ItemID) && logItemsMap.get(itemInfo.ItemID) > 10) {
            highQuantityItems.push(itemInfo.ItemName);
        }

        const minStockKey = isHolidayMode ? 'MinStock_Holiday' : 'MinStock_Normal';
        
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
    
    if (highQuantityItems.length > 0 && warningContainer) {
        warningContainer.innerHTML = `<strong>注意：</strong>下列品項庫存數量大於10，請檢查盤點是否異常： ${highQuantityItems.join('、')}`;
        warningContainer.classList.remove('hidden');
    }

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

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ 修正區塊 2 開始 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 說明：我們在這裡新增一個專門用於此頁面的分享函數 shareOrderToLine。
//      這個函數會從預覽畫面產生分享文字，並使用 Web Share API（如果可用）。

/**
 * 分享央廚/海鮮叫貨單到 LINE 或其他應用程式
 */
async function shareOrderToLine() {
    const preview = document.getElementById('order-preview');
    if (!preview || preview.classList.contains('hidden')) {
        alert('請先產生叫貨單後再分享。');
        return;
    }
    
    const title = document.getElementById('order-subtitle').textContent;
    const date = document.getElementById('order-date').textContent;
    const itemsContainer = document.getElementById('order-list-container');
    
    let itemsText;
    // 檢查 container 中是否有 flex佈局的子元素，來判斷是否為列表
    if (itemsContainer.querySelector('.flex.justify-between')) {
        itemsText = Array.from(itemsContainer.querySelectorAll('.flex.justify-between'))
            .slice(1) // 移除標題列
            .map(row => `${row.children[0].textContent} ${row.children[1].textContent}`)
            .join('\n');
    } else { 
        // 如果不是列表，則是 "無需叫貨" 之類的純文字訊息
        itemsText = itemsContainer.textContent;
    }
    
    const textToShare = `${title}\n${date}\n-------------------\n${itemsText}`;

    const shareData = {
        title: title,
        text: textToShare,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Share failed:', err);
            }
        }
    } else {
        const fallbackUrl = `https://line.me/R/msg/text/?${encodeURIComponent(textToShare)}`;
        window.open(fallbackUrl, '_blank');
    }
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ 修正區塊 2 結束 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲