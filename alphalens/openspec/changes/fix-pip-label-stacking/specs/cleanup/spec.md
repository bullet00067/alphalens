## Requirements

### Requirement: Declarative Marker Rendering
The system MUST use `series.setMarkers()` to update markers. This API ensures that the markers on the chart ALWAYS match the provided array, with no residual markers from previous calls.

### Requirement: No Persistent Labels
- WHEN the cursor is NOT over a PIP marker, the chart SHALL NOT display any "P: $... | V: ..." labels.
- WHEN the cursor moves from marker A to marker B, marker A's label SHALL disappear immediately.
