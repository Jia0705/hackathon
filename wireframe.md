# GPS Stability & Corridor Intelligence — UX Flow and ASCII Wireframes

This document defines the end-to-end UX flow, key screens, and screen content using ASCII wireframes to accelerate implementation and alignment during the hackathon.

---

## UX flow map

```
          ┌───────────────────┐
          │  App Launch       │
          └────────┬──────────┘
                   │
                   v
        ┌─────────────────────────┐
        │ Dashboard (Map)         │
        │ - Heatmap layer (H3)    │
        │ - Filters & controls    │
        │ - Live Alerts panel     │
        └───────┬───────┬────────┘
                │       │
        Corridors List   │
                │       │
                v       v
        ┌─────────────────────────┐
        │ Corridors (Table)       │
        │ - Stats & deviations    │
        │ - Sort/filter           │
        └───────┬────────┬────────┘
                │        │
       Corridor Detail   │
        (Modal/Sheet)    │
                │        │
                v        │
        ┌─────────────────────────┐
        │ Corridor Detail Modal   │
        │ - A→B info, baseline    │
        │ - History & alerts      │
        └──────────┬──────────────┘
                   │
                   v
        ┌─────────────────────────┐
        │ Simulator Panel (opt.)  │
        │ - Replay speed          │
        │ - File selection        │
        └─────────────────────────┘
```

Key flows:
- Map-first exploration -> Filter -> Inspect alert -> Zoom to corridor -> Open details
- Data-first exploration -> Corridors List -> Sort by deviation -> Inspect details -> Pan to map

---

## Global navigation (header)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Logo  |  Dashboard  |  Corridors  |  Alerts  |  (Settings)      [Now/UTC]   │
│──────────────────────────────────────────────────────────────────────────────│
│ Global Filters: [Time Window ▼] [Vehicle(s) ▼] [Thresholds ⚙] [Replay ▶]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Notes:
- "Replay" opens simulator (optional sheet).
- "Thresholds" opens a settings modal to tweak τ_short, delay threshold, overspeed sensitivity.

---

## Screen 1 — Dashboard (Map)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header / Global Nav                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filters                                                                       │
│ [Time: Last 24h ▼] [Vehicles: All ▼] [τ_short: 60s] [Delay: 15m] [SSE: ON]   │
├─────────────────────────────┬─────────────────────────────────────────────────┤
│ Left Panel                  │                                                 │
│ - Legend (Instability)      │                 MAP (MapLibre)                 │
│ - Layer Toggles:            │     [H3 Heatmap polygons, corridor overlays]   │
│   [x] H3 Heatmap            │                                                 │
│   [ ] Corridors             │                                                 │
│ - Hex Res: [7 ▼]            │                                                 │
│ - Instability Min: [0.2]    │                                                 │
│ - Basemap: [OSM ▼]          │                                                 │
├─────────────────────────────┼─────────────────────────────────────────────────┤
│ Alerts (Right Panel)        │                                                 │
│ ┌─────────────────────────┐ │                                                 │
│ │ LIVE ALERTS             │ │                                                 │
│ │ ▸ 12:41 Delay A→B +18m │ │  - Clicking an alert pans/zooms to A/B.        │
│ │ ▸ 12:39 Overspeed A→B  │ │  - Hovering hex shows instability metrics.     │
│ │ ▸ 12:33 Delay A→B +16m │ │  - Click corridor overlay opens details modal. │
│ └─────────────────────────┘ │                                                 │
└─────────────────────────────┴─────────────────────────────────────────────────┘
```

States:
- Loading: dimmed map with skeletons; alerts panel shows spinner
- Empty: "No data in selected window" + link to widen time window
- Live: SSE badge ON; toasts on first alert

---

## Screen 2 — Corridors (Table)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header / Global Nav                                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ Filters: [Time ▼] [Vehicles ▼] [Sort: Deviation ▼] [Search corridor]         │
├──────────────────────────────────────────────────────────────────────────────┤
│ A→B (H3)     | Count | Median T | P95 Speed | Live Δ   | Last Seen | Actions │
│──────────────┼───────┼──────────┼───────────┼──────────┼───────────┼─────────│
│ r7:abc→def ↗ |  124  | 00:07:30 |  62 km/h  | +00:18:00| 12:41 UTC | View ▶  │
│ r7:ghi→jkl ↘ |   52  | 00:04:10 |  55 km/h  |  -       | 12:32 UTC | View ▶  │
│ ...                                                                               
└──────────────────────────────────────────────────────────────────────────────┘
```

Interactions:
- Click "View" -> opens Corridor Detail Modal and pans map to A/B
- Sort by Deviation/Count/Median; filter by vehicle/time

---

## Screen 3 — Corridor Detail (Modal/Sheet)

```
┌────────────────────────────────────────────────────────────┐
│ Corridor A→B (r7:abc→def, ↗)                               │
│────────────────────────────────────────────────────────────│
│ Summary                                                    │
│ - Median Travel: 00:07:30 (12–13h bucket)                 │
│ - P95 Speed: 62 km/h                                      │
│ - Traversals: 124                                         │
│ - Current Live: +00:18:00 delay (severity: high)          │
│                                                            │
│ Mini-map (A and B pins, line, last traversals)            │
│                                                            │
│ History                                                    │
│ - Hourly medians (sparkline)                              │
│ - Recent traversals table                                 │
│   ts_start | ts_end | T | v_avg | alert?                  │
│                                                            │
│ Actions:  [Focus on Map]  [Copy corridor ID]  [Close]     │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 4 — Alerts (Feed)

```
┌────────────────────────────────────────────────────────────┐
│ Alerts                                                     │
│────────────────────────────────────────────────────────────│
│ [SSE: ON] [Filter: type ▼] [Clear]                        │
│                                                            │
│ 12:41  Delay  A→B r7:abc→def  +18m  (veh ABA 0048)        │
│ 12:39  Speed  A→B r7:ghi→jkl  >P95 (68 km/h)              │
│ 12:33  Delay  A→B r7:mno→pqr  +16m                         │
│                                                            │
│ Click row: pan map + open detail modal                     │
└────────────────────────────────────────────────────────────┘
```

---

## Screen 5 — Settings / Thresholds (Modal)

```
┌───────────────────────────────────────────┐
│ Settings                                  │
│───────────────────────────────────────────│
│ τ_short (micro-drop)   [ 60 s ]           │
│ Delay threshold        [ 15 min ]         │
│ Overspeed sensitivity  [ P95 ]            │
│ H3 resolution          [ 7 ]              │
│ Timezone               [ UTC ]            │
│                                             
│ [Reset Defaults]              [Save] [X]  │
└───────────────────────────────────────────┘
```

---

## Screen 6 — Simulator Panel (Optional Sheet)

```
┌────────────────────────────────────────────────────────────┐
│ Simulator                                                  │
│────────────────────────────────────────────────────────────│
│ Dataset files: [ABA 0048.csv] [ABA 0319.csv] [...]         │
│ Replay speed:  [ 1× ] [ 10× ] [ 60× ]                      │
│ Trip gap (min): [ 20 ]                                     │
│                                                            │
│ [▶ Start Replay]  [■ Stop]  [⟲ Reset]                      │
│                                                            │
│ Log:                                                       │
│ - 12:30 Ingested 250 points (veh ABA 0048)                 │
│ - 12:31 Detected drop A→B (78s)                            │
└────────────────────────────────────────────────────────────┘
```

---

## Interaction details & states

- Map interactions:
  - Click hex -> tooltip: short/long counts, instability score, traversals
  - Toggle layers (heatmap/corridors) to reduce clutter
  - Zoom-to-fit on alert/corridor selection

- Empty states:
  - No data in time window: suggest widening window
  - No alerts: show calm state + bell icon

- Loading states:
  - Skeletons for table rows and side panels
  - SSE badge shows connecting/connected/reconnecting

- Error states:
  - SSE disconnect -> auto retry with exponential backoff
  - API failures -> toast + retry button

---

## Implementation notes

- Use existing shadcn/ui components (table, sheet, modal, tabs, badge, toast)
- MapLibre: polygon layer for H3 hexes; color ramp by instability score
- H3 label rendering: optional; rely on hover tooltips for clarity
- Accessibility: keyboard navigation for table; focus trap in modals
