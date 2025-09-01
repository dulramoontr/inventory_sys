// =================================================================
// SETTINGS PAGE LOGIC (`settings.html`)
// =================================================================
async function initSettingsPage() {
    showLoader();
    try {
        const verified = sessionStorage.getItem('accessVerified');
        if (!verified) {
            const code = prompt('請輸入存取碼:');
            if (code === null) { // User clicked cancel
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
                    // *** MODIFICATION START: Added forceFallback option for better mobile touch support ***
                    new Sortable(el, { 
                        animation: 150, 
                        handle: '.drag-handle', 
                        ghostClass: 'sortable-ghost',
                        forceFallback: true 
                    });
                    // *** MODIFICATION END ***
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
    
    // Set default tab view more safely
    const defaultTabButton = document.querySelector('.main-tab-link[data-tab="settings-tab-code"]');
    const defaultTabContent = document.getElementById('settings-tab-code');
    
    if (defaultTabButton && defaultTabContent) {
        // Hide all content first
        contents.forEach(content => content.classList.add('hidden'));
        // Then show the default one
        defaultTabButton.classList.add('active', 'bg-sky-600/50', 'shadow', 'text-white', 'font-semibold');
        defaultTabContent.classList.remove('hidden');
    }
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'bg-sky-600/50', 'shadow', 'text-white', 'font-semibold'));
            tab.classList.add('active', 'bg-sky-600/50', 'shadow', 'text-white', 'font-semibold');
            
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
        logDiv.className = 'flex items-center justify-between p-2 hover:bg-slate-700/50 rounded-lg transition-colors';
        logDiv.innerHTML = `
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" class="log-checkbox rounded bg-slate-600 border-slate-500 text-sky-500 focus:ring-sky-600" data-log-id="${log.logId}">
                <div class="flex flex-col">
                    <span class="font-semibold text-slate-200">${log.category}</span>
                    <span class="text-sm text-slate-400">${getFormattedDateTime(log.timestamp)}</span>
                </div>
            </label>
        `;
        container.appendChild(logDiv);
    });
    
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
    if (code === null) {
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
        defaultTab.classList.add('active', 'bg-sky-600/50', 'shadow', 'text-white', 'font-semibold');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active', 'bg-sky-600/50', 'shadow', 'text-white', 'font-semibold'));
            tab.classList.add('active', 'bg-sky-600/50', 'shadow', 'text-white', 'font-semibold');

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
        container.innerHTML = `<p class="text-slate-400 text-center py-4">此分類下尚無品項。</p>`;
    } else {
        categoryItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'flex items-center justify-between p-3 bg-slate-800/50 rounded-lg shadow-sm';
            itemDiv.dataset.itemId = item.ItemID;
            itemDiv.innerHTML = `
                <div class="flex items-center">
                    <span class="drag-handle material-symbols-outlined cursor-grab">drag_indicator</span>
                    <div class="flex flex-col ml-2">
                        <span class="font-semibold text-slate-200">${item.ItemName}</span>
                    </div>
                </div>
                <div class="flex space-x-3">
                    <button data-action="edit" data-item-id="${item.ItemID}" class="text-sm text-slate-400 hover:text-sky-400 font-medium transition">編輯</button>
                    <button data-action="delete" data-item-id="${item.ItemID}" class="text-sm text-slate-400 hover:text-red-400 font-medium transition">刪除</button>
                </div>
            `;
            container.appendChild(itemDiv);
        });
        
        container.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const itemId = e.currentTarget.dataset.itemId;
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
    const checkQuantityWrapper = document.getElementById('modal-check-quantity-wrapper');

    commonFields.style.display = 'block';
    vegFields.style.display = 'none';
    packageFactorField.style.display = 'block';
    checkQuantityWrapper.style.display = 'block';


    if (currentItemCategory === '菜商') {
        commonFields.style.display = 'none';
        vegFields.style.display = 'block';
    } else if (currentItemCategory === '海鮮廠商') {
        packageFactorField.style.display = 'none';
    }
    
    // Hide check quantity for veg
    if (currentItemCategory === '菜商') {
        checkQuantityWrapper.style.display = 'none';
    }

    if (itemId) {
        const item = allItems.find(i => i.ItemID.toString() === itemId.toString());
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
        document.getElementById('modal-check-quantity').checked = item.CheckQuantity === true || item.CheckQuantity === 'TRUE';
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
        PackageFactor: currentItemCategory === '海鮮廠商' ? 1 : (parseFloat(document.getElementById('modal-package-factor').value) || 1),
        CheckQuantity: document.getElementById('modal-check-quantity').checked
    };
    
    if (currentItemCategory === '菜商') {
        newItem.MinStock_Normal = '';
        newItem.MinStock_Holiday = '';
        newItem.PackageFactor = '';
        newItem.IsRequired = false;
        newItem.DefaultStock = '';
        newItem.CheckQuantity = false;
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
        allItems = allItems.filter(i => i.ItemID.toString() !== itemId.toString());
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