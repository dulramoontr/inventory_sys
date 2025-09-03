// =================================================================
// HISTORICAL DASHBOARD PAGE LOGIC (`dashboard-history.html`)
// =================================================================

// Global chart instances
let chartMonthlyRevenue;

// Chart.js Global Defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';


async function initDashboardHistoryPage() {
    hideLoader(); 
    generatePresetButtons();
    setupEventListeners();
    setDefaultDates();
}

function setDefaultDates() {
    const endDateInput = document.getElementById('end-date');
    const startDateInput = document.getElementById('start-date');
    
    const today = new Date();
    endDateInput.valueAsDate = today;

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    startDateInput.valueAsDate = oneMonthAgo;
}

function generatePresetButtons() {
    const container = document.getElementById('preset-buttons-container');
    container.innerHTML = ''; 

    const currentYear = new Date().getFullYear();
    const targetYear = currentYear - 1; 

    const presets = [
        { label: `${targetYear} Q4`, type: 'Q4', year: targetYear },
        { label: `${targetYear} Q3`, type: 'Q3', year: targetYear },
        { label: `${targetYear} 上半年`, type: 'H1', year: targetYear }
    ];

    presets.forEach(preset => {
        const button = document.createElement('button');
        button.className = 'preset-btn text-sm py-1 px-3 rounded-full';
        button.textContent = preset.label;
        button.dataset.presetType = preset.type;
        button.dataset.presetYear = preset.year;
        container.appendChild(button);
    });
}


function setupEventListeners() {
    document.getElementById('query-btn').addEventListener('click', handleQueryClick);
    
    document.getElementById('preset-buttons-container').addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('preset-btn')) {
            const presetType = e.target.dataset.presetType;
            const presetYear = parseInt(e.target.dataset.presetYear, 10);
            handlePresetClick(presetType, presetYear);
        }
    });
}

function handlePresetClick(type, year) {
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    let start, end;

    // By creating dates in UTC, we avoid local timezone shifts when converting to string.
    switch (type) {
        case 'Q4':
            start = new Date(Date.UTC(year, 9, 1));
            end = new Date(Date.UTC(year, 11, 31));
            break;
        case 'Q3':
            start = new Date(Date.UTC(year, 6, 1));
            end = new Date(Date.UTC(year, 8, 30));
            break;
        case 'H1':
            start = new Date(Date.UTC(year, 0, 1));
            end = new Date(Date.UTC(year, 5, 30));
            break;
    }

    if (start && end) {
        // valueAsDate correctly handles the UTC date object for display
        startDateInput.valueAsDate = start;
        endDateInput.valueAsDate = end;
        handleQueryClick();
    }
}


async function handleQueryClick() {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) {
        alert('請選擇開始與結束日期');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        alert('開始日期不能晚於結束日期');
        return;
    }

    showLoader();
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('message-container').classList.add('hidden');

    try {
        const result = await apiRequest('GET', { 
            action: 'getHistoricalDashboardData', 
            startDate: startDate, 
            endDate: endDate 
        });

        // --- MODIFICATION START: Add console log for debugging ---
        if (result) {
            console.log("後端回傳的原始資料:", result.data);
        }
        // --- MODIFICATION END ---

        if (result && result.success) {
            if (result.data.message) {
                 showMessage(result.data.message);
            } else {
                renderDashboard(result.data);
                document.getElementById('results-container').classList.remove('hidden');
            }
        } else {
            throw new Error(result.message || "API returned no data.");
        }
    } catch (error) {
        console.error("Dashboard data loading failed:", error);
        showMessage(`資料載入失敗: ${error.message}`);
    } finally {
        hideLoader();
    }
}

function showMessage(msg) {
    const messageContainer = document.getElementById('message-container');
    messageContainer.querySelector('p').textContent = msg;
    messageContainer.classList.remove('hidden');
}

function renderDashboard(data) {
    renderMetrics(data);
    renderMonthlyRevenueChart(data.monthlyData);
    renderMonthlyStaffTable(data.monthlyData);
}

function renderMetrics(data) {
    document.getElementById('metric-total-revenue').innerText = `$ ${data.totalRevenue.toLocaleString()}`;
    document.getElementById('metric-avg-daily-revenue').innerText = `$ ${Math.round(data.avgDailyRevenue).toLocaleString()}`;
    document.getElementById('metric-highest-month').innerText = data.highestMonth.month || 'N/A';
    document.getElementById('metric-highest-month-revenue').innerText = `$ ${data.highestMonth.revenue.toLocaleString()}`;
    document.getElementById('metric-highest-day').innerText = data.highestDay.date;
    
    const staffName = data.highestDay.staff ? `(${data.highestDay.staff})` : '';
    document.getElementById('metric-highest-day-revenue').innerHTML = 
        `$ ${data.highestDay.revenue.toLocaleString()} <span class="font-semibold text-slate-300 ml-2">${staffName}</span>`;
}

function renderMonthlyRevenueChart(monthlyData) {
    const container = document.getElementById('chart-container-monthly-revenue');
    container.innerHTML = '<canvas id="chart-monthly-revenue"></canvas>';

    if (!monthlyData || monthlyData.labels.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center py-8">無足夠資料可繪製圖表</p>';
        return;
    }

    if (chartMonthlyRevenue) chartMonthlyRevenue.destroy();
    chartMonthlyRevenue = new Chart(document.getElementById('chart-monthly-revenue').getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthlyData.labels,
            datasets: [{
                label: '月營業額',
                data: monthlyData.revenueData,
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderRadius: 4,
            }]
        },
        options: { 
            responsive: true, 
            plugins: { legend: { display: false } }, 
            scales: { y: { beginAtZero: true } } 
        }
    });
}

function renderMonthlyStaffTable(monthlyData) {
    const container = document.getElementById('staff-table-container');
    if (!monthlyData || !monthlyData.staffRevenueData || monthlyData.labels.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-center py-8">無關帳人員資料</p>`;
        return;
    }

    const allStaff = new Set();
    monthlyData.labels.forEach(month => {
        Object.keys(monthlyData.staffRevenueData[month] || {}).forEach(staff => {
            if(staff) allStaff.add(staff);
        });
    });
    const staffList = Array.from(allStaff).sort();

    if (staffList.length === 0) {
        container.innerHTML = `<p class="text-slate-400 text-center py-8">無關帳人員營收資料</p>`;
        return;
    }
    
    let tableHtml = `<table class="staff-revenue-table w-full"><thead><tr><th>月份</th>`;
    staffList.forEach(staff => { tableHtml += `<th>${staff}</th>`; });
    tableHtml += `</tr></thead><tbody>`;

    monthlyData.labels.slice().reverse().forEach(month => {
        const staffInMonth = monthlyData.staffRevenueData[month] || {};
        
        let champion = null;
        let maxRevenue = -1;
        Object.entries(staffInMonth).forEach(([staff, revenue]) => {
            if (revenue > maxRevenue) {
                maxRevenue = revenue;
                champion = staff;
            }
        });

        tableHtml += `<tr>`;
        tableHtml += `<td>${month}</td>`;
        staffList.forEach(staff => {
            const revenue = staffInMonth[staff] || 0;
            const isChampionClass = staff === champion && revenue > 0 ? 'is-champion' : '';
            tableHtml += `<td><span class="${isChampionClass}">${revenue.toLocaleString()}</span></td>`;
        });
        tableHtml += `</tr>`;
    });
    
    tableHtml += `</tbody></table>`;
    container.innerHTML = tableHtml;
}