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

        currentItemCategory = '菜商';
        renderManualOrderForm();

        document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
        document.getElementById('share-line-text-btn').addEventListener('click', shareVegOrderToLine);
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
        itemDiv.className = 'flex items-center justify-between p-3 bg-slate-800/50 rounded-lg';
        const orderUnit = item.Unit_Order || item.Unit_Inventory || item.Unit;
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-200">${item.ItemName}</span>
                <p class="text-sm text-slate-400">${item.Description || ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <input type="number" step="0.1" inputmode="decimal" class="order-quantity text-right p-2 border rounded-md w-24" data-item-name="${item.ItemName}" data-unit="${orderUnit}" data-subcategory="${item.SubCategory || '其他'}" placeholder="數量">
                <span class="text-slate-400 w-12 text-left">${orderUnit}</span>
            </div>
        `;
        container.appendChild(itemDiv);
    });
    
    document.getElementById('generate-order-btn').onclick = generateManualOrder;
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
    const actionButtons = document.getElementById('action-buttons');
    actionButtons.classList.remove('hidden');

    setTimeout(() => {
        actionButtons.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

/**
 * 產生菜商叫貨單的純文字內容，用於複製和分享。
 */
function generateVegOrderText() {
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
        return '尚未輸入任何叫貨數量。';
    }
    
    const groupedItems = itemsToOrder.reduce((acc, item) => {
        const key = item.subcategory;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
    }, {});

    let orderText = `${getFormattedDate(new Date().toISOString())} 菜商叫貨單\n-------------------\n`;
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
            orderText += `${item.name} ${item.qty}${item.unit}\n`;
        });
    }
    return orderText.trim();
}

/**
 * 分享菜商叫貨單到 LINE 或其他應用程式
 */
async function shareVegOrderToLine() {
    const textToShare = generateVegOrderText();
    
    if (textToShare === '尚未輸入任何叫貨數量。') {
        alert(textToShare);
        return;
    }

    const shareData = {
        title: '菜商叫貨單',
        text: textToShare,
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
        const fallbackUrl = `https://line.me/R/msg/text/?${encodeURIComponent(textToShare)}`;
        window.open(fallbackUrl, '_blank');
    }
}