# GPS Stability & Corridor Intelligence System

## Setup Instructions

### 1. Fix PowerShell Execution Policy (Required)

The system is currently blocked from running npm commands. Fix this by running:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then confirm with `Y` when prompted.

### 2. Install Dependencies

```bash
npm install --save-dev prisma
npm install @prisma/client maplibre-gl h3-js @turf/turf @turf/distance @turf/bearing csv-parse dayjs
```

### 3. Initialize Database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Architecture Overview

### Backend (API Routes)

- `POST /api/ingest` - Ingest GPS data points, detect drops, extract corridors
- `GET /api/heatmap` - Get H3 instability heatmap as GeoJSON
- `GET /api/corridors` - Get corridor list with stats and deviations
- `GET /api/alerts/stream` - SSE stream for real-time alerts
- `POST /api/simulator/start` - Start CSV replay simulation
- `GET /api/simulator/status` - Get simulator status

### Core Libraries

- `lib/gps-processing.ts` - Drop detection, corridor extraction, GPS classification
- `lib/baseline-computation.ts` - Hour-of-day baselines, P95 calculations
- `lib/alert-service.ts` - Alert generation and emission
- `lib/prisma.ts` - Database client singleton

### Database Schema (Prisma/SQLite)

- **Vehicle** - Vehicle identity
- **Trip** - Trip segments (auto-segmented by 20min gaps)
- **GPSPoint** - Raw GPS points
- **Drop** - Detected signal drops (weak_signal, long_gap, micro_drop)
- **Corridor** - H3 hex pair corridors with direction
- **CorridorStats** - Baselines (hourly + global median travel time, P95 speed)
- **Traversal** - Individual corridor traversals
- **Alert** - Delay and overspeed alerts

### Key Algorithms

1. **Drop Detection** - Identifies gaps >τ_short (60s) between GPS fixes
2. **Corridor Identification** - Maps drops to [H3(A), H3(B), direction] corridors
3. **Baseline Computation** - Calculates hour-of-day medians with global fallback
4. **Alert Generation** - Compares live traversals against baselines:
   - Delay: Δ ≥ 15 minutes
   - Overspeed: v > corridor P95

### Configuration (.env)

```env
DATABASE_URL="file:./dev.db"
TAU_SHORT=60                  # Micro-drop threshold (seconds)
DELAY_THRESHOLD_MINUTES=15    # Delay alert threshold
H3_RESOLUTION=7               # H3 hex resolution
```

## CSV Simulator

The simulator reads CSV files from `public/dataset/` and replays them at configurable speeds:

- Automatically maps columns (timestamp, lat, lon, speed, accuracy)
- Extracts vehicle ID from filename (e.g., "ABA 0048.csv")
- Segments trips on 20-minute gaps
- Supports replay speeds: 1×, 10×, 60×

## Frontend Components (To Be Implemented)

Based on wireframes in `wireframe.md`:

### Dashboard (Main View)
- MapLibre map with H3 heatmap layer
- Live alerts panel (SSE-connected)
- Global filters (time window, vehicles, thresholds)
- Corridor overlays

### Corridors Table
- Sortable/filterable table
- Shows A→B, count, median travel time, P95 speed, live deviation
- Click-to-view opens detail modal

### Corridor Detail Modal
- Summary stats and mini-map
- History sparkline
- Recent traversals table

### Simulator Control Panel
- File selection
- Replay speed control
- Playback controls (start/stop/reset)

### Settings Modal
- Threshold configuration
- H3 resolution
- Alert sensitivity

## Data Flow

```
CSV Files
  ↓
Simulator → POST /api/ingest
  ↓
Drop Detection → Corridor Extraction → Baseline Update
  ↓
Alert Engine → SSE Stream → Frontend
  ↓
MapLibre (Heatmap) + Alerts Panel
```

## Development Status

✅ Backend Core
- [x] Prisma schema
- [x] GPS processing algorithms
- [x] Baseline computation
- [x] API endpoints (ingest, heatmap, corridors, alerts/stream)
- [x] Alert service with SSE

⏳ To Complete
- [ ] CSV simulator API endpoint
- [ ] Frontend map component
- [ ] Corridors table component
- [ ] Alerts panel component
- [ ] Corridor detail modal
- [ ] Simulator UI controls
- [ ] Settings modal
- [ ] Loading/empty states
- [ ] End-to-end testing

## Next Steps

1. Run the setup commands above
2. Implement CSV simulator API endpoint
3. Build frontend components following wireframes
4. Test with dataset files
5. Tune thresholds and performance

## Technologies

- **Framework**: Next.js 16 with App Router
- **Database**: SQLite via Prisma
- **Maps**: MapLibre GL + OpenStreetMap
- **Geospatial**: H3-js (hex tiling), Turf.js (distance/bearing)
- **Real-time**: Server-Sent Events (SSE)
- **UI**: Shadcn/UI components (Radix UI + Tailwind)
- **Data Processing**: csv-parse, dayjs

## Notes

- All timestamps are in UTC
- H3 resolution 7 (~5km² per hex) balances detail vs performance
- Baselines require minimum 5 samples per hour-of-day bucket
- Alert deduplication prevents duplicate alerts for same trip+corridor
- SSE supports Last-Event-ID for reconnection handling
