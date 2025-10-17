import express from 'express';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

app.options('/annotate', (req, res) => {
  res.set(CORS).status(204).end();
});

app.post('/annotate', async (req, res) => {
  res.set(CORS);

  try {
    const { frames, platform, prompt } = req.body || {};
    
    // Validate payload size
    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > 50 * 1024 * 1024) { // 50MB limit
      console.warn('[SRV] Payload too large:', Math.round(payloadSize / 1024 / 1024), 'MB');
      return res.status(413).json({ ok: false, error: 'Payload too large' });
    }
    
    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ ok: false, error: 'No frames provided' });
    }
    
    // Limit number of frames
    if (frames.length > 10) {
      console.warn('[SRV] Too many frames:', frames.length);
      return res.status(400).json({ ok: false, error: 'Too many frames (max 10)' });
    }

    // TODO: plug in your AI here. For now, return a mock.
    const annotations = frames.map((f, i) => ({
      frameId: (f.id !== null && f.id !== undefined ? f.id : `frame-${i}`),
      order: ['header', 'main', 'primary-cta'],
      notes: [
        `Platform: ${platform || 'unknown'}`,
        prompt ? `Prompt: ${prompt}` : 'No extra prompt'
      ],
    }));

    return res.json({ ok: true, annotations });
  } catch (e) {
    console.error('[SRV] /annotate error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Health (keep)
app.get('/health', (req, res) => res.set(CORS).json({ ok: true }));

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`[SRV] Listening on :${port}`));