// Safety override to prevent progress step errors
window.addEventListener('DOMContentLoaded', function() {
    // Override any existing functions that might try to access progress steps
    const originalQuerySelector = document.querySelector;
    document.querySelector = function(selector) {
        if (selector && selector.includes('progress-step')) {
            console.warn('Attempted to access progress-step element that no longer exists:', selector);
            return null;
        }
        return originalQuerySelector.call(document, selector);
    };
});

// DOM elements
const customerSearch = document.getElementById('customerSearch');
const searchLoading = document.getElementById('searchLoading');
const searchCard = document.getElementById('searchCard');
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
const resultsContent = document.getElementById('resultsContent');

// Billing elements
const billCustomerName = document.getElementById('billCustomerName');
const billCustomerAadhaar = document.getElementById('billCustomerAadhaar');
const billCustomerMobile = document.getElementById('billCustomerMobile');
const billCustomerAddress = document.getElementById('billCustomerAddress');

// Chassis elements
const chassisFilter = document.getElementById('chassisFilter');
const chassisLoading = document.getElementById('chassisLoading');
const chassisResults = document.getElementById('chassisResults');
const chassisResultsList = document.getElementById('chassisResultsList');
const selectedChassis = document.getElementById('selectedChassis');
const selectedChassisDetails = document.getElementById('selectedChassisDetails');

// Battery elements
const addBatteryBtn = document.getElementById('addBatteryBtn');
const batteryInputsContainer = document.getElementById('batteryInputsContainer');
const allSelectedBatteries = document.getElementById('allSelectedBatteries');
const allSelectedBatteriesList = document.getElementById('allSelectedBatteriesList');
const batteryCount = document.getElementById('batteryCount');

// Other billing elements
const hsnCodeSelect = document.getElementById('hsnCodeSelect');
const descriptionPreview = document.getElementById('descriptionPreview');
const previewContent = document.getElementById('previewContent');
const generateBillBtn = document.getElementById('generateBillBtn');
const backToReviewBtn = document.getElementById('backToReviewBtn');

// State
let selectedCustomerData = null;
let extractedData = null;
let isEditMode = false;
let searchTimeout = null;
let chassisTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

// Billing state
let selectedChassisData = null;
let batteryInputGroups = [];
let batteryTimeouts = {};
let nextBatteryIndex = 1;

// Initialize first battery group
batteryInputGroups.push({
    index: 0,
    selectedBattery: null,
    timeout: null
});

// Create a custom suggestions dropdown that's appended to body
function createSuggestionsDropdown() {
    const dropdown = document.createElement('div');
    dropdown.id = 'customSuggestionsDropdown';
    dropdown.style.cssText = `
        position: fixed;
        background: white;
        border: 2px solid #d4af37;
        border-radius: 0 0 0.75rem 0.75rem;
        box-shadow: 0 10px 25px -5px rgb(212 175 55 / 0.2), 0 4px 6px -4px rgb(212 175 55 / 0.1);
        z-index: 999999;
        max-height: 300px;
        overflow-y: auto;
        display: none;
        min-width: 300px;
    `;

    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'suggestions-list';
    suggestionsList.style.cssText = `
        padding: 0.5rem 0;
    `;

    dropdown.appendChild(suggestionsList);
    document.body.appendChild(dropdown);

    return { dropdown, suggestionsList };
}

// Initialize custom dropdown
const customDropdown = createSuggestionsDropdown();
const customSuggestionsDropdown = customDropdown.dropdown;
const customSuggestionsList = customDropdown.suggestionsList;

// Utility functions
function showLoading(text = 'Processing...') {
    loadingText.textContent = text;
    loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    loadingOverlay.style.display = 'none';
}

function showError(message) {
    hideAllCards();
    errorMessage.textContent = message;
    errorCard.style.display = 'block';
    errorCard.classList.add('active');
}

function hideAllCards() {
    document.querySelectorAll('.step-card').forEach(card => {
        card.style.display = 'none';
        card.classList.remove('active');
    });
}

function hideSuggestions() {
    customSuggestionsDropdown.style.display = 'none';
    selectedSuggestionIndex = -1;
}

function showSuggestions() {
    if (currentSuggestions.length > 0) {
        const inputRect = customerSearch.getBoundingClientRect();
        customSuggestionsDropdown.style.top = `${inputRect.bottom}px`;
        customSuggestionsDropdown.style.left = `${inputRect.left}px`;
        customSuggestionsDropdown.style.width = `${inputRect.width}px`;
        customSuggestionsDropdown.style.display = 'block';
    }
}

// Battery Management Functions
function addBatteryInputGroup() {
    const newIndex = nextBatteryIndex++;

    // Create new battery input group
    const batteryGroup = document.createElement('div');
    batteryGroup.className = 'battery-input-group';
    batteryGroup.setAttribute('data-battery-index', newIndex);

    batteryGroup.innerHTML = `
        <div class="battery-group-header">
            <span class="battery-group-title">
                <i class="fas fa-battery-three-quarters"></i>
                Battery ${newIndex + 1}
            </span>
            <button class="btn-remove-battery-group" onclick="removeBatteryInputGroup(${newIndex})">
                <i class="fas fa-trash"></i>
                Remove
            </button>
        </div>
        <div class="filter-group">
            <input type="text" class="battery-filter" placeholder="Search batteries..." data-battery-index="${newIndex}">
            <div class="filter-loading battery-loading" style="display: none;">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="filter-results battery-results" style="display: none;">
                <div class="results-list battery-results-list"></div>
            </div>
        </div>
        <div class="selected-item battery-selected" style="display: none;">
            <div class="selected-header">
                <span>Selected Battery</span>
                <button class="btn-remove" onclick="clearSelectedBatteryInGroup(${newIndex})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="selected-details battery-selected-details"></div>
        </div>
    `;

    batteryInputsContainer.appendChild(batteryGroup);

    // Add to battery groups tracking
    batteryInputGroups.push({
        index: newIndex,
        selectedBattery: null,
        timeout: null
    });

    // Setup event listeners for the new input
    setupBatteryInputEventListeners(newIndex);

    // Update remove button visibility
    updateRemoveButtonVisibility();

    // Show success message
    showSuccessToast(`Battery ${newIndex + 1} input added!`);

    // Focus on the new input
    const newInput = batteryGroup.querySelector('.battery-filter');
    newInput.focus();

    console.log(`Added battery input group ${newIndex + 1}`);
}

function removeBatteryInputGroup(index) {
    const batteryGroup = document.querySelector(`[data-battery-index="${index}"]`);
    if (!batteryGroup) return;

    // Clear any timeout for this group
    const groupData = batteryInputGroups.find(g => g.index === index);
    if (groupData && groupData.timeout) {
        clearTimeout(groupData.timeout);
    }

    // Remove from DOM
    batteryGroup.remove();

    // Remove from tracking array
    batteryInputGroups = batteryInputGroups.filter(g => g.index !== index);

    // Update remove button visibility
    updateRemoveButtonVisibility();

    // Update all selected batteries summary
    updateAllSelectedBatteriesSummary();

    // Update description preview and button state
    updateDescriptionPreview();
    updateGenerateBillButton();

    showSuccessToast(`Battery input removed!`);

    console.log(`Removed battery input group ${index + 1}`);
}

function clearSelectedBatteryInGroup(index) {
    const groupData = batteryInputGroups.find(g => g.index === index);
    if (!groupData) return;

    const batteryGroup = document.querySelector(`[data-battery-index="${index}"]`);
    if (!batteryGroup) return;

    // Clear selection
    groupData.selectedBattery = null;

    // Clear input
    const input = batteryGroup.querySelector('.battery-filter');
    input.value = '';

    // Hide selected display
    const selectedDisplay = batteryGroup.querySelector('.battery-selected');
    selectedDisplay.style.display = 'none';

    // Update all selected batteries summary
    updateAllSelectedBatteriesSummary();

    // Update description preview and button state
    updateDescriptionPreview();
    updateGenerateBillButton();

    showSuccessToast('Battery selection cleared!');
}

function clearAllSelectedBatteries() {
    // Clear all selections in all groups
    batteryInputGroups.forEach(group => {
        group.selectedBattery = null;

        const batteryGroup = document.querySelector(`[data-battery-index="${group.index}"]`);
        if (batteryGroup) {
            // Clear input
            const input = batteryGroup.querySelector('.battery-filter');
            input.value = '';

            // Hide selected display
            const selectedDisplay = batteryGroup.querySelector('.battery-selected');
            selectedDisplay.style.display = 'none';
        }
    });

    // Update summary
    updateAllSelectedBatteriesSummary();

    // Update description preview and button state
    updateDescriptionPreview();
    updateGenerateBillButton();

    showSuccessToast('All battery selections cleared!');
}

function updateRemoveButtonVisibility() {
    const removeButtons = document.querySelectorAll('.btn-remove-battery-group');

    // Hide remove button if only one battery group exists
    if (batteryInputGroups.length <= 1) {
        removeButtons.forEach(btn => btn.style.display = 'none');
    } else {
        removeButtons.forEach(btn => btn.style.display = 'inline-flex');
    }
}

function setupBatteryInputEventListeners(index) {
    const batteryGroup = document.querySelector(`[data-battery-index="${index}"]`);
    if (!batteryGroup) return;

    const input = batteryGroup.querySelector('.battery-filter');
    const loading = batteryGroup.querySelector('.battery-loading');
    const results = batteryGroup.querySelector('.battery-results');
    const resultsList = batteryGroup.querySelector('.battery-results-list');

    input.addEventListener('input', async (e) => {
        const query = e.target.value.trim();
        const groupData = batteryInputGroups.find(g => g.index === index);

        if (!groupData) return;

        if (groupData.timeout) {
            clearTimeout(groupData.timeout);
        }

        if (query.length === 0) {
            results.style.display = 'none';
            return;
        }

        loading.style.display = 'block';

        groupData.timeout = setTimeout(async () => {
            try {
                const batteryResults = await filterBatteries(query);
                renderBatteryResultsForGroup(index, batteryResults);
            } catch (error) {
                console.error(`Battery filter failed for group ${index}:`, error);
            } finally {
                loading.style.display = 'none';
            }
        }, 300);
    });
}

function renderBatteryResultsForGroup(groupIndex, results) {
    const batteryGroup = document.querySelector(`[data-battery-index="${groupIndex}"]`);
    if (!batteryGroup) return;

    const resultsContainer = batteryGroup.querySelector('.battery-results');
    const resultsList = batteryGroup.querySelector('.battery-results-list');

    if (!results || results.length === 0) {
        resultsContainer.style.display = 'none';
        return;
    }

    resultsList.innerHTML = '';

    results.forEach(battery => {
        // Check if this battery is already selected in any group
        const isAlreadySelected = batteryInputGroups.some(group =>
            group.selectedBattery && group.selectedBattery.bat_serial_number === battery.bat_serial_number
        );

        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';

        if (isAlreadySelected) {
            resultItem.classList.add('already-selected');
            resultItem.style.opacity = '0.5';
            resultItem.style.cursor = 'not-allowed';
        }

        resultItem.innerHTML = `
            <div class="result-details">
                <div class="result-title">${battery.make} ${battery.model}</div>
                <div class="result-subtitle">Serial: ${battery.bat_serial_number} (${battery.last_four})</div>
                ${isAlreadySelected ? '<div class="already-selected-text">Already selected</div>' : ''}
            </div>
            <div class="result-action">
                <i class="fas fa-${isAlreadySelected ? 'check' : 'plus'}"></i>
            </div>
        `;

        if (!isAlreadySelected) {
            resultItem.addEventListener('click', () => selectBatteryForGroup(groupIndex, battery));
        }

        resultsList.appendChild(resultItem);
    });

    resultsContainer.style.display = 'block';
}

function selectBatteryForGroup(groupIndex, battery) {
    const groupData = batteryInputGroups.find(g => g.index === groupIndex);
    if (!groupData) return;

    const batteryGroup = document.querySelector(`[data-battery-index="${groupIndex}"]`);
    if (!batteryGroup) return;

    // Check if battery is already selected in another group
    const isAlreadySelected = batteryInputGroups.some(group =>
        group.selectedBattery &&
        group.selectedBattery.bat_serial_number === battery.bat_serial_number &&
        group.index !== groupIndex
    );

    if (isAlreadySelected) {
        showSuccessToast('Battery already selected in another group!');
        return;
    }

    // Set selection
    groupData.selectedBattery = battery;

    // Update input value
    const input = batteryGroup.querySelector('.battery-filter');
    input.value = battery.display_text;

    // Hide results
    const results = batteryGroup.querySelector('.battery-results');
    results.style.display = 'none';

    // Show selected display
    const selectedDisplay = batteryGroup.querySelector('.battery-selected');
    const selectedDetails = batteryGroup.querySelector('.battery-selected-details');

    selectedDetails.innerHTML = `
        <div style="margin-bottom: 0.5rem;"><strong>Make:</strong> ${battery.make}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Model:</strong> ${battery.model}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Serial Number:</strong> ${battery.bat_serial_number}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Ampere:</strong> ${battery.ampere}Ah</div>
        <div><strong>Warranty:</strong> ${battery.warranty}</div>
    `;

    selectedDisplay.style.display = 'block';

    // Update all selected batteries summary
    updateAllSelectedBatteriesSummary();

    // Update description preview and button state
    updateDescriptionPreview();
    updateGenerateBillButton();

    showSuccessToast(`Battery selected for Battery ${groupIndex + 1}!`);
}

function updateAllSelectedBatteriesSummary() {
    const selectedBatteries = batteryInputGroups
        .filter(group => group.selectedBattery)
        .map(group => group.selectedBattery);

    if (selectedBatteries.length === 0) {
        allSelectedBatteries.style.display = 'none';
        batteryCount.textContent = '0';
        return;
    }

    // Update count
    batteryCount.textContent = selectedBatteries.length;

    // Render selected batteries list
    allSelectedBatteriesList.innerHTML = '';

    selectedBatteries.forEach((battery, index) => {
        const batteryDiv = document.createElement('div');
        batteryDiv.className = 'selected-battery';
        batteryDiv.innerHTML = `
            <div class="battery-info">
                <div class="battery-serial">${battery.bat_serial_number}</div>
                <div class="battery-details">${battery.make} ${battery.model} - ${battery.ampere}Ah</div>
            </div>
            <div class="battery-group-indicator">Battery ${getGroupIndexForBattery(battery.bat_serial_number) + 1}</div>
        `;

        allSelectedBatteriesList.appendChild(batteryDiv);
    });

    allSelectedBatteries.style.display = 'block';

    // Mark battery section as completed if has selections
    const batterySection = batteryInputsContainer.closest('.config-section');
    if (selectedBatteries.length > 0) {
        batterySection.classList.add('has-selection');
        const sectionHeader = batterySection.querySelector('.section-title');
        sectionHeader.classList.add('completed');
    } else {
        batterySection.classList.remove('has-selection');
        const sectionHeader = batterySection.querySelector('.section-title');
        sectionHeader.classList.remove('completed');
    }
}

function getGroupIndexForBattery(serialNumber) {
    const group = batteryInputGroups.find(g =>
        g.selectedBattery && g.selectedBattery.bat_serial_number === serialNumber
    );
    return group ? group.index : -1;
}

function getAllSelectedBatteries() {
    return batteryInputGroups
        .filter(group => group.selectedBattery)
        .map(group => group.selectedBattery);
}

// Real-time search functionality
customerSearch.addEventListener('input', async (e) => {
    const query = e.target.value.trim();

    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    searchLoading.style.display = 'block';

    searchTimeout = setTimeout(async () => {
        try {
            const suggestions = await searchCustomers(query);
            renderSuggestions(suggestions);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            searchLoading.style.display = 'none';
        }
    }, 300);
});

// Keyboard navigation for suggestions
customerSearch.addEventListener('keydown', (e) => {
    if (!customSuggestionsDropdown.style.display || customSuggestionsDropdown.style.display === 'none') {
        return;
    }

    const suggestionItems = customSuggestionsList.querySelectorAll('.suggestion-item');

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestionItems.length - 1);
            updateSuggestionSelection(suggestionItems);
            break;

        case 'ArrowUp':
            e.preventDefault();
            selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
            updateSuggestionSelection(suggestionItems);
            break;

        case 'Enter':
            e.preventDefault();
            if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
                selectCustomer(currentSuggestions[selectedSuggestionIndex]);
            }
            break;

        case 'Escape':
            hideSuggestions();
            break;
    }
});

function updateSuggestionSelection(suggestionItems) {
    suggestionItems.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
            item.style.background = 'linear-gradient(135deg, #fefce8, #fef3c7)';
            item.style.borderLeft = '4px solid #d4af37';
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
            item.style.background = 'white';
            item.style.borderLeft = 'none';
        }
    });
}

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#customerSearch') && !e.target.closest('#customSuggestionsDropdown')) {
        hideSuggestions();
    }
});

// Update dropdown position on scroll/resize
window.addEventListener('scroll', () => {
    if (customSuggestionsDropdown.style.display === 'block') {
        const inputRect = customerSearch.getBoundingClientRect();
        customSuggestionsDropdown.style.top = `${inputRect.bottom}px`;
        customSuggestionsDropdown.style.left = `${inputRect.left}px`;
    }
});

window.addEventListener('resize', () => {
    if (customSuggestionsDropdown.style.display === 'block') {
        const inputRect = customerSearch.getBoundingClientRect();
        customSuggestionsDropdown.style.top = `${inputRect.bottom}px`;
        customSuggestionsDropdown.style.left = `${inputRect.left}px`;
        customSuggestionsDropdown.style.width = `${inputRect.width}px`;
    }
});

// Edit functionality
function toggleEditMode() {
    isEditMode = !isEditMode;

    if (isEditMode) {
        editToggleBtn.innerHTML = '<i class="fas fa-eye"></i> View';
        editToggleBtn.classList.add('active');

        displayName.style.display = 'none';
        displayAadhaar.style.display = 'none';
        displayAddress.style.display = 'none';
        displayMobile.style.display = 'none';
        displayFolder.style.display = 'none';

        editName.style.display = 'block';
        editAadhaar.style.display = 'block';
        editAddress.style.display = 'block';
        editMobile.style.display = 'block';
        editFolder.style.display = 'block';

        editActions.style.display = 'flex';
        defaultActions.style.display = 'none';

        document.querySelector('.customer-info-section').classList.add('edit-mode');
        editName.focus();
    } else {
        exitEditMode();
    }
}

function exitEditMode() {
    isEditMode = false;

    editToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
    editToggleBtn.classList.remove('active');

    displayName.style.display = 'flex';
    displayAadhaar.style.display = 'flex';
    displayAddress.style.display = 'flex';
    displayMobile.style.display = 'flex';
    displayFolder.style.display = 'flex';

    editName.style.display = 'none';
    editAadhaar.style.display = 'none';
    editAddress.style.display = 'none';
    editMobile.style.display = 'none';
    editFolder.style.display = 'none';

    editActions.style.display = 'none';
    defaultActions.style.display = 'flex';

    document.querySelector('.customer-info-section').classList.remove('edit-mode');
}

function saveChanges() {
    extractedData.name = editName.value.trim();
    extractedData.aadhaar = editAadhaar.value.trim();
    extractedData.address = editAddress.value.trim();
    extractedData.mobile = editMobile.value.trim();

    customerTitle.textContent = extractedData.name;
    displayName.textContent = extractedData.name;
    displayAadhaar.textContent = extractedData.aadhaar;
    displayAddress.textContent = extractedData.address;
    displayMobile.textContent = extractedData.mobile;

    exitEditMode();
    showSuccessToast('Changes saved successfully!');
}

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        background: linear-gradient(135deg, #fefce8, #fef3c7);
        border: 2px solid #d4af37;
        color: #a67c00;
        padding: 1rem 1.5rem;
        border-radius: 0.75rem;
        font-weight: 600;
        z-index: 999999;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 10px 25px -5px rgb(212 175 55 / 0.2);
    `;

    toast.innerHTML = `
        <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i>
        ${message}
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// Event listeners for edit functionality
editToggleBtn.addEventListener('click', toggleEditMode);
saveChangesBtn.addEventListener('click', saveChanges);
cancelEditBtn.addEventListener('click', () => {
    editName.value = extractedData.name;
    editAadhaar.value = extractedData.aadhaar;
    editAddress.value = extractedData.address;
    editMobile.value = extractedData.mobile;
    exitEditMode();
});

// Proceed to billing button
proceedToBillBtn.addEventListener('click', () => {
    showBillingStep();
});

function showBillingStep() {
    hideAllCards();
    billingCard.style.display = 'block';
    billingCard.classList.add('active');

    // Populate customer information in billing card
    billCustomerName.textContent = extractedData.name;
    billCustomerAadhaar.textContent = extractedData.aadhaar;
    billCustomerMobile.textContent = extractedData.mobile;
    billCustomerAddress.textContent = extractedData.address;

    // Setup billing event listeners
    setupBillingEventListeners();

    billingCard.scrollIntoView({ behavior: 'smooth' });
}

function setupBillingEventListeners() {
    // Chassis filter
    chassisFilter.addEventListener('input', async (e) => {
        const query = e.target.value.trim();

        if (chassisTimeout) {
            clearTimeout(chassisTimeout);
        }

        chassisLoading.style.display = 'block';

        chassisTimeout = setTimeout(async () => {
            try {
                const results = await filterChassis(query);
                renderChassisResults(results);
            } catch (error) {
                console.error('Chassis filter failed:', error);
            } finally {
                chassisLoading.style.display = 'none';
            }
        }, 300);
    });

    // Add battery button
    addBatteryBtn.addEventListener('click', addBatteryInputGroup);

    // Setup event listeners for existing battery inputs
    batteryInputGroups.forEach(group => {
        setupBatteryInputEventListeners(group.index);
    });

    // HSN code change
    hsnCodeSelect.addEventListener('change', () => {
        updateDescriptionPreview();
        updateGenerateBillButton();
    });

    // Price and tax configuration
    const baseAmountInput = document.getElementById('baseAmount');
    const useIgstCheckbox = document.getElementById('useIgst');
    const financeTeamInput = document.getElementById('financeTeam');

    if (baseAmountInput) {
        baseAmountInput.addEventListener('input', updateTaxCalculation);
    }
    if (useIgstCheckbox) {
        useIgstCheckbox.addEventListener('change', updateTaxCalculation);
    }
    if (financeTeamInput) {
        financeTeamInput.addEventListener('input', updateGenerateBillButton);
    }

    // Generate bill button
    generateBillBtn.addEventListener('click', generateBill);

    // Back to review button
    backToReviewBtn.addEventListener('click', () => {
        hideAllCards();
        extractionCard.style.display = 'block';
        extractionCard.classList.add('active');
        extractionCard.scrollIntoView({ behavior: 'smooth' });
    });

    // Initial calculations and button state
    updateTaxCalculation();
    updateGenerateBillButton();
}

// Chassis functions
async function filterChassis(query) {
    try {
        const response = await fetch('/filter-chassis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filter_text: query
            })
        });

        if (!response.ok) {
            throw new Error('Chassis filter failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Chassis filter error:', error);
        return [];
    }
}

function renderChassisResults(results) {
    if (results.length === 0) {
        chassisResults.style.display = 'none';
        return;
    }

    chassisResultsList.innerHTML = '';

    results.forEach(chassis => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.innerHTML = `
            <div class="result-details">
                <div class="result-title">${chassis.make_model}</div>
                <div class="result-subtitle">Chassis: ${chassis.chassis_number} (${chassis.last_four})</div>
            </div>
            <div class="result-action">
                <i class="fas fa-plus"></i>
            </div>
        `;

        resultItem.addEventListener('click', () => selectChassis(chassis));
        chassisResultsList.appendChild(resultItem);
    });

    chassisResults.style.display = 'block';
}

function selectChassis(chassis) {
    selectedChassisData = chassis;
    chassisResults.style.display = 'none';
    chassisFilter.value = chassis.display_text;

    selectedChassisDetails.innerHTML = `
        <div style="margin-bottom: 0.5rem;"><strong>Model:</strong> ${chassis.make_model}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Chassis Number:</strong> ${chassis.chassis_number}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Motor Number:</strong> ${chassis.motor_number}</div>
        <div style="margin-bottom: 0.5rem;"><strong>Controller:</strong> ${chassis.controller_number}</div>
        <div><strong>Color:</strong> ${chassis.color}</div>
    `;

    selectedChassis.style.display = 'block';

    // Mark section as completed
    const chassisSection = chassisFilter.closest('.config-section');
    chassisSection.classList.add('has-selection');
    const sectionHeader = chassisSection.querySelector('.section-title');
    sectionHeader.classList.add('completed');

    updateDescriptionPreview();
    updateGenerateBillButton();
}

function clearSelectedChassis() {
    selectedChassisData = null;
    chassisFilter.value = '';
    selectedChassis.style.display = 'none';

    const chassisSection = chassisFilter.closest('.config-section');
    chassisSection.classList.remove('has-selection');
    const sectionHeader = chassisSection.querySelector('.section-title');
    sectionHeader.classList.remove('completed');

    updateDescriptionPreview();
    updateGenerateBillButton();
}

// Battery functions
async function filterBatteries(query) {
    try {
        const response = await fetch('/filter-batteries', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filter_text: query
            })
        });

        if (!response.ok) {
            throw new Error('Battery filter failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Battery filter error:', error);
        return [];
    }
}

async function updateTaxCalculation() {
    const baseAmount = parseFloat(document.getElementById('baseAmount')?.value) || 0;
    const useIgst = document.getElementById('useIgst')?.checked || false;
    const calculationPreview = document.getElementById('calculationPreview');
    const calculationDetails = document.getElementById('calculationDetails');

    if (baseAmount <= 0) {
        if (calculationPreview) calculationPreview.style.display = 'none';
        updateGenerateBillButton();
        return;
    }

    try {
        const response = await fetch('/calculate-bill-amount', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base_amount: baseAmount,
                use_igst: useIgst
            })
        });

        if (!response.ok) {
            throw new Error('Failed to calculate taxes');
        }

        const result = await response.json();

        if (result.success && calculationDetails) {
            calculationDetails.innerHTML = `
                <div class="calc-row">
                    <span class="calc-label">SUBTOTAL:</span>
                    <span class="calc-value">₹${result.subtotal.toFixed(2)}</span>
                </div>
                ${result.cgst > 0 ? `
                <div class="calc-row">
                    <span class="calc-label">C.G.S.T @ 2.5%:</span>
                    <span class="calc-value">₹${result.cgst.toFixed(2)}</span>
                </div>
                <div class="calc-row">
                    <span class="calc-label">S.G.S.T @ 2.5%:</span>
                    <span class="calc-value">₹${result.sgst.toFixed(2)}</span>
                </div>` : ''}
                ${result.igst > 0 ? `
                <div class="calc-row">
                    <span class="calc-label">I.G.S.T @ 5%:</span>
                    <span class="calc-value">₹${result.igst.toFixed(2)}</span>
                </div>` : ''}
                ${result.round_off !== 0 ? `
                <div class="calc-row">
                    <span class="calc-label">ROUND OFF:</span>
                    <span class="calc-value">₹${result.round_off.toFixed(2)}</span>
                </div>` : ''}
                <div class="calc-row total-row">
                    <span class="calc-label"><strong>TOTAL:</strong></span>
                    <span class="calc-value"><strong>₹${result.total_amount.toFixed(2)}</strong></span>
                </div>
                <div class="calc-row">
                    <span class="calc-label">Amount in Words:</span>
                    <span class="calc-value amount-words">${result.amount_in_words}</span>
                </div>
                <div class="calc-row state-info">
                    <span class="calc-label">Tax Type:</span>
                    <span class="calc-value">${useIgst ? 'IGST (Inter-state)' : 'CGST + SGST (Intra-state)'}</span>
                </div>
            `;

            if (calculationPreview) calculationPreview.style.display = 'block';

            // Mark pricing section as completed
            const pricingSection = document.getElementById('pricingSection');
            if (pricingSection) {
                pricingSection.classList.add('has-selection');
                const sectionHeader = pricingSection.querySelector('.section-header');
                if (sectionHeader) sectionHeader.classList.add('completed');
            }
        }

        updateGenerateBillButton();
    } catch (error) {
        console.error('Tax calculation error:', error);
        if (calculationPreview) calculationPreview.style.display = 'none';
        updateGenerateBillButton();
    }
}

// Description preview
function updateDescriptionPreview() {
    const chassisInfo = selectedChassisData;
    const batteries = getAllSelectedBatteries();

    if (!chassisInfo && batteries.length === 0) {
        descriptionPreview.style.display = 'none';
        return;
    }

    let description = '';

    // Add chassis information (required for the new format)
    if (chassisInfo) {
        description += `E-RICKSHAW ${chassisInfo.make_model.toUpperCase()} `;
        description += `CHASSIS NO-${chassisInfo.chassis_number} `;
        description += `MOTOR NO-${chassisInfo.motor_number}`;

        // Add battery information in the new format
        if (batteries.length > 0) {
            description += ' WITH ';

            const batteryDescriptions = batteries.map((battery, index) => {
                // Format: {make} {warranty} {model} {ampere}
                return `${battery.make} ${battery.warranty} ${battery.model} ${battery.ampere}`;
            });

            // Join multiple batteries with commas
            description += batteryDescriptions.join(', ');
        }
    } else if (batteries.length > 0) {
        // If only batteries selected without chassis, show battery info only
        description = 'BATTERIES: ';
        const batteryDescriptions = batteries.map((battery, index) => {
            return `${battery.make} ${battery.warranty} ${battery.model} ${battery.ampere}`;
        });
        description += batteryDescriptions.join(', ');
    }

    if (description) {
        previewContent.textContent = description.trim();
        descriptionPreview.style.display = 'block';
    } else {
        descriptionPreview.style.display = 'none';
    }
}

function updateGenerateBillButton() {
    const hasHsnCode = hsnCodeSelect.value.trim() !== '';
    const hasItems = selectedChassisData || getAllSelectedBatteries().length > 0;
    const hasAmount = parseFloat(document.getElementById('baseAmount')?.value || 0) > 0;
    const hasFinanceTeam = document.getElementById('financeTeam')?.value.trim() !== '';

    generateBillBtn.disabled = !hasHsnCode || !hasItems || !hasAmount || !hasFinanceTeam;

    if (generateBillBtn.disabled) {
        generateBillBtn.style.opacity = '0.6';
        generateBillBtn.style.cursor = 'not-allowed';
    } else {
        generateBillBtn.style.opacity = '1';
        generateBillBtn.style.cursor = 'pointer';
    }
}

// Bill generation
async function generateBill() {
    const generateBtn = generateBillBtn;
    const originalContent = generateBtn.innerHTML;

    try {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Bill...';

        const baseAmount = parseFloat(document.getElementById('baseAmount').value) || 169523.81;
        const useIgst = document.getElementById('useIgst').checked;
        const financeTeam = document.getElementById('financeTeam').value.trim();

        const selectedBatteries = getAllSelectedBatteries();

        console.log('Generating bill with data:', {
            customer_name: extractedData.name,
            chassis: selectedChassisData?.chassis_number,
            batteries: selectedBatteries.length,
            base_amount: baseAmount
        });

        const billingData = {
            customer_name: extractedData.name,
            aadhaar_number: extractedData.aadhaar,
            address: extractedData.address,
            mobile_number: extractedData.mobile,
            chassis_number: selectedChassisData ? selectedChassisData.chassis_number : null,
            selected_batteries: selectedBatteries.map(b => b.bat_serial_number),
            hsn_code: hsnCodeSelect.value,
            base_amount: baseAmount,
            use_igst: useIgst,
            finance_team: financeTeam,
            additional_notes: null
        };

        const response = await fetch('/generate-bill', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(billingData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate bill');
        }

        const result = await response.json();

        if (result.success) {
            console.log('Bill generation successful, showing results...');
            showBillSuccess(result);
        } else {
            throw new Error(result.error || 'Bill generation failed');
        }

    } catch (error) {
        console.error('Bill generation error:', error);
        showError(`Failed to generate bill: ${error.message}`);
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalContent;
    }
}

function showBillSuccess(result) {
    hideAllCards();
    renderBillResults(result);
    resultsCard.style.display = 'block';
    resultsCard.classList.add('active');

    // Update download button in results card
    const downloadBtn = document.getElementById('downloadBillBtn');
    if (downloadBtn && result.download_url) {
        downloadBtn.href = result.download_url;
        downloadBtn.style.display = 'inline-flex';
    }

    resultsCard.scrollIntoView({ behavior: 'smooth' });

    console.log('Bill generated successfully!');
}

function renderBillResults(result) {
    const selectedBatteries = getAllSelectedBatteries();

    if (!resultsContent) {
        console.error('Results content element not found');
        return;
    }

    resultsContent.innerHTML = `
        <div class="results-success">
            <h3>✅ Bill Generated Successfully</h3>

            <div class="result-section">
                <h4><i class="fas fa-user"></i> Customer Information</h4>
                <div class="result-item">
                    <span class="result-label">Name:</span>
                    <div class="result-value">${extractedData.name}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Aadhaar Number:</span>
                    <div class="result-value">${extractedData.aadhaar}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Mobile Number:</span>
                    <div class="result-value">${extractedData.mobile}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Address:</span>
                    <div class="result-value">${extractedData.address}</div>
                </div>
            </div>

            <div class="result-section">
                <h4><i class="fas fa-file-invoice"></i> Bill Details</h4>
                <div class="result-item">
                    <span class="result-label">Bill Number:</span>
                    <div class="result-value">${result.bill_number}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Invoice Number:</span>
                    <div class="result-value">${result.invoice_number}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">HSN Code:</span>
                    <div class="result-value">${hsnCodeSelect.value}</div>
                </div>
                ${selectedChassisData ? `
                <div class="result-item">
                    <span class="result-label">Chassis Number:</span>
                    <div class="result-value">${selectedChassisData.chassis_number}</div>
                </div>` : ''}
                ${selectedBatteries.length > 0 ? `
                <div class="result-item">
                    <span class="result-label">Selected Batteries (${selectedBatteries.length}):</span>
                    <div class="result-value">${selectedBatteries.map(b => b.bat_serial_number).join(', ')}</div>
                </div>` : ''}
                <div class="result-item">
                    <span class="result-label">Description:</span>
                    <div class="result-value">${result.description || 'N/A'}</div>
                </div>
            </div>

            <div class="result-section">
                <h4><i class="fas fa-calculator"></i> Financial Summary</h4>
                <div class="result-item">
                    <span class="result-label">Base Amount:</span>
                    <div class="result-value">₹${document.getElementById('baseAmount')?.value || '169523.81'}</div>
                </div>
                ${result.cgst > 0 ? `
                <div class="result-item">
                    <span class="result-label">CGST @ 2.5%:</span>
                    <div class="result-value">₹${result.cgst.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">SGST @ 2.5%:</span>
                    <div class="result-value">₹${result.sgst.toFixed(2)}</div>
                </div>` : ''}
                ${result.igst > 0 ? `
                <div class="result-item">
                    <span class="result-label">IGST @ 5%:</span>
                    <div class="result-value">₹${result.igst.toFixed(2)}</div>
                </div>` : ''}
                <div class="result-item">
                    <span class="result-label">Total Amount:</span>
                    <div class="result-value total-amount">₹${result.total_amount.toFixed(2)}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Amount in Words:</span>
                    <div class="result-value amount-words">${result.amount_in_words}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">File Path:</span>
                    <div class="result-value">${result.bill_path}</div>
                </div>
            </div>

            <div class="bill-download-section">
                <a href="${result.download_url}" class="btn btn-primary download-btn" download>
                    <i class="fas fa-download"></i>
                    Download Bill (.docx)
                </a>
            </div>
        </div>
    `;
}

// Navigation buttons
backToSearchBtn.addEventListener('click', resetToSearch);
resetBtn.addEventListener('click', resetToSearch);
errorResetBtn.addEventListener('click', resetToSearch);

function resetToSearch() {
    hideAllCards();
    searchCard.style.display = 'block';
    searchCard.classList.add('active');

    // Reset all state
    selectedCustomerData = null;
    extractedData = null;
    isEditMode = false;
    selectedChassisData = null;

    // Reset battery state
    batteryInputGroups = [{
        index: 0,
        selectedBattery: null,
        timeout: null
    }];
    nextBatteryIndex = 1;

    // Reset form values
    customerSearch.value = '';
    chassisFilter.value = '';
    hsnCodeSelect.value = '';

    // Reset battery inputs container to initial state
    batteryInputsContainer.innerHTML = `
        <div class="battery-input-group" data-battery-index="0">
            <div class="battery-group-header">
                <span class="battery-group-title">
                    <i class="fas fa-battery-three-quarters"></i>
                    Battery 1
                </span>
                <button class="btn-remove-battery-group" onclick="removeBatteryInputGroup(0)" style="display: none;">
                    <i class="fas fa-trash"></i>
                    Remove
                </button>
            </div>
            <div class="filter-group">
                <input type="text" class="battery-filter" placeholder="Search batteries..." data-battery-index="0">
                <div class="filter-loading battery-loading" style="display: none;">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="filter-results battery-results" style="display: none;">
                    <div class="results-list battery-results-list"></div>
                </div>
            </div>
            <div class="selected-item battery-selected" style="display: none;">
                <div class="selected-header">
                    <span>Selected Battery</span>
                    <button class="btn-remove" onclick="clearSelectedBatteryInGroup(0)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="selected-details battery-selected-details"></div>
            </div>
        </div>
    `;

    // Reset pricing and finance team if exists
    const baseAmountInput = document.getElementById('baseAmount');
    const useIgstCheckbox = document.getElementById('useIgst');
    const financeTeamInput = document.getElementById('financeTeam');

    if (baseAmountInput) {
        baseAmountInput.value = '178899.90';
    }
    if (useIgstCheckbox) {
        useIgstCheckbox.checked = false;
    }
    if (financeTeamInput) {
        financeTeamInput.value = 'MINATO ENTERPRISE';
    }

    // Clear results
    resultsContent.innerHTML = '';
    hideSuggestions();

    // Reset extraction card state
    fetchingContainer.style.display = 'block';
    extractionResults.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = 'Initializing...';

    // Reset edit mode
    if (document.querySelector('.customer-info-section')) {
        document.querySelector('.customer-info-section').classList.remove('edit-mode');
    }

    // Reset billing card states
    if (selectedChassis) selectedChassis.style.display = 'none';
    if (allSelectedBatteries) allSelectedBatteries.style.display = 'none';
    if (chassisResults) chassisResults.style.display = 'none';
    if (descriptionPreview) descriptionPreview.style.display = 'none';

    // Reset calculation preview
    const calculationPreview = document.getElementById('calculationPreview');
    if (calculationPreview) {
        calculationPreview.style.display = 'none';
    }

    // Reset section states
    document.querySelectorAll('.config-section').forEach(section => {
        section.classList.remove('has-selection');
        const sectionHeader = section.querySelector('.section-title');
        if (sectionHeader) {
            sectionHeader.classList.remove('completed');
        }
    });

    customerSearch.focus();
}

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isEditMode) {
            exitEditMode();
        } else {
            hideSuggestions();
            if (selectedCustomerData) {
                resetToSearch();
            }
        }
    }

    // Save changes with Ctrl+S in edit mode
    if (e.ctrlKey && e.key === 's' && isEditMode) {
        e.preventDefault();
        saveChanges();
    }
});

// Connection status handlers
window.addEventListener('online', () => {
    console.log('Connection restored');
});

window.addEventListener('offline', () => {
    showError('Connection lost. Please check your internet connection.');
});

// Add CSS for new components
const style = document.createElement('style');
style.textContent = `
    .result-section {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 0.75rem;
        border: 1px solid #d4af37;
    }

    .result-section h4 {
        color: #a67c00;
        font-size: 1.1rem;
        font-weight: 700;
        margin-bottom: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #d4af37;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .suggestion-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
    }

    .fa-spin {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .mobile-number-highlight {
        background: linear-gradient(135deg, #e6f3ff, #cce7ff);
        border-left: 4px solid #0066cc;
        padding: 0.75rem;
        border-radius: 0.5rem;
        font-family: 'Monaco', 'Menlo', monospace;
        font-weight: 600;
    }

    .mobile-number-display {
        font-family: 'Monaco', 'Menlo', monospace;
        font-weight: 600;
        color: #0066cc;
        letter-spacing: 0.5px;
    }

    /* Battery Input Group Styles */
    .battery-input-group {
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid #e5e7eb;
        border-radius: 0.75rem;
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: all 0.3s ease;
    }

    .battery-input-group:hover {
        border-color: #d4af37;
        box-shadow: 0 4px 6px -1px rgba(212, 175, 55, 0.1);
    }

    .battery-group-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #e5e7eb;
    }

    .battery-group-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
        color: #374151;
        font-size: 0.95rem;
    }

    .battery-group-title i {
        color: #10b981;
        font-size: 1rem;
    }

    .btn-add-battery {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-left: auto;
    }

    .btn-add-battery:hover {
        background: linear-gradient(135deg, #059669, #047857);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .btn-remove-battery-group {
        background: #ef4444;
        color: white;
        border: none;
        padding: 0.375rem 0.75rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 0.375rem;
    }

    .btn-remove-battery-group:hover {
        background: #dc2626;
        transform: scale(1.05);
    }

    .section-actions {
        margin-left: auto;
    }

    .section-title {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        width: 100%;
    }

    .battery-group-indicator {
        font-size: 0.75rem;
        color: #6b7280;
        background: rgba(212, 175, 55, 0.1);
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        border: 1px solid rgba(212, 175, 55, 0.3);
    }

    .already-selected {
        opacity: 0.5;
        cursor: not-allowed !important;
    }

    .already-selected-text {
        font-size: 0.75rem;
        color: #f59e0b;
        font-style: italic;
        margin-top: 0.25rem;
    }

    .result-item.already-selected:hover {
        background: #fef3c7 !important;
        border-color: #f59e0b !important;
        transform: none !important;
    }

    .battery-count-badge {
        background: #10b981;
        color: white;
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        border-radius: 0.375rem;
        font-weight: 600;
        margin-left: 0.5rem;
    }

    /* Animation for new battery groups */
    .battery-input-group {
        animation: slideInUp 0.3s ease-out;
    }

    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Enhanced selected batteries summary */
    #allSelectedBatteries {
        background: linear-gradient(135deg, #d1fae5, #a7f3d0);
        border: 2px solid #10b981;
    }

    #allSelectedBatteries .selected-header {
        color: #047857;
        font-weight: 600;
    }

    .selected-battery {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(255, 255, 255, 0.9);
        padding: 0.75rem;
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
        border-left: 4px solid #10b981;
    }

    .selected-battery:last-child {
        margin-bottom: 0;
    }

    .total-amount {
        font-size: 1.1rem;
        font-weight: 700;
        color: #d4af37;
        background: linear-gradient(135deg, #fefce8, #fef3c7);
        padding: 0.5rem;
        border-radius: 0.5rem;
        border-left: 4px solid #d4af37;
    }

    .amount-words {
        font-family: 'Inter', sans-serif !important;
        font-size: 0.875rem;
        font-weight: 500;
        color: #1565c0;
        font-style: italic;
    }
`;
document.head.appendChild(style);

// API calls
async function searchCustomers(query) {
    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                customer_name: query
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Search failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
}

async function processCustomer(folderPath) {
    try {
        const response = await fetch('/process', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                folder_path: folderPath
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Processing failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Processing error:', error);
        throw error;
    }
}

// UI functions
function renderSuggestions(suggestions) {
    currentSuggestions = suggestions;
    customSuggestionsList.innerHTML = '';

    if (suggestions.length === 0) {
        customSuggestionsList.innerHTML = `
            <div style="padding: 1.5rem; text-align: center; color: #6b7280; font-style: italic;">
                <i class="fas fa-search"></i>
                No customers found matching your search
            </div>
        `;
        showSuggestions();
        return;
    }

    suggestions.forEach((suggestion, index) => {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'suggestion-item';
        suggestionElement.dataset.index = index;
        suggestionElement.style.cssText = `
            padding: 1rem 1.5rem;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        suggestionElement.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <div style="font-weight: 600; color: #1a1a1a;">${suggestion.person_name}</div>
                <div style="font-family: 'Monaco', 'Menlo', monospace; color: #4a4a4a; font-size: 0.875rem;">${suggestion.aadhaar_number}</div>
            </div>
            <i class="fas fa-arrow-right" style="color: #d4af37;"></i>
        `;

        suggestionElement.addEventListener('mouseenter', () => {
            suggestionElement.style.background = 'linear-gradient(135deg, #fefce8, #fef3c7)';
        });

        suggestionElement.addEventListener('mouseleave', () => {
            if (!suggestionElement.classList.contains('selected')) {
                suggestionElement.style.background = 'white';
            }
        });

        suggestionElement.addEventListener('click', () => selectCustomer(suggestion));
        customSuggestionsList.appendChild(suggestionElement);
    });

    showSuggestions();
}

function selectCustomer(customer) {
    selectedCustomerData = customer;
    customerSearch.value = customer.display_text;
    hideSuggestions();

    hideAllCards();
    extractionCard.style.display = 'block';
    extractionCard.classList.add('active');

    fetchingContainer.style.display = 'block';
    extractionResults.style.display = 'none';

    startFetchingProcess(customer);
    extractionCard.scrollIntoView({ behavior: 'smooth' });
}

async function startFetchingProcess(customer) {
    const steps = [
        'Initializing document processor...',
        'Locating customer documents...',
        'Reading document contents...',
        'Extracting Aadhaar information...',
        'Extracting mobile number...',
        'Processing address details...',
        'Validating extracted data...',
        'Finalizing information...'
    ];

    let currentStep = 0;
    const stepDuration = 700;

    const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
            progressText.textContent = steps[currentStep];
            progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
            currentStep++;
        } else {
            clearInterval(progressInterval);
            performDataExtraction(customer);
        }
    }, stepDuration);
}

async function performDataExtraction(customer) {
    try {
        const result = await processCustomer(customer.full_path);

        if (result.success) {
            extractedData = {
                name: customer.person_name,
                aadhaar: result.aadhar_number,
                address: result.address,
                mobile: result.mobile_number,
                folder: customer.folder_name
            };

            showExtractionResults();
        } else {
            showError(`Failed to extract information: ${result.error}`);
        }

    } catch (error) {
        showError(`Processing failed: ${error.message}`);
    }
}

function showExtractionResults() {
    fetchingContainer.style.display = 'none';
    extractionResults.style.display = 'block';

    customerTitle.textContent = extractedData.name;
    customerSubtitle.textContent = `Folder: ${extractedData.folder}`;

    displayName.textContent = extractedData.name;
    displayAadhaar.textContent = extractedData.aadhaar;
    displayAddress.textContent = extractedData.address;
    displayMobile.textContent = extractedData.mobile;
    displayFolder.textContent = extractedData.folder;

    displayMobile.classList.add('mobile-number-display');

    editName.value = extractedData.name;
    editAadhaar.value = extractedData.aadhaar;
    editAddress.value = extractedData.address;
    editMobile.value = extractedData.mobile;
    editFolder.value = extractedData.folder;

    console.log('\n' + '='.repeat(60));
    console.log('DOCUMENT EXTRACTION SUCCESSFUL');
    console.log('='.repeat(60));
    console.log(`Customer: ${extractedData.name}`);
    console.log(`Aadhaar: ${extractedData.aadhaar}`);
    console.log(`Mobile: ${extractedData.mobile}`);
    console.log(`Address: ${extractedData.address}`);
    console.log(`Folder: ${extractedData.folder}`);
    console.log('='.repeat(60) + '\n');
}

// Make functions globally available for onclick handlers
window.clearSelectedChassis = clearSelectedChassis;
window.removeBatteryInputGroup = removeBatteryInputGroup;
window.clearSelectedBatteryInGroup = clearSelectedBatteryInGroup;
window.clearAllSelectedBatteries = clearAllSelectedBatteries;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Minato Enterprises - Document Processor & Billing System initialized');

    // Focus on the search input
    customerSearch.focus();

    // Setup initial battery input event listeners
    setupBatteryInputEventListeners(0);

    // Add helpful tips
    setTimeout(() => {
        const helpText = document.createElement('div');
        helpText.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 1.5rem;
            border-radius: 1rem;
            font-size: 0.875rem;
            color: #4a4a4a;
            max-width: 320px;
            box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
            border: 2px solid #d4af37;
            z-index: 1000;
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '<i class="fas fa-times"></i>';
        closeButton.style.cssText = `
            position: absolute;
            top: 0.75rem;
            right: 0.75rem;
            background: none;
            border: none;
            color: #6b7280;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 0.25rem;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 1.5rem;
            height: 1.5rem;
            font-size: 0.75rem;
        `;

        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.background = '#f8f9fa';
            closeButton.style.color = '#d4af37';
        });

        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.background = 'none';
            closeButton.style.color = '#6b7280';
        });

        // const closeTips = () => {
        //     if (helpText.parentNode) {
        //         helpText.style.transform = 'translateY(100px)';
        //         helpText.style.opacity = '0';
        //         setTimeout(() => {
        //             if (helpText.parentNode) {
        //                 helpText.remove();
        //             }
        //         }, 300);
        //     }
        // };

        // closeButton.addEventListener('click', closeTips);

        // helpText.innerHTML = `
        //     <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: #d4af37; font-weight: 600;">
        //         <i class="fas fa-file-invoice"></i>
        //         <span>Smart Document Processor & Billing</span>
        //     </div>
        //     <div style="margin-bottom: 0.75rem;">
        //         <strong style="color: #1a1a1a;">Workflow:</strong><br>
        //         • Search customers<br>
        //         • Extract document info<br>
        //         • Select chassis & multiple batteries<br>
        //         • Set pricing & calculate taxes<br>
        //         • Generate Word bills
        //     </div>
        //     <div>
        //         <strong style="color: #1a1a1a;">New Features:</strong><br>
        //         • Add multiple battery inputs<br>
        //         • Individual battery selection<br>
        //         • Prevent duplicate selections<br>
        //         • Battery summary with count<br>
        //         • Remove specific battery groups<br>
        //         • Enhanced battery tracking
        //     </div>
        // `;

        // helpText.appendChild(closeButton);

        // document.body.appendChild(helpText);

        setTimeout(() => {
            helpText.style.transform = 'translateY(0)';
            helpText.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            closeTips();
        }, 18000);
    }, 3000);

    // Check data status on startup
    checkDataStatus();
});

async function checkDataStatus() {
    try {
        const response = await fetch('/data-status');
        const status = await response.json();

        console.log('Data Status:', status);

        if (!status.chassis_loaded || !status.battery_loaded) {
            console.warn('Warning: Some data files may not be loaded properly');
        }
    } catch (error) {
        console.error('Failed to check data status:', error);
    }
}