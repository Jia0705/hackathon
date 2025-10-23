# 🔧 Simulator & Alerts Troubleshooting Guide

## ✅ What Was Fixed

### 1. **Simulator UI**
- ✅ Updated info text to reflect actual processing (ingests all GPS points)
- ✅ Fixed TypeScript errors in page.tsx
- ✅ Clarified Fast Forward mode explanation

### 2. **Alerts System**
- ✅ Alerts panel uses Server-Sent Events (SSE) for real-time updates
- ✅ Auto-reconnects if connection drops
- ✅ Shows connection status badge

---

## 🧪 Testing the System

### Test 1: Check Alert Stream Connection

**Visit:** http://localhost:3000/alerts-test.html

This test page shows:
- ✅ SSE connection status
- ✅ Raw event log
- ✅ Alerts received count
- ✅ Recent alerts list

**Expected Result:**
```
[12:34:56] Connecting to /api/alerts/stream...
[12:34:56] ✅ SSE connection established
[12:34:56] ✅ Initial connection message received
```

---

### Test 2: Verify Data Flow

**Step 1: Open Control Panel**
http://localhost:3000/control-panel.html

**Step 2: Reset Everything**
1. Click "🗑️ Reset Database"
2. Click "🔄 Reset Simulator"

**Step 3: Open Alerts Test Page**
http://localhost:3000/alerts-test.html
(Keep this open in a separate tab)

**Step 4: Start Simulation**
Go back to: http://localhost:3000
1. Check Debug Panel shows 0 for everything
2. In Simulator panel: Select "First 5" files
3. Enable ✅ Fast Forward
4. Click "Start Replay"

**Step 5: Watch for Alerts**
Switch to the alerts-test.html tab and watch for:
- 🚨 Delay alerts (travel time > baseline)
- 🚨 Overspeed alerts (speed > P95)

---

## 🔍 Common Issues & Solutions

### Issue 1: Alerts Panel Shows "DISCONNECTED"

**Symptoms:**
- Red "DISCONNECTED" badge in alerts panel
- No alerts appearing

**Causes:**
- SSE endpoint not responding
- Server not running
- Browser blocking EventSource

**Solutions:**
1. Check dev server is running: `npm run dev`
2. Check browser console for errors
3. Test SSE endpoint directly: http://localhost:3000/api/alerts/stream
4. Try alerts test page: http://localhost:3000/alerts-test.html

---

### Issue 2: Simulator Not Starting

**Symptoms:**
- "Simulator is already running" error
- Start button disabled
- No progress

**Solutions:**
1. **Use Control Panel:**
   - Go to: http://localhost:3000/control-panel.html
   - Click "🔄 Reset Simulator"

2. **Or use Browser Console:**
   ```javascript
   fetch('/api/simulator/reset', { method: 'POST' })
     .then(r => r.json())
     .then(console.log);
   ```

3. **Check simulator status:**
   ```javascript
   fetch('/api/simulator/status')
     .then(r => r.json())
     .then(console.log);
   ```

---

### Issue 3: No Alerts Generated

**Symptoms:**
- Simulation completes successfully
- Corridors created (Debug Panel shows Corridors > 0)
- But no alerts appear

**Possible Causes:**
1. **No baselines yet** - First run creates baselines, second run compares
2. **Data is too consistent** - No deviations from baseline
3. **Thresholds too high** - Check environment variables

**Solutions:**

**A. Run simulation twice:**
```
1st run: Builds baselines
2nd run: Detects deviations and creates alerts
```

**B. Check baselines exist:**
```javascript
fetch('/api/db/stats')
  .then(r => r.json())
  .then(data => console.log('Baselines:', data.stats.corridorStats));
```

**C. Lower thresholds (optional):**
Edit `.env`:
```
DELAY_THRESHOLD_MINUTES=5    # Lower from 15 to 5
TAU_SHORT=30                  # Lower from 60 to 30
```

**D. Check alert creation in server logs:**
Look for in VS Code terminal:
```
[ALERT] Created delay alert for corridor...
[ALERT] Created overspeed alert for vehicle...
```

---

### Issue 4: Simulator Progress Stuck

**Symptoms:**
- Progress bar stops moving
- Status shows "Running" but no progress
- No console errors

**Solutions:**

1. **Check server logs** for errors
2. **Stop and restart:**
   - Click "Stop" button
   - Wait 3 seconds
   - Click "Start Replay" again

3. **Force reset if needed:**
   ```javascript
   // In browser console:
   fetch('/api/simulator/reset', { method: 'POST' });
   ```

---

## 📊 What to Expect (Normal Operation)

### During Simulation:
```
Debug Panel:
✅ GPS Points: 50,000+ (increasing)
✅ Drops: 49,000+ (increasing)
✅ Corridors: 800+ (increasing)
✅ Traversals: 800+ (increasing)
✅ Baselines: 850+ (after processing)

Simulator Panel:
✅ Progress: 45,678 / 50,000
✅ Progress bar filling up
✅ Current file showing
✅ Timestamp updating
```

### After First Simulation:
```
✅ Baselines created
❌ Few or no alerts (normal - no baseline to compare against)
```

### After Second Simulation:
```
✅ Baselines exist
✅ Alerts generated (delays, overspeeds)
✅ Heatmap showing instability
✅ Corridors showing deviations
```

---

## 🎯 Quick Checks

### Check SSE Connection
```javascript
// In browser console:
const es = new EventSource('/api/alerts/stream');
es.onmessage = e => console.log('Alert:', JSON.parse(e.data));
es.onerror = e => console.error('Error:', e);
```

### Check Database Stats
```javascript
fetch('/api/db/stats')
  .then(r => r.json())
  .then(console.log);
```

### Check Simulator Status
```javascript
fetch('/api/simulator/status')
  .then(r => r.json())
  .then(console.log);
```

### Manually Create Test Alert
```javascript
// This would need to be done server-side
// Just to test if SSE is working
```

---

## 🚀 Complete Test Workflow

1. **Open 3 tabs:**
   - Tab 1: http://localhost:3000 (main dashboard)
   - Tab 2: http://localhost:3000/control-panel.html
   - Tab 3: http://localhost:3000/alerts-test.html

2. **In Tab 2 (Control Panel):**
   - Reset Database
   - Reset Simulator
   - Verify all stats = 0

3. **In Tab 1 (Dashboard):**
   - Debug Panel should show 0s
   - Start simulator (First 5 files, Fast Forward)
   - Watch progress

4. **In Tab 3 (Alerts Test):**
   - Should show "CONNECTED"
   - Watch for alerts after ~50% progress

5. **After completion:**
   - Check Debug Panel (should have corridors)
   - Run simulation again to generate alerts

---

## 📝 Files Modified

- ✅ `components/simulator-controls.tsx` - Updated info text
- ✅ `app/page.tsx` - Fixed TypeScript errors
- ✅ `public/alerts-test.html` - New test page for alerts

---

## ❓ Still Having Issues?

1. **Check browser console** (F12) for errors
2. **Check VS Code terminal** for server errors
3. **Try the test pages:**
   - Control Panel: http://localhost:3000/control-panel.html
   - Alerts Test: http://localhost:3000/alerts-test.html
4. **Restart dev server:**
   - Stop: Ctrl+C in terminal
   - Start: `npm run dev`
5. **Hard refresh browser:** Ctrl+Shift+R

---

**Need more help? Share:**
- Browser console errors
- Server terminal logs
- Screenshots of Debug Panel
