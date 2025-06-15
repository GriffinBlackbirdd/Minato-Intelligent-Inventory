from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, Field
from pathlib import Path
from typing import List, Optional, Dict, Any
import re
import logging
from datetime import datetime
import json
import pandas as pd
from docxtpl import DocxTemplate
from agno.agent import Agent
from agno.models.google import Gemini
from agno.media import File

# Configuration
DATA_FOLDER_PATH = "D:\\minato\\Data"  # Hardcoded path to Data folder
TEMPLATES_FOLDER = "templates"  # Folder for invoice templates
INVOICES_FOLDER = "generated_invoices"  # Folder for generated invoices
GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"  # Your API key

app = FastAPI(title="Minato Enterprises - Document Processor & Billing System", version="2.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create necessary directories
Path(TEMPLATES_FOLDER).mkdir(exist_ok=True)
Path(INVOICES_FOLDER).mkdir(exist_ok=True)

# Global data storage for Excel files
chassis_data = []
battery_data = []

def load_excel_data():
    """Load chassis and battery data from Excel files"""
    global chassis_data, battery_data

    try:
        # Load chassis data
        chassis_df = pd.read_excel("chassis.xlsx")
        chassis_data = chassis_df.to_dict('records')
        logger.info(f"Loaded {len(chassis_data)} chassis records")

        # Load battery data
        battery_df = pd.read_excel("battery.xlsx")
        battery_data = battery_df.to_dict('records')
        logger.info(f"Loaded {len(battery_data)} battery records")

    except Exception as e:
        logger.error(f"Error loading Excel data: {e}")
        chassis_data = []
        battery_data = []

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
    display_text: str

class ProcessRequest(BaseModel):
    folder_path: str

class ExtractionResult(BaseModel):
    success: bool
    aadhar_number: Optional[str] = None
    address: Optional[str] = None
    mobile_number: Optional[str] = None
    error: Optional[str] = None

# Updated models for real-time filtering
class ChassisFilterRequest(BaseModel):
    filter_text: str  # Can be empty or partial digits

class BatteryFilterRequest(BaseModel):
    filter_text: str  # Can be empty or partial digits

class ChassisResult(BaseModel):
    chassis_number: str
    motor_number: str
    controller_number: str
    make_model: str
    color: str
    display_text: str
    last_four: str

class BatteryResult(BaseModel):
    bat_serial_number: str
    model: str
    make: str
    ampere: str
    warranty: str
    display_text: str
    last_four: str

# Updated billing data model with new fields
class BillingData(BaseModel):
    customer_name: str
    aadhaar_number: str
    address: str
    mobile_number: str
    chassis_number: Optional[str] = None
    selected_batteries: List[str] = []
    hsn_code: str
    finance_firm: Optional[str] = None  # New field for finance firm
    price: float = 0.0  # New field for price input
    apply_igst: bool = False  # New field for IGST checkbox
    additional_notes: Optional[str] = None

class BillGenerationResult(BaseModel):
    success: bool
    bill_path: Optional[str] = None
    bill_number: Optional[str] = None
    invoice_number: Optional[str] = None  # New field for ME/GST format
    download_url: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None
    round_off: Optional[float] = None
    total_amount: Optional[float] = None
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

# Load Excel data on startup
load_excel_data()

# Invoice counter for unique invoice numbers (ME/GST format)
invoice_counter_file = Path("invoice_counter.json")

def get_next_invoice_number() -> str:
    """Generate the next invoice number in format ME/GST/25-26/045"""
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

        # Get current financial year (April to March)
        current_date = datetime.now()
        if current_date.month >= 4:  # April onwards = current year to next year
            fy_start = current_date.year % 100
            fy_end = (current_date.year + 1) % 100
        else:  # Jan-March = previous year to current year
            fy_start = (current_date.year - 1) % 100
            fy_end = current_date.year % 100

        # Format: ME/GST/25-26/045
        return f"ME/GST/{fy_start:02d}-{fy_end:02d}/{counter:03d}"

    except Exception as e:
        logger.error(f"Error generating invoice number: {e}")
        # Fallback to timestamp-based number
        return f"ME/GST/25-26/{datetime.now().strftime('%H%M%S')}"

def get_template_file() -> Optional[Path]:
    """Find the bill template file"""
    current_dir = Path.cwd()
    template_folder = current_dir / TEMPLATES_FOLDER
    template_path = template_folder / "template.docx"

    logger.info(f"Looking for template file at: {template_path}")

    if template_path.exists():
        logger.info(f"Found template file: {template_path}")
        return template_path

    # Fallback: look for any .docx file in templates folder
    try:
        docx_files = list(template_folder.glob("*.docx"))
        if docx_files:
            logger.info(f"Using fallback template: {docx_files[0]}")
            return docx_files[0]
    except Exception as e:
        logger.error(f"Error searching for .docx files: {e}")

    logger.error("No template file found")
    return None

def split_address(address: str) -> tuple:
    """Split address into two parts for template"""
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

def format_battery_description(batteries: List[dict]) -> str:
    """Format battery information for bill description"""
    if not batteries:
        return ""

    battery_lines = []
    for i, battery in enumerate(batteries, 1):
        # Extract last 4 digits for display
        serial = battery.get('bat_serial_number', '')
        last_four = serial[-4:] if len(serial) >= 4 else serial

        # Format: 1)A1B5H725635 1B54
        battery_line = f"{i}){serial} {last_four}"
        battery_lines.append(battery_line)

    return " ".join(battery_lines)

def generate_bill_description(chassis_data: dict, batteries: List[dict]) -> str:
    """Generate the bill description based on chassis and battery data"""
    description_parts = []

    # Add chassis information
    if chassis_data:
        chassis_part = f"E-RICKSHAW {chassis_data.get('make_model', '').upper()} "
        chassis_part += f"CHASSIS NO-{chassis_data.get('chassis_number', '')} "
        chassis_part += f"MOTOR NO-{chassis_data.get('motor_number', '')}"
        description_parts.append(chassis_part)

    # Add battery information
    if batteries:
        battery_part = f"WITH SF SONIC 12 MONTHS BATTERY "
        battery_desc = format_battery_description(batteries)
        battery_part += battery_desc
        description_parts.append(battery_part)

    return " ".join(description_parts)

def calculate_taxes(price: float, apply_igst: bool = False) -> dict:
    """Calculate CGST, SGST, IGST, round off and total amount"""
    if apply_igst:
        # IGST @ 5%
        igst = round(price * 0.05, 2)
        cgst = 0.0
        sgst = 0.0
    else:
        # CGST @ 2.5% and SGST @ 2.5%
        cgst = round(price * 0.025, 2)
        sgst = round(price * 0.025, 2)
        igst = 0.0

    # Calculate subtotal with taxes
    subtotal = price + cgst + sgst + igst

    # Calculate round off to nearest rupee
    total_rounded = round(subtotal)
    round_off = round(total_rounded - subtotal, 2)

    return {
        'cgst': cgst,
        'sgst': sgst,
        'igst': igst,
        'subtotal': subtotal,
        'round_off': round_off,
        'total_amount': total_rounded
    }

def number_to_words(number: float) -> str:
    """Convert number to words for amount display"""
    # Simple implementation for Indian number system
    try:
        number = int(number)

        if number == 0:
            return "Zero"

        # Basic conversion (you can enhance this for better coverage)
        ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                "Seventeen", "Eighteen", "Nineteen"]

        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def convert_hundreds(n):
            result = ""
            if n >= 100:
                result += ones[n // 100] + " Hundred "
                n %= 100
            if n >= 20:
                result += tens[n // 10] + " "
                n %= 10
            if n > 0:
                result += ones[n] + " "
            return result

        if number < 1000:
            return convert_hundreds(number).strip()
        elif number < 100000:
            thousands = number // 1000
            remainder = number % 1000
            result = convert_hundreds(thousands) + "Thousand "
            if remainder > 0:
                result += convert_hundreds(remainder)
            return result.strip()
        elif number < 10000000:
            lakhs = number // 100000
            remainder = number % 100000
            result = convert_hundreds(lakhs) + "Lakh "
            if remainder > 0:
                if remainder >= 1000:
                    result += convert_hundreds(remainder // 1000) + "Thousand "
                    remainder %= 1000
                if remainder > 0:
                    result += convert_hundreds(remainder)
            return result.strip()
        else:
            # For larger numbers, simplified approach
            return f"{number:,}"

    except:
        return str(number)

# Updated real-time filtering functions
def filter_chassis(filter_text: str) -> List[ChassisResult]:
    """Filter chassis in real-time based on text input"""
    results = []

    # If filter_text is empty, return all chassis (limit to reasonable number)
    if not filter_text.strip():
        limited_chassis = chassis_data[:50]  # Show first 50 for performance
        for chassis in limited_chassis:
            chassis_number = str(chassis.get('chassis_number', ''))
            last_four = chassis_number[-4:] if len(chassis_number) >= 4 else chassis_number

            result = ChassisResult(
                chassis_number=chassis_number,
                motor_number=str(chassis.get('motor_number', '')),
                controller_number=str(chassis.get('controller_number', '')),
                make_model=str(chassis.get('make_model', '')),
                color=str(chassis.get('color', '')),
                display_text=f"{chassis.get('make_model', '')} - {chassis_number} ({last_four})",
                last_four=last_four
            )
            results.append(result)
        return results

    # Filter based on text - can match anywhere in chassis number or make_model
    filter_lower = filter_text.lower()

    for chassis in chassis_data:
        chassis_number = str(chassis.get('chassis_number', ''))
        make_model = str(chassis.get('make_model', ''))

        # Check if filter matches chassis number or make_model
        if (filter_lower in chassis_number.lower() or
            filter_lower in make_model.lower() or
            chassis_number.endswith(filter_text)):

            last_four = chassis_number[-4:] if len(chassis_number) >= 4 else chassis_number

            result = ChassisResult(
                chassis_number=chassis_number,
                motor_number=str(chassis.get('motor_number', '')),
                controller_number=str(chassis.get('controller_number', '')),
                make_model=make_model,
                color=str(chassis.get('color', '')),
                display_text=f"{make_model} - {chassis_number} ({last_four})",
                last_four=last_four
            )
            results.append(result)

    # Sort by relevance (exact matches first, then partial matches)
    def sort_key(item):
        chassis_num = item.chassis_number
        if chassis_num.endswith(filter_text):
            return (0, chassis_num)  # Exact suffix match first
        elif filter_text in chassis_num:
            return (1, chassis_num)  # Contains filter
        else:
            return (2, chassis_num)  # Model name match

    results.sort(key=sort_key)
    return results[:20]  # Limit to 20 results for performance

def filter_batteries(filter_text: str) -> List[BatteryResult]:
    """Filter batteries in real-time based on text input"""
    results = []

    # If filter_text is empty, return all batteries (limit to reasonable number)
    if not filter_text.strip():
        limited_batteries = battery_data[:50]  # Show first 50 for performance
        for battery in limited_batteries:
            serial_number = str(battery.get('bat_serial_number', ''))
            last_four = serial_number[-4:] if len(serial_number) >= 4 else serial_number

            result = BatteryResult(
                bat_serial_number=serial_number,
                model=str(battery.get('model', '')),
                make=str(battery.get('make', '')),
                ampere=str(battery.get('ampere', '')),
                warranty=str(battery.get('warranty', '')),
                display_text=f"{battery.get('make', '')} {battery.get('model', '')} - {serial_number} ({last_four})",
                last_four=last_four
            )
            results.append(result)
        return results

    # Filter based on text - can match anywhere in serial number or make/model
    filter_lower = filter_text.lower()

    for battery in battery_data:
        serial_number = str(battery.get('bat_serial_number', ''))
        make = str(battery.get('make', ''))
        model = str(battery.get('model', ''))

        # Check if filter matches serial number, make, or model
        if (filter_lower in serial_number.lower() or
            filter_lower in make.lower() or
            filter_lower in model.lower() or
            serial_number.endswith(filter_text)):

            last_four = serial_number[-4:] if len(serial_number) >= 4 else serial_number

            result = BatteryResult(
                bat_serial_number=serial_number,
                model=model,
                make=make,
                ampere=str(battery.get('ampere', '')),
                warranty=str(battery.get('warranty', '')),
                display_text=f"{make} {model} - {serial_number} ({last_four})",
                last_four=last_four
            )
            results.append(result)

    # Sort by relevance (exact matches first, then partial matches)
    def sort_key(item):
        serial_num = item.bat_serial_number
        if serial_num.endswith(filter_text):
            return (0, serial_num)  # Exact suffix match first
        elif filter_text in serial_num:
            return (1, serial_num)  # Contains filter
        else:
            return (2, serial_num)  # Make/model match

    results.sort(key=sort_key)
    return results[:20]  # Limit to 20 results for performance

def get_chassis_by_number(chassis_number: str) -> Optional[dict]:
    """Get chassis data by chassis number"""
    for chassis in chassis_data:
        if str(chassis.get('chassis_number', '')) == chassis_number:
            return chassis
    return None

def get_batteries_by_numbers(battery_numbers: List[str]) -> List[dict]:
    """Get battery data by battery serial numbers"""
    selected_batteries = []
    for battery_number in battery_numbers:
        for battery in battery_data:
            if str(battery.get('bat_serial_number', '')) == battery_number:
                selected_batteries.append(battery)
                break
    return selected_batteries

def generate_bill(billing_data: BillingData) -> BillGenerationResult:
    """Generate bill using DocxTemplate and billing data with tax calculations"""
    try:
        # Find template file
        template_file = get_template_file()
        if not template_file:
            return BillGenerationResult(
                success=False,
                error="Bill template not found. Please add 'template.docx' to the 'templates' folder."
            )

        logger.info(f"Using template: {template_file}")

        # Generate invoice number and current date
        invoice_number = get_next_invoice_number()
        current_date = datetime.now().strftime("%d/%m/%Y")

        # Split address into two parts
        address1, address2 = split_address(billing_data.address)

        # Get chassis and battery data
        chassis_info = None
        if billing_data.chassis_number:
            chassis_info = get_chassis_by_number(billing_data.chassis_number)

        selected_batteries = get_batteries_by_numbers(billing_data.selected_batteries)

        # Generate description
        description = generate_bill_description(chassis_info, selected_batteries)

        # Calculate taxes
        tax_calculations = calculate_taxes(billing_data.price, billing_data.apply_igst)

        # Convert amount to words
        amount_words = number_to_words(tax_calculations['total_amount'])

        # Prepare context data for DocxTemplate
        context = {
            # Basic bill info
            'date': current_date,
            'invoice_number': invoice_number,

            # Customer information
            'customerName': billing_data.customer_name,
            'customerParent': billing_data.finance_firm or '',  # Finance firm as parent
            'address1': address1,
            'address2': address2,
            'aadhar': billing_data.aadhaar_number,
            'mobile': billing_data.mobile_number,

            # Company information
            'company_name': 'Minato Enterprises',
            'company_address': 'G/67, DR. M. N. GHOSH ROAD RANIGANJ, WEST BENGAL-713347',
            'company_phone1': '9679697117',
            'company_phone2': '9333100233',
            'company_email': 'theminatoenterprise@gmail.com',
            'company_gstin': '19BQFPA3329A1ZF',

            # Bill items
            'description': description,
            'hsnCode': billing_data.hsn_code,
            'quantity': '1',
            'unitPrice': f"{billing_data.price:.2f}",
            'total': f"{billing_data.price:.2f}",

            # Tax calculations
            'subTotal': f"{billing_data.price:.2f}",
            'cgst': f"{tax_calculations['cgst']:.2f}",
            'sgst': f"{tax_calculations['sgst']:.2f}",
            'igst': f"{tax_calculations['igst']:.2f}",
            'roundOff': f"{tax_calculations['round_off']:.2f}",
            'totalAmount': f"{tax_calculations['total_amount']:.2f}",
            'amountWords': amount_words,

            # Additional data for template compatibility
            'c': billing_data.customer_name,
            's': billing_data.finance_firm or '',
            'addrsess1': address1,
            'addrsess2': address2,
            'aadshar': billing_data.aadhaar_number,
            'mobsile': billing_data.mobile_number,
            'sdsaf': billing_data.customer_name
        }

        # Load and render template
        doc = DocxTemplate(template_file)
        doc.render(context)

        # Generate output filename
        safe_customer_name = re.sub(r'[^\w\s-]', '', billing_data.customer_name).strip()
        safe_customer_name = re.sub(r'[-\s]+', '_', safe_customer_name)
        output_filename = f"Bill_{safe_customer_name}_{datetime.now().strftime('%Y%m%d')}_{invoice_number.replace('/', '_').replace('-', '_')}.docx"
        output_path = Path(INVOICES_FOLDER) / output_filename

        # Save the generated bill
        doc.save(output_path)

        logger.info(f"Bill generated successfully: {output_path}")

        return BillGenerationResult(
            success=True,
            bill_path=str(output_path),
            bill_number=invoice_number,  # Keep for backward compatibility
            invoice_number=invoice_number,
            download_url=f"/download-bill/{output_filename}",
            description=description,
            price=billing_data.price,
            cgst=tax_calculations['cgst'],
            sgst=tax_calculations['sgst'],
            igst=tax_calculations['igst'],
            round_off=tax_calculations['round_off'],
            total_amount=tax_calculations['total_amount'],
            error=None
        )

    except Exception as e:
        logger.error(f"Error generating bill: {str(e)}")
        return BillGenerationResult(
            success=False,
            error=f"Failed to generate bill: {str(e)}"
        )

# Existing API endpoints for customer search and processing
def get_customer_suggestions(query: str) -> List[CustomerSuggestion]:
    """Get real-time customer suggestions based on partial name input"""
    base_path = Path(DATA_FOLDER_PATH)

    if not base_path.exists():
        logger.error(f"Data folder does not exist: {DATA_FOLDER_PATH}")
        return []

    suggestions = []
    search_query = query.lower().strip()

    if len(search_query) < 2:
        return []

    for item in base_path.iterdir():
        if not item.is_dir():
            continue

        folder_parts = item.name.split('_')
        if len(folder_parts) >= 2:
            name_part = '_'.join(folder_parts[:-1])
            aadhaar_part = folder_parts[-1]

            if not (aadhaar_part.isdigit() and len(aadhaar_part) == 12):
                continue

            name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
            if name_match:
                person_name = name_match.group(1)

                if person_name.lower().startswith(search_query):
                    suggestions.append(CustomerSuggestion(
                        folder_name=item.name,
                        full_path=str(item),
                        person_name=person_name,
                        aadhaar_number=aadhaar_part,
                        display_text=f"{person_name} - {aadhaar_part}"
                    ))

    suggestions.sort(key=lambda x: x.person_name)
    return suggestions[:10]

def create_uid_filename(name: str) -> str:
    """Create UID filename from name"""
    uid_name = name.replace(' ', '_').upper()
    return f"UID_{uid_name}.pdf"

def find_uid_file(folder_path: Path, expected_filename: str) -> Optional[Path]:
    """Find UID file in the folder"""
    exact_path = folder_path / expected_filename
    if exact_path.exists():
        return exact_path

    uid_files = list(folder_path.glob("UID_*.pdf"))
    if uid_files:
        return uid_files[0]

    return None

def extract_aadhaar_info(pdf_path: Path) -> ExtractionResult:
    """Extract Aadhaar information including mobile number using the agentic model"""
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
    """Get real-time customer suggestions based on partial name"""
    if not request.customer_name.strip():
        return []

    if len(request.customer_name.strip()) < 2:
        return []

    suggestions = get_customer_suggestions(request.customer_name)
    logger.info(f"Found {len(suggestions)} suggestions for query: {request.customer_name}")
    return suggestions

@app.post("/process", response_model=ExtractionResult)
async def process_customer(request: ProcessRequest):
    """Process the selected customer folder to extract Aadhaar information"""
    folder_path = Path(request.folder_path)

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Customer folder not found")

    logger.info(f"Processing customer folder: {folder_path}")

    folder_parts = folder_path.name.split('_')
    if len(folder_parts) >= 2:
        name_part = '_'.join(folder_parts[:-1])
        name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
        person_name = name_match.group(1) if name_match else name_part
    else:
        person_name = folder_path.name

    expected_uid_filename = create_uid_filename(person_name)
    logger.info(f"Looking for UID file: {expected_uid_filename}")

    uid_file_path = find_uid_file(folder_path, expected_uid_filename)

    if not uid_file_path:
        error_msg = f"UID file not found in customer folder: {folder_path}"
        logger.error(error_msg)
        raise HTTPException(status_code=404, detail=error_msg)

    logger.info(f"Found UID file: {uid_file_path}")

    result = extract_aadhaar_info(uid_file_path)

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

# New Real-time Filtering API Routes
@app.post("/filter-chassis", response_model=List[ChassisResult])
async def filter_chassis_realtime(request: ChassisFilterRequest):
    """Real-time chassis filtering based on input text"""
    results = filter_chassis(request.filter_text)
    logger.info(f"Filtered {len(results)} chassis for '{request.filter_text}'")
    return results

@app.post("/filter-batteries", response_model=List[BatteryResult])
async def filter_batteries_realtime(request: BatteryFilterRequest):
    """Real-time battery filtering based on input text"""
    results = filter_batteries(request.filter_text)
    logger.info(f"Filtered {len(results)} batteries for '{request.filter_text}'")
    return results

@app.get("/hsn-codes")
async def get_hsn_codes():
    """Get available HSN codes"""
    return {
        "hsn_codes": [
            {"code": "8703", "description": "Motor cars and other motor vehicles"},
            {"code": "8504", "description": "Electrical transformers, static converters"},
            {"code": "8507", "description": "Electric accumulators"}
        ]
    }

@app.post("/generate-bill", response_model=BillGenerationResult)
async def generate_customer_bill(billing_data: BillingData):
    """Generate bill for customer with selected chassis and batteries"""
    try:
        result = generate_bill(billing_data)

        if result.success:
            print(f"\n{'='*60}")
            print(f"BILL GENERATED SUCCESSFULLY")
            print(f"{'='*60}")
            print(f"Customer: {billing_data.customer_name}")
            print(f"Aadhaar: {billing_data.aadhaar_number}")
            print(f"Mobile: {billing_data.mobile_number}")
            print(f"Finance Firm: {billing_data.finance_firm or 'N/A'}")
            print(f"Chassis: {billing_data.chassis_number}")
            print(f"Batteries: {', '.join(billing_data.selected_batteries)}")
            print(f"HSN Code: {billing_data.hsn_code}")
            print(f"Price: ₹{billing_data.price:.2f}")
            print(f"CGST: ₹{result.cgst:.2f}")
            print(f"SGST: ₹{result.sgst:.2f}")
            print(f"IGST: ₹{result.igst:.2f}")
            print(f"Round Off: ₹{result.round_off:.2f}")
            print(f"Total Amount: ₹{result.total_amount:.2f}")
            print(f"Invoice Number: {result.invoice_number}")
            print(f"Description: {result.description}")
            print(f"File Path: {result.bill_path}")
            print(f"Download URL: {result.download_url}")
            print(f"{'='*60}\n")
        else:
            print(f"\n{'='*60}")
            print(f"BILL GENERATION FAILED")
            print(f"{'='*60}")
            print(f"Customer: {billing_data.customer_name}")
            print(f"Error: {result.error}")
            print(f"{'='*60}\n")

        return result

    except Exception as e:
        logger.error(f"Error in generate_customer_bill: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate bill: {str(e)}")

@app.get("/download-bill/{filename}")
async def download_bill(filename: str):
    """Download generated bill file"""
    file_path = Path(INVOICES_FOLDER) / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Bill file not found")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

@app.get("/data-status")
async def check_data_status():
    """Check if chassis and battery data is loaded"""
    return {
        "chassis_loaded": len(chassis_data) > 0,
        "chassis_count": len(chassis_data),
        "battery_loaded": len(battery_data) > 0,
        "battery_count": len(battery_data),
        "sample_chassis": chassis_data[:2] if chassis_data else [],
        "sample_batteries": battery_data[:2] if battery_data else []
    }

@app.get("/template-status")
async def check_template_status():
    """Check if bill template is available"""
    template_file = get_template_file()

    result = {
        "template_available": template_file is not None,
        "template_path": str(template_file) if template_file else None,
        "templates_folder": TEMPLATES_FOLDER,
        "template_type": "docx"
    }

    return result

@app.post("/calculate-taxes")
async def calculate_taxes_api(price: float, apply_igst: bool = False):
    """Calculate taxes for given price and IGST preference"""
    try:
        tax_calculations = calculate_taxes(price, apply_igst)
        amount_words = number_to_words(tax_calculations['total_amount'])

        return {
            "success": True,
            "price": price,
            "cgst": tax_calculations['cgst'],
            "sgst": tax_calculations['sgst'],
            "igst": tax_calculations['igst'],
            "subtotal": tax_calculations['subtotal'],
            "round_off": tax_calculations['round_off'],
            "total_amount": tax_calculations['total_amount'],
            "amount_words": amount_words,
            "apply_igst": apply_igst
        }
    except Exception as e:
        logger.error(f"Error calculating taxes: {str(e)}")
        return {
            "success": False,
            "error": str(e)
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
        "chassis_data_loaded": len(chassis_data) > 0,
        "battery_data_loaded": len(battery_data) > 0,
        "features": {
            "aadhaar_extraction": True,
            "address_extraction": True,
            "mobile_extraction": True,
            "billing_system": True,
            "realtime_chassis_filter": True,
            "realtime_battery_filter": True,
            "hsn_codes": True,
            "bill_generation": True,
            "real_time_search": True,
            "docx_templates": True,
            "finance_firm_support": True,
            "price_input": True,
            "tax_calculations": True,
            "igst_checkbox": True,
            "invoice_numbering": True,
            "amount_to_words": True
        }
    }

if __name__ == "__main__":
    import uvicorn

    # Create static directory if it doesn't exist
    Path("static").mkdir(exist_ok=True)

    print(f"Starting Minato Enterprises Document Processor & Billing System...")
    print(f"Data folder: {DATA_FOLDER_PATH}")
    print(f"Templates folder: {TEMPLATES_FOLDER}")
    print(f"Bills folder: {INVOICES_FOLDER}")
    print(f"Template type: Word Document (.docx)")
    print(f"Features enabled:")
    print(f"  - Aadhaar number extraction")
    print(f"  - Address extraction")
    print(f"  - Mobile number extraction")
    print(f"  - Finance firm support")
    print(f"  - Price input with tax calculations")
    print(f"  - CGST/SGST/IGST calculations")
    print(f"  - IGST checkbox support")
    print(f"  - Invoice numbering (ME/GST/25-26/045 format)")
    print(f"  - Amount to words conversion")
    print(f"  - Real-time chassis filtering")
    print(f"  - Real-time battery filtering")
    print(f"  - HSN code selection")
    print(f"  - Bill generation with DocxTemplate")
    print(f"  - Real-time customer search")
    print(f"Server will be available at: http://localhost:8000")

    uvicorn.run(app, host="0.0.0.0", port=8000)