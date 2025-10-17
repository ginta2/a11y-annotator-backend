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
