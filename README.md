# GPS Stability & Corridor Intelligence System

A real-time GPS stability monitoring and corridor intelligence system that detects signal drops, learns corridor patterns, and generates intelligent alerts for transportation anomalies.

![System Status](https://img.shields.io/badge/status-ready-success)
![Implementation](https://img.shields.io/badge/implementation-100%25-brightgreen)

## 🚀 Quick Start

### Automated Setup (Recommended)

**Windows PowerShell:**
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\setup.ps1
```

**Linux/Mac/WSL:**
```bash
chmod +x setup.sh
./setup.sh
```

### Manual Setup

```bash
# 1. Install dependencies
npm install --save-dev prisma
npm install @prisma/client maplibre-gl h3-js @turf/turf @turf/distance @turf/bearing csv-parse dayjs

# 2. Setup database
npx prisma generate
npx prisma migrate dev --name init

# 3. Start server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000)

## 📖 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 5 minutes
- **[SETUP.md](SETUP.md)** - Detailed setup instructions
- **[IMPLEMENTATION.md](IMPLEMENTATION.md)** - Complete system overview
- **[CHECKLIST.md](CHECKLIST.md)** - Verification checklist
- **[plan.md](plan.md)** - Original design document
- **[wireframe.md](wireframe.md)** - UI/UX specifications

## ✨ Features

### Core Capabilities
- 🎯 **Drop Detection** - Automatic GPS signal loss detection with τ_short=60s threshold
- 🗺️ **Corridor Learning** - Intelligent corridor identification using H3 spatial indexing
- ⏰ **Baseline Computation** - Hour-of-day travel time baselines with global fallback
- 🚨 **Real-time Alerts** - Delay (≥15min) and overspeed (>P95) alerts via SSE
- 📊 **Instability Heatmap** - Interactive H3 hex visualization of GPS instability
- 🎮 **CSV Simulator** - Replay GPS data at 1×, 10×, or 60× speed

### Dashboard UI
- **Map View** - MapLibre GL map with colored instability heatmap
- **Corridors Table** - Sortable/filterable corridor analytics
- **Live Alerts Panel** - Real-time SSE-powered alerts feed
- **Simulator Controls** - Playback controls with progress tracking
- **Time Filters** - 1h, 6h, 24h, 7d, all-time windows

## 🏗️ Architecture

### Backend APIs
```
/api/ingest           - GPS data ingestion & processing
/api/heatmap          - H3 instability heatmap (GeoJSON)
/api/corridors        - Corridor list with stats & deviations
/api/alerts/stream    - Real-time SSE alerts
/api/simulator/start  - Start CSV replay
/api/simulator/status - Simulator status & control
```

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: SQLite + Prisma ORM
- **Maps**: MapLibre GL + OpenStreetMap
- **Geospatial**: H3-js (hex tiling), Turf.js (calculations)
- **Real-time**: Server-Sent Events (SSE)
- **UI**: Shadcn/UI (Radix + Tailwind CSS)

### Data Flow
```
CSV Files → Simulator → /api/ingest → Drop Detection → 
Corridor Extraction → Baseline Update → Alert Engine → 
SSE Stream → Frontend
```

## 📊 Database Schema

- **Vehicle** - Vehicle identity and metadata
- **Trip** - Auto-segmented trips (20-minute gap threshold)
- **GPSPoint** - Raw GPS coordinates with timestamps
- **Drop** - Detected signal drops (micro/long/weak)
- **Corridor** - H3 hex pair corridors with 16-way direction
- **CorridorStats** - Baselines (hourly + global medians, P95 speeds)
- **Traversal** - Individual corridor traversals with metrics
- **Alert** - Delay and overspeed alerts with severity levels

## 🎮 Usage

1. **Start the simulator** - Select replay speed and click "Start Replay"
2. **Monitor alerts** - Watch real-time alerts appear in the right panel
3. **Explore corridors** - Sort by deviation, count, or median time
4. **View heatmap** - Hover over hexes to see instability scores
5. **Filter data** - Change time window to focus on specific periods

## ⚙️ Configuration

Edit `.env` to customize thresholds:

```env
DATABASE_URL="file:./dev.db"
TAU_SHORT=60                    # Micro-drop threshold (seconds)
DELAY_THRESHOLD_MINUTES=15      # Delay alert threshold
H3_RESOLUTION=7                 # H3 hex resolution (~5km²)
```

## 📁 Dataset

Place CSV files in `public/dataset/` with columns:
- Timestamp (timestamp, time, ts, recorded_at)
- Latitude (lat, latitude)
- Longitude (lon, lng, longitude)
- Speed (optional)
- Accuracy (optional)
- Heading (optional)

Vehicle ID extracted from filename (e.g., "ABA 0048.csv").

## 🔬 Algorithms

### Drop Detection
Identifies GPS signal gaps >60 seconds using adaptive modal interval detection.

### Corridor Identification  
Maps drops to [H3(A), H3(B), direction] corridors using hex pairs and 16-way bearing buckets.

### Baseline Computation
Calculates hour-of-day median travel times with minimum 5 samples per bucket.

### Alert Generation
Compares live traversals against baselines:
- **Delay**: Δ ≥ 15 minutes
- **Overspeed**: v > corridor P95 speed

## 📈 Performance

- Batch GPS point insertion for efficiency
- Indexed queries on (tripId, ts), (corridorId), (createdAt)
- Response caching on heatmap endpoint (60s)
- SSE with reconnection support and Last-Event-ID

## 🧪 Testing

See [CHECKLIST.md](CHECKLIST.md) for complete verification steps.

## 📝 License

This project was created for the hackathon and is provided as-is.

## 🤝 Contributing

This is a hackathon project. See the implementation docs for architecture details.

---

**Built with ❤️ for the GPS Stability Hackathon**

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
