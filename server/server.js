import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS + body parsing
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json({ limit: '4mb' })); // increased for larger frame trees

// quick health check (must be FAST)
app.get('/health', (req, res) => res.status(200).send('ok'));

// ---- OpenAI client ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Prompt loading from files ----
function loadPrompt(filename) {
  try {
    const promptPath = path.join(__dirname, 'prompts', filename);
    const content = fs.readFileSync(promptPath, 'utf-8');
    
    // Extract prompt section (between "## System Prompt" and next "---")
    const match = content.match(/## System Prompt\s+([\s\S]*?)\n---/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Fallback: return everything after System Prompt header
    const fallback = content.split('## System Prompt')[1];
    return fallback ? fallback.trim() : content;
  } catch (e) {
    console.error(`[SRV] Failed to load prompt ${filename}:`, e.message);
    return null;
  }
}

// Load prompts from markdown files
const PROMPTS = {
  vision: loadPrompt('vision-v1.md'),
  text: loadPrompt('text-v1.md')
};

console.log('[SRV] Prompts loaded:', {
  vision: PROMPTS.vision ? 'OK' : 'FAILED',
  text: PROMPTS.text ? 'OK' : 'FAILED'
});

// ---- Prompts (versioned) ----
// Keep prompts as constants so we can A/B test easily.
// V1 focuses on nested component traversal guidance.
const SYSTEM_PROMPT_V1 = `
You are an accessibility engine (version a11y-v1) that assigns a logical keyboard/touch focus order for a single Figma frame.
You will receive a JSON tree of nodes (name, type, visible, x, y, w, h, children[]) which may contain nested components.

Return a strict JSON object:
{
  "annotations": [
    {
      "frameId": string,
      "order": [ { "id": string, "label": string, "role": string } ],
      "notes": string
    }
  ]
}

Rules:
- Always traverse NESTED structures: e.g., BottomNav -> Segment -> TabLabel. Prefer leaf interactive elements over container frames.
- Include only nodes that should receive focus.
- Prefer top-to-bottom, then left-to-right order unless strong semantics override (nav, modal, primary CTA).
- Use ARIA roles when possible (button, link, textbox/input, tab, navigation, main, header, footer).
- Never invent node IDs; only use IDs present in the input tree.
- If uncertain, include fewer items rather than guessing and add a short explanation in "notes".
- Output must be strict JSON matching the schema with no extra prose.

Example (simplified):
Input tree:
{
  "name": "Screen",
  "children": [
    { "id": "nav", "name": "Bottom Nav", "children": [
      { "id": "seg1", "name": "Train", "children": [ { "id": "tab1", "name": "Tab Label" } ] },
      { "id": "seg2", "name": "Stats" }
    ]},
    { "id": "cta", "name": "Start Button" }
  ]
}
Desired order: ["tab1", "seg2", "cta"] with roles ["tab", "tab", "button"].
`;

// ---- In-memory cache ----
const ANNO_CACHE = new Map();

// ---- Utils ----
function quickHash(str) {
  let h = 0, i = 0, len = str.length;
  while (i < len) { h = (h << 5) - h + str.charCodeAt(i++) | 0; }
  return (h >>> 0).toString(16);
}

function flattenIds(node, out) {
  if (!node) return;
  if (!out) out = new Set();
  if (node.id) out.add(node.id);
  if (Array.isArray(node.children)) {
    for (const c of node.children) flattenIds(c, out);
  }
  return out;
}

function readingOrder(a, b) {
  const ay = typeof a.y === 'number' ? a.y : 0;
  const by = typeof b.y === 'number' ? b.y : 0;
  if (Math.abs(ay - by) > 6) return ay - by;
  const ax = typeof a.x === 'number' ? a.x : 0;
  const bx = typeof b.x === 'number' ? b.x : 0;
  return ax - bx;
}

function guessLabelRole(name) {
  const n = (name || '').toLowerCase();
  if (/\b(button|cta|start|submit|save|next|continue|swap)\b/.test(n)) return { label: 'primary-cta', role: 'button' };
  if (/\b(link|learn more|details|back)\b/.test(n)) return { label: 'link', role: 'link' };
  if (/\b(input|email|password|search|textbox)\b/.test(n)) return { label: 'input', role: 'textbox' };
  if (/\b(nav|navigation|menu)\b/.test(n)) return { label: 'navigation', role: 'navigation' };
  if (/\b(header|title|app bar|top nav)\b/.test(n)) return { label: 'header', role: 'landmark' };
  return { label: 'item', role: 'generic' };
}

function heuristicFallback(frame) {
  // depth-first gather nodes with simple filters
  const acc = [];
  (function walk(n) {
    if (!n || n.visible === false) return;
    const hasSize = typeof n.w === 'number' && typeof n.h === 'number' ? (n.w > 0 && n.h > 0) : true;
    if (hasSize) acc.push(n);
    if (Array.isArray(n.children)) for (const c of n.children) walk(c);
  })(frame.tree || { children: frame.children || [] });

  acc.sort(readingOrder);
  const seen = new Set();
  const order = [];
  for (const n of acc) {
    if (!n.id || seen.has(n.id)) continue;
    seen.add(n.id);
    const { label, role } = guessLabelRole(n.name);
    order.push({ id: n.id, label, role });
    if (order.length >= 25) break;
  }
  return [{ frameId: frame.id, order, notes: 'heuristic-fallback' }];
}

function sanitizeOutput(modelOut, validIds, frameId) {
  try {
    const ann = modelOut && modelOut.annotations && modelOut.annotations[0];
    if (!ann || !Array.isArray(ann.order)) return null;

    const filtered = [];
    const seen = new Set();
    for (const it of ann.order) {
      if (!it || typeof it.id !== 'string') continue;
      if (!validIds.has(it.id)) continue;
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      filtered.push({
        id: it.id,
        label: String(it.label || 'item'),
        role: it.role ? String(it.role) : undefined,
      });
    }
    return [{ frameId, order: filtered, notes: ann.notes || '' }];
  } catch {
    return null;
  }
}

// ---- /annotate endpoint ----
app.post('/annotate', async (req, res) => {
  try {
    const { platform, frames } = req.body || {};
    if (!Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ ok: false, error: 'No frames' });
    }
    const frame = frames[0];
    const tree = frame.tree || { children: frame.children || [] };

    // Build checksum (stable across same structure)
    const keyRaw = JSON.stringify({ platform, id: frame.id, name: frame.name, box: frame.box, tree });
    const checksum = quickHash(keyRaw);

    // Cache hit?
    const cached = ANNO_CACHE.get(checksum);
    if (cached) {
      return res.json({ ok: true, checksum, annotations: cached.annotations, notes: 'cacheHit' });
    }

    // Valid IDs set for validation
    const validIds = flattenIds(tree);

    // Compose prompts
    const systemPrompt = SYSTEM_PROMPT_V1;

    const userPrompt = [
      `Platform: ${platform || 'web'}`,
      `Frame: ${frame.name || ''}`,
      `Tree:`,
      JSON.stringify(tree, null, 2)
    ].join('\n');

    let modelOut = null;
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      });
      modelOut = JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      console.error('[SRV] OpenAI error:', e && e.message || e);
    }

    // Validate & sanitize
    let annotations = null;
    if (modelOut) {
      annotations = sanitizeOutput(modelOut, validIds || new Set(), frame.id);
    }

    // Fallback if needed
    if (!annotations || !annotations[0] || !annotations[0].order || annotations[0].order.length === 0) {
      annotations = heuristicFallback({ id: frame.id, tree });
    }

    // Cache and return
    const payload = { ok: true, checksum, annotations };
    ANNO_CACHE.set(checksum, payload);
    return res.json(payload);
  } catch (err) {
    console.error('[SRV] /annotate error', err);
    return res.status(500).json({ ok: false, error: String(err && err.message || err) });
  }
});

// Export app for testing
export { app };

// ***CRITICAL*** — bind to Render's provided PORT and 0.0.0.0
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SRV] Listening on :${PORT}`);
});
