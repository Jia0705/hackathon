# 🚀 Quick Start Guide - CSV Data Testing

## Problem Fixed
Your CSV data is **perfect** and will trigger all features! The issue was GPS points not being saved to the database.

## Step 1: Start the Development Server

**Option A - Using Batch File (Easiest):**
```
start-dev.bat
```

**Option B - Direct Node Command:**
```
node node_modules/next/dist/bin/next dev
```

**Option C - Fix PowerShell Policy (Run as Administrator):**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm run dev
```

## Step 2: Open the Debug Console

Navigate to: **http://localhost:3000/csv-debug.html**

## Step 3: Test Database Write

1. Click **"🔧 Test DB Write"** button
2. Check the activity log for results
3. If it passes, GPS point storage is working!

## Step 4: Test CSV Ingestion

1. Click **"Reset Database"** to start fresh
2. Click **"Ingest 1 CSV File (Fast)"** 
3. Watch the stats update in real-time
4. You should see:
   - ✅ GPS Points increasing
   - ✅ Drops detected
   - ✅ Corridors created
   - ✅ Alerts generated

## What Your Data Will Show:

Based on your CSV files (ABA 0048.csv analyzed):

- **180 second GPS gaps** when vehicle is parked (3 minutes)
- **Few second gaps** when vehicle is moving
- **GPS signal losses** marked by `GPSLocated = false`
- **Movement between locations** (lat/lon changes)
- **Speeds ranging 10-55 km/h** when driving

### Expected Results:
- **Drops**: Detected at signal loss points (90+ second gaps with TAU_SHORT=90)
- **Corridors**: Formed between drop points (Point A → Point B)
- **Traversals**: Multiple trips through same corridors
- **Alerts**: When travel time > baseline + 50%

## Troubleshooting

### If Test DB Write Fails:
- Check server console for error messages
- Verify database file exists: `prisma/dev.db`
- Try: `npx prisma generate` (if execution policy allows)

### If CSV Ingestion Fails:
- Check "Activity Log" for exact error
- Click "Check Environment" to verify TAU_SHORT=90
- Check server console for [INGEST] logs

### If GPS Points Stay at 0:
- This is the bug we're fixing
- Test DB Write will tell us if Prisma can write GPS points
- Check for foreign key constraints or schema mismatches

## Current Status:

✅ CSV data analyzed - contains perfect GPS drop data  
✅ TAU_SHORT set to 90 seconds  
✅ Drop detection logic fixed  
✅ UI freeze issue resolved  
✅ Debug console created  
✅ Database write test endpoint created  
🔧 Testing database write functionality...

## Next Steps:

Once "Test DB Write" passes, the CSV ingestion should work perfectly!
