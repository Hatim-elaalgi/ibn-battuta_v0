#!/usr/bin/env python3
import os
import requests
import base64
from PIL import Image
import json

image_path = 'tanger-kashbah-888.jpg'

# Use the Extreme compression
original_img = Image.open(image_path)
max_w, max_h = 300, 210
width, height = original_img.width, original_img.height

if width > height:
    if width > max_w:
        height = int((height * max_w) / width)
        width = max_w
else:
    if height > max_h:
        width = int((width * max_h) / height)
        height = max_h

img = original_img.resize((width, height), Image.Resampling.LANCZOS)
img.save('kasbah_extreme.jpg', quality=60, optimize=True)

with open('kasbah_extreme.jpg', 'rb') as f:
    comp_bytes = f.read()

b64 = base64.b64encode(comp_bytes).decode('utf-8')
data_uri = f'data:image/jpeg;base64,{b64}'

print("="*70)
print("DETAILED MESSAGE ANALYSIS")
print("="*70)

payload = {
    'message': 'What landmark is this?',
    'image_data': data_uri
}

print(f"\nPayload being sent to backend:")
print(f"  message: '{payload['message']}'")
print(f"  image_data length: {len(payload['image_data'])} chars ({len(payload['image_data'])/1024:.2f} KB)")

# Show what the backend will construct
message_text = payload['message']
image_content = payload['image_data']  # Already in data:image/jpeg;base64,X format

# This is what backend constructs
user_content = f"{message_text}\n<image>{image_content}</image>"

print(f"\nMessage that goes to LM Studio:")
print(f"  System prompt: ~144 chars (minimalforvision)")
print(f"  User message: {len(user_content)} chars")
print(f"    - Text: {len(message_text)} chars")
print(f"    - Image tag + data: {len(f'<image>{image_content}</image>')} chars")

total_chars = 144 + len(user_content)
estimated_tokens = int(total_chars / 4)  # Rough estimate

print(f"\nTotal characters: {total_chars}")
print(f"Estimated tokens: ~{estimated_tokens}")
print(f"Context limit: 4096 tokens")

if estimated_tokens > 4096:
    print(f"❌ EXCEEDS LIMIT by {estimated_tokens - 4096} tokens!")
else:
    print(f"✅ Within limit ({4096 - estimated_tokens} tokens remaining)")

# Now test
print(f"\n" + "="*70)
print("BACKEND TEST")
print("="*70)

try:
    response = requests.post(
        'http://127.0.0.1:8000/api/v1/chat',
        json=payload,
        timeout=120
    )
    
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        resp = result['response']
        print(f"Response: {resp[:200]}...")
        
        if '400' in resp or 'error' in resp.lower():
            print(f"\n❌ Backend returned LLM error")
            # Extract the actual error from LM Studio
            if 'n_keep' in resp:
                print("Hint: Token limit still exceeded at LM Studio level")
    else:
        print(f"Error: {response.text}")
        
except Exception as e:
    print(f"Error: {e}")

os.remove('kasbah_extreme.jpg')
