# Backend Setup Guide

This guide will help you set up the backend server for the A11y Annotator plugin, implementing PR7 and PR8 from the PRD.

## 🚀 Quick Start

### 1. Install Backend Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your OpenAI API key
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the Backend Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

### 4. Test the Backend
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test annotation endpoint (with sample data)
curl -X POST http://localhost:3000/annotate \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"test","nodeTree":{"id":"123","name":"test"},"platform":"web"}'
```

## 🔧 Plugin Integration

### 1. Reload the Plugin
1. In Figma, go to **Plugins** → **Development**
2. Find **"A11y Annotator - Focus Order v1.1"**
3. Click **"Stop"** if running
4. Click **"Run"** to restart with backend integration

### 2. Test Backend Connection
1. Open the plugin sidebar
2. Enter any API key (the plugin now tests backend connectivity)
3. Click **"🔗 Test Connection"**
4. Should show **"✅ API key is valid!"** if backend is running

### 3. Generate Focus Order
1. Select a frame in Figma
2. Click **"🧠 Propose Focus Order"**
3. Plugin will call backend → backend calls OpenAI → returns results

## 🏗️ Architecture Overview

```
Figma Plugin → Backend Server → OpenAI Vision API
     ↓              ↓                ↓
  UI Actions    /annotate      GPT-4 Vision
  Node Tree     endpoint       Analysis
  Image Export  Error Handling JSON Response
```

## 🔍 Troubleshooting

### Backend Not Starting
```bash
# Check if port 3000 is available
lsof -i :3000

# Try different port
PORT=3001 npm start
```

### Plugin Can't Connect to Backend
1. **Check backend is running**: `curl http://localhost:3000/health`
2. **Check Figma console**: Look for network errors
3. **Verify manifest**: Ensure `http://localhost:3000` is in allowed domains

### OpenAI API Errors
1. **Check API key**: Ensure it's valid and has credits
2. **Check backend logs**: Look for OpenAI error messages
3. **Test API key**: Use OpenAI's playground to verify

### Fallback Behavior
- If backend is unavailable → Plugin uses heuristics only
- If OpenAI fails → Backend returns empty results
- Plugin always falls back gracefully

## 📊 Expected Results

### With Backend Running
- ✅ **Test Connection**: Shows success
- ✅ **Focus Order**: Uses AI + heuristics
- ✅ **Console**: Shows backend communication logs

### Without Backend
- ⚠️ **Test Connection**: Shows failure
- ✅ **Focus Order**: Uses heuristics only (still works!)
- ✅ **Console**: Shows fallback messages

## 🚀 Production Deployment

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from server directory
cd server
vercel

# Set environment variables in Vercel dashboard
OPENAI_API_KEY=your_key_here
```

### Update Plugin for Production
1. Update `getBackendUrl()` in `code.js` to use production URL
2. Update manifest.json with production domain
3. Test with production backend

## 📈 Performance

### Expected Response Times
- **Backend Health Check**: < 100ms
- **AI Focus Order**: 5-15 seconds
- **Heuristics Only**: < 1 second

### Cost Estimates
- **OpenAI API**: ~$0.01-0.05 per frame
- **Backend Hosting**: Free tier (Vercel/Netlify)
- **Total**: Minimal cost for development/testing

## 🔒 Security Notes

- **API Keys**: Stored securely in backend environment
- **CORS**: Configured for Figma plugin communication
- **Input Validation**: All inputs validated and sanitized
- **Error Handling**: No sensitive data exposed in errors

---

**Ready to test?** Start the backend server and reload your Figma plugin! 🎯


