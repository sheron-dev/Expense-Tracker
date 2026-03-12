/**
 * Main Application Logic
 */

const App = {
    state: {
        currentMonth: '', // Empty means "All Months" by default. Was: new Date().toISOString().slice(0, 7)
        theme: localStorage.getItem('expensematrix_theme') || 'light' // Return to a light default for iOS feel
    },
    charts: {
        weekly: null,
        category: null,
        report: null
    },
    
    init() {
        // Ensure data is trimmed to 20 examples on load as requested
        window.AppDB.keepOnly20();

        // Initialize Icons
        lucide.createIcons();
        
        // Setup Theme
        this.applyTheme(this.state.theme);
        
        // Bind Core Events
        this.bindEvents();
        
        // Set default dates
        document.getElementById('entry-date').valueAsDate = new Date();
        
        // Setup Charts Global Defaults (font color for themes)
        Chart.defaults.color = this.state.theme === 'dark' ? '#94a3b8' : '#64748b';
        Chart.defaults.font.family = "'Plus Jakarta Sans', sans-serif";

        // Route to dashboard
        this.navigate('dashboard');
    },

    bindEvents() {
        // Routing
        document.querySelectorAll('.nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                this.navigate(view);
                // Close mobile sidebar if open
                document.getElementById('sidebar').classList.remove('open');
            });
        });

        // Mobile Sidebar
        document.getElementById('mobile-open').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('open');
        });
        document.getElementById('mobile-close').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });

        // Theme Toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.state.theme = this.state.theme === 'light' ? 'dark' : 'light';
            localStorage.setItem('expensematrix_theme', this.state.theme);
            this.applyTheme(this.state.theme);
        });

        // Forms
        document.getElementById('add-expense-form').addEventListener('submit', this.handleSaveExpense.bind(this));
        document.getElementById('btn-cancel-expense').addEventListener('click', () => {
            document.getElementById('add-expense-form').reset();
            document.getElementById('entry-date').valueAsDate = new Date();
        });

        // Modals
        document.getElementById('btn-new-category').addEventListener('click', () => {
            document.getElementById('modal-category').classList.add('active');
        });
        document.getElementById('modal-cat-close').addEventListener('click', () => {
            document.getElementById('modal-category').classList.remove('active');
        });
        document.getElementById('form-category').addEventListener('submit', this.handleSaveCategory.bind(this));

        // Filters
        document.getElementById('tx-month-filter').addEventListener('change', this.renderTransactionsTable.bind(this));
        document.getElementById('tx-category-filter').addEventListener('change', this.renderTransactionsTable.bind(this));
        
        document.getElementById('report-month').addEventListener('change', (e) => {
            this.renderReports(e.target.value);
        });
        document.getElementById('pivot-month-filter').addEventListener('change', (e) => {
            this.renderPivotTable(e.target.value);
        });

        // Quick Adds & Imports
        document.getElementById('btn-add-new-tx').addEventListener('click', () => {
            this.navigate('add-expense');
        });

        document.getElementById('btn-import-xlsx').addEventListener('click', () => {
            document.getElementById('file-import-xlsx').click();
        });
        document.getElementById('file-import-xlsx').addEventListener('change', this.handleImportXLSX.bind(this));

        // Let user wipe data easily if imports mess it up
        document.getElementById('btn-reset-data').addEventListener('click', () => {
            if(confirm('Are you sure you want to reset ALL tracking data? This cannot be undone.')) {
                window.AppDB.resetAllData();
                this.navigate('dashboard');
                this.showToast('All transaction data has been permanently cleared!', true);
            }
        });
    },

    applyTheme(theme) {
        document.body.className = theme;
        // Update charts if they exist
        const textColor = theme === 'dark' ? '#86868b' : '#86868b';
        Chart.defaults.color = textColor;
        if(this.charts.weekly) this.charts.weekly.update();
        if(this.charts.category) this.charts.category.update();
        if(this.charts.report) this.charts.report.update();
    },

    navigate(viewId) {
        // Update Nav Active State
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (navItem) navItem.classList.add('active');

        // Update Title
        const titles = {
            'dashboard': 'Dashboard',
            'transactions': 'Transactions',
            'add-expense': 'Record Expense',
            'reports': 'Monthly Reports',
            'pivot': 'Category Summary Matrix'
        };
        document.getElementById('page-title').textContent = titles[viewId] || 'ExpenseMatrix';

        // Show View
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        // Render Specific View Logic
        this.renderView(viewId);
    },

    renderView(viewId) {
        switch(viewId) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'transactions':
                this.populateFilters();
                this.renderTransactionsTable();
                break;
            case 'add-expense':
                this.populateCategoryDropdown('entry-category');
                break;
            case 'reports':
                this.populateReportMonths();
                this.renderReports(this.state.currentMonth);
                break;
            case 'pivot':
                this.populatePivotMonths();
                this.renderPivotTable(document.getElementById('pivot-month-filter').value);
                break;
        }
    },

    // ==== Dashboard ====
    renderDashboard() {
        const month = this.state.currentMonth;
        const txs = window.AppDB.getExpensesByMonth(month);
        
        let totalSpent = 0;
        
        txs.forEach(t => {
            totalSpent += t.amount;
        });

        // Update Summary Cards
        document.getElementById('dash-total-expenses').textContent = this.formatCurrency(totalSpent);

        // Render Mini Lists
        this.renderRecentTransactions();

        // Render Charts
        this.renderDashboardCharts(month);
    },

    renderRecentTransactions() {
        const txs = window.AppDB.getTransactions().slice(0, 5);
        const container = document.getElementById('dash-recent-list');
        const catMap = window.AppDB.getCategoryMap();

        if (txs.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm" style="padding:16px 0;">No transactions yet.</p>';
            return;
        }

        container.innerHTML = txs.map(tx => {
            const cat = catMap[tx.categoryId];
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap: 12px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${cat.color}"></div>
                        <div>
                            <div style="font-weight: 500;">${tx.item}</div>
                            <div class="text-sm text-dim">${new Date(tx.date).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div style="font-weight: 600;">-${this.formatCurrency(tx.amount)}</div>
                </div>
            `;
        }).join('');
    },

    renderDashboardCharts(month) {
        const txs = window.AppDB.getExpensesByMonth(month);
        const catMap = window.AppDB.getCategoryMap();
        
        // 1. Weekly Data prep (Group by day of current week roughly, or just last 7 days from today if available, but for simplicity, let's just group by last 7 transactions or days of month)
        // Group by accurate Date string to maintain order, but format as Weekdays for labels
        const dailyTotals = {};
        const dailyLabels = {}; // Map 'YYYY-MM-DD' -> 'Mon', 'Tue' etc

        txs.forEach(tx => {
            const dateObj = new Date(tx.date);
            const dayKey = tx.date; // Use full 'YYYY-MM-DD' for sorting
            
            dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + tx.amount;
            
            // Generate 'Monday', 'Tuesday'
            dailyLabels[dayKey] = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        });

        const sortedDays = Object.keys(dailyTotals).sort();
        const dayLabels = sortedDays.map(d => dailyLabels[d]);
        const dayData = sortedDays.map(d => dailyTotals[d]);

        if(this.charts.weekly) this.charts.weekly.destroy();
        const ctxWeek = document.getElementById('weeklyChart').getContext('2d');

        this.charts.weekly = new Chart(ctxWeek, {
            type: 'bar',
            data: {
                labels: dayLabels.length ? dayLabels : ['No Data'],
                datasets: [{
                    label: 'Daily Spent',
                    data: dayData.length ? dayData : [0],
                    backgroundColor: '#007aff',       // Apple Blue
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#86868b',
                        bodyColor: '#1d1d1f',
                        borderColor: 'rgba(0,0,0,0.05)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label; // Just the Weekday (e.g. 'Monday')
                            },
                            label: function(context) {
                                return '₹' + context.parsed.y.toLocaleString('en-IN');
                            }
                        }
                    }
                },
                scales: { 
                    y: { display: false, beginAtZero: true }, // Hide Axis
                    x: { display: false }                     // Hide Axis
                },
                layout: { padding: 0 }
            }
        });

        // 2. Category Pie Chart Prep
        const catTotals = {};
        txs.forEach(tx => {
            catTotals[tx.categoryId] = (catTotals[tx.categoryId] || 0) + tx.amount;
        });

        const catLabels = [];
        const catData = [];
        const catColors = [];

        Object.keys(catTotals).forEach(cid => {
            if(catTotals[cid] > 0) {
                const cat = catMap[cid];
                catLabels.push(cat.name);
                catData.push(catTotals[cid]);
                catColors.push(cat.color);
            }
        });

        if(this.charts.category) this.charts.category.destroy();
        const ctxCat = document.getElementById('categoryChart').getContext('2d');
        this.charts.category = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: catLabels.length ? catLabels : ['No Data'],
                datasets: [{
                    data: catData.length ? catData : [1],
                    backgroundColor: catColors.length ? catColors : ['#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12 } }
                }
            }
        });
    },

    // ==== Transactions ====
    populateFilters() {
        // Month Filter generator based on txs
        const txs = window.AppDB.getTransactions();
        const months = new Set();
        txs.forEach(t => months.add(t.date.slice(0, 7)));

        const mFilter = document.getElementById('tx-month-filter');
        mFilter.innerHTML = '<option value="">All Months</option>' + [...months].sort().reverse().map(m => `<option value="${m}">${m}</option>`).join('');
        mFilter.value = this.state.currentMonth;

        this.populateCategoryDropdown('tx-category-filter', true);
    },

    renderTransactionsTable() {
        const monthFilter = document.getElementById('tx-month-filter').value;
        const catFilter = document.getElementById('tx-category-filter').value;
        
        let txs = window.AppDB.getTransactions();
        const catMap = window.AppDB.getCategoryMap();

        // Filters
        if (monthFilter) txs = txs.filter(t => t.date.startsWith(monthFilter));
        if (catFilter) txs = txs.filter(t => t.categoryId === catFilter);

        const tbody = document.getElementById('transactions-tbody');
        const emptyState = document.getElementById('tx-empty-state');
        
        if (txs.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            tbody.innerHTML = txs.map(tx => {
                const cat = catMap[tx.categoryId];
                return `
                    <tr>
                        <td class="text-secondary">${new Date(tx.date).toLocaleDateString()}</td>
                        <td style="font-weight: 500;">${tx.item}</td>
                        <td><span class="badge" style="background-color: ${cat.color}20; color: ${cat.color}; border: 1px solid ${cat.color}40;">${cat.name}</span></td>
                        <td class="text-sm text-dim" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${tx.notes || '-'}</td>
                        <td style="font-weight: 600;">${this.formatCurrency(tx.amount)}</td>
                        <td>
                            <button class="action-btn delete" onclick="App.deleteExpense('${tx.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
                        </td>
                    </tr>
                `;
            }).join('');
            lucide.createIcons();
        }
    },

    // ==== Forms & Actions ====
    populateCategoryDropdown(elementId, allowAll = false) {
        const select = document.getElementById(elementId);
        const cats = window.AppDB.getCategories();
        
        let html = allowAll ? '<option value="">All Categories</option>' : '';
        html += cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        select.innerHTML = html;
    },

    handleSaveExpense(e) {
        e.preventDefault();
        const tx = {
            date: document.getElementById('entry-date').value,
            amount: document.getElementById('entry-amount').value,
            item: document.getElementById('entry-item').value,
            categoryId: document.getElementById('entry-category').value,
            notes: document.getElementById('entry-notes').value
        };

        window.AppDB.addTransaction(tx);
        document.getElementById('add-expense-form').reset();
        document.getElementById('entry-date').valueAsDate = new Date();
        this.showToast('Expense recorded successfully.');
        
        // Return to Dashboard immediately to see impact
        this.navigate('dashboard');
    },

    handleSaveCategory(e) {
        e.preventDefault();
        const name = document.getElementById('new-cat-name').value;
        
        const newCat = window.AppDB.addCategory(name);
        document.getElementById('modal-category').classList.remove('active');
        document.getElementById('form-category').reset();
        
        // re-populate dropdowns
        this.populateCategoryDropdown('entry-category');
        
        // Select new category
        document.getElementById('entry-category').value = newCat.id;
        
        this.showToast(`Category "${name}" added.`);
    },

    deleteExpense(id) {
        if(confirm('Delete this transaction?')) {
            window.AppDB.deleteTransaction(id);
            this.renderTransactionsTable();
            this.showToast('Transaction deleted.');
        }
    },

    // ==== Reports ====
    populateReportMonths() {
        const txs = window.AppDB.getTransactions();
        const months = new Set();
        txs.forEach(t => months.add(t.date.slice(0, 7)));

        const mFilter = document.getElementById('report-month');
        mFilter.innerHTML = '<option value="">All Time</option>' + [...months].sort().reverse().map(m => `<option value="${m}">${m}</option>`).join('');
        mFilter.value = this.state.currentMonth;
    },

    renderReports(month) {
        const spending = window.AppDB.calculateCategorySpending(month);
        let totalSpent = 0;
        
        const catLabels = [];
        const catData = [];
        const catColors = [];

        spending.forEach(p => {
            totalSpent += p.spent;
            if(p.spent > 0) {
                catLabels.push(p.name);
                catData.push(p.spent);
                catColors.push(p.color);
            }
        });

        // Summary Boxes
        document.getElementById('report-summary').innerHTML = `
            <div style="display:flex; gap: 20px; margin-bottom: 24px;">
                <div class="card glass flex-1" style="text-align:center;">
                    <div class="text-dim">Total Spent</div>
                    <h2 style="font-size:2rem;">${this.formatCurrency(totalSpent)}</h2>
                </div>
            </div>
        `;

        const ctx = document.getElementById('reportChart').getContext('2d');
        const emptyState = document.getElementById('report-empty-state');
        document.getElementById('reportChart').style.display = 'block';

        if(totalSpent === 0) {
            document.getElementById('reportChart').style.display = 'none';
            emptyState.classList.remove('hidden');
            if(this.charts.report) this.charts.report.destroy();
            return;
        }

        emptyState.classList.add('hidden');
        if(this.charts.report) this.charts.report.destroy();

        this.charts.report = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: catLabels.length ? catLabels : ['No Data'],
                datasets: [{
                    label: 'Amount Spent',
                    data: catData.length ? catData : [0],
                    backgroundColor: catColors.length ? catColors : ['#e2e8f0'],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: { 
                        enabled: true,
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        titleColor: '#86868b',
                        bodyColor: '#1d1d1f',
                        borderColor: 'rgba(0,0,0,0.05)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label; // Category Name
                            },
                            label: function(context) {
                                return '₹' + context.parsed.y.toLocaleString('en-IN');
                            }
                        }
                    }
                },
                scales: { 
                    y: { display: false, beginAtZero: true }, // Hide Axis
                    x: { display: false }                     // Hide Axis
                },
                layout: { padding: 0 }
            }
        });
    },

    populatePivotMonths() {
        const txs = window.AppDB.getTransactions();
        const months = new Set();
        txs.forEach(t => months.add(t.date.slice(0, 7)));

        const mFilter = document.getElementById('pivot-month-filter');
        mFilter.innerHTML = '<option value="">All Time</option>' + [...months].sort().reverse().map(m => `<option value="${m}">${m}</option>`).join('');
    },

    renderPivotTable(filterMonth) {
        // We will build a Pivot: Rows = Categories, Columns = Months, Value = Amount
        const allTxs = window.AppDB.getTransactions();
        if (allTxs.length === 0) {
            document.getElementById('pivot-table-head').innerHTML = '';
            document.getElementById('pivot-table-body').innerHTML = '';
            return;
        }

        const catMap = window.AppDB.getCategoryMap();

        // If filterMonth is empty string ('All Time'), we show all available months as columns.
        // Otherwise, just that specific month column
        const months = new Set();
        if (filterMonth) {
            months.add(filterMonth);
        } else {
            allTxs.forEach(tx => months.add(tx.date.slice(0, 7)));
        }
        
        // Sort months ascending for timeline effect (Jan -> Dec)
        const sortedMonths = [...months].sort();

        // Aggregate Data: { catId: { monthStr: amount, ... } }
        const pivotData = {};
        allTxs.forEach(tx => {
            const m = tx.date.slice(0, 7);
            if (!sortedMonths.includes(m)) return; // skip if filtering specific month

            if (!pivotData[tx.categoryId]) {
                pivotData[tx.categoryId] = { total: 0 };
            }
            pivotData[tx.categoryId][m] = (pivotData[tx.categoryId][m] || 0) + tx.amount;
            pivotData[tx.categoryId].total += tx.amount;
        });

        // Also calculate Column (Month) Totals
        const monthTotals = {};
        sortedMonths.forEach(m => monthTotals[m] = 0);
        let grandTotal = 0;

        Object.keys(pivotData).forEach(catId => {
            sortedMonths.forEach(m => {
                const amt = pivotData[catId][m] || 0;
                monthTotals[m] += amt;
                grandTotal += amt;
            });
        });

        // 1. Build Header
        const thead = document.getElementById('pivot-table-head');
        let ht = `<tr><th>Category</th>`;
        sortedMonths.forEach(m => {
            // Format YYYY-MM to readable short (e.g. 'Jan 2026')
            const dateObj = new Date(m + '-01T00:00:00');
            const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short', year:'numeric' });
            ht += `<th style="text-align:right;">${monthLabel}</th>`;
        });
        ht += `<th style="text-align:right;">Grand Total</th></tr>`;
        thead.innerHTML = ht;

        // 2. Build Body Rows
        const tbody = document.getElementById('pivot-table-body');
        let bt = '';

        // Sort categories by grand total spent descending
        const sortedCats = Object.keys(pivotData).sort((a,b) => pivotData[b].total - pivotData[a].total);

        sortedCats.forEach(catId => {
            const catInfo = catMap[catId];
            bt += `<tr>`;
            bt += `<td style="font-weight: 500;">
                     <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:10px;height:10px;border-radius:2px;background:${catInfo.color}"></div>
                        ${catInfo.name}
                     </div>
                   </td>`;
            
            sortedMonths.forEach(m => {
                const val = pivotData[catId][m];
                bt += `<td style="text-align:right;">${val ? this.formatCurrency(val) : '-'}</td>`;
            });
            // Row Total
            bt += `<td style="text-align:right; font-weight: 600;">${this.formatCurrency(pivotData[catId].total)}</td>`;
            bt += `</tr>`;
        });

        // 3. Build Footer Row (Grand Totals)
        bt += `<tr style="background-color: var(--bg-hover); font-weight: 700;">`;
        bt += `<td>Grand Total</td>`;
        sortedMonths.forEach(m => {
            bt += `<td style="text-align:right;">${this.formatCurrency(monthTotals[m])}</td>`;
        });
        bt += `<td style="text-align:right;">${this.formatCurrency(grandTotal)}</td>`;
        bt += `</tr>`;

        tbody.innerHTML = bt;
    },

    exportCSV() {
        const month = document.getElementById('report-month').value;
        const txs = window.AppDB.getExpensesByMonth(month);
        const catMap = window.AppDB.getCategoryMap();

        if(txs.length === 0) return this.showToast('No data to export', true);

        const rows = [
            ['Date', 'Item', 'Category', 'Amount', 'Notes']
        ];

        txs.forEach(t => {
            const catName = catMap[t.categoryId].name;
            rows.push([
                t.date,
                `"${t.item.replace(/"/g, '""')}"`,
                catName,
                t.amount.toFixed(2),
                `"${(t.notes || '').replace(/"/g, '""')}"`
            ]);
        });

        const csvContent = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `expensematrix_export_${month}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    handleImportXLSX(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                
                // Assume first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to JSON array of objects loosely based on first row headers
                const rows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rows.length <= 1) {
                    this.showToast('File is empty or invalid format.', true);
                    return;
                }

                // Try to find column mapping (Date, Item, Category, Amount) - tolerant of casing
                const headers = rows[0].map(h => String(h).toLowerCase().trim());
                
                const dateIdx = headers.findIndex(h => h.includes('date'));
                const itemIdx = headers.findIndex(h => h.includes('item') || h.includes('name') || h.includes('title') || h.includes('description'));
                const catIdx = headers.findIndex(h => h.includes('category'));
                const amtIdx = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('price'));
                const notesIdx = headers.findIndex(h => h.includes('note'));

                if (dateIdx === -1 || itemIdx === -1 || amtIdx === -1) {
                    this.showToast('Missing required columns: Date, Item, or Amount.', true);
                    return;
                }

                // Batch insert logic
                let importedRows = 0;
                
                // Pull mapping of categories locally to string match or create new ones
                const allCats = window.AppDB.getCategories();

                rows.slice(1).forEach(row => {
                    // Skip empty rows
                    if (!row[dateIdx] && !row[itemIdx]) return;

                    let amount = 0;
                    if (typeof row[amtIdx] === 'number') {
                        amount = row[amtIdx];
                    } else if (typeof row[amtIdx] === 'string') {
                        // Strip currency symbols and commas before parsing
                        const cleanStr = row[amtIdx].replace(/[^0-9.-]+/g,"");
                        amount = parseFloat(cleanStr) || 0;
                    }

                    let rawDate = row[dateIdx];
                    let parsedDateStr = new Date().toISOString().slice(0,10);
                    
                    // Basic date parsing 
                    if (typeof rawDate === 'number') {
                         // Excel serial date to JS integer
                         // Excel calculates from Dec 30, 1899 + leap year bug offset
                         const jsDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
                         // adjust for local timezone offset to avoid previous-day shifting
                         const userOffset = jsDate.getTimezoneOffset() * 60000;
                         const correctedDate = new Date(jsDate.getTime() + userOffset);
                         parsedDateStr = correctedDate.toISOString().slice(0,10);
                    } else if (rawDate) {
                         // Some string dates (MM/DD/YYYY, etc)
                         const parts = String(rawDate).split('/');
                         if (parts.length === 3) {
                              // Try assuming DD/MM/YYYY or MM/DD/YYYY context
                              // Let JS parse naturally first
                              let d = new Date(rawDate);
                              if (!isNaN(d.getTime())) {
                                  // Normalize to local string to prevent UTC shift
                                  const userOffset = d.getTimezoneOffset() * 60000;
                                  parsedDateStr = new Date(d.getTime() - userOffset).toISOString().slice(0,10);
                              }
                         } else {
                              let d = new Date(rawDate);
                              if (!isNaN(d.getTime())) {
                                  const userOffset = d.getTimezoneOffset() * 60000;
                                  parsedDateStr = new Date(d.getTime() - userOffset).toISOString().slice(0,10);
                              }
                         }
                    }

                    // Resolve category (find or default to Others or create new)
                    let catStr = String(row[catIdx] || 'Others').trim();
                    let matchedCat = allCats.find(c => c.name.toLowerCase() === catStr.toLowerCase());
                    
                    if (!matchedCat) {
                        // Create it if it doesn't exist
                        matchedCat = window.AppDB.addCategory(catStr);
                        allCats.push(matchedCat);
                    }

                    // Add to DB
                    window.AppDB.addTransaction({
                        date: parsedDateStr,
                        item: String(row[itemIdx] || 'Unknown'),
                        amount: amount,
                        categoryId: matchedCat.id,
                        notes: String(row[notesIdx] || '')
                    });

                    importedRows++;
                });

                // Clear the input so it triggers again if same file re-uploaded
                e.target.value = '';

                this.showToast(`Successfully imported ${importedRows} expenses!`);
                this.navigate('dashboard'); // Refresh views by redrawing main screen

            } catch (err) {
                console.error(err);
                this.showToast('Error reading the file. Ensure it is a valid Excel format.', true);
            }
        };

        reader.readAsArrayBuffer(file);
    },

    // ==== Utils ====
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    },

    showToast(message, isError = false) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${isError ? 'error' : ''}`;
        toast.innerHTML = `
            <i data-lucide="${isError ? 'alert-circle' : 'check-circle'}" style="color: ${isError ? 'var(--danger)' : 'var(--success)'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        lucide.createIcons();

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after 3s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }
};

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
