import express from 'express';

const app = express();
app.use(express.json());

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
    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ ok: false, error: 'No frames provided' });
    }

    // TODO: plug in your AI here. For now, return a mock.
    const annotations = frames.map((f, i) => ({
      frameId: f.id ?? `frame-${i}`,
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