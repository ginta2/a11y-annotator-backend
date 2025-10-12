// Focus Order Heuristics Engine
// Generates baseline focus order using accessibility best practices

export interface NodeData {
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
  children?: NodeData[];
  properties: {
    isInteractive: boolean;
    elementType: string;
    hasText: boolean;
    textContent?: string;
  };
}

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

export class FocusOrderHeuristics {
  
  /**
   * Generate focus order for a frame using heuristics
   */
  static generateFocusOrder(nodes: NodeData[]): FocusOrderItem[] {
    const interactiveNodes = this.extractInteractiveNodes(nodes);
    const sortedNodes = this.sortNodesByFocusOrder(interactiveNodes);
    
    return sortedNodes.map((node, index) => ({
      id: `focus-${node.id}`,
      nodeId: node.id,
      name: this.generateNodeName(node),
      order: index + 1,
      bounds: node.bounds,
      elementType: this.determineElementType(node),
      isInteractive: node.properties.isInteractive,
      source: 'heuristic' as const,
      customName: undefined
    }));
  }

  /**
   * Extract all interactive nodes from the tree
   */
  private static extractInteractiveNodes(nodes: NodeData[]): NodeData[] {
    const interactive: NodeData[] = [];
    
    const traverse = (nodeList: NodeData[]) => {
      for (const node of nodeList) {
        if (node.visible && this.isInteractiveNode(node)) {
          interactive.push(node);
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    
    traverse(nodes);
    return interactive;
  }

  /**
   * Determine if a node is interactive based on its properties
   */
  private static isInteractiveNode(node: NodeData): boolean {
    // Check if explicitly marked as interactive
    if (node.properties.isInteractive) {
      return true;
    }
    
    // Check by node type
    const interactiveTypes = [
      'FRAME', 'INSTANCE', 'COMPONENT', 'COMPONENT_SET'
    ];
    
    // Check by name patterns (common interactive elements)
    const interactivePatterns = [
      /button/i, /btn/i, /link/i, /a\b/i, /input/i, /select/i, 
      /textarea/i, /click/i, /tap/i, /press/i, /submit/i
    ];
    
    const hasInteractiveName = interactivePatterns.some(pattern => 
      pattern.test(node.name)
    );
    
    return interactiveTypes.includes(node.type) || hasInteractiveName;
  }

  /**
   * Sort nodes by focus order using accessibility best practices
   */
  private static sortNodesByFocusOrder(nodes: NodeData[]): NodeData[] {
    return nodes.sort((a, b) => {
      // Primary sort: Top to bottom
      const verticalDiff = a.bounds.y - b.bounds.y;
      if (Math.abs(verticalDiff) > 10) { // Allow 10px tolerance
        return verticalDiff;
      }
      
      // Secondary sort: Left to right (for same row)
      return a.bounds.x - b.bounds.x;
    });
  }

  /**
   * Generate a readable name for the node
   */
  private static generateNodeName(node: NodeData): string {
    // If node has text content, use that
    if (node.properties.textContent && node.properties.textContent.trim()) {
      return node.properties.textContent.trim().substring(0, 50);
    }
    
    // Clean up the node name
    let name = node.name;
    
    // Remove common prefixes/suffixes
    name = name.replace(/^(button|btn|link|input|select|textarea)-?/i, '');
    name = name.replace(/-?(button|btn|link|input|select|textarea)$/i, '');
    
    // Convert to readable format
    name = name.replace(/[-_]/g, ' ');
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
    
    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    
    // Fallback to element type if name is too generic
    if (name.length < 2 || /^(element|node|frame|group)$/i.test(name)) {
      const elementType = this.determineElementType(node);
      return `${elementType} ${node.id.slice(-4)}`;
    }
    
    return name;
  }

  /**
   * Determine the semantic element type
   */
  private static determineElementType(node: NodeData): FocusOrderItem['elementType'] {
    const name = node.name.toLowerCase();
    
    if (/button|btn/i.test(name)) return 'button';
    if (/input/i.test(name)) return 'input';
    if (/link|a\b/i.test(name)) return 'link';
    if (/select|dropdown/i.test(name)) return 'select';
    if (/textarea/i.test(name)) return 'textarea';
    if (/div|container|wrapper/i.test(name)) return 'div';
    
    return 'other';
  }

  /**
   * Calculate reading order score for a node
   * Higher score = should come earlier in focus order
   */
  private static getReadingOrderScore(node: NodeData): number {
    let score = 0;
    
    // Prioritize elements with text content
    if (node.properties.textContent && node.properties.textContent.trim()) {
      score += 100;
    }
    
    // Prioritize by element type (semantic importance)
    const typeScores: Record<string, number> = {
      'button': 80,
      'input': 70,
      'link': 60,
      'select': 50,
      'textarea': 40,
      'div': 20,
      'other': 10
    };
    
    const elementType = this.determineElementType(node);
    score += typeScores[elementType] || 10;
    
    // Prioritize elements in the upper-left (common reading pattern)
    score += Math.max(0, 100 - (node.bounds.y / 10));
    score += Math.max(0, 50 - (node.bounds.x / 20));
    
    return score;
  }

  /**
   * Validate focus order for common accessibility issues
   */
  static validateFocusOrder(items: FocusOrderItem[]): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check for duplicate orders
    const orders = items.map(item => item.order);
    const uniqueOrders = new Set(orders);
    if (orders.length !== uniqueOrders.size) {
      issues.push('Duplicate focus order numbers found');
    }
    
    // Check for missing interactive elements
    const interactiveItems = items.filter(item => item.isInteractive);
    if (interactiveItems.length === 0) {
      issues.push('No interactive elements found in focus order');
    }
    
    // Check for logical flow (top-to-bottom, left-to-right)
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      
      // Check for significant jumps backwards
      if (curr.bounds.y < prev.bounds.y - 50) {
        issues.push(`Focus order ${curr.order} jumps backwards vertically`);
      }
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Merge heuristic results with AI results
   * AI results take priority, but heuristic provides fallback
   */
  static mergeResults(
    heuristicItems: FocusOrderItem[],
    aiItems: FocusOrderItem[],
    manualItems?: FocusOrderItem[]
  ): FocusOrderItem[] {
    // Start with manual edits (highest priority)
    const result = manualItems ? [...manualItems] : [];
    
    // Add AI results for items not manually edited
    const manualNodeIds = new Set(manualItems?.map(item => item.nodeId) || []);
    const aiItemsNotManual = aiItems.filter(item => !manualNodeIds.has(item.nodeId));
    result.push(...aiItemsNotManual);
    
    // Add heuristic results for items not in AI or manual
    const existingNodeIds = new Set(result.map(item => item.nodeId));
    const heuristicItemsNotExisting = heuristicItems.filter(
      item => !existingNodeIds.has(item.nodeId)
    );
    result.push(...heuristicItemsNotExisting);
    
    // Re-sort by order
    result.sort((a, b) => a.order - b.order);
    
    // Re-assign sequential order numbers
    result.forEach((item, index) => {
      item.order = index + 1;
    });
    
    return result;
  }
}

