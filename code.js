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
console.log('[A11y] boot v2');

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

function collectSelectionFrames() {
  const sel = figma.currentPage.selection || [];
  const frames = [];
  for (const n of sel) {
    // Walk up to nearest exportable container (keeps behaviour predictable)
    let cur = n;
    while (cur && typeof cur.exportAsync !== 'function') {
      cur = cur.parent;
    }
    const pick = cur || n;
    frames.push({
      id: pick.id,
      name: pick.name,
      type: pick.type,
      width: Math.round(pick.width || 0),
      height: Math.round(pick.height || 0),
      x: Math.round(pick.absoluteTransform?.[0]?.[2] || 0),
      y: Math.round(pick.absoluteTransform?.[1]?.[2] || 0),
    });
  }
  return frames;
}

function normalizeType(t) {
  return (t || '').toString().trim().toLowerCase();
}

figma.ui.onmessage = async (msg) => {
  console.log('[A11y] ui message ->', msg);
  const t = msg?.type;
  if (t === 'runPropose' || t === 'PROPOSE') {
    figma.notify('Sending to /annotate…');
    const prompt = (msg?.prompt ?? msg?.textPrompt ?? '').toString();
    let frames = Array.isArray(msg?.frames) ? msg.frames : null;
    if (!frames || frames.length === 0) {
      frames = collectSelectionFrames();
      if (frames.length === 0) {
        figma.notify('Select at least one frame/layer and try again.');
        return;
      }
    }
    await runPropose({
      frames,
      platform: msg?.platform || 'web',
      prompt,
    });
  } else {
    console.warn('[A11y] unknown ui message type', t);
  }
};

async function runPropose({ frames, platform, prompt }) {
  const payload = { frames, platform, prompt };
  console.log('[A11y] sending /annotate ->', payload);
  let data;
  try {
    data = await safePostJSON(`${API}/annotate`, payload);
    console.log('[A11y] /annotate response:', data);
  } catch (e) {
    console.error('[A11y] /annotate failed:', e);
    figma.notify(`Request failed: ${e?.message || e}`);
    return;
  }

  if (!data || data.ok === false) {
    figma.notify('Server reported failure. See console.');
    console.error('[A11y] server reported failure:', data);
    return;
  }
  if (!Array.isArray(data.annotations)) {
    figma.notify('Unexpected server payload. See console.');
    console.error('[A11y] Unexpected payload shape:', data);
    return;
  }

  // TODO: apply annotations to the canvas as needed
  console.log('[A11y] applying annotations:', data.annotations);
  figma.ui.postMessage({ type: 'RESULT', payload: data });
}