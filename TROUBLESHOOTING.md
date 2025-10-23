# Troubleshooting Guide

## Common Issues & Solutions

### 🚫 Installation Issues

#### "npm: File C:\Program Files\nodejs\npm.ps1 cannot be loaded"

**Problem**: PowerShell execution policy is blocking scripts.

**Solution**:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then retry the npm command.

---

#### "Cannot find module '@prisma/client'"

**Problem**: Prisma client not generated after installation.

**Solution**:
```bash
npx prisma generate
```

---

#### "Module not found: Can't resolve 'h3-js'"

**Problem**: Dependencies not installed.

**Solution**:
```bash
npm install h3-js @turf/turf maplibre-gl csv-parse dayjs
```

---

### 🗄️ Database Issues

#### "Environment variable not found: DATABASE_URL"

**Problem**: Missing .env file.

**Solution**:
Create `.env` file in project root:
```env
DATABASE_URL="file:./dev.db"
TAU_SHORT=60
DELAY_THRESHOLD_MINUTES=15
H3_RESOLUTION=7
```

---

#### "Prisma schema could not be loaded"

**Problem**: Schema file has errors or Prisma not installed.

**Solution**:
1. Check `prisma/schema.prisma` exists
2. Run: `npm install --save-dev prisma`
3. Run: `npx prisma generate`

---

#### "Migration failed"

**Problem**: Database file locked or corrupted.

**Solution**:
```bash
# Delete existing database
rm prisma/dev.db
rm prisma/dev.db-journal

# Recreate
npx prisma migrate dev --name init
```

---

### 🌐 Runtime Issues

#### Blank page or "Page not found"

**Problem**: Development server not started or wrong URL.

**Solution**:
1. Ensure server is running: `npm run dev`
2. Check correct URL: http://localhost:3000
3. Check console for errors (F12)

---

#### "Failed to fetch heatmap" or "Failed to fetch corridors"

**Problem**: No data in database yet.

**Solution**:
1. Start the simulator from the UI
2. Wait 30-60 seconds for data processing
3. Check browser console for API errors
4. Verify CSV files exist in `public/dataset/`

---

#### Simulator shows "No CSV files found"

**Problem**: CSV files missing or in wrong location.

**Solution**:
1. Verify files in: `public/dataset/*.csv`
2. Check file permissions (readable)
3. Ensure at least one `.csv` file exists

---

#### SSE shows "DISCONNECTED" or "RECONNECTING"

**Problem**: Server-Sent Events connection failed.

**Solution**:
1. Check server is running: `npm run dev`
2. Check browser console for errors
3. Try refreshing the page
4. Check firewall/antivirus not blocking localhost:3000

---

### 📊 Data Issues

#### No alerts appearing

**Problem**: Thresholds not met or no baseline data yet.

**Solution**:
1. Let simulator run for 5-10 minutes to build baselines
2. Check `.env` thresholds are reasonable:
   - `TAU_SHORT=60` (not too high)
   - `DELAY_THRESHOLD_MINUTES=15` (not too high)
3. Check console for "Alert generated" logs

---

#### Heatmap shows no hexes

**Problem**: No drops detected in time window.

**Solution**:
1. Change time window to "All Time"
2. Run simulator to generate more data
3. Check browser console for heatmap API errors
4. Verify drops in database:
   ```bash
   npx prisma studio
   # Check "Drop" table has records
   ```

---

#### Corridors table empty

**Problem**: No corridor traversals in time window.

**Solution**:
1. Select "All Time" in time window filter
2. Wait for simulator to process more files
3. Check that drops are being detected
4. Verify "Corridor" table in Prisma Studio

---

### 🎨 UI Issues

#### Map not rendering

**Problem**: MapLibre GL not loaded or network issue.

**Solution**:
1. Check internet connection (needs OSM tiles)
2. Open browser DevTools → Network tab
3. Look for failed tile requests
4. Try clearing browser cache
5. Check console for MapLibre errors

---

#### Components not styled correctly

**Problem**: Tailwind CSS not loaded or build issue.

**Solution**:
1. Stop and restart dev server
2. Clear `.next` folder: `rm -rf .next`
3. Restart: `npm run dev`
4. Hard refresh browser (Ctrl+Shift+R)

---

#### Table/panels cut off or overlapping

**Problem**: CSS layout issue or window size.

**Solution**:
1. Zoom out browser (Ctrl+-)
2. Maximize browser window
3. Check browser console for CSS errors
4. Try different screen resolution

---

### 🐛 Debug Mode

#### Enable verbose logging

Add to your `.env`:
```env
NODE_ENV=development
```

#### Check Prisma queries

In `lib/prisma.ts`, log is already set to:
```typescript
log: ['query', 'error', 'warn']
```

#### Inspect database

```bash
npx prisma studio
```
Opens GUI at http://localhost:5555 to browse all tables.

---

### 🔧 Advanced Fixes

#### Reset everything and start fresh

```bash
# 1. Remove node_modules
rm -rf node_modules

# 2. Remove database
rm prisma/dev.db prisma/dev.db-journal

# 3. Remove build cache
rm -rf .next

# 4. Reinstall
npm install

# 5. Regenerate Prisma
npx prisma generate

# 6. Recreate database
npx prisma migrate dev --name init

# 7. Start server
npm run dev
```

---

#### Port 3000 already in use

**Problem**: Another process using port 3000.

**Solution**:
```powershell
# Windows - Find and kill process
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
$env:PORT=3001; npm run dev
```

```bash
# Linux/Mac
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

---

### 📞 Getting Help

If issues persist:

1. **Check logs**: Browser console (F12) and terminal output
2. **Verify setup**: Run through CHECKLIST.md
3. **Check versions**: 
   - Node.js ≥18
   - npm ≥9
4. **Review docs**: IMPLEMENTATION.md, SETUP.md
5. **Check database**: Use Prisma Studio to inspect data

---

### ✅ Quick Health Check

Run these to verify everything is working:

```bash
# 1. Check Node/npm
node --version  # Should be v18+
npm --version   # Should be v9+

# 2. Check dependencies installed
npm list @prisma/client h3-js maplibre-gl

# 3. Check Prisma
npx prisma --version

# 4. Check database exists
ls prisma/dev.db

# 5. Check server starts
npm run dev  # Should start on port 3000
```

If all commands succeed, system is healthy! 🎉

---

### 🆘 Emergency Reset

If nothing works, try the nuclear option:

```bash
# Backup any important data first!

# Delete everything
rm -rf node_modules .next prisma/dev.db* package-lock.json

# Fresh install
npm install

# Setup from scratch
npx prisma generate
npx prisma migrate dev --name init

# Restart
npm run dev
```

This should resolve 99% of issues.
