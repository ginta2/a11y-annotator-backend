// code.js
// Hosted API (note https, no trailing slash)
const API = 'https://a11y-annotator-backend.onrender.com/annotate';

figma.showUI(__html__, { width: 420, height: 520 });
console.log('[A11y] boot v2');

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

figma.ui.onmessage = function (msg) {
  if (!msg || msg.type !== 'PROPOSE') return;
  runPropose(msg);
};

async function runPropose(msg) {
  var platform = (msg.platform === 'rn') ? 'rn' : 'web';
  var textPrompt = (typeof msg.textPrompt === 'string' && msg.textPrompt) || '';

  try {
    var sel = figma.currentPage.selection || [];
    var original = sel[0] || null;

    if (!original) {
      var err1 = 'No selection. Select a Frame/Component/Instance.';
      console.warn('[A11y] ' + err1);
      figma.notify(err1);
      figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, reason: 'no-selection', message: err1 } });
      return;
    }

    var target = nearestExportable(original);
    if (!target) {
      var err2 = 'Selected node cannot be exported. Choose a Frame/Component/Instance.';
      console.warn('[A11y] ' + err2, { type: original.type });
      figma.notify(err2);
      figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, reason: 'not-exportable', message: err2, nodeType: original.type } });
      return;
    }

    console.log('[A11y] preparing request', { platform: platform, nodeType: target.type });

    if (platform === 'web') {
      await callAnnotate({ platform: 'web', text: textPrompt });
    } else {
      var exportOpts = { format: 'PNG', constraint: { type: 'SCALE', value: 1 } };
      var bytes = await target.exportAsync(exportOpts);
      // Safety: cap size to avoid absurd payloads (e.g., very large frames).
      if (bytes && bytes.length > 10 * 1024 * 1024) { // >10MB
        var err3 = 'Export is too large (>10MB). Scale the frame down or export a smaller area.';
        console.warn('[A11y] ' + err3, { bytes: bytes.length });
        figma.notify(err3);
        figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, reason: 'too-large', message: err3, bytes: bytes.length } });
        return;
      }
      var imageBase64 = figma.base64Encode(bytes);
      console.log('[A11y] export done', { bytes: bytes ? bytes.length : 0, b64Len: imageBase64 ? imageBase64.length : 0 });
      await callAnnotate({ platform: 'rn', imageBase64: imageBase64 });
    }
  } catch (e) {
    console.error('[A11y] runPropose error:', e);
    figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, error: String(e && e.message || e) } });
  }
}

async function callAnnotate(payload) {
  console.log('[A11y] POST', API, { bodyKeys: Object.keys(payload || {}) });
  
  const res = await fetch(API, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // Helpful debug
  // console.log('[annotate] status', res.status, 'ok?', res.ok);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`annotate failed: ${res.status} ${text}`);
  }
  
  const json = await res.json();
  console.log('[A11y] API ok', json);
  figma.ui.postMessage({ type: 'RESULT', payload: json || { ok: true } });
}