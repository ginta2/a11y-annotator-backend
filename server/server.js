// server/server.js

import express from 'express';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

// --- Robust CORS for Figma Desktop & web ---
// Figma Desktop often sends Origin: null. Allow it (or use '*').
const ALLOW_ORIGINS = ['*', 'null', 'https://www.figma.com'];

app.use((req, res, next) => {
  const origin = req.headers.origin || 'null';

  // allow "*" or the incoming origin
  if (ALLOW_ORIGINS.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (ALLOW_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // methods & headers the client will use
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With'
  );

  // optional (helps avoid extra preflights)
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');

  // IMPORTANT: fast-exit preflight with 204 and no body
  if (req.method === 'OPTIONS') {
    // (Optional) log for diagnostics
    console.log('[SRV] CORS preflight ok', {
      path: req.path,
      origin: req.headers.origin,
      reqHeaders: req.headers['access-control-request-headers'],
      reqMethod: req.headers['access-control-request-method'],
    });
    return res.status(204).end();
  }

  next();
});

// Parse JSON
app.use(express.json({ limit: '2mb' }));

// Debug logging for all requests
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} origin=${req.headers.origin || 'none'}`);
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