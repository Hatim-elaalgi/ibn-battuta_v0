#!/usr/bin/env python
"""
Diagnostic script to test Qwen 3 VL image recognition
Helps debug vision-language model integration with LM Studio
"""

import requests
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Test image (small valid JPEG base64)
TEST_IMAGE_BASE64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAQICAgICAgICAwUDAwwUAxEUDAwUFBYcFBcUFBcUGhcaFxgWGhcaHhkfIiwkIyMkJCMkODg4OAj/2wBDAQICAgICAwYDAwYICQcIDAgICAkJCAkICAgKCAkICAgICAgIGBwcHBwcGhoaGhwcHBwcHBwcHBwcHBwcHBwcHD/wAARCADIAMgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWm5ybnJ2eoqOkpaanqKmqsrO0tba2uLm6wsPExcbHyMnK0tPU1dbW2Nna4uPk5ebn6Onq8vP09fb2+Pn6/8QAHwEAAwEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWmJmaoqOkpaanqKmqsrO0tba2uLm6wsPExcbHyMnK0tPU1dbW2Nna4uPk5ebn6Onq8vP09fb2+Pn6/9oADAMBAAIRAxEAPwD9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q"

LM_STUDIO_HOST = "http://127.0.0.1:1234"
ENDPOINT = f"{LM_STUDIO_HOST}/v1/chat/completions"

def test_text_only():
    """Test text-only request (should work)"""
    print("\n" + "="*70)
    print("TEST 1: TEXT-ONLY REQUEST")
    print("="*70)
    
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "What is your name?"
            }
        ],
        "temperature": 0.6,
        "max_tokens": 100,
        "stream": False
    }
    
    try:
        response = requests.post(ENDPOINT, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        if response.ok:
            result = response.json()
            print(f"✅ SUCCESS")
            print(f"Response: {result['choices'][0]['message']['content'][:100]}...")
            return True
        else:
            print(f"❌ FAILED: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_vision_format_1():
    """Test with data URI format (standard OpenAI)"""
    print("\n" + "="*70)
    print("TEST 2: VISION REQUEST WITH DATA URI FORMAT")
    print("="*70)
    
    image_url = f"data:image/jpeg;base64,{TEST_IMAGE_BASE64}"
    
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What is in this image? Describe briefly."},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }
        ],
        "temperature": 0.6,
        "max_tokens": 200,
        "stream": False
    }
    
    print(f"Image size: {len(image_url)/1024:.1f}KB")
    print(f"Format: data:image/jpeg;base64,...")
    
    try:
        response = requests.post(ENDPOINT, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        if response.ok:
            result = response.json()
            content = result['choices'][0]['message']['content']
            print(f"✅ SUCCESS")
            print(f"Response: {content[:200]}...")
            # Check if model actually analyzed the image
            if any(word in content.lower() for word in ['image', 'see', 'white', 'appear', 'show', 'photo']):
                print("✅ MODEL RECOGNIZED IMAGE CONTENT")
                return True
            else:
                print("⚠️ MODEL MIGHT NOT BE ANALYZING IMAGE PROPERLY")
                return False
        else:
            print(f"❌ FAILED: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def test_vision_format_2():
    """Test with raw base64 (no data URI)"""
    print("\n" + "="*70)
    print("TEST 3: VISION REQUEST WITH RAW BASE64")
    print("="*70)
    
    payload = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{TEST_IMAGE_BASE64}"}}
                ]
            }
        ],
        "temperature": 0.6,
        "max_tokens": 200,
        "stream": False
    }
    
    print(f"Image size: {len(TEST_IMAGE_BASE64)/1024:.1f}KB")
    print(f"Format: raw base64")
    
    try:
        response = requests.post(ENDPOINT, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        if response.ok:
            result = response.json()
            content = result['choices'][0]['message']['content']
            print(f"✅ SUCCESS")
            print(f"Response: {content[:200]}...")
            return True
        else:
            print(f"❌ FAILED: {response.text}")
            return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

def diagnose():
    """Run all diagnostic tests"""
    print("\n" + "="*70)
    print("QWEN 3 VL 4B VISION DIAGNOSTIC")
    print("LM Studio: " + LM_STUDIO_HOST)
    print("="*70)
    
    results = {
        "Text Only": test_text_only(),
        "Vision (Data URI)": test_vision_format_1(),
        "Vision (Raw Base64)": test_vision_format_2(),
    }
    
    print("\n" + "="*70)
    print("DIAGNOSTIC SUMMARY")
    print("="*70)
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print("\n📋 RECOMMENDATIONS:")
    if results["Text Only"] and not results["Vision (Data URI)"]:
        print("⚠️  Qwen 3 VL vision features may not be properly configured in LM Studio")
        print("   - Check if vision model is loaded")
        print("   - Try reloading the model")
        print("   - Check LM Studio logs for vision-related errors")
    elif all(results.values()):
        print("✅ All tests passed! Vision features are working.")
    
    return results

if __name__ == "__main__":
    diagnose()
