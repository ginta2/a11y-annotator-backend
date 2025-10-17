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


figma.ui.onmessage = async (msg) => {
  // SAFELY read fields without optional chaining
  const hasMsg = msg && typeof msg === 'object';
  const type = hasMsg ? msg.type : undefined;

  if (type !== 'runPropose' && type !== 'PROPOSE') {
    console.warn('[A11y] unknown ui message type', type);
    return;
  }

  const platform = hasMsg && typeof msg.platform === 'string' ? msg.platform : 'web';
  const prompt   = hasMsg && typeof msg.prompt   === 'string' ? msg.prompt   : '';

  // 1) Validate selection
  const sel = figma.currentPage.selection;
  if (!sel.length || sel[0].type !== 'FRAME') {
    figma.notify('Select a frame first');
    return;
  }
  const frame = sel[0];

  // 2) Export frame
  let bytes, width, height;
  try {
    bytes  = await frame.exportAsync({ format: 'PNG' });
    width  = frame.width;
    height = frame.height;
  } catch (e) {
    console.error('[A11y] exportAsync failed', e);
    figma.notify('Export failed. See console.');
    return;
  }

  // 3) Build payload and POST
  const payload = {
    platform: platform,
    prompt: prompt,
    frames: [{
      bytes: Array.from(new Uint8Array(bytes)),
      width: width,
      height: height,
      id: frame.id,
      name: frame.name
    }]
  };

  try {
    console.log('[A11y] POST /annotate payload keys ->', Object.keys(payload));
    const res  = await fetch(`${API}/annotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = {};
    try { data = await res.json(); } catch (_e) {}

    if (!res.ok || (data && data.ok === false)) {
      console.error('[A11y] server reported failure:', res.status, data);
      figma.notify('Server error: ' + res.status);
      return;
    }

    console.log('[A11y] /annotate JSON:', data);
    figma.ui.postMessage({ type: 'RESULT', payload: data });
  } catch (e) {
    console.error('[A11y] fetch threw', e);
    figma.notify('Network error. See console.');
  }
};
