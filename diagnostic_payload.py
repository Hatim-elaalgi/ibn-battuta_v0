#!/usr/bin/env python3
"""
CRITICAL DIAGNOSTIC: Compare what works vs what fails
Show exact payload being sent to LM Studio
"""
import requests
import base64
from PIL import Image
import json

image_path = 'tanger-kashbah-888.jpg'
img = Image.open(image_path)
img.thumbnail((160, 100))
img.save('temp_diag.jpg', quality=40)

with open('temp_diag.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

data_uri = f'data:image/jpeg;base64,{b64}'

print("="*70)
print("DIAGNOSTIC: Exact Payload Comparison")
print("="*70)

payload = {
    "messages": [
        {"role": "system", "content": "Describe the image."},
        {"role": "user", "content": f"What is this?\n<image>{data_uri}</image>"}
    ],
    "temperature": 0.6,
    "top_p": 0.9,
    "max_tokens": 128,
    "stream": False
}

print("\n📋 EXACT PAYLOAD STRUCTURE:")
print(json.dumps({
    "messages": [
        {"role": "system", "content": "Describe the image."},
        {"role": "user", "content": f"What is this?\\n<image>data:image/jpeg;base64,[{len(b64)} CHARS]</image>"}
    ],
    "temperature": 0.6,
    "top_p": 0.9,
    "max_tokens": 128,
    "stream": False
}, indent=2))

print(f"\n📊 PAYLOAD ANALYSIS:")
print(f"  System message length: {len(payload['messages'][0]['content'])} chars")
print(f"  User message length: {len(payload['messages'][1]['content'])} chars")
print(f"    - Text only: {len('What is this?')} chars")
print(f"    - Image tag: {len(f'<image>{data_uri}</image>')} chars")
print(f"  Total JSON payload: {len(json.dumps(payload))} bytes")
print(f"  Image base64 size: {len(b64)} chars ({len(b64)/1024:.2f} KB)")

print("\n🚀 SENDING TO LM STUDIO...")
try:
    response = requests.post(
        "http://127.0.0.1:1234/v1/chat/completions",
        json=payload,
        timeout=120,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"\n✅ STATUS: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        content = result['choices'][0]['message']['content']
        print(f"✅ SUCCESS!")
        print(f"Response: {content}")
    else:
        error_data = response.json()
        error_msg = error_data.get('error', response.text)
        print(f"❌ ERROR: {error_msg}")
        
        # Parse the error to understand n_keep
        if 'n_keep' in error_msg and 'n_ctx' in error_msg:
            import re
            n_keep_match = re.search(r'n_keep \((\d+)\)', error_msg)
            n_ctx_match = re.search(r'n_ctx \((\d+)\)', error_msg)
            
            if n_keep_match and n_ctx_match:
                n_keep = int(n_keep_match.group(1))
                n_ctx = int(n_ctx_match.group(1))
                excess = n_keep - n_ctx
                
                print(f"\n📊 TOKEN ANALYSIS:")
                print(f"  n_keep (required): {n_keep} tokens")
                print(f"  n_ctx (available): {n_ctx} tokens")
                print(f"  Excess: {excess} tokens")
                print(f"  Ratio: {n_keep/len(b64):.2f} tokens per KB of base64")
                
except Exception as e:
    print(f"❌ EXCEPTION: {e}")
    import traceback
    traceback.print_exc()

import os
os.remove('temp_diag.jpg')

print("\n" + "="*70)
print("QUESTION FOR USER:")
print("  When you test in LM Studio directly, what exact format do you use?")
print("  - Do you upload the JPG file directly (drag-drop)?")
print("  - Or do you paste base64 text?")
print("  - What's the exact system prompt you give?")
print("="*70)
