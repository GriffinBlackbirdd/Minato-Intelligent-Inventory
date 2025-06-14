import os
import re
import logging
from datetime import datetime
from typing import List
from pathlib import Path
from rich.pretty import pprint
from pydantic import BaseModel, Field
from agno.agent import Agent, RunResponse
from agno.models.google import Gemini
from agno.media import File

class AadharExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract the aadhar number from the given pdf")

class AadhaarFolderProcessor:
    def __init__(self, base_folder_path: str, api_key: str):
        """
        Initialize the Aadhaar folder processor

        Args:
            base_folder_path (str): Path to the base folder containing numbered folders
            api_key (str): Google API key for Gemini
        """
        self.base_folder_path = Path(base_folder_path)
        self.api_key = api_key

        # Setup logging
        self.setup_logging()

        # Initialize the agent
        self.agent = Agent(
            model=Gemini(id="gemini-1.5-flash", api_key=api_key),
            description="You extract information from the PDF file.",
            response_model=AadharExtraction,
        )

        # Pattern to match folder names like "001 Nandu Singh"
        self.folder_pattern = r'^(\d{3})\s+(.+)$'

        # Processing statistics
        self.stats = {
            'total_folders_found': 0,
            'folders_skipped': 0,
            'folders_processed': 0,
            'successful_extractions': 0,
            'failed_extractions': 0,
            'successful_renames': 0,
            'failed_renames': 0,
            'success_details': [],
            'failure_details': []
        }

    def setup_logging(self):
        """Setup logging to file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_filename = f"aadhaar_extraction_log_{timestamp}.log"
        summary_log_filename = f"aadhaar_summary_{timestamp}.log"

        self.log_path = self.base_folder_path / log_filename
        self.summary_log_path = self.base_folder_path / summary_log_filename

        # Setup detailed logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_path),
                logging.StreamHandler()  # Also print to console
            ]
        )
        self.logger = logging.getLogger(__name__)
        self.logger.info(f"Starting Aadhaar extraction process. Log file: {self.log_path}")
        self.logger.info(f"Summary log file: {self.summary_log_path}")

        # Create summary log file
        with open(self.summary_log_path, 'w', encoding='utf-8') as f:
            f.write(f"Aadhaar Extraction Summary - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("="*80 + "\n\n")

    def folder_needs_processing(self, folder_name: str) -> bool:
        """
        Check if folder name ends with Aadhaar number (already processed)

        Args:
            folder_name (str): Name of the folder

        Returns:
            bool: True if folder needs processing, False if already processed
        """
        # Check if folder name ends with underscore and 12 digits (full Aadhaar number)
        if re.search(r'_\d{12}$', folder_name):
            return False
        return True

    def extract_name_from_folder(self, folder_name: str) -> tuple:
        """
        Extract name from folder name format "001 Nandu Singh"

        Args:
            folder_name (str): Folder name

        Returns:
            tuple: (folder_number, extracted_name) or (None, None) if pattern doesn't match
        """
        match = re.match(self.folder_pattern, folder_name)
        if match:
            folder_number = match.group(1)
            name = match.group(2).strip()
            return folder_number, name
        return None, None

    def create_uid_filename(self, name: str) -> str:
        """
        Create UID filename from name (e.g., "Nandu Singh" -> "UID_NANDU_SINGH.pdf")

        Args:
            name (str): Person's name

        Returns:
            str: UID filename
        """
        # Replace spaces with underscores and convert to uppercase
        uid_name = name.replace(' ', '_').upper()
        return f"UID_{uid_name}.pdf"

    def find_uid_file(self, folder_path: Path, expected_filename: str) -> Path:
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

    def extract_aadhaar_info(self, pdf_path: Path) -> dict:
        """
        Extract Aadhaar information using the agentic model

        Args:
            pdf_path (Path): Path to the PDF file

        Returns:
            dict: Extraction results
        """
        try:
            self.logger.info(f"Processing PDF: {pdf_path}")

            response = self.agent.run(
                "Please extract the information.",
                files=[File(filepath=pdf_path)]
            )

            if response.content:
                return {
                    'success': True,
                    'aadhar_number': response.content.aadharNumber,
                    'error': None
                }
            else:
                return {
                    'success': False,
                    'aadhar_number': None,
                    'error': 'No content in response'
                }

        except Exception as e:
            self.logger.error(f"Error processing {pdf_path}: {str(e)}")
            return {
                'success': False,
                'aadhar_number': None,
                'error': str(e)
            }

    def get_clean_aadhaar_number(self, aadhaar_number: str) -> str:
        """
        Extract and clean the full Aadhaar number (remove spaces, hyphens, etc.)

        Args:
            aadhaar_number (str): Aadhaar number from extraction

        Returns:
            str: Clean 12-digit Aadhaar number, or None if invalid
        """
        if aadhaar_number:
            # Remove any spaces, hyphens, or other non-digit characters
            clean_number = re.sub(r'[^\d]', '', aadhaar_number)

            # Validate that it's exactly 12 digits
            if len(clean_number) == 12 and clean_number.isdigit():
                return clean_number

            # If it's longer than 12 digits, try to extract 12 consecutive digits
            if len(clean_number) > 12:
                # Look for a 12-digit sequence
                match = re.search(r'\d{12}', clean_number)
                if match:
                    return match.group()

        return None

    def rename_folder(self, folder_path: Path, aadhaar_number: str) -> bool:
        """
        Rename folder to include full Aadhaar number with underscore separator

        Args:
            folder_path (Path): Current folder path
            aadhaar_number (str): Full Aadhaar number to append

        Returns:
            bool: True if renamed successfully, False otherwise
        """
        try:
            new_folder_name = f"{folder_path.name}_{aadhaar_number}"
            new_folder_path = folder_path.parent / new_folder_name

            if new_folder_path.exists():
                self.logger.warning(f"Target folder already exists: {new_folder_path}")
                return False

            folder_path.rename(new_folder_path)
            self.logger.info(f"Renamed folder: {folder_path.name} -> {new_folder_name}")
            return True

        except Exception as e:
            self.logger.error(f"Error renaming folder {folder_path}: {str(e)}")
            return False

    def log_success(self, folder_name: str, name: str, aadhaar_number: str, clean_aadhaar: str, new_folder_name: str):
        """Log successful processing"""
        success_entry = {
            'folder_name': folder_name,
            'extracted_name': name,
            'aadhaar_number': aadhaar_number,
            'clean_aadhaar_number': clean_aadhaar,
            'new_folder_name': new_folder_name,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        self.stats['success_details'].append(success_entry)

        # Write to summary log
        with open(self.summary_log_path, 'a', encoding='utf-8') as f:
            f.write(f"SUCCESS: {folder_name}\n")
            f.write(f"   Name: {name}\n")
            f.write(f"   Aadhaar: {aadhaar_number}\n")
            f.write(f"   Clean Aadhaar: {clean_aadhaar}\n")
            f.write(f"   Renamed to: {new_folder_name}\n")
            f.write(f"   Time: {success_entry['timestamp']}\n\n")

    def log_failure(self, folder_name: str, name: str, error_type: str, error_message: str):
        """Log failed processing"""
        failure_entry = {
            'folder_name': folder_name,
            'extracted_name': name,
            'error_type': error_type,
            'error_message': error_message,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        self.stats['failure_details'].append(failure_entry)

        # Write to summary log
        with open(self.summary_log_path, 'a', encoding='utf-8') as f:
            f.write(f"FAILED: {folder_name}\n")
            f.write(f"   Name: {name}\n")
            f.write(f"   Error Type: {error_type}\n")
            f.write(f"   Error: {error_message}\n")
            f.write(f"   Time: {failure_entry['timestamp']}\n\n")

    def write_final_summary(self):
        """Write final processing summary"""
        with open(self.summary_log_path, 'a', encoding='utf-8') as f:
            f.write("\n" + "="*80 + "\n")
            f.write("FINAL PROCESSING SUMMARY\n")
            f.write("="*80 + "\n\n")
            f.write(f"Total folders found: {self.stats['total_folders_found']}\n")
            f.write(f"Folders skipped (already processed): {self.stats['folders_skipped']}\n")
            f.write(f"Folders attempted: {self.stats['folders_processed']}\n")
            f.write(f"Successful extractions: {self.stats['successful_extractions']}\n")
            f.write(f"Failed extractions: {self.stats['failed_extractions']}\n")
            f.write(f"Successful renames: {self.stats['successful_renames']}\n")
            f.write(f"Failed renames: {self.stats['failed_renames']}\n\n")

            success_rate = (self.stats['successful_extractions'] / max(1, self.stats['folders_processed'])) * 100
            f.write(f"Success Rate: {success_rate:.1f}%\n\n")

            if self.stats['failure_details']:
                f.write("FAILED FOLDERS:\n")
                f.write("-" * 40 + "\n")
                for failure in self.stats['failure_details']:
                    f.write(f"- {failure['folder_name']} - {failure['error_type']}\n")
                f.write("\n")

            f.write(f"Processing completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    def process_all_folders(self):
        """
        Process all folders in the base directory
        """
        if not self.base_folder_path.exists():
            self.logger.error(f"Base folder does not exist: {self.base_folder_path}")
            return

        self.logger.info(f"Starting to process folders in: {self.base_folder_path}")

        # Get all folders that match the pattern and need processing
        folders_to_process = []

        for item in self.base_folder_path.iterdir():
            if not item.is_dir():
                continue

            self.stats['total_folders_found'] += 1
            folder_name = item.name

            # Check if folder needs processing
            if not self.folder_needs_processing(folder_name):
                self.logger.info(f"Skipping already processed folder: {folder_name}")
                self.stats['folders_skipped'] += 1
                continue

            # Check if folder matches expected pattern
            folder_number, name = self.extract_name_from_folder(folder_name)
            if not name:
                self.logger.warning(f"Folder name doesn't match expected pattern: {folder_name}")
                self.log_failure(folder_name, "N/A", "Pattern Mismatch", "Folder name doesn't match expected pattern")
                continue

            folders_to_process.append((item, folder_number, name))

        self.logger.info(f"Found {len(folders_to_process)} folders to process")

        # Process each folder
        for folder_path, folder_number, name in folders_to_process:
            self.stats['folders_processed'] += 1
            self.logger.info(f"\n{'='*60}")
            self.logger.info(f"Processing folder: {folder_path.name}")
            self.logger.info(f"Extracted name: {name}")

            # Create expected UID filename
            expected_uid_filename = self.create_uid_filename(name)
            self.logger.info(f"Looking for file: {expected_uid_filename}")

            # Find UID file
            uid_file_path = self.find_uid_file(folder_path, expected_uid_filename)

            if not uid_file_path:
                error_msg = f"UID file not found in folder: {folder_path}"
                self.logger.error(error_msg)
                self.log_failure(folder_path.name, name, "File Not Found", "UID file not found")
                self.stats['failed_extractions'] += 1
                continue

            self.logger.info(f"Found UID file: {uid_file_path}")

            # Extract Aadhaar information
            extraction_result = self.extract_aadhaar_info(uid_file_path)

            if extraction_result['success']:
                aadhaar_number = extraction_result['aadhar_number']

                self.logger.info(f"[SUCCESS] Successfully extracted information:")
                self.logger.info(f"  Aadhaar Number: {aadhaar_number}")

                # Get clean full Aadhaar number
                clean_aadhaar = self.get_clean_aadhaar_number(aadhaar_number)

                if clean_aadhaar:
                    self.logger.info(f"  Clean Aadhaar Number: {clean_aadhaar}")
                    self.stats['successful_extractions'] += 1

                    # Rename folder with full Aadhaar number
                    if self.rename_folder(folder_path, clean_aadhaar):
                        new_folder_name = f"{folder_path.name}_{clean_aadhaar}"
                        self.logger.info(f"[SUCCESS] Successfully processed folder: {folder_path.name}")
                        self.stats['successful_renames'] += 1
                        self.log_success(folder_path.name, name, aadhaar_number, clean_aadhaar, new_folder_name)
                    else:
                        self.logger.error(f"[ERROR] Failed to rename folder: {folder_path.name}")
                        self.stats['failed_renames'] += 1
                        self.log_failure(folder_path.name, name, "Rename Failed", "Could not rename folder")
                else:
                    error_msg = f"Could not extract valid 12-digit Aadhaar number from: {aadhaar_number}"
                    self.logger.error(f"[ERROR] {error_msg}")
                    self.stats['failed_extractions'] += 1
                    self.log_failure(folder_path.name, name, "Invalid Aadhaar", error_msg)
            else:
                error_msg = extraction_result['error']
                self.logger.error(f"[ERROR] Failed to extract information: {error_msg}")
                self.stats['failed_extractions'] += 1
                self.log_failure(folder_path.name, name, "Extraction Failed", error_msg)

        # Write final summary
        self.write_final_summary()

        self.logger.info(f"\n{'='*60}")
        self.logger.info("Processing completed!")
        self.logger.info(f"Summary: {self.stats['successful_extractions']}/{self.stats['folders_processed']} successful")
        self.logger.info(f"Check summary log: {self.summary_log_path}")


def main():
    """
    Main function to run the processor
    """
    # Configuration
    BASE_FOLDER_PATH = "D:\\minato\\Data"  # Change this to your base folder path
    GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"  # Your API key

    # Create processor and run
    processor = AadhaarFolderProcessor(BASE_FOLDER_PATH, GOOGLE_API_KEY)
    processor.process_all_folders()


if __name__ == "__main__":
    main()