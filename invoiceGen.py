import os
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional
from docxtpl import DocxTemplate
from pydantic import BaseModel, Field
from agno.agent import Agent
from agno.models.google import Gemini
from agno.media import File

# Configuration
GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"  # Your API key
TEMPLATE_PATH = "templates/template.docx"  # Path to your Word template
OUTPUT_FOLDER = "generated_invoices"  # Folder for generated invoices

class AadhaarExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract only the 12-digit aadhar number from the given pdf")
    address: str = Field(..., description="Extract only the residential address in simple format. Do not include VTC, PO, Sub District, District details. Just extract the house/building name, road/street name, area name, city and state. Do not include the aadhar number in address.")
    name: str = Field(..., description="Extract the person's name from the given pdf")

class InvoiceGenerator:
    def __init__(self, template_path: str = TEMPLATE_PATH, api_key: str = GOOGLE_API_KEY):
        """
        Initialize the Invoice Generator

        Args:
            template_path (str): Path to the Word template file
            api_key (str): Google API key for Gemini
        """
        self.template_path = Path(template_path)
        self.api_key = api_key
        self.output_folder = Path(OUTPUT_FOLDER)

        # Create output folder if it doesn't exist
        self.output_folder.mkdir(exist_ok=True)

        # Setup logging
        self.setup_logging()

        # Initialize the agent for Aadhaar extraction
        self.agent = Agent(
            model=Gemini(id="gemini-1.5-flash", api_key=api_key),
            description="You extract clean, simple Aadhaar number and residential address from PDF documents. For address, extract only basic residential details like house/building name, road/street, area, city, and state. Do not include administrative details like VTC, PO, Sub District, District, PIN codes, or the Aadhaar number itself.",
            response_model=AadhaarExtraction,
        )

        # Validate template exists
        if not self.template_path.exists():
            raise FileNotFoundError("Template file not found: " + str(self.template_path))

    def setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def extract_aadhaar_info_from_pdf(self, pdf_path: Path) -> Dict:
        """
        Extract Aadhaar information from PDF using AI agent

        Args:
            pdf_path (Path): Path to the PDF file

        Returns:
            Dict: Extracted information or error details
        """
        try:
            self.logger.info("Extracting information from: " + str(pdf_path))

            response = self.agent.run(
                "Please extract the 12-digit Aadhaar number and clean residential address. For the address, only include house/building name, road/street name, area, city and state. Do not include VTC, PO, Sub District, District, PIN code details or the Aadhaar number in the address field.",
                files=[File(filepath=pdf_path)]
            )

            if response.content:
                return {
                    'success': True,
                    'name': response.content.name,
                    'aadhaar_number': response.content.aadharNumber,
                    'address': response.content.address,
                    'error': None
                }
            else:
                return {
                    'success': False,
                    'error': 'No content in response'
                }

        except Exception as e:
            self.logger.error("Error extracting information from " + str(pdf_path) + ": " + str(e))
            return {
                'success': False,
                'error': str(e)
            }

    def clean_aadhaar_number(self, aadhaar_number: str) -> str:
        """
        Clean and format Aadhaar number

        Args:
            aadhaar_number (str): Raw Aadhaar number

        Returns:
            str: Cleaned Aadhaar number
        """
        if aadhaar_number:
            # Remove any spaces, hyphens, or other non-digit characters
            clean_number = re.sub(r'[^\d]', '', aadhaar_number)

            # Validate that it's exactly 12 digits
            if len(clean_number) == 12 and clean_number.isdigit():
                # Format as XXXX XXXX XXXX
                return clean_number[:4] + " " + clean_number[4:8] + " " + clean_number[8:]

            # If it's longer than 12 digits, try to extract 12 consecutive digits
            if len(clean_number) > 12:
                match = re.search(r'\d{12}', clean_number)
                if match:
                    number = match.group()
                    return number[:4] + " " + number[4:8] + " " + number[8:]

        return aadhaar_number  # Return as-is if can't clean

    def clean_address(self, address: str) -> str:
        """
        Clean the address by removing unwanted administrative details and Aadhaar numbers

        Args:
            address (str): Raw address string

        Returns:
            str: Cleaned address string
        """
        if not address:
            return ""

        # Remove Aadhaar numbers (12 digits with or without spaces/hyphens)
        address = re.sub(r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b', '', address)

        # Remove unwanted administrative terms and their values
        unwanted_patterns = [
            r'VTC:\s*[^,\n]*[,\n]?',
            r'PO:\s*[^,\n]*[,\n]?',
            r'Sub District:\s*[^,\n]*[,\n]?',
            r'District:\s*[^,\n]*[,\n]?',
            r'PIN Code:\s*\d*[,\n]?',
            r'Pincode:\s*\d*[,\n]?',
            r'Pin:\s*\d*[,\n]?',
            r'Post Office:\s*[^,\n]*[,\n]?',
            r'Tehsil:\s*[^,\n]*[,\n]?',
            r'Block:\s*[^,\n]*[,\n]?',
            r'Village:\s*[^,\n]*[,\n]?',
        ]

        for pattern in unwanted_patterns:
            address = re.sub(pattern, '', address, flags=re.IGNORECASE)

        # Remove extra spaces, commas, and newlines
        address = re.sub(r'[,\s]+', ' ', address)
        address = re.sub(r'^[,\s]+|[,\s]+$', '', address)

        # Split by common delimiters and rejoin with commas
        parts = []
        for part in re.split(r'[,\n]', address):
            part = part.strip()
            if part and len(part) > 1:
                parts.append(part)

        return ', '.join(parts)

    def parse_address(self, address: str) -> Dict[str, str]:
        """
        Parse address into components for template
        """
        if not address:
            return {'address1': '', 'address2': ''}

        address = address.strip()

        # Check if address already has newlines
        if '\n' in address:
            address_lines = address.split('\n')
            mid_point = len(address_lines) // 2 if len(address_lines) > 1 else 1
            return {
                'address1': '\n'.join(address_lines[:mid_point]).strip(),
                'address2': '\n'.join(address_lines[mid_point:]).strip() if len(address_lines) > mid_point else ''
            }

        # Split by commas
        parts = [part.strip() for part in address.split(',') if part.strip()]

        if len(parts) <= 1:
            return {
                'address1': address,
                'address2': ''
            }
        elif len(parts) == 2:
            return {
                'address1': parts[0] + ',',
                'address2': parts[1]
            }
        else:
            mid_point = len(parts) // 2

            address1_parts = []
            for part in parts[:mid_point]:
                address1_parts.append(part + ',')

            address2_parts = []
            for i, part in enumerate(parts[mid_point:]):
                if i == len(parts[mid_point:]) - 1:
                    address2_parts.append(part)
                else:
                    address2_parts.append(part + ',')

            return {
                'address1': '\n'.join(address1_parts),
                'address2': '\n'.join(address2_parts)
            }

    def generate_invoice_number(self) -> str:
        """
        Generate unique invoice number

        Returns:
            str: Unique invoice number
        """
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return "INV-" + timestamp

    def generate_invoice_from_customer_folder(self, folder_path: str, person_name: str) -> Dict:
        """
        Generate invoice from customer folder by finding and processing the UID PDF

        Args:
            folder_path (str): Path to the customer folder
            person_name (str): Name of the person (extracted from folder name)

        Returns:
            Dict: Generation result with success status and file path
        """
        try:
            folder_path = Path(folder_path)

            if not folder_path.exists() or not folder_path.is_dir():
                raise FileNotFoundError("Customer folder not found: " + str(folder_path))

            # Create expected UID filename
            uid_name = person_name.replace(' ', '_').upper()
            expected_uid_filename = "UID_" + uid_name + ".pdf"

            # Find UID file
            uid_file_path = folder_path / expected_uid_filename
            if not uid_file_path.exists():
                # Look for any UID_*.pdf file
                uid_files = list(folder_path.glob("UID_*.pdf"))
                if uid_files:
                    uid_file_path = uid_files[0]
                else:
                    raise FileNotFoundError("UID file not found in folder: " + str(folder_path))

            self.logger.info("Found UID file: " + str(uid_file_path))

            # Extract information from the UID PDF
            extraction_result = self.extract_aadhaar_info_from_pdf(uid_file_path)

            if not extraction_result['success']:
                return {
                    'success': False,
                    'error': "Failed to extract information from UID PDF: " + extraction_result['error']
                }

            # Generate invoice using extracted data
            return self.generate_invoice_from_data(extraction_result, uid_file_path.name)

        except Exception as e:
            self.logger.error("Error processing customer folder " + str(folder_path) + ": " + str(e))
            return {
                'success': False,
                'error': str(e)
            }

    def generate_invoice_from_data(self, customer_data: Dict, source_file: str = None) -> Dict:
        """
        Generate invoice from customer data

        Args:
            customer_data (Dict): Customer data with name, aadhaar_number, address
            source_file (str, optional): Source file name for logging

        Returns:
            Dict: Generation result with success status and file path
        """
        try:
            # Prepare template data
            cleaned_address = self.clean_address(customer_data.get('address', ''))
            address_parts = self.parse_address(cleaned_address)
            clean_aadhaar = self.clean_aadhaar_number(customer_data.get('aadhaar_number', ''))

            template_data = {
                'date': datetime.now().strftime('%d/%m/%Y'),
                'customerName': customer_data.get('name', ''),
                'customerParent': '',  # You can extract this if needed
                'address1': address_parts['address1'],
                'address2': address_parts['address2'],
                'aadhar': clean_aadhaar,
                'mobile': '',  # You can extract this if needed
                'description': 'Services Provided',  # Default description
                'hsnCode': '',  # You can add this if needed
                'quantity': '1',  # Default quantity
                'unitPrice': '0.00',  # Default price
                'total': '0.00'  # Default total
            }

            # Load template
            doc = DocxTemplate(self.template_path)

            # Render template with data
            doc.render(template_data)

            # Generate output filename
            safe_customer_name = re.sub(r'[^\w\s-]', '', customer_data.get('name', 'Customer')).strip()
            safe_customer_name = re.sub(r'[-\s]+', '_', safe_customer_name)
            invoice_number = self.generate_invoice_number()

            output_filename = "Invoice_" + safe_customer_name + "_" + invoice_number + ".docx"
            output_path = self.output_folder / output_filename

            # Save the generated invoice
            doc.save(output_path)

            self.logger.info("Invoice generated successfully: " + str(output_path))

            # Print results
            print("\n" + "="*60)
            print("INVOICE GENERATED SUCCESSFULLY")
            print("="*60)
            print("Customer: " + customer_data.get('name', 'N/A'))
            print("Aadhaar: " + clean_aadhaar)
            print("Address: " + customer_data.get('address', 'N/A'))
            print("Source File: " + (source_file or 'Manual Data'))
            print("Invoice Number: " + invoice_number)
            print("Output File: " + str(output_path))
            print("="*60 + "\n")

            return {
                'success': True,
                'invoice_path': str(output_path),
                'invoice_number': invoice_number,
                'customer_name': customer_data.get('name', ''),
                'output_filename': output_filename,
                'download_url': "/download-invoice-docx/" + output_filename
            }

        except Exception as e:
            self.logger.error("Error generating invoice: " + str(e))
            print("\n" + "="*60)
            print("INVOICE GENERATION FAILED")
            print("="*60)
            print("Error: " + str(e))
            print("="*60 + "\n")

            return {
                'success': False,
                'error': str(e)
            }


# Create a global instance for use in FastAPI
invoice_generator = None

def get_invoice_generator() -> InvoiceGenerator:
    """
    Get or create the global invoice generator instance

    Returns:
        InvoiceGenerator: The invoice generator instance
    """
    global invoice_generator
    if invoice_generator is None:
        try:
            invoice_generator = InvoiceGenerator()
        except Exception as e:
            print("Error initializing Invoice Generator: " + str(e))
            raise e
    return invoice_generator

def generate_invoice_for_customer(folder_path: str, person_name: str) -> Dict:
    """
    Public function to generate invoice for a customer (extracts from PDF)

    Args:
        folder_path (str): Path to the customer folder
        person_name (str): Name of the person

    Returns:
        Dict: Generation result
    """
    try:
        generator = get_invoice_generator()
        return generator.generate_invoice_from_customer_folder(folder_path, person_name)
    except Exception as e:
        return {
            'success': False,
            'error': "Failed to initialize invoice generator: " + str(e)
        }

def generate_invoice_with_data(customer_data: Dict) -> Dict:
    """
    Public function to generate invoice using already extracted customer data

    Args:
        customer_data (Dict): Dictionary containing name, aadhaar_number, address

    Returns:
        Dict: Generation result
    """
    try:
        generator = get_invoice_generator()
        return generator.generate_invoice_from_data(customer_data)
    except Exception as e:
        return {
            'success': False,
            'error': "Failed to initialize invoice generator: " + str(e)
        }


if __name__ == "__main__":
    # Test function
    test_folder = "D:\\minato\\Data\\001 Nandu Singh_687480874343"  # Update this path
    test_name = "Nandu Singh"

    result = generate_invoice_for_customer(test_folder, test_name)

    if result['success']:
        print("Test invoice generated: " + result['invoice_path'])
    else:
        print("Failed to generate test invoice: " + result['error'])