// 全新版本 script.js - 新的驗證流程

// --- [!!!] 重要設定：Google Apps Script URL ---
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzB3F7Tc7VeLKCw3R3a4Xd2kddijPaCPtNwoT38yWIT2zDoOYIEh2Iw32NERiwURXHV/exec';

// --- GLOBAL STATE & DOM REFERENCES ---
const appState = {
  currentPage: 'home-menu',
  parameters: [],
  inventoryRecords: [],
  currentCategory: '',
  accessCode: null, // 用來存放已驗證的存取碼
};
const views = {
  loader: document.getElementById('loader'),
  accessView: document.getElementById('access-view'),
  appView: document.getElementById('app-view'),
  mainContent: document.getElementById('main-content'),
  pageTitle: document.getElementById('page-title'),
  homeBtn: document.getElementById('home-btn')
};

// --- UTILITY FUNCTIONS ---
function showLoader() { views.loader.classList.remove('hidden'); }
function hideLoader() { views.loader.classList.add('hidden'); }
function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) { targetPage.classList.remove('hidden'); }
    if (pageId === 'home-menu') {
        views.pageTitle.textContent = '主選單';
        views.homeBtn.classList.add('hidden');
    } else {
        views.homeBtn.classList.remove('hidden');
    }
    window.scrollTo(0, 0);
}
function formatDate(date) {
    return new Date(date).toLocaleString('zh-TW', { timeStyle:'short', dateStyle: 'short' });
}

// --- API COMMUNICATION (自動攜帶存取碼) ---
async function runGAS(functionName, ...args) {
    if (!GAS_API_URL || GAS_API_URL.includes('在這裡貼上')) {
        alert('錯誤：尚未設定 Google Apps Script API URL！請編輯 script.js 檔案。');
        throw new Error('GAS API URL not configured.');
    }
    showLoader();

    // 對於受保護的函式，自動在參數最後加上存取碼
    const protectedFunctions = ['saveParameter', 'deleteParameter', 'updateAccessCode', 'saveInventoryRecord', 'verifyAccessCode'];
    if (protectedFunctions.includes(functionName)) {
        args.push(appState.accessCode);
    }
    
    const payload = JSON.stringify({ functionName, args });
    const requestUrl = `${GAS_API_URL}?payload=${encodeURIComponent(payload)}`;

    try {
        const response = await fetch(requestUrl, { method: 'GET', redirect: "follow" });
        if (!response.ok) throw new Error(`HTTP 錯誤! 狀態碼: ${response.status}`);
        const result = await response.json();
        if (result.success) {
            return result.data;
        } else {
            // 如果後端回報存取碼錯誤，清除本地存取碼
            if (result.message && result.message.includes("Access Denied")) {
                appState.accessCode = null;
                alert("存取碼錯誤或已過期，請重新驗證。");
            }
            throw new Error(result.message || '發生未知錯誤');
        }
    } catch (error) {
        console.error('API 呼叫失敗:', error);
        alert(`與後端伺服器通訊失敗: ${error.message}`);
        throw error;
    } finally {
        hideLoader();
    }
}

// --- INITIALIZATION & EVENT HANDLERS ---
document.addEventListener('DOMContentLoaded', () => {
    // 移除舊的登入監聽器
    document.getElementById('login-btn').addEventListener('click', handleAccessCodeSubmit);
    document.getElementById('access-code-input').addEventListener('keyup', e => {
        if (e.key === 'Enter') handleAccessCodeSubmit();
    });
    document.getElementById('cancel-login-btn').addEventListener('click', () => {
        views.accessView.classList.add('hidden');
    });

    views.homeBtn.addEventListener('click', () => navigateTo('home-menu'));
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', handleCardClick);
    });
    
    // (其他監聽器與之前相同)
    document.getElementById('load-history-btn').addEventListener('click', handleLoadHistoryClick);
    document.getElementById('history-dropdown').addEventListener('change', handleHistorySelection);
    document.getElementById('save-inventory-btn').addEventListener('click', handleSaveInventory);
    document.getElementById('generate-order-btn').addEventListener('click', handleGenerateOrder);
    document.getElementById('order-history-dropdown').addEventListener('change', renderOrderFromInventory);
    document.querySelectorAll('input[name="minStockType"]').forEach(radio => radio.addEventListener('change', renderOrderFromInventory));
    document.getElementById('copy-text-btn').addEventListener('click', copyOrderText);
    document.getElementById('share-line-text-btn').addEventListener('click', shareOrderToLineText);
    document.getElementById('share-line-image-btn').addEventListener('click', shareOrderToLineImage);
    document.querySelector('.tabs').addEventListener('click', handleTabClick);
    document.getElementById('save-access-code-btn').addEventListener('click', handleSaveAccessCode);
    document.getElementById('add-param-btn').addEventListener('click', () => openParamModal(null, appState.currentCategory));
    document.querySelector('#param-modal .close-btn').addEventListener('click', closeParamModal);
    document.getElementById('param-form').addEventListener('submit', handleParamFormSubmit);

    // 啟動應用程式
    initializeApp();
});

async function initializeApp() {
    // 一進入網頁就顯示主選單並載入公開資料
    views.appView.classList.remove('hidden');
    views.accessView.classList.add('hidden');
    navigateTo('home-menu');
    await initializePublicData();
}

async function initializePublicData() {
    try {
        const [params, records] = await Promise.all([
            runGAS('getParameters'),
            runGAS('getInventoryRecords')
        ]);
        appState.parameters = params || [];
        appState.inventoryRecords = records || [];
    } catch(e) {
        console.error("無法載入初始資料:", e);
    }
}

// 新的點擊處理邏輯
function handleCardClick(e) {
    const targetPage = e.currentTarget.dataset.target;
    const category = e.currentTarget.dataset.category;

    // 如果點擊的是設定，檢查存取碼
    if (targetPage === 'settings-page') {
        if (appState.accessCode) {
            views.pageTitle.textContent = '參數設定';
            document.querySelector('.tabs .tab-btn[data-category="央廚"]').click();
            navigateTo(targetPage);
        } else {
            showAccessPrompt();
        }
        return;
    }
    
    // 其他卡片的處理邏輯不變
    if (category) {
        appState.currentCategory = category;
        views.pageTitle.textContent = `${category} - ${targetPage.includes('inventory') ? '庫存盤點' : '叫貨'}`;
    }
    if (targetPage === 'inventory-page') renderInventoryPage();
    else if (targetPage === 'order-page') renderOrderPage();
    navigateTo(targetPage);
}

// 顯示存取碼輸入框
function showAccessPrompt() {
    document.getElementById('login-error').textContent = '';
    document.getElementById('access-code-input').value = '';
    views.accessView.classList.remove('hidden');
    document.getElementById('access-code-input').focus();
}

// 處理存取碼提交
async function handleAccessCodeSubmit() {
    const code = document.getElementById('access-code-input').value;
    if (!code) {
        document.getElementById('login-error').textContent = '請輸入存取碼';
        return;
    }
    try {
        await runGAS('verifyAccessCode', code); // 驗證成功會直接通過，失敗會在 runGAS 中拋出錯誤
        appState.accessCode = code; // 驗證成功，將存取碼存起來
        views.accessView.classList.add('hidden');
        // 成功後，導向至設定頁面
        views.pageTitle.textContent = '參數設定';
        document.querySelector('.tabs .tab-btn[data-category="央廚"]').click();
        navigateTo('settings-page');
    } catch (error) {
        document.getElementById('login-error').textContent = '存取碼錯誤';
        console.error("驗證失敗:", error);
    }
}

// 修改儲存盤點函式，使其需要存取碼
async function handleSaveInventory() {
    if (!appState.accessCode) {
        alert("請先在「參數設定」中驗證存取碼，才能儲存紀錄。");
        showAccessPrompt();
        return;
    }
    // ... (原有的儲存邏輯不變)
    const record = { category: appState.currentCategory, items: {} };
    let hasInput = false;
    document.querySelectorAll('.inventory-item').forEach(el => {
        const itemId = el.dataset.itemid;
        const quantity = el.querySelector('.inventory-quantity').value;
        if(quantity !== '' && quantity !== null) {
            record.items[itemId] = parseFloat(quantity);
            hasInput = true;
        }
    });
    if (!hasInput) { alert('請至少輸入一項盤點數量'); return; }
    try {
        await runGAS('saveInventoryRecord', record);
        alert('盤點紀錄儲存成功！');
        await initializePublicData();
        views.pageTitle.textContent = `${appState.currentCategory} - 叫貨`;
        renderOrderPage(true);
        navigateTo('order-page');
    } catch (error) { console.error("Failed to save inventory:", error); }
}

// (此處以下的所有其他 handle... 和 render... 函式都與之前版本完全相同)
function renderInventoryPage(){/*...*/} function handleLoadHistoryClick(){/*...*/} function handleHistorySelection(e){/*...*/} function renderOrderPage(fromInventorySave = false){/*...*/} function renderOrderFromInventory(record){/*...*/} function handleGenerateOrder(){/*...*/} function generateFinalOrderList(orderList){/*...*/} function getOrderAsText(){/*...*/} function copyOrderText(){/*...*/} function shareOrderToLineText(){/*...*/} async function shareOrderToLineImage(){/*...*/} function handleTabClick(e){/*...*/} function renderSettingsList(){/*...*/} async function handleSaveAccessCode(){/*...*/} function openParamModal(item = null, category = appState.currentCategory){/*...*/} function closeParamModal(){/*...*/} async function handleParamFormSubmit(e){/*...*/} async function handleDeleteParameter(e){/*...*/}

// 為了讓您方便複製，這裡提供完整的函式實作
function renderInventoryPage(){const listEl=document.getElementById("inventory-list");listEl.innerHTML="";const items=appState.parameters.filter(p=>p.Category===appState.currentCategory);items.forEach(item=>{const itemDiv=document.createElement("div");itemDiv.className="inventory-item";itemDiv.dataset.itemid=item.ItemID;itemDiv.innerHTML=`
            <div class="item-name">${item.ItemName}</div>
            ${item.Description?`<div class="item-desc">${item.Description}</div>`:""}
            <div class="input-group">
                <label>盤點數量:</label>
                <input type="number" class="inventory-quantity" placeholder="0" min="0" inputmode="numeric">
            </div>
        `;listEl.appendChild(itemDiv)});document.getElementById("history-dropdown").classList.add("hidden")}
function handleLoadHistoryClick(){const dropdown=document.getElementById("history-dropdown");dropdown.innerHTML='<option value="">請選擇歷史紀錄</option>';const records=appState.inventoryRecords.filter(r=>r.Category===appState.currentCategory);if(records.length>0){records.forEach(r=>{dropdown.innerHTML+=`<option value="${r.RecordID}">${formatDate(r.Timestamp)}</option>`});dropdown.classList.remove("hidden")}else{alert("沒有符合的歷史紀錄")}}
function handleHistorySelection(e){const recordId=e.target.value;if(!recordId)return;const record=appState.inventoryRecords.find(r=>r.RecordID===recordId);if(record){const items=JSON.parse(record.Records);document.querySelectorAll(".inventory-item").forEach(el=>{const itemId=el.dataset.itemid;const quantityInput=el.querySelector(".inventory-quantity");quantityInput.value=items[itemId]||""})}}
function renderOrderPage(fromInventorySave=!1){const directInputSection=document.getElementById("order-direct-input-section"),fromInventorySection=document.getElementById("order-from-inventory-section"),generateBtn=document.getElementById("generate-order-btn"),outputContainer=document.getElementById("order-output-container");directInputSection.classList.add("hidden");fromInventorySection.classList.add("hidden");generateBtn.classList.add("hidden");outputContainer.classList.add("hidden");directInputSection.innerHTML="";if("菜商"===appState.currentCategory){directInputSection.classList.remove("hidden");generateBtn.classList.remove("hidden");const items=appState.parameters.filter(p=>"菜商"===p.Category),groupedItems=items.reduce((acc,item)=>{const group=item.SubCategory||"其他";acc[group]||(acc[group]=[]),acc[group].push(item);return acc},{});for(const group in groupedItems){directInputSection.innerHTML+=`<h3>${group}</h3>`;groupedItems[group].forEach(item=>{directInputSection.innerHTML+=`
                    <div class="order-item" data-itemid="${item.ItemID}">
                        <div class="item-name">${item.ItemName}</div>
                        ${item.Description?`<div class="item-desc">${item.Description}</div>`:""}
                        <div class="input-group">
                            <label>叫貨數量:</label>
                            <input type="number" class="order-quantity" placeholder="0" min="0" inputmode="numeric">
                        </div>
                    </div>
                `})}}else{fromInventorySection.classList.remove("hidden");const dropdown=document.getElementById("order-history-dropdown"),infoMsg=document.getElementById("order-no-today-record");dropdown.innerHTML="";const relevantRecords=appState.inventoryRecords.filter(r=>r.Category===appState.currentCategory),today=(new Date).toDateString(),todayRecord=relevantRecords.find(r=>(new Date(r.Timestamp)).toDateString()===today);if(fromInventorySave||todayRecord)infoMsg.classList.add("hidden"),dropdown.classList.add("hidden"),renderOrderFromInventory(fromInventorySave?relevantRecords[0]:todayRecord);else{infoMsg.textContent="未找到今日盤點紀錄，請選擇一筆歷史紀錄作為計算依據";infoMsg.classList.remove("hidden");dropdown.classList.remove("hidden");dropdown.innerHTML='<option value="">請選擇盤點紀錄</option>';relevantRecords.forEach(r=>{dropdown.innerHTML+=`<option value="${r.RecordID}">${formatDate(r.Timestamp)}</option>`})}}}
function renderOrderFromInventory(record){let recordToUse=record;if(event&&event.target&&"order-history-dropdown"===event.target.id){const recordId=event.target.value;if(!recordId)return void document.getElementById("order-output-container").classList.add("hidden");recordToUse=appState.inventoryRecords.find(r=>r.RecordID===recordId)}else if(event&&event.target&&"minStockType"===event.target.name){const selectedId=document.getElementById("order-history-dropdown").value;if(selectedId)recordToUse=appState.inventoryRecords.find(r=>r.RecordID===selectedId);else{const today=(new Date).toDateString();recordToUse=appState.inventoryRecords.find(r=>r.Category===appState.currentCategory&&(new Date(r.Timestamp)).toDateString()===today)}recordToUse||(recordToUse=appState.inventoryRecords[0]);if(!recordToUse)return}if(!recordToUse||!recordToUse.Records)return;const inventoryItems=JSON.parse(recordToUse.Records),minStockType=document.querySelector('input[name="minStockType"]:checked').value,orderList=[];appState.parameters.filter(p=>p.Category===appState.currentCategory).forEach(param=>{const currentStock=inventoryItems[param.ItemID]??-1/0,minStock=param[minStockType]||0,packageFactor=param.PackageFactor||1;if(currentStock<minStock){const orderQty=Math.ceil((minStock-currentStock)/packageFactor);orderQty>0&&orderList.push({name:param.ItemName,quantity:orderQty,unit:param.Unit})}});generateFinalOrderList(orderList)}
function handleGenerateOrder(){if("菜商"===appState.currentCategory){const orderList=[];document.querySelectorAll("#order-direct-input-section .order-item").forEach(el=>{const quantity=el.querySelector(".order-quantity").value;if(quantity&&parseFloat(quantity)>0){const itemId=el.dataset.itemid,param=appState.parameters.find(p=>p.ItemID===itemId);param&&orderList.push({name:param.ItemName,quantity:parseFloat(quantity),unit:param.Unit})}});generateFinalOrderList(orderList)}}
function generateFinalOrderList(orderList){const container=document.getElementById("order-output-container");if(0===orderList.length)return alert("沒有需要叫貨的品項"),void container.classList.add("hidden");document.getElementById("order-title").textContent=`${appState.currentCategory}叫貨單`;document.getElementById("order-timestamp").textContent=`產生時間: ${formatDate(new Date)}`;const tableBody=document.querySelector("#order-table tbody");tableBody.innerHTML="";orderList.forEach(item=>{tableBody.innerHTML+=`<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.unit}</td></tr>`});container.classList.remove("hidden")}
function getOrderAsText(){let text=`${document.getElementById("order-title").textContent}\n`;text+=`${document.getElementById("order-timestamp").textContent}\n\n`;document.querySelectorAll("#order-table tbody tr").forEach(row=>{const cells=row.querySelectorAll("td");text+=`${cells[0].textContent}: ${cells[1].textContent} ${cells[2].textContent}\n`});return text}
function copyOrderText(){const text=getOrderAsText();navigator.clipboard.writeText(text).then(()=>{alert("叫貨清單已複製！")},()=>{alert("複製失敗")})}
function shareOrderToLineText(){const text=getOrderAsText(),lineUrl=`https://line.me/R/msg/text/?${encodeURIComponent(text)}`;window.open(lineUrl,"_blank")}
async function shareOrderToLineImage(){showLoader();try{const canvas=await html2canvas(document.getElementById("order-output")),imageUrl=canvas.toDataURL("image/png"),newTab=window.open();newTab.document.write(`
            <body style="margin:0; text-align:center; background-color:#f0f0f0;">
              <h2 style="font-family:sans-serif;">請長按或右鍵點擊圖片，即可儲存或分享</h2>
              <img src="${imageUrl}" style="max-width: 100%; border: 1px solid #ccc;">
            </body>
        `)}catch(e){alert("產生圖片失敗: "+e.message)}finally{hideLoader()}}
function handleTabClick(e){if(!e.target.classList.contains("tab-btn"))return;document.querySelectorAll(".tab-btn").forEach(btn=>btn.classList.remove("active"));e.target.classList.add("active");appState.currentCategory=e.target.dataset.category;renderSettingsList()}
function renderSettingsList(){const listEl=document.getElementById("settings-list");listEl.innerHTML="";const items=appState.parameters.filter(p=>p.Category===appState.currentCategory);0===items.length?listEl.innerHTML="<p>尚無品項</p>":items.forEach(item=>{const itemDiv=document.createElement("div");itemDiv.dataset.itemid=item.ItemID;itemDiv.innerHTML=`
                <div class="item-controls">
                    <button class="edit-param-btn">修改</button>
                    <button class="delete-param-btn">刪除</button>
                </div>
                <div class="item-name">${item.ItemName}</div>
                <div class="item-desc">單位: ${item.Unit}</div>
            `;listEl.appendChild(itemDiv)});document.querySelectorAll(".edit-param-btn").forEach(btn=>{btn.addEventListener("click",e=>{const itemId=e.target.closest("div[data-itemid]").dataset.itemid,item=appState.parameters.find(p=>p.ItemID===itemId);openParamModal(item)})});document.querySelectorAll(".delete-param-btn").forEach(btn=>{btn.addEventListener("click",handleDeleteParameter)})}
async function handleSaveAccessCode(){const newCode=document.getElementById("new-access-code").value,confirmCode=document.getElementById("confirm-access-code").value;if(!newCode||newCode!==confirmCode)return void alert("新存取碼為空或兩次輸入不一致");try{await runGAS("updateAccessCode",newCode),alert("存取碼更新成功"),document.getElementById("new-access-code").value="",document.getElementById("confirm-access-code").value=""}catch(error){console.error("Failed to save access code:",error)}}
function openParamModal(item=null,category=appState.currentCategory){const form=document.getElementById("param-form");form.reset();document.getElementById("param-SubCategory-container").classList.add("hidden");document.getElementById("inventory-params-container").classList.add("hidden");const categoryToUse=item?item.Category:category;item?(document.getElementById("modal-title").textContent="修改品項",document.getElementById("param-ItemID").value=item.ItemID,document.getElementById("param-ItemName").value=item.ItemName,document.getElementById("param-SubCategory").value=item.SubCategory||"蔬菜",document.getElementById("param-Description").value=item.Description,document.getElementById("param-Unit").value=item.Unit,document.getElementById("param-PackageFactor").value=item.PackageFactor||1,document.getElementById("param-MinStockNormal").value=item.MinStockNormal||0,document.getElementById("param-MinStockHoliday").value=item.MinStockHoliday||0,document.getElementById("param-IsRequired").checked=item.IsRequired):(document.getElementById("modal-title").textContent="新增品項",document.getElementById("param-ItemID").value="");document.getElementById("param-Category").value=categoryToUse;"菜商"===categoryToUse?document.getElementById("param-SubCategory-container").classList.remove("hidden"):document.getElementById("inventory-params-container").classList.remove("hidden");document.getElementById("param-modal").classList.remove("hidden")}
function closeParamModal(){document.getElementById("param-modal").classList.add("hidden")}
async function handleParamFormSubmit(e){e.preventDefault();const paramObj={ItemID:document.getElementById("param-ItemID").value,Category:document.getElementById("param-Category").value,ItemName:document.getElementById("param-ItemName").value,SubCategory:document.getElementById("param-SubCategory").value,Description:document.getElementById("param-Description").value,Unit:document.getElementById("param-Unit").value,PackageFactor:document.getElementById("param-PackageFactor").value,MinStockNormal:document.getElementById("param-MinStockNormal").value,MinStockHoliday:document.getElementById("param-MinStockHoliday").value,IsRequired:document.getElementById("param-IsRequired").checked};try{const savedParam=await runGAS("saveParameter",paramObj);if(savedParam){const index=appState.parameters.findIndex(p=>p.ItemID===savedParam.ItemID);index>-1?appState.parameters[index]=savedParam:appState.parameters.push(savedParam),renderSettingsList(),closeParamModal()}}catch(error){console.error("Failed to save parameter:",error)}}
async function handleDeleteParameter(e){const itemId=e.target.closest("div[data-itemid]").dataset.itemid;if(confirm("確定要刪除此品項嗎？（此操作無法復原）"))try{await runGAS("deleteParameter",itemId);const param=appState.parameters.find(p=>p.ItemID===itemId);param&&(param.IsActive=!1),renderSettingsList()}catch(error){console.error("Failed to delete parameter:",error)}}