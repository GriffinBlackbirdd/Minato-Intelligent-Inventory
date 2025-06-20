// Enhanced Dashboard JavaScript - Complete Implementation
// Minato Enterprises Dashboard System

// DOM elements
const extractionCard = document.getElementById('extractionCard');
const billingCard = document.getElementById('billingCard');
const resultsCard = document.getElementById('resultsCard');
const errorCard = document.getElementById('errorCard');

// Fetching elements
const fetchingContainer = document.getElementById('fetchingContainer');
const extractionResults = document.getElementById('extractionResults');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Customer info elements
const customerTitle = document.getElementById('customerTitle');
const customerSubtitle = document.getElementById('customerSubtitle');
const displayName = document.getElementById('displayName');
const displayAadhaar = document.getElementById('displayAadhaar');
const displayAddress = document.getElementById('displayAddress');
const displayMobile = document.getElementById('displayMobile');
const displayFolder = document.getElementById('displayFolder');

// Edit elements
const editToggleBtn = document.getElementById('editToggleBtn');
const editName = document.getElementById('editName');
const editAadhaar = document.getElementById('editAadhaar');
const editAddress = document.getElementById('editAddress');
const editMobile = document.getElementById('editMobile');
const editFolder = document.getElementById('editFolder');
const editActions = document.getElementById('editActions');
const defaultActions = document.getElementById('defaultActions');
const saveChangesBtn = document.getElementById('saveChangesBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// Navigation buttons
const proceedToBillBtn = document.getElementById('proceedToBillBtn');
const backToSearchBtn = document.getElementById('backToSearchBtn');
const resetBtn = document.getElementById('resetBtn');
const errorResetBtn = document.getElementById('errorResetBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const errorMessage = document.getElementById('errorMessage');

// Billing elements
const billCustomerName = document.getElementById('billCustomerName');
const billCustomerAadhaar = document.getElementById('billCustomerAadhaar');
const billCustomerMobile = document.getElementById('billCustomerMobile');
const billCustomerAddress = document.getElementById('billCustomerAddress');

// State variables
let extractedData = null;
let isEditMode = false;
let currentPage = 'dashboard';

// Professional Alert System
class ProfessionalAlerts {
    constructor() {
        this.toastContainer = null;
        this.createToastContainer();
        this.addStyles();
    }

    createToastContainer() {
        if (!this.toastContainer) {
            this.toastContainer = document.createElement('div');
            this.toastContainer.className = 'toast-container';
            document.body.appendChild(this.toastContainer);
        }
    }

    addStyles() {
        const alertStyles = document.createElement('style');
        alertStyles.textContent = `
            @keyframes slideOutToast {
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }

            @keyframes slideOutAlert {
                to {
                    opacity: 0;
                    transform: translateY(-8px);
                    height: 0;
                    padding: 0;
                    margin: 0;
                }
            }
        `;
        document.head.appendChild(alertStyles);
    }

    showSuccess(message, title = 'Success') {
        this.showToast('success', title, message, 'fas fa-check-circle');
    }

    showError(message, title = 'Error') {
        this.showToast('error', title, message, 'fas fa-exclamation-circle');
    }

    showWarning(message, title = 'Warning') {
        this.showToast('warning', title, message, 'fas fa-exclamation-triangle');
    }

    showInfo(message, title = 'Information') {
        this.showToast('info', title, message, 'fas fa-info-circle');
    }

    showToast(type, title, message, icon, duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        toast.innerHTML = `
            <i class="${icon} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            this.removeToast(toast);
        }, duration);

        toast.addEventListener('click', () => {
            this.removeToast(toast);
        });

        return toast;
    }

    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOutToast 0.3s ease-in forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }

    showAlert(containerId, type, message, closable = true) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return;
        }

        const existingAlerts = container.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        const alert = document.createElement('div');
        alert.className = `alert ${type}`;

        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        alert.innerHTML = `
            <i class="${iconMap[type]} alert-icon"></i>
            <span>${message}</span>
            ${closable ? '<button class="alert-close"><i class="fas fa-times"></i></button>' : ''}
        `;

        if (closable) {
            const closeBtn = alert.querySelector('.alert-close');
            closeBtn.addEventListener('click', () => {
                alert.style.animation = 'slideOutAlert 0.3s ease-in forwards';
                setTimeout(() => alert.remove(), 300);
            });
        }

        container.insertBefore(alert, container.firstChild);
        return alert;
    }

    clearAllToasts() {
        const toasts = this.toastContainer.querySelectorAll('.toast');
        toasts.forEach(toast => this.removeToast(toast));
    }

    // Dashboard specific notifications
    showDashboardRefresh() {
        this.showSuccess('Dashboard data updated successfully!', 'Refreshed');
    }

    showBillingSuccess(billNumber) {
        this.showSuccess(`Bill ${billNumber} generated successfully!`, 'Bill Created');
    }

    showBillingError(error) {
        this.showError(`Failed to generate bill: ${error}`, 'Billing Error');
    }

    showLoginSuccess(userName) {
        this.showSuccess(`Welcome back, ${userName}!`, 'Login Successful');
    }

    showConnectionError() {
        this.showError('Unable to connect to server. Please check your connection.', 'Connection Error');
    }
}

// Create global alert instance
window.alerts = new ProfessionalAlerts();

// Dashboard Navigation System
class DashboardNavigation {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        console.log('Dashboard navigation system initialized');
        this.setupNavigation();
        this.setupKeyboardShortcuts();
        this.setupBrowserNavigation();
        this.setupLogout();
        this.clearStuckOverlays();
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                const page = link.getAttribute('data-page');
                const href = link.getAttribute('href');

                console.log(`Navigation clicked: ${page}, href: ${href}`);

                switch(page) {
                    case 'dashboard':
                        this.setActiveNavItem(link);
                        this.showDashboardContent();
                        this.updateBreadcrumb('Dashboard');
                        break;

                    case 'billing':
                        this.navigateToBilling(link);
                        break;

                    case 'inventory':
                        this.setActiveNavItem(link);
                        this.showPageContent('inventory');
                        this.updateBreadcrumb('Inventory Management');
                        break;

                    case 'customers':
                        this.setActiveNavItem(link);
                        this.showPageContent('customers');
                        this.updateBreadcrumb('Customer Management');
                        break;

                    case 'reports':
                        this.setActiveNavItem(link);
                        this.showPageContent('reports');
                        this.updateBreadcrumb('Reports & Analytics');
                        break;

                    case 'settings':
                        this.setActiveNavItem(link);
                        this.showPageContent('settings');
                        this.updateBreadcrumb('System Settings');
                        break;

                    default:
                        console.warn(`Unknown page: ${page}`);
                }

                this.trackNavigationAction(page);
            });
        });
    }

    navigateToBilling(link) {
        console.log('Navigating to billing system...');

        // Clear any existing overlays
        this.clearStuckOverlays();

        // Show loading state on the link itself
        const originalHTML = link.innerHTML;
        link.style.opacity = '0.7';
        link.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading...</span>';

        // Navigate directly without overlay
        setTimeout(() => {
            window.location.href = '/billing';
        }, 150);

        // Restore original state if navigation fails
        setTimeout(() => {
            link.innerHTML = originalHTML;
            link.style.opacity = '1';
        }, 3000);
    }

    setActiveNavItem(clickedLink) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const parentNavItem = clickedLink.closest('.nav-item');
        if (parentNavItem) {
            parentNavItem.classList.add('active');
        }
    }

    showDashboardContent() {
        this.hideAllPageContent();

        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'block';
        }

        this.currentPage = 'dashboard';
    }

    showPageContent(pageType) {
        this.hideAllPageContent();

        const pageContent = document.getElementById(`${pageType}Content`);
        if (pageContent) {
            pageContent.style.display = 'block';
        }

        this.currentPage = pageType;
    }

    hideAllPageContent() {
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            dashboardContent.style.display = 'none';
        }

        const pageContents = document.querySelectorAll('.page-content');
        pageContents.forEach(content => {
            content.style.display = 'none';
        });
    }

    updateBreadcrumb(title) {
        const breadcrumbElement = document.querySelector('.breadcrumb .breadcrumb-item');
        if (breadcrumbElement) {
            breadcrumbElement.textContent = title;
        }
    }

    clearStuckOverlays() {
        // Remove by ID
        const overlayById = document.getElementById('navigationLoadingOverlay');
        if (overlayById) {
            console.log('Removing loading overlay by ID');
            overlayById.remove();
        }

        // Remove any stuck overlays
        const allOverlays = document.querySelectorAll('[id*="loading"], [class*="loading-overlay"], [style*="z-index: 9999"]');
        allOverlays.forEach(overlay => {
            if (overlay.style.position === 'fixed' && overlay.style.zIndex >= 9999) {
                console.log('Removing persistent overlay:', overlay);
                overlay.remove();
            }
        });

        // Remove elements with "Loading" text
        const loadingElements = document.querySelectorAll('*');
        loadingElements.forEach(el => {
            if (el.textContent && (el.textContent.includes('Loading billing') ||
                el.textContent.includes('Loading Billing'))) {
                const parent = el.closest('[style*="position: fixed"]');
                if (parent) {
                    console.log('Removing billing loading element:', parent);
                    parent.remove();
                }
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Alt + B for Billing
            if (e.altKey && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                const billingLink = document.querySelector('[data-page="billing"]');
                if (billingLink) billingLink.click();
            }

            // Alt + D for Dashboard
            if (e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                const dashboardLink = document.querySelector('[data-page="dashboard"]');
                if (dashboardLink) dashboardLink.click();
            }

            // Alt + I for Inventory
            if (e.altKey && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                const inventoryLink = document.querySelector('[data-page="inventory"]');
                if (inventoryLink) inventoryLink.click();
            }

            // Ctrl/Cmd + B for Billing (additional shortcut)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                const billingLink = document.querySelector('[data-page="billing"]');
                if (billingLink) billingLink.click();
            }

            // Escape to return to dashboard
            if (e.key === 'Escape' && this.currentPage !== 'dashboard') {
                const dashboardLink = document.querySelector('[data-page="dashboard"]');
                if (dashboardLink) dashboardLink.click();
            }
        });
    }

    setupBrowserNavigation() {
        // Handle browser back/forward buttons and page visibility
        window.addEventListener('popstate', () => {
            console.log('Browser navigation detected');
            this.clearStuckOverlays();

            const currentPath = window.location.pathname;

            if (currentPath === '/dashboard') {
                this.showDashboardContent();
            } else if (currentPath === '/billing') {
                window.location.href = '/billing';
            }
        });

        // Clear loading overlay when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('Page became visible - clearing any loading overlays');
                this.clearStuckOverlays();
            }
        });

        // Clear loading overlay when page loads/reloads
        window.addEventListener('load', () => {
            console.log('Page loaded - clearing any loading overlays');
            this.clearStuckOverlays();
        });
    }

    setupLogout() {
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
    }

    handleLogout() {
        console.log('Logout initiated from dashboard');

        alerts.showInfo('Signing out...', 'Logout');

        fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            }
        }).then(response => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = '/login';
        }).catch(error => {
            console.error('Logout API error:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            window.location.href = '/login';
        });
    }

    trackNavigationAction(page) {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

            fetch('/api/track-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    action: 'dashboard_navigation',
                    details: {
                        page: page,
                        timestamp: new Date().toISOString(),
                        user_agent: navigator.userAgent
                    }
                })
            }).catch(error => {
                console.debug('Navigation tracking failed:', error);
            });
        } catch (error) {
            console.debug('Error tracking navigation:', error);
        }
    }
}

// Dashboard Data Management
class DashboardData {
    constructor() {
        this.charts = {};
        this.dataCache = {};
        this.refreshInterval = null;
    }

    async loadDashboardStats() {
        try {
            const response = await fetch('/api/dashboard/stats', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch stats');

            const stats = await response.json();
            this.updateStatCards(stats);

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            alerts.showError('Failed to load dashboard statistics', 'Data Error');
        }
    }

    updateStatCards(stats) {
        const formatCurrency = (amount) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(amount);
        };

        const formatNumber = (num) => {
            return new Intl.NumberFormat('en-IN').format(num);
        };

        // Update revenue
        const revenueElement = document.getElementById('totalRevenue');
        if (revenueElement) {
            revenueElement.textContent = formatCurrency(stats.total_revenue || 0);
        }

        // Update sales
        const salesElement = document.getElementById('totalSales');
        if (salesElement) {
            salesElement.textContent = formatNumber(stats.total_sales || 0);
        }

        // Update customers
        const customersElement = document.getElementById('totalCustomers');
        if (customersElement) {
            customersElement.textContent = formatNumber(stats.total_customers || 0);
        }

        // Update inventory
        const inventoryElement = document.getElementById('inventoryCount');
        if (inventoryElement) {
            inventoryElement.textContent = formatNumber(stats.inventory_count || 0);
        }

        // Update growth indicators
        this.updateGrowthIndicators({
            revenue: stats.revenue_growth || 0,
            sales: stats.sales_growth || 0,
            customers: stats.customer_growth || 0,
            inventory: stats.profit_growth || 0
        });
    }

    updateGrowthIndicators(growth) {
        const indicators = [
            { selector: '.stat-card.revenue .stat-change', value: growth.revenue, suffix: '%' },
            { selector: '.stat-card.sales .stat-change', value: growth.sales, suffix: '%' },
            { selector: '.stat-card.customers .stat-change', value: growth.customers, suffix: '%' },
            { selector: '.stat-card.inventory .stat-change', value: growth.inventory, suffix: '%' }
        ];

        indicators.forEach(({ selector, value, suffix }) => {
            const element = document.querySelector(selector);
            if (element) {
                const isPositive = value >= 0;
                const icon = isPositive ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
                const className = isPositive ? 'positive' : 'negative';

                element.className = `stat-change ${className}`;
                element.innerHTML = `
                    <i class="${icon}"></i>
                    <span>${Math.abs(value).toFixed(1)}${suffix}</span>
                `;
            }
        });
    }

    async loadRevenueChart(period = '30d') {
        try {
            const response = await fetch(`/api/dashboard/revenue-data?period=${period}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch revenue data');

            const data = await response.json();
            this.renderRevenueChart(data);

        } catch (error) {
            console.error('Error loading revenue chart:', error);
            alerts.showError('Failed to load revenue chart', 'Chart Error');
        }
    }

    renderRevenueChart(data) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.revenue) {
            this.charts.revenue.destroy();
        }

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(item => item.month),
                datasets: [{
                    label: 'Revenue',
                    data: data.map(item => item.revenue),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }, {
                    label: 'Profit',
                    data: data.map(item => item.profit),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            font: {
                                size: 12,
                                weight: '500'
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#6366f1',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const value = new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR'
                                }).format(context.parsed.y);
                                return `${context.dataset.label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            color: '#6b7280'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            font: {
                                size: 11,
                                weight: '500'
                            },
                            color: '#6b7280',
                            callback: function(value) {
                                return new Intl.NumberFormat('en-IN', {
                                    style: 'currency',
                                    currency: 'INR',
                                    notation: 'compact'
                                }).format(value);
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverRadius: 8
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    renderSalesChart() {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.sales) {
            this.charts.sales.destroy();
        }

        const salesData = [
            { category: 'E-Rickshaw', value: 45, color: '#6366f1' },
            { category: 'Batteries', value: 30, color: '#10b981' },
            { category: 'Spare Parts', value: 15, color: '#f59e0b' },
            { category: 'Services', value: 10, color: '#ef4444' }
        ];

        this.charts.sales = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: salesData.map(item => item.category),
                datasets: [{
                    data: salesData.map(item => item.value),
                    backgroundColor: salesData.map(item => item.color),
                    borderWidth: 0,
                    cutout: '60%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 11,
                                weight: '500'
                            }
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
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                }
            }
        });
    }

    async loadRecentActivities() {
        try {
            const response = await fetch('/api/dashboard/activities', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch activities');

            const activities = await response.json();
            this.renderRecentActivities(activities);

        } catch (error) {
            console.error('Error loading activities:', error);
            alerts.showError('Failed to load recent activities', 'Data Error');
        }
    }

    renderRecentActivities(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        activityList.innerHTML = '';

        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';

            activityItem.innerHTML = `
                <div class="activity-icon ${activity.type}">
                    <i class="${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-subtitle">${activity.subtitle}</div>
                </div>
                <div class="activity-time">${activity.time}</div>
            `;

            activityList.appendChild(activityItem);
        });
    }

    startAutoRefresh() {
        // Refresh data every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadDashboardStats();
            this.loadRecentActivities();
            console.log('Dashboard data auto-refreshed');
        }, 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    async refreshAll() {
        alerts.showInfo('Refreshing dashboard data...', 'Loading');

        try {
            await Promise.all([
                this.loadDashboardStats(),
                this.loadRevenueChart(),
                this.loadRecentActivities()
            ]);

            alerts.showDashboardRefresh();
        } catch (error) {
            console.error('Error refreshing dashboard:', error);
            alerts.showError('Failed to refresh dashboard data', 'Refresh Error');
        }
    }
}

// Theme Management
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem('theme') || 'light';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupThemeToggle();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        this.currentTheme = theme;

        // Update theme button icon
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            const icon = themeBtn.querySelector('i');
            if (icon) {
                icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    setupThemeToggle() {
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
                this.applyTheme(newTheme);

                alerts.showInfo(`Switched to ${newTheme} theme`, 'Theme Changed');
            });
        }
    }
}

// Initialize Dashboard Components
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialization starting...');

    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // Initialize components
    const navigation = new DashboardNavigation();
    const dashboardData = new DashboardData();
    const themeManager = new ThemeManager();

    // Load initial data
    dashboardData.loadDashboardStats();
    dashboardData.loadRevenueChart();
    dashboardData.renderSalesChart();
    dashboardData.loadRecentActivities();

    // Start auto-refresh
    dashboardData.startAutoRefresh();

    // Setup period selector
// Setup period selector
   const periodSelector = document.getElementById('revenuePeriod');
   if (periodSelector) {
       periodSelector.addEventListener('change', (e) => {
           dashboardData.loadRevenueChart(e.target.value);
       });
   }

   // Setup refresh button if exists
   const refreshBtn = document.querySelector('[data-action="refresh"]');
   if (refreshBtn) {
       refreshBtn.addEventListener('click', () => {
           dashboardData.refreshAll();
       });
   }

   // Setup sidebar toggle
   const sidebarToggle = document.getElementById('sidebarToggle');
   const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
   const sidebar = document.getElementById('sidebar');

   if (sidebarToggle && sidebar) {
       sidebarToggle.addEventListener('click', () => {
           sidebar.classList.toggle('collapsed');
           localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
       });
   }

   if (mobileSidebarToggle && sidebar) {
       mobileSidebarToggle.addEventListener('click', () => {
           sidebar.classList.toggle('open');
       });
   }

   // Restore sidebar state
   const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
   if (sidebarCollapsed && sidebar) {
       sidebar.classList.add('collapsed');
   }

   // Setup search functionality
   const globalSearch = document.getElementById('globalSearch');
   if (globalSearch) {
       globalSearch.addEventListener('input', debounce((e) => {
           const query = e.target.value.trim();
           if (query.length > 2) {
               performGlobalSearch(query);
           }
       }, 300));
   }

   // Setup notification button
   const notificationBtn = document.querySelector('.notification-btn');
   if (notificationBtn) {
       notificationBtn.addEventListener('click', () => {
           showNotifications();
       });
   }

   // Setup inventory filters
   const inventoryFilters = document.querySelectorAll('.filter-btn');
   inventoryFilters.forEach(btn => {
       btn.addEventListener('click', () => {
           inventoryFilters.forEach(b => b.classList.remove('active'));
           btn.classList.add('active');
           filterInventory(btn.dataset.filter);
       });
   });

   // Show welcome message for logged-in user
   const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
   if (currentUser.full_name) {
       setTimeout(() => {
           alerts.showInfo(`Welcome to your dashboard, ${currentUser.full_name}!`, 'Dashboard Ready');
       }, 1000);
   }

   console.log('✅ Dashboard initialization complete');
   console.log('📊 Features enabled:');
   console.log('   - Real-time data updates');
   console.log('   - Professional alerts');
   console.log('   - Clean navigation');
   console.log('   - Theme switching');
   console.log('   - Auto-refresh every 5 minutes');
   console.log('⌨️ Keyboard shortcuts:');
   console.log('   Alt+B / Ctrl+B: Billing System');
   console.log('   Alt+D: Dashboard');
   console.log('   Alt+I: Inventory');
   console.log('   Escape: Return to Dashboard');
});

// Utility Functions
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

async function performGlobalSearch(query) {
   try {
       alerts.showInfo(`Searching for "${query}"...`, 'Search');

       const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
           headers: {
               'Authorization': `Bearer ${localStorage.getItem('authToken')}`
           }
       });

       if (!response.ok) throw new Error('Search failed');

       const results = await response.json();
       displaySearchResults(results);

   } catch (error) {
       console.error('Search error:', error);
       alerts.showError('Search failed. Please try again.', 'Search Error');
   }
}

function displaySearchResults(results) {
   // Implementation for displaying search results
   console.log('Search results:', results);
   alerts.showSuccess(`Found ${results.length} results`, 'Search Complete');
}

function showNotifications() {
   // Implementation for showing notifications
   const notifications = [
       { type: 'info', message: 'New customer registered', time: '2 minutes ago' },
       { type: 'success', message: 'Bill #2025-001 generated', time: '5 minutes ago' },
       { type: 'warning', message: 'Low battery stock alert', time: '10 minutes ago' }
   ];

   notifications.forEach((notif, index) => {
       setTimeout(() => {
           alerts.showToast(notif.type, 'Notification', notif.message, getNotificationIcon(notif.type));
       }, index * 200);
   });
}

function getNotificationIcon(type) {
   const icons = {
       success: 'fas fa-check-circle',
       error: 'fas fa-exclamation-circle',
       warning: 'fas fa-exclamation-triangle',
       info: 'fas fa-info-circle'
   };
   return icons[type] || 'fas fa-bell';
}

function filterInventory(filter) {
   const inventoryItems = document.querySelectorAll('.inventory-item');

   inventoryItems.forEach(item => {
       if (filter === 'all' || item.classList.contains(filter)) {
           item.style.display = 'flex';
       } else {
           item.style.display = 'none';
       }
   });

   alerts.showInfo(`Showing ${filter} inventory items`, 'Filter Applied');
}

// Enhanced Error Handling
window.addEventListener('error', (e) => {
   console.error('Global error:', e.error);
   alerts.showError('An unexpected error occurred', 'System Error');
});

window.addEventListener('unhandledrejection', (e) => {
   console.error('Unhandled promise rejection:', e.reason);
   alerts.showError('A network or data error occurred', 'Connection Error');
});

// Connection Status Monitoring
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
   if (!isOnline) {
       isOnline = true;
       alerts.showSuccess('Connection restored', 'Back Online');

       // Refresh data when coming back online
       const dashboardData = window.dashboardData;
       if (dashboardData) {
           dashboardData.refreshAll();
       }
   }
});

window.addEventListener('offline', () => {
   isOnline = false;
   alerts.showError('You are currently offline', 'Connection Lost');
});

// Export global functions for backward compatibility
window.showSuccessToast = (message, title) => window.alerts.showSuccess(message, title);
window.showErrorToast = (message, title) => window.alerts.showError(message, title);
window.showWarningToast = (message, title) => window.alerts.showWarning(message, title);
window.showInfoToast = (message, title) => window.alerts.showInfo(message, title);

// Dashboard-specific functions
window.showDashboardRefresh = () => window.alerts.showDashboardRefresh();
window.showBillingSuccess = (billNumber) => window.alerts.showBillingSuccess(billNumber);
window.showBillingError = (error) => window.alerts.showBillingError(error);
window.showLoginSuccess = (userName) => window.alerts.showLoginSuccess(userName);
window.showSystemUpdate = () => window.alerts.showInfo('System has been updated', 'System Update');

// Navigation functions
window.navigateToBillingSystem = function() {
   console.log('🔄 External billing navigation called');
   const billingLink = document.querySelector('[data-page="billing"]');
   if (billingLink) {
       billingLink.click();
   } else {
       window.location.href = '/billing';
   }
};

window.clearNavigationLoading = function() {
   const overlay = document.getElementById('navigationLoadingOverlay');
   if (overlay) {
       overlay.remove();
   }
};

// Cleanup functions
window.addEventListener('beforeunload', () => {
   // Clear any intervals
   const dashboardData = window.dashboardData;
   if (dashboardData) {
       dashboardData.stopAutoRefresh();
   }

   // Clear any stuck overlays
   window.clearNavigationLoading();
});

// Page visibility handling
document.addEventListener('visibilitychange', () => {
   if (!document.hidden) {
       // Page became visible - clear any loading overlays
       setTimeout(() => {
           window.clearNavigationLoading();
       }, 100);
   }
});

// Failsafe overlay cleanup
setInterval(() => {
   const overlay = document.getElementById('navigationLoadingOverlay');
   if (overlay && window.location.pathname === '/dashboard') {
       console.log('Failsafe: Removing stuck overlay on dashboard');
       overlay.remove();
   }
}, 2000);

// Enhanced hover effects for navigation items
document.addEventListener('DOMContentLoaded', () => {
   const navItems = document.querySelectorAll('.nav-item');
   navItems.forEach(item => {
       const link = item.querySelector('.nav-link');

       item.addEventListener('mouseenter', function() {
           if (!this.classList.contains('active')) {
               link.style.transform = 'translateX(4px)';
           }
       });

       item.addEventListener('mouseleave', function() {
           if (!this.classList.contains('active')) {
               link.style.transform = 'translateX(0)';
           }
       });
   });
});

// Enhanced loading state management
class LoadingStateManager {
   constructor() {
       this.activeLoaders = new Set();
   }

   show(id, message = 'Loading...') {
       this.activeLoaders.add(id);

       let loader = document.getElementById(`loader-${id}`);
       if (!loader) {
           loader = document.createElement('div');
           loader.id = `loader-${id}`;
           loader.className = 'loading-state';
           loader.innerHTML = `
               <div class="loading-spinner">
                   <div class="spinner"></div>
               </div>
               <div class="loading-text">${message}</div>
           `;
           loader.style.cssText = `
               position: fixed;
               top: 50%;
               left: 50%;
               transform: translate(-50%, -50%);
               background: rgba(255, 255, 255, 0.95);
               padding: 2rem;
               border-radius: 12px;
               box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
               z-index: 9998;
               text-align: center;
               backdrop-filter: blur(4px);
           `;
           document.body.appendChild(loader);
       }

       // Auto-remove after 10 seconds
       setTimeout(() => {
           this.hide(id);
       }, 10000);
   }

   hide(id) {
       this.activeLoaders.delete(id);
       const loader = document.getElementById(`loader-${id}`);
       if (loader) {
           loader.style.opacity = '0';
           setTimeout(() => {
               if (loader.parentNode) {
                   loader.remove();
               }
           }, 300);
       }
   }

   hideAll() {
       this.activeLoaders.forEach(id => {
           this.hide(id);
       });
       this.activeLoaders.clear();
   }
}

window.loadingManager = new LoadingStateManager();

// Animation utilities
function animateValue(element, start, end, duration = 1000) {
   if (!element) return;

   const startTimestamp = performance.now();
   const step = (timestamp) => {
       const elapsed = timestamp - startTimestamp;
       const progress = Math.min(elapsed / duration, 1);

       const current = start + (end - start) * easeOutCubic(progress);
       element.textContent = Math.floor(current).toLocaleString();

       if (progress < 1) {
           requestAnimationFrame(step);
       }
   };
   requestAnimationFrame(step);
}

function easeOutCubic(t) {
   return 1 - Math.pow(1 - t, 3);
}

// Enhanced stat card animations
function animateStatCards() {
   const statValues = document.querySelectorAll('.stat-value');
   statValues.forEach((element, index) => {
       const value = parseInt(element.textContent.replace(/[^\d]/g, ''));
       if (!isNaN(value)) {
           setTimeout(() => {
               animateValue(element, 0, value, 1500);
           }, index * 200);
       }
   });
}

// Chart animation utilities
function animateChart(chart) {
   if (!chart) return;

   chart.options.animation = {
       onComplete: () => {
           console.log('Chart animation completed');
       },
       onProgress: (context) => {
           const progress = context.currentStep / context.numSteps;
           // Could add progress indicators here
       }
   };
}

// Performance monitoring
const performanceObserver = new PerformanceObserver((list) => {
   const entries = list.getEntries();
   entries.forEach((entry) => {
       if (entry.entryType === 'navigation' && entry.loadEventEnd > 0) {
           const loadTime = entry.loadEventEnd - entry.loadEventStart;
           console.log(`Dashboard load time: ${loadTime.toFixed(2)}ms`);

           if (loadTime > 3000) {
               alerts.showWarning('Dashboard took longer than expected to load', 'Performance');
           }
       }
   });
});

if ('PerformanceObserver' in window) {
   performanceObserver.observe({ entryTypes: ['navigation'] });
}

// Memory usage monitoring
function checkMemoryUsage() {
   if ('memory' in performance) {
       const memory = performance.memory;
       const usedMB = memory.usedJSHeapSize / 1024 / 1024;
       const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;

       if (usedMB / limitMB > 0.8) {
           console.warn('High memory usage detected:', usedMB.toFixed(2), 'MB');
           alerts.showWarning('High memory usage detected. Consider refreshing the page.', 'Performance');
       }
   }
}



// Check memory usage every 5 minutes
setInterval(checkMemoryUsage, 5 * 60 * 1000);

console.log('✅ Dashboard.js fully loaded and initialized');
console.log('🚀 All systems ready - Minato Enterprises Dashboard');