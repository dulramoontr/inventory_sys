// =================================================================
// DASHBOARD PAGE LOGIC (`dashboard.html`) - v15 (Fixed with Single API Call)
// =================================================================

// Global chart instances
let chart30Day, chartMonthlyRevenue;

// Chart.js Global Defaults
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';


// --- Initialization logic remains the same ---
async function initDashboardPage() {
    hideLoader(); 
    const verified = sessionStorage.getItem('dashboardAccessVerified');
    
    if (verified === 'true') {
        document.getElementById('dashboard-content').classList.remove('hidden');
        loadAndRenderDashboard();
    } else {
        document.getElementById('access-modal').classList.remove('hidden');
    }

    document.getElementById('access-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const codeInput = document.getElementById('access-code-input');
        const code = codeInput.value;
        if (!code) return;

        showLoader();
        const result = await apiRequest('POST', { action: 'verifyAccessCode', code: code });
        hideLoader();

        if (result && result.success) {
            sessionStorage.setItem('dashboardAccessVerified', 'true');
            document.getElementById('access-modal').classList.add('hidden');
            document.getElementById('dashboard-content').classList.remove('hidden');
            loadAndRenderDashboard();
        } else {
            alert('存取碼錯誤！');
            codeInput.value = '';
            codeInput.focus();
        }
    });
}

async function loadAndRenderDashboard() {
    try {
        const result = await apiRequest('GET', { action: 'getDashboardData' });
        if (result && result.data) {
            renderDashboard(result.data);
        } else {
            throw new Error("API returned no data.");
        }
    } catch (error) {
        console.error("Dashboard data loading failed:", error);
        renderAllComponentsError();
    }
}


function renderDashboard(data) {
    renderMetrics(data);
    render30DayTrendChart(data.last30DaysRevenue);
    renderMonthlyRevenueChart(data.last12Months);
    renderMonthlyStaffTable(data.last12Months);
}

function renderMetrics(data) {
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
        renderChartError('chart-container-monthly-revenue');
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
        renderChartError('staff-table-container', '無資料');
        return;
    }

    const allStaff = new Set();
    monthlyData.labels.forEach(month => {
        Object.keys(monthlyData.staffRevenueData[month] || {}).forEach(staff => allStaff.add(staff));
    });
    const staffList = Array.from(allStaff);

    if (staffList.length === 0) {
        renderChartError('staff-table-container', '無關帳人員營收資料');
        return;
    }

    const staffTotals = {};
    const staffCounts = {};
    staffList.forEach(staff => {
        staffTotals[staff] = 0;
        staffCounts[staff] = 0;
    });

    monthlyData.labels.forEach(month => {
        const staffInMonth = monthlyData.staffRevenueData[month] || {};
        staffList.forEach(staff => {
            if (staffInMonth[staff] !== undefined) {
                staffTotals[staff] += staffInMonth[staff];
                staffCounts[staff]++;
            }
        });
    });

    const staffAverages = {};
    staffList.forEach(staff => {
        staffAverages[staff] = staffCounts[staff] > 0 ? Math.round(staffTotals[staff] / staffCounts[staff]) : 0;
    });

    let averageChampion = null;
    let maxAverage = -1;
    Object.entries(staffAverages).forEach(([staff, avg]) => {
        if (avg > maxAverage) {
            maxAverage = avg;
            averageChampion = staff;
        }
    });

    let tableHtml = `<table class="staff-revenue-table"><thead><tr>`;
    tableHtml += `<th>月份</th>`;
    staffList.forEach(staff => { tableHtml += `<th>${staff}</th>`; });
    tableHtml += `</tr></thead><tbody>`;

    monthlyData.labels.slice().reverse().forEach(month => {
        const staffInMonth = monthlyData.staffRevenueData[month] || {};
        
        let champion = null;
        let maxRevenue = -1;
        Object.entries(staffInMonth).forEach(([staff, revenue]) => { if (revenue > maxRevenue) { maxRevenue = revenue; champion = staff; } });

        tableHtml += `<tr>`;
        const gregorianYear = parseInt(month.substring(0, 4));
        const rocYear = gregorianYear - 1911;
        const monthNum = month.substring(5, 7);
        tableHtml += `<td>${rocYear}/${monthNum}</td>`;

        staffList.forEach(staff => {
            const revenue = staffInMonth[staff] || 0;
            const isChampionClass = staff === champion ? 'is-champion' : '';
            tableHtml += `<td><span class="${isChampionClass}">${revenue.toLocaleString()}</span></td>`;
        });
        tableHtml += `</tr>`;
    });
    
    tableHtml += `</tbody><tfoot><tr>`;
    tableHtml += `<td>平均</td>`;
    staffList.forEach(staff => {
        const isAvgChampion = staff === averageChampion ? 'is-avg-champion' : '';
        // --- MODIFICATION START: Changed icon from 'workspace_premium' to 'emoji_events' ---
        tableHtml += `<td class="${isAvgChampion}">
                        ${isAvgChampion ? '<span class="avg-champion-crown material-symbols-outlined">crown</span>' : ''}
                        <span>${staffAverages[staff].toLocaleString()}</span>
                    </td>`;
        // --- MODIFICATION END ---
    });
    tableHtml += `</tr></tfoot></table>`;
    
    container.innerHTML = tableHtml;
}


function renderAllComponentsError() {
    const errorText = `<span class="text-sm text-red-400">讀取失敗</span>`;
    document.getElementById('metric-yesterday-revenue').innerHTML = errorText;
    document.getElementById('metric-current-month-revenue').innerHTML = errorText;
    document.getElementById('metric-prev-month-revenue').innerHTML = errorText;
    document.getElementById('metric-soup-stock').innerHTML = errorText;
    document.getElementById('metric-prev-month-mom-trend').innerHTML = '';
    document.getElementById('metric-prev-month-yoy-trend').innerHTML = '';
    
    renderChartError('chart-container-30-day');
    renderChartError('chart-container-monthly-revenue');
    renderChartError('staff-table-container');
}

function renderChartError(containerId, message = '資料載入失敗') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<p class="text-slate-400 text-center py-8">${message}</p>`;
    }
}