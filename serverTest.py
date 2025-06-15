from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
from typing import List, Optional
import re
import logging
from datetime import datetime
import json
from docxtpl import DocxTemplate
from agno.agent import Agent
from agno.models.google import Gemini
from agno.media import File

# Configuration
DATA_FOLDER_PATH = "D:\\minato\\Data"  # Hardcoded path to Data folder
TEMPLATES_FOLDER = "templates"  # Folder for invoice templates
INVOICES_FOLDER = "generated_invoices"  # Folder for generated invoices
GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"  # Your API key

app = FastAPI(title="Minato Enterprises - Document Processor", version="1.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create necessary directories
Path(TEMPLATES_FOLDER).mkdir(exist_ok=True)
Path(INVOICES_FOLDER).mkdir(exist_ok=True)

# Pydantic models
class AadhaarExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract the aadhar number from the given pdf")
    address: str = Field(..., description="Extract the full address from the given pdf")
    mobileNumber: str = Field(..., description="Extract the mobile/phone number from the given pdf. Look for 10-digit numbers starting with 6, 7, 8, or 9")

class SearchRequest(BaseModel):
    customer_name: str

class CustomerSuggestion(BaseModel):
    folder_name: str
    full_path: str
    person_name: str
    aadhaar_number: str
    display_text: str  # "Customer Name - 123456789012"

class ProcessRequest(BaseModel):
    folder_path: str

class ExtractionResult(BaseModel):
    success: bool
    aadhar_number: Optional[str] = None
    address: Optional[str] = None
    mobile_number: Optional[str] = None
    error: Optional[str] = None

class InvoiceGenerationRequest(BaseModel):
    customer_name: str
    aadhaar_number: str
    address: str
    mobile_number: str
    items: List[dict] = []  # List of items with name, quantity, price
    additional_data: dict = {}  # Any additional data for placeholders

class InvoiceGenerationResult(BaseModel):
    success: bool
    invoice_path: Optional[str] = None
    invoice_number: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None

# Initialize the agent
agent = Agent(
    model=Gemini(id="gemini-1.5-flash", api_key=GOOGLE_API_KEY),
    description="You extract Aadhaar number, address, and mobile number information from the PDF file.",
    response_model=AadhaarExtraction,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Invoice counter for unique invoice numbers
invoice_counter_file = Path("invoice_counter.json")

def get_next_invoice_number() -> str:
    """Generate the next invoice number"""
    try:
        if invoice_counter_file.exists():
            with open(invoice_counter_file, 'r') as f:
                data = json.load(f)
                counter = data.get('counter', 0)
        else:
            counter = 0

        counter += 1

        # Save updated counter
        with open(invoice_counter_file, 'w') as f:
            json.dump({'counter': counter}, f)

        # Format: INV-2025-0001
        return f"INV-{datetime.now().year}-{counter:04d}"

    except Exception as e:
        logger.error(f"Error generating invoice number: {e}")
        # Fallback to timestamp-based number
        return f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}"

def get_template_file() -> Optional[Path]:
    """Find the invoice template file with enhanced debugging"""

    # Get absolute path to templates folder
    current_dir = Path.cwd()
    template_folder = current_dir / TEMPLATES_FOLDER
    template_path = template_folder / "template.docx"

    logger.info(f"Current working directory: {current_dir}")
    logger.info(f"Looking for templates folder at: {template_folder}")
    logger.info(f"Looking for template file at: {template_path}")

    # Check if templates folder exists
    if not template_folder.exists():
        logger.error(f"Templates folder does not exist: {template_folder}")
        logger.info("Creating templates folder...")
        template_folder.mkdir(parents=True, exist_ok=True)
        return None

    # List all files in templates folder for debugging
    try:
        files_in_templates = list(template_folder.iterdir())
        logger.info(f"Files in templates folder: {[f.name for f in files_in_templates]}")
    except Exception as e:
        logger.error(f"Error listing files in templates folder: {e}")

    # Check for exact template.docx file
    if template_path.exists():
        logger.info(f"Found template file: {template_path}")
        return template_path
    else:
        logger.warning(f"template.docx not found at: {template_path}")

    # Fallback: look for any .docx file in templates folder
    try:
        docx_files = list(template_folder.glob("*.docx"))
        logger.info(f"Found .docx files: {[f.name for f in docx_files]}")

        if docx_files:
            logger.info(f"Using fallback template: {docx_files[0]}")
            return docx_files[0]
    except Exception as e:
        logger.error(f"Error searching for .docx files: {e}")

    # Check for case-sensitive issues
    try:
        all_files = list(template_folder.glob("*"))
        for file in all_files:
            if file.name.lower() == "template.docx":
                logger.info(f"Found template with different case: {file.name}")
                return file
    except Exception as e:
        logger.error(f"Error checking for case-sensitive files: {e}")

    logger.error("No template file found")
    return None
@app.get("/debug-template")
async def debug_template_status():
    """Debug endpoint to check template file status"""
    current_dir = Path.cwd()
    template_folder = current_dir / TEMPLATES_FOLDER
    template_path = template_folder / "template.docx"

    debug_info = {
        "current_directory": str(current_dir),
        "templates_folder_path": str(template_folder),
        "templates_folder_exists": template_folder.exists(),
        "template_file_path": str(template_path),
        "template_file_exists": template_path.exists(),
        "template_file_size": template_path.stat().st_size if template_path.exists() else None,
        "files_in_templates": [],
        "all_docx_files": []
    }

    # List files in templates folder
    try:
        if template_folder.exists():
            files = list(template_folder.iterdir())
            debug_info["files_in_templates"] = [
                {
                    "name": f.name,
                    "is_file": f.is_file(),
                    "size": f.stat().st_size if f.is_file() else None
                } for f in files
            ]

            # Find all .docx files
            docx_files = list(template_folder.glob("*.docx"))
            debug_info["all_docx_files"] = [f.name for f in docx_files]
    except Exception as e:
        debug_info["error"] = str(e)

    return debug_info

def split_address(address: str) -> tuple:
    """
    Split address into two parts for template

    Args:
        address (str): Complete address

    Returns:
        tuple: (address1, address2)
    """
    if not address:
        return "", ""

    # Try to split at comma, keeping first part as address1
    parts = address.split(',', 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()

    # If no comma, try to split at a reasonable length
    if len(address) > 50:
        # Find a good break point (space) around the middle
        mid_point = len(address) // 2
        for i in range(mid_point - 10, mid_point + 10):
            if i < len(address) and address[i] == ' ':
                return address[:i].strip(), address[i+1:].strip()

    # If address is short or no good break point found
    return address.strip(), ""

def convert_amount_to_words(amount: float) -> str:
    """
    Convert numeric amount to words (basic implementation)

    Args:
        amount (float): Amount to convert

    Returns:
        str: Amount in words
    """
    # This is a basic implementation - you can enhance it for Indian currency format
    if amount == 0:
        return "Zero"

    # Simple conversion for demonstration
    # You might want to use a library like 'num2words' for better conversion
    try:
        from num2words import num2words
        return num2words(amount, lang='en_IN').title()
    except ImportError:
        # Fallback if num2words is not installed
        return f"Rupees {amount:.2f}"

def generate_invoice(customer_data: dict, items: List[dict] = None, additional_data: dict = None) -> InvoiceGenerationResult:
    """
    Generate invoice using DocxTemplate and customer data including mobile number

    Args:
        customer_data: Dictionary containing customer information
        items: List of items for the invoice
        additional_data: Additional data for custom placeholders

    Returns:
        InvoiceGenerationResult: Result of invoice generation
    """
    try:
        # Find template file
        template_file = get_template_file()
        if not template_file:
            return InvoiceGenerationResult(
                success=False,
                error="Invoice template not found. Please add 'template.docx' to the 'templates' folder."
            )

        logger.info(f"Using template: {template_file}")

        # Generate invoice number and current date
        invoice_number = get_next_invoice_number()
        current_date = datetime.now().strftime("%d/%m/%Y")
        current_time = datetime.now().strftime("%H:%M:%S")
        current_datetime = f"{current_date} {current_time}"

        # Split address into two parts
        address1, address2 = split_address(customer_data.get('address', ''))

        # Calculate totals from items
        total_amount = 0
        formatted_items = []

        if items:
            for item in items:
                item_total = float(item.get('total', 0))
                total_amount += item_total
                formatted_items.append({
                    'description': item.get('name', ''),
                    'hsnCode': item.get('hsn_code', ''),
                    'quantity': item.get('quantity', 1),
                    'unitPrice': f"₹{float(item.get('price', 0)):.2f}",
                    'total': f"₹{item_total:.2f}"
                })

        # Convert amount to words
        amount_words = convert_amount_to_words(total_amount)

        # Prepare context data for DocxTemplate
        context = {
            # Basic invoice info
            'date': current_date,
            'time': current_time,
            'datetime': current_datetime,
            'invoice_number': invoice_number,

            # Customer information
            'customerName': customer_data.get('name', ''),
            'customerParent': customer_data.get('parent_name', ''),  # You can add this field if needed
            'address1': address1,
            'address2': address2,
            'aadhar': customer_data.get('aadhaar_number', ''),
            'mobile': customer_data.get('mobile_number', ''),

            # Company information
            'company_name': 'Minato Enterprises',
            'company_address': 'G/67, DR. M. N. GHOSH ROAD RANIGANJ, WEST BENGAL-713347',
            'company_phone1': '9679697117',
            'company_phone2': '9333100233',
            'company_email': 'theminatoenterprise@gmail.com',
            'company_gstin': '19BQFPA3329A1ZF',

            # Invoice items (for single item invoices)
            'description': formatted_items[0]['description'] if formatted_items else '',
            'hsnCode': formatted_items[0]['hsnCode'] if formatted_items else '',
            'quantity': formatted_items[0]['quantity'] if formatted_items else '',
            'unitPrice': formatted_items[0]['unitPrice'] if formatted_items else '',
            'total': formatted_items[0]['total'] if formatted_items else '',

            # Totals
            'subTotal': f"₹{total_amount:.2f}",
            'totalAmount': f"₹{total_amount:.2f}",
            'amountWords': amount_words,

            # Additional fields
            'items': formatted_items,  # For templates that support multiple items
        }

        # Add any additional data
        if additional_data:
            context.update(additional_data)

        # Load and render template
        doc = DocxTemplate(template_file)
        doc.render(context)

        # Generate output filename
        safe_customer_name = re.sub(r'[^\w\s-]', '', customer_data.get('name', 'Customer')).strip()
        safe_customer_name = re.sub(r'[-\s]+', '_', safe_customer_name)
        output_filename = f"Invoice_{safe_customer_name}_{datetime.now().strftime('%Y%m%d')}_{invoice_number.replace('-', '_')}.docx"
        output_path = Path(INVOICES_FOLDER) / output_filename

        # Save the generated invoice
        doc.save(output_path)

        logger.info(f"Invoice generated successfully: {output_path}")

        return InvoiceGenerationResult(
            success=True,
            invoice_path=str(output_path),
            invoice_number=invoice_number,
            download_url=f"/download-invoice/{output_filename}",
            error=None
        )

    except Exception as e:
        logger.error(f"Error generating invoice: {str(e)}")
        return InvoiceGenerationResult(
            success=False,
            error=f"Failed to generate invoice: {str(e)}"
        )

def get_customer_suggestions(query: str) -> List[CustomerSuggestion]:
    """
    Get real-time customer suggestions based on partial name input

    Args:
        query (str): Partial customer name query

    Returns:
        List[CustomerSuggestion]: List of matching customer suggestions
    """
    base_path = Path(DATA_FOLDER_PATH)

    if not base_path.exists():
        logger.error(f"Data folder does not exist: {DATA_FOLDER_PATH}")
        return []

    suggestions = []
    search_query = query.lower().strip()

    # Return empty if query is too short
    if len(search_query) < 2:
        return []

    for item in base_path.iterdir():
        if not item.is_dir():
            continue

        # Parse folder name format: "001 Nandu Singh_687480874343"
        folder_parts = item.name.split('_')
        if len(folder_parts) >= 2:
            name_part = '_'.join(folder_parts[:-1])  # Everything except last part (Aadhaar)
            aadhaar_part = folder_parts[-1]  # Last part should be 12-digit Aadhaar

            # Validate Aadhaar number (should be 12 digits)
            if not (aadhaar_part.isdigit() and len(aadhaar_part) == 12):
                continue

            # Extract name after the number (e.g., "001 Nandu Singh" -> "Nandu Singh")
            name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
            if name_match:
                person_name = name_match.group(1)

                # Check if the search query matches the beginning of the person name (case-insensitive)
                if person_name.lower().startswith(search_query):
                    suggestions.append(CustomerSuggestion(
                        folder_name=item.name,
                        full_path=str(item),
                        person_name=person_name,
                        aadhaar_number=aadhaar_part,
                        display_text=f"{person_name} - {aadhaar_part}"
                    ))

    # Sort by person name and limit results
    suggestions.sort(key=lambda x: x.person_name)
    return suggestions[:10]  # Limit to 10 suggestions

def create_uid_filename(name: str) -> str:
    """
    Create UID filename from name (e.g., "Nandu Singh" -> "UID_NANDU_SINGH.pdf")

    Args:
        name (str): Person's name

    Returns:
        str: UID filename
    """
    uid_name = name.replace(' ', '_').upper()
    return f"UID_{uid_name}.pdf"

def find_uid_file(folder_path: Path, expected_filename: str) -> Optional[Path]:
    """
    Find UID file in the folder

    Args:
        folder_path (Path): Path to the folder
        expected_filename (str): Expected UID filename

    Returns:
        Path: Path to UID file if found, None otherwise
    """
    # First try exact match
    exact_path = folder_path / expected_filename
    if exact_path.exists():
        return exact_path

    # If exact match not found, look for any UID_*.pdf file
    uid_files = list(folder_path.glob("UID_*.pdf"))
    if uid_files:
        return uid_files[0]  # Return first UID file found

    return None

def extract_aadhaar_info(pdf_path: Path) -> ExtractionResult:
    """
    Extract Aadhaar information including mobile number using the agentic model

    Args:
        pdf_path (Path): Path to the PDF file

    Returns:
        ExtractionResult: Extraction results
    """
    try:
        logger.info(f"Processing PDF: {pdf_path}")

        response = agent.run(
            "Please extract the Aadhaar number, complete address, and mobile/phone number from this document. "
            "Look carefully for any 10-digit mobile numbers that typically start with 6, 7, 8, or 9. "
            "The mobile number might be listed as 'Mobile', 'Phone', or just appear as a 10-digit number.",
            files=[File(filepath=pdf_path)]
        )

        if response.content:
            return ExtractionResult(
                success=True,
                aadhar_number=response.content.aadharNumber,
                address=response.content.address,
                mobile_number=response.content.mobileNumber,
                error=None
            )
        else:
            return ExtractionResult(
                success=False,
                aadhar_number=None,
                address=None,
                mobile_number=None,
                error='No content in response'
            )

    except Exception as e:
        logger.error(f"Error processing {pdf_path}: {str(e)}")
        return ExtractionResult(
            success=False,
            aadhar_number=None,
            address=None,
            mobile_number=None,
            error=str(e)
        )

# API Routes

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page"""
    return FileResponse("static/index.html")

@app.post("/search", response_model=List[CustomerSuggestion])
async def search_customers(request: SearchRequest):
    """
    Get real-time customer suggestions based on partial name
    """
    if not request.customer_name.strip():
        return []

    if len(request.customer_name.strip()) < 2:
        return []

    suggestions = get_customer_suggestions(request.customer_name)

    logger.info(f"Found {len(suggestions)} suggestions for query: {request.customer_name}")

    return suggestions

@app.post("/process", response_model=ExtractionResult)
async def process_customer(request: ProcessRequest):
    """
    Process the selected customer folder to extract Aadhaar information including mobile number
    """
    folder_path = Path(request.folder_path)

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Customer folder not found")

    logger.info(f"Processing customer folder: {folder_path}")

    # Extract person name from folder name
    folder_parts = folder_path.name.split('_')
    if len(folder_parts) >= 2:
        name_part = '_'.join(folder_parts[:-1])
        name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
        person_name = name_match.group(1) if name_match else name_part
    else:
        person_name = folder_path.name

    # Create expected UID filename
    expected_uid_filename = create_uid_filename(person_name)
    logger.info(f"Looking for UID file: {expected_uid_filename}")

    # Find UID file
    uid_file_path = find_uid_file(folder_path, expected_uid_filename)

    if not uid_file_path:
        error_msg = f"UID file not found in customer folder: {folder_path}"
        logger.error(error_msg)
        raise HTTPException(status_code=404, detail=error_msg)

    logger.info(f"Found UID file: {uid_file_path}")

    # Extract information
    result = extract_aadhaar_info(uid_file_path)

    # Print results to terminal
    if result.success:
        print(f"\n{'='*60}")
        print(f"DOCUMENT EXTRACTION SUCCESSFUL")
        print(f"{'='*60}")
        print(f"Customer Folder: {folder_path.name}")
        print(f"Customer Name: {person_name}")
        print(f"UID File: {uid_file_path.name}")
        print(f"Aadhaar Number: {result.aadhar_number}")
        print(f"Address: {result.address}")
        print(f"Mobile Number: {result.mobile_number}")
        print(f"{'='*60}\n")
    else:
        print(f"\n{'='*60}")
        print(f"DOCUMENT EXTRACTION FAILED")
        print(f"{'='*60}")
        print(f"Customer Folder: {folder_path.name}")
        print(f"Customer Name: {person_name}")
        print(f"Error: {result.error}")
        print(f"{'='*60}\n")

    return result

@app.post("/generate-invoice", response_model=InvoiceGenerationResult)
async def generate_customer_invoice(request: InvoiceGenerationRequest):
    """
    Generate invoice for customer with extracted information including mobile number
    """
    try:
        customer_data = {
            'name': request.customer_name,
            'aadhaar_number': request.aadhaar_number,
            'address': request.address,
            'mobile_number': request.mobile_number
        }

        result = generate_invoice(
            customer_data=customer_data,
            items=request.items,
            additional_data=request.additional_data
        )

        # Print invoice generation result to terminal
        if result.success:
            print(f"\n{'='*60}")
            print(f"INVOICE GENERATED SUCCESSFULLY")
            print(f"{'='*60}")
            print(f"Customer: {request.customer_name}")
            print(f"Aadhaar: {request.aadhaar_number}")
            print(f"Mobile: {request.mobile_number}")
            print(f"Address: {request.address}")
            print(f"Invoice Number: {result.invoice_number}")
            print(f"File Path: {result.invoice_path}")
            print(f"Download URL: {result.download_url}")
            print(f"{'='*60}\n")
        else:
            print(f"\n{'='*60}")
            print(f"INVOICE GENERATION FAILED")
            print(f"{'='*60}")
            print(f"Customer: {request.customer_name}")
            print(f"Error: {result.error}")
            print(f"{'='*60}\n")

        return result

    except Exception as e:
        logger.error(f"Error in generate_customer_invoice: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice: {str(e)}")

@app.get("/download-invoice/{filename}")
async def download_invoice(filename: str):
    """
    Download generated invoice file
    """
    file_path = Path(INVOICES_FOLDER) / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Invoice file not found")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

@app.get("/template-status")
async def check_template_status():
    """Check if invoice template is available with enhanced debugging"""
    try:
        template_file = get_template_file()

        result = {
            "template_available": template_file is not None,
            "template_path": str(template_file) if template_file else None,
            "templates_folder": TEMPLATES_FOLDER,
            "template_type": "docx",
            "current_directory": str(Path.cwd()),
            "absolute_templates_path": str(Path.cwd() / TEMPLATES_FOLDER)
        }

        if template_file:
            try:
                # Verify the file is readable
                with open(template_file, 'rb') as f:
                    file_size = len(f.read())
                result["template_size_bytes"] = file_size
                result["template_readable"] = True
            except Exception as e:
                result["template_readable"] = False
                result["read_error"] = str(e)

        return result

    except Exception as e:
        logger.error(f"Error in check_template_status: {str(e)}")
        return {
            "template_available": False,
            "error": str(e),
            "templates_folder": TEMPLATES_FOLDER,
            "template_type": "docx"
        }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    template_file = get_template_file()

    return {
        "status": "healthy",
        "data_folder": DATA_FOLDER_PATH,
        "templates_folder": TEMPLATES_FOLDER,
        "invoices_folder": INVOICES_FOLDER,
        "template_available": template_file is not None,
        "template_type": "docx",
        "features": {
            "aadhaar_extraction": True,
            "address_extraction": True,
            "mobile_extraction": True,
            "invoice_generation": True,
            "real_time_search": True,
            "docx_templates": True
        }
    }

if __name__ == "__main__":
    import uvicorn

    # Create static directory if it doesn't exist
    Path("static").mkdir(exist_ok=True)

    print(f"Starting Minato Enterprises Document Processor...")
    print(f"Data folder: {DATA_FOLDER_PATH}")
    print(f"Templates folder: {TEMPLATES_FOLDER}")
    print(f"Invoices folder: {INVOICES_FOLDER}")
    print(f"Template type: Word Document (.docx)")
    print(f"Features enabled:")
    print(f"  - Aadhaar number extraction")
    print(f"  - Address extraction")
    print(f"  - Mobile number extraction")
    print(f"  - Invoice generation with DocxTemplate")
    print(f"  - Real-time customer search")
    print(f"Server will be available at: http://localhost:8000")

    uvicorn.run(app, host="0.0.0.0", port=8000)