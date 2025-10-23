# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Fix PowerShell (Windows Only)
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```
Type `Y` when prompted.

### Step 2: Install Dependencies
```bash
npm install --save-dev prisma
npm install @prisma/client maplibre-gl h3-js @turf/turf @turf/distance @turf/bearing csv-parse dayjs
```

### Step 3: Setup Database
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### Step 4: Start Server
```bash
npm run dev
```

### Step 5: Open Dashboard
Visit: **http://localhost:3000**

---

## 🎮 Using the System

### Start Simulation
1. Look at the **Simulator** panel (bottom-right)
2. Select replay speed (1×, 10×, or 60×)
3. Click **Start Replay**
4. Watch the progress bar

### View Alerts
1. Check the **Live Alerts** panel (right side)
2. Should show "CONNECTED" badge
3. Alerts appear in real-time as delays/overspeeds are detected
4. Click an alert to see details

### Explore Corridors
1. Click the **Corridors** tab
2. Sort by Deviation, Count, or Median Time
3. Search for specific hex IDs
4. Click eye icon to view corridor details

### Check Heatmap
1. Click the **Map** tab
2. View colored hexagons (instability heatmap)
3. Hover over hexes for statistics
4. Click hexes for detailed info

### Change Time Window
1. Top-right dropdown: select time range
2. Options: Last Hour, 6 Hours, 24 Hours, 7 Days, All Time
3. Map and corridors update automatically

---

## 📂 Dataset Location

Place your CSV files in:
```
public/dataset/
  ├── ABA 0048.csv
  ├── ABA 0319.csv
  └── ... (30 files included)
```

The simulator will automatically find and process all `.csv` files.

---

## ⚙️ Configuration

Edit `.env` to change thresholds:

```env
DATABASE_URL="file:./dev.db"
TAU_SHORT=60                    # Micro-drop threshold (seconds)
DELAY_THRESHOLD_MINUTES=15      # Delay alert threshold
H3_RESOLUTION=7                 # H3 hex resolution
```

---

## 🐛 Troubleshooting

### "Cannot run npm"
- Run: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
- Then retry npm commands

### "Module not found"
- Make sure all dependencies are installed
- Run: `npm install` again

### "Prisma Client not found"
- Run: `npx prisma generate`

### "No alerts showing"
- Wait for simulator to process data
- Check SSE connection badge (should be "CONNECTED")
- Try refreshing the page

### "Map not loading"
- Check browser console for errors
- Ensure MapLibre GL CSS is loaded
- Check internet connection (OSM tiles)

---

## 📊 What to Expect

After starting the simulator:

1. **GPS Points ingested**: ~250 points/file
2. **Drops detected**: Gaps >60 seconds
3. **Corridors learned**: H3 hex pairs with direction
4. **Baselines computed**: Median travel times per hour
5. **Alerts generated**: Delays ≥15min or overspeeds
6. **Heatmap updates**: Every 60 seconds
7. **Corridors refresh**: Every 30 seconds

---

## 🎯 Key Metrics to Watch

- **Instability Score**: Higher = more GPS drops
- **Delay Alerts**: Travel time significantly above baseline
- **Overspeed Alerts**: Speed above corridor P95
- **Corridor Count**: Number of traversals
- **Median Travel Time**: Expected time for corridor
- **Live Deviation**: Current vs baseline comparison

---

## 📖 Full Documentation

- **IMPLEMENTATION.md**: Complete system overview
- **SETUP.md**: Detailed setup instructions
- **plan.md**: Original design document
- **wireframe.md**: UI/UX specifications

---

## 🎉 You're Ready!

The system is fully implemented and ready to use. Just follow the 5 steps above and start exploring GPS stability patterns!
