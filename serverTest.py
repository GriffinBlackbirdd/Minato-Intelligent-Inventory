from fastapi import FastAPI, HTTPException, Query
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
from docx2pdf import convert
import tempfile
import os
from datetime import timedelta
from agno.media import Image
from fastapi import FastAPI, HTTPException, Query, File, UploadFile, Form  # Add File, UploadFile, Form
import shutil
from fastapi import FastAPI, HTTPException, Query, File, UploadFile, Form
from fastapi.responses import JSONResponse
import shutil
from pathlib import Path
from agno.media import Image
import os
import glob
import uuid
import PIL

UPLOADED_IMAGES_FOLDER = "uploaded_images"  # After existing folders
Path(UPLOADED_IMAGES_FOLDER).mkdir(exist_ok=True)  # After existing mkdir calls
# Configuration
DATA_FOLDER_PATH = "D:\\minato\\Data"
TEMPLATES_FOLDER = "templates"
INVOICES_FOLDER = "generated_invoices"
GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"

app = FastAPI(title="Minato Enterprises - Document Processor & Billing System", version="2.0.0")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Create necessary directories
Path(TEMPLATES_FOLDER).mkdir(exist_ok=True)
Path(INVOICES_FOLDER).mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global data storage for Excel files
chassis_data = []
battery_data = []
sales_data = []

analytics_cache = {
    'last_updated': None,
    'stats': {},
    'charts_data': {}
}

def load_excel_data():
    """Load chassis, battery, and sales data from Excel files"""
    global chassis_data, battery_data, sales_data
    try:
        # Load chassis data
        chassis_df = pd.read_excel("chassis.xlsx")
        chassis_data = chassis_df.to_dict('records')
        logger.info(f"Loaded {len(chassis_data)} chassis records")

        # Load battery data
        battery_df = pd.read_excel("battery.xlsx")
        battery_data = battery_df.to_dict('records')
        logger.info(f"Loaded {len(battery_data)} battery records")

        # Load sales data
        try:
            sales_df = pd.read_excel("sales.xlsx")
            sales_data = sales_df.to_dict('records')
            logger.info(f"Loaded {len(sales_data)} sales records")
        except FileNotFoundError:
            logger.info("sales.xlsx not found, will be created when first sale is made")
            sales_data = []

    except Exception as e:
        logger.error(f"Error loading Excel data: {e}")
        chassis_data = []
        battery_data = []
        sales_data = []

def save_sale_to_excel(sale_data: Dict[str, Any]):
    """Save sale details to sales.xlsx file"""
    try:
        sales_file = Path("sales.xlsx")

        # Read existing sales data
        if sales_file.exists():
            try:
                sales_df = pd.read_excel("sales.xlsx")
            except Exception as e:
                logger.error(f"Error reading sales.xlsx: {e}")
                # Create new file if corrupted
                create_sales_excel_if_not_exists()
                sales_df = pd.read_excel("sales.xlsx")
        else:
            create_sales_excel_if_not_exists()
            sales_df = pd.read_excel("sales.xlsx")

        # Prepare the sale record
        sale_record = {
            'bill_number': sale_data.get('bill_number', ''),
            'invoice_number': sale_data.get('invoice_number', ''),
            'date': sale_data.get('date', datetime.now().strftime('%d/%m/%Y')),
            'customer_name': sale_data.get('customer_name', ''),
            'aadhaar_number': sale_data.get('aadhaar_number', ''),
            'mobile_number': sale_data.get('mobile_number', ''),
            'address': sale_data.get('address', ''),
            'chassis_number': sale_data.get('chassis_number', ''),
            'chassis_make_model': sale_data.get('chassis_make_model', ''),
            'chassis_motor_number': sale_data.get('chassis_motor_number', ''),
            'chassis_controller_number': sale_data.get('chassis_controller_number', ''),
            'chassis_color': sale_data.get('chassis_color', ''),
            'battery_serial_numbers': sale_data.get('battery_serial_numbers', ''),
            'battery_details': sale_data.get('battery_details', ''),
            'battery_count': sale_data.get('battery_count', 0),
            'hsn_code': sale_data.get('hsn_code', ''),
            'description': sale_data.get('description', ''),
            'subtotal_amount': sale_data.get('subtotal_amount', 0.0),
            'cgst_amount': sale_data.get('cgst_amount', 0.0),
            'sgst_amount': sale_data.get('sgst_amount', 0.0),
            'igst_amount': sale_data.get('igst_amount', 0.0),
            'round_off_amount': sale_data.get('round_off_amount', 0.0),
            'total_amount': sale_data.get('total_amount', 0.0),
            'amount_in_words': sale_data.get('amount_in_words', ''),
            'tax_type': sale_data.get('tax_type', ''),
            'finance_team': sale_data.get('finance_team', ''),
            'bill_file_path': sale_data.get('bill_file_path', ''),
            'created_timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        # Convert to DataFrame and append
        new_sale_df = pd.DataFrame([sale_record])
        updated_sales_df = pd.concat([sales_df, new_sale_df], ignore_index=True)

        # Save back to Excel
        updated_sales_df.to_excel("sales.xlsx", index=False)

        logger.info(f"Successfully saved sale record to sales.xlsx: {sale_data.get('bill_number', 'Unknown')}")
        return True

    except Exception as e:
        logger.error(f"Error saving sale to Excel: {e}")
        return False

def create_sales_excel_if_not_exists():
    """Create sales.xlsx file with proper headers if it doesn't exist"""
    sales_file = Path("sales.xlsx")

    if not sales_file.exists():
        # Create sales.xlsx with proper column headers
        sales_columns = [
            'bill_number',
            'invoice_number',
            'date',
            'customer_name',
            'aadhaar_number',
            'mobile_number',
            'address',
            'chassis_number',
            'chassis_make_model',
            'chassis_motor_number',
            'chassis_controller_number',
            'chassis_color',
            'battery_serial_numbers',
            'battery_details',
            'battery_count',
            'hsn_code',
            'description',
            'subtotal_amount',
            'cgst_amount',
            'sgst_amount',
            'igst_amount',
            'round_off_amount',
            'total_amount',
            'amount_in_words',
            'tax_type',
            'finance_team',
            'bill_file_path',
            'created_timestamp'
        ]

        # Create empty DataFrame with columns
        empty_df = pd.DataFrame(columns=sales_columns)
        empty_df.to_excel("sales.xlsx", index=False)
        logger.info("Created new sales.xlsx file with proper headers")
    else:
        logger.info("sales.xlsx file already exists")

class ImageExtractionTestRequest(BaseModel):
    front_image_path: Optional[str] = None
    back_image_path: Optional[str] = None

class ImageExtractionTestResult(BaseModel):
    success: bool
    front_result: Optional[dict] = None
    back_result: Optional[dict] = None
    combined_result: Optional[dict] = None
    error: Optional[str] = None

# Pydantic models
class AadhaarExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract the aadhar number from the given pdf")
    address: str = Field(..., description="Extract the full address from the given pdf")
    mobileNumber: str = Field(..., description="Extract the mobile/phone number from the given pdf")

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
    name: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    father_name: Optional[str] = None
    error: Optional[str] = None
    source: Optional[str] = None  # 'pdf', 'images', 'front_image', 'back_image', 'combined'
    extraction_method: Optional[str] = None  # 'folder_method', 'image_upload', 'pdf_with_images'
    image_results: Optional[dict] = None  # Store detailed image extraction results

class ChassisFilterRequest(BaseModel):
    filter_text: str

class BatteryFilterRequest(BaseModel):
    filter_text: str

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

class BillingItem(BaseModel):
    description: str
    hsn_code: str
    quantity: float
    unit_price: float
    total: float

class BillingData(BaseModel):
    customer_name: str
    aadhaar_number: str
    address: str
    mobile_number: str
    chassis_number: Optional[str] = None
    selected_batteries: List[str] = []
    hsn_code: str
    base_amount: float = 0.0
    use_igst: bool = False
    finance_team: str = ""
    additional_notes: Optional[str] = None

class BillGenerationResult(BaseModel):
    success: bool
    bill_path: Optional[str] = None
    bill_number: Optional[str] = None
    invoice_number: Optional[str] = None
    download_url: Optional[str] = None
    description: Optional[str] = None
    total_amount: Optional[float] = None
    amount_in_words: Optional[str] = None
    cgst: Optional[float] = None
    sgst: Optional[float] = None
    igst: Optional[float] = None
    error: Optional[str] = None

class AadhaarImageExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract the exact 12-digit Aadhaar number from the image. Return only numbers, no spaces or formatting.")
    address: str = Field(..., description="Extract the complete address exactly as written on the Aadhaar card. Include all address components like house number, street, village, district, state, PIN code.")
    mobileNumber: str = Field(default="", description="Extract the 10-digit mobile number if visible on the image. Return only numbers. If not visible, return empty string.")
    name: str = Field(..., description="Extract the person's full name exactly as written on the Aadhaar card.")
    dateOfBirth: str = Field(default="", description="Extract date of birth in DD/MM/YYYY format if visible. If not visible, return empty string.")
    gender: str = Field(default="", description="Extract gender (Male/Female) if visible. If not visible, return empty string.")
    fatherName: str = Field(default="", description="Extract father's name if visible on the card. If not visible, return empty string.")

# Add new models for image processing
class ImageProcessRequest(BaseModel):
    folder_path: str
    use_images_if_pdf_fails: bool = True  # Fallback to images if PDF extraction fails

class ImageUploadData(BaseModel):
    customer_name: str
    aadhaar_number: Optional[str] = None

# Initialize the agent
# Initialize the agents (PDF and Image processing)
pdf_agent = Agent(
    model=Gemini(id="gemini-1.5-flash", api_key=GOOGLE_API_KEY),
    description="You extract Aadhaar number, address, and mobile number information from the PDF file.",
    response_model=AadhaarExtraction,
)

image_agent = Agent(
    model=Gemini(id="gemini-1.5-flash", api_key=GOOGLE_API_KEY),
    description="You are an expert at extracting information from Aadhaar card images. You carefully read all visible text and numbers from Indian Aadhaar cards.",
    response_model=AadhaarImageExtraction,
)

# Load Excel data on startup
load_excel_data()
def get_item_cost_price(chassis_number: str = None, battery_numbers: List[str] = None) -> Dict[str, float]:
    """Get cost price for chassis and batteries"""
    total_cost = 0.0
    chassis_cost = 0.0
    battery_cost = 0.0

    # Get chassis cost
    if chassis_number:
        for chassis in chassis_data:
            if str(chassis.get('chassis_number', '')) == chassis_number:
                # Try different cost fields
                chassis_cost = float(
                    chassis.get('cost_price', 0) or
                    chassis.get('purchase_price', 0) or
                    chassis.get('buying_price', 0) or
                    chassis.get('cost', 0) or
                    0
                )
                total_cost += chassis_cost
                break

    # Get battery costs
    if battery_numbers:
        for battery_number in battery_numbers:
            for battery in battery_data:
                if str(battery.get('bat_serial_number', '')) == battery_number:
                    battery_price = float(
                        battery.get('cost_price', 0) or
                        battery.get('purchase_price', 0) or
                        battery.get('buying_price', 0) or
                        battery.get('cost', 0) or
                        0
                    )
                    battery_cost += battery_price
                    total_cost += battery_price
                    break

    return {
        'total_cost': total_cost,
        'chassis_cost': chassis_cost,
        'battery_cost': battery_cost
    }

def calculate_sale_profitability():
    """Calculate profit/loss for all sales"""
    global sales_data

    enriched_sales = []

    for sale in sales_data:
        try:
            # Get cost information
            chassis_number = sale.get('chassis_number', '')
            battery_numbers = []

            if sale.get('battery_serial_numbers'):
                battery_numbers = [b.strip() for b in str(sale.get('battery_serial_numbers', '')).split(',') if b.strip()]

            cost_info = get_item_cost_price(chassis_number, battery_numbers)

            # Calculate profit metrics
            selling_price = float(sale.get('total_amount', 0))
            total_cost = cost_info['total_cost']

            profit = selling_price - total_cost
            profit_margin = (profit / selling_price * 100) if selling_price > 0 else 0

            # Enrich sale data
            enriched_sale = sale.copy()
            enriched_sale.update({
                'total_cost': total_cost,
                'chassis_cost': cost_info['chassis_cost'],
                'battery_cost': cost_info['battery_cost'],
                'profit': profit,
                'profit_margin': profit_margin,
                'profit_status': 'Profit' if profit > 0 else 'Loss' if profit < 0 else 'Break-even'
            })

            enriched_sales.append(enriched_sale)

        except Exception as e:
            logger.error(f"Error calculating profitability for sale {sale.get('bill_number', 'Unknown')}: {e}")
            # Add original sale without profit calculations
            enriched_sale = sale.copy()
            enriched_sale.update({
                'total_cost': 0,
                'chassis_cost': 0,
                'battery_cost': 0,
                'profit': 0,
                'profit_margin': 0,
                'profit_status': 'Unknown'
            })
            enriched_sales.append(enriched_sale)

    return enriched_sales

def generate_dashboard_stats():
    """Generate comprehensive dashboard statistics"""
    enriched_sales = calculate_sale_profitability()

    if not enriched_sales:
        return {
            'total_revenue': 0, 'total_sales': 0, 'total_customers': 0,
            'total_profit': 0, 'avg_profit_margin': 0, 'inventory_count': 0,
            'revenue_growth': 0, 'sales_growth': 0, 'customer_growth': 0,
            'profit_growth': 0
        }

    # Convert to DataFrame for easier analysis
    df = pd.DataFrame(enriched_sales)

    # Ensure date column is datetime
    if 'created_timestamp' in df.columns:
        df['date_parsed'] = pd.to_datetime(df['created_timestamp'], errors='coerce')
    elif 'date' in df.columns:
        df['date_parsed'] = pd.to_datetime(df['date'], format='%d/%m/%Y', errors='coerce')
    else:
        df['date_parsed'] = pd.to_datetime('today')

    # Basic metrics
    total_revenue = df['total_amount'].sum() if 'total_amount' in df.columns else 0
    total_sales = len(df)
    total_customers = df['customer_name'].nunique() if 'customer_name' in df.columns else 0
    total_profit = df['profit'].sum() if 'profit' in df.columns else 0
    avg_profit_margin = df['profit_margin'].mean() if 'profit_margin' in df.columns else 0

    # Inventory count (available items)
    available_chassis = len([c for c in chassis_data if str(c.get('status', '')).lower() == 'available'])
    available_batteries = len([b for b in battery_data if str(b.get('status', '')).lower() == 'available'])
    inventory_count = available_chassis + available_batteries

    # Growth calculations (compare last 30 days with previous 30 days)
    current_date = datetime.now()
    last_30_days = current_date - timedelta(days=30)
    previous_30_days = current_date - timedelta(days=60)

    df_last_30 = df[df['date_parsed'] >= last_30_days]
    df_previous_30 = df[(df['date_parsed'] >= previous_30_days) & (df['date_parsed'] < last_30_days)]

    # Calculate growth rates
    def calculate_growth(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return ((current - previous) / previous) * 100

    revenue_growth = calculate_growth(
        df_last_30['total_amount'].sum() if len(df_last_30) > 0 else 0,
        df_previous_30['total_amount'].sum() if len(df_previous_30) > 0 else 0
    )

    sales_growth = calculate_growth(len(df_last_30), len(df_previous_30))

    customer_growth = calculate_growth(
        df_last_30['customer_name'].nunique() if len(df_last_30) > 0 else 0,
        df_previous_30['customer_name'].nunique() if len(df_previous_30) > 0 else 0
    )

    profit_growth = calculate_growth(
        df_last_30['profit'].sum() if len(df_last_30) > 0 else 0,
        df_previous_30['profit'].sum() if len(df_previous_30) > 0 else 0
    )

    return {
        'total_revenue': round(total_revenue, 2),
        'total_sales': total_sales,
        'total_customers': total_customers,
        'total_profit': round(total_profit, 2),
        'avg_profit_margin': round(avg_profit_margin, 2),
        'inventory_count': inventory_count,
        'revenue_growth': round(revenue_growth, 1),
        'sales_growth': round(sales_growth, 1),
        'customer_growth': round(customer_growth, 1),
        'profit_growth': round(profit_growth, 1)
    }

def generate_revenue_chart_data(period: str = '30d'):
    """Generate revenue and profit chart data for different time periods"""
    enriched_sales = calculate_sale_profitability()

    if not enriched_sales:
        return []

    df = pd.DataFrame(enriched_sales)

    # Parse dates
    if 'created_timestamp' in df.columns:
        df['date_parsed'] = pd.to_datetime(df['created_timestamp'], errors='coerce')
    elif 'date' in df.columns:
        df['date_parsed'] = pd.to_datetime(df['date'], format='%d/%m/%Y', errors='coerce')
    else:
        return []

    # Remove rows with invalid dates
    df = df.dropna(subset=['date_parsed'])

    if len(df) == 0:
        return []

    # Filter by period and create time groups
    current_date = datetime.now()

    if period == '7d':
        start_date = current_date - timedelta(days=7)
        df_filtered = df[df['date_parsed'] >= start_date]
        df_filtered['period'] = df_filtered['date_parsed'].dt.strftime('%a (%m/%d)')

    elif period == '30d':
        start_date = current_date - timedelta(days=30)
        df_filtered = df[df['date_parsed'] >= start_date]
        # Group by week
        df_filtered['week_start'] = df_filtered['date_parsed'].dt.to_period('W').dt.start_time
        df_filtered['period'] = df_filtered['week_start'].dt.strftime('Week %m/%d')

    elif period == '90d':
        start_date = current_date - timedelta(days=90)
        df_filtered = df[df['date_parsed'] >= start_date]
        df_filtered['period'] = df_filtered['date_parsed'].dt.strftime('%b %Y')

    elif period == '1y':
        start_date = current_date - timedelta(days=365)
        df_filtered = df[df['date_parsed'] >= start_date]
        # Group by quarter
        df_filtered['quarter'] = df_filtered['date_parsed'].dt.to_period('Q')
        df_filtered['period'] = df_filtered['quarter'].astype(str)

    else:  # Default to monthly view
        df_filtered = df
        df_filtered['period'] = df_filtered['date_parsed'].dt.strftime('%b %Y')

    if len(df_filtered) == 0:
        return []

    # Group by period and calculate metrics
    revenue_data = df_filtered.groupby('period').agg({
        'total_amount': 'sum',
        'profit': 'sum',
        'total_cost': 'sum',
        'bill_number': 'count'
    }).reset_index()

    # Sort by period for proper time series
    if period == '7d':
        # For daily data, sort by actual date
        period_dates = df_filtered.groupby('period')['date_parsed'].first().reset_index()
        revenue_data = revenue_data.merge(period_dates, on='period')
        revenue_data = revenue_data.sort_values('date_parsed')

    return [
        {
            'month': row['period'],
            'revenue': round(row['total_amount'], 2),
            'profit': round(row['profit'], 2),
            'cost': round(row['total_cost'], 2),
            'sales_count': int(row['bill_number'])
        }
        for _, row in revenue_data.iterrows()
    ]

def generate_recent_activities():
    """Generate recent activities related to sales"""
    activities = []

    # Recent sales
    recent_sales = sorted(sales_data, key=lambda x: x.get('created_timestamp', ''), reverse=True)[:5]

    for sale in recent_sales:
        activities.append({
            'type': 'sale',
            'icon': 'fas fa-shopping-cart',
            'title': f'Sale completed - {sale.get("bill_number", "Unknown")}',
            'subtitle': f'Customer: {sale.get("customer_name", "Unknown")} - ₹{sale.get("total_amount", 0):,.0f}',
            'time': format_time_ago(sale.get('created_timestamp', ''))
        })

    # Add system activity
    activities.append({
        'type': 'system',
        'icon': 'fas fa-sync',
        'title': 'Sales data synchronized',
        'subtitle': f'Updated {len(sales_data)} sales records',
        'time': '5 minutes ago'
    })

    return activities

def format_time_ago(timestamp_str: str) -> str:
    """Format timestamp to human readable time ago"""
    try:
        if not timestamp_str:
            return 'Unknown time'

        # Try different timestamp formats
        formats = ['%Y-%m-%d %H:%M:%S', '%d/%m/%Y', '%Y-%m-%d']

        timestamp = None
        for fmt in formats:
            try:
                timestamp = datetime.strptime(timestamp_str, fmt)
                break
            except ValueError:
                continue

        if not timestamp:
            return 'Unknown time'

        now = datetime.now()
        diff = now - timestamp

        if diff.days > 0:
            return f"{diff.days} days ago"
        elif diff.seconds > 3600:
            hours = diff.seconds // 3600
            return f"{hours} hours ago"
        elif diff.seconds > 60:
            minutes = diff.seconds // 60
            return f"{minutes} minutes ago"
        else:
            return "Just now"
    except Exception:
        return "Unknown time"

def update_analytics_cache():
    """Update analytics cache with fresh data"""
    global analytics_cache

    try:
        # Reload sales data
        load_excel_data()

        analytics_cache['stats'] = generate_dashboard_stats()
        analytics_cache['charts_data'] = {
            'revenue_data': generate_revenue_chart_data()
        }
        analytics_cache['activities'] = generate_recent_activities()
        analytics_cache['last_updated'] = datetime.now()

        logger.info("Analytics cache updated successfully")

    except Exception as e:
        logger.error(f"Error updating analytics cache: {e}")

# Bill counter files
bill_counter_file = Path("bill_counter.json")
invoice_counter_file = Path("invoice_counter.json")
create_sales_excel_if_not_exists()

def get_next_bill_number() -> str:
    """Generate the next bill number"""
    try:
        if bill_counter_file.exists():
            with open(bill_counter_file, 'r') as f:
                data = json.load(f)
                counter = data.get('counter', 0)
        else:
            counter = 0
        counter += 1
        with open(bill_counter_file, 'w') as f:
            json.dump({'counter': counter}, f)
        return f"BILL-{datetime.now().year}-{counter:04d}"
    except Exception as e:
        logger.error(f"Error generating bill number: {e}")
        return f"BILL-{datetime.now().strftime('%Y%m%d%H%M%S')}"

def get_next_invoice_number() -> str:
    """Generate the next invoice number in format ME/GST/25-26/XXX"""
    try:
        if invoice_counter_file.exists():
            with open(invoice_counter_file, 'r') as f:
                data = json.load(f)
                counter = data.get('counter', 0)
        else:
            counter = 0
        counter += 1
        with open(invoice_counter_file, 'w') as f:
            json.dump({'counter': counter}, f)

        # Format: ME/GST/25-26/XXX (financial year 2025-26)
        return f"ME/GST/25-26/{counter:03d}"
    except Exception as e:
        logger.error(f"Error generating invoice number: {e}")
        return f"ME/GST/25-26/001"

def number_to_words(amount: float) -> str:
    """Convert number to words (Indian numbering system)"""
    try:
        ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
        teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
        tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

        def convert_hundreds(n: int) -> str:
            result = ''
            if n >= 100:
                result += ones[n // 100] + ' Hundred '
                n %= 100
            if n >= 20:
                result += tens[n // 10] + ' '
                n %= 10
            elif n >= 10:
                result += teens[n - 10] + ' '
                n = 0
            if n > 0:
                result += ones[n] + ' '
            return result.strip()

        if amount == 0:
            return "Zero"

        rupees = int(amount)
        paise = int((amount - rupees) * 100)
        result = ''

        if rupees >= 10000000:
            crores = rupees // 10000000
            result += convert_hundreds(crores) + ' Crore '
            rupees %= 10000000

        if rupees >= 100000:
            lakhs = rupees // 100000
            result += convert_hundreds(lakhs) + ' Lakh '
            rupees %= 100000

        if rupees >= 1000:
            thousands = rupees // 1000
            result += convert_hundreds(thousands) + ' Thousand '
            rupees %= 1000

        if rupees > 0:
            result += convert_hundreds(rupees)

        result = result.strip()
        if result:
            result += ' Rupees'

        if paise > 0:
            if result:
                result += ' and '
            result += convert_hundreds(paise) + ' Paise'

        return result

    except Exception as e:
        logger.error(f"Error converting number to words: {e}")
        return "Amount in Words - Error"

def calculate_base_amount_from_final(final_amount: float, use_igst: bool = False) -> Dict[str, float]:
    """Calculate base amount (subtotal) from final amount by reverse calculation"""
    try:
        # Tax rates (in percentage)
        cgst_rate = 2.5  # 2.5% CGST
        sgst_rate = 2.5  # 2.5% SGST
        igst_rate = 5.0  # 5% IGST

        # Calculate total tax rate
        if use_igst:
            total_tax_rate = igst_rate  # 5%
        else:
            total_tax_rate = cgst_rate + sgst_rate  # 2.5% + 2.5% = 5%

        # Reverse calculation: base_amount = final_amount / (1 + total_tax_rate/100)
        base_amount = final_amount / (1 + total_tax_rate / 100)

        # Now calculate individual taxes from the base amount
        subtotal = base_amount

        if use_igst:
            igst = round((subtotal * igst_rate) / 100, 2)
            cgst = 0.0
            sgst = 0.0
        else:
            cgst = round((subtotal * cgst_rate) / 100, 2)
            sgst = round((subtotal * sgst_rate) / 100, 2)
            igst = 0.0

        # Calculate total tax and verify
        total_tax = cgst + sgst + igst
        calculated_total = subtotal + total_tax

        # Round off calculation (difference between calculated and entered final amount)
        round_off = final_amount - calculated_total

        return {
            'subtotal': round(subtotal, 2),
            'cgst': cgst,
            'sgst': sgst,
            'igst': igst,
            'total_tax': round(total_tax, 2),
            'round_off': round(round_off, 2),
            'total_amount': final_amount  # This should match the input
        }

    except Exception as e:
        logger.error(f"Error calculating base amount from final: {e}")
        return {
            'subtotal': 0.0,
            'cgst': 0.0,
            'sgst': 0.0,
            'igst': 0.0,
            'total_tax': 0.0,
            'round_off': 0.0,
            'total_amount': final_amount
        }



def calculate_taxes_and_total(final_amount: float, use_igst: bool = False) -> Dict[str, float]:
    """Calculate taxes and base amount from final amount (reverse calculation)"""
    return calculate_base_amount_from_final(final_amount, use_igst)

def extract_state_from_address(address: str) -> str:
    """Extract state from address"""
    try:
        states = [
            'WEST BENGAL', 'BENGAL', 'WB',
            'MAHARASHTRA', 'DELHI', 'GUJARAT', 'RAJASTHAN',
            'UTTAR PRADESH', 'UP', 'BIHAR', 'JHARKHAND',
            'ODISHA', 'ASSAM', 'KERALA', 'KARNATAKA',
            'TAMIL NADU', 'ANDHRA PRADESH', 'TELANGANA'
        ]

        address_upper = address.upper()
        for state in states:
            if state in address_upper:
                if state in ['BENGAL', 'WB']:
                    return 'WEST BENGAL'
                elif state == 'UP':
                    return 'UTTAR PRADESH'
                return state
        return 'WEST BENGAL'
    except Exception as e:
        logger.error(f"Error extracting state: {e}")
        return 'WEST BENGAL'

def get_template_file() -> Optional[Path]:
    """Find the bill template file"""
    current_dir = Path.cwd()
    template_folder = current_dir / TEMPLATES_FOLDER
    template_path = template_folder / "template.docx"

    if template_path.exists():
        return template_path

    try:
        docx_files = list(template_folder.glob("*.docx"))
        if docx_files:
            return docx_files[0]
    except Exception as e:
        logger.error(f"Error searching for .docx files: {e}")

    return None

def split_address(address: str) -> tuple:
    """Split address into two parts for template"""
    if not address:
        return "", ""

    parts = address.split(',', 1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()

    if len(address) > 50:
        mid_point = len(address) // 2
        for i in range(mid_point - 10, mid_point + 10):
            if i < len(address) and address[i] == ' ':
                return address[:i].strip(), address[i+1:].strip()

    return address.strip(), ""

# def format_battery_description(batteries: List[dict]) -> str:
#     """Format battery information for bill description"""
#     if not batteries:
#         return ""

#     battery_lines = []
#     for i, battery in enumerate(batteries, 1):
#         serial = battery.get('bat_serial_number', '')
#         last_four = serial[-4:] if len(serial) >= 4 else serial
#         battery_line = f"{i}){serial} {last_four}"
#         battery_lines.append(battery_line)

#     return " ".join(battery_lines)

def generate_bill_description(chassis_data: Optional[dict], batteries: List[dict]) -> str:
    """Generate the bill description based on chassis and battery data"""
    description = ""

    if chassis_data:
        # Format: E-RICKSHAW {make_model} CHASSIS NO-{chassis_number} MOTOR NO-{motor_number}
        description += f"E-RICKSHAW {chassis_data.get('make_model', '').upper()} "
        description += f"CHASSIS NO-{chassis_data.get('chassis_number', '')} "
        description += f"MOTOR NO-{chassis_data.get('motor_number', '')}"

        # Add battery information in the new format
        if batteries:
            description += " WITH "

            # Format each battery as: {make} {warranty} {model} {ampere}
            battery_descriptions = []
            for battery in batteries:
                battery_desc = f"{battery.get('make', '')} {battery.get('warranty', '')} {battery.get('model', '')} {battery.get('ampere', '')}"
                battery_descriptions.append(battery_desc.strip())

            # Join multiple batteries with commas
            description += ", ".join(battery_descriptions)
    elif batteries:
        # If only batteries selected without chassis
        description = "BATTERIES: "
        battery_descriptions = []
        for battery in batteries:
            battery_desc = f"{battery.get('make', '')} {battery.get('warranty', '')} {battery.get('model', '')} {battery.get('ampere', '')}"
            battery_descriptions.append(battery_desc.strip())
        description += ", ".join(battery_descriptions)

    return description.strip()

def format_battery_description(batteries: List[dict]) -> str:
    """Format battery information for bill description - DEPRECATED, use generate_bill_description instead"""
    # This function is no longer used with the new format, but keeping for backward compatibility
    if not batteries:
        return ""

    battery_lines = []
    for i, battery in enumerate(batteries, 1):
        # New format: {make} {warranty} {model} {ampere}
        battery_line = f"{battery.get('make', '')} {battery.get('warranty', '')} {battery.get('model', '')} {battery.get('ampere', '')}"
        battery_lines.append(battery_line.strip())

    return ", ".join(battery_lines)

def filter_chassis(filter_text: str) -> List[ChassisResult]:
    """Filter chassis in real-time based on text input - only show available chassis"""
    results = []

    if not filter_text.strip():
        # Only show available chassis
        available_chassis = [chassis for chassis in chassis_data if str(chassis.get('status', '')).lower() == 'available']
        limited_chassis = available_chassis[:50]
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

    filter_lower = filter_text.lower()

    for chassis in chassis_data:
        # Only include available chassis
        if str(chassis.get('status', '')).lower() != 'available':
            continue

        chassis_number = str(chassis.get('chassis_number', ''))
        make_model = str(chassis.get('make_model', ''))

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

    def sort_key(item):
        chassis_num = item.chassis_number
        if chassis_num.endswith(filter_text):
            return (0, chassis_num)
        elif filter_text in chassis_num:
            return (1, chassis_num)
        else:
            return (2, chassis_num)

    results.sort(key=sort_key)
    return results[:20]

def filter_batteries(filter_text: str) -> List[BatteryResult]:
    """Filter batteries in real-time based on text input - only show available batteries"""
    results = []

    if not filter_text.strip():
        # Only show available batteries
        available_batteries = [battery for battery in battery_data if str(battery.get('status', '')).lower() == 'available']
        limited_batteries = available_batteries[:50]
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

    filter_lower = filter_text.lower()

    for battery in battery_data:
        # Only include available batteries
        if str(battery.get('status', '')).lower() != 'available':
            continue

        serial_number = str(battery.get('bat_serial_number', ''))
        make = str(battery.get('make', ''))
        model = str(battery.get('model', ''))

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

    def sort_key(item):
        serial_num = item.bat_serial_number
        if serial_num.endswith(filter_text):
            return (0, serial_num)
        elif filter_text in serial_num:
            return (1, serial_num)
        else:
            return (2, serial_num)

    results.sort(key=sort_key)
    return results[:20]


def update_item_status_to_sold(chassis_number: str = None, battery_numbers: List[str] = None):
    """Update status of sold items to 'sold'"""
    try:
        # Update chassis status
        if chassis_number:
            for i, chassis in enumerate(chassis_data):
                if str(chassis.get('chassis_number', '')) == chassis_number:
                    chassis_data[i]['status'] = 'sold'
                    logger.info(f"Updated chassis {chassis_number} status to 'sold'")
                    break

        # Update battery statuses
        if battery_numbers:
            for battery_number in battery_numbers:
                for i, battery in enumerate(battery_data):
                    if str(battery.get('bat_serial_number', '')) == battery_number:
                        battery_data[i]['status'] = 'sold'
                        logger.info(f"Updated battery {battery_number} status to 'sold'")
                        break

        # Save updated data back to Excel files
        save_updated_data_to_excel()

    except Exception as e:
        logger.error(f"Error updating item status: {e}")

def save_updated_data_to_excel():
    """Save updated chassis and battery data back to Excel files"""
    try:
        # Save chassis data
        chassis_df = pd.DataFrame(chassis_data)
        chassis_df.to_excel("chassis.xlsx", index=False)
        logger.info("Updated chassis data saved to chassis.xlsx")

        # Save battery data
        battery_df = pd.DataFrame(battery_data)
        battery_df.to_excel("battery.xlsx", index=False)
        logger.info("Updated battery data saved to battery.xlsx")

    except Exception as e:
        logger.error(f"Error saving updated data to Excel: {e}")
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
    """Generate bill using DocxTemplate and billing data with complete financial calculations"""
    try:
        template_file = get_template_file()
        if not template_file:
            return BillGenerationResult(
                success=False,
                error="Bill template not found. Please add 'template.docx' to the 'templates' folder."
            )

        bill_number = get_next_bill_number()
        invoice_number = get_next_invoice_number()
        current_date = datetime.now().strftime("%d/%m/%Y")

        address1, address2 = split_address(billing_data.address)

        chassis_info = None
        if billing_data.chassis_number:
            chassis_info = get_chassis_by_number(billing_data.chassis_number)

        selected_batteries = get_batteries_by_numbers(billing_data.selected_batteries)
        description = generate_bill_description(chassis_info, selected_batteries)

        # Calculate base amount from final amount (reverse calculation)
        final_amount = billing_data.base_amount  # This is now the final amount

        # If no final amount provided, use default
        if final_amount == 0.0:
            final_amount = 178899.90  # Default final amount

        # Calculate base amount and taxes using reverse calculation
        financial_data = calculate_taxes_and_total(final_amount, billing_data.use_igst)

        # Convert amount to words
        amount_in_words = number_to_words(financial_data['total_amount'])

        # Prepare context data for DocxTemplate
        context = {
            # Basic bill info
            'date': current_date,
            'bill_number': bill_number,
            'invoice_number': invoice_number,

            # Customer information
            'customerName': billing_data.customer_name,
            'customerParent': '',
            'address1': address1,
            'address2': address2,
            'aadhar': billing_data.aadhaar_number,
            'mobile': billing_data.mobile_number,

            # Company information
            'company_name': 'MINATO ENTERPRISE',
            'company_address': 'G/67, DR. M. N. GHOSH ROAD RANIGANJ, WEST BENGAL-713347',
            'company_phone1': '9679697117',
            'company_phone2': '9333100233',
            'company_email': 'theminatoenterprise@gmail.com',
            'company_gstin': '19BQFPA3329A1ZF',

            # Bill items - using calculated base amount (subtotal)
            'description': description,
            'hsnCode': billing_data.hsn_code,
            'quantity': '1',
            'unitPrice': f"{financial_data['subtotal']:.2f}",
            'itemTotal': f"{financial_data['subtotal']:.2f}",

            # Financial calculations (with reverse calculation)
            'subtotal': f"{financial_data['subtotal']:.2f}",
            'cgst': f"{financial_data['cgst']:.2f}",
            'sgst': f"{financial_data['sgst']:.2f}",
            'igst': f"{financial_data['igst']:.2f}",
            'roundOff': f"{financial_data['round_off']:.2f}",
            'total': f"{financial_data['total_amount']:.2f}",
            'totalAmount': f"{financial_data['total_amount']:.2f}",
            'amountWords': amount_in_words,

            # Financial fields for template
            'finance_name': 'MINATO ENTERPRISE',
            'financeTeam': billing_data.finance_team,
            'invoiceNumber': invoice_number,
            'bill_total': f"{financial_data['total_amount']:.2f}",
            'base_amount': f"{financial_data['subtotal']:.2f}",
            'tax_amount': f"{financial_data['total_tax']:.2f}",
            'final_total': f"{financial_data['total_amount']:.2f}",

            # Additional placeholders
            'subTotal': f"{financial_data['subtotal']:.2f}",
            'totalAmount': f"{financial_data['total_amount']:.2f}",
            'amountWords': amount_in_words
        }

        doc = DocxTemplate(template_file)
        doc.render(context)

        safe_customer_name = re.sub(r'[^\w\s-]', '', billing_data.customer_name).strip()
        safe_customer_name = re.sub(r'[-\s]+', '_', safe_customer_name)
        output_filename = f"Bill_{safe_customer_name}_{datetime.now().strftime('%Y%m%d')}_{bill_number.replace('-', '_')}.docx"
        output_path = Path(INVOICES_FOLDER) / output_filename

        doc.save(output_path)

        # UPDATE STATUS TO SOLD AFTER SUCCESSFUL BILL GENERATION
        try:
            update_item_status_to_sold(
                chassis_number=billing_data.chassis_number,
                battery_numbers=billing_data.selected_batteries
            )
            logger.info("Successfully updated item statuses to 'sold'")
        except Exception as status_error:
            logger.error(f"Error updating item statuses: {status_error}")

        # SAVE SALE DETAILS TO SALES.XLSX
        try:
            # Prepare battery information
            battery_serial_numbers = ', '.join(billing_data.selected_batteries) if billing_data.selected_batteries else ''
            battery_details_list = []
            for battery in selected_batteries:
                battery_detail = f"{battery.get('make', '')} {battery.get('warranty', '')} {battery.get('model', '')} {battery.get('ampere', '')}Ah"
                battery_details_list.append(battery_detail.strip())
            battery_details = ', '.join(battery_details_list)

            sale_data = {
                'bill_number': bill_number,
                'invoice_number': invoice_number,
                'date': current_date,
                'customer_name': billing_data.customer_name,
                'aadhaar_number': billing_data.aadhaar_number,
                'mobile_number': billing_data.mobile_number,
                'address': billing_data.address,
                'chassis_number': billing_data.chassis_number or '',
                'chassis_make_model': chassis_info.get('make_model', '') if chassis_info else '',
                'chassis_motor_number': chassis_info.get('motor_number', '') if chassis_info else '',
                'chassis_controller_number': chassis_info.get('controller_number', '') if chassis_info else '',
                'chassis_color': chassis_info.get('color', '') if chassis_info else '',
                'battery_serial_numbers': battery_serial_numbers,
                'battery_details': battery_details,
                'battery_count': len(billing_data.selected_batteries),
                'hsn_code': billing_data.hsn_code,
                'description': description,
                'subtotal_amount': financial_data['subtotal'],
                'cgst_amount': financial_data['cgst'],
                'sgst_amount': financial_data['sgst'],
                'igst_amount': financial_data['igst'],
                'round_off_amount': financial_data['round_off'],
                'total_amount': financial_data['total_amount'],
                'amount_in_words': amount_in_words,
                'tax_type': 'IGST' if billing_data.use_igst else 'CGST+SGST',
                'finance_team': billing_data.finance_team,
                'bill_file_path': str(output_path)
            }

            sale_saved = save_sale_to_excel(sale_data)
            if sale_saved:
                logger.info("Successfully saved sale details to sales.xlsx")
            else:
                logger.error("Failed to save sale details to sales.xlsx")

        except Exception as sale_error:
            logger.error(f"Error saving sale to Excel: {sale_error}")
            # Don't fail the bill generation if sale saving fails

        return BillGenerationResult(
            success=True,
            bill_path=str(output_path),
            bill_number=bill_number,
            invoice_number=invoice_number,
            download_url=f"/download-bill/{output_filename}",
            description=description,
            total_amount=financial_data['total_amount'],
            amount_in_words=amount_in_words,
            cgst=financial_data['cgst'],
            sgst=financial_data['sgst'],
            igst=financial_data['igst'],
            error=None
        )

    except Exception as e:
        logger.error(f"Error generating bill: {str(e)}")
        return BillGenerationResult(
            success=False,
            error=f"Failed to generate bill: {str(e)}"
        )

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

    try:
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
    except Exception as e:
        logger.error(f"Error getting customer suggestions: {e}")
        return []

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

        # Alternative File creation approaches
        pdf_file = None

        # Approach 1: Try with absolute path string
        try:
            pdf_file = File(filepath=str(pdf_path.absolute()))
            logger.info("File object created with absolute path")
        except Exception as e1:
            logger.warning(f"Approach 1 failed: {e1}")

            # Approach 2: Try with relative path
            try:
                pdf_file = File(filepath=str(pdf_path))
                logger.info("File object created with relative path")
            except Exception as e2:
                logger.warning(f"Approach 2 failed: {e2}")

                # Approach 3: Try reading file content
                try:
                    with open(pdf_path, 'rb') as f:
                        content = f.read()
                    pdf_file = File(content=content, name=pdf_path.name)
                    logger.info("File object created with content")
                except Exception as e3:
                    logger.error(f"All File creation approaches failed: {e1}, {e2}, {e3}")
                    return ExtractionResult(
                        success=False,
                        aadhar_number=None,
                        address=None,
                        mobile_number=None,
                        source='pdf',
                        extraction_method='folder_method',
                        error=f"Failed to create File object: {str(e3)}"
                    )

        if pdf_file is None:
            raise Exception("Failed to create File object")

        # Run the agent
        response = pdf_agent.run(
            "Please extract the Aadhaar number, complete address, and mobile/phone number from this document. "
            "Look carefully for any 10-digit mobile numbers that typically start with 6, 7, 8, or 9. "
            "The mobile number might be listed as 'Mobile', 'Phone', or just appear as a 10-digit number.",
            files=[pdf_file]
        )

        if response and response.content:
            return ExtractionResult(
                success=True,
                aadhar_number=response.content.aadharNumber,
                address=response.content.address,
                mobile_number=response.content.mobileNumber,
                source='pdf',
                extraction_method='folder_method',
                error=None
            )
        else:
            return ExtractionResult(
                success=False,
                aadhar_number=None,
                address=None,
                mobile_number=None,
                source='pdf',
                extraction_method='folder_method',
                error='No content in response'
            )

    except Exception as e:
        logger.error(f"Error processing {pdf_path}: {str(e)}")
        return ExtractionResult(
            success=False,
            aadhar_number=None,
            address=None,
            mobile_number=None,
            source='pdf',
            extraction_method='folder_method',
            error=str(e)
        )
# API Routes
@app.get("/billing", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page"""
    return FileResponse("static/index.html")

@app.get("/dashboard", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page"""
    return FileResponse("static/dashboard.html")

@app.post("/search", response_model=List[CustomerSuggestion])
async def search_customers(request: SearchRequest):
    """Get real-time customer suggestions based on partial name"""
    if not request.customer_name.strip() or len(request.customer_name.strip()) < 2:
        return []

    suggestions = get_customer_suggestions(request.customer_name)
    logger.info(f"Found {len(suggestions)} suggestions for query: {request.customer_name}")
    return suggestions

@app.get("/extraction-methods")
async def get_extraction_methods():
    """Get available extraction methods and their descriptions"""
    return {
        "methods": [
            {
                "id": "folder_method",
                "name": "Folder Method",
                "description": "Select a customer folder containing PDF and/or images",
                "features": [
                    "Processes PDF files first",
                    "Falls back to images if PDF fails",
                    "Automatically finds front/back images",
                    "Works with existing customer folders"
                ],
                "endpoint": "/process-with-images",
                "method": "POST",
                "required_fields": ["folder_path"]
            },
            {
                "id": "image_upload",
                "name": "Image Upload",
                "description": "Upload front and back Aadhaar card images",
                "features": [
                    "Direct image upload",
                    "Supports front and back images",
                    "Immediate processing",
                    "No folder structure required"
                ],
                "endpoint": "/upload-aadhaar-images",
                "method": "POST",
                "required_fields": ["customer_name", "front_image OR back_image"]
            }
        ],
        "supported_formats": {
            "images": ["JPG", "JPEG", "PNG", "BMP", "TIFF", "GIF"],
            "pdf": ["PDF"]
        },
        "recommendations": [
            "Use folder method for existing customer data",
            "Use image upload for new customers or quick processing",
            "Both front and back images provide better accuracy",
            "Ensure images are clear and well-lit"
        ]
    }

def save_uploaded_image(uploaded_file: UploadFile, prefix: str = "aadhaar") -> str:
    """Save uploaded image with unique filename"""
    try:
        # Generate unique filename
        file_extension = uploaded_file.filename.split('.')[-1] if '.' in uploaded_file.filename else 'jpg'
        unique_filename = f"{prefix}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = Path(UPLOADED_IMAGES_FOLDER) / unique_filename

        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(uploaded_file.file, buffer)

        logger.info(f"Saved uploaded image: {file_path}")
        return str(file_path)

    except Exception as e:
        logger.error(f"Error saving uploaded image: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")

def extract_aadhaar_info_from_images_enhanced(front_image_path: Optional[str] = None, back_image_path: Optional[str] = None) -> ExtractionResult:
    """Enhanced Aadhaar information extraction from images with proper error handling"""
    try:
        logger.info(f"Starting image extraction - Front: {front_image_path}, Back: {back_image_path}")

        if not front_image_path and not back_image_path:
            return ExtractionResult(
                success=False,
                error="No image paths provided",
                source="images",
                extraction_method="image_upload"
            )

        results = {
            'front_result': None,
            'back_result': None,
            'combined_result': {},
            'success': False,
            'error': None
        }

        # Process front image
        if front_image_path and Path(front_image_path).exists():
            try:
                logger.info(f"Processing front image: {front_image_path}")

                front_response = image_agent.run(
                    "Carefully examine this Aadhaar card image and extract ALL visible information. "
                    "This is the front side of an Indian Aadhaar card. "
                    "IMPORTANT: Extract the actual text and numbers you see - do not return placeholder text like 'string' or 'number'. "
                    "Look for: "
                    "1. The 12-digit Aadhaar number (usually prominently displayed) "
                    "2. Person's full name "
                    "3. Date of birth in DD/MM/YYYY format "
                    "4. Gender (Male/Female) "
                    "5. Complete address with all details "
                    "6. Father's name if visible "
                    "7. Mobile number if visible "
                    "If any field is not clearly visible, leave it empty but do not use placeholder text.",
                    images=[Image(filepath=front_image_path)]
                )

                if front_response.content:
                    results['front_result'] = {
                        'aadharNumber': str(front_response.content.aadharNumber).strip() if front_response.content.aadharNumber else '',
                        'name': str(front_response.content.name).strip() if front_response.content.name else '',
                        'dateOfBirth': str(front_response.content.dateOfBirth).strip() if front_response.content.dateOfBirth else '',
                        'gender': str(front_response.content.gender).strip() if front_response.content.gender else '',
                        'address': str(front_response.content.address).strip() if front_response.content.address else '',
                        'fatherName': str(front_response.content.fatherName).strip() if front_response.content.fatherName else '',
                        'mobileNumber': str(front_response.content.mobileNumber).strip() if front_response.content.mobileNumber else '',
                        'source': 'front_image'
                    }
                    logger.info(f"Front image extraction successful")
                else:
                    results['front_result'] = {'error': 'No content extracted from front image'}

            except Exception as e:
                logger.error(f"Error processing front image: {e}")
                results['front_result'] = {'error': f'Front image processing failed: {str(e)}'}

        # Process back image
        if back_image_path and Path(back_image_path).exists():
            try:
                logger.info(f"Processing back image: {back_image_path}")

                back_response = image_agent.run(
                    "Carefully examine this Aadhaar card image and extract ALL visible information. "
                    "This is the back side of an Indian Aadhaar card. "
                    "IMPORTANT: Extract the actual text and numbers you see - do not return placeholder text like 'string' or 'number'. "
                    "Look for: "
                    "1. Complete address with all details (house number, street, village, district, state, PIN code) "
                    "2. Mobile number (10 digits) "
                    "3. Any other visible text or information "
                    "4. QR code information if readable "
                    "If any field is not clearly visible, leave it empty but do not use placeholder text.",
                    images=[Image(filepath=back_image_path)]
                )

                if back_response.content:
                    results['back_result'] = {
                        'aadharNumber': str(back_response.content.aadharNumber).strip() if back_response.content.aadharNumber else '',
                        'name': str(back_response.content.name).strip() if back_response.content.name else '',
                        'dateOfBirth': str(back_response.content.dateOfBirth).strip() if back_response.content.dateOfBirth else '',
                        'gender': str(back_response.content.gender).strip() if back_response.content.gender else '',
                        'address': str(back_response.content.address).strip() if back_response.content.address else '',
                        'fatherName': str(back_response.content.fatherName).strip() if back_response.content.fatherName else '',
                        'mobileNumber': str(back_response.content.mobileNumber).strip() if back_response.content.mobileNumber else '',
                        'source': 'back_image'
                    }
                    logger.info(f"Back image extraction successful")
                else:
                    results['back_result'] = {'error': 'No content extracted from back image'}

            except Exception as e:
                logger.error(f"Error processing back image: {e}")
                results['back_result'] = {'error': f'Back image processing failed: {str(e)}'}

        # Combine results intelligently
        combined = {}

        # Helper function to clean and validate data
        def is_valid_data(value):
            if not value:
                return False
            value_str = str(value).strip().lower()
            # Check for placeholder values
            invalid_values = ['string', 'number', 'text', 'none', 'null', 'undefined', 'n/a', 'na', '']
            return value_str not in invalid_values and len(value_str) > 0

        # Start with back image data (usually has better address)
        if results['back_result'] and 'error' not in results['back_result']:
            for key, value in results['back_result'].items():
                if is_valid_data(value) and key != 'source':
                    combined[key] = str(value).strip()

        # Override with front image data (usually more reliable for personal details)
        if results['front_result'] and 'error' not in results['front_result']:
            for key, value in results['front_result'].items():
                if is_valid_data(value) and key != 'source':
                    combined[key] = str(value).strip()

        # Additional validation for critical fields
        if 'aadharNumber' in combined:
            # Clean Aadhaar number - remove spaces and non-digits
            aadhaar_clean = ''.join(filter(str.isdigit, combined['aadharNumber']))
            if len(aadhaar_clean) == 12:
                combined['aadharNumber'] = aadhaar_clean
            else:
                logger.warning(f"Invalid Aadhaar number length: {len(aadhaar_clean)}")

        if 'mobileNumber' in combined:
            # Clean mobile number - remove spaces and non-digits
            mobile_clean = ''.join(filter(str.isdigit, combined['mobileNumber']))
            if len(mobile_clean) == 10:
                combined['mobileNumber'] = mobile_clean
            elif len(mobile_clean) == 0:
                combined['mobileNumber'] = ''
            else:
                logger.warning(f"Invalid mobile number length: {len(mobile_clean)}")

        # Validate essential fields
        essential_fields = ['aadharNumber', 'name']
        found_essential = sum(1 for field in essential_fields if is_valid_data(combined.get(field)))

        if found_essential >= 1:  # Need at least 1 essential field (name or aadhaar)
            results['success'] = True
            results['combined_result'] = combined
        else:
            results['success'] = False
            results['error'] = f'Insufficient data extracted. Found: {list(combined.keys())}'

        return ExtractionResult(
            success=results['success'],
            aadhar_number=combined.get('aadharNumber'),
            name=combined.get('name'),
            address=combined.get('address'),
            mobile_number=combined.get('mobileNumber'),
            date_of_birth=combined.get('dateOfBirth'),
            gender=combined.get('gender'),
            father_name=combined.get('fatherName'),
            error=results.get('error'),
            source='images',
            extraction_method='image_upload',
            image_results=results
        )

    except Exception as e:
        logger.error(f"Error in enhanced image extraction: {e}")
        return ExtractionResult(
            success=False,
            error=str(e),
            source='images',
            extraction_method='image_upload'
        )

def validate_image_quality(image_path: str) -> bool:
    """Check if image quality is sufficient for processing"""
    try:
        from PIL import Image as PILImage

        with PILImage.open(image_path) as img:
            width, height = img.size

            # Check minimum dimensions
            if width < 400 or height < 400:
                logger.warning(f"Image too small: {width}x{height}")
                return False

            # Check file size (too small might indicate poor quality)
            file_size = Path(image_path).stat().st_size
            if file_size < 50000:  # 50KB minimum
                logger.warning(f"Image file too small: {file_size} bytes")
                return False

            return True

    except Exception as e:
        logger.error(f"Error validating image quality: {e}")
        return False

def find_aadhaar_images(folder_path: Path) -> dict:
    """Find Aadhaar front and back images in the customer folder"""
    image_files = {
        'front': None,
        'back': None,
        'all_images': []
    }

    try:
        # Common image extensions
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff', '*.gif']

        # Find all image files
        all_images = []
        for ext in image_extensions:
            all_images.extend(folder_path.glob(ext))
            all_images.extend(folder_path.glob(ext.upper()))

        image_files['all_images'] = [str(img) for img in all_images]

        if not all_images:
            logger.info(f"No image files found in {folder_path}")
            return image_files

        # Look for front and back images based on filename patterns
        front_patterns = ['front', 'Front', 'FRONT', 'aadhaar_front', 'aadhar_front']
        back_patterns = ['back', 'Back', 'BACK', 'aadhaar_back', 'aadhar_back']

        for image in all_images:
            filename = image.name.lower()

            # Check for front patterns
            if any(pattern.lower() in filename for pattern in front_patterns):
                image_files['front'] = str(image)
                logger.info(f"Found front image: {image.name}")

            # Check for back patterns
            elif any(pattern.lower() in filename for pattern in back_patterns):
                image_files['back'] = str(image)
                logger.info(f"Found back image: {image.name}")

        # If no specific front/back found, assign first two images
        if not image_files['front'] and not image_files['back'] and len(all_images) > 0:
            if len(all_images) >= 2:
                image_files['front'] = str(all_images[0])
                image_files['back'] = str(all_images[1])
                logger.info(f"Auto-assigned front: {all_images[0].name}, back: {all_images[1].name}")
            else:
                image_files['front'] = str(all_images[0])
                logger.info(f"Auto-assigned single image as front: {all_images[0].name}")

        return image_files

    except Exception as e:
        logger.error(f"Error finding Aadhaar images: {e}")
        return image_files


@app.post("/upload-aadhaar-images", response_model=ExtractionResult)
async def upload_aadhaar_images(
    front_image: Optional[UploadFile] = File(None),
    back_image: Optional[UploadFile] = File(None),
    customer_name: str = Form(...),
    aadhaar_number: Optional[str] = Form(None)
):
    """Upload Aadhaar front and back images for extraction with auto-save to user folder"""
    try:
        logger.info(f"Processing uploaded images for customer: {customer_name}")

        if not front_image and not back_image:
            raise HTTPException(
                status_code=400,
                detail="At least one image (front or back) must be uploaded"
            )

        uploaded_paths = {}

        # Validate and save front image temporarily
        if front_image:
            if not front_image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="Front file must be an image")

            front_path = save_uploaded_image(front_image, "front")
            uploaded_paths['front_image_path'] = front_path

            if not validate_image_quality(front_path):
                logger.warning("Front image quality may be insufficient")

        # Validate and save back image temporarily
        if back_image:
            if not back_image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="Back file must be an image")

            back_path = save_uploaded_image(back_image, "back")
            uploaded_paths['back_image_path'] = back_path

            if not validate_image_quality(back_path):
                logger.warning("Back image quality may be insufficient")

        # Extract information from uploaded images
        result = extract_aadhaar_info_from_images_enhanced(
            front_image_path=uploaded_paths.get('front_image_path'),
            back_image_path=uploaded_paths.get('back_image_path')
        )

        # Log extraction results
        logger.info(f"Extraction result: {result}")

        if result.success and result.name:
            extracted_name = result.name
            extracted_aadhaar = result.aadhar_number

            logger.info(f"Successfully extracted: Name='{extracted_name}', Aadhaar='{extracted_aadhaar}'")

            # Try to find existing user folder
            user_folder = find_user_folder_by_name(extracted_name)

            if user_folder:
                logger.info(f"Found existing folder for '{extracted_name}': {user_folder.name}")

                # Save images to existing folder
                save_results = await save_aadhaar_images_to_folder(
                    folder_path=user_folder,
                    name=extracted_name,
                    front_image_path=uploaded_paths.get('front_image_path'),
                    back_image_path=uploaded_paths.get('back_image_path')
                )

                logger.info(f"Image save results: {save_results}")

                # Update the result with folder information
                result.folder_path = str(user_folder)
                result.images_saved = save_results

                print(f"\n{'='*60}")
                print(f"IMAGES SAVED TO EXISTING FOLDER")
                print(f"{'='*60}")
                print(f"Customer: {extracted_name}")
                print(f"Existing Folder: {user_folder.name}")
                print(f"Front Image: {save_results.get('front_saved', 'Not saved')}")
                print(f"Back Image: {save_results.get('back_saved', 'Not saved')}")
                print(f"{'='*60}\n")

            elif extracted_aadhaar:
                # Create new folder if no existing folder found and we have Aadhaar number
                logger.info(f"No existing folder found for '{extracted_name}'. Creating new folder.")

                try:
                    user_folder = create_user_folder_if_not_exists(extracted_name, extracted_aadhaar)

                    # Save images to new folder
                    save_results = await save_aadhaar_images_to_folder(
                        folder_path=user_folder,
                        name=extracted_name,
                        front_image_path=uploaded_paths.get('front_image_path'),
                        back_image_path=uploaded_paths.get('back_image_path')
                    )

                    result.folder_path = str(user_folder)
                    result.images_saved = save_results

                    print(f"\n{'='*60}")
                    print(f"NEW FOLDER CREATED AND IMAGES SAVED")
                    print(f"{'='*60}")
                    print(f"Customer: {extracted_name}")
                    print(f"New Folder: {user_folder.name}")
                    print(f"Front Image: {save_results.get('front_saved', 'Not saved')}")
                    print(f"Back Image: {save_results.get('back_saved', 'Not saved')}")
                    print(f"{'='*60}\n")

                except Exception as folder_error:
                    logger.error(f"Failed to create new folder: {folder_error}")
                    # Continue without saving to folder
            else:
                logger.warning(f"Cannot save images: No existing folder found and no Aadhaar number extracted")

            # Set extracted data for response
            window_extracted_data = {
                'name': result.name or '',
                'aadhaar': result.aadhar_number or '',
                'address': result.address or '',
                'mobile': result.mobile_number or '',
                'folder': getattr(result, 'folder_path', 'Image Upload'),
                'extraction_method': 'enhanced_image_upload_with_save'
            }

            # Log success
            print(f"\n{'='*60}")
            print(f"ENHANCED IMAGE EXTRACTION SUCCESSFUL")
            print(f"{'='*60}")
            print(f"Extracted Name: {result.name}")
            print(f"Aadhaar Number: {result.aadhar_number}")
            print(f"Address: {result.address}")
            print(f"Mobile Number: {result.mobile_number}")
            print(f"Enhancement: Auto-crop + Quality boost applied")
            print(f"Folder Management: {'Saved to existing folder' if user_folder else 'No folder action'}")
            print(f"Method: Enhanced Image Upload with Auto-Save")
            print(f"{'='*60}\n")

        else:
            logger.warning("Extraction failed or no name found - cannot save to user folder")
            print(f"\n{'='*60}")
            print(f"IMAGE UPLOAD EXTRACTION FAILED")
            print(f"{'='*60}")
            print(f"Customer Name: {customer_name}")
            print(f"Error: {result.error}")
            print(f"Uploaded Files: {list(uploaded_paths.keys())}")
            print(f"{'='*60}\n")

        # Clean up temporary files
        try:
            for temp_path in uploaded_paths.values():
                if temp_path and Path(temp_path).exists():
                    Path(temp_path).unlink()
                    logger.debug(f"Cleaned up temporary file: {temp_path}")
        except Exception as cleanup_error:
            logger.warning(f"Error cleaning up temporary files: {cleanup_error}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload Aadhaar images: {e}")
        raise HTTPException(status_code=500, detail=f"Image upload processing failed: {str(e)}")

# Add this new endpoint to check folder status
@app.get("/check-user-folder/{name}")
async def check_user_folder(name: str):
    """Check if a user folder exists for the given name"""
    try:
        user_folder = find_user_folder_by_name(name)

        if user_folder:
            # List existing files in the folder
            existing_files = []
            for file in user_folder.iterdir():
                if file.is_file() and file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.pdf']:
                    existing_files.append(file.name)

            return {
                "folder_exists": True,
                "folder_path": str(user_folder),
                "folder_name": user_folder.name,
                "existing_files": existing_files
            }
        else:
            return {
                "folder_exists": False,
                "message": f"No folder found for name: {name}"
            }

    except Exception as e:
        logger.error(f"Error checking user folder: {e}")
        return {
            "folder_exists": False,
            "error": str(e)
        }

@app.post("/process-with-images", response_model=ExtractionResult)
async def process_customer_with_images(request: ImageProcessRequest):
    """Process customer folder with PDF + Image fallback support"""
    folder_path = Path(request.folder_path)

    logger.info(f"=== ENHANCED PROCESSING START ===")
    logger.info(f"Folder path: {folder_path}")
    logger.info(f"Use images if PDF fails: {request.use_images_if_pdf_fails}")

    if not folder_path.exists() or not folder_path.is_dir():
        logger.error(f"Customer folder not found: {folder_path}")
        raise HTTPException(status_code=404, detail="Customer folder not found")

    try:
        folder_parts = folder_path.name.split('_')
        person_name = folder_path.name

        if len(folder_parts) >= 2:
            name_part = '_'.join(folder_parts[:-1])
            name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
            if name_match:
                person_name = name_match.group(1)

        # STEP 1: Try the original PDF processing method first
        expected_uid_filename = create_uid_filename(person_name)
        logger.info(f"Looking for UID file: {expected_uid_filename}")

        uid_file_path = find_uid_file(folder_path, expected_uid_filename)

        if uid_file_path:
            logger.info(f"Found UID file: {uid_file_path}")
            logger.info("Using original PDF processing method...")

            try:
                # Use the original extract_aadhaar_info_original function
                pdf_result = extract_aadhaar_info_original(uid_file_path)
                logger.info(f"Original PDF extraction success: {pdf_result.success}")

                if pdf_result.success:
                    logger.info("Original PDF extraction successful, returning results")
                    logger.info(f"PDF extracted data: Aadhaar={pdf_result.aadhar_number}, Mobile={pdf_result.mobile_number}")
                    return pdf_result
                else:
                    logger.warning(f"Original PDF extraction failed: {pdf_result.error}")
            except Exception as pdf_error:
                logger.error(f"Original PDF processing failed: {pdf_error}")
        else:
            logger.warning(f"No UID file found for: {expected_uid_filename}")

        # STEP 2: Try image extraction if PDF failed and images are available
        if request.use_images_if_pdf_fails:
            logger.info("PDF extraction failed or not found, checking for images...")

            image_files = find_aadhaar_images(folder_path)
            logger.info(f"Image scan result: {image_files}")

            # Check if we actually have usable images
            has_images = bool(image_files['front'] or image_files['back'])

            if has_images:
                logger.info(f"Found usable images - Front: {image_files['front']}, Back: {image_files['back']}")

                image_result = extract_aadhaar_info_from_images_enhanced(
                    front_image_path=image_files['front'],
                    back_image_path=image_files['back']
                )

                logger.info(f"Image extraction success: {image_result.success}")
                if image_result.success:
                    image_result.extraction_method = 'folder_method_images'
                    logger.info("Image extraction successful from folder")
                    logger.info(f"Image extracted data: Aadhaar={image_result.aadhar_number}, Mobile={image_result.mobile_number}")
                    return image_result
                else:
                    logger.warning(f"Image extraction failed: {image_result.error}")
            else:
                logger.info("No usable images found in folder")

        # STEP 3: Return error if both methods failed
        error_msg = "Document processing failed"
        error_details = []

        if uid_file_path:
            error_details.append("PDF processing failed")
        else:
            error_details.append("No PDF file found")

        if request.use_images_if_pdf_fails:
            if not has_images:
                error_details.append("No images found in folder")
            else:
                error_details.append("Image processing also failed")
        else:
            error_details.append("Image fallback disabled")

        error_msg += ". " + "; ".join(error_details)

        logger.error(error_msg)
        return ExtractionResult(
            success=False,
            error=error_msg,
            source='folder',
            extraction_method='folder_method'
        )

    except Exception as e:
        logger.error(f"Error processing customer with images: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
def extract_aadhaar_info_original(pdf_path: Path) -> ExtractionResult:
    """Original PDF extraction method that was working"""
    try:
        logger.info(f"Processing PDF with original method: {pdf_path}")

        response = pdf_agent.run(
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
                source='pdf',
                extraction_method='folder_method_original',
                error=None
            )
        else:
            return ExtractionResult(
                success=False,
                aadhar_number=None,
                address=None,
                mobile_number=None,
                source='pdf',
                extraction_method='folder_method_original',
                error='No content in response'
            )

    except Exception as e:
        logger.error(f"Error processing {pdf_path} with original method: {str(e)}")
        return ExtractionResult(
            success=False,
            aadhar_number=None,
            address=None,
            mobile_number=None,
            source='pdf',
            extraction_method='folder_method_original',
            error=str(e)
        )
@app.post("/process", response_model=ExtractionResult)
async def process_customer(request: ProcessRequest):
    """Process the selected customer folder to extract Aadhaar information (PDF only - legacy method)"""
    folder_path = Path(request.folder_path)

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Customer folder not found")

    logger.info(f"Processing customer folder (PDF only): {folder_path}")

    try:
        folder_parts = folder_path.name.split('_')
        person_name = folder_path.name

        if len(folder_parts) >= 2:
            name_part = '_'.join(folder_parts[:-1])
            name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
            if name_match:
                person_name = name_match.group(1)

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
            print(f"DOCUMENT EXTRACTION SUCCESSFUL (PDF)")
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
            print(f"DOCUMENT EXTRACTION FAILED (PDF)")
            print(f"{'='*60}")
            print(f"Customer Folder: {folder_path.name}")
            print(f"Customer Name: {person_name}")
            print(f"Error: {result.error}")
            print(f"{'='*60}\n")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing customer: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


# NEW API ENDPOINT FOR SALES DATA
@app.get("/sales-data")
async def get_sales_data():
    """Get sales data from sales.xlsx"""
    try:
        sales_file = Path("sales.xlsx")
        if not sales_file.exists():
            return {"sales": [], "total_sales": 0, "total_revenue": 0}

        sales_df = pd.read_excel("sales.xlsx")
        sales_records = sales_df.to_dict('records')

        # Calculate totals
        total_sales = len(sales_records)
        total_revenue = sales_df['total_amount'].sum() if 'total_amount' in sales_df.columns else 0

        return {
            "sales": sales_records,
            "total_sales": total_sales,
            "total_revenue": total_revenue,
            "success": True
        }

    except Exception as e:
        logger.error(f"Error reading sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read sales data: {str(e)}")

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
            print(f"Chassis: {billing_data.chassis_number}")
            print(f"Batteries: {', '.join(billing_data.selected_batteries)}")
            print(f"HSN Code: {billing_data.hsn_code}")
            print(f"Base Amount: ₹{billing_data.base_amount:.2f}")
            print(f"Bill Number: {result.bill_number}")
            print(f"Invoice Number: {result.invoice_number}")
            if result.cgst:
                print(f"CGST: ₹{result.cgst:.2f}")
            if result.sgst:
                print(f"SGST: ₹{result.sgst:.2f}")
            if result.igst:
                print(f"IGST: ₹{result.igst:.2f}")
            if result.total_amount:
                print(f"Total Amount: ₹{result.total_amount:.2f}")
            if result.amount_in_words:
                print(f"Amount in Words: {result.amount_in_words}")
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

    return {
        "template_available": template_file is not None,
        "template_path": str(template_file) if template_file else None,
        "templates_folder": TEMPLATES_FOLDER,
        "template_type": "docx"
    }

@app.post("/calculate-bill-amount")
async def calculate_bill_amount(data: Dict[str, Any]):
    """Calculate base amount and taxes from final amount for preview"""
    try:
        final_amount = float(data.get('base_amount', 0))  # This parameter name is misleading but kept for compatibility
        use_igst = bool(data.get('use_igst', False))

        if final_amount <= 0:
            final_amount = 178899.90  # Default final amount

        # Use reverse calculation to get base amount from final amount
        financial_data = calculate_base_amount_from_final(final_amount, use_igst)
        amount_in_words = number_to_words(financial_data['total_amount'])

        return {
            "success": True,
            "subtotal": financial_data['subtotal'],      # This is the CALCULATED base amount
            "cgst": financial_data['cgst'],
            "sgst": financial_data['sgst'],
            "igst": financial_data['igst'],
            "round_off": financial_data['round_off'],
            "total_amount": financial_data['total_amount'],  # This should match the input final_amount
            "amount_in_words": amount_in_words,
            "use_igst": use_igst
        }

    except Exception as e:
        logger.error(f"Error calculating bill amount: {str(e)}")
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
            "financial_calculations": True,
            "tax_calculations": True,
            "amount_in_words": True,
            "invoice_numbering": True,
            "real_time_search": True,
            "docx_templates": True
        }
    }

@app.get("/api/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics with profit/loss analysis"""
    try:
        # Update cache if it's older than 5 minutes
        if (not analytics_cache['last_updated'] or
            datetime.now() - analytics_cache['last_updated'] > timedelta(minutes=5)):
            update_analytics_cache()

        return analytics_cache['stats']
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        # Return fallback data
        return {
            'total_revenue': 0, 'total_sales': 0, 'total_customers': 0,
            'total_profit': 0, 'avg_profit_margin': 0, 'inventory_count': 0,
            'revenue_growth': 0, 'sales_growth': 0, 'customer_growth': 0,
            'profit_growth': 0
        }

@app.get("/api/dashboard/revenue-data")
async def get_revenue_data(period: str = Query('30d', regex='^(7d|30d|90d|1y)$')):
    """Get revenue and profit chart data for specified period"""
    try:
        data = generate_revenue_chart_data(period)
        return data
    except Exception as e:
        logger.error(f"Error getting revenue data: {e}")
        return []

@app.get("/api/dashboard/activities")
async def get_recent_activities():
    """Get recent sales activities for dashboard"""
    try:
        if (not analytics_cache['last_updated'] or
            datetime.now() - analytics_cache['last_updated'] > timedelta(minutes=5)):
            update_analytics_cache()

        return analytics_cache['activities']
    except Exception as e:
        logger.error(f"Error getting activities: {e}")
        return []

@app.get("/api/analytics/profit-analysis")
async def get_profit_analysis():
    """Get detailed profit/loss analysis"""
    try:
        enriched_sales = calculate_sale_profitability()

        if not enriched_sales:
            return {
                'total_sales': 0,
                'profitable_sales': 0,
                'loss_sales': 0,
                'break_even_sales': 0,
                'total_profit': 0,
                'total_loss': 0,
                'avg_profit_margin': 0,
                'profitability_ratio': 0,
                'highest_profit_sale': None,
                'highest_loss_sale': None
            }

        df = pd.DataFrame(enriched_sales)

        # Calculate metrics
        profitable_sales = len(df[df['profit'] > 0])
        loss_sales = len(df[df['profit'] < 0])
        break_even_sales = len(df[df['profit'] == 0])

        total_profit = df[df['profit'] > 0]['profit'].sum()
        total_loss = abs(df[df['profit'] < 0]['profit'].sum())
        avg_profit_margin = df['profit_margin'].mean()

        # Find highest profit and loss sales
        highest_profit_sale = None
        highest_loss_sale = None

        if profitable_sales > 0:
            max_profit_row = df.loc[df['profit'].idxmax()]
            highest_profit_sale = {
                'bill_number': max_profit_row['bill_number'],
                'customer_name': max_profit_row['customer_name'],
                'profit': round(max_profit_row['profit'], 2),
                'profit_margin': round(max_profit_row['profit_margin'], 2)
            }

        if loss_sales > 0:
            min_profit_row = df.loc[df['profit'].idxmin()]
            highest_loss_sale = {
                'bill_number': min_profit_row['bill_number'],
                'customer_name': min_profit_row['customer_name'],
                'loss': round(abs(min_profit_row['profit']), 2),
                'loss_margin': round(abs(min_profit_row['profit_margin']), 2)
            }

        return {
            'total_sales': len(enriched_sales),
            'profitable_sales': profitable_sales,
            'loss_sales': loss_sales,
            'break_even_sales': break_even_sales,
            'total_profit': round(total_profit, 2),
            'total_loss': round(total_loss, 2),
            'net_profit': round(total_profit - total_loss, 2),
            'avg_profit_margin': round(avg_profit_margin, 2),
            'profitability_ratio': round((profitable_sales / len(enriched_sales)) * 100, 1),
            'highest_profit_sale': highest_profit_sale,
            'highest_loss_sale': highest_loss_sale
        }

    except Exception as e:
        logger.error(f"Error getting profit analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/sales-data")
async def get_sales_data():
    """Get all sales data with profit/loss calculations"""
    try:
        enriched_sales = calculate_sale_profitability()

        # Calculate totals
        total_sales = len(enriched_sales)
        total_revenue = sum(sale.get('total_amount', 0) for sale in enriched_sales)
        total_profit = sum(sale.get('profit', 0) for sale in enriched_sales)

        return {
            "sales": enriched_sales,
            "total_sales": total_sales,
            "total_revenue": round(total_revenue, 2),
            "total_profit": round(total_profit, 2),
            "success": True
        }

    except Exception as e:
        logger.error(f"Error reading sales data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read sales data: {str(e)}")

def extract_aadhaar_info_from_images(front_image_path: Optional[str] = None, back_image_path: Optional[str] = None) -> dict:
    """Extract Aadhaar information from front and/or back images"""
    try:
        results = {
            'front_result': None,
            'back_result': None,
            'combined_result': {},
            'success': False,
            'error': None
        }

        # Process front image
        if front_image_path and Path(front_image_path).exists():
            try:
                logger.info(f"Processing front image: {front_image_path}")

                front_response = image_agent.run(
                    "Extract all visible information from this Aadhaar card front side image. "
                    "Look for: Aadhaar number (12 digits), person's name, date of birth, gender, "
                    "address, father's name, and any other visible details.",
                    images=[Image(filepath=front_image_path)]
                )

                if front_response.content:
                    results['front_result'] = {
                        'aadharNumber': front_response.content.aadharNumber,
                        'name': front_response.content.name,
                        'dateOfBirth': front_response.content.dateOfBirth,
                        'gender': front_response.content.gender,
                        'address': front_response.content.address,
                        'fatherName': front_response.content.fatherName,
                        'mobileNumber': front_response.content.mobileNumber,
                        'source': 'front_image'
                    }
                    logger.info(f"Front image extraction successful")
                else:
                    results['front_result'] = {'error': 'No content extracted from front image'}

            except Exception as e:
                logger.error(f"Error processing front image: {e}")
                results['front_result'] = {'error': f'Front image processing failed: {str(e)}'}

        # Process back image
        if back_image_path and Path(back_image_path).exists():
            try:
                logger.info(f"Processing back image: {back_image_path}")

                back_response = image_agent.run(
                    "Extract all visible information from this Aadhaar card back side image. "
                    "Look for: address details, mobile number, email, QR code information, "
                    "and any other visible text or numbers.",
                    images=[Image(filepath=back_image_path)]
                )

                if back_response.content:
                    results['back_result'] = {
                        'aadharNumber': back_response.content.aadharNumber,
                        'name': back_response.content.name,
                        'dateOfBirth': back_response.content.dateOfBirth,
                        'gender': back_response.content.gender,
                        'address': back_response.content.address,
                        'fatherName': back_response.content.fatherName,
                        'mobileNumber': back_response.content.mobileNumber,
                        'source': 'back_image'
                    }
                    logger.info(f"Back image extraction successful")
                else:
                    results['back_result'] = {'error': 'No content extracted from back image'}

            except Exception as e:
                logger.error(f"Error processing back image: {e}")
                results['back_result'] = {'error': f'Back image processing failed: {str(e)}'}

        # Combine results from both images (front takes priority for conflicting data)
        combined = {}

        # Start with back image data
        if results['back_result'] and 'error' not in results['back_result']:
            for key, value in results['back_result'].items():
                if value and value.strip():  # Only use non-empty values
                    combined[key] = value

        # Override with front image data (usually more reliable)
        if results['front_result'] and 'error' not in results['front_result']:
            for key, value in results['front_result'].items():
                if value and value.strip():  # Only use non-empty values
                    combined[key] = value

        # Set success status
        if combined:
            results['success'] = True
            results['combined_result'] = combined
        else:
            results['success'] = False
            results['error'] = 'No data could be extracted from the images'

        return results

    except Exception as e:
        logger.error(f"Error in image extraction: {e}")
        return {
            'success': False,
            'error': str(e),
            'front_result': None,
            'back_result': None,
            'combined_result': {}
        }

# Add these new API endpoints

@app.post("/test-image-extraction", response_model=ImageExtractionTestResult)
async def test_image_extraction(request: ImageExtractionTestRequest):
    """Test endpoint for Aadhaar image extraction with front and/or back images"""
    try:
        logger.info(f"Testing image extraction with:")
        logger.info(f"  Front image: {request.front_image_path}")
        logger.info(f"  Back image: {request.back_image_path}")

        # Validate that at least one image path is provided
        if not request.front_image_path and not request.back_image_path:
            raise HTTPException(
                status_code=400,
                detail="At least one image path (front_image_path or back_image_path) must be provided"
            )

        # Validate that provided image files exist
        if request.front_image_path and not Path(request.front_image_path).exists():
            raise HTTPException(
                status_code=404,
                detail=f"Front image file not found: {request.front_image_path}"
            )

        if request.back_image_path and not Path(request.back_image_path).exists():
            raise HTTPException(
                status_code=404,
                detail=f"Back image file not found: {request.back_image_path}"
            )

        # Extract information from images
        extraction_results = extract_aadhaar_info_from_images(
            front_image_path=request.front_image_path,
            back_image_path=request.back_image_path
        )

        # Print results to console
        print(f"\n{'='*60}")
        print(f"IMAGE EXTRACTION TEST RESULTS")
        print(f"{'='*60}")
        print(f"Front Image: {request.front_image_path or 'Not provided'}")
        print(f"Back Image: {request.back_image_path or 'Not provided'}")
        print(f"Success: {extraction_results['success']}")

        if extraction_results['success']:
            combined = extraction_results['combined_result']
            print(f"Extracted Information:")
            print(f"  Aadhaar Number: {combined.get('aadharNumber', 'Not found')}")
            print(f"  Name: {combined.get('name', 'Not found')}")
            print(f"  Date of Birth: {combined.get('dateOfBirth', 'Not found')}")
            print(f"  Gender: {combined.get('gender', 'Not found')}")
            print(f"  Father's Name: {combined.get('fatherName', 'Not found')}")
            print(f"  Address: {combined.get('address', 'Not found')}")
            print(f"  Mobile Number: {combined.get('mobileNumber', 'Not found')}")
        else:
            print(f"Error: {extraction_results.get('error', 'Unknown error')}")

        print(f"{'='*60}\n")

        return ImageExtractionTestResult(
            success=extraction_results['success'],
            front_result=extraction_results['front_result'],
            back_result=extraction_results['back_result'],
            combined_result=extraction_results['combined_result'],
            error=extraction_results.get('error')
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in test image extraction: {e}")
        raise HTTPException(status_code=500, detail=f"Image extraction test failed: {str(e)}")

@app.post("/upload-and-test-images")
async def upload_and_test_images(
    front_image: Optional[UploadFile] = File(None),
    back_image: Optional[UploadFile] = File(None)
):
    """Upload images and test extraction (alternative endpoint for file uploads)"""
    try:
        if not front_image and not back_image:
            raise HTTPException(
                status_code=400,
                detail="At least one image file must be uploaded"
            )

        uploaded_paths = {}

        # Save uploaded front image
        if front_image:
            if not front_image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="Front file must be an image")

            front_path = Path(UPLOADED_IMAGES_FOLDER) / f"front_{front_image.filename}"
            with open(front_path, "wb") as buffer:
                shutil.copyfileobj(front_image.file, buffer)
            uploaded_paths['front_image_path'] = str(front_path)

        # Save uploaded back image
        if back_image:
            if not back_image.content_type.startswith('image/'):
                raise HTTPException(status_code=400, detail="Back file must be an image")

            back_path = Path(UPLOADED_IMAGES_FOLDER) / f"back_{back_image.filename}"
            with open(back_path, "wb") as buffer:
                shutil.copyfileobj(back_image.file, buffer)
            uploaded_paths['back_image_path'] = str(back_path)

        # Extract information from uploaded images
        extraction_results = extract_aadhaar_info_from_images(
            front_image_path=uploaded_paths.get('front_image_path'),
            back_image_path=uploaded_paths.get('back_image_path')
        )

        return {
            "uploaded_files": uploaded_paths,
            "extraction_results": extraction_results,
            "success": extraction_results['success']
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in upload and test: {e}")
        raise HTTPException(status_code=500, detail=f"Upload and test failed: {str(e)}")

# Add this endpoint to test with sample images
@app.get("/test-image-extraction-sample")
async def test_with_sample_images():
    """Test image extraction with sample images (if available)"""
    try:
        # Look for sample images in the current directory
        sample_front = None
        sample_back = None

        # Common sample image names to look for
        sample_names = [
            'aadhaar_front.jpg', 'aadhaar_front.png', 'front.jpg', 'front.png',
            'sample_front.jpg', 'sample_front.png'
        ]

        back_names = [
            'aadhaar_back.jpg', 'aadhaar_back.png', 'back.jpg', 'back.png',
            'sample_back.jpg', 'sample_back.png'
        ]

        # Check for sample front images
        for name in sample_names:
            if Path(name).exists():
                sample_front = str(Path(name))
                break

        # Check for sample back images
        for name in back_names:
            if Path(name).exists():
                sample_back = str(Path(name))
                break

        if not sample_front and not sample_back:
            return {
                "message": "No sample images found. Please place sample Aadhaar images in the root directory with names like 'aadhaar_front.jpg' or 'aadhaar_back.jpg'",
                "success": False,
                "looked_for": {
                    "front_names": sample_names,
                    "back_names": back_names
                }
            }

        # Test with found sample images
        extraction_results = extract_aadhaar_info_from_images(
            front_image_path=sample_front,
            back_image_path=sample_back
        )

        return {
            "sample_images": {
                "front": sample_front,
                "back": sample_back
            },
            "extraction_results": extraction_results,
            "success": extraction_results['success']
        }

    except Exception as e:
        logger.error(f"Error in sample test: {e}")
        raise HTTPException(status_code=500, detail=f"Sample test failed: {str(e)}")

def find_user_folder_by_name(name: str) -> Optional[Path]:
    """Find existing user folder by name in the Data directory"""
    try:
        base_path = Path(DATA_FOLDER_PATH)
        if not base_path.exists():
            logger.warning(f"Data folder does not exist: {DATA_FOLDER_PATH}")
            return None

        # Clean the extracted name for comparison
        clean_name = clean_name_for_comparison(name)
        logger.info(f"Searching for folder matching name: '{name}' (cleaned: '{clean_name}')")

        for folder in base_path.iterdir():
            if not folder.is_dir():
                continue

            # Parse folder name: format is usually "### NAME_AADHAAR"
            folder_parts = folder.name.split('_')
            if len(folder_parts) >= 2:
                # Extract name part (everything except last part which is Aadhaar number)
                name_part = '_'.join(folder_parts[:-1])

                # Remove leading numbers (e.g., "001 John Doe" -> "John Doe")
                name_match = re.match(r'^\d{3}\s+(.+)$', name_part)
                if name_match:
                    folder_name = name_match.group(1)
                    clean_folder_name = clean_name_for_comparison(folder_name)

                    logger.debug(f"Comparing '{clean_name}' with folder '{clean_folder_name}'")

                    # Check for exact match or partial match
                    if (clean_name == clean_folder_name or
                        clean_name in clean_folder_name or
                        clean_folder_name in clean_name):

                        logger.info(f"Found matching folder: {folder.name}")
                        return folder

        logger.info(f"No matching folder found for name: '{name}'")
        return None

    except Exception as e:
        logger.error(f"Error searching for user folder: {e}")
        return None

def clean_name_for_comparison(name: str) -> str:
    """Clean name for better comparison"""
    if not name:
        return ""

    # Convert to uppercase, remove extra spaces, special characters
    cleaned = re.sub(r'[^\w\s]', '', name.upper())
    cleaned = ' '.join(cleaned.split())  # Remove extra spaces
    return cleaned
import io
async def save_aadhaar_images_to_folder(
    folder_path: Path,
    name: str,
    front_image_file: Optional[UploadFile] = None,
    back_image_file: Optional[UploadFile] = None,
    front_image_path: Optional[str] = None,
    back_image_path: Optional[str] = None
) -> Dict[str, str]:
    """Save Aadhaar images to the user's existing folder"""
    try:
        results = {"front_saved": None, "back_saved": None, "folder_path": str(folder_path)}

        # Clean username for filename
        clean_username = re.sub(r'[^\w\s-]', '', name).strip()
        clean_username = re.sub(r'[-\s]+', '_', clean_username).upper()

        logger.info(f"Saving images to folder: {folder_path}")
        logger.info(f"Clean username for files: {clean_username}")

        # Save front image
        if front_image_file or front_image_path:
            front_filename = f"UID_{clean_username}_FRONT.jpg"
            front_save_path = folder_path / front_filename

            if front_image_file:
                # Save from uploaded file
                await save_image_file(front_image_file, front_save_path)
            elif front_image_path and Path(front_image_path).exists():
                # Copy from enhanced image path
                shutil.copy2(front_image_path, front_save_path)

            if front_save_path.exists():
                results["front_saved"] = str(front_save_path)
                logger.info(f"Front image saved: {front_filename}")

        # Save back image
        if back_image_file or back_image_path:
            back_filename = f"UID_{clean_username}_BACK.jpg"
            back_save_path = folder_path / back_filename

            if back_image_file:
                # Save from uploaded file
                await save_image_file(back_image_file, back_save_path)
            elif back_image_path and Path(back_image_path).exists():
                # Copy from enhanced image path
                shutil.copy2(back_image_path, back_save_path)

            if back_save_path.exists():
                results["back_saved"] = str(back_save_path)
                logger.info(f"Back image saved: {back_filename}")

        return results

    except Exception as e:
        logger.error(f"Error saving Aadhaar images: {e}")
        return {"error": str(e), "folder_path": str(folder_path)}

async def save_image_file(image_file: UploadFile, save_path: Path) -> bool:
    """Save uploaded image file to specified path with optimization"""
    try:
        # Read the uploaded file
        contents = await image_file.read()

        # Open with PIL for optimization
        with Image.open(io.BytesIO(contents)) as img:
            # Convert to RGB if necessary
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Optimize and save
            img.save(save_path, 'JPEG', quality=85, optimize=True)

        logger.info(f"Image saved successfully: {save_path}")
        return True

    except Exception as e:
        logger.error(f"Error saving image file: {e}")
        return False

def create_user_folder_if_not_exists(name: str, aadhaar_number: str) -> Path:
    """Create a new user folder if it doesn't exist"""
    try:
        base_path = Path(DATA_FOLDER_PATH)
        base_path.mkdir(exist_ok=True)

        # Generate folder name: "001 NAME_AADHAAR"
        existing_folders = [f for f in base_path.iterdir() if f.is_dir()]
        next_number = len(existing_folders) + 1

        clean_name = re.sub(r'[^\w\s-]', '', name).strip()
        clean_name = re.sub(r'[-\s]+', '_', clean_name).upper()

        folder_name = f"{next_number:03d} {clean_name}_{aadhaar_number}"
        folder_path = base_path / folder_name

        folder_path.mkdir(exist_ok=True)
        logger.info(f"Created new user folder: {folder_name}")

        return folder_path

    except Exception as e:
        logger.error(f"Error creating user folder: {e}")
        raise

if __name__ == "__main__":
    import uvicorn

    Path("static").mkdir(exist_ok=True)

    print("Starting Minato Enterprises Document Processor & Billing System...")
    print(f"Data folder: {DATA_FOLDER_PATH}")
    print(f"Templates folder: {TEMPLATES_FOLDER}")
    print(f"Bills folder: {INVOICES_FOLDER}")
    print("Template type: Word Document (.docx)")
    print("Features enabled:")
    print("  - Aadhaar number extraction")
    print("  - Address extraction")
    print("  - Mobile number extraction")
    print("  - Real-time chassis filtering")
    print("  - Real-time battery filtering")
    print("  - HSN code selection")
    print("  - Financial calculations (CGST/SGST/IGST)")
    print("  - Tax calculations based on state")
    print("  - Amount in words conversion")
    print("  - Invoice numbering system")
    print("  - Bill generation with DocxTemplate")
    print("  - Real-time customer search")
    print("Server will be available at: http://localhost:8000")

    uvicorn.run(app, host="0.0.0.0", port=8000)