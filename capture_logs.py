#!/usr/bin/env python3
"""Direct test: send base64 to backend, capture logs"""
import subprocess
import sys
import time
import requests
import base64
from PIL import Image
import os

# Prepare image
img = Image.open('tanger-kashbah-888.jpg')
img.thumbnail((160, 100))
img.save('test.jpg', quality=40)

with open('test.jpg', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')

data_uri = f'data:image/jpeg;base64,{b64}'

# Start backend and capture output
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd="backend",
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)

time.sleep(3)

try:
    # Send request
    print("Sending request...")
    r = requests.post(
        'http://127.0.0.1:8000/api/v1/chat',
        json={'message': 'What is this?', 'image_data': data_uri},
        timeout=120
    )
    
    print(f"Response: {r.status_code}")
    print(r.json()['response'][:200])
    
except Exception as e:
    print(f"Error: {e}")

# Capture last output
time.sleep(1)
try:
    output, _ = proc.communicate(timeout=1)
    print("\n" + "="*70)
    print("BACKEND LOGS:")
    print("="*70)
    print(output[-2000:])  # Last 2000 chars
except:
    pass

finally:
    try:
        os.kill(proc.pid, 9)
    except:
        pass
    os.remove('test.jpg')
