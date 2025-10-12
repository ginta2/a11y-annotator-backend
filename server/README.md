# A11y Annotator Backend Server

Backend API server for the A11y Annotator Figma Plugin.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Set Up Environment
```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start the Server
```bash
# Start the server
npm start

# Or for development
npm run dev
```

The server will start on `http://localhost:8787`

## 🔧 Troubleshooting

### Port Already in Use
If you get "address already in use" error:

```bash
# Kill any process using port 8787
npm run kill

# Then start again
npm start
```

### Manual Kill (if npm run kill doesn't work)
```bash
# Find what's using port 8787
lsof -i :8787

# Kill the process (replace PID with the number from lsof)
kill -9 PID
```

## 🧪 Testing

### Test Health Endpoint
```bash
curl http://localhost:8787/health
```

### Test Annotation Endpoint
```bash
# Create test data
TEST_B64=$(printf 'test' | base64)

# Send test request
curl -X POST http://localhost:8787/annotate \
  -H "Content-Type: application/json" \
  -d "{\"imageBase64\":\"$TEST_B64\",\"nodeTree\":{\"nodes\":[{\"id\":\"1\",\"type\":\"RECTANGLE\",\"name\":\"Button\",\"abs\":{\"x\":0,\"y\":0,\"w\":100,\"h\":40},\"visible\":true,\"hasProto\":false}]}}"
```

Expected response: `{"focus":[],"warnings":[]}` or AI results.

## 📋 Available Scripts

- `npm start` - Start the server
- `npm run dev` - Start the server (same as start)
- `npm run kill` - Kill any process using port 8787

## 🔗 Integration

The Figma plugin will automatically connect to `http://localhost:8787` when running. Make sure the server is running before using the plugin's AI features.