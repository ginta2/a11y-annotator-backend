# PRD — A11y Annotator (Focus Order POC)

## Summary
A Figma plugin that helps designers create accessibility annotations.  
First release focuses on **Focus Order**: automatically proposing an order of interactive elements, letting the designer review/edit, and pasting an annotated duplicate of the frame with numbered chips.  
The plugin later connects to a backend that uses **ChatGPT Vision API** to analyze the frame image + node tree and propose annotations. Specs are stored in the file and can be exported for engineers.  
Future versions will add Headings, Landmarks, Alt-Text, and ARIA/React Native props.

---

## Goals
- Save designers ≥60% time on annotations.  
- ≥70% of proposed annotations accepted as-is.  
- Preserve manual edits across re-runs.  
- Provide JSON + Markdown export for engineers.  

---

## Scope
**In scope (v1):**
- Select frame/component → Propose Focus Order.  
- Heuristics propose initial order.  
- Review, edit, reorder, delete items in sidebar.  
- Paste annotated duplicate with numbered chips.  
- Persist spec in frame pluginData.  
- Platform toggle (Web vs React Native, placeholder).  

**Deferred (future):**
- AI backend integration (ChatGPT Vision).  
- JSON + Markdown export.  
- Batch processing of multiple frames.  
- Headings, Landmarks, Alt-Text.  
- Platform-specific attributes (ARIA / RN props).  
- Testing tools (contrast, touch targets).  

---

## Users
- **Designers**: create and verify annotations.  
- **Engineers**: consume exports for implementation.  
- **Accessibility reviewers**: check flows quickly.  

---

## User Stories
1. Designer selects a frame and clicks “Propose annotations.”  
2. Plugin proposes focus order (heuristics first, later AI).  
3. Designer edits/reorders/deletes items.  
4. Designer clicks “Paste annotated frame” → duplicate with numbered chips is created.  
5. Engineer later receives JSON/Markdown spec with nodeId + index (v1.1).  

---

## Functional Requirements
1. **Propose annotations**  
   - Export nodeTree.  
   - Heuristics: order by y → x, filter invisible/small targets.  
   - Later: send PNG@2x + nodeTree to backend AI, merge results.  
   - Merge order: manual > ai > heuristic.  
   - Show list in sidebar.  

2. **Review/Edit**  
   - Sidebar list with drag-reorder, inline rename, delete.  
   - Persist edits in pluginData.  

3. **Paste annotated frame**  
   - Duplicate original frame.  
   - Draw numbered chips in overlay group `A11Y_ANNOTATIONS_{frameId}/Focus`.  

4. **Persistence**  
   - Save spec JSON on original frame with `setPluginData`.  
   - Store platform profile in `clientStorage`.  

5. **Export (future)**  
   - JSON schema with nodeId, index, name, source.  
   - Markdown table for engineers.  

---

## Non-Functional Requirements
- Performance: ≤12s propose, ≤2s paste.  
- Privacy: optional redaction before AI upload.  
- Reliability: heuristics-only fallback if AI fails.  
- Usability: clear, simple flow.  

---

## Metrics
- Proposal acceptance ≥70%.  
- Time saved ≥60%.  
- Edits preserved ≥90%.  

---

## Risks
- **AI hallucination** → enforce JSON schema, fallback to heuristics.  
- **NodeId changes** → fuzzy match by bounds + name.  
- **Overlay clutter** → single locked group.  

---

## Implementation Plan (staged PRs)

**PR1 – Scaffold plugin**  
- Files: manifest.json, controller.ts, ui/index.tsx, types.ts.  
- Sidebar opens with header “A11y Annotations”.  

**PR2 – Selection + extraction**  
- Add selection guard.  
- Extract nodeTree from frame.  
- Export PNG@2x (not used yet).  

**PR3 – Heuristics order**  
- Implement heuristics.ts (y→x ordering, hit-target filter).  
- On “Propose”, display ordered list in console/log.  

**PR4 – UI list + reorder**  
- Render focus list in UI.  
- Enable drag-reorder (SortableJS).  
- Inline rename and delete.  

**PR5 – Paste annotated frame (overlays)**  
- Implement overlay.ts.  
- Duplicate frame, draw numbered chips in locked group `A11Y_ANNOTATIONS_{frameId}/Focus`.  

**PR6 – Persistence + merge**  
- Implement spec.ts.  
- Save spec in pluginData.  
- Merge manual > heuristic.  
- Platform toggle saved in clientStorage.  

**PR7 – Backend stub + API wire (optional)**  
- Add server with /annotate endpoint returning empty focus array.  
- Plugin POSTs image + nodeTree successfully.  

**PR8 – AI integration (ChatGPT Vision)**  
- Server calls OpenAI API with PNG + nodeTree.  
- Returns nodeId-keyed JSON.  
- Plugin merges AI results with heuristics + manual.  

**Future PRs**  
- Add Headings, Landmarks, Alt-Text.  
- Add exports (JSON/Markdown).  
- Add ARIA / RN platform props.  
- Add batch frame support.  

---

## UML

### Component Diagram
```plantuml
@startuml
skinparam componentStyle rectangle
component "Figma Plugin UI" as UI
component "Plugin Controller" as CTRL
component "Heuristics Engine" as HEUR
component "Backend API" as API
component "OpenAI (ChatGPT Vision)" as AI

UI --> CTRL
CTRL --> HEUR
CTRL --> API
API --> AI
AI --> API
API --> CTRL
CTRL --> UI
CTRL --> Figma
@enduml


@startuml
actor Designer
participant UI
participant CTRL
participant HEUR
participant API
participant AI
participant Figma

Designer -> UI: Click Propose
UI -> CTRL: PROPOSE
CTRL -> Figma: Export nodeTree (+ PNG@2x later)
CTRL -> HEUR: Compute heuristic order
CTRL -> API: POST /annotate (future AI)
API -> AI: Call ChatGPT Vision
AI --> API: JSON { focus[], warnings[] }
API --> CTRL: JSON
CTRL -> CTRL: Merge manual > ai > heuristic
CTRL -> UI: Show focus list

Designer -> UI: Edit / Reorder
Designer -> UI: Click Paste
UI -> CTRL: PASTE
CTRL -> Figma: Duplicate frame + draw numbered chips
@enduml


@startuml
class A11ySpec {
  v: string
  platform: "web"|"react-native"
  updatedAt: number
  focus: FocusItem[]
}

class FocusItem {
  nodeId: string
  idx: int
  name: string
  source: "manual"|"ai"|"heuristic"
}

A11ySpec "1" o-- "*" FocusItem
@enduml

---

# Focus Order: Frame-Scoped Behavior (v1.3)

## Goal
When the user clicks Propose Focus Order, the plugin generates an annotation scoped strictly to the selected frame's node tree and attaches it to that frame only.

## Functional requirements

1. **Scoped parsing**: Only nodes within the selected frame are analyzed (no global page scan).
2. **Determinism**: Same node tree → same order. Different tree → different order.
3. **Focusable detection**
   - **Web (ARIA)**: include button, a[href], input, select, textarea, [role] focusables, [tabindex>=0], and any node explicitly tagged as focusable via plugin metadata.
   - **React Native**: include nodes intended to render as Pressable/Button/Touchable, inputs, tabs, plus nodes tagged accessible=true via plugin metadata.
4. **Roles**: Each focus item returns a role string (button, link, textbox, tab, menuitem, landmark, etc.).
5. **Empty state**: If a frame has no focusables, return "No focusable elements in this selection."
6. **Attachment**: Annotation stores: frameId, frameName, ISO timestamp, nodeTreeChecksum, platform, and ordered items.
7. **Traceability**: Response includes checksum = sha256(normalizedNodeTree) (ids removed).
8. **Platform toggle**: Web(ARIA) vs React Native affects role mapping and heuristics.
9. **Safety rails**: If payload exceeds server limit, front end sends a summarized tree (name/type/role/focusable) and displays a toast.

## Non-functional

- **Latency**: < 2.0s for ≤300 nodes; < 5.0s for ≤1500 nodes.
- **Caching**: Server caches by (platform, checksum) for 15 minutes.
- **Telemetry**: Log (frameId, nodeCount, focusableCount, checksum, ms, cacheHit).

## Acceptance tests

- Selecting a header-only subframe yields 1–3 header items; selecting the full screen yields a longer ordered list including list items and CTAs.
- Toggling a single button changes checksum and output.
- A frame with no focusables returns the empty-state message.