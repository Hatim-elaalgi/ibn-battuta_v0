#!/usr/bin/env python3
"""Find the maximum image size that works"""
import requests
import base64
from PIL import Image
import os

image_path = 'tanger-kashbah-888.jpg'

# Based on pattern: n_keep ≈ 750 tokens per KB of base64
# For n_keep < 4096, we need < 5.46 KB
# Test around this boundary

test_configs = [
    (160, 90, 40),   # Expect ~4 KB
    (140, 80, 38),   # Expect ~3 KB
]

for width, height, quality in test_configs:
    print(f"\nTesting {width}x{height}, Q{quality}...", end=" ", flush=True)
    
    img = Image.open(image_path)
    img.thumbnail((width, height))
    temp = 'temp.jpg'
    img.save(temp, quality=quality, optimize=True)
    
    with open(temp, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('utf-8')
    
    size_kb = len(b64) / 1024
    
    payload = {
        "messages": [
            {"role": "user", "content": f"Describe:\n<image>data:image/jpeg;base64,{b64}</image>"}
        ],
        "temperature": 0.6,
        "top_p": 0.9,
        "max_tokens": 100,
        "stream": False
    }
    
    try:
        r = requests.post("http://127.0.0.1:1234/v1/chat/completions", json=payload, timeout=120)
        
        if r.status_code == 200:
            print(f"✅ Base64: {size_kb:.2f} KB")
        else:
            error = r.json()['error']
            print(f"❌ Base64: {size_kb:.2f} KB - {error}")
    except Exception as e:
        print(f"Error: {e}")
    
    os.remove(temp)

print("\n" + "="*70)
print("TESTING ULTRA-SMALL")
print("="*70)

# Try 120x70 Q30
img = Image.open(image_path)
img.thumbnail((120, 70))
img.save('temp.jpg', quality=30, optimize=True)

with open('temp.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

size_kb = len(b64) / 1024
print(f"120x70, Q30: Base64 {size_kb:.2f} KB ... ", end="", flush=True)

payload = {
    "messages": [
        {"role": "user", "content": f"What is this place?\n<image>data:image/jpeg;base64,{b64}</image>"}
    ],
    "temperature": 0.6,
    "top_p": 0.9,
    "max_tokens": 150,
    "stream": False
}

try:
    r = requests.post("http://127.0.0.1:1234/v1/chat/completions", json=payload, timeout=120)
    
    if r.status_code == 200:
        resp = r.json()['choices'][0]['message']['content']
        print(f"✅ SUCCESS!\n{resp[:100]}...")
    else:
        error = r.json()['error']
        print(f"❌ {error}")
except Exception as e:
    print(f"Error: {e}")

os.remove('temp.jpg')
