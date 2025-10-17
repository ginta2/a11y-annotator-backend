// src/code.ts

// Figma API types (simplified for plugin context)
declare global {
  interface FrameNode {
    id: string;
    name: string;
    type: string;
    visible: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: SceneNode[];
    getPluginData?: (key: string) => string;
    setPluginData?: (key: string, value: string) => void;
    absoluteTransform?: any;
  }

  interface SceneNode {
    id: string;
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

  interface FigmaAPI {
    currentPage: {
      selection: SceneNode[];
    };
    notify: (message: string) => void;
    ui: {
      onmessage: (handler: (msg: any) => void) => void;
      postMessage: (message: any) => void;
    };
  }

  const figma: FigmaAPI;
}

import { toDTO } from './lib/serialize';

figma.ui.onmessage = async (msg: any) => {
  if (msg.type === 'PROPOSE_FOCUS_ORDER') {
    const platform: 'web'|'rn' = msg.platform; // 'web' or 'rn'
    const selection = figma.currentPage.selection[0];

    if (!selection || selection.type !== 'FRAME') {
      figma.notify('Select a frame to annotate.');
      return;
    }

    const frameTree = toDTO(selection as FrameNode, platform);

    // lightweight count to decide trivial cases
    const focusableCount = JSON.stringify(frameTree).match(/"focusable":true/g)?.length ?? 0;

    const payload = {
      platform,
      frames: [{
        id: selection.id,
        name: selection.name,
        tree: frameTree
      }]
    };

    const res = await fetch(`${'https://a11y-annotator-backend.onrender.com'}/annotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json()).catch(() => ({ ok: false }));

    if (!res || !res.ok) {
      figma.notify('Focus order service unavailable.');
      return;
    }

    // Persist annotation on the frame
    (selection as any).setPluginData('a11y-focus-order', JSON.stringify({
      platform,
      frameId: selection.id,
      frameName: selection.name,
      checksum: res.checksum,
      items: res.items,
      at: new Date().toISOString()
    }));

    figma.notify('A11y: Annotation received and rendered.');
    figma.ui.postMessage({ type: 'ANNOTATION_APPLIED', data: res });
  }
};
