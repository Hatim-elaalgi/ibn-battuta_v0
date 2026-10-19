#!/usr/bin/env python
"""
Test different image format variations to match LM Studio's native chat format
Since images work in LM Studio chat, we reverse-engineer the correct format
"""

import requests
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Small test image
TEST_IMAGE_BASE64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwwUAxEUDAwUFBYcFBcUFBcUGhcaFxgWGhcaHhkfIywkIyMkJCMkODg4OAj/2wBDAQICAgICAwYDAwYICQcIDAgICAkJCAkICAgKCAkICAgICAgIGBwcHBwcGhoaGhwcHBwcHBwcHBwcHBwcHBwcHD/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL"

ENDPOINT = "http://127.0.0.1:1234/v1/chat/completions"

def test_format(name, messages, description):
    """Test a specific message format"""
    print(f"\n{'='*70}")
    print(f"FORMAT: {name}")
    print(f"{'='*70}")
    print(f"Description: {description}")
    print(f"\nRequest structure:")
    print(json.dumps({"messages": messages[:1]}, indent=2))  # Show first message only
    
    payload = {
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 100,
        "stream": False
    }
    
    try:
        response = requests.post(ENDPOINT, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.ok:
            result = response.json()
            content = result['choices'][0]['message']['content']
            print(f"✅ SUCCESS")
            print(f"Response: {content[:150]}...")
            
            # Check if image was actually analyzed
            recognition_words = ['image', 'see', 'white', 'appear', 'show', 'visible', 'display', 'picture', 'photo']
            if any(word in content.lower() for word in recognition_words):
                print("🎯 IMAGE RECOGNIZED")
                return True
            else:
                print("⚠️  Request accepted but image may not be analyzed")
                return False
        else:
            print(f"❌ FAILED ({response.status_code})")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def run_tests():
    """Test various image format combinations"""
    
    print("\n" + "="*70)
    print("REVERSE-ENGINEERING LM STUDIO IMAGE FORMAT")
    print("Testing different variations since images work in LM Studio chat")
    print("="*70)
    
    results = {}
    
    # Format 1: Standard OpenAI vision format (what we're using now)
    results["OpenAI Standard (data URI)"] = test_format(
        "OpenAI Standard with data URI",
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image briefly."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{TEST_IMAGE_BASE64}"}}
                ]
            }
        ],
        "Standard OpenAI vision format with data:image/jpeg;base64,..."
    )
    
    # Format 2: Qwen native format (might use different structure)
    results["Qwen Native Format 1"] = test_format(
        "Qwen Native - image in content array",
        [
            {
                "role": "user",
                "content": [
                    f"<image>data:image/jpeg;base64,{TEST_IMAGE_BASE64}</image>",
                    "Describe this image briefly."
                ]
            }
        ],
        "Qwen-specific format with image tags"
    )
    
    # Format 3: Image URL format (direct)
    results["Direct Image URL"] = test_format(
        "Direct Image URL in content",
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What do you see?"},
                    {"type": "image", "image": f"data:image/jpeg;base64,{TEST_IMAGE_BASE64}"}
                ]
            }
        ],
        "Direct image type (not image_url)"
    )
    
    # Format 4: Mixed string + image
    results["String + Image Object"] = test_format(
        "Mixed string and image",
        [
            {
                "role": "user",
                "content": "Analyze this image: " + f"<image>{TEST_IMAGE_BASE64}</image>"
            }
        ],
        "Single content field with image tag"
    )
    
    # Format 5: Separate text and image messages
    results["Separate Messages"] = test_format(
        "Image as separate message",
        [
            {"role": "user", "content": [{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{TEST_IMAGE_BASE64}"}}]},
            {"role": "user", "content": "What do you see?"}
        ],
        "Image sent as separate message"
    )
    
    # Format 6: URL reference (if LM Studio can fetch)
    results["Base64 Direct"] = test_format(
        "Base64 without data URI prefix",
        [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{TEST_IMAGE_BASE64}"}}
                ]
            }
        ],
        "Plain base64 in data URI"
    )
    
    # Format 7: Check if it's a model loading issue
    results["Text Only Verification"] = test_format(
        "Text-only baseline",
        [
            {
                "role": "user",
                "content": "Tell me about Qwen's vision capabilities."
            }
        ],
        "Baseline text test"
    )
    
    print("\n" + "="*70)
    print("RESULTS SUMMARY")
    print("="*70)
    
    working = [name for name, result in results.items() if result]
    not_working = [name for name, result in results.items() if not result]
    
    if working:
        print(f"\n✅ WORKING FORMATS ({len(working)}):")
        for name in working:
            print(f"   • {name}")
    
    if not_working:
        print(f"\n❌ NOT WORKING ({len(not_working)}):")
        for name in not_working:
            print(f"   • {name}")
    
    print("\n" + "="*70)
    print("NEXT STEPS")
    print("="*70)
    if working:
        working_format = working[0]
        print(f"✅ Found working format: {working_format}")
        print(f"   Update the backend to use this format")
    else:
        print("⚠️  No formats worked - may indicate:")
        print("   1. Vision model needs special LM Studio setup")
        print("   2. Different API endpoint required")
        print("   3. Check LM Studio documentation")
        print("   4. Compare with how LM Studio chat sends images")

if __name__ == "__main__":
    run_tests()
