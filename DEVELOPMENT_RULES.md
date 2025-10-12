# Development Rules & Guidelines

## Core Principles
- **Prefer clarity over cleverness.** Small, composable functions. No dead code.
- **Always produce minimal, working increments;** avoid speculative abstractions.
- **If requirements are ambiguous, infer a sensible default and document it in the PR text you generate.**

## Code Quality Gates
- Apply project formatter & linter on all code you generate.
- Include tests for any new logic (unit for pure functions; integration where behavior crosses boundaries).
- Provide: (1) a short rationale, (2) a code diff or patch, (3) exact commands to run/build/test.

## Documentation
- At each change, update README/usage snippets if the public surface changes.
- Add docstrings/JSDoc/typing aligned with the language file below.

## Security & Reliability
- Validate inputs at boundaries. Handle errors explicitly. No secrets in code.
- Use parameterized queries / ORM safeguards. Avoid insecure crypto/hashing.

## Review Checklist (pre-output)
- ✅ Compiles/Type-checks
- ✅ Lints & formatted
- ✅ Tests added/updated & passing
- ✅ README or comments updated
- ✅ Clear migration or rollout notes if needed

---

## Project-Specific Guidelines

### Figma Plugin Development
- **Sandbox Security**: All plugin code runs in Figma's sandbox - no external dependencies
- **Message Passing**: Use structured message passing between UI and main thread
- **Error Handling**: Always wrap API calls in try-catch blocks
- **User Experience**: Show loading states, error messages, and success feedback

### API Integration
- **Rate Limiting**: Implement proper rate limiting for OpenAI API calls
- **Cost Control**: Always provide fallback mechanisms (heuristics when AI fails)
- **Data Privacy**: Never store sensitive data, use local storage only
- **Validation**: Validate all API responses before processing

### Accessibility Focus
- **WCAG Compliance**: Follow WCAG 2.1 guidelines in all generated focus orders
- **Semantic HTML**: Use proper semantic elements and ARIA attributes
- **Testing**: Include keyboard navigation testing in development workflow
- **Documentation**: Provide clear implementation guidance for engineers

## Code Style

### JavaScript/TypeScript
```javascript
// Use descriptive function names
function generateFocusOrderForFrame(frame) { }

// Add JSDoc comments for complex functions
/**
 * Generates focus order using heuristics and AI
 * @param {Object} frame - Figma frame node
 * @param {string} platform - 'web' or 'react-native'
 * @returns {Promise<FocusOrderSpec>} Generated focus order specification
 */
async function proposeFocusOrder(frame, platform) { }

// Handle errors explicitly
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('API call failed:', error);
  throw new Error(`Failed to generate focus order: ${error.message}`);
}
```

### HTML/CSS
```html
<!-- Use semantic HTML -->
<button id="propose-order" class="button button-primary" aria-label="Generate focus order">
  🧠 Propose Focus Order
</button>

<!-- Include accessibility attributes -->
<input type="password" id="api-key-input" 
       placeholder="sk-..." 
       aria-describedby="api-key-help">
<div id="api-key-help" class="sr-only">Enter your OpenAI API key</div>
```

### CSS
```css
/* Use consistent naming conventions */
.button-primary { }
.button-secondary { }
.input-group { }
.focus-item { }

/* Include focus states for accessibility */
.button:focus {
  outline: 2px solid #18a0fb;
  outline-offset: 2px;
}

/* Use relative units for scalability */
.container {
  max-width: 320px;
  padding: 16px;
}
```

## Testing Strategy

### Unit Tests
```javascript
// Test pure functions
describe('FocusOrderHeuristics', () => {
  test('should sort nodes by reading order', () => {
    const nodes = [
      { bounds: { x: 100, y: 200 } },
      { bounds: { x: 50, y: 100 } }
    ];
    const result = sortNodesByFocusOrder(nodes);
    expect(result[0].bounds.y).toBe(100); // Top item first
  });
});
```

### Integration Tests
```javascript
// Test API integration
describe('OpenAI Integration', () => {
  test('should handle API errors gracefully', async () => {
    const mockError = new Error('API rate limit exceeded');
    jest.spyOn(global, 'fetch').mockRejectedValue(mockError);
    
    const result = await getAIFocusOrder(frame, nodeTree, apiKey);
    expect(result).toEqual([]); // Should return empty array on error
  });
});
```

### Manual Testing Checklist
- [ ] Plugin loads without errors in Figma Desktop
- [ ] API key validation works correctly
- [ ] Focus order generation produces logical results
- [ ] Drag-and-drop reordering functions properly
- [ ] Export generates valid JSON and Markdown
- [ ] Error messages are clear and helpful
- [ ] Loading states provide good user feedback

## Deployment Process

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code formatted and linted
- [ ] Documentation updated
- [ ] API key handling secure
- [ ] Error handling comprehensive
- [ ] User experience smooth

### Version Management
- Use semantic versioning (1.0.0, 1.1.0, 1.1.1)
- Update manifest.json version field
- Document breaking changes in CHANGELOG.md
- Tag releases in git

### Rollout Strategy
1. **Internal Testing**: Test with team members first
2. **Beta Release**: Limited release to trusted users
3. **Full Release**: Public availability
4. **Monitoring**: Track usage and error rates

## Security Considerations

### API Key Management
- Never log or expose API keys
- Use secure storage (Figma clientStorage)
- Provide clear instructions for key rotation
- Implement key validation

### Data Handling
- No sensitive data in logs
- Validate all user inputs
- Sanitize data before API calls
- Handle errors without exposing internals

### Privacy
- Process data locally when possible
- Only send necessary data to external APIs
- Provide clear data usage information
- Allow users to opt out of AI features

## Performance Guidelines

### Optimization Targets
- **Plugin Load Time**: < 2 seconds
- **Focus Order Generation**: < 12 seconds
- **UI Responsiveness**: 60fps interactions
- **Memory Usage**: < 50MB

### Best Practices
- Lazy load heavy dependencies
- Cache results when appropriate
- Use efficient data structures
- Minimize API calls
- Provide progress indicators for long operations

## Error Handling

### Error Categories
1. **User Errors**: Invalid input, missing selections
2. **API Errors**: Network issues, rate limits, invalid keys
3. **System Errors**: Plugin crashes, memory issues
4. **Data Errors**: Invalid responses, parsing failures

### Error Response Strategy
```javascript
// Provide specific, actionable error messages
if (!apiKey) {
  throw new Error('Please enter your OpenAI API key first');
}

if (apiKey && !apiKey.startsWith('sk-')) {
  throw new Error('API key should start with "sk-"');
}

// Log technical details, show user-friendly messages
try {
  await apiCall();
} catch (error) {
  console.error('Technical details:', error);
  throw new Error('Failed to connect to OpenAI. Please check your API key and internet connection.');
}
```

## Documentation Standards

### Code Comments
```javascript
/**
 * Generates focus order using accessibility heuristics
 * 
 * @param {NodeData[]} nodes - Array of interactive nodes
 * @param {string} platform - Target platform ('web' | 'react-native')
 * @returns {FocusOrderItem[]} Sorted array of focus items
 * 
 * @example
 * const focusOrder = generateHeuristicFocusOrder(nodes, 'web');
 * console.log(focusOrder[0].name); // "Submit Button"
 */
function generateHeuristicFocusOrder(nodes, platform) {
  // Implementation details...
}
```

### README Updates
- Update setup instructions when adding new features
- Include code examples for new functionality
- Document any breaking changes
- Provide troubleshooting guides

### API Documentation
- Document all message types between UI and main thread
- Provide examples for each API endpoint
- Include error response formats
- Document rate limits and usage guidelines

---

**Remember**: These rules ensure code quality, security, and maintainability. Always follow them when contributing to the project.

