// src/lib/serialize.js
// JavaScript version of the serialize functionality for the main plugin code

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
  } catch {}

  return { focusable, role: nameRole };
}

function toDTO(n, platform) {
  const { focusable, role } = isFocusableHeuristic(n, platform);
  const rect = ('absoluteTransform' in n && 'width' in n && 'height' in n)
    ? { x: n.x ?? 0, y: n.y ?? 0, w: n.width ?? 0, h: n.height ?? 0 }
    : undefined;

  const kids = ('children' in n) ? n.children
    .filter(c => c.visible !== false)
    .sort(readingOrder)
    .map(c => toDTO(c, platform)) : [];

  return {
    name: n.name,
    type: n.type,
    visible: n.visible !== false,
    role,
    focusable,
    ...(rect || {}),
    ...(kids.length ? { children: kids } : {})
  };
}

// Export for use in main plugin code
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { toDTO };
}
