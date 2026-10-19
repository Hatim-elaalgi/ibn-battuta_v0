#!/usr/bin/env python3
"""
Diagnostic script to test frontend image compression and backend processing.
Run with your actual Kasbah image to see what's happening.
"""
import requests
import base64
import json
from PIL import Image

# Test with the actual Kasbah image you uploaded
try:
    # Try to find your uploaded image
    image_path = "kasbah.jpg"  # Save your image with this name
    
    with open(image_path, 'rb') as f:
        original_bytes = f.read()
    
    print("="*70)
    print("FRONTEND IMAGE COMPRESSION DIAGNOSTICS")
    print("="*70)
    
    print(f"\n📸 Original Image:")
    print(f"   File size: {len(original_bytes) / 1024:.2f} KB")
    
    # Simulate frontend compression
    original_img = Image.open(image_path)
    print(f"   Dimensions: {original_img.width}x{original_img.height}")
    
    # Frontend compression: resize to 600x450, quality 80
    max_width = 600
    max_height = 450
    width, height = original_img.width, original_img.height
    
    if width > height:
        if width > max_width:
            height = int((height * max_width) / width)
            width = max_width
    else:
        if height > max_height:
            width = int((width * max_height) / height)
            height = max_height
    
    print(f"\n📦 Compression Settings:")
    print(f"   Target size: max {max_width}x{max_height}")
    print(f"   Resized to: {width}x{height}")
    print(f"   JPEG quality: 80")
    
    compressed_img = original_img.resize((width, height), Image.Resampling.LANCZOS)
    compressed_img.save('kasbah_compressed_test.jpg', quality=80, optimize=True)
    
    with open('kasbah_compressed_test.jpg', 'rb') as f:
        compressed_bytes = f.read()
    
    compressed_b64 = base64.b64encode(compressed_bytes).decode('utf-8')
    data_uri = f"data:image/jpeg;base64,{compressed_b64}"
    
    print(f"\n✅ Compressed Result:")
    print(f"   File size: {len(compressed_bytes) / 1024:.2f} KB")
    print(f"   Base64 size: {len(compressed_b64) / 1024:.2f} KB")
    print(f"   Data URI size: {len(data_uri) / 1024:.2f} KB")
    print(f"   Reduction: {(1 - len(compressed_bytes)/len(original_bytes)) * 100:.1f}%")
    
    # Now test with backend
    print(f"\n" + "="*70)
    print("BACKEND TEST")
    print("="*70)
    
    payload = {
        'message': 'What landmark is this? Describe what you see.',
        'image_data': data_uri
    }
    
    print(f"\n📤 Sending to backend:")
    print(f"   Message: '{payload['message']}'")
    print(f"   Image data length: {len(payload['image_data']) / 1024:.2f} KB")
    
    response = requests.post(
        'http://127.0.0.1:8000/api/v1/chat',
        json=payload,
        timeout=120
    )
    
    print(f"\n📥 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        response_text = result['response']
        
        if '400' in response_text or 'error' in response_text.lower():
            print(f"\n❌ Backend returned error:")
            print(f"   {response_text}")
            print(f"\n🔧 Troubleshooting:")
            print(f"   - Image is {len(payload['image_data']) / 1024:.2f} KB (should be < 5 KB)")
            
            # Try with even smaller compression
            print(f"\n   Trying ultra-compressed version...")
            compressed_img.save('kasbah_ultra_compressed.jpg', quality=70, optimize=True)
            with open('kasbah_ultra_compressed.jpg', 'rb') as f:
                ultra_bytes = f.read()
            ultra_b64 = base64.b64encode(ultra_bytes).decode('utf-8')
            ultra_uri = f"data:image/jpeg;base64,{ultra_b64}"
            
            print(f"   Ultra-compressed size: {len(ultra_bytes) / 1024:.2f} KB")
            
            payload2 = {
                'message': 'What landmark is this?',
                'image_data': ultra_uri
            }
            
            response2 = requests.post(
                'http://127.0.0.1:8000/api/v1/chat',
                json=payload2,
                timeout=120
            )
            
            if response2.status_code == 200:
                result2 = response2.json()
                if '400' not in result2['response']:
                    print(f"\n✅ Ultra-compressed works!")
                    print(f"   Response: {result2['response'][:150]}...")
        else:
            print(f"\n✅ SUCCESS!")
            print(f"   Response: {response_text[:200]}...")
    else:
        print(f"\n❌ HTTP Error {response.status_code}")
        print(f"   {response.text}")

except FileNotFoundError:
    print("❌ Image not found!")
    print("   Save your Kasbah image as 'kasbah.jpg' in this directory")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
