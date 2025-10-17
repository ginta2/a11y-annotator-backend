// code.js
// Safe network helper for Figma plugin runtime
// Only uses allowed fetch init keys: method, headers, body

const API = 'https://a11y-annotator-backend.onrender.com';

/**
 * Safe POST request using only Figma-allowed fetch init keys
 * @param {string} url - Target URL
 * @param {Object} data - JSON data to send
 * @returns {Promise<Object>} Response JSON or text
 */
async function safePostJSON(url, data) {
  // Ensure payload is JSON-serializable and light (no nodes attached)
  if (!data || typeof data !== 'object') {
    throw new Error('Payload must be a valid object');
  }
  
  // Guard against accidentally sending Figma nodes (they're not JSON-serializable)
  try {
    JSON.stringify(data);
  } catch (e) {
    throw new Error('Payload contains non-serializable data (e.g., Figma nodes)');
  }
  
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // IMPORTANT: Figma runtime allows ONLY method/headers/body
    body: JSON.stringify(data),
  };

  // Debug: log exactly what we send (no illegal keys)
  console.log('[net] POST', url, 'initKeys=', Object.keys(init));

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  
  // Attempt json, fallback to text
  try {
    return await res.json();
  } catch (e) {
    return await res.text();
  }
}

/**
 * Warm up the server to avoid cold-start timeouts
 */
async function warmUp() {
  try { 
    await fetch(`${API}/health`, { method: 'GET' }); 
  } catch (_) {
    // Ignore errors, this is just a warm-up call
  }
}

/**
 * Convenience wrapper for annotate endpoint
 * @param {Object} payload - Annotation payload
 * @returns {Promise<Object>} API response
 */
async function annotate(payload) {
  return safePostJSON(`${API}/annotate`, payload);
}

figma.showUI(__html__, { width: 420, height: 520 });
console.log('[A11y] plugin booted');

// Call warm-up on plugin start
warmUp();

function isExportable(node) {
  if (!node) return false;
  // Many nodes can export; guard typical non-exportables
  var non = ['PAGE', 'DOCUMENT', 'SLICE']; // others usually fine
  for (var i = 0; i < non.length; i++) if (node.type === non[i]) return false;
  return typeof node.exportAsync === 'function';
}

function nearestExportable(node) {
  var cur = node;
  while (cur && !isExportable(cur)) cur = cur.parent;
  return cur || null;
}

// Focus order detection and serialization functions
function readingOrder(a, b) {
  // Top-to-bottom, then left-to-right with small tolerance
  const ay = ('y' in a) ? a.y : 0;
  const by = ('y' in b) ? b.y : 0;
  if (Math.abs(ay - by) > 6) return ay - by;
  const ax = ('x' in a) ? a.x : 0;
  const bx = ('x' in b) ? b.x : 0;
  return ax - bx;
}

function guessRoleFromName(name) {
  const n = (name || '').toLowerCase();
  if (/\b(link|back|learn more|details)\b/.test(n)) return 'link';
  if (/\b(button|cta|start|submit|swap|save|next|continue)\b/.test(n)) return 'button';
  if (/\b(input|field|email|password|search|textbox)\b/.test(n)) return 'textbox';
  if (/\b(tab|pill|segment)\b/.test(n)) return 'tab';
  if (/\b(menu|nav|navigation)\b/.test(n)) return 'navigation';
  if (/\b(header|hero|app bar|top nav)\b/.test(n)) return 'landmark';
  return undefined;
}

function isFocusableHeuristic(node, platform) {
  const nameRole = guessRoleFromName(node.name || '');
  let focusable = Boolean(nameRole);
  
  // Respect plugin metadata tags if present
  const getPD = (n, k) => ('getPluginData' in n ? n.getPluginData(k) : '');
  try {
    const tagged = getPD(node, 'a11y-focusable');
    const forcedRole = getPD(node, 'a11y-role');
    if (tagged === 'true') {
      focusable = true;
      return { focusable, role: forcedRole || nameRole || (platform === 'web' ? 'button' : 'button') };
    }
  } catch (e) { /* no-op */ }

  return { focusable, role: nameRole };
}

function toDTO(n, platform) {
  const { focusable, role } = isFocusableHeuristic(n, platform);
  const rect = ('absoluteTransform' in n && 'width' in n && 'height' in n)
    ? { x: (n.x !== null && n.x !== undefined ? n.x : 0), y: (n.y !== null && n.y !== undefined ? n.y : 0), w: (n.width !== null && n.width !== undefined ? n.width : 0), h: (n.height !== null && n.height !== undefined ? n.height : 0) }
    : undefined;

  const kids = ('children' in n) ? n.children
    .filter(c => c.visible !== false)
    .sort(readingOrder)
    .map(c => toDTO(c, platform)) : [];

  return Object.assign({}, {
    name: n.name,
    type: n.type,
    visible: n.visible !== false,
    role,
    focusable
  }, rect || {}, kids.length ? { children: kids } : {});
}

function toDTO_shallow(n, platform) {
  const children = ('children' in n)
    ? n.children.filter(c => c.visible !== false).sort(readingOrder).map(c => {
        const { focusable, role } = isFocusableHeuristic(c, platform);
        const rect = ('absoluteTransform' in c && 'width' in c && 'height' in c)
          ? { x: (c.x !== null && c.x !== undefined ? c.x : 0), y: (c.y !== null && c.y !== undefined ? c.y : 0), w: (c.width !== null && c.width !== undefined ? c.width : 0), h: (c.height !== null && c.height !== undefined ? c.height : 0) }
          : undefined;
        return Object.assign({}, {
          name: c.name,
          type: c.type,
          visible: c.visible !== false,
          role,
          focusable
        }, rect || {});
      })
    : [];

  const rect = ('absoluteTransform' in n && 'width' in n && 'height' in n)
    ? { x: (n.x !== null && n.x !== undefined ? n.x : 0), y: (n.y !== null && n.y !== undefined ? n.y : 0), w: (n.width !== null && n.width !== undefined ? n.width : 0), h: (n.height !== null && n.height !== undefined ? n.height : 0) }
    : undefined;

  return Object.assign({}, {
    name: n.name,
    type: n.type,
    visible: n.visible !== false
  }, rect || {}, { children });
}

// Visual annotation rendering
var NOTE_TAG = 'a11y-note';
var NOTE_TAG_VALUE = 'focus-order';

function removeOldNotes(frame) {
  if (!frame || !('children' in frame)) return;
  // remove any child we previously tagged
  var kids = frame.children.slice(); // copy, we'll mutate
  for (var i = 0; i < kids.length; i++) {
    var k = kids[i];
    try {
      if ('getPluginData' in k && k.getPluginData(NOTE_TAG) === NOTE_TAG_VALUE) {
        k.remove();
      }
    } catch (e) { /* ignore */ }
  }
}

// Safely load a font for text nodes. If it fails, we still create text.
async function ensureFont(family, style) {
  try {
    await figma.loadFontAsync({ family: family, style: style });
  } catch (e) {
    // ignore – Figma will fall back
  }
}

// Create a little yellow "Focus Order" note inside the frame
async function renderFocusOrderNote(frame, annotation) {
  if (!frame || !annotation || !annotation.order || !annotation.order.length) return;

  // Build body lines: 1. label, 2. label, ...
  var lines = [];
  for (var i = 0; i < annotation.order.length; i++) {
    var it = annotation.order[i];
    var label = (it && it.label) ? String(it.label) : ('Item ' + (i + 1));
    lines.push((i + 1) + '. ' + label);
  }
  var body = lines.join('\n');

  // Create a container frame for the note
  var note = figma.createFrame();
  note.name = 'A11y – Focus Order';
  note.fills = [{ type: 'SOLID', color: { r: 1, g: 0.97, b: 0.85 } }]; // soft yellow
  note.strokes = [{ type: 'SOLID', color: { r: 0.86, g: 0.78, b: 0.56 } }];
  note.strokeWeight = 1;
  note.cornerRadius = 8;
  note.layoutMode = 'VERTICAL';
  note.paddingLeft = 12;
  note.paddingRight = 12;
  note.paddingTop = 10;
  note.paddingBottom = 10;
  note.itemSpacing = 6;
  note.resizeWithoutConstraints(150, 60);

  // Tag so we can remove later
  try { note.setPluginData(NOTE_TAG, NOTE_TAG_VALUE); } catch (e) {}

  // Header text
  await ensureFont('Inter', 'Regular');
  var h = figma.createText();
  h.characters = 'Focus Order';
  h.fontSize = 12;
  h.fills = [{ type: 'SOLID', color: { r: 0.23, g: 0.23, b: 0.23 } }];
  note.appendChild(h);

  // Body text
  var t = figma.createText();
  t.characters = body;
  t.fontSize = 11;
  t.lineHeight = { value: 14, unit: 'PIXELS' };
  t.fills = [{ type: 'SOLID', color: { r: 0.23, g: 0.23, b: 0.23 } }];
  note.appendChild(t);

  // Size to content (autoLayout)
  try { note.layoutAlign = 'INHERIT'; } catch (e) {}

  // Position: top-right inside the frame with 12px inset
  var inset = 12;
  var nx = Math.max(0, frame.width - note.width - inset);
  var ny = inset;
  note.x = frame.x + nx;
  note.y = frame.y + ny;

  // Make the note a child of the same parent as the frame (overlay look),
  // so it isn't clipped by frame's clipContent.
  if (frame.parent) {
    frame.parent.appendChild(note);
    // keep above the frame in z-order
    try { note.relativeTransform = frame.relativeTransform; } catch (e) {}
    note.x = frame.x + nx;
    note.y = frame.y + ny;
  } else {
    frame.appendChild(note);
    note.x = nx;
    note.y = ny;
  }
}

// Track last checksum for UX feedback
let lastChecksum = null;

function computeChecksum(annos) {
  if (!annos || !annos.length) return null;
  const annotation = annos[0];
  if (!annotation || !annotation.order) return null;
  return JSON.stringify(annotation.order.map(item => ({ id: item.id, label: item.label })));
}

async function applyAnnotations(annos) {
  var selection = figma.currentPage.selection[0];
  if (!selection || selection.type !== 'FRAME') return;

  // no annotations? clear old note
  if (!annos || !annos.length || !annos[0] || !annos[0].order) {
    removeOldNotes(selection);
    lastChecksum = null;
    figma.notify('A11y: No focusable items found.');
    return;
  }

  var newChecksum = computeChecksum(annos);
  if (newChecksum && newChecksum === lastChecksum) {
    // nothing changed – avoid flicker
    figma.notify('Focus order already up to date');
    return;
  }

  // redraw the note
  removeOldNotes(selection);
  await renderFocusOrderNote(selection, annos[0]);

  lastChecksum = newChecksum;
  figma.notify('A11y: Annotation received and rendered.');
}

figma.ui.onmessage = async (msgRaw) => {
  // Accept raw or wrapped (pluginMessage) payloads
  const msg = (msgRaw && (msgRaw.type || msgRaw.platform || msgRaw.frames))
    ? msgRaw
    : (msgRaw && msgRaw.pluginMessage)
      ? msgRaw.pluginMessage
      : null;

  console.log('[A11y] ui message ->', msg);

  if (!msg || !msg.type) {
    console.warn('[A11y] missing or malformed message', msgRaw);
    figma.notify('A11y: Bad message from UI');
    return;
  }

  const t = msg.type;
  const isPropose =
    t === 'runPropose' ||
    t === 'PROPOSE' ||
    t === 'PROPOSE_FOCUS_ORDER';

  if (!isPropose) {
    console.warn('[A11y] unknown message type', t);
    return;
  }

  // Hand off
  await runPropose({
    frames: msg.frames,
    platform: msg.platform,
    prompt: msg.prompt || '',
  });
};

async function runPropose({ frames, platform, prompt }) {
  const selection = figma.currentPage.selection[0];

  if (!selection || selection.type !== 'FRAME') {
    figma.notify('Select a frame to annotate.');
    console.warn('[A11y] no FRAME selected');
    return;
  }

  // Warmup is cheap; do it here too in case plugin just woke up
  try { await fetch(`${API}/health`, { method: 'GET' }); } catch (e) { /* no-op */ }

  // Compute serialization mode (small widget vs larger section)
  const isSmall =
    (selection.width * selection.height) < 120000 ||
    (('children' in selection) && selection.children.filter(c => c.visible !== false).length <= 5);

  console.log('[A11y] selection', {
    id: selection.id,
    name: selection.name,
    w: selection.width,
    h: selection.height,
    isSmall,
    platform
  });

  // Serialize
  const dto = isSmall
    ? toDTO_shallow(selection, platform) // direct children only
    : toDTO(selection, platform);        // recursive

  const payload = {
    platform,
    frames: [{
      id: selection.id,
      name: selection.name,
      box: { x: selection.x, y: selection.y, w: selection.width, h: selection.height },
      // For server simplicity, pass children only (server knows it's a frame)
      children: dto.children || []
    }]
  };

  console.log('[NET] POST /annotate payload', payload);

  let res;
  try {
    res = await safePostJSON(`${API}/annotate`, payload);
  } catch (e) {
    console.error('[NET] annotate failed', e);
    figma.notify('Network error. See console.');
    return;
  }

  console.log('[NET] /annotate response', res);

  if (!res || !res.ok) {
    figma.notify('Focus order service unavailable.');
    console.warn('[NET] bad response', res);
    return;
  }

  await applyAnnotations(res.annotations);

  const annotation = res.annotations && res.annotations[0] ? res.annotations[0] : null;
  selection.setPluginData('a11y-focus-order', JSON.stringify({
    platform,
    frameId: selection.id,
    frameName: selection.name,
    checksum: res.checksum,
    items: annotation ? annotation.order : [],
    at: new Date().toISOString()
  }));

  figma.ui.postMessage({ type: 'ANNOTATION_APPLIED', data: res });
  figma.notify('A11y: Annotation received and rendered.');
}