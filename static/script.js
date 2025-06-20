// Simplified script.js for upload-only functionality
// Removed all folder method dependencies

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
let extractedData = null;
let isEditMode = false;
let chassisTimeout = null;

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

// Utility functions
function showLoading(text = 'Processing...') {
    if (loadingText) loadingText.textContent = text;
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showError(message) {
    hideAllCards();
    if (errorMessage) errorMessage.textContent = message;
    if (errorCard) {
        errorCard.style.display = 'block';
        errorCard.classList.add('active');
    }
}

function hideAllCards() {
    document.querySelectorAll('.step-card').forEach(card => {
        card.style.display = 'none';
        card.classList.remove('active');
    });
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
        if (allSelectedBatteries) allSelectedBatteries.style.display = 'none';
        if (batteryCount) batteryCount.textContent = '0';
        return;
    }

    // Update count
    if (batteryCount) batteryCount.textContent = selectedBatteries.length;

    // Render selected batteries list
    if (allSelectedBatteriesList) {
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
    }

    if (allSelectedBatteries) allSelectedBatteries.style.display = 'block';

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

// Edit functionality
function toggleEditMode() {
    isEditMode = !isEditMode;

    if (isEditMode) {
        if (editToggleBtn) {
            editToggleBtn.innerHTML = '<i class="fas fa-eye"></i> View';
            editToggleBtn.classList.add('active');
        }

        // Hide display elements
        if (displayName) displayName.style.display = 'none';
        if (displayAadhaar) displayAadhaar.style.display = 'none';
        if (displayAddress) displayAddress.style.display = 'none';
        if (displayMobile) displayMobile.style.display = 'none';
        if (displayFolder) displayFolder.style.display = 'none';

        // Show edit elements
        if (editName) editName.style.display = 'block';
        if (editAadhaar) editAadhaar.style.display = 'block';
        if (editAddress) editAddress.style.display = 'block';
        if (editMobile) editMobile.style.display = 'block';
        if (editFolder) editFolder.style.display = 'block';

        if (editActions) editActions.style.display = 'flex';
        if (defaultActions) defaultActions.style.display = 'none';

        const customerInfoSection = document.querySelector('.customer-profile');
        if (customerInfoSection) customerInfoSection.classList.add('edit-mode');
        if (editName) editName.focus();
    } else {
        exitEditMode();
    }
}

function exitEditMode() {
    isEditMode = false;

    if (editToggleBtn) {
        editToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
        editToggleBtn.classList.remove('active');
    }

    // Show display elements
    if (displayName) displayName.style.display = 'flex';
    if (displayAadhaar) displayAadhaar.style.display = 'flex';
    if (displayAddress) displayAddress.style.display = 'flex';
    if (displayMobile) displayMobile.style.display = 'flex';
    if (displayFolder) displayFolder.style.display = 'flex';

    // Hide edit elements
    if (editName) editName.style.display = 'none';
    if (editAadhaar) editAadhaar.style.display = 'none';
    if (editAddress) editAddress.style.display = 'none';
    if (editMobile) editMobile.style.display = 'none';
    if (editFolder) editFolder.style.display = 'none';

    if (editActions) editActions.style.display = 'none';
    if (defaultActions) defaultActions.style.display = 'flex';

    const customerInfoSection = document.querySelector('.customer-profile');
    if (customerInfoSection) customerInfoSection.classList.remove('edit-mode');
}

function saveChanges() {
    if (extractedData) {
        extractedData.name = editName.value.trim();
        extractedData.aadhaar = editAadhaar.value.trim();
        extractedData.address = editAddress.value.trim();
        extractedData.mobile = editMobile.value.trim();

        if (customerTitle) customerTitle.textContent = extractedData.name;
        if (displayName) displayName.textContent = extractedData.name;
        if (displayAadhaar) displayAadhaar.textContent = extractedData.aadhaar;
        if (displayAddress) displayAddress.textContent = extractedData.address;
        if (displayMobile) displayMobile.textContent = extractedData.mobile;
    }

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
if (editToggleBtn) editToggleBtn.addEventListener('click', toggleEditMode);
if (saveChangesBtn) saveChangesBtn.addEventListener('click', saveChanges);
if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
        if (extractedData) {
            editName.value = extractedData.name;
            editAadhaar.value = extractedData.aadhaar;
            editAddress.value = extractedData.address;
            editMobile.value = extractedData.mobile;
        }
        exitEditMode();
    });
}

// Proceed to billing button
if (proceedToBillBtn) {
    proceedToBillBtn.addEventListener('click', () => {
        showBillingStep();
    });
}

function showBillingStep() {
    hideAllCards();
    if (billingCard) {
        billingCard.style.display = 'block';
        billingCard.classList.add('active');
    }

    // Populate customer information in billing card
    if (extractedData) {
        if (billCustomerName) billCustomerName.textContent = extractedData.name;
        if (billCustomerAadhaar) billCustomerAadhaar.textContent = extractedData.aadhaar;
        if (billCustomerMobile) billCustomerMobile.textContent = extractedData.mobile;
        if (billCustomerAddress) billCustomerAddress.textContent = extractedData.address;
    }

    // Setup billing event listeners
    setupBillingEventListeners();

    if (billingCard) billingCard.scrollIntoView({ behavior: 'smooth' });
}

function setupBillingEventListeners() {
    // Chassis filter
    if (chassisFilter) {
        chassisFilter.addEventListener('input', async (e) => {
            const query = e.target.value.trim();

            if (chassisTimeout) {
                clearTimeout(chassisTimeout);
            }

            if (chassisLoading) chassisLoading.style.display = 'block';

            chassisTimeout = setTimeout(async () => {
                try {
                    const results = await filterChassis(query);
                    renderChassisResults(results);
                } catch (error) {
                    console.error('Chassis filter failed:', error);
                } finally {
                    if (chassisLoading) chassisLoading.style.display = 'none';
                }
            }, 300);
        });
    }

    // Add battery button
    if (addBatteryBtn) {
        addBatteryBtn.addEventListener('click', addBatteryInputGroup);
    }

    // Setup event listeners for existing battery inputs
    batteryInputGroups.forEach(group => {
        setupBatteryInputEventListeners(group.index);
    });

    // HSN code change
    if (hsnCodeSelect) {
        hsnCodeSelect.addEventListener('change', () => {
            updateDescriptionPreview();
            updateGenerateBillButton();
        });
    }

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
    if (generateBillBtn) {
        generateBillBtn.addEventListener('click', generateBill);
    }

    // Back to review button
    if (backToReviewBtn) {
        backToReviewBtn.addEventListener('click', () => {
            hideAllCards();
            if (extractionCard) {
                extractionCard.style.display = 'block';
                extractionCard.classList.add('active');
                extractionCard.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

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
    if (!chassisResults || !chassisResultsList) return;

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
    if (chassisResults) chassisResults.style.display = 'none';
    if (chassisFilter) chassisFilter.value = chassis.display_text;

    if (selectedChassisDetails) {
        selectedChassisDetails.innerHTML = `
            <div style="margin-bottom: 0.5rem;"><strong>Model:</strong> ${chassis.make_model}</div>
            <div style="margin-bottom: 0.5rem;"><strong>Chassis Number:</strong> ${chassis.chassis_number}</div>
            <div style="margin-bottom: 0.5rem;"><strong>Motor Number:</strong> ${chassis.motor_number}</div>
            <div style="margin-bottom: 0.5rem;"><strong>Controller:</strong> ${chassis.controller_number}</div>
            <div><strong>Color:</strong> ${chassis.color}</div>
        `;
    }

    if (selectedChassis) selectedChassis.style.display = 'block';

    // Mark section as completed
    const chassisSection = chassisFilter ? chassisFilter.closest('.config-section') : null;
    if (chassisSection) {
        chassisSection.classList.add('has-selection');
        const sectionHeader = chassisSection.querySelector('.section-title');
        if (sectionHeader) sectionHeader.classList.add('completed');
    }

    updateDescriptionPreview();
    updateGenerateBillButton();
}

function clearSelectedChassis() {
    selectedChassisData = null;
    if (chassisFilter) chassisFilter.value = '';
    if (selectedChassis) selectedChassis.style.display = 'none';

    const chassisSection = chassisFilter ? chassisFilter.closest('.config-section') : null;
    if (chassisSection) {
        chassisSection.classList.remove('has-selection');
        const sectionHeader = chassisSection.querySelector('.section-title');
        if (sectionHeader) sectionHeader.classList.remove('completed');
    }

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
        if (descriptionPreview) descriptionPreview.style.display = 'none';
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

    if (description && previewContent) {
        previewContent.textContent = description.trim();
        if (descriptionPreview) descriptionPreview.style.display = 'block';
    } else {
        if (descriptionPreview) descriptionPreview.style.display = 'none';
    }
}

function updateGenerateBillButton() {
    const hasHsnCode = hsnCodeSelect ? hsnCodeSelect.value.trim() !== '' : false;
    const hasItems = selectedChassisData || getAllSelectedBatteries().length > 0;
    const hasAmount = parseFloat(document.getElementById('baseAmount')?.value || 0) > 0;
    const hasFinanceTeam = document.getElementById('financeTeam')?.value.trim() !== '';

    if (generateBillBtn) {
        generateBillBtn.disabled = !hasHsnCode || !hasItems || !hasAmount || !hasFinanceTeam;

        if (generateBillBtn.disabled) {
            generateBillBtn.style.opacity = '0.6';
            generateBillBtn.style.cursor = 'not-allowed';
        } else {
            generateBillBtn.style.opacity = '1';
            generateBillBtn.style.cursor = 'pointer';
        }
    }
}

// Bill generation
async function generateBill() {
    const generateBtn = generateBillBtn;
    const originalContent = generateBtn ? generateBtn.innerHTML : '';

    try {
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Bill...';
        }

        const baseAmount = parseFloat(document.getElementById('baseAmount')?.value) || 178899.90;
        const useIgst = document.getElementById('useIgst')?.checked || false;
        const financeTeam = document.getElementById('financeTeam')?.value.trim() || 'MINATO ENTERPRISE';

        const selectedBatteries = getAllSelectedBatteries();

        console.log('Generating bill with data:', {
            customer_name: extractedData?.name,
            chassis: selectedChassisData?.chassis_number,
            batteries: selectedBatteries.length,
            base_amount: baseAmount
        });

        if (!extractedData) {
            throw new Error('No customer data available');
        }

        const billingData = {
            customer_name: extractedData.name,
            aadhaar_number: extractedData.aadhaar,
            address: extractedData.address,
            mobile_number: extractedData.mobile,
            chassis_number: selectedChassisData ? selectedChassisData.chassis_number : null,
            selected_batteries: selectedBatteries.map(b => b.bat_serial_number),
            hsn_code: hsnCodeSelect ? hsnCodeSelect.value : '',
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
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalContent;
        }
    }
}

function showBillSuccess(result) {
    hideAllCards();
    renderBillResults(result);
    if (resultsCard) {
        resultsCard.style.display = 'block';
        resultsCard.classList.add('active');
    }

    // Update download button in results card
    const downloadBtn = document.getElementById('downloadBillBtn');
    if (downloadBtn && result.download_url) {
        downloadBtn.href = result.download_url;
        downloadBtn.style.display = 'inline-flex';
    }

    if (resultsCard) resultsCard.scrollIntoView({ behavior: 'smooth' });

    console.log('Bill generated successfully!');
}

function renderBillResults(result) {
    const selectedBatteries = getAllSelectedBatteries();
    const resultsContent = document.getElementById('resultsContent');

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
                    <div class="result-value">${extractedData?.name || 'N/A'}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Aadhaar Number:</span>
                    <div class="result-value">${extractedData?.aadhaar || 'N/A'}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Mobile Number:</span>
                    <div class="result-value">${extractedData?.mobile || 'N/A'}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">Address:</span>
                    <div class="result-value">${extractedData?.address || 'N/A'}</div>
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
                    <div class="result-value">${hsnCodeSelect ? hsnCodeSelect.value : 'N/A'}</div>
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
                    <div class="result-value">₹${document.getElementById('baseAmount')?.value || '178899.90'}</div>
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
if (backToSearchBtn) backToSearchBtn.addEventListener('click', resetToSearch);
if (resetBtn) resetBtn.addEventListener('click', resetToSearch);
if (errorResetBtn) errorResetBtn.addEventListener('click', resetToSearch);

function resetToSearch() {
    hideAllCards();
    const mainSearchCard = document.getElementById('searchCard');
    if (mainSearchCard) {
        mainSearchCard.style.display = 'block';
        mainSearchCard.classList.add('active');
    }

    // Reset all state
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
    if (chassisFilter) chassisFilter.value = '';
    if (hsnCodeSelect) hsnCodeSelect.value = '';

    // Reset battery inputs container to initial state
    if (batteryInputsContainer) {
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
    }

    // Reset pricing and finance team if exists
    const baseAmountInput = document.getElementById('baseAmount');
    const useIgstCheckbox = document.getElementById('useIgst');
    const financeTeamInput = document.getElementById('financeTeam');

    if (baseAmountInput) baseAmountInput.value = '178899.90';
    if (useIgstCheckbox) useIgstCheckbox.checked = false;
    if (financeTeamInput) financeTeamInput.value = 'MINATO ENTERPRISE';

    // Reset extraction card state
    if (fetchingContainer) fetchingContainer.style.display = 'block';
    if (extractionResults) extractionResults.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Initializing...';

    // Reset edit mode
    const customerInfoSection = document.querySelector('.customer-profile');
    if (customerInfoSection) customerInfoSection.classList.remove('edit-mode');

    // Reset billing card states
    if (selectedChassis) selectedChassis.style.display = 'none';
    if (allSelectedBatteries) allSelectedBatteries.style.display = 'none';
    if (chassisResults) chassisResults.style.display = 'none';
    if (descriptionPreview) descriptionPreview.style.display = 'none';

    // Reset calculation preview
    const calculationPreview = document.getElementById('calculationPreview');
    if (calculationPreview) calculationPreview.style.display = 'none';

    // Reset section states
    document.querySelectorAll('.config-section').forEach(section => {
        section.classList.remove('has-selection');
        const sectionHeader = section.querySelector('.section-title');
        if (sectionHeader) sectionHeader.classList.remove('completed');
    });

    // Focus on upload area (no customer name input anymore)
    const uploadCard = document.getElementById('searchCard');
    if (uploadCard) {
        uploadCard.scrollIntoView({ behavior: 'smooth' });
    }
}

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (isEditMode) {
            exitEditMode();
        } else {
            resetToSearch();
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

    .result-item {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0.75rem 0;
        border-bottom: 1px solid #f3f4f6;
    }

    .result-item:last-child {
        border-bottom: none;
    }

    .result-label {
        font-weight: 500;
        color: #6b7280;
        min-width: 150px;
        flex-shrink: 0;
    }

    .result-value {
        font-weight: 500;
        color: #1f2937;
        text-align: right;
        flex: 1;
        word-break: break-word;
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

    .bill-download-section {
        text-align: center;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid #e5e7eb;
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

    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }

    @keyframes slideOut {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
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
`;
document.head.appendChild(style);

// Make functions globally available for onclick handlers
window.clearSelectedChassis = clearSelectedChassis;
window.removeBatteryInputGroup = removeBatteryInputGroup;
window.clearSelectedBatteryInGroup = clearSelectedBatteryInGroup;
window.clearAllSelectedBatteries = clearAllSelectedBatteries;

// Export function for use in main HTML
window.showExtractionResults = function() {
    console.log('showExtractionResults called with:', window.extractedData);

    const fetchingContainer = document.getElementById('fetchingContainer');
    const extractionResults = document.getElementById('extractionResults');

    if (fetchingContainer) fetchingContainer.style.display = 'none';
    if (extractionResults) extractionResults.style.display = 'block';

    const customerTitle = document.getElementById('customerTitle');
    const customerSubtitle = document.getElementById('customerSubtitle');
    const displayName = document.getElementById('displayName');
    const displayAadhaar = document.getElementById('displayAadhaar');
    const displayAddress = document.getElementById('displayAddress');
    const displayMobile = document.getElementById('displayMobile');
    const displayFolder = document.getElementById('displayFolder');

    // Use window.extractedData to ensure we're getting the global variable
    const data = window.extractedData;

    if (data) {
        console.log('Populating display with data:', data);

        if (customerTitle) customerTitle.textContent = data.name || 'Unknown Customer';
        if (customerSubtitle) customerSubtitle.textContent = 'Extracted from uploaded images';
        if (displayName) displayName.textContent = data.name || 'Not found';
        if (displayAadhaar) displayAadhaar.textContent = data.aadhaar || 'Not found';
        if (displayAddress) displayAddress.textContent = data.address || 'Not found';
        if (displayMobile) displayMobile.textContent = data.mobile || 'Not found';
        if (displayFolder) displayFolder.textContent = 'Image Upload';

        // Add mobile number styling
        if (displayMobile) displayMobile.classList.add('mobile-number-display');

        // Also populate edit fields
        if (editName) editName.value = data.name || '';
        if (editAadhaar) editAadhaar.value = data.aadhaar || '';
        if (editAddress) editAddress.value = data.address || '';
        if (editMobile) editMobile.value = data.mobile || '';
        if (editFolder) editFolder.value = 'Image Upload';

        // Update global extractedData for other functions
        extractedData = data;

        console.log('\n' + '='.repeat(60));
        console.log('IMAGE EXTRACTION SUCCESSFUL');
        console.log('='.repeat(60));
        console.log(`Customer: ${data.name}`);
        console.log(`Aadhaar: ${data.aadhaar}`);
        console.log(`Mobile: ${data.mobile}`);
        console.log(`Address: ${data.address}`);
        console.log(`Source: Image Upload`);
        console.log('='.repeat(60) + '\n');
    } else {
        console.error('No extracted data found!');

        // Show fallback message
        if (customerTitle) customerTitle.textContent = 'No Data Extracted';
        if (customerSubtitle) customerSubtitle.textContent = 'Unable to extract information from images';
        if (displayName) displayName.textContent = 'Not found';
        if (displayAadhaar) displayAadhaar.textContent = 'Not found';
        if (displayAddress) displayAddress.textContent = 'Not found';
        if (displayMobile) displayMobile.textContent = 'Not found';
        if (displayFolder) displayFolder.textContent = 'Image Upload';
    }
};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Minato Enterprises - Document Processor & Billing System (Upload Only) initialized');

    // Setup initial battery input event listeners
    setupBatteryInputEventListeners(0);

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