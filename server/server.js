// server/server.js

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// --- Body size limits (images/base64) ---
app.use(bodyParser.json({ limit: '25mb' }));
app.use(bodyParser.urlencoded({ limit: '25mb', extended: true }));

// --- CORS setup ---
// Figma Desktop often sends origin "null". Allow that explicitly.
const allowedOrigins = new Set([
  'https://www.figma.com',
  'https://a11y-annotator-backend.onrender.com',
  null, // Figma desktop app
]);

const corsOptions = {
  origin: (origin, cb) => {
    // Allow no Origin (like curl) or null (Figma desktop) or any allowed web origin
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    // Optionally allow everything during dev:
    // return cb(null, true);
    return cb(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
};

// Apply CORS globally and handle preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- Health check ---
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    hasKey: !!(process.env.OPENAI_API_KEY || '').trim(),
    model: process.env.MODEL || 'gpt-4o-mini',
    port: Number(process.env.PORT || 10000),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// --- Annotate endpoint ---
app.post('/annotate', cors(corsOptions), async (req, res) => {
  try {
    console.log('[SRV] /annotate hit', {
      origin: req.headers.origin || null,
      contentType: req.headers['content-type'] || null,
      bodyKeys: Object.keys(req.body || {}),
    });

    const { platform, text, imageBase64 } = req.body;

    // Mock AI response for now
    const response = {
      ok: true,
      annotations: [
        { id: 1, label: "Button: Start Workout" },
        { id: 2, label: "Text: Weekly Goal" },
        { id: 3, label: "Input: Enter Name" }
      ],
      platform,
      model: process.env.MODEL || 'gpt-4o-mini'
    };

    return res.json(response);
  } catch (err) {
    console.error('[SRV] annotate error', err);
    return res.status(500).json({ ok: false, reason: 'server', error: String(err?.message || err) });
  }
});

// --- Boot ---
const PORT = Number(process.env.PORT || 10000);
app.listen(PORT, () => {
  console.log('[SRV] Listening on http://localhost:' + PORT);
  console.log('[SRV] Model:', process.env.MODEL || 'gpt-4o-mini');
  console.log('[SRV] OpenAI Key:', (process.env.OPENAI_API_KEY ? '✓ loaded' : '✗ missing'));
  console.log('[SRV] Health check: http://localhost:' + PORT + '/health');
});