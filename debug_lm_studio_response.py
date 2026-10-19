#!/usr/bin/env python3
"""Debug: Check raw LM Studio response structure"""
import requests
import base64
from PIL import Image
import json

print("="*70)
print("DEBUGGING LM STUDIO RESPONSE FORMAT")
print("="*70)

# Prepare image
img = Image.open('tanger-kashbah-888.jpg')
img.thumbnail((160, 100))
img.save('test_debug_temp.jpg', quality=75)

with open('test_debug_temp.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

data_uri = f'data:image/jpeg;base64,{b64}'

payload = {
    "model": "qwen/qwen3-vl-4b",
    "input": [
        {"type": "text", "content": "What do you see?"},
        {"type": "image", "data_url": data_uri}
    ],
    "temperature": 0.7,
    "max_output_tokens": 256
}

print(f"Sending request to LM Studio...")
print(f"Image size: {len(b64)} chars base64")
print(f"\nPayload structure:")
print(f"  - model: {payload['model']}")
print(f"  - input items: {len(payload['input'])}")
for i, item in enumerate(payload['input']):
    print(f"    -{i}: type={item['type']}")

response = requests.post(
    'http://127.0.0.1:1234/api/v1/chat',
    json=payload,
    timeout=120
)

print(f"\n{'='*70}")
print(f"RAW RESPONSE FROM LM STUDIO")
print(f"{'='*70}")
print(f"Status Code: {response.status_code}")
print(f"\nFull JSON Response:")
print(json.dumps(response.json(), indent=2))

print(f"\n{'='*70}")
print(f"RESPONSE ANALYSIS")
print(f"{'='*70}")

data = response.json()

# Check response structure
if 'output' in data:
    print(f"✓ 'output' field exists: {len(data['output'])} items")
    for i, item in enumerate(data['output']):
        print(f"\n  Item {i}:")
        print(f"    Type: {item.get('type')}")
        if 'message' in item:
            msg = item['message']
            print(f"    Message: '{msg}' (length: {len(msg)})")
        else:
            print(f"    Keys: {list(item.keys())}")
else:
    print(f"✗ No 'output' field")
    print(f"Keys in response: {list(data.keys())}")

if 'error' in data:
    print(f"\n⚠️  Error in response: {data['error']}")

import os
os.remove('test_debug_temp.jpg')
