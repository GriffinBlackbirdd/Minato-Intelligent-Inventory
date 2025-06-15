// DOM elements
const customerSearch = document.getElementById('customerSearch');
const searchLoading = document.getElementById('searchLoading');
const searchCard = document.getElementById('searchCard');
const extractionCard = document.getElementById('extractionCard');
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
const proceedFinalBtn = document.getElementById('proceedFinalBtn');
const backToSearchBtn = document.getElementById('backToSearchBtn');
const resetBtn = document.getElementById('resetBtn');
const errorResetBtn = document.getElementById('errorResetBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const errorMessage = document.getElementById('errorMessage');
const resultsContent = document.getElementById('resultsContent');

// State
let selectedCustomerData = null;
let extractedData = null;
let isEditMode = false;
let searchTimeout = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;

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
        // Position the dropdown relative to the input field
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

    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    // Hide suggestions if query is too short
    if (query.length < 2) {
        hideSuggestions();
        return;
    }

    // Show loading indicator
    searchLoading.style.display = 'block';

    // Debounce search requests
    searchTimeout = setTimeout(async () => {
        try {
            const suggestions = await searchCustomers(query);
            renderSuggestions(suggestions);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            searchLoading.style.display = 'none';
        }
    }, 300); // 300ms delay
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
        // Enter edit mode
        editToggleBtn.innerHTML = '<i class="fas fa-eye"></i> View';
        editToggleBtn.classList.add('active');

        // Hide display fields, show edit fields
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

        // Show edit actions, hide default actions
        editActions.style.display = 'flex';
        defaultActions.style.display = 'none';

        // Add edit mode styling
        document.querySelector('.customer-info-section').classList.add('edit-mode');

        // Focus on first editable field
        editName.focus();

    } else {
        // Exit edit mode without saving
        exitEditMode();
    }
}

function exitEditMode() {
    isEditMode = false;

    editToggleBtn.innerHTML = '<i class="fas fa-edit"></i> Edit';
    editToggleBtn.classList.remove('active');

    // Show display fields, hide edit fields
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

    // Show default actions, hide edit actions
    editActions.style.display = 'none';
    defaultActions.style.display = 'flex';

    // Remove edit mode styling
    document.querySelector('.customer-info-section').classList.remove('edit-mode');
}

function saveChanges() {
    // Update extracted data with edited values
    extractedData.name = editName.value.trim();
    extractedData.aadhaar = editAadhaar.value.trim();
    extractedData.address = editAddress.value.trim();
    extractedData.mobile = editMobile.value.trim();

    // Update display fields
    customerTitle.textContent = extractedData.name;
    displayName.textContent = extractedData.name;
    displayAadhaar.textContent = extractedData.aadhaar;
    displayAddress.textContent = extractedData.address;
    displayMobile.textContent = extractedData.mobile;

    // Exit edit mode
    exitEditMode();

    // Show success feedback
    showSuccessToast('Changes saved successfully!');

    console.log('Updated customer information:', extractedData);
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
    // Reset edit fields to original values
    editName.value = extractedData.name;
    editAadhaar.value = extractedData.aadhaar;
    editAddress.value = extractedData.address;
    editMobile.value = extractedData.mobile;
    exitEditMode();
});

// Final proceed button - now leads to invoice generation
proceedFinalBtn.addEventListener('click', () => {
    // Show invoice generation options
    showInvoiceGenerationStep();
});

function showInvoiceGenerationStep() {
    // Update the current step to show invoice generation
    hideAllCards();

    // Create invoice generation card if it doesn't exist
    let invoiceCard = document.getElementById('invoiceCard');
    if (!invoiceCard) {
        invoiceCard = createInvoiceGenerationCard();
        document.querySelector('.steps-container').appendChild(invoiceCard);
    }

    // Populate invoice form with extracted data
    populateInvoiceForm(extractedData);

    invoiceCard.style.display = 'block';
    invoiceCard.classList.add('active');
    invoiceCard.scrollIntoView({ behavior: 'smooth' });
}

function createInvoiceGenerationCard() {
    const invoiceCard = document.createElement('div');
    invoiceCard.className = 'step-card';
    invoiceCard.id = 'invoiceCard';

    invoiceCard.innerHTML = `
        <div class="step-header">
            <div class="step-indicator">
                <span class="step-number">3</span>
            </div>
            <div class="step-title">
                <h2>Invoice Generation</h2>
                <p>Generate invoice with customer information</p>
            </div>
        </div>

        <div class="invoice-generation-content">
            <div class="invoice-form-section">
                <div class="form-header">
                    <h3>Invoice Details</h3>
                    <p>Review customer information and add invoice items</p>
                </div>

                <div class="customer-summary">
                    <h4>Customer Information</h4>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <span class="summary-label">Name:</span>
                            <span class="summary-value" id="invoiceCustomerName">-</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Aadhaar:</span>
                            <span class="summary-value" id="invoiceCustomerAadhaar">-</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Mobile:</span>
                            <span class="summary-value" id="invoiceCustomerMobile">-</span>
                        </div>
                        <div class="summary-item full-width">
                            <span class="summary-label">Address:</span>
                            <span class="summary-value" id="invoiceCustomerAddress">-</span>
                        </div>
                    </div>
                </div>

                <div class="invoice-items-section">
                    <div class="items-header">
                        <h4>Invoice Items (Optional)</h4>
                        <button class="btn-add-item" id="addItemBtn">
                            <i class="fas fa-plus"></i>
                            Add Item
                        </button>
                    </div>

                    <div class="items-container" id="invoiceItemsContainer">
                        <div class="no-items-message" id="noItemsMessage">
                            <i class="fas fa-info-circle"></i>
                            <span>No items added. Invoice will be generated with customer information only.</span>
                        </div>
                    </div>
                </div>

                <div class="template-status" id="templateStatus">
                    <div class="status-checking">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span>Checking invoice template...</span>
                    </div>
                </div>

                <div class="action-buttons" id="invoiceActions">
                    <button class="btn btn-primary" id="generateInvoiceBtn">
                        <i class="fas fa-file-invoice"></i>
                        Generate Invoice
                    </button>
                    <button class="btn btn-outline" id="backToReviewBtn">
                        <i class="fas fa-arrow-left"></i>
                        Back to Review
                    </button>
                </div>
            </div>
        </div>
    `;

    return invoiceCard;
}

function populateInvoiceForm(data) {
    document.getElementById('invoiceCustomerName').textContent = data.name;
    document.getElementById('invoiceCustomerAadhaar').textContent = data.aadhaar;
    document.getElementById('invoiceCustomerMobile').textContent = data.mobile;
    document.getElementById('invoiceCustomerAddress').textContent = data.address;

    // Check template status
    checkTemplateStatus();

    // Set up event listeners for invoice generation
    setupInvoiceEventListeners();
}

async function checkTemplateStatus() {
    try {
        const response = await fetch('/template-status');
        const status = await response.json();

        const templateStatusDiv = document.getElementById('templateStatus');

        if (status.template_available) {
            templateStatusDiv.innerHTML = `
                <div class="status-success">
                    <i class="fas fa-check-circle"></i>
                    <span>Word template ready (${status.template_type})</span>
                </div>
            `;
        } else {
            templateStatusDiv.innerHTML = `
                <div class="status-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>No invoice template found. Please add 'template.docx' to the 'templates' folder.</span>
                </div>
            `;

            // Disable generate button
            document.getElementById('generateInvoiceBtn').disabled = true;
        }
    } catch (error) {
        console.error('Error checking template status:', error);
        document.getElementById('templateStatus').innerHTML = `
            <div class="status-error">
                <i class="fas fa-times-circle"></i>
                <span>Error checking template status</span>
            </div>
        `;
    }
}

function setupInvoiceEventListeners() {
    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', addInvoiceItem);

    // Generate invoice button
    document.getElementById('generateInvoiceBtn').addEventListener('click', generateInvoice);

    // Back to review button
    document.getElementById('backToReviewBtn').addEventListener('click', () => {
        hideAllCards();
        extractionCard.style.display = 'block';
        extractionCard.classList.add('active');
        extractionCard.scrollIntoView({ behavior: 'smooth' });
    });
}

let itemCounter = 0;

function addInvoiceItem() {
    itemCounter++;
    const itemsContainer = document.getElementById('invoiceItemsContainer');
    const noItemsMessage = document.getElementById('noItemsMessage');

    // Hide no items message
    if (noItemsMessage) {
        noItemsMessage.style.display = 'none';
    }

    const itemDiv = document.createElement('div');
    itemDiv.className = 'invoice-item';
    itemDiv.dataset.itemId = itemCounter;

    itemDiv.innerHTML = `
        <div class="item-fields">
            <div class="field-group">
                <label>Item Name</label>
                <input type="text" class="item-name" placeholder="Enter item name">
            </div>
            <div class="field-group">
                <label>Quantity</label>
                <input type="number" class="item-quantity" placeholder="1" value="1" min="1">
            </div>
            <div class="field-group">
                <label>Price (₹)</label>
                <input type="number" class="item-price" placeholder="0.00" step="0.01" min="0">
            </div>
            <div class="field-group">
                <label>Total (₹)</label>
                <input type="number" class="item-total" placeholder="0.00" step="0.01" readonly>
            </div>
            <div class="field-group">
                <button class="btn-remove-item" onclick="removeInvoiceItem(${itemCounter})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    itemsContainer.appendChild(itemDiv);

    // Set up quantity and price change listeners for automatic total calculation
    const quantityInput = itemDiv.querySelector('.item-quantity');
    const priceInput = itemDiv.querySelector('.item-price');
    const totalInput = itemDiv.querySelector('.item-total');

    function updateTotal() {
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const total = quantity * price;
        totalInput.value = total.toFixed(2);
    }

    quantityInput.addEventListener('input', updateTotal);
    priceInput.addEventListener('input', updateTotal);

    // Focus on item name field
    itemDiv.querySelector('.item-name').focus();
}

function removeInvoiceItem(itemId) {
    const itemDiv = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemDiv) {
        itemDiv.remove();
    }

    // Show no items message if no items left
    const itemsContainer = document.getElementById('invoiceItemsContainer');
    const items = itemsContainer.querySelectorAll('.invoice-item');

    if (items.length === 0) {
        const noItemsMessage = document.getElementById('noItemsMessage');
        if (noItemsMessage) {
            noItemsMessage.style.display = 'block';
        }
    }
}

function collectInvoiceItems() {
    const items = [];
    const itemDivs = document.querySelectorAll('.invoice-item');

    itemDivs.forEach(itemDiv => {
        const name = itemDiv.querySelector('.item-name').value.trim();
        const quantity = parseFloat(itemDiv.querySelector('.item-quantity').value) || 0;
        const price = parseFloat(itemDiv.querySelector('.item-price').value) || 0;
        const total = parseFloat(itemDiv.querySelector('.item-total').value) || 0;

        if (name) {
            items.push({
                name: name,
                quantity: quantity,
                price: price,
                total: total
            });
        }
    });

    return items;
}

async function generateInvoice() {
    const generateBtn = document.getElementById('generateInvoiceBtn');
    const originalContent = generateBtn.innerHTML;

    try {
        // Show loading state
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

        // Collect invoice data
        const items = collectInvoiceItems();

        const invoiceData = {
            customer_name: extractedData.name,
            aadhaar_number: extractedData.aadhaar,
            address: extractedData.address,
            mobile_number: extractedData.mobile,
            items: items,
            additional_data: {
                // Add any additional data you want in the invoice
                GENERATED_DATE: new Date().toLocaleDateString(),
                GENERATED_TIME: new Date().toLocaleTimeString()
            }
        };

        // Make API call to generate invoice
        const response = await fetch('/generate-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoiceData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to generate invoice');
        }

        const result = await response.json();

        if (result.success) {
            // Show success and results
            showInvoiceSuccess(result);
        } else {
            throw new Error(result.error || 'Invoice generation failed');
        }

    } catch (error) {
        console.error('Invoice generation error:', error);
        showError(`Failed to generate invoice: ${error.message}`);
    } finally {
        // Restore button state
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalContent;
    }
}

function showInvoiceSuccess(result) {
    // Show final results
    hideAllCards();
    renderInvoiceResults(result);
    resultsCard.style.display = 'block';
    resultsCard.classList.add('active');
    resultsCard.scrollIntoView({ behavior: 'smooth' });
}

function renderInvoiceResults(result) {
    resultsContent.innerHTML = `
        <div class="results-success">
            <h3>✅ Invoice Generated Successfully</h3>

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
                <div class="result-item">
                    <span class="result-label">Source Folder:</span>
                    <div class="result-value">${extractedData.folder}</div>
                </div>
            </div>

            <div class="result-section">
                <h4>Invoice Details</h4>
                <div class="result-item">
                    <span class="result-label">Invoice Number:</span>
                    <div class="result-value">${result.invoice_number}</div>
                </div>
                <div class="result-item">
                    <span class="result-label">File Type:</span>
                    <div class="result-value">Word Document (.docx)</div>
                </div>
                <div class="result-item">
                    <span class="result-label">File Path:</span>
                    <div class="result-value">${result.invoice_path}</div>
                </div>
            </div>

            <div class="invoice-download-section">
                <a href="${result.download_url}" class="btn btn-primary download-btn" download>
                    <i class="fas fa-download"></i>
                    Download Invoice (.docx)
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
    selectedCustomerData = null;
    extractedData = null;
    isEditMode = false;
    customerSearch.value = '';
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

    // Remove invoice card if it exists
    const invoiceCard = document.getElementById('invoiceCard');
    if (invoiceCard) {
        invoiceCard.remove();
    }

    // Reset item counter
    itemCounter = 0;

    customerSearch.focus();
}

// Add CSS animations for toast notifications
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    .edit-mode .info-card {
        border-color: var(--primary-color) !important;
        background: linear-gradient(135deg, #fefce8, #fef3c7) !important;
        transform: scale(1.02);
    }

    .info-edit {
        transition: all 0.3s ease;
    }

    .info-edit:focus {
        transform: scale(1.02);
    }

    /* Invoice generation styles */
    .invoice-generation-content {
        padding: 2rem;
    }

    .form-header {
        text-align: center;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 2px solid var(--border-color);
    }

    .form-header h3 {
        color: var(--text-primary);
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    .form-header p {
        color: var(--text-secondary);
        font-size: 0.875rem;
    }

    .customer-summary {
        background: linear-gradient(135deg, #fefce8, #fef3c7);
        border: 2px solid var(--primary-color);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        margin-bottom: 2rem;
    }

    .customer-summary h4 {
        color: var(--primary-dark);
        font-weight: 700;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
    }

    .summary-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .summary-item.full-width {
        grid-column: 1 / -1;
    }

    .summary-label {
        font-weight: 600;
        color: var(--text-secondary);
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.025em;
    }

    .summary-value {
        color: var(--text-primary);
        font-weight: 500;
        background: rgba(255, 255, 255, 0.7);
        padding: 0.5rem;
        border-radius: var(--radius-md);
        border-left: 3px solid var(--primary-color);
    }

    .invoice-items-section {
        margin-bottom: 2rem;
    }

    .items-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .items-header h4 {
        color: var(--text-primary);
        font-weight: 700;
        margin: 0;
    }

    .btn-add-item {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        font-weight: 600;
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
    }

    .btn-add-item:hover {
        background: var(--primary-hover);
        transform: translateY(-1px);
    }

    .no-items-message {
        text-align: center;
        padding: 2rem;
        color: var(--text-muted);
        font-style: italic;
        background: var(--bg-secondary);
        border-radius: var(--radius-lg);
        border: 2px dashed var(--border-color);
    }

    .no-items-message i {
        margin-right: 0.5rem;
        color: var(--primary-color);
    }

    .invoice-item {
        background: white;
        border: 2px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        margin-bottom: 1rem;
        transition: var(--transition);
    }

    .invoice-item:hover {
        border-color: var(--primary-color);
        box-shadow: var(--shadow-md);
    }

    .item-fields {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1fr auto;
        gap: 1rem;
        align-items: end;
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .field-group label {
        font-weight: 600;
        color: var(--text-primary);
        font-size: 0.875rem;
    }

    .field-group input {
        padding: 0.75rem;
        border: 2px solid var(--border-color);
        border-radius: var(--radius-md);
        font-size: 1rem;
        background: white;
        color: var(--text-primary);
        transition: var(--transition);
        outline: none;
    }

    .field-group input:focus {
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgb(212 175 55 / 0.1);
    }

    .field-group input[readonly] {
        background: var(--bg-secondary);
        cursor: not-allowed;
    }

    .btn-remove-item {
        background: var(--error-color);
        color: white;
        border: none;
        padding: 0.75rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
    }

    .btn-remove-item:hover {
        background: #b91c1c;
        transform: translateY(-1px);
    }

    .template-status {
        margin-bottom: 1.5rem;
    }

    .status-checking, .status-success, .status-warning, .status-error {
        padding: 1rem;
        border-radius: var(--radius-lg);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 600;
    }

    .status-checking {
        background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
        color: var(--text-secondary);
    }

    .status-success {
        background: linear-gradient(135deg, #d1fae5, #a7f3d0);
        color: #065f46;
        border: 2px solid #10b981;
    }

    .status-warning {
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        color: #92400e;
        border: 2px solid var(--warning-color);
    }

    .status-error {
        background: linear-gradient(135deg, #fee2e2, #fecaca);
        color: #991b1b;
        border: 2px solid var(--error-color);
    }

    .invoice-download-section {
        text-align: center;
        margin-top: 2rem;
        padding-top: 2rem;
        border-top: 2px solid var(--border-color);
    }

    .download-btn {
        font-size: 1.1rem;
        padding: 1rem 2rem;
        min-width: 200px;
    }

    @media (max-width: 768px) {
        .item-fields {
            grid-template-columns: 1fr;
            gap: 1rem;
        }

        .summary-grid {
            grid-template-columns: 1fr;
        }

        .items-header {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
        }
    }
`;
document.head.appendChild(toastStyle);

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    console.log('Minato Enterprises - Document Processor initialized');

    // Focus on the search input
    customerSearch.focus();

    // Add helpful tips
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
            <span>Smart Document Processor</span>
        </div>
        <div style="margin-bottom: 0.75rem;">
            <strong style="color: #1a1a1a;">Workflow:</strong><br>
            • Search customers<br>
            • Extract document info<br>
            • Generate Word invoices
        </div>
        <div>
            <strong style="color: #1a1a1a;">Features:</strong><br>
            • Real-time search & extraction<br>
            • Mobile number extraction<br>
            • Editable information review<br>
            • Word document generation
        </div>
    `;

    helpText.appendChild(closeButton);

    setTimeout(() => {
        document.body.appendChild(helpText);

        setTimeout(() => {
            helpText.style.transform = 'translateY(0)';
            helpText.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            closeTips();
        }, 15000);
    }, 3000);
});

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

    /* Enhanced mobile display styles */
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

        // Add hover effects
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

    // Show extraction card and start fetching
    hideAllCards();
    extractionCard.style.display = 'block';
    extractionCard.classList.add('active');

    // Show fetching state
    fetchingContainer.style.display = 'block';
    extractionResults.style.display = 'none';

    // Start fetching process
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
    const stepDuration = 700; // 700ms per step

    // Animate progress bar
    const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
            progressText.textContent = steps[currentStep];
            progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
            currentStep++;
        } else {
            clearInterval(progressInterval);
            // Proceed to actual data extraction
            performDataExtraction(customer);
        }
    }, stepDuration);
}

async function performDataExtraction(customer) {
    try {
        // Actual API call to extract data
        const result = await processCustomer(customer.full_path);

        if (result.success) {
            extractedData = {
                name: customer.person_name,
                aadhaar: result.aadhar_number,
                address: result.address,
                mobile: result.mobile_number,
                folder: customer.folder_name
            };

            // Show results with edit capability
            showExtractionResults();
        } else {
            showError(`Failed to extract information: ${result.error}`);
        }

    } catch (error) {
        showError(`Processing failed: ${error.message}`);
    }
}

function showExtractionResults() {
    // Hide fetching, show results
    fetchingContainer.style.display = 'none';
    extractionResults.style.display = 'block';

    // Populate the display fields
    customerTitle.textContent = extractedData.name;
    customerSubtitle.textContent = `Folder: ${extractedData.folder}`;

    displayName.textContent = extractedData.name;
    displayAadhaar.textContent = extractedData.aadhaar;
    displayAddress.textContent = extractedData.address;
    displayMobile.textContent = extractedData.mobile;
    displayFolder.textContent = extractedData.folder;

    // Add special styling for mobile number
    displayMobile.classList.add('mobile-number-display');

    // Populate edit fields (hidden initially)
    editName.value = extractedData.name;
    editAadhaar.value = extractedData.aadhaar;
    editAddress.value = extractedData.address;
    editMobile.value = extractedData.mobile;
    editFolder.value = extractedData.folder;

    // Print to terminal
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