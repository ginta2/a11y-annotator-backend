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

/**
 * Allow:
 *  - Figma desktop app (origin === 'null' or no origin)
 *  - figma.com (and subdomains)
 *  - our own frontends/tools during tests
 */
const corsOrigin = (origin, cb) => {
  if (!origin || origin === 'null') return cb(null, true); // Figma desktop app
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host === 'www.figma.com' || host.endsWith('.figma.com')) return cb(null, true);
    return cb(null, true); // we are not exposing credentials, so permissive CORS is fine
  } catch {
    return cb(null, false);
  }
};

const corsMw = cors({
  origin: corsOrigin,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,
  maxAge: 86400,
});

// CORS + security headers for every request
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

app.use(corsMw);

// Respond to preflight explicitly (important on Render)
app.options('/annotate', corsMw, (req, res) => res.sendStatus(204));

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