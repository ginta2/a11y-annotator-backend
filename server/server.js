import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();

// CORS + body parsing
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '4mb' })); // increased for larger frame trees

// quick health check (must be FAST)
app.get('/health', (req, res) => res.status(200).send('ok'));

// Inline focusable extractor to avoid module resolution issues
function isLikelyButton(node) {
  const n = (node.name || '').toLowerCase();
  return n.includes('btn') || n.includes('button') || (node.cornerRadius > 0 && node.children && node.children.some && node.children.some(function(c) { return c.type === 'TEXT'; }));
}

function isLikelyHeading(node) {
  const n = (node.name || '').toLowerCase();
  return n.startsWith('h1') || n.startsWith('h2') || n.includes('title') || n.includes('header') || (node.fontSize >= 20 && node.fontWeight >= 600);
}

function visibleText(node) {
  if (node.type === 'TEXT' && typeof node.characters === 'string') return node.characters.trim().slice(0, 80);
  const t = node.children && node.children.find && node.children.find(function(c) { return c.type === 'TEXT' && c.characters; });
  return ((t && t.characters) || node.name || '').toString().trim().slice(0, 80);
}

function labelFor(node) {
  const t = visibleText(node);
  if (isLikelyButton(node)) return 'Button: ' + (t || node.name || 'Unnamed');
  if (isLikelyHeading(node)) return 'Heading: ' + (t || node.name || 'Untitled');
  return t ? t : (node.name || 'Item');
}

function extractAndOrder(root, cap) {
  if (cap === undefined) cap = 25;
  
  const out = [];
  (function walk(n) {
    if (!n) return;
    const name = (n.name || '').toLowerCase();
    const candidate =
      n.type === 'TEXT' ||
      isLikelyButton(n) ||
      name.includes('link') || name.includes('cta') || name.includes('nav') ||
      n.role === 'button' || n.role === 'link';
    if (candidate) out.push({ 
      id: n.id, 
      label: labelFor(n), 
      x: (n.absoluteX !== null && n.absoluteX !== undefined ? n.absoluteX : n.x) || 0, 
      y: (n.absoluteY !== null && n.absoluteY !== undefined ? n.absoluteY : n.y) || 0 
    });
    if (Array.isArray(n.children)) n.children.forEach(walk);
  })(root);

  out.sort(function(a, b) { return (a.y - b.y) || (a.x - b.x); });
  if (out.length > cap) out.length = cap;
  return out;
}

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

app.post('/annotate', express.json({ limit: '4mb' }), async (req, res) => {
  res.set(CORS);

  try {
    const { frames = [], platform, prompt = '' } = req.body || {};
    
    // Build a checksum of structure (ids, bbox, names). Expect client to send minimal tree.
    const rawKey = JSON.stringify(frames.map(function(f) {
      return {
        id: f.id, 
        name: f.name, 
        box: f.box,
        // include children signature if provided
        sig: f.children && f.children.map ? f.children.map(function(c) { return [c.id, c.name, c.box]; }) : []
      };
    }));
    const checksum = crypto.createHash('md5').update(rawKey).digest('hex').slice(0, 8);

    const cacheKey = 'annotate:' + checksum + ':' + (platform || 'web');
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ ok: true, annotations: cached, notes: 'cacheHit', checksum });

    const annotations = frames.map(function(f) {
      const order = extractAndOrder(f);
      return { frameId: f.id, order };
    });

    cache.set(cacheKey, annotations);
    res.json({ ok: true, annotations, checksum });
  } catch (e) {
    console.error('[SRV] /annotate error', e);
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
});

// Export app for testing
export { app };

// ***CRITICAL*** — bind to Render's provided PORT and 0.0.0.0
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SRV] Listening on :${PORT}`);
});