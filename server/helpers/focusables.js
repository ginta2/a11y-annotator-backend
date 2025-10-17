// helpers/focusables.js
function isLikelyButton(node) {
  const n = (node.name || '').toLowerCase();
  return n.includes('btn') || n.includes('button') || (node.cornerRadius > 0 && node.children && node.children.some && node.children.some(function(c) { return c.type === 'TEXT'; }));
}

function isLikelyHeading(node) {
  const n = (node.name || '').toLowerCase();
  return n.startsWith('h1') || n.startsWith('h2') || n.includes('title') || n.includes('header') || (node.fontSize >= 20 && node.fontWeight >= 600);
}

function visibleText(node) {
  if (node.type === 'TEXT' && typeof node.characters === 'string') return node.characters.trim().slice(0, 80);
  const t = node.children && node.children.find && node.children.find(function(c) { return c.type === 'TEXT' && c.characters; });
  return ((t && t.characters) || node.name || '').toString().trim().slice(0, 80);
}

function labelFor(node) {
  const t = visibleText(node);
  if (isLikelyButton(node)) return 'Button: ' + (t || node.name || 'Unnamed');
  if (isLikelyHeading(node)) return 'Heading: ' + (t || node.name || 'Untitled');
  return t ? t : (node.name || 'Item');
}

function bbox(n) { 
  return { 
    x: n.x | 0, 
    y: n.y | 0, 
    w: n.w | 0, 
    h: n.h | 0 
  }; 
}

// Input: root node JSON (already pruned to selection), return focusables with order
function extractAndOrder(root, cap) {
  if (cap === undefined) cap = 25;
  
  // DFS collect candidates: text layers, buttons, instances/components with text, and named interactive layers
  const out = [];
  (function walk(n) {
    if (!n) return;
    const name = (n.name || '').toLowerCase();
    const candidate =
      n.type === 'TEXT' ||
      isLikelyButton(n) ||
      name.includes('link') || name.includes('cta') || name.includes('nav') ||
      n.role === 'button' || n.role === 'link';
    if (candidate) out.push({ 
      id: n.id, 
      label: labelFor(n), 
      x: (n.absoluteX !== null && n.absoluteX !== undefined ? n.absoluteX : n.x) || 0, 
      y: (n.absoluteY !== null && n.absoluteY !== undefined ? n.absoluteY : n.y) || 0 
    });
    if (Array.isArray(n.children)) n.children.forEach(walk);
  })(root);

  out.sort(function(a, b) { return (a.y - b.y) || (a.x - b.x); });
  if (out.length > cap) out.length = cap;
  return out;
}

export { extractAndOrder };
