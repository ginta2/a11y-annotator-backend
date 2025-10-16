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

figma.ui.onmessage = (msg) => {
  console.log('[A11y] ui message ->', msg);
  if (msg && msg.type === 'runPropose') {
    runPropose({
      frames: msg.frames,
      platform: msg.platform,
      prompt: msg.prompt || '',
    });
  } else {
    console.warn('[A11y] unknown ui message type', msg && msg.type);
  }
};

async function runPropose({ frames, platform, prompt }) {
  const payload = { frames, platform, prompt };
  console.log('[A11y] payload ->', payload);

  let data;
  try {
    // Use the Figma-safe helper
    data = await annotate(payload);
    // internally calls safePostJSON(`${API}/annotate`, payload)
  } catch (e) {
    console.error('[A11y] network error:', e);
    figma.notify(`Network error: ${e.message}`);
    return;
  }

  console.log('[A11y] /annotate JSON:', data);

  if (!data || data.ok === false) {
    console.error('[A11y] server reported failure:', data);
    figma.notify('Server error (see console).');
    return;
  }

  // At this point data.annotations should be an array:
  if (!Array.isArray(data.annotations)) {
    console.error('[A11y] Unexpected payload shape:', data);
    figma.notify('Unexpected server payload. See console.');
    return;
  }

  // …apply annotations…
  console.log('[A11y] applying annotations:', data.annotations);
  // (your existing layer drawing/selection code here)
  
  figma.ui.postMessage({ type: 'RESULT', payload: data });
}