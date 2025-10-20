// code.js
// Safe network helper for Figma plugin runtime
// Only uses allowed fetch init keys: method, headers, body

const API = 'https://a11y-annotator-backend.onrender.com';

// Tiny helpers
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForHealthy({ timeoutMs = 45000, pollMs = 800 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API}/health`, { method: 'GET' });
      if (res.ok) return true;
    } catch (_) { /* ignore until healthy */ }
    await sleep(pollMs);
  }
  return false;
}

async function withRetry(fn, { retries = 5, baseDelay = 500 } = {}) {
  let attempt = 0, delay = baseDelay;
  for (;;) {
    try { return await fn(); }
    catch (e) {
      attempt++;
      // Only retry on transient server/network errors
      const msg = String(e && e.message || e);
      const transient = /(\^HTTP (429|500|502|503|504)|network|fetch|timeout)/i.test(msg);
      if (!transient || attempt > retries) throw e;
      await sleep(delay);  // backoff
      delay = Math.min(delay * 1.8, 5000);
    }
  }
}

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

// Helper: Infer component type from structure (for generic names like "Frame 24")
function inferComponentType(node, platform) {
  if (!node.children || node.children.length === 0) return null;
  
  var hasTextChild = false;
  var textContent = '';
  
  // Extract text content from children
  for (var i = 0; i < node.children.length; i++) {
    var child = node.children[i];
    if (child.type === 'TEXT' && child.characters) {
      hasTextChild = true;
      textContent = textContent + (textContent ? ' ' : '') + child.characters;
    }
  }
  
  if (!hasTextChild) return null;
  
  // Heuristics based on dimensions and aspect ratio
  var bounds = node.absoluteBoundingBox;
  if (!bounds) return null;
  
  var aspectRatio = bounds.width / bounds.height;
  
  // Input field: wide aspect ratio, moderate height
  if (aspectRatio > 2.5 && bounds.height > 20 && bounds.height < 80) {
    return {
      rnRole: platform === 'rn' ? 'textfield' : 'textbox',
      hint: 'probable input',
      text: textContent.substring(0, 50) // Limit text length
    };
  }
  
  // Button: roughly compact, has text
  if (aspectRatio < 4 && bounds.height > 30 && bounds.height < 80) {
    return {
      rnRole: 'button',
      hint: 'probable button',
      text: textContent.substring(0, 50)
    };
  }
  
  return null;
}

function toDTO(n, platform, depth, counters, parent) {
  // Defaults for top-level call
  depth = (depth !== null && depth !== undefined) ? depth : 0;
  counters = counters || { total: 0 };
  parent = parent || null;

  // Safety limits to keep payload bounded
  if (depth > 10) return null; // stop after 10 levels
  if (depth > 0 && counters.total >= 500) return null; // cap to ~500 nodes

  counters.total++;

  function num(v, d) { return (v !== null && v !== undefined) ? v : d; }

  var fr = isFocusableHeuristic(n, platform);
  var role = fr.role;
  var focusable = fr.focusable;

  var rect = ('absoluteTransform' in n && 'width' in n && 'height' in n)
    ? { x: num(n.x, 0), y: num(n.y, 0), w: num(n.width, 0), h: num(n.height, 0) }
    : undefined;

  // Semantic boundary detection: Stop at leaf components (components with only static children)
  // This is screen-agnostic - works for any component structure
  function hasOnlyStaticChildren(node) {
    if (!node.children || node.children.length === 0) return true;
    
    // Static types: text, shapes, etc. (non-interactive elements)
    var STATIC_TYPES = ['TEXT', 'RECTANGLE', 'ELLIPSE', 'POLYGON', 'STAR', 'VECTOR', 'LINE', 'GROUP'];
    
    for (var i = 0; i < node.children.length; i++) {
      var child = node.children[i];
      if (child.visible === false) continue; // Skip hidden children
      
      var childType = child.type;
      if (STATIC_TYPES.indexOf(childType) === -1) {
        // Found a non-static child (FRAME, INSTANCE, COMPONENT, etc.)
        return false;
      }
    }
    return true; // All visible children are static (text, shapes)
  }

  // Check if this is a component instance (INSTANCE or COMPONENT type)
  var isComponentInstance = n.type === 'INSTANCE' || n.type === 'COMPONENT';
  
  // Only stop traversal if it's a component with only static children
  // This allows "Button Group" to traverse (has INSTANCE children)
  // But stops "Button Primary" (only has TEXT children)
  var shouldStopTraversal = isComponentInstance && hasOnlyStaticChildren(n);

  // Infer component type for generic names (helps AI match poorly-named components)
  var inference = null;
  var nameLower = n.name.toLowerCase();
  var isGenericName = nameLower.indexOf('frame') !== -1 || nameLower === 'div' || nameLower.indexOf('group') !== -1;
  
  if (isComponentInstance && isGenericName && shouldStopTraversal) {
    inference = inferComponentType(n, platform);
    if (inference) {
      console.log('[A11y] Inferred type for', n.name + ':', inference.hint, '(text:', inference.text + ')');
    }
  }

  var kids = [];
  if (shouldStopTraversal) {
    console.log('[A11y] Semantic boundary:', n.name, '(type:', n.type + ') - stopping traversal');
    // Don't include children in serialization
    kids = [];
  } else if ('children' in n) {
    // Normal traversal for containers
    var raw = n.children
      .filter(function(c) { return c.visible !== false; })
      .sort(readingOrder);
    for (var i = 0; i < raw.length; i++) {
      var childDto = toDTO(raw[i], platform, depth + 1, counters, n); // Pass parent
      if (childDto) kids.push(childDto);
      if (counters.total >= 500) break; // hard stop
    }
  }

  // Build base object
  var base = {
    id: n.id,
    name: n.name,
    type: n.type,
    visible: n.visible !== false,
    role: role,
    focusable: focusable
  };
  
  // Add parent context (helps disambiguate duplicates)
  if (parent && parent.name) {
    base.parentName = parent.name;
  }
  
  // Add inference if available
  if (inference) {
    base.inference = inference;
  }
  
  return Object.assign({}, base, rect || {}, kids.length ? { children: kids } : {});
}

// (Removed toDTO_shallow) – we always use deep traversal with limits

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
  if (!frame || !annotation || !annotation.order || !annotation.order.length) {
    return;
  }

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

  // Position: to the right of the frame (outside, not covering content)
  var spacing = 20;
  note.x = frame.x + frame.width + spacing;
  note.y = frame.y;

  // Make the note a child of the same parent as the frame
  if (frame.parent) {
    frame.parent.appendChild(note);
  } else {
    // Fallback: attach to frame itself
    frame.appendChild(note);
    note.x = frame.width + spacing;
    note.y = 0;
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

// Draw numbered chips at element positions
async function drawFocusChips(frame, annotation) {
  if (!frame || !annotation || !annotation.order || !annotation.order.length) {
    return false;
  }
  
  var order = annotation.order;
  
  // Load fonts upfront
  try {
    await ensureFont('Inter', 'Regular');
    await ensureFont('Inter', 'Bold');
  } catch (e) {
    console.error('[A11y] Font loading failed:', e && e.message || e);
  }
  
  var chipGroup = figma.createFrame();
  chipGroup.name = 'A11y Focus Chips';
  chipGroup.resize(frame.width, frame.height);
  chipGroup.x = frame.x;
  chipGroup.y = frame.y;
  chipGroup.fills = [];
  chipGroup.clipsContent = false;
  chipGroup.locked = false;  // Allow selection and repositioning
  
  // Tag for cleanup
  try { chipGroup.setPluginData(NOTE_TAG, NOTE_TAG_VALUE); } catch (e) {}
  
  var chipsDrawn = 0;
  var itemsWithoutPosition = 0;
  
  for (var i = 0; i < order.length; i++) {
    var item = order[i];
    var num = i + 1;
    var chipSize = 28;  // Smaller chips for less visual clutter
    
    // Hybrid approach: Use Figma node coordinates for accuracy
    var node = figma.getNodeById(item.id);
    var chipX;
    var chipY;
    var coordSource = 'unknown';
    
    if (node && 'absoluteBoundingBox' in node) {
      // Use Figma's actual coordinates - pixel perfect!
      var bounds = node.absoluteBoundingBox;
      if (bounds) {
        chipX = bounds.x + (bounds.width / 2);   // Center of element
        chipY = bounds.y + (bounds.height / 2);
        coordSource = 'figma';
      }
    }
    
    // If no Figma coordinates available, skip this item
    if (coordSource === 'unknown') {
      console.warn('[A11y] No coordinates for item', num, '(' + item.label + ') - node not found or no bounds');
      itemsWithoutPosition++;
      continue;
    }
    
    // Convert absolute coordinates to frame-relative
    var relativeX = chipX - frame.x - (chipSize / 2);  // Center the chip on the element
    var relativeY = chipY - frame.y - (chipSize / 2);
    
    console.log('[A11y] Chip', num, 'at frame-relative', Math.round(relativeX), Math.round(relativeY), '(from ' + coordSource + '):', item.label);
    
    // Red circle
    var chip = figma.createEllipse();
    chip.resize(chipSize, chipSize);
    chip.fills = [{ type: 'SOLID', color: { r: 0.91, g: 0.28, b: 0.15 } }]; // #E84827
    chip.x = relativeX;
    chip.y = relativeY;
    chip.name = 'Chip ' + num;
    
    // White number text
    var text = figma.createText();
    
    // Load and set font BEFORE setting characters
    try {
      await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
      text.fontName = { family: 'Inter', style: 'Bold' };
    } catch (e) {
      console.warn('[A11y] Font load failed:', e && e.message || e);
      // Will use default font
    }
    
    text.characters = String(num);
    text.fontSize = 14;  // Smaller font to match smaller chip size
    text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    text.textAlignHorizontal = 'CENTER';
    text.textAlignVertical = 'CENTER';
    text.resize(chipSize, chipSize);
    text.x = relativeX;  // Same position as chip (text will auto-center due to alignment)
    text.y = relativeY;
    text.name = 'Number ' + num;
    
    chipGroup.appendChild(chip);
    chipGroup.appendChild(text);
    chipsDrawn++;
  }
  
  // Summary log
  if (itemsWithoutPosition > 0) {
    console.warn('[A11y] Skipped', itemsWithoutPosition, 'items without position data');
  }
  console.log('[A11y] Chips drawn:', chipsDrawn, 'of', order.length);
  
  if (chipsDrawn > 0 && frame.parent) {
    frame.parent.appendChild(chipGroup);
    return true;
  }
  
  console.warn('[A11y] No chips were drawn');
  return false;
}

async function applyAnnotations(annos) {
  var selection = figma.currentPage.selection[0];
  if (!selection || selection.type !== 'FRAME') return;

  // no annotations? clear old note
  if (!annos || !annos.length || !annos[0] || !annos[0].order) {
    console.warn('[A11y] No valid annotations received');
    removeOldNotes(selection);
    lastChecksum = null;
    figma.notify('A11y: No focusable items found.');
    return;
  }

  var newChecksum = computeChecksum(annos);
  if (newChecksum && newChecksum === lastChecksum) {
    figma.notify('Focus order already up to date');
    return;
  }

  // Remove old annotations
  removeOldNotes(selection);
  
  // Always try to draw chips using Figma node coordinates (hybrid approach)
  var chipsDrawn = await drawFocusChips(selection, annos[0]);
  
  // Also render yellow note for reference
  await renderFocusOrderNote(selection, annos[0]);
  
  if (!chipsDrawn) {
    console.warn('[A11y] No chips were drawn, but note is available');
  }

  lastChecksum = newChecksum;
  
  // Check for generic component names and warn user
  var genericNames = [];
  for (var i = 0; i < annos[0].order.length; i++) {
    var item = annos[0].order[i];
    var labelLower = item.label.toLowerCase();
    if (labelLower.indexOf('frame') !== -1 || labelLower === 'div' || labelLower.indexOf('group') !== -1) {
      genericNames.push(item.label);
    }
  }
  
  if (genericNames.length > 3) {
    figma.notify('⚠️ ' + genericNames.length + ' components have generic names. Rename for better accessibility documentation.', { timeout: 5000 });
  } else {
    figma.notify('A11y: Annotated ' + annos[0].order.length + ' items');
  }
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

  // Ensure server is up before we POST (free Render can be cold)
  figma.notify('Starting A11y service…', { timeout: 2000 });
  const healthy = await waitForHealthy();
  if (!healthy) {
    figma.notify('A11y service is still waking up. Retrying…', { timeout: 3000 });
  }

  // Selection info
  console.log('[A11y] selection', {
    id: selection.id,
    name: selection.name,
    w: selection.width,
    h: selection.height,
    platform
  });

  // Export PNG screenshot for vision analysis
  figma.notify('Capturing screenshot…', { timeout: 1500 });
  var pngBytes = null;
  var imageData = null;
  
  try {
    pngBytes = await selection.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 }  // @2x for better quality
    });
    
    if (pngBytes && pngBytes.length > 0) {
      imageData = 'data:image/png;base64,' + figma.base64Encode(pngBytes);
      var sizeKB = (pngBytes.length / 1024).toFixed(1);
      console.log('[A11y] PNG exported:', sizeKB, 'KB');
    }
  } catch (e) {
    console.warn('[A11y] PNG export failed:', e && e.message || e);
    figma.notify('Screenshot failed, using text-only analysis', { timeout: 2000 });
    imageData = null;
  }

  // Serialize (always deep with safety limits)
  const dto = toDTO(selection, platform);

  // Debug stats for what we are sending
  function countNodes(node) {
    if (!node) return 0;
    var cnt = 1;
    var cs = node.children || [];
    for (var i = 0; i < cs.length; i++) cnt += countNodes(cs[i]);
    return cnt;
  }
  function maxDepth(node) {
    if (!node) return 0;
    var cs = node.children || [];
    var d = 0;
    for (var i = 0; i < cs.length; i++) d = Math.max(d, maxDepth(cs[i]));
    return d + (cs.length ? 1 : 0);
  }
  var _sample = (dto && dto.children) ? dto.children.slice(0, 3).map(function (c) { return c.name; }) : [];
  console.log('[A11y] Serialized tree', { nodeCount: countNodes(dto), maxDepth: maxDepth(dto), sampleNodes: _sample });

  const payload = {
    platform,
    image: imageData,  // base64-encoded PNG or null
    frames: [{
      id: selection.id,
      name: selection.name,
      box: { x: selection.x, y: selection.y, w: selection.width, h: selection.height },
      // For server simplicity, pass children only (server knows it's a frame)
      children: dto.children || []
    }]
  };

  console.log('[NET] POST /annotate', { 
    platform: payload.platform, 
    hasImage: (imageData !== null && imageData !== undefined) ? true : false,
    frameCount: payload.frames.length 
  });

  // Show analyzing status
  figma.notify('Analyzing frame with AI...', { timeout: 3000 });

  let res;
  try {
    res = await withRetry(() => safePostJSON(`${API}/annotate`, payload));
  } catch (e) {
    console.error('[NET] annotate failed', e);
    figma.notify('A11y: service unavailable (cold start or network). Try again.');
    return;
  }

  console.log('[NET] /annotate response', res);

  if (!res || !res.ok) {
    figma.notify('Focus order service unavailable.');
    console.warn('[NET] bad response', res);
    return;
  }

  // Validate response
  if (!res.annotations || res.annotations.length === 0) {
    console.warn('[A11y] No annotations in response');
  }

  // Show rendering status
  figma.notify('Rendering annotations...', { timeout: 1500 });

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