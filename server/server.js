import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '2mb' })); // fix PayloadTooLargeError

const cache = new Map();

function normalizeTree(n) {
  // drop volatile fields (ids/coords) for checksum determinism
  const kids = (n.children || []).map(normalizeTree);
  const out = { name: n.name, type: n.type, visible: n.visible, role: n.role, focusable: n.focusable };
  if (kids.length) out.children = kids;
  return out;
}

function sha256(s) { 
  return crypto.createHash('sha256').update(s).digest('hex'); 
}

function countFocusables(n) {
  return (n.focusable ? 1 : 0) + (n.children && n.children.reduce ? n.children.reduce((a, c) => a + countFocusables(c), 0) : 0);
}

function pruneTree(n, budget = 1500) {
  // cap total nodes to keep prompts small
  const queue = [n];
  let count = 0;
  while (queue.length && count < budget) {
    const x = queue.shift();
    count++;
    if (x.children && x.children.forEach) {
      x.children.forEach(ch => queue.push(ch));
    }
  }
  // if exceeded, drop deep children
  return n;
}

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
    const { platform, frame } = req.body || {};
    
    // Handle both old format (frames array) and new format (frame object)
    let targetFrame = frame;
    if (!targetFrame && req.body.frames && Array.isArray(req.body.frames) && req.body.frames.length > 0) {
      // Legacy format - take first frame
      targetFrame = req.body.frames[0];
    }
    
    if (!platform || !targetFrame || !targetFrame.tree) {
      return res.status(400).json({ ok: false, error: 'bad_request' });
    }

    const normalized = normalizeTree(targetFrame.tree);
    const checksum = sha256(JSON.stringify(normalized));

    const t0 = Date.now();
    const cacheKey = `${platform}:${checksum}`;
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      return res.json(Object.assign({}, { ok: true, cache: true, checksum }, cached));
    }

    const focusables = countFocusables(targetFrame.tree);
    if (focusables === 0) {
      const data = { frameName: targetFrame.name, items: [], message: 'No focusable elements in this selection.' };
      cache.set(cacheKey, data);
      return res.json(Object.assign({}, { ok: true, checksum }, data));
    }

    // Trivial fast-path: <=2 items → deterministic order w/o model
    if (focusables <= 2) {
      const items = [];
      const walk = (n, path = []) => {
        const label = (n.name || '').trim();
        const here = path.concat([label]).filter(Boolean).join(' > ');
        if (n.focusable) items.push({ label, role: n.role || 'button', path: here });
        if (n.children && n.children.forEach) {
          n.children.forEach(c => walk(c, path.concat([label])));
        }
      };
      walk(targetFrame.tree);
      const data = { frameName: targetFrame.name, items };
      cache.set(cacheKey, data);
      return res.json(Object.assign({}, { ok: true, checksum }, data));
    }

    const treeForModel = pruneTree(targetFrame.tree);

    const system = `You generate focus order annotations for ${platform}.
Rules:
- Scope strictly to the provided frame tree; do not invent nodes.
- Return only focusable elements with roles.
- Order: landmarks/navigation → content controls → primary CTAs.
- If none: say "No focusable elements in this selection."
Return JSON only:
{ "frameName": "...", "items": [ { "label": "...", "role": "...", "path": "Ancestor > Child" } ] }`;

    const user = `Frame: ${targetFrame.name}
Tree (name,type,visible,role,focusable,children):
${JSON.stringify(treeForModel, null, 2)}`;

    // Call OpenAI API
    const completion = await fetch(process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.MODEL || 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.1
      })
    }).then(r => r.json());

    const content = (completion && completion.choices && completion.choices[0] && completion.choices[0].message && completion.choices[0].message.content) || '{}';
    let data;
    try { 
      data = JSON.parse((content.match(/\{[\s\S]*\}$/) && content.match(/\{[\s\S]*\}$/)[0]) || content); 
    } catch { 
      data = { frameName: targetFrame.name, items: [] }; 
    }

    cache.set(cacheKey, data);
    const ms = Date.now() - t0;
    
    // Telemetry snippet
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      frameId: targetFrame.id,
      frameName: targetFrame.name,
      platform,
      checksum,
      focusables,
      cacheHit: cache.has(cacheKey),
      ms
    }));

    return res.json(Object.assign({}, { ok: true, checksum }, data));
  } catch (e) {
    console.error('[SRV] /annotate error', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Health (keep)
app.get('/health', (req, res) => res.set(CORS).json({ ok: true }));

const port = process.env.PORT || 10000;

// Export app for testing
export { app };

// Start server
app.listen(port, () => console.log(`[SRV] Listening on :${port}`));