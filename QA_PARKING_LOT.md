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

## 📋 Future QA Items

### To Add After Phase 3
- Coordinate accuracy validation
- Chip placement visual review
- Platform-specific behavior verification (Web vs RN)

---

**Last Updated:** 2024-10-18  
**Next Review:** After Phase 3 implementation

