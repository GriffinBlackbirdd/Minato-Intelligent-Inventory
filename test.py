#!/usr/bin/env python3
"""
Test function for Aadhaar card image processing
Tests both front and back image processing capabilities
"""

import asyncio
from pathlib import Path
from agno.agent import Agent
from agno.models.google import Gemini
from agno.media import Image
from pydantic import BaseModel, Field
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
GOOGLE_API_KEY = "AIzaSyCWznUz8cnPCkzJ6Bu9ikQGWF6kc-ZUu9k"

class AadhaarImageExtraction(BaseModel):
    aadharNumber: str = Field(..., description="Extract the 12-digit Aadhaar number from the image")
    address: str = Field(..., description="Extract the complete address from the image")
    mobileNumber: str = Field(..., description="Extract the mobile/phone number if visible in the image")
    name: str = Field(..., description="Extract the person's name from the Aadhaar card")
    dateOfBirth: str = Field(default="", description="Extract date of birth if visible")
    gender: str = Field(default="", description="Extract gender if visible")
    fatherName: str = Field(default="", description="Extract father's name if visible")

def setup_aadhaar_agent():
    """Setup the agent for Aadhaar image processing"""
    return Agent(
        model=Gemini(id="gemini-1.5-flash", api_key=GOOGLE_API_KEY),
        description="You extract information from Aadhaar card images. You can process both front and back sides of Aadhaar cards.",
        response_model=AadhaarImageExtraction,
    )

async def test_aadhaar_front_image(agent, image_path: str):
    """Test processing Aadhaar front image"""
    try:
        print(f"\n{'='*60}")
        print("TESTING AADHAAR FRONT IMAGE PROCESSING")
        print(f"{'='*60}")
        print(f"Image Path: {image_path}")

        if not Path(image_path).exists():
            print(f"❌ ERROR: Image file not found: {image_path}")
            return None

        print("📤 Sending image to AI agent...")

        response = await asyncio.to_thread(
            agent.run,
            "Please extract all information from this Aadhaar card front image. "
            "Look for: Aadhaar number (12 digits), name, father's name, date of birth, gender, "
            "address, and any mobile number if visible. "
            "Be very careful to extract the complete and accurate information.",
            images=[Image(filepath=image_path)]
        )

        if response.content:
            print("✅ SUCCESS: Information extracted from front image")
            print(f"📄 Aadhaar Number: {response.content.aadharNumber}")
            print(f"👤 Name: {response.content.name}")
            print(f"👨 Father's Name: {response.content.fatherName}")
            print(f"🎂 Date of Birth: {response.content.dateOfBirth}")
            print(f"⚥ Gender: {response.content.gender}")
            print(f"🏠 Address: {response.content.address}")
            print(f"📱 Mobile: {response.content.mobileNumber}")
            print(f"{'='*60}")
            return response.content
        else:
            print("❌ ERROR: No content in response")
            return None

    except Exception as e:
        print(f"❌ ERROR processing front image: {str(e)}")
        return None

async def test_aadhaar_back_image(agent, image_path: str):
    """Test processing Aadhaar back image"""
    try:
        print(f"\n{'='*60}")
        print("TESTING AADHAAR BACK IMAGE PROCESSING")
        print(f"{'='*60}")
        print(f"Image Path: {image_path}")

        if not Path(image_path).exists():
            print(f"❌ ERROR: Image file not found: {image_path}")
            return None

        print("📤 Sending image to AI agent...")

        response = await asyncio.to_thread(
            agent.run,
            "Please extract all information from this Aadhaar card back image. "
            "Look for: complete address, PIN code, any QR code information, "
            "and any mobile number or other contact details if visible. "
            "The back side typically contains the address in multiple languages.",
            images=[Image(filepath=image_path)]
        )

        if response.content:
            print("✅ SUCCESS: Information extracted from back image")
            print(f"📄 Aadhaar Number: {response.content.aadharNumber}")
            print(f"👤 Name: {response.content.name}")
            print(f"🏠 Address: {response.content.address}")
            print(f"📱 Mobile: {response.content.mobileNumber}")
            print(f"{'='*60}")
            return response.content
        else:
            print("❌ ERROR: No content in response")
            return None

    except Exception as e:
        print(f"❌ ERROR processing back image: {str(e)}")
        return None

async def test_both_images(agent, front_image_path: str, back_image_path: str):
    """Test processing both front and back images together"""
    try:
        print(f"\n{'='*60}")
        print("TESTING COMBINED FRONT + BACK IMAGE PROCESSING")
        print(f"{'='*60}")
        print(f"Front Image: {front_image_path}")
        print(f"Back Image: {back_image_path}")

        if not Path(front_image_path).exists():
            print(f"❌ ERROR: Front image not found: {front_image_path}")
            return None

        if not Path(back_image_path).exists():
            print(f"❌ ERROR: Back image not found: {back_image_path}")
            return None

        print("📤 Sending both images to AI agent...")

        response = await asyncio.to_thread(
            agent.run,
            "Please extract all information from these Aadhaar card images. "
            "I'm providing both front and back images. "
            "Extract: Aadhaar number, complete name, father's name, date of birth, gender, "
            "complete address, PIN code, and any mobile/phone number. "
            "Combine information from both images to provide the most complete data.",
            images=[Image(filepath=front_image_path), Image(filepath=back_image_path)]
        )

        if response.content:
            print("✅ SUCCESS: Information extracted from both images")
            print(f"📄 Aadhaar Number: {response.content.aadharNumber}")
            print(f"👤 Name: {response.content.name}")
            print(f"👨 Father's Name: {response.content.fatherName}")
            print(f"🎂 Date of Birth: {response.content.dateOfBirth}")
            print(f"⚥ Gender: {response.content.gender}")
            print(f"🏠 Address: {response.content.address}")
            print(f"📱 Mobile: {response.content.mobileNumber}")
            print(f"{'='*60}")
            return response.content
        else:
            print("❌ ERROR: No content in response")
            return None

    except Exception as e:
        print(f"❌ ERROR processing both images: {str(e)}")
        return None

async def run_image_tests():
    """Run all image processing tests"""
    print("🚀 STARTING AADHAAR IMAGE PROCESSING TESTS")
    print("=" * 80)

    # Setup agent
    agent = setup_aadhaar_agent()

    # Test paths (you need to provide actual image paths)
    test_images = {
        "front": "front.png",  # Replace with actual path
        "back": "back.png",    # Replace with actual path
        "single": "front.png" # Replace with actual path
    }

    print("📋 Test Configuration:")
    for key, path in test_images.items():
        exists = "✅" if Path(path).exists() else "❌"
        print(f"  {key.upper()}: {path} {exists}")

    # Test 1: Single front image
    if Path(test_images["front"]).exists():
        await test_aadhaar_front_image(agent, test_images["front"])
    else:
        print(f"\n⚠️  SKIPPING front image test - file not found: {test_images['front']}")

    # Test 2: Single back image
    if Path(test_images["back"]).exists():
        await test_aadhaar_back_image(agent, test_images["back"])
    else:
        print(f"\n⚠️  SKIPPING back image test - file not found: {test_images['back']}")

    # Test 3: Both images together
    if Path(test_images["front"]).exists() and Path(test_images["back"]).exists():
        await test_both_images(agent, test_images["front"], test_images["back"])
    else:
        print(f"\n⚠️  SKIPPING combined test - both images required")

    # Test 4: Single image (could be front or back)
    if Path(test_images["single"]).exists():
        await test_aadhaar_front_image(agent, test_images["single"])
    else:
        print(f"\n⚠️  SKIPPING single image test - file not found: {test_images['single']}")

    print(f"\n{'='*80}")
    print("🏁 ALL TESTS COMPLETED")
    print("=" * 80)

# Example usage and test instructions
def print_test_instructions():
    """Print instructions for running the tests"""
    print("""
📖 HOW TO RUN THESE TESTS:

1. Prepare test images:
   - Save an Aadhaar front image as 'test_aadhaar_front.jpg'
   - Save an Aadhaar back image as 'test_aadhaar_back.jpg'
   - Save any single Aadhaar image as 'test_aadhaar_single.jpg'

2. Update the test_images dictionary with your actual file paths

3. Run the test:
   python test_aadhaar_images.py

4. Check the output for:
   ✅ Successful extractions
   ❌ Errors or missing files
   📄 Extracted information

5. Verify that extracted information is accurate by comparing with actual card

⚠️  PRIVACY NOTE: Use test images only, never upload real personal documents!

🔧 CUSTOMIZATION:
   - Modify image paths in test_images dictionary
   - Add more test cases as needed
   - Adjust extraction prompts for better accuracy
""")

if __name__ == "__main__":
    print_test_instructions()

    # Uncomment the next line to run the tests
    asyncio.run(run_image_tests())