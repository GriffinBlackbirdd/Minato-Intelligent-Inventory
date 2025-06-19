// ===== DASHBOARD JAVASCRIPT =====

// Global variables
let revenueChart = null;
let salesChart = null;
let isDarkTheme = false;
let isSidebarCollapsed = false;

// DOM elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const loadingOverlay = document.getElementById('loadingOverlay');
const navLinks = document.querySelectorAll('.nav-link');

// ===== API CONFIGURATION =====
const API_BASE_URL = window.location.origin;
const API_ENDPOINTS = {
    stats: '/api/dashboard/stats',
    activities: '/api/dashboard/activities',
    products: '/api/dashboard/products',
    revenueData: '/api/dashboard/revenue-data',
    salesDistribution: '/api/dashboard/sales-distribution',
    inventory: '/api/dashboard/inventory',
    addActivity: '/api/dashboard/add-activity',
    billGenerated: '/api/dashboard/bill-generated'
};

// ===== API FUNCTIONS =====
async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(API_BASE_URL + endpoint, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        showErrorMessage(`Failed to fetch data from ${endpoint}`);
        throw error;
    }
}

function showErrorMessage(message) {
    const errorToast = document.createElement('div');
    errorToast.className = 'error-toast';
    errorToast.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${message}</span>
    `;
    errorToast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ef4444;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    `;

    document.body.appendChild(errorToast);

    setTimeout(() => {
        errorToast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => errorToast.remove(), 300);
    }, 5000);
}

function showSuccessMessage(message) {
    const successToast = document.createElement('div');
    successToast.className = 'success-toast';
    successToast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    successToast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    `;

    document.body.appendChild(successToast);

    setTimeout(() => {
        successToast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => successToast.remove(), 300);
    }, 3000);
}

// ===== INITIALIZATION =====
function initDashboard() {
    showLoading();

    // Initialize components with delay for smooth loading
    setTimeout(async () => {
        try {
            await Promise.all([
                updateStats(),
                populateActivityList(),
                populateProductsList(),
                populateInventoryGrid()
            ]);

            initEventListeners();
            loadSavedTheme();
            await initCharts();

            hideLoading();
            showSuccessMessage('Dashboard loaded successfully');

        } catch (error) {
            console.error('Error initializing dashboard:', error);
            hideLoading();
            showErrorMessage('Failed to load dashboard data');

            // Initialize with fallback data
            setTimeout(() => {
                initEventListeners();
                loadSavedTheme();
                initCharts();
            }, 1000);
        }
    }, 1000);
}

function showLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('show');
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.remove('show');
    }
}

// ===== EVENT LISTENERS =====
function initEventListeners() {
    // Sidebar toggle
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    if (mobileSidebarToggle) {
        mobileSidebarToggle.addEventListener('click', toggleMobileSidebar);
    }

    // Theme toggle
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.getAttribute('data-page');
            navigateToPage(page);
        });
    });

    // Period selector
    const periodSelector = document.getElementById('revenuePeriod');
    if (periodSelector) {
        periodSelector.addEventListener('change', function() {
            updateRevenueChart(this.value);
        });
    }

    // Inventory filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            filterInventory(filter);

            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !mobileSidebarToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Handle window resize
    window.addEventListener('resize', handleResize);
}

// ===== SIDEBAR FUNCTIONS =====
function toggleSidebar() {
    isSidebarCollapsed = !isSidebarCollapsed;
    sidebar.classList.toggle('collapsed', isSidebarCollapsed);

    // Save state to localStorage
    localStorage.setItem('sidebarCollapsed', isSidebarCollapsed);

    // Resize charts after animation
    setTimeout(() => {
        if (revenueChart) revenueChart.resize();
        if (salesChart) salesChart.resize();
    }, 300);
}

function toggleMobileSidebar() {
    sidebar.classList.toggle('open');
}

function handleResize() {
    // Auto-collapse sidebar on small screens
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('collapsed');
        isSidebarCollapsed = false;
    } else {
        // Restore saved state on larger screens
        const savedState = localStorage.getItem('sidebarCollapsed');
        if (savedState === 'true') {
            sidebar.classList.add('collapsed');
            isSidebarCollapsed = true;
        }
    }

    // Resize charts
    setTimeout(() => {
        if (revenueChart) revenueChart.resize();
        if (salesChart) salesChart.resize();
    }, 100);
}

// ===== THEME FUNCTIONS =====
function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    const theme = isDarkTheme ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update theme icon
    const themeIcon = themeToggle.querySelector('i');
    themeIcon.className = isDarkTheme ? 'fas fa-sun' : 'fas fa-moon';

    // Update charts for theme
    updateChartsTheme();
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        isDarkTheme = true;
        document.documentElement.setAttribute('data-theme', 'dark');
        const themeIcon = themeToggle.querySelector('i');
        if (themeIcon) {
            themeIcon.className = 'fas fa-sun';
        }
    }

    // Load sidebar state
    const sidebarState = localStorage.getItem('sidebarCollapsed');
    if (sidebarState === 'true' && window.innerWidth > 768) {
        isSidebarCollapsed = true;
        sidebar.classList.add('collapsed');
    }
}

// ===== NAVIGATION =====
function navigateToPage(page) {
    // Hide all content sections
    const contentSections = document.querySelectorAll('.dashboard-content, .page-content');
    contentSections.forEach(section => {
        section.style.display = 'none';
    });

    // Show selected content
    const targetContent = document.getElementById(page + 'Content');
    if (targetContent) {
        targetContent.style.display = 'block';
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeNavItem = document.querySelector(`[data-page="${page}"]`);
    if (activeNavItem) {
        const navItem = activeNavItem.closest('.nav-item');
        if (navItem) {
            navItem.classList.add('active');
        }
    }

    // Update breadcrumb
    const breadcrumb = document.querySelector('.breadcrumb-item');
    if (breadcrumb) {
        breadcrumb.textContent = capitalizeFirst(page);
    }

    // Close mobile sidebar
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
    }
}

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// ===== DATA POPULATION =====
async function updateStats() {
    try {
        const stats = await fetchAPI(API_ENDPOINTS.stats);

        // Update stat cards with real data
        animateCounter('totalRevenue', stats.total_revenue, '₹', true);
        animateCounter('totalSales', stats.total_sales);
        animateCounter('totalCustomers', stats.total_customers, '', true);
        animateCounter('inventoryCount', stats.inventory_count);

        // Update growth indicators
        updateGrowthIndicator('revenue', stats.revenue_growth);
        updateGrowthIndicator('sales', stats.sales_growth);
        updateGrowthIndicator('customers', stats.customer_growth);
        updateGrowthIndicator('inventory', stats.inventory_change);

    } catch (error) {
        console.error('Error updating stats:', error);
        // Fallback to default values if API fails
        animateCounter('totalRevenue', 1245890, '₹', true);
        animateCounter('totalSales', 342);
        animateCounter('totalCustomers', 1234, '', true);
        animateCounter('inventoryCount', 89);
    }
}

function updateGrowthIndicator(type, growthValue) {
    const statCard = document.querySelector(`.stat-card.${type}`);
    if (!statCard) return;

    const changeElement = statCard.querySelector('.stat-change');
    if (!changeElement) return;

    const isPositive = growthValue >= 0;
    changeElement.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;

    const icon = changeElement.querySelector('i');
    const span = changeElement.querySelector('span');

    if (icon) {
        icon.className = `fas fa-arrow-${isPositive ? 'up' : 'down'}`;
    }

    if (span) {
        span.textContent = `${isPositive ? '+' : ''}${growthValue}%`;
    }
}

function animateCounter(elementId, targetValue, prefix = '', addCommas = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const startValue = 0;
    const duration = 2000;
    const increment = targetValue / (duration / 16);
    let currentValue = startValue;

    const timer = setInterval(() => {
        currentValue += increment;
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(timer);
        }

        let displayValue = Math.floor(currentValue);
        if (addCommas) {
            displayValue = displayValue.toLocaleString('en-IN');
        }

        element.textContent = prefix + displayValue;
    }, 16);
}

async function populateActivityList() {
    try {
        const activities = await fetchAPI(API_ENDPOINTS.activities);
        const activityList = document.getElementById('activityList');

        if (!activityList) return;

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-subtitle">${activity.subtitle}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error populating activities:', error);
        populateFallbackActivities();
    }
}

function populateFallbackActivities() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const activities = [
        {
            type: 'sale',
            icon: 'fas fa-shopping-cart',
            title: 'New sale completed',
            subtitle: 'E-Rickshaw sold to customer',
            time: '2 minutes ago'
        },
        {
            type: 'customer',
            icon: 'fas fa-user-plus',
            title: 'New customer registered',
            subtitle: 'Customer documents processed',
            time: '15 minutes ago'
        },
        {
            type: 'inventory',
            icon: 'fas fa-box',
            title: 'Low stock alert',
            subtitle: 'Battery stock running low',
            time: '1 hour ago'
        }
    ];

    activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">
                <i class="${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-subtitle">${activity.subtitle}</div>
            </div>
            <div class="activity-time">${activity.time}</div>
        </div>
    `).join('');
}

async function populateProductsList() {
    try {
        const products = await fetchAPI(API_ENDPOINTS.products);
        const productsList = document.getElementById('productsList');

        if (!productsList) return;

        productsList.innerHTML = products.map(product => `
            <div class="product-item">
                <div class="product-image">
                    <i class="${product.icon}"></i>
                </div>
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-sales">${product.sales}</div>
                </div>
                <div class="product-revenue">${product.revenue}</div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error populating products:', error);
        populateFallbackProducts();
    }
}

function populateFallbackProducts() {
    const productsList = document.getElementById('productsList');
    if (!productsList) return;

    const products = [
        {
            name: 'E-Rickshaw Deluxe',
            sales: '45 units sold',
            revenue: '₹8,10,000',
            icon: 'fas fa-car'
        },
        {
            name: 'Premium Battery Pack',
            sales: '120 units sold',
            revenue: '₹3,60,000',
            icon: 'fas fa-battery-full'
        },
        {
            name: 'Chassis Assembly',
            sales: '23 units sold',
            revenue: '₹2,30,000',
            icon: 'fas fa-cogs'
        }
    ];

    productsList.innerHTML = products.map(product => `
        <div class="product-item">
            <div class="product-image">
                <i class="${product.icon}"></i>
            </div>
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-sales">${product.sales}</div>
            </div>
            <div class="product-revenue">${product.revenue}</div>
        </div>
    `).join('');
}

async function populateInventoryGrid() {
    try {
        const inventoryItems = await fetchAPI(API_ENDPOINTS.inventory);
        const inventoryGrid = document.getElementById('inventoryGrid');

        if (!inventoryGrid) return;

        inventoryGrid.innerHTML = inventoryItems.map(item => `
            <div class="inventory-item ${item.type} ${item.status === 'low' ? 'low-stock' : ''}" data-type="${item.type}" data-status="${item.status}">
                <div class="inventory-icon">
                    <i class="${item.icon}"></i>
                </div>
                <div class="inventory-name">${item.name}</div>
                <div class="inventory-stock">${item.stock}</div>
                <span class="inventory-status ${item.status}">${item.status}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error populating inventory:', error);
        populateFallbackInventory();
    }
}

function populateFallbackInventory() {
    const inventoryGrid = document.getElementById('inventoryGrid');
    if (!inventoryGrid) return;

    const inventoryItems = [
        {
            name: 'E-Rickshaw Chassis',
            stock: '45 units',
            status: 'available',
            type: 'chassis',
            icon: 'fas fa-car'
        },
        {
            name: 'Battery Pack XY-150',
            stock: '89 units',
            status: 'available',
            type: 'battery',
            icon: 'fas fa-battery-full'
        },
        {
            name: 'Battery Pack XY-100',
            stock: '23 units',
            status: 'low',
            type: 'battery',
            icon: 'fas fa-battery-half'
        },
        {
            name: 'LED Headlight Set',
            stock: '156 units',
            status: 'available',
            type: 'chassis',
            icon: 'fas fa-lightbulb'
        }
    ];

    inventoryGrid.innerHTML = inventoryItems.map(item => `
        <div class="inventory-item ${item.type} ${item.status === 'low' ? 'low-stock' : ''}" data-type="${item.type}" data-status="${item.status}">
            <div class="inventory-icon">
                <i class="${item.icon}"></i>
            </div>
            <div class="inventory-name">${item.name}</div>
            <div class="inventory-stock">${item.stock}</div>
            <span class="inventory-status ${item.status}">${item.status}</span>
        </div>
    `).join('');
}

// ===== CHARTS =====
async function initCharts() {
    await Promise.all([
        initRevenueChart(),
        initSalesChart()
    ]);
}

async function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    try {
        const revenueData = await fetchAPI(API_ENDPOINTS.revenueData);

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

        revenueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: revenueData.map(item => item.month),
                datasets: [{
                    label: 'Revenue',
                    data: revenueData.map(item => item.revenue),
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: getChartOptions()
        });

    } catch (error) {
        console.error('Error initializing revenue chart:', error);
        initFallbackRevenueChart(ctx);
    }
}

function initFallbackRevenueChart(ctx) {
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: 'Revenue',
                data: [45000, 52000, 48000, 61000, 55000, 67000, 73000, 68000, 75000, 82000, 79000, 89000],
                borderColor: '#6366f1',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: getChartOptions()
    });
}

async function initSalesChart() {
    const ctx = document.getElementById('salesChart');
    if (!ctx) return;

    try {
        const salesData = await fetchAPI(API_ENDPOINTS.salesDistribution);

        salesChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: salesData.labels,
                datasets: [{
                    data: salesData.data,
                    backgroundColor: [
                        '#6366f1',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            },
            options: getSalesChartOptions()
        });

    } catch (error) {
        console.error('Error initializing sales chart:', error);
        initFallbackSalesChart(ctx);
    }
}

function initFallbackSalesChart(ctx) {
    salesChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['E-Rickshaw', 'Batteries', 'Spare Parts', 'Accessories'],
            datasets: [{
                data: [45, 30, 15, 10],
                backgroundColor: [
                    '#6366f1',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444'
                ],
                borderWidth: 0,
                cutout: '70%'
            }]
        },
        options: getSalesChartOptions()
    });
}

function getChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#6366f1',
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        return '₹' + context.parsed.y.toLocaleString('en-IN');
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                border: {
                    display: false
                },
                ticks: {
                    color: '#6b7280',
                    font: {
                        size: 12
                    }
                }
            },
            y: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                    drawBorder: false
                },
                border: {
                    display: false
                },
                ticks: {
                    color: '#6b7280',
                    font: {
                        size: 12
                    },
                    callback: function(value) {
                        return '₹' + (value / 1000) + 'k';
                    }
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
}

function getSalesChartOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    font: {
                        size: 12
                    },
                    color: '#6b7280'
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderColor: '#6366f1',
                borderWidth: 1,
                cornerRadius: 8,
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' + context.parsed + '%';
                    }
                }
            }
        }
    };
}

async function updateRevenueChart(period) {
    if (!revenueChart) return;

    try {
        const revenueData = await fetchAPI(API_ENDPOINTS.revenueData + `?period=${period}`);

        revenueChart.data.labels = revenueData.map(item => item.month);
        revenueChart.data.datasets[0].data = revenueData.map(item => item.revenue);
        revenueChart.update('active');

    } catch (error) {
        console.error('Error updating revenue chart:', error);
        updateRevenueChartFallback(period);
    }
}

function updateRevenueChartFallback(period) {
    if (!revenueChart) return;

    let data, labels;

    switch(period) {
        case '7d':
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            data = [12000, 15000, 18000, 14000, 16000, 22000, 25000];
            break;
        case '30d':
            labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
            data = [85000, 92000, 78000, 95000];
            break;
        case '90d':
            labels = ['Month 1', 'Month 2', 'Month 3'];
            data = [250000, 280000, 320000];
            break;
        case '1y':
            labels = ['Q1', 'Q2', 'Q3', 'Q4'];
            data = [750000, 850000, 920000, 1100000];
            break;
        default:
            labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            data = [45000, 52000, 48000, 61000, 55000, 67000, 73000, 68000, 75000, 82000, 79000, 89000];
    }

    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = data;
    revenueChart.update('active');
}

function updateChartsTheme() {
    const textColor = isDarkTheme ? '#cbd5e1' : '#6b7280';
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    if (revenueChart) {
        revenueChart.options.scales.x.ticks.color = textColor;
        revenueChart.options.scales.y.ticks.color = textColor;
        revenueChart.options.scales.y.grid.color = gridColor;
        revenueChart.update();
    }

    if (salesChart) {
        salesChart.options.plugins.legend.labels.color = textColor;
        salesChart.update();
    }
}

// ===== UTILITY FUNCTIONS =====
function filterInventory(filter) {
    const inventoryItems = document.querySelectorAll('.inventory-item');

    inventoryItems.forEach(item => {
        const itemType = item.getAttribute('data-type');
        const itemStatus = item.getAttribute('data-status');

        let shouldShow = false;

        switch(filter) {
            case 'all':
                shouldShow = true;
                break;
            case 'chassis':
                shouldShow = itemType === 'chassis';
                break;
            case 'batteries':
                shouldShow = itemType === 'battery';
                break;
            case 'low-stock':
                shouldShow = itemStatus === 'low';
                break;
        }

        if (shouldShow) {
            item.style.display = 'block';
            item.style.animation = 'fadeIn 0.3s ease-out';
        } else {
            item.style.display = 'none';
        }
    });
}

function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== REAL-TIME UPDATES =====
function startRealTimeUpdates() {
    // Update stats every 30 seconds
    setInterval(async () => {
        try {
            await updateStats();
        } catch (error) {
            console.error('Error in scheduled stats update:', error);
        }
    }, 30000);

    // Update activity list every 2 minutes
    setInterval(async () => {
        try {
            await populateActivityList();
        } catch (error) {
            console.error('Error in scheduled activities update:', error);
        }
    }, 120000);

    // Update inventory every 5 minutes
    setInterval(async () => {
        try {
            await populateInventoryGrid();
        } catch (error) {
            console.error('Error in scheduled inventory update:', error);
        }
    }, 300000);
}

// ===== CONNECTION STATUS =====
let isOnline = navigator.onLine;
let connectionCheckInterval;

function checkConnection() {
    fetch(API_BASE_URL + '/api/dashboard/stats', { method: 'HEAD' })
        .then(() => {
            if (!isOnline) {
                isOnline = true;
                showConnectionStatus(true);
                // Refresh data when connection is restored
                initDashboard();
            }
        })
        .catch(() => {
            if (isOnline) {
                isOnline = false;
                showConnectionStatus(false);
            }
        });
}

function showConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus') || createConnectionStatus();

    statusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
    statusEl.innerHTML = `
        <i class="fas fa-${connected ? 'wifi' : 'wifi-slash'}"></i>
        <span>${connected ? 'Connected' : 'Disconnected'}</span>
    `;

    if (connected) {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    } else {
        statusEl.style.display = 'flex';
    }
}

function createConnectionStatus() {
    const statusEl = document.createElement('div');
    statusEl.id = 'connectionStatus';
    statusEl.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 10001;
        display: none;
        align-items: center;
        gap: 6px;
        transition: all 0.3s ease;
    `;

    const style = document.createElement('style');
    style.textContent = `
        .connection-status.connected {
            background: #10b981;
            color: white;
        }
        .connection-status.disconnected {
            background: #ef4444;
            color: white;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(statusEl);

    return statusEl;
}

// ===== SEARCH FUNCTIONALITY =====
function initGlobalSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', debounce(function(e) {
        const query = e.target.value.toLowerCase().trim();

        if (query.length > 2) {
            performSearch(query);
        } else {
            hideSearchResults();
        }
    }, 300));

    // Handle search on enter
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.toLowerCase().trim();
            if (query.length > 2) {
                performAdvancedSearch(query);
            }
        }
    });
}

async function performSearch(query) {
    try {
        // This would integrate with your backend search
        const searchResults = await fetchAPI(`/api/search?q=${encodeURIComponent(query)}`);
        displaySearchResults(searchResults);
    } catch (error) {
        console.error('Search error:', error);
        // Fallback to local search
        performLocalSearch(query);
    }
}

function performLocalSearch(query) {
    const searchResults = [
        { type: 'customer', name: 'Customer Search', details: `Search for "${query}" in customers` },
        { type: 'product', name: 'Product Search', details: `Search for "${query}" in products` },
        { type: 'invoice', name: 'Invoice Search', details: `Search for "${query}" in invoices` }
    ];

    displaySearchResults(searchResults);
}

function displaySearchResults(results) {
    let dropdown = document.getElementById('searchDropdown');

    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = 'searchDropdown';
        dropdown.className = 'search-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 4px;
        `;

        const searchBox = document.querySelector('.search-box');
        if (searchBox) {
            searchBox.style.position = 'relative';
            searchBox.appendChild(dropdown);
        }
    }

    if (results.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280;">No results found</div>';
    } else {
        dropdown.innerHTML = results.map(result => `
            <div class="search-result-item" style="padding: 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; transition: background 0.2s;"
                 onmouseover="this.style.background='#f9fafb'"
                 onmouseout="this.style.background='white'"
                 onclick="selectSearchResult('${result.type}', '${result.name}')">
                <div style="font-weight: 500; color: #1f2937;">${result.name}</div>
                <div style="font-size: 12px; color: #6b7280;">${result.details}</div>
            </div>
        `).join('');
    }

    dropdown.style.display = 'block';
}

function hideSearchResults() {
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

function selectSearchResult(type, name) {
    console.log('Selected search result:', type, name);
    hideSearchResults();

    // Navigate based on result type
    switch(type) {
        case 'customer':
            navigateToPage('customers');
            break;
        case 'product':
            navigateToPage('inventory');
            break;
        case 'invoice':
            navigateToPage('billing');
            break;
    }

    // Clear search input
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.value = '';
    }
}

async function performAdvancedSearch(query) {
    try {
        const results = await fetchAPI(`/api/advanced-search?q=${encodeURIComponent(query)}`);
        showAdvancedSearchResults(results);
    } catch (error) {
        console.error('Advanced search error:', error);
        showErrorMessage('Advanced search is not available');
    }
}

// ===== KEYBOARD SHORTCUTS =====
function initKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('globalSearch');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        // Ctrl/Cmd + B for sidebar toggle
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }

        // Escape to close mobile sidebar and search results
        if (e.key === 'Escape') {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
            hideSearchResults();
        }

        // Number keys for quick navigation
        if (e.ctrlKey || e.metaKey) {
            const pages = ['dashboard', 'billing', 'inventory', 'customers', 'reports', 'settings'];
            const num = parseInt(e.key);
            if (num >= 1 && num <= pages.length) {
                e.preventDefault();
                navigateToPage(pages[num - 1]);
            }
        }
    });
}

// ===== NOTIFICATIONS =====
function showNotification() {
    const notificationBadge = document.querySelector('.notification-badge');
    if (notificationBadge) {
        let currentCount = parseInt(notificationBadge.textContent) || 0;
        currentCount++;
        notificationBadge.textContent = currentCount;

        // Add pulse animation
        notificationBadge.style.animation = 'pulse 0.5s ease-in-out';
        setTimeout(() => {
            notificationBadge.style.animation = '';
        }, 500);
    }
}

// ===== ANALYTICS =====
function trackUserInteraction(action, details = {}) {
    const event = {
        action,
        details,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    // Send to analytics service
    console.log('User interaction:', event);

    // Store locally for offline analysis
    try {
        const analytics = JSON.parse(localStorage.getItem('analytics') || '[]');
        analytics.push(event);
        // Keep only last 100 events
        if (analytics.length > 100) {
            analytics.splice(0, analytics.length - 100);
        }
        localStorage.setItem('analytics', JSON.stringify(analytics));
    } catch (error) {
        console.error('Analytics storage error:', error);
    }
}

// ===== EXPORT FUNCTIONS =====
async function exportDashboardData() {
    try {
        const data = {
            stats: await fetchAPI(API_ENDPOINTS.stats),
            activities: await fetchAPI(API_ENDPOINTS.activities),
            products: await fetchAPI(API_ENDPOINTS.products),
            inventory: await fetchAPI(API_ENDPOINTS.inventory),
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dashboard-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showSuccessMessage('Dashboard data exported successfully');

    } catch (error) {
        console.error('Export error:', error);
        showErrorMessage('Failed to export dashboard data');
    }
}

// ===== PERFORMANCE MONITORING =====
function initPerformanceMonitoring() {
    // Monitor page load time
    window.addEventListener('load', function() {
        const loadTime = performance.now();
        console.log(`Dashboard loaded in ${loadTime.toFixed(2)}ms`);

        trackUserInteraction('page_load', {
            loadTime: loadTime.toFixed(2),
            connection: navigator.connection?.effectiveType || 'unknown'
        });
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initDashboard();

    // Initialize additional features after delay
    setTimeout(() => {
        initGlobalSearch();
        initKeyboardShortcuts();
        initPerformanceMonitoring();
        startRealTimeUpdates();

        // Add click tracking to navigation
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                trackUserInteraction('navigation_click', {
                    page: this.getAttribute('data-page')
                });
            });
        });

        console.log('Dashboard fully initialized! 🚀');
        console.log('Available shortcuts:');
        console.log('- Ctrl/Cmd + K: Focus search');
        console.log('- Ctrl/Cmd + B: Toggle sidebar');
        console.log('- Ctrl/Cmd + 1-6: Quick navigation');
        console.log('- Escape: Close dialogs/sidebar');

    }, 2000);
});

// ===== CONNECTION MONITORING =====
window.addEventListener('online', () => checkConnection());
window.addEventListener('offline', () => checkConnection());

// Start periodic connection checks
connectionCheckInterval = setInterval(checkConnection, 10000);

// ===== ERROR HANDLING =====
window.addEventListener('error', function(e) {
    console.error('Dashboard error:', e.error);

    trackUserInteraction('error', {
        message: e.error?.message || 'Unknown error',
        filename: e.filename,
        lineno: e.lineno
    });

    showErrorMessage('Something went wrong. Please try refreshing the page.');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);

    trackUserInteraction('unhandled_rejection', {
        reason: e.reason?.message || 'Unknown rejection'
    });

    e.preventDefault();
    showErrorMessage('A network error occurred. Please check your connection.');
});

// ===== CLEANUP =====
window.addEventListener('beforeunload', function() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
    }

    trackUserInteraction('page_unload', {
        timeOnPage: performance.now()
    });
});

// ===== INITIAL CONNECTION CHECK =====
setTimeout(checkConnection, 1000);

console.log('Dashboard JavaScript loaded successfully');