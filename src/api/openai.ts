// OpenAI Vision API Integration for Focus Order Generation

export interface OpenAIResponse {
  items: FocusOrderItem[];
  confidence: number;
  reasoning: string;
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
  source: 'ai';
  customName?: string;
}

export class OpenAIFocusOrderAPI {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate focus order using OpenAI Vision API
   */
  async generateFocusOrder(
    imageBase64: string,
    nodeTree: any,
    platform: 'web' | 'react-native'
  ): Promise<OpenAIResponse> {
    
    const prompt = this.buildPrompt(nodeTree, platform);
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error && error.error.message ? error.error.message : 'Unknown error'}`);
    }

    const data = await response.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content : null;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return this.parseOpenAIResponse(content, nodeTree);
  }

  /**
   * Build the prompt for OpenAI
   */
  private buildPrompt(nodeTree: any, platform: string): string {
    return `
You are an accessibility expert analyzing a UI design for focus order. 

CONTEXT:
- Platform: ${platform}
- Node tree: ${JSON.stringify(nodeTree, null, 2)}

TASK:
Analyze the image and generate a logical focus order for keyboard navigation following WCAG 2.1 guidelines.

RULES:
1. Focus order should follow reading patterns: top-to-bottom, left-to-right
2. Interactive elements only: buttons, inputs, links, select elements, textareas
3. Logical flow: forms should be filled sequentially, navigation should be intuitive
4. Skip decorative elements and non-interactive content

OUTPUT FORMAT (JSON only, no other text):
{
  "items": [
    {
      "nodeId": "exact_node_id_from_tree",
      "name": "descriptive_name",
      "order": 1,
      "elementType": "button|input|link|select|textarea|div|other",
      "isInteractive": true,
      "reasoning": "why this order makes sense"
    }
  ],
  "confidence": 0.85,
  "reasoning": "overall approach explanation"
}

IMPORTANT:
- Use EXACT node IDs from the provided tree
- Only include truly interactive elements
- Order should feel natural to keyboard users
- Return ONLY valid JSON, no markdown or explanations
`;
  }

  /**
   * Parse OpenAI response into structured data
   */
  private parseOpenAIResponse(content: string, nodeTree: any): OpenAIResponse {
    try {
      // Clean the response - remove any markdown formatting
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanedContent);
      
      // Validate and enrich the response
      const items = parsed.items.map((item: any) => ({
        ...item,
        id: `ai-${item.nodeId}`,
        bounds: this.findNodeBounds(item.nodeId, nodeTree),
        source: 'ai' as const
      }));

      return {
        items,
        confidence: parsed.confidence || 0.8,
        reasoning: parsed.reasoning || 'AI-generated focus order'
      };

    } catch (error) {
      console.error('Failed to parse OpenAI response:', error);
      throw new Error(`Invalid response format from OpenAI: ${error.message}`);
    }
  }

  /**
   * Find bounds for a node ID in the tree
   */
  private findNodeBounds(nodeId: string, nodeTree: any): any {
    const findNode = (node: any): any => {
      if (node.id === nodeId) {
        return node.bounds;
      }
      if (node.children) {
        for (const child of node.children) {
          const result = findNode(child);
          if (result) return result;
        }
      }
      return null;
    };

    return findNode(nodeTree) || { x: 0, y: 0, width: 100, height: 50 };
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

