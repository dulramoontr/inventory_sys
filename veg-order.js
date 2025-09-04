// =================================================================
// VEGETABLE ORDER PAGE LOGIC (`veg-order.html`)
// =================================================================
async function initVegOrderPage() {
    showLoader();
    try {
        setupFAB('fab-container-veg'); // Initialize floating button
        const itemsResult = await apiRequest('GET', { action: 'getItems' });
        if (itemsResult) {
             allItems = itemsResult.data;
             allItems.sort((a, b) => (a.SortOrder || 0) - (b.SortOrder || 0));
        }

        currentItemCategory = '菜商';
        renderManualOrderForm();
        
        // --- MODIFICATION START: Event delegation for dynamic clear buttons ---
        const manualOrderContainer = document.getElementById('manual-order-section');
        
        // Handle click on clear button
        manualOrderContainer.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('input-clear-btn')) {
                const inputField = e.target.previousElementSibling;
                if (inputField && inputField.tagName === 'INPUT') {
                    inputField.value = '';
                    e.target.classList.add('hidden');
                    inputField.focus();
                }
            }
        });

        // Handle input to show/hide clear button
        manualOrderContainer.addEventListener('input', (e) => {
            if (e.target && e.target.classList.contains('order-quantity')) {
                const clearBtn = e.target.nextElementSibling;
                if (clearBtn && clearBtn.classList.contains('input-clear-btn')) {
                    clearBtn.classList.toggle('hidden', e.target.value.length === 0);
                }
            }
        });
        // --- MODIFICATION END ---
        
        // --- Search functionality logic ---
        const searchInput = document.getElementById('search-input');
        const searchContainer = document.getElementById('search-container');
        const clearSearchBtn = document.getElementById('clear-search-btn');
        const allItemElements = Array.from(manualOrderContainer.children);
        
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase().trim();
            let firstMatch = null;
            
            allItemElements.forEach(el => {
                const itemName = el.dataset.itemName.toLowerCase();
                if (itemName.includes(query)) {
                    el.style.display = '';
                    if (!firstMatch) firstMatch = el;
                } else {
                    el.style.display = 'none';
                }
            });

            if (firstMatch) {
                const searchContainerHeight = searchContainer.offsetHeight;
                const topPos = firstMatch.offsetTop - searchContainerHeight - 15;
                window.scrollTo({ top: topPos, behavior: 'smooth' });
            }

            clearSearchBtn.classList.toggle('hidden', query.length === 0);
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            allItemElements.forEach(el => el.style.display = '');
            clearSearchBtn.classList.add('hidden');
            searchInput.focus();
        });

        searchInput.addEventListener('focus', () => searchContainer.classList.add('sticky'));
        searchInput.addEventListener('blur', () => {
            if (searchInput.value.length === 0) searchContainer.classList.remove('sticky');
        });
        // --- End of Search logic ---

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
        itemDiv.className = 'flex items-center justify-between p-3 bg-slate-800/50 rounded-lg';
        const orderUnit = item.Unit_Order || item.Unit_Inventory || item.Unit;
        
        itemDiv.dataset.itemName = item.ItemName;

        // --- MODIFICATION START: Updated HTML structure with wrapper and clear button ---
        itemDiv.innerHTML = `
            <div>
                <span class="font-semibold text-slate-200">${item.ItemName}</span>
                <p class="text-sm text-slate-400">${item.Description || ''}</p>
            </div>
            <div class="flex items-center gap-2">
                <div class="input-wrapper">
                    <input type="number" step="0.1" inputmode="decimal" class="order-quantity text-right p-2 border rounded-md w-24" data-item-name="${item.ItemName}" data-unit="${orderUnit}" data-subcategory="${item.SubCategory || '其他'}" placeholder="數量">
                    <span class="input-clear-btn material-symbols-outlined hidden" title="清除數量">close</span>
                </div>
                <span class="text-slate-400 w-12 text-left">${orderUnit}</span>
            </div>
        `;
        // --- MODIFICATION END ---
        container.appendChild(itemDiv);
    });
    
    document.getElementById('generate-order-btn').onclick = generateManualOrder;
}

function generateManualOrder() {
    const generateBtn = document.getElementById('generate-order-btn');
    setButtonLoading(generateBtn, true, "產生中...");

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
    
    setButtonLoading(generateBtn, false);

    setTimeout(() => {
        actionButtons.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}