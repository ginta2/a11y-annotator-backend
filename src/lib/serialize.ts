// src/lib/serialize.ts

// Figma API types (simplified for plugin context)
declare global {
  interface SceneNode {
    name: string;
    type: string;
    visible: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: SceneNode[];
    getPluginData?: (key: string) => string;
    absoluteTransform?: any;
  }
}

export type NodeDTO = {
  name: string;
  type: string;
  visible: boolean;
  role?: string;
  focusable: boolean;
  x?: number; y?: number; w?: number; h?: number;
  children?: NodeDTO[];
};

function readingOrder(a: SceneNode, b: SceneNode): number {
  // Top-to-bottom, then left-to-right with small tolerance
  const ay = ('y' in a) ? (a as any).y : 0;
  const by = ('y' in b) ? (b as any).y : 0;
  if (Math.abs(ay - by) > 6) return ay - by;
  const ax = ('x' in a) ? (a as any).x : 0;
  const bx = ('x' in b) ? (b as any).x : 0;
  return ax - bx;
}

function guessRoleFromName(name: string): string | undefined {
  const n = (name || '').toLowerCase();
  if (/\b(link|back|learn more|details)\b/.test(n)) return 'link';
  if (/\b(button|cta|start|submit|swap|save|next|continue)\b/.test(n)) return 'button';
  if (/\b(input|field|email|password|search|textbox)\b/.test(n)) return 'textbox';
  if (/\b(tab|pill|segment)\b/.test(n)) return 'tab';
  if (/\b(menu|nav|navigation)\b/.test(n)) return 'navigation';
  if (/\b(header|hero|app bar|top nav)\b/.test(n)) return 'landmark';
  return undefined;
}

function isFocusableHeuristic(node: SceneNode, platform: 'web'|'rn') {
  const nameRole = guessRoleFromName(node.name || '');
  let focusable = Boolean(nameRole);

  // Respect plugin metadata tags if present
  const getPD = (n: any, k: string) => ('getPluginData' in n ? n.getPluginData(k) : '');
  try {
    const tagged = getPD(node as any, 'a11y-focusable');
    const forcedRole = getPD(node as any, 'a11y-role');
    if (tagged === 'true') {
      focusable = true;
      return { focusable, role: forcedRole || nameRole || (platform === 'web' ? 'button' : 'button') };
    }
  } catch {}

  return { focusable, role: nameRole };
}

export function toDTO(n: SceneNode, platform: 'web'|'rn'): NodeDTO {
  const { focusable, role } = isFocusableHeuristic(n, platform);
  const rect = ('absoluteTransform' in n && 'width' in n && 'height' in n)
    ? { x: (n as any).x ?? 0, y: (n as any).y ?? 0, w: (n as any).width ?? 0, h: (n as any).height ?? 0 }
    : undefined;

  const kids = ('children' in n) ? (n.children as SceneNode[])
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
