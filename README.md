# A11y Annotator - Focus Order Plugin

A Figma plugin that automatically generates and annotates focus order for accessibility handoff. This plugin helps designers create proper tab sequences for keyboard navigation.

## Features

- **🧠 Smart Focus Order Generation**: Uses heuristics and AI to propose logical focus order
- **✏️ Easy Editing**: Review, edit, and reorder focus items in a clean sidebar
- **📋 Visual Annotations**: Paste annotated duplicates with numbered chips
- **💾 Persistent Specs**: Saves specs on frames and preserves manual edits
- **📤 Export Ready**: Generate JSON and Markdown for engineering handoff
- **🌐 Platform Support**: Web (ARIA) and React Native (props) modes

## Installation

1. Open Figma Desktop App (plugins don't work in browser)
2. Go to Plugins → Development → Import plugin from manifest
3. Select the `manifest.json` file from this project
4. The plugin will appear in your plugins menu

## Usage

### Basic Workflow

1. **Select a Frame**: Choose a frame, component, or instance
2. **Generate Focus Order**: Click "Propose Focus Order" to auto-generate
3. **Review & Edit**: Use the sidebar to reorder, rename, or remove items
4. **Annotate**: Click "Paste with Annotations" to create a visual duplicate
5. **Export**: Generate JSON/Markdown for your engineering team

### Platform Toggle

- **Web (ARIA)**: Generates specs for web accessibility with ARIA attributes
- **React Native**: Creates specs for React Native with accessibility props

### Focus Order Rules

The plugin follows accessibility best practices:

- **Top-to-Bottom**: Primary reading direction
- **Left-to-Right**: Secondary direction for same row
- **Interactive Elements**: Buttons, inputs, links, and custom interactive components
- **Semantic Priority**: Buttons > inputs > links > other elements

## Architecture

```
Figma Plugin UI ↔ Plugin Controller ↔ Heuristics Engine
                                       ↕
                                  Backend API
                                       ↕
                                  OpenAI Vision
```

### Components

- **UI Layer**: React-like sidebar with drag-and-drop editing
- **Heuristics Engine**: Baseline focus order using accessibility rules
- **AI Integration**: Optional OpenAI Vision API for enhanced suggestions
- **Annotation System**: Visual chip overlays on duplicated frames
- **Persistence**: PluginData for specs, ClientStorage for user preferences
- **Export System**: JSON schema + Markdown tables

## Data Models

### FocusOrderSpec
```typescript
interface FocusOrderSpec {
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
```

### FocusOrderItem
```typescript
interface FocusOrderItem {
  id: string;
  nodeId: string;
  name: string;
  order: number;
  bounds: { x: number; y: number; width: number; height: number };
  elementType: 'button' | 'input' | 'link' | 'select' | 'textarea' | 'div' | 'other';
  isInteractive: boolean;
  source: 'heuristic' | 'ai' | 'manual';
  customName?: string;
}
```

## Export Formats

### JSON Export
```json
{
  "version": "1.0",
  "frameId": "123:456",
  "frameName": "Login Form",
  "platform": "web",
  "items": [
    {
      "id": "focus-123:456",
      "nodeId": "123:456",
      "name": "Email Input",
      "order": 1,
      "elementType": "input",
      "isInteractive": true,
      "source": "heuristic"
    }
  ]
}
```

### Markdown Export
```markdown
# Focus Order: Login Form

**Platform:** web
**Total Items:** 3
**Interactive Items:** 3

## Focus Order

| Order | Name | Element Type | Node ID |
|-------|------|--------------|---------|
| 1 | Email Input | input | `123:456` |
| 2 | Password Input | input | `123:457` |
| 3 | Login Button | button | `123:458` |
```

## Performance Targets

- **Proposal Generation**: ≤12 seconds
- **Annotation Paste**: ≤2 seconds
- **UI Responsiveness**: 60fps interactions

## Success Metrics

- **Proposal Acceptance**: ≥70% of generated items accepted without changes
- **Time Savings**: ≥60% reduction in manual annotation time
- **Edit Preservation**: ≥90% of manual edits preserved across re-runs

## Development

### Project Structure
```
figma-plugin/
├── manifest.json          # Plugin configuration
├── ui.html               # Plugin UI markup
├── ui.js                 # UI controller and interactions
├── code.js               # Main plugin logic
├── src/
│   ├── types/            # TypeScript interfaces
│   ├── heuristics/       # Focus order algorithms
│   ├── api/              # Backend integration
│   └── ui/               # UI components
└── assets/               # Plugin assets
```

### Key Features Implemented

✅ **Core Plugin Structure**
- Manifest configuration
- UI/Code separation
- Message passing system

✅ **Focus Order Heuristics**
- Interactive element detection
- Reading order algorithms
- Semantic element classification

✅ **Interactive UI**
- Drag-and-drop reordering
- Inline editing
- Platform toggle
- Real-time validation

✅ **Annotation System**
- Visual chip overlays
- Numbered focus indicators
- Locked annotation groups

✅ **Persistence**
- PluginData storage on frames
- ClientStorage for user preferences
- Edit preservation across sessions

✅ **Export System**
- JSON schema generation
- Markdown table export
- Clipboard integration

### Future Enhancements

- **AI Integration**: OpenAI Vision API for enhanced suggestions
- **Batch Processing**: Multiple frame annotation
- **Additional Annotations**: Headings, Landmarks, Alt-Text
- **Automated Testing**: Contrast checks and design fixes
- **Team Collaboration**: Shared annotation libraries

## Contributing

### Development Guidelines
Please read [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) before contributing. Key principles:

- **Prefer clarity over cleverness** - Small, composable functions
- **Minimal working increments** - Avoid speculative abstractions
- **Quality gates** - Lint, format, test, document
- **Security first** - Validate inputs, handle errors explicitly

### Contribution Process
1. Fork the repository
2. Create a feature branch
3. Follow development rules and guidelines
4. Test in Figma Desktop
5. Ensure all quality gates pass
6. Submit a pull request with clear rationale

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please create an issue in the repository.
