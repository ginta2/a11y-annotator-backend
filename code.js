// --- Safe ES5-compatible version ---
// Always show the UI first
figma.showUI(__html__, { width: 420, height: 480 });
console.log('[A11y Annotator] boot');

// Handle messages from the UI
figma.ui.onmessage = async function(msg) {
  if (!msg || msg.type !== 'PROPOSE') return;

  try {
    var platform = (msg.platform === 'rn') ? 'rn' : 'web';
    var textPrompt = (typeof msg.textPrompt === 'string' && msg.textPrompt) || '';

    var sel = figma.currentPage.selection || [];
    var node = (sel && sel[0]) || null;

    if (!node || node.type !== 'FRAME') {
      figma.notify('Select exactly one Frame before running the plugin.');
      figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, reason: 'no-frame' } });
      return;
    }

    var API = 'https://a11y-annotator-backend.onrender.com/annotate';

    if (platform === 'web') {
      await callAnnotate(API, { platform: 'web', text: textPrompt });
    } else {
      var bytes = await node.exportAsync({ format: 'PNG' });
      var imageBase64 = figma.base64Encode(bytes);
      await callAnnotate(API, { platform: 'rn', imageBase64: imageBase64 });
    }
  } catch (e) {
    console.error('[A11y Annotator] error:', e);
    figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, error: String(e) } });
  }
};

// --- API call helper ---
async function callAnnotate(API, body) {
  console.log('[A11y Annotator] POST', API, { bodyKeys: Object.keys(body || {}) });

  var res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });

  if (!res.ok) {
    var t = '';
    try { t = await res.text(); } catch (e) {}
    throw new Error('API ' + res.status + ' ' + res.statusText + ': ' + t);
  }

  var data = {};
  try { data = await res.json(); } catch (e) {}
  console.log('[A11y Annotator] API ok', data);
  figma.ui.postMessage({ type: 'RESULT', payload: data });
}