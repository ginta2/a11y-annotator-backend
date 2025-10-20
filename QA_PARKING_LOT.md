# QA Parking Lot

Issues to revisit after Phase 3 implementation.

---

## 🔴 P1: Semantic Accuracy - Exercise Cards Not Detected

**Date:** 2024-10-18  
**Phase:** Vision API Integration (Phase 2)  
**Status:** Deferred to post-Phase 3

### Issue
Vision model identifies "More" (three-dot menu) buttons but doesn't distinguish individual exercise cards.

**Current behavior:**
- Frame: "Your Workout" (React Native)
- 4 exercise cards visible (all "Deadlift" with thumbnails)
- Model returns: "More" buttons (4x) but not the exercise cards themselves

**Expected behavior:**
- Each exercise card should be a focusable list item
- "More" menu buttons should be secondary actions
- Should see items like: "Exercise 1: Deadlift", "Exercise 2: Deadlift", etc.

**Technical details:**
- Model: GPT-4o Vision
- Prompt: `vision-v1.md` (React Native variant)
- Tokens: ~7625, Cost: ~$0.088
- Platform: React Native
- 11 items returned (correct bottom nav placement)

### Root Cause
Likely prompt guidance issue:
1. Vision prompt may not emphasize card-level focusable elements
2. Model prioritizing interactive buttons over container cards
3. May need explicit instruction: "Cards in lists are focusable as whole units"

### Proposed Fixes (to test after Phase 3)

**Option 1: Prompt refinement**
```markdown
Add to vision-v1.md under React Native rules:
- List items/cards are focusable as complete units (entire card tap target)
- Action buttons within cards (⋯ menu) are separate secondary actions
- Order: Card first, then card actions
```

**Option 2: Few-shot example**
Add concrete example to prompt showing list with cards + action buttons

**Option 3: Tree hint**
Check if node tree clearly marks exercise cards vs menu buttons - may need to pass better structural hints

### Validation Checklist (Post-Phase 3)
- [ ] Visual chips show where model thinks focusable elements are
- [ ] Review if chip positions align with card boundaries or just menu buttons
- [ ] Compare tree structure sent vs what model returned
- [ ] Test with different list-based screens
- [ ] A/B test prompt variations

### Related Items
- Need to verify `position` coordinates are present in response
- Phase 3 visual chips will help diagnose placement accuracy
- May need to tune for Web (ARIA) vs React Native differently

---

## ℹ️ Plugin Behavior: Focus Order vs Reading Order

**Date:** 2024-10-18  
**Status:** Working as intended (documented for user reference)

### What Gets Annotated

The plugin annotates **focusable/interactive elements only** (focus order), not all visible content (reading order).

**✅ Annotated (receives numbered chips):**
- Buttons
- Tabs
- Inputs/text fields
- Links
- Toggles/switches
- Interactive list items/cards

**❌ Not Annotated (semantically exposed but not focusable):**
- Headings/titles
- Subtitles/body text
- Descriptive labels
- Decorative images
- Static text content

### Why This Is Correct

**React Native:**
- `accessible={true}` + `accessibilityRole` defines focusable elements
- Titles: `accessibilityRole="header"` but **should not receive tab focus**
- VoiceOver announces headers when focus enters the group they belong to

**WCAG 2.2:**
- **2.4.3 Focus Order:** Interactive elements must receive focus in a logical sequence
- **1.3.1 Info and Relationships:** Structural text (like titles/headings) must be programmatically exposed but not necessarily focusable

**Practical Rule:**
> Only **actionable and navigational** elements receive focus.  
> **Informational or contextual text** must be exposed semantically but not focusable.

### Future Enhancement (Parking Lot)

**Feature Request:** Add "Reading Order" mode (separate from Focus Order)
- **Focus Order mode (current):** Interactive elements only (numbered chips)
- **Reading Order mode (future):** All content including headings/text (different visual treatment)
- **Use case:** QA testing full screen reader flow vs developer handoff for tab order

**Implementation notes:**
- Would need separate prompt or mode toggle
- Different visual styling (e.g., gray labels for non-interactive, red chips for interactive)
- Useful for comprehensive accessibility audits

---

## ✅ RESOLVED: Input Over-Traversal (2024-10-20)

**Status:** Fixed  
**Phase:** Semantic Boundary Detection

### Issue
Plugin was creating multiple focus stops for single components (e.g., "Input" + "50" text inside should be one focus stop, not two).

**Example:**
- "Reps Input" containing "50" text node
- **Wrong:** Focus order showed TWO items (#6: Input, #7: 50)
- **Correct:** Focus order should show ONE item (#6: Reps Input)

### Root Cause
Deep traversal didn't respect semantic boundaries of interactive components. The `toDTO()` function was recursively serializing ALL children, including text nodes inside inputs, buttons, and tabs.

### Solution Implemented

**1. Client-side (code.js):**
- Added structure-based semantic boundary detection in `toDTO()` function
- Uses `hasOnlyStaticChildren()` helper to check child types
- Stops traversal at INSTANCE/COMPONENT nodes that contain only static children (TEXT, shapes)
- Traverses containers with interactive children (e.g., "Button Group" with buttons inside)
- Screen-agnostic approach - works for any component structure
- Logs "Semantic boundary" for debugging

**2. Server-side (server/prompts/vision-v1.md):**
- Enhanced with complete React Native roles (textfield, search, adjustable, alert, progressbar, timer, menu, toolbar, togglebutton, combobox, spinbutton, grid, summary, keyboardkey, scrollbar)
- Added SEMANTIC GROUPING RULES section explaining one component = one focus stop
- Added SMART LABELING section for generic component name inference (e.g., "Frame 24" → "Reps Input")

### Result
✅ Single interactive component = single focus stop  
✅ Reduced payload size (fewer nodes sent to API)  
✅ Better AI accuracy (clearer semantic units)  
✅ Smart labeling for poorly-named components

### Testing Verified
- ✅ "Reps Input" with "50" creates ONE focus stop
- ✅ Buttons with interior text create ONE focus stop
- ✅ Component instances stop traversal properly
- ✅ Console logs show "Semantic boundary" messages

---

## 📋 Future QA Items

### To Add After Phase 3
- Coordinate accuracy validation
- Chip placement visual review
- Platform-specific behavior verification (Web vs RN)

---

**Last Updated:** 2024-10-20  
**Next Review:** After Phase 3 implementation

