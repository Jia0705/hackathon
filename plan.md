# GPS Stability and Corridor Intelligence — Implementation Plan

We'll build a Next.js Admin Dashboard with MapLibre + OSM that ingests/replays CSV GPS data, detects unstable GPS regions, and learns weak-signal "corridors" between the last strong fix (A) and the next stable fix (B). Using H3 hex tiling, we'll render a stability heatmap and compute corridor baselines (median travel time by hour of day). Live traversals are compared against baselines to generate SSE-powered alerts for delays (≥15 min) and overspeed (above corridor P95), while ignoring micro-drops under 60s. Storage will be SQLite via Prisma for speed, with a local demo deployment. The UI shows the map, corridor performance, and a live alert feed with tunable controls.

---

## 1) Decisions locked

- Map: MapLibre GL + OpenStreetMap (no token)
- Data store: SQLite via Prisma
- Real-time transport: Server-Sent Events (SSE)
- Ingestion: Replay local CSVs from `dataset/`
- Micro-drop threshold τ_short: 60 seconds
- Baseline granularity: Hour-of-day buckets (fallback to global median)
- Overspeed heuristic: Above corridor P95 of historical average speed
- Corridor identity: H3 pair [H3(A), H3(B)] with direction
- Heatmap aggregation: H3 hexes
- Alerts delivery: In-app feed only
- Deployment: Local demo
- Dataset: timestamp, lat, lon, per-file vehicle id (uncleaned); speed/accuracy may be present
- Timezone: Assume UTC
- Privacy: No anonymization

---

## 2) System architecture

High-level dataflow:

```
CSV Files -> Simulator -> /api/ingest -> SQLite (Prisma)
                                   |-> Drop Detection + Corridor Extraction
                                   |-> Baseline Updater (hour-of-day)
                                   |-> H3 Stability Aggregation
                                   |-> Alert Engine -> /api/alerts/stream (SSE)

Next.js App -> Map (MapLibre) -> /api/heatmap (GeoJSON)
             -> Corridors Table -> /api/corridors
             -> Alerts Feed     -> /api/alerts/stream
```

Components:

- Frontend (Next.js): Map view (heatmap + overlays), Corridors table, Alerts feed, filters/controls
- Backend (API routes): ingest, heatmap, corridors, alerts stream
- Processing jobs: drop detection, corridor extraction, baseline computation, H3 aggregation
- Storage: SQLite (Prisma models, targeted indexes)

---

## 3) Data model (schema outline)

Core tables (field types indicative):

- Vehicle(id, name, meta)
- Trip(id, vehicleId, startTime, endTime, source)
- GPSPoint(id, tripId, ts, lat, lon, speed?, accuracy?, heading?, rawMeta?)
  - Indexes: (tripId, ts), (ts), optional spatial index later
- Drop(id, tripId, startTs, endTs, startLat, startLon, endLat, endLon, durationSec, reason)
- Corridor(id, aH3, bH3, direction, createdAt)
  - Unique(aH3, bH3, direction)
- CorridorStats(id, corridorId, bucketHour (0–23), count, medianTravelSec, p95SpeedKmh, updatedAt)
- Traversal(id, corridorId, tripId, startTs, endTs, travelSec, avgSpeedKmh)
- Alert(id, type (delay|overspeed), corridorId, tripId, vehicleId, severity, deltaValue, createdAt, resolvedAt?)

Retention (hackathon): keep all data. Optional pruning of old GPSPoints.

---

## 4) Algorithms

1) Strong vs weak fix classification
- Strong fix: accuracy ≤ 30m if present; else inferred from cadence and continuity
- Weak: accuracy > 30m or missing for extended time; or time gap > τ_short

2) Drop detection
- For each trip, track time since last strong fix A
 - Prefer gpsLocated=false to mark weak periods; otherwise infer a drop when gap > 2× the trip’s modal sampling interval
 - If gap ≤ 60s (τ_short), treat as a micro-drop (no alert) and contribute to the stability score

3) Corridor identification
- A = last strong fix; B = next strong fix
 - corridorKey = [H3(A,7), H3(B,7), direction]
 - direction: bearing bucket (16-way, every 22.5°, via turf.bearing)
- Traversal: travelSec = tB - tA; distance = turf.distance(A,B); avgSpeedKmh = distance_km / (travelSec/3600)

4) Baseline computation (per corridor)
- Bucket by hour-of-day from traversal midpoint or start
- medianTravelSec = median of travelSec in bucket; fallback to corridor global median if insufficient samples (Nmin ≈ 5)
- p95SpeedKmh = P95 of avgSpeedKmh for the corridor (global or per bucket if enough samples)

5) Stability heatmap (H3)
- Count micro-drops and long-drops per hex; optionally attribute along A→B line (sampled points)
- Instability score per hex: S_h = (w_short·countShort + w_long·countLong) / max(1, traversals)
  - Start with w_short=1, w_long=3; tune as needed

6) Alerting
- Delay: Δ = T_live - baselineMedian ≥ 900s (15 min) -> alert
- Overspeed: v_avg > corridor p95SpeedKmh -> alert
- Dedupe per (tripId, corridorId) unless severity escalates

---

## 5) API contracts

- POST `/api/ingest`
  - Body: { vehicleId, tripId?, ts (ISO), lat, lon, speed?, accuracy?, heading? }
  - Response: { ok: true }
  - Behavior: auto-trip segmentation if gap > 20 minutes

- GET `/api/heatmap?h3res=7&from=ISO&to=ISO`
  - Returns GeoJSON FeatureCollection of hexes with properties: { instability, shortCount, longCount, traversals }

- GET `/api/corridors?from=ISO&to=ISO&sort=deviation|count|median`
  - Returns: [{ corridorId, aH3, bH3, direction, count, medianSec, p95SpeedKmh, lastSeen, deviationLive? }]

- GET `/api/alerts/stream`
  - SSE events: { id, type, time, corridorId, tripId, vehicleId, severity, details }
  - Supports Last-Event-ID to resume missed alerts on reconnect

---

## 6) Ingestion simulator

- Reads CSV files in `dataset/`
- Column mapping heuristics:
  - Timestamp: [timestamp, time, ts, recorded_at]
  - Latitude: [lat, latitude]
  - Longitude: [lon, lng, longitude]
  - Speed (optional): [speed, spd]
  - Accuracy (optional): [accuracy, hdop, eph, gps_acc]
- Vehicle identity: inferred from file name like `ABA 0048.csv` unless column exists
- Rate control: 1× real-time and fast-forward (10×/60×)
- Trip segmentation: new trip if gap > 20 min or day boundary

---

## 7) UI plan

 - Map screen: MapLibre heatmap (H3 instability), corridor overlays (top corridors by count and last N traversals), filters (time window, thresholds, vehicles), right-side alerts panel
- Corridors list: sortable table with A→B label, count, median T, P95 speed, live deviation, last seen
- Alerts panel: live SSE feed; click-to-zoom to A/B on map
- Controls: τ_short (60s default), delay threshold (15m), overspeed sensitivity, time window, vehicle filters

---

## 8) Execution timeline (24 hours)

- 0–2h: Prisma models, simulator skeleton
- 2–6h: Drop detection + corridor extraction; /api/heatmap (H3 aggregation)
- 6–10h: Baselines (hour-of-day) + p95 speed; /api/corridors
- 10–14h: Real-time comparator; /api/alerts/stream (SSE) + dedupe
- 14–20h: Frontend map + corridors table + alerts feed
- 20–24h: End-to-end replay + tuning + polish

---

## 9) Testing & quality gates

 Performance: indexes on (tripId, ts) and corridorId; batch inserts; target scope is all vehicles and full history—use batched ingestion, server-side aggregation, and response caching

---

## 10) Libraries

- maplibre-gl, h3-js, @turf/turf
- csv-parse, date-fns or dayjs, zod
- prisma, @prisma/client

---

## 11) Risks & mitigations

- Sparse data -> fallback to global median
- No accuracy field -> cadence/continuity heuristics
- Overspeed false positives -> use robust P95 threshold
- Visualization performance -> pre-aggregate H3 per time window

---

## 12) Next steps

- Implement Prisma schema and migrations
- Implement ingestion simulator and normalize columns
- Build drop/corridor pipeline and endpoints
- Wire frontend map/table/alerts
