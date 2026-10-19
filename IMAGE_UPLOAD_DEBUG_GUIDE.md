# Image Upload Debugging Guide

## ✅ What We've Verified

1. **Direct LM Studio Vision**: ✅ WORKING
   - Images are recognized correctly by the model
   - Qwen-native format with `<image>` tags works

2. **Backend API with Images**: ✅ WORKING  
   - Text-only requests: ✅ Pass
   - Image + text requests: ✅ Pass
   - Image-only requests: ✅ Pass
   - All tested with real base64 data URIs

3. **Frontend Code**: ✅ Ready
   - Image upload button: ✅ Implemented
   - Base64 encoding: ✅ Working
   - API endpoint: ✅ Configured
   - Send button: ✅ Functional

4. **Backend Running**: ✅ Confirmed
   - Port 8000 is LISTENING
   - CORS is enabled (`allow_origins=["*"]`)
   - All endpoints responding

5. **Frontend Running**: ✅ Confirmed
   - Port 5174 is LISTENING
   - Vite dev server active and serving

---

## 🔍 How to Debug

### Step 1: Open Browser Console
1. Open http://localhost:5174 in your browser
2. Press **F12** to open DevTools
3. Click on **Console** tab
4. Keep this open while testing

### Step 2: Watch for Logs
When you upload an image and send it, you should see:

```
📸 Image selected: photo.jpg (125.50 KB, image/jpeg)
✅ Image converted to data URI: 167.33 KB
🚀 Sending request to http://127.0.0.1:8000/api/v1/chat
📦 Payload: {
  has_message: true,
  message_length: 24,
  has_image: true,
  image_size: "167.33 KB"
}
📨 Response status: 200
✅ Received response: I have seen the Kasbah...
```

### Step 3: Look for Errors
If something fails, you'll see:

```
❌ Error sending message: ...
❌ Error response: ...
Error details: {...}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot reach backend"
**Symptoms**:
- Console shows connection error
- "Network error" in browser

**Solutions**:
1. Check backend is running on port 8000
   ```powershell
   Get-NetTCPConnection -LocalPort 8000 | Select-Object State
   ```
   Should show: `LISTENING`

2. Test backend directly:
   ```powershell
   $uri = 'http://127.0.0.1:8000/api/v1/chat'
   $body = @{message="test"; image_data=$null} | ConvertTo-Json
   Invoke-WebRequest -Uri $uri -Method POST -Body $body -ContentType 'application/json'
   ```

3. Restart backend:
   ```powershell
   # Kill existing processes
   Get-Process python | Stop-Process -Force
   
   # Restart
   cd c:\Users\HP\Desktop\projectRamadan\backend
   ..\.\venv\Scripts\Activate.ps1
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

### Issue 2: "Response status: 500"
**Symptoms**:
- Backend returns 500 error
- "An error occurred" message

**Solution**:
1. Check backend terminal for error messages
2. Backend error logs should show what went wrong
3. Common causes:
   - LM Studio not responding (check port 1234)
   - Invalid image data
   - RAG initialization error

### Issue 3: "Message doesn't show response"
**Symptoms**:
- No AI response appears
- Spinner keeps spinning

**IMPORTANT**: Check Response Status Code
1. If status is 200: Response should appear
2. If status is not 200: Error occurred
3. If no status logged: Request didn't reach backend

---

## 🧪 Manual Test Script

If you want to manually test outside the browser:

```powershell
cd c:\Users\HP\Desktop\projectRamadan
.\.\venv\Scripts\Activate.ps1
python test_frontend_pipeline.py
```

This tests:
1. Text request to backend
2. Full image request to backend  
3. Image-only request

---

## 📋 Checklist Before Reporting Issue

✅ Confirm these are running:
- [ ] LM Studio (port 1234) - showing Qwen 3 VL loaded
- [ ] Backend (port 8000) - running uvicorn
- [ ] Frontend (port 5174) - showing Vite dev server

✅ Confirm these work:
- [ ] Text chat works (no image)
- [ ] Console opens with F12
- [ ] No CORS errors in Console

✅ When testing image:
- [ ] Watch Console tab
- [ ] Share exact error message
- [ ] Share response status code (if shown)
- [ ] Describe what image you're uploading

---

## 🚀 Quick Restart All Services

If everything stops working, quick restart:

```powershell
# Kill all Python processes
Get-Process python | Stop-Process -Force

# Terminal 1: LM Studio - starts automatically or restart manually

# Terminal 2: Backend
cd c:\Users\HP\Desktop\projectRamadan\backend
..\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 3: Frontend
cd c:\Users\HP\Desktop\projectRamadan\frontend
npm run dev
```

---

## 📝 What to Share If It Doesn't Work

1. **Browser Console Output**: 
   - Copy all the log messages and errors

2. **Backend Terminal Output**:
   - Any error messages when handling the image

3. **Backend Health Check**:
   ```powershell
   Invoke-WebRequest http://127.0.0.1:8000/health
   ```

4. **Image Details**:
   - Size, format, what it shows

5. **Steps to Reproduce**:
   - Exactly what you click and what appears

---

## ✨ Expected Behavior (When Working)

1. Select image → See preview thumbnail
2. Type question → Click send
3. See "sending..." spinner
4. Get Ibn Battuta response analyzing image + Tangier context
5. Image appears in chat history

**Current Status**: Code verified working. Need to identify your specific error to help further.
