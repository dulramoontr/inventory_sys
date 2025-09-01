// =================================================================
// DASHBOARD PAGE LOGIC (`dashboard.html`) - v13 (Access Control)
// =================================================================

// Global chart instances
let chart30Day, chartMonthlyRevenue;

// Chart.js Global Defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';


// --- MODIFICATION START: Reworked initialization flow ---
async function initDashboardPage() {
    // Show loader immediately while we check for verification
    showLoader(); 
    
    const verified = sessionStorage.getItem('dashboardAccessVerified');
    
    if (verified === 'true') {
        await loadDashboardData();
    } else {
        hideLoader(); // Hide full-page loader
        document.getElementById('access-modal').classList.remove('hidden');
    }

    // Add event listener for the access form
    document.getElementById('access-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('access-code-input');
        const code = codeInput.value;
        if (!code) return;

        showLoader(); // Show loader during verification
        const result = await apiRequest('POST', { action: 'verifyAccessCode', code: code });
        hideLoader();

        if (result && result.success) {
            sessionStorage.setItem('dashboardAccessVerified', 'true');
            document.getElementById('access-modal').classList.add('hidden');
            await loadDashboardData();
        } else {
            alert('存取碼錯誤！');
            codeInput.value = '';
            codeInput.focus();
        }
    });
}

async function loadDashboardData() {
    showLoader(); // Show loader while fetching data
    document.getElementById('dashboard-content').classList.remove('hidden');
    
    try {
        const result = await apiRequest('GET', { action: 'getDashboardData' });
        if (result && result.data) {
            renderDashboard(result.data);
        } else {
            document.querySelector('main').innerHTML = '<p class="text-center text-red-400">儀表板資料載入失敗，請稍後再試。</p>';
        }
    } catch (error) {
        console.error("Dashboard data loading failed:", error);
    } finally {
        hideLoader();
    }
}
// --- MODIFICATION END ---


function renderDashboard(data) {
    document.getElementById('metric-yesterday-revenue').innerText = `$ ${data.yesterdayRevenue.toLocaleString() || 'N/A'}`;
    document.getElementById('metric-current-month-revenue').innerText = `$ ${data.currentMonthRevenue.toLocaleString() || 'N/A'}`;
    document.getElementById('metric-prev-month-revenue').innerText = `$ ${data.prevMonthRevenue.toLocaleString() || 'N/A'}`;
    document.getElementById('metric-soup-stock').innerText = `${data.latestSoupStock.toLocaleString() || 'N/A'} 包`;
    document.getElementById('metric-soup-stock-desc').classList.remove('hidden');

    const prevMonthMoMEl = document.getElementById('metric-prev-month-mom-trend');
    const prevMonthYoYEl = document.getElementById('metric-prev-month-yoy-trend');

    const createTrendHtml = (trendValue, comparisonText) => {
        if (trendValue === null || trendValue === undefined || isNaN(trendValue)) {
             return `<span class="text-slate-500">${comparisonText} 無法比較</span>`;
        }
        const isPositive = trendValue >= 0;
        return `
            <span class="font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}">
                <span class="material-symbols-outlined text-base align-middle">${isPositive ? 'arrow_upward' : 'arrow_downward'}</span>
                ${Math.abs(trendValue).toFixed(1)}%
            </span>
            <span class="text-slate-400">${comparisonText}</span>`;
    };

    prevMonthMoMEl.innerHTML = createTrendHtml(data.prevMonthMoMTrend, '與前月相比');
    prevMonthYoYEl.innerHTML = createTrendHtml(data.prevMonthYoYTrend, '與去年同期相比');

    render30DayTrendChart(data.last30DaysRevenue);
    renderMonthlyRevenueChart(data.last12Months);
    renderMonthlyStaffTable(data.last12Months);
}

function render30DayTrendChart(trendData) {
    const container = document.getElementById('chart-container-30-day');
    const canvas = document.getElementById('chart-30-day-trend');
    if (!trendData || trendData.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center py-8">無足夠資料可繪製趨勢圖</p>';
        return;
    }

    container.querySelector('.chart-loader').classList.add('hidden');
    canvas.classList.remove('hidden');

    if (chart30Day) chart30Day.destroy();
    chart30Day = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: trendData.map(d => d[0]),
            datasets: [{
                label: '每日營業額',
                data: trendData.map(d => d[1]),
                borderColor: 'rgba(59, 130, 246, 0.8)',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                fill: true,
                tension: 0.3,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointRadius: 2,
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderMonthlyRevenueChart(monthlyData) {
    const container = document.getElementById('chart-container-monthly-revenue');
    const canvas = document.getElementById('chart-monthly-revenue');
    if (!monthlyData) {
        container.innerHTML = '<p class="text-slate-400 text-center py-8">無資料</p>';
        return;
    }
    
    container.querySelector('.chart-loader').classList.add('hidden');
    canvas.classList.remove('hidden');

    if (chartMonthlyRevenue) chartMonthlyRevenue.destroy();
    chartMonthlyRevenue = new Chart(canvas.getContext('2d'), {
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
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}

function renderMonthlyStaffTable(monthlyData) {
    const container = document.getElementById('staff-table-container');
    if (!monthlyData || monthlyData.labels.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center py-8">無資料</p>';
        return;
    }

    const allStaff = new Set();
    monthlyData.labels.forEach(month => {
        Object.keys(monthlyData.staffRevenueData[month] || {}).forEach(staff => allStaff.add(staff));
    });
    const staffList = Array.from(allStaff);

    const gridColsClass = `grid-cols-${staffList.length + 1}`;
    let tableHtml = `<div class="staff-revenue-table">`;

    tableHtml += `<div class="table-header ${gridColsClass}">`;
    tableHtml += `<div>月份</div>`;
    staffList.forEach(staff => { tableHtml += `<div>${staff}</div>`; });
    tableHtml += `</div>`;

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

        tableHtml += `<div class="table-row ${gridColsClass}">`;
        
        const gregorianYear = parseInt(month.substring(0, 4));
        const rocYear = gregorianYear - 1911;
        const monthNum = month.substring(5, 7);
        tableHtml += `<div>${rocYear}/${monthNum}</div>`;

        staffList.forEach(staff => {
            const revenue = staffInMonth[staff] || 0;
            const isChampionClass = staff === champion ? 'is-champion' : '';
            tableHtml += `<div class="${isChampionClass}">${revenue.toLocaleString()}</div>`;
        });

        tableHtml += `</div>`;
    });

    tableHtml += `</div>`;
    container.innerHTML = tableHtml;

    const tableHeader = container.querySelector('.table-header');
    const tableRows = container.querySelectorAll('.table-row');
    const gridTemplate = `0.8fr ${'1fr '.repeat(staffList.length)}`.trim();
    if (tableHeader) tableHeader.style.gridTemplateColumns = gridTemplate;
    tableRows.forEach(row => { row.style.gridTemplateColumns = gridTemplate; });
}