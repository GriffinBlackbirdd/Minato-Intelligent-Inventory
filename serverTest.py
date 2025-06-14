from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
from typing import List, Optional
import re
import logging
from datetime import datetime
from agno.agent import Agent
from agno.models.google import Gemini
from agno.media import File

# Import our new invoice generator
from invoiceGen import generate_invoice_with_data

# Configuration
DATA_FOLDER_PATH = "D:\\minato\\Data"  # Hardcoded path to Data folder
INVOICES_FOLDER = "generated_invoices"  # Folder for generated invoices
GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"  # Your API key

app = FastAPI(title="Minato Enterprises - Document Processor", version="1.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create necessary directories
Path(INVOICES_FOLDER).mkdir(exist_ok=True)

# Pydantic models
class AadhaarExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract only the 12-digit aadhar number from the given pdf")
    address: str = Field(..., description="Extract only the residential address in simple format. Do not include VTC, PO, Sub District, District details. Just extract the house/building name, road/street name, area name, city and state. Do not include the aadhar number in address.")
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

    # No need for folder_path here - we'll use the already extracted data

class InvoiceGenerationResult(BaseModel):
    success: bool
    invoice_path: Optional[str] = None
    invoice_number: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None

# Initialize the agent for extraction (step 2)
agent = Agent(
    model=Gemini(id="gemini-1.5-flash", api_key=GOOGLE_API_KEY),
    description="You extract clean, simple Aadhaar number, phone number and residential address from PDF documents. For address, extract only basic residential details like house/building name, road/street, area, city, and state. Do not include administrative details like VTC, PO, Sub District, District, PIN codes, or the Aadhaar number itself.",
    response_model=AadhaarExtraction,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_customer_suggestions(query: str) -> List[CustomerSuggestion]:
    """
    STEP 1: Get real-time customer suggestions based on partial name input

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
    STEP 2: Extract Aadhaar information using the agentic model

    Args:
        pdf_path (Path): Path to the PDF file

    Returns:
        ExtractionResult: Extraction results
    """
    try:
        logger.info(f"Processing PDF: {pdf_path}")

        response = agent.run(
            "Please extract the 12-digit Aadhaar number and clean residential address. For the address, only include house/building name, road/street name, area, city and state. Do not include VTC, PO, Sub District, District, PIN code details or the Aadhaar number in the address field.",
            files=[File(filepath=pdf_path)]
        )

        if response.content:
            return ExtractionResult(
                success=True,
                aadhar_number=response.content.aadharNumber,
                address=response.content.address,
                error=None
            )
        else:
            return ExtractionResult(
                success=False,
                aadhar_number=None,
                address=None,
                error='No content in response'
            )

    except Exception as e:
        logger.error(f"Error processing {pdf_path}: {str(e)}")
        return ExtractionResult(
            success=False,
            aadhar_number=None,
            address=None,
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
    STEP 1: Get real-time customer suggestions based on partial name
    Example: User types "Nan" → Shows all customers starting with "Nan" with their Aadhaar numbers
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
    STEP 2: Process the selected customer folder to extract Aadhaar information from their UID file
    This happens when user selects a customer from the suggestions
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

    # Extract information from the UID file
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
    STEP 4: Generate invoice using the already extracted and reviewed customer information
    This uses the data that was extracted in step 2 and possibly edited in step 3
    """
    try:
        logger.info(f"Generating invoice for customer: {request.customer_name}")

        # Prepare customer data from the request (already extracted and possibly edited)
        customer_data = {
            'name': request.customer_name,
            'aadhaar_number': request.aadhaar_number,
            'address': request.address
        }

        # Use the invoice generator with the already extracted data
        result = generate_invoice_with_data(customer_data)

        if result['success']:
            # Convert the result to match our response model
            invoice_result = InvoiceGenerationResult(
                success=True,
                invoice_path=result['invoice_path'],
                invoice_number=result['invoice_number'],
                download_url=result['download_url'],
                error=None
            )

            # Print invoice generation result to terminal
            print(f"\n{'='*60}")
            print(f"WORD INVOICE GENERATED SUCCESSFULLY")
            print(f"{'='*60}")
            print(f"Customer: {request.customer_name}")
            print(f"Aadhaar: {request.aadhaar_number}")
            print(f"Address: {request.address}")
            print(f"Invoice Number: {result['invoice_number']}")
            print(f"File Path: {result['invoice_path']}")
            print(f"Download URL: {result['download_url']}")
            print(f"{'='*60}\n")

            return invoice_result
        else:
            print(f"\n{'='*60}")
            print(f"WORD INVOICE GENERATION FAILED")
            print(f"{'='*60}")
            print(f"Customer: {request.customer_name}")
            print(f"Error: {result['error']}")
            print(f"{'='*60}\n")

            raise HTTPException(status_code=500, detail=result['error'])

    except Exception as e:
        logger.error(f"Error in generate_customer_invoice: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice: {str(e)}")

@app.get("/download-invoice-docx/{filename}")
async def download_invoice_docx(filename: str):
    """
    Download generated Word invoice file
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
    """
    Check if invoice template is available (now checks for Word template)
    """
    template_path = Path("templates/template.docx")

    return {
        "template_available": template_path.exists(),
        "template_path": str(template_path) if template_path.exists() else None,
        "template_type": "Word Document (.docx)",
        "templates_folder": "templates"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    template_path = Path("templates/template.docx")

    try:
        # Test if invoice generator can be initialized
        from invoiceGen import get_invoice_generator
        get_invoice_generator()
        invoice_gen_status = "OK"
    except Exception as e:
        invoice_gen_status = f"ERROR: {str(e)}"

    return {
        "status": "healthy",
        "data_folder": DATA_FOLDER_PATH,
        "invoices_folder": INVOICES_FOLDER,
        "word_template_available": template_path.exists(),
        "invoice_generator_status": invoice_gen_status
    }

if __name__ == "__main__":
    import uvicorn

    # Create static directory if it doesn't exist
    Path("static").mkdir(exist_ok=True)

    print(f"Starting Minato Enterprises Document Processor...")
    print(f"Data folder: {DATA_FOLDER_PATH}")
    print(f"Invoices folder: {INVOICES_FOLDER}")
    print(f"Word template: template.docx")
    print(f"Server will be available at: http://localhost:8000")

    uvicorn.run(app, host="0.0.0.0", port=8000)