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

const chassisFilter = document.getElementById('chassisFilter');
const chassisLoading = document.getElementById('chassisLoading');
const chassisResults = document.getElementById('chassisResults');
const chassisResultsList = document.getElementById('chassisResultsList');
const selectedChassis = document.getElementById('selectedChassis');
const selectedChassisDetails = document.getElementById('selectedChassisDetails');

const batteryFilter = document.getElementById('batteryFilter');
const batteryLoading = document.getElementById('batteryLoading');
const batteryResults = document.getElementById('batteryResults');
const batteryResultsList = document.getElementById('batteryResultsList');
const selectedBatteries = document.getElementById('selectedBatteries');
const selectedBatteriesList = document.getElementById('selectedBatteriesList');

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
let batteryTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

// Billing state
let selectedChassisData = null;
let selectedBatteriesData = [];

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

    // Battery filter
    batteryFilter.addEventListener('input', async (e) => {
        const query = e.target.value.trim();

        if (batteryTimeout) {
            clearTimeout(batteryTimeout);
        }

        batteryLoading.style.display = 'block';

        batteryTimeout = setTimeout(async () => {
            try {
                const results = await filterBatteries(query);
                renderBatteryResults(results);
            } catch (error) {
                console.error('Battery filter failed:', error);
            } finally {
                batteryLoading.style.display = 'none';
            }
        }, 300);
    });

    // HSN code change
    hsnCodeSelect.addEventListener('change', updateDescriptionPreview);

    // Generate bill button
    generateBillBtn.addEventListener('click', generateBill);

    // Back to review button
    backToReviewBtn.addEventListener('click', () => {
        hideAllCards();
        extractionCard.style.display = 'block';
        extractionCard.classList.add('active');
        extractionCard.scrollIntoView({ behavior: 'smooth' });
    });

    // Update bill button state
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
    const chassisSection = chassisFilter.closest('.selection-section');
    chassisSection.classList.add('has-selection');
    const sectionHeader = chassisSection.querySelector('.section-header');
    sectionHeader.classList.add('completed');

    updateDescriptionPreview();
    updateGenerateBillButton();
}

function clearSelectedChassis() {
    selectedChassisData = null;
    chassisFilter.value = '';
    selectedChassis.style.display = 'none';

    const chassisSection = chassisFilter.closest('.selection-section');
    chassisSection.classList.remove('has-selection');
    const sectionHeader = chassisSection.querySelector('.section-header');
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

function renderBatteryResults(results) {
    if (results.length === 0) {
        batteryResults.style.display = 'none';
        return;
    }

    batteryResultsList.innerHTML = '';

    results.forEach(battery => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.innerHTML = `
            <div class="result-details">
                <div class="result-title">${battery.make} ${battery.model}</div>
                <div class="result-subtitle">Serial: ${battery.bat_serial_number} (${battery.last_four})</div>
            </div>
            <div class="result-action">
                <i class="fas fa-plus"></i>
            </div>
        `;

        resultItem.addEventListener('click', () => selectBattery(battery));
        batteryResultsList.appendChild(resultItem);
    });

    batteryResults.style.display = 'block';
}

function selectBattery(battery) {
    // Check if battery is already selected
    if (selectedBatteriesData.find(b => b.bat_serial_number === battery.bat_serial_number)) {
        showSuccessToast('Battery already selected!');
        return;
    }

    selectedBatteriesData.push(battery);
    batteryResults.style.display = 'none';
    batteryFilter.value = '';

    renderSelectedBatteries();
    updateDescriptionPreview();
    updateGenerateBillButton();
}

function renderSelectedBatteries() {
    if (selectedBatteriesData.length === 0) {
        selectedBatteries.style.display = 'none';

        const batterySection = batteryFilter.closest('.selection-section');
        batterySection.classList.remove('has-selection');
        const sectionHeader = batterySection.querySelector('.section-header');
        sectionHeader.classList.remove('completed');
        return;
    }

    selectedBatteriesList.innerHTML = '';

    selectedBatteriesData.forEach((battery, index) => {
        const batteryDiv = document.createElement('div');
        batteryDiv.className = 'selected-battery';
        batteryDiv.innerHTML = `
            <div class="battery-info">
                <div class="battery-serial">${battery.bat_serial_number}</div>
                <div class="battery-details">${battery.make} ${battery.model} - ${battery.ampere}Ah</div>
            </div>
            <button class="btn-remove" onclick="removeBattery(${index})">
                <i class="fas fa-times"></i>
            </button>
        `;

        selectedBatteriesList.appendChild(batteryDiv);
    });

    selectedBatteries.style.display = 'block';

    // Mark section as completed
    const batterySection = batteryFilter.closest('.selection-section');
    batterySection.classList.add('has-selection');
    const sectionHeader = batterySection.querySelector('.section-header');
    sectionHeader.classList.add('completed');
}

function removeBattery(index) {
    selectedBatteriesData.splice(index, 1);
    renderSelectedBatteries();
    updateDescriptionPreview();
    updateGenerateBillButton();
}

function clearAllBatteries() {
    selectedBatteriesData = [];
    renderSelectedBatteries();
    updateDescriptionPreview();
    updateGenerateBillButton();
}

// Description preview
function updateDescriptionPreview() {
    const chassisInfo = selectedChassisData;
    const batteries = selectedBatteriesData;
    const hsnCode = hsnCodeSelect.value;

    if (!chassisInfo && batteries.length === 0) {
        descriptionPreview.style.display = 'none';
        return;
    }

    let description = '';

    // Add chassis information
    if (chassisInfo) {
        description += `E-RICKSHAW ${chassisInfo.make_model.toUpperCase()} `;
        description += `CHASSIS NO-${chassisInfo.chassis_number} `;
        description += `MOTOR NO-${chassisInfo.motor_number}`;
    }

    // Add battery information
    if (batteries.length > 0) {
        if (description) description += ' ';
        description += `WITH SF SONIC 12 MONTHS BATTERY `;

        batteries.forEach((battery, index) => {
            const serialNumber = battery.bat_serial_number;
            const lastFour = serialNumber.slice(-4);
            description += `${index + 1})${serialNumber} ${lastFour} `;
        });
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
    const hasItems = selectedChassisData || selectedBatteriesData.length > 0;

    generateBillBtn.disabled = !hasHsnCode || !hasItems;

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

        const billingData = {
            customer_name: extractedData.name,
            aadhaar_number: extractedData.aadhaar,
            address: extractedData.address,
            mobile_number: extractedData.mobile,
            chassis_number: selectedChassisData ? selectedChassisData.chassis_number : null,
            selected_batteries: selectedBatteriesData.map(b => b.bat_serial_number),
            hsn_code: hsnCodeSelect.value,
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
    resultsCard.scrollIntoView({ behavior: 'smooth' });
}

function renderBillResults(result) {
    resultsContent.innerHTML = `
        <div class="results-success">
            <h3>✅ Bill Generated Successfully</h3>

            <div class="result-section">
                <h4>Customer Information</h4>
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
                <h4>Bill Details</h4>
                <div class="result-item">
                    <span class="result-label">Bill Number:</span>
                    <div class="result-value">${result.bill_number}</div>
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
                ${selectedBatteriesData.length > 0 ? `
                <div class="result-item">
                    <span class="result-label">Selected Batteries:</span>
                    <div class="result-value">${selectedBatteriesData.map(b => b.bat_serial_number).join(', ')}</div>
                </div>` : ''}
                <div class="result-item">
                    <span class="result-label">Description:</span>
                    <div class="result-value">${result.description || 'N/A'}</div>
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
    selectedBatteriesData = [];

    // Reset form values
    customerSearch.value = '';
    chassisFilter.value = '';
    batteryFilter.value = '';
    hsnCodeSelect.value = '';

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
    if (selectedBatteries) selectedBatteries.style.display = 'none';
    if (chassisResults) chassisResults.style.display = 'none';
    if (batteryResults) batteryResults.style.display = 'none';
    if (descriptionPreview) descriptionPreview.style.display = 'none';

    // Reset section states
    document.querySelectorAll('.selection-section').forEach(section => {
        section.classList.remove('has-selection');
        section.querySelector('.section-header').classList.remove('completed');
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

    .filter-input-wrapper {
        position: relative;
        margin-bottom: 1rem;
    }

    .filter-input {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 1rem;
        border: 2px solid var(--border-color);
        border-radius: var(--radius-lg);
        font-size: 1rem;
        background: var(--bg-primary);
        color: var(--text-primary);
        transition: var(--transition);
        outline: none;
    }

    .filter-input:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgb(212 175 55 / 0.1);
    }

    .filter-loading {
        position: absolute;
        right: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--primary-color);
        font-size: 1rem;
    }

    .filter-results {
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-color);
        max-height: 200px;
        overflow-y: auto;
        margin-top: 0.5rem;
    }

    .results-list {
        padding: 0.5rem;
    }

    .result-item {
        background: white;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        padding: 1rem;
        margin-bottom: 0.5rem;
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .result-item:hover {
        border-color: var(--primary-color);
        background: linear-gradient(135deg, #fefce8, #fef3c7);
        transform: translateY(-1px);
    }

    .result-item:hover .result-action {
        transform: scale(1.2);
        color: var(--primary-hover);
    }

    .result-item:last-child {
        margin-bottom: 0;
    }

    .result-details {
        flex: 1;
    }

    .result-title {
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 0.25rem;
    }

    .result-subtitle {
        font-size: 0.875rem;
        color: var(--text-secondary);
        font-family: 'Monaco', 'Menlo', monospace;
    }

    .result-action {
        color: var(--primary-color);
        font-size: 1.25rem;
        transition: var(--transition);
    }

    .selection-section.has-selection {
        border-color: #28a745;
        background: linear-gradient(135deg, #f8fff9, #f0fff4);
    }

    .section-header.completed h4 {
        color: #28a745;
    }

    .section-header.completed h4 i {
        color: #28a745;
    }
`;
document.head.appendChild(style);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Minato Enterprises - Document Processor & Billing System initialized');

    // Focus on the search input
    customerSearch.focus();

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

        const closeTips = () => {
            if (helpText.parentNode) {
                helpText.style.transform = 'translateY(100px)';
                helpText.style.opacity = '0';
                setTimeout(() => {
                    if (helpText.parentNode) {
                        helpText.remove();
                    }
                }, 300);
            }
        };

        closeButton.addEventListener('click', closeTips);

        helpText.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; color: #d4af37; font-weight: 600;">
                <i class="fas fa-file-invoice"></i>
                <span>Smart Document Processor & Billing</span>
            </div>
            <div style="margin-bottom: 0.75rem;">
                <strong style="color: #1a1a1a;">Workflow:</strong><br>
                • Search customers<br>
                • Extract document info<br>
                • Select chassis & batteries<br>
                • Generate Word bills
            </div>
            <div>
                <strong style="color: #1a1a1a;">Features:</strong><br>
                • Real-time search & filtering<br>
                • Mobile number extraction<br>
                • Editable information review<br>
                • HSN code selection<br>
                • Word document generation
            </div>
        `;

        helpText.appendChild(closeButton);

        document.body.appendChild(helpText);

        setTimeout(() => {
            helpText.style.transform = 'translateY(0)';
            helpText.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            closeTips();
        }, 15000);
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
window.removeBattery = removeBattery;
window.clearAllBatteries = clearAllBatteries;