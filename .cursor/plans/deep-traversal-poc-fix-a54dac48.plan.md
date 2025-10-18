<!-- a54dac48-dfad-40fe-8b0e-c105fcc269a3 bec5c2c3-084a-4acc-8bc3-5db879db461e -->
# Vision-Based Accessibility Annotation Plan

## Current State Analysis

**What you have:**
- Text-only analysis: sends JSON tree to GPT-4o-mini
- Returns focus order list (id, label, role)
- Draws yellow note with list in Figma

**What you want:**
- Send PNG screenshot + JSON tree to GPT-4 Vision
- Get semantic focus order with precise coordinates
- Draw numbered chips directly on elements in Figma

## Critical Insight: GPT-4 Vision Limitations

⚠️ **GPT-4 Vision cannot generate annotated images.** It can only:
- Analyze images
- Return JSON with element positions/descriptions
- Suggest where annotations should go

✅ **Solution:** GPT returns coordinates; Figma plugin draws the chips.

---

## Architecture Plan

### 1. Where to Put the Prompt

**Recommended structure in `server/server.js`:**

```javascript
// After SYSTEM_PROMPT_V1, add:

const SYSTEM_PROMPT_VISION_V1 = `
You are an accessibility engine analyzing UI screenshots.
Identify focusable elements and return JSON with focus order.

Output format:
{
  "annotations": [{
    "frameId": "string",
    "order": [
      {
        "id": "string",
        "label": "Element Name",
        "role": "button|tab|textfield|header|link|...",
        "position": { "x": 0, "y": 0 }  // coordinates for annotation chip
      }
    ],
    "notes": "string"
  }]
}

Rules:
- Traverse nested UI (BottomNav → Tab → Label)
- Top-to-bottom, left-to-right order
- Use ARIA/iOS/Android standard roles
- Provide x,y coordinates (top-left of each element) for visual annotation
- Match IDs from the provided tree structure
`;
```

**Why here:**
- Co-located with existing SYSTEM_PROMPT_V1
- Easy to version (V1, V2, etc.) and A/B test
- Server-side = no client bundle bloat

---

### 2. API Flow Changes

#### Plugin Side (`code.js`)

**Add PNG export:**
```javascript
async function runPropose({ frames, platform, prompt }) {
  const selection = figma.currentPage.selection[0];
  
  // ... existing checks ...
  
  // Export PNG @2x
  const png = await selection.exportAsync({
    format: 'PNG',
    constraint: { type: 'SCALE', value: 2 }
  });
  
  const base64 = figma.base64Encode(png);
  
  // Serialize tree
  const dto = toDTO(selection, platform);
  
  const payload = {
    platform,
    image: `data:image/png;base64,${base64}`,  // NEW
    frames: [{ id, name, box, children: dto.children }]
  };
  
  // ... POST to /annotate ...
}
```

#### Server Side (`server/server.js`)

**Extend `/annotate` endpoint:**
```javascript
app.post('/annotate', async (req, res) => {
  const { platform, image, frames } = req.body;
  
  // If image provided, use vision model
  if (image) {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  // vision-capable
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_VISION_V1 },
        { 
          role: 'user', 
          content: [
            { type: 'text', text: `Platform: ${platform}\nTree:\n${JSON.stringify(tree)}` },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
    });
    // ... parse and return
  }
  
  // Fallback to text-only
  // ... existing logic
});
```

---

### 3. Prompt Engineering Analysis

**Your current prompt issues:**

❌ **Too verbose** (2000+ words) – API has token limits  
❌ **Asks for image generation** – GPT-4 Vision can't do this  
❌ **Mixed audience** – combines API instructions with human documentation  
❌ **No structured examples** – harder for model to match format  

**Refinement principles:**

✅ **Be directive, not descriptive** – "Return JSON with..." not "The output must contain..."  
✅ **Use few-shot examples** – show 1-2 small input→output pairs  
✅ **Specify coordinate system** – clarify if x,y is absolute or relative  
✅ **Constrain roles** – list valid ARIA roles explicitly  
✅ **Version prompts** – tag as V1 so you can iterate

---

### 4. Refined Prompt (API-Ready)

```javascript
const SYSTEM_PROMPT_VISION_V1 = `
You are an accessibility focus order analyzer (v1).

INPUT:
- Screenshot of UI (mobile, web, or desktop)
- JSON tree of nodes with id, name, type, x, y, w, h, children[]

OUTPUT (strict JSON):
{
  "annotations": [{
    "frameId": "string",
    "order": [
      { "id": "node-id", "label": "Button Text", "role": "button", "position": { "x": 100, "y": 200 } }
    ],
    "notes": "Optional reasoning"
  }]
}

RULES:
1. Identify focusable elements: buttons, links, inputs, tabs, cards, switches
2. Include semantic elements: headings, labels (role: header, staticText)
3. Order: top→bottom, left→right; group by region (header, content, nav)
4. Roles: button, tab, link, textfield, header, staticText, image, checkbox, switch, listitem
5. Position: x,y coordinates (top-left corner) for annotation chip placement
6. Match IDs from tree; never invent IDs
7. Prefer leaf elements over containers (Tab Label > Tab Container)

EXAMPLE:
Input: Screenshot with "Search" field, "Filter" button, "Home" tab
Tree: [{ id: "s1", name: "Search" }, { id: "f1", name: "Filter" }, { id: "h1", name: "Home" }]

Output:
{
  "annotations": [{
    "frameId": "frame123",
    "order": [
      { "id": "s1", "label": "Search", "role": "textfield", "position": { "x": 20, "y": 50 } },
      { "id": "f1", "label": "Filter", "role": "button", "position": { "x": 200, "y": 50 } },
      { "id": "h1", "label": "Home", "role": "tab", "position": { "x": 20, "y": 600 } }
    ],
    "notes": "Standard top-to-bottom order"
  }]
}
`;
```

**Why this works:**
- Concise (under 400 tokens)
- Clear input/output contract
- Includes working example
- Coordinates enable visual annotation
- Versioned for iteration

---

### 5. Drawing Numbered Chips in Figma

**Add to `code.js`:**

```javascript
async function drawFocusChips(frame, annotation) {
  const order = annotation.order || [];
  
  for (let i = 0; i < order.length; i++) {
    const item = order[i];
    const num = i + 1;
    const pos = item.position || { x: 0, y: 0 };
    
    // Create red circle with white number
    const chip = figma.createEllipse();
    chip.resize(32, 32);
    chip.fills = [{ type: 'SOLID', color: { r: 0.91, g: 0.28, b: 0.15 } }]; // #E84827
    chip.x = frame.x + pos.x;
    chip.y = frame.y + pos.y;
    
    // Add text
    await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
    const text = figma.createText();
    text.characters = String(num);
    text.fontSize = 16;
    text.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    text.x = chip.x + 10;
    text.y = chip.y + 8;
    
    // Group chip + number
    const group = figma.group([chip, text], frame.parent);
    group.name = `A11y Chip ${num}`;
    group.locked = true;
  }
}
```

---

## Implementation Phases

### Phase 1: Prompt Refinement (1 day)
- Replace verbose prompt with refined `SYSTEM_PROMPT_VISION_V1`
- Store in `server/server.js` after existing prompts
- Test with manual curl + base64 image

### Phase 2: Vision API Integration (2 days)
- Add PNG export in `code.js`
- Extend `/annotate` to accept `image` field
- Switch to `gpt-4o` model when image present
- Return coordinates in response

### Phase 3: Visual Annotation (1 day)
- Implement `drawFocusChips()` in `code.js`
- Position numbered circles using returned coordinates
- Keep existing yellow note as backup/summary

### Phase 4: Polish (1 day)
- Add UI toggle: "Text-only" vs "Vision-enhanced"
- Cache vision results (expensive API calls)
- Handle edge cases (no image, bad coordinates)

---

## Cost & Performance Notes

**GPT-4o Vision pricing (as of Oct 2024):**
- ~$0.01 per 1k input tokens
- ~$0.03 per 1k output tokens
- Images: ~$0.00765 per image (varies by size)

**Typical request cost:** $0.02–0.05 per frame

**Optimization:**
- Cache by (checksum + image hash)
- Use `gpt-4o-mini` when no image
- Compress PNG to <1MB before encoding

---

## Files Changed

1. **`server/server.js`**
   - Add `SYSTEM_PROMPT_VISION_V1` constant
   - Extend `/annotate` to handle `image` field
   - Switch model based on image presence

2. **`code.js`**
   - Add PNG export with `exportAsync()`
   - Encode as base64 and send in payload
   - Implement `drawFocusChips()` function
   - Replace yellow note with numbered chips

---

## Success Criteria

✅ Plugin exports frame as PNG and sends with tree  
✅ Server uses GPT-4o Vision when image present  
✅ Response includes coordinates for each focus item  
✅ Figma draws numbered red chips at correct positions  
✅ Chips match semantic order from list  
✅ Costs stay under $0.10 per annotation

---

## Next Steps

1. Review this plan
2. Decide: full vision integration or text-only refinement first?
3. I can implement Phase 1 (prompt refinement) immediately
4. Phases 2-3 require PNG export + coordinate parsing

### To-dos

- [ ] Create SYSTEM_PROMPT_VISION_V1 in server.js with refined accessibility prompt
- [ ] Add exportAsync PNG generation in code.js runPropose function
- [ ] Update /annotate endpoint to accept image field and use gpt-4o for vision
- [ ] Parse position coordinates from API response and validate against frame bounds
- [ ] Implement drawFocusChips() to render numbered circles at returned coordinates
- [ ] Add UI control to switch between text-only and vision-enhanced modes