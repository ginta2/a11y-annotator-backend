// TypeScript interfaces for A11y Annotator

export interface FocusOrderItem {
  id: string;
  nodeId: string;
  name: string;
  order: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  elementType: 'button' | 'input' | 'link' | 'select' | 'textarea' | 'div' | 'other';
  isInteractive: boolean;
  source: 'heuristic' | 'ai' | 'manual';
  customName?: string;
}

export interface FocusOrderSpec {
  version: '1.0';
  frameId: string;
  frameName: string;
  platform: 'web' | 'react-native';
  items: FocusOrderItem[];
  createdAt: number;
  updatedAt: number;
  metadata: {
    totalItems: number;
    interactiveItems: number;
    hasManualEdits: boolean;
  };
}

export interface NodeTree {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: NodeTree[];
  properties: {
    isInteractive: boolean;
    elementType: string;
    hasText: boolean;
    textContent?: string;
  };
}

export interface AnnotationChip {
  id: string;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportData {
  spec: FocusOrderSpec;
  markdown: string;
  json: string;
}

export interface UserProfile {
  apiKey?: string;
  platform: 'web' | 'react-native';
  autoGenerate: boolean;
  showTips: boolean;
}

export interface UIState {
  isLoading: boolean;
  selectedFrame: string | null;
  currentSpec: FocusOrderSpec | null;
  dragIndex: number | null;
  error: string | null;
}

