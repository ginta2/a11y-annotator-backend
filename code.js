figma.showUI(__html__, { width: 420, height: 480 });
console.log('[A11y Annotator] boot');

const API = 'https://a11y-annotator-backend.onrender.com/annotate';

function assertCurrentPageOnly() {
  const suspicious = ['root.findAll', 'root.children', 'getNodeById(', 'pages[', 'findAll('];
  // NOT executed; just a hint for grep if we regress.
  return suspicious;
}

async function callAnnotateAPI(body) {
  console.log('[A11y Annotator] POST', API, { bodyType: Object.keys(body) });

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${text || '(no body)'}`);
  }

  const data = await res.json().catch(() => ({}));
  console.log('[A11y Annotator] API ok', data);
  figma.ui.postMessage({ type: 'RESULT', payload: data });
}

async function handlePropose(platform, textPrompt = "") {
  // Validate selection
  const sel = figma.currentPage.selection;
  const node = sel?.[0];
  if (!node || node.type !== 'FRAME') {
    figma.notify('Select exactly one Frame before running the plugin.');
    figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, reason: 'no-frame' } });
    return;
  }

  console.log('[A11y Annotator] frame selected:', node.name);

  if (platform === 'web') {
    // Simple text call – no scanning or image exporting
    await callAnnotateAPI({ platform: 'web', text: textPrompt || '' });
    return;
  }

  // platform === 'rn' -> export ONLY the selected frame
  const bytes = await node.exportAsync({ format: 'PNG' });
  const imageBase64 = figma.base64Encode(bytes);
  await callAnnotateAPI({ platform: 'rn', imageBase64 });
}

figma.ui.onmessage = async (msg) => {
  if (msg?.type !== 'PROPOSE') return;

  try {
    // msg.platform is 'web' or 'rn'
    await handlePropose(msg.platform, msg.textPrompt ?? '');
  } catch (e) {
    console.error('[A11y Annotator] error:', e);
    figma.ui.postMessage({ type: 'RESULT', payload: { ok: false, error: String(e) } });
  }
};