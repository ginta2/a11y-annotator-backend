// server/server.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// Parse JSON
app.use(express.json({ limit: '2mb' }));

// Debug logging for all requests
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} origin=${req.headers.origin || 'none'}`);
  next();
});

const allowOrigin = (origin, cb) => {
  // Figma Desktop & local files show Origin "null"
  if (!origin || origin === 'null') return cb(null, true);
  // Allow our production host
  const allowed = [
    'https://a11y-annotator-backend.onrender.com'
    // add more if needed
  ];
  if (allowed.includes(origin)) return cb(null, true);
  // also allow https in general if you want to be permissive:
  if (/^https:\/\//.test(origin)) return cb(null, true);
  return cb(null, false);
};

app.use(cors({
  origin: allowOrigin,
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  maxAge: 86400,
}));

// Ensure preflights are handled for all routes
app.options('*', cors({
  origin: allowOrigin,
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With'],
  maxAge: 86400,
}));

// Also add a tiny middleware to always emit ACAO and Vary for safety
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ---- HEALTH ----
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    hasKey: !!process.env.OPENAI_API_KEY,
    model: process.env.MODEL || 'gpt-4o-mini',
    port: Number(process.env.PORT || 8787),
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ---- ANNOTATE ----
// Keep your current logic, but ensure it returns JSON and never HTML;
// add a basic guard + logs for visibility.
app.post('/annotate', async (req, res) => {
  try {
    console.log('[SRV] /annotate hit', {
      origin: req.headers.origin || null,
      contentType: req.headers['content-type'] || null,
      bodyKeys: Object.keys(req.body || {}),
    });

    // minimal input guard
    const { platform, text, imageBase64 } = req.body || {};
    if (!platform) {
      return res.status(400).json({ ok: false, reason: 'bad_request', message: 'platform required' });
    }

    // Mock AI response for now (preserving existing logic)
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

    return res.status(200).json(response);
  } catch (err) {
    console.error('[ANNOTATE] error', err);
    return res.status(500).json({ ok: false, reason: 'server', error: String(err?.message || err) });
  }
});

// ---- LISTEN ----
const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => {
  console.log(`[SRV] Listening on http://localhost:${PORT}`);
  console.log(`[SRV] Model: ${process.env.MODEL || 'gpt-4o-mini'}`);
  console.log(`[SRV] OpenAI Key: ${process.env.OPENAI_API_KEY ? '✓ loaded' : '✗ missing'}`);
  console.log(`[SRV] Health check: http://localhost:${PORT}/health`);
});