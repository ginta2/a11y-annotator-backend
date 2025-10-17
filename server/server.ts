// server/server.ts
import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';

const app = express();
app.use(express.json({ limit: '2mb' })); // fix PayloadTooLargeError

type NodeDTO = {
  name: string; type: string; visible: boolean;
  role?: string; focusable: boolean; children?: NodeDTO[];
};

type FramePayload = { id: string; name: string; tree: NodeDTO; };
type Body = { platform: 'web'|'rn'; frame: FramePayload; };

const cache = new Map<string, any>();

function normalizeTree(n: NodeDTO): any {
  // drop volatile fields (ids/coords) for checksum determinism
  const kids = (n.children || []).map(normalizeTree);
  const out: any = { name: n.name, type: n.type, visible: n.visible, role: n.role, focusable: n.focusable };
  if (kids.length) out.children = kids;
  return out;
}
function sha256(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }

function countFocusables(n: NodeDTO): number {
  return (n.focusable ? 1 : 0) + (n.children?.reduce((a, c) => a + countFocusables(c), 0) || 0);
}

function pruneTree(n: NodeDTO, budget = 1500): NodeDTO {
  // cap total nodes to keep prompts small
  const queue: NodeDTO[] = [n];
  let count = 0;
  while (queue.length && count < budget) {
    const x = queue.shift()!;
    count++;
    x.children?.forEach(ch => queue.push(ch));
  }
  // if exceeded, drop deep children
  return n;
}

app.post('/annotate', async (req, res) => {
  const { platform, frame } = req.body as Body;
  if (!platform || !frame?.tree) return res.status(400).json({ ok: false, error: 'bad_request' });

  const normalized = normalizeTree(frame.tree);
  const checksum = sha256(JSON.stringify(normalized));

  const t0 = Date.now();
  const cacheKey = `${platform}:${checksum}`;
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    return res.json({ ok: true, cache: true, checksum, ...cached });
  }

  const focusables = countFocusables(frame.tree);
  if (focusables === 0) {
    const data = { frameName: frame.name, items: [], message: 'No focusable elements in this selection.' };
    cache.set(cacheKey, data);
    return res.json({ ok: true, checksum, ...data });
  }

  // Trivial fast-path: <=2 items → deterministic order w/o model
  if (focusables <= 2) {
    const items: any[] = [];
    const walk = (n: NodeDTO, path: string[] = []) => {
      const label = (n.name || '').trim();
      const here = path.concat([label]).filter(Boolean).join(' > ');
      if (n.focusable) items.push({ label, role: n.role || 'button', path: here });
      n.children?.forEach(c => walk(c, path.concat([label])));
    };
    walk(frame.tree);
    const data = { frameName: frame.name, items };
    cache.set(cacheKey, data);
    return res.json({ ok: true, checksum, ...data });
  }

  const treeForModel = pruneTree(frame.tree);

  const system = `You generate focus order annotations for ${platform}.
Rules:
- Scope strictly to the provided frame tree; do not invent nodes.
- Return only focusable elements with roles.
- Order: landmarks/navigation → content controls → primary CTAs.
- If none: say "No focusable elements in this selection."
Return JSON only:
{ "frameName": "...", "items": [ { "label": "...", "role": "...", "path": "Ancestor > Child" } ] }`;

  const user = `Frame: ${frame.name}
Tree (name,type,visible,role,focusable,children):
${JSON.stringify(treeForModel, null, 2)}`;

  // Replace with your LLM call of choice
  const completion = await fetch(process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.1
    })
  }).then(r => r.json());

  const content = completion?.choices?.[0]?.message?.content || '{}';
  let data: any;
  try { data = JSON.parse(content.match(/\{[\s\S]*\}$/)?.[0] || content); }
  catch { data = { frameName: frame.name, items: [] }; }

  cache.set(cacheKey, data);
  const ms = Date.now() - t0;
  console.log(JSON.stringify({ event: 'annotate', frame: frame.name, nodeCount: 'n/a', focusables, checksum, ms }));

  res.json({ ok: true, checksum, ...data });
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`Listening on :${process.env.PORT || 10000}`);
});
