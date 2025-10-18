# Prompt Management

This directory contains versioned system prompts for the A11y Annotator backend.

## Structure

```
prompts/
├── README.md           # This file
├── vision-v1.md        # GPT-4o Vision prompt (with image analysis)
├── text-v1.md          # GPT-4o-mini text-only prompt (fallback)
└── examples/
    ├── web-example.json     # Sample Web/ARIA input/output
    └── rn-example.json      # Sample React Native input/output
```

## How Prompts Work

1. **Prompt files** contain the system prompt in markdown format
2. **Server loads** them at startup using `loadPrompt()` function
3. **Platform injection** replaces `{PLATFORM}` placeholder at runtime:
   - `'rn'` → `"React Native"`
   - `'web'` → `"Web (ARIA/WCAG)"`
4. **Model selection** depends on whether image is present:
   - Image provided → use `vision-v1.md` + GPT-4o
   - No image → use `text-v1.md` + GPT-4o-mini

## Editing Prompts

### To modify an existing prompt:

1. Edit the `.md` file directly (e.g., `vision-v1.md`)
2. Keep the `{PLATFORM}` placeholder where platform name should appear
3. Test locally: `npm start` in server directory
4. Commit changes with descriptive message
5. Deploy to Render (auto-deploys on push to main)

### To create a new version:

1. Copy existing prompt: `cp vision-v1.md vision-v2.md`
2. Make your changes in v2
3. Update `server.js` to reference new version:
   ```javascript
   const PROMPTS = {
     vision: loadPrompt('vision-v2.md'),  // ← change here
     text: loadPrompt('text-v1.md')
   };
   ```
4. Keep old version for rollback capability

## Platform-Specific Rules

### Web (ARIA/WCAG)
- Headings (h1-h6) are navigable
- Links vs buttons are distinct
- Form inputs paired with labels
- Skip links come first
- Modals take priority

### React Native (iOS/Android)
- Screen title (header) first
- Bottom nav tabs last
- Card tap targets include full boundary
- Decorative images get role "none"
- Group related elements

## Prompt Format

Each prompt file should have:

```markdown
# Title

**Platform Placeholder:** `{PLATFORM}`
**Model:** (model name)
**Last Updated:** (date)

---

## System Prompt

[The actual prompt text that gets sent to OpenAI]

---

## Version History

- **v1** (date): description
```

## Testing Prompts

### Manual test with curl:

```bash
# Export a frame as PNG and convert to base64
# Then:

curl -X POST https://a11y-annotator-backend.onrender.com/annotate \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "rn",
    "image": "data:image/png;base64,...",
    "frames": [{
      "id": "test",
      "name": "Test Frame",
      "box": {"x":0,"y":0,"w":375,"h":812},
      "children": [...]
    }]
  }'
```

### Check which prompt is being used:

Look for log output in Render:
```
[SRV] Using vision prompt for React Native
```

## Cost Tracking

- **GPT-4o Vision**: ~$0.02-0.05 per frame
- **GPT-4o-mini Text**: ~$0.001-0.003 per frame

Monitor usage in OpenAI dashboard and Render logs.

## Versioning Strategy

- **Major version** (v1 → v2): Significant structural changes, breaking changes
- **Minor updates**: Edit existing version file, note in commit message
- **Platform-specific**: Can have separate files if divergence increases

## Current Versions

- **vision-v1.md**: Platform-aware vision prompt with coordinate output
- **text-v1.md**: Platform-aware text-only prompt (no coordinates)

---

Last updated: 2024-10-18

