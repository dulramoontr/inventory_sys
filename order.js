// =================================================================
// ORDERING PAGE LOGIC (`order.html`)
// =================================================================
async function initOrderPage() {
    showLoader();
    try {
        setupFAB('fab-container-order'); // Initialize floating button
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        
        if (!category) {
            document.getElementById('order-main-title').textContent = '錯誤';
            document.getElementById('order-form-section').innerHTML = '<p class="text-center text-red-400">未指定商品類別。</p>';
            return;
        }

        currentItemCategory = decodeURIComponent(category);
        document.getElementById('order-main-title').textContent = `${currentItemCategory}叫貨`;

        const [itemsResult, inventoryResult] = await Promise.all([
            apiRequest('GET', { action: 'getItems' }),
            apiRequest('GET', { action: 'getLatestInventory' })
        ]);

        if (itemsResult) {
            allItems = itemsResult.data;
            allItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
        }

        if (inventoryResult && inventoryResult.data.length > 0) {
            latestInventory = inventoryResult.data;
        }

        // Holiday Mode Logic
        const holidayModeToggle = document.getElementById('holiday-mode-toggle');
        const holidayModeContainer = document.getElementById('holiday-mode-container');
        
        const hasHolidayStockItems = allItems.some(item => 
            item.Category === currentItemCategory && 
            item.MinStock_Holiday !== '' && 
            item.MinStock_Holiday !== null
        );

        if (hasHolidayStockItems) {
            holidayModeContainer.classList.remove('hidden');
            holidayModeToggle.addEventListener('change', renderOrderForm);
        }

        renderOrderForm();

        document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
        document.getElementById('share-line-text-btn').addEventListener('click', shareToLineText);
        document.getElementById('share-line-img-btn').addEventListener('click', shareToLineImage);
        document.getElementById('generate-order-btn').onclick = generateManualOrder;

    } finally {
        hideLoader();
    }
}

function renderOrderForm() {
    const container = document.getElementById('order-form-section');
    container.innerHTML = '';
    const itemsToDisplay = allItems.filter(i => i.Category === currentItemCategory);
    
    const isHolidayMode = document.getElementById('holiday-mode-toggle')?.checked || false;

    itemsToDisplay.forEach(item => {
        const inventoryItem = latestInventory.find(inv => inv.ItemID === item.ItemID);
        const currentStock = inventoryItem ? parseFloat(inventoryItem.Quantity) : 0;
        
        const minStockNormal = (item.MinStock_Normal !== '' && item.MinStock_Normal !== null) ? parseFloat(item.MinStock_Normal) : 0;
        const minStockHoliday = (item.MinStock_Holiday !== '' && item.MinStock_Holiday !== null) ? parseFloat(item.MinStock_Holiday) : minStockNormal;

        const minStock = isHolidayMode ? minStockHoliday : minStockNormal;

        const neededQty = Math.max(0, minStock - currentStock);
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'flex items-center justify-between p-3 bg-slate-800/50 rounded-lg';
        const orderUnit = item.Unit_Order || item.Unit_Inventory || item.Unit;

        itemDiv.innerHTML = `
            <div class="flex-1">
                <span class="font-semibold text-slate-200">${item.ItemName}</span>
                <p class="text-sm text-slate-400">
                    庫存: ${currentStock}${item.Unit_Inventory || item.Unit} / 
                    安全: ${minStock}${item.Unit_Inventory || item.Unit}
                </p>
            </div>
            <div class="flex items-center gap-2">
                <input 
                    type="number" 
                    step="0.1" 
                    inputmode="decimal" 
                    class="order-quantity text-right p-2 border rounded-md w-24" 
                    data-item-id="${item.ItemID}"
                    data-item-name="${item.ItemName}" 
                    data-unit="${orderUnit}" 
                    data-subcategory="${item.SubCategory || '其他'}" 
                    value="${neededQty > 0 ? neededQty : ''}"
                    placeholder="數量">
                <span class="text-slate-400 w-12 text-left">${orderUnit}</span>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}


function generateManualOrder() {
    const isHolidayMode = document.getElementById('holiday-mode-toggle')?.checked || false;
    const title = isHolidayMode ? `${currentItemCategory}叫貨單 (長假模式)` : `${currentItemCategory}叫貨單`;
    
    document.getElementById('order-subtitle').textContent = title;
    document.getElementById('order-date').textContent = `日期：${getFormattedDateTime(new Date().toISOString())}`;
    
    const container = document.getElementById('order-list-container');
    container.innerHTML = '';

    const itemsToOrder = [];
    document.querySelectorAll('#order-form-section .order-quantity').forEach(input => {
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
        const sortedKeys = Object.keys(groupedItems).sort((a,b) => a.localeCompare(b, 'zh-Hant'));

        for (const subcategory of sortedKeys) {
            // Do not show subcategory title if it's '-'
            if (subcategory !== '-') {
                 orderText += `\n【${subcategory}】\n`;
            } else {
                 orderText += '\n';
            }
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
    const actionButtons = document.getElementById('action-buttons');
    actionButtons.classList.remove('hidden');
    
    // --- UI 優化：滾動到頁面底部 ---
    setTimeout(() => {
        actionButtons.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}