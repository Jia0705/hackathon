# Data Cleaning Implementation

## Problem Identified

After analyzing the dataset files, several data quality issues were found:

### 1. **Noisy Stationary Data**
- Vehicles parked with engine ON (idling) but speed = 0
- Vehicles parked with engine OFF
- Thousands of duplicate GPS points at same location
- Example from `ABA 0048.csv`:
  ```
  Lines 1-450: Vehicle stationary (speed=0) for ~12 hours
  Line 454: EngineStatus changes to true, but still stationary
  Lines 454-600: Engine ON but speed still 0 (idling/warming up)
  Line 600+: Finally starts moving (speed > 0)
  ```

### 2. **Impact on Corridor Analysis**
- **Median time 3+ minutes**: Caused by including stationary points in travel time
- **Speed 0.0 km/h**: Averaged with stationary/idling points
- **Unrealistic deviations**: Parking/idling creates fake "delays"
- **Cluttered heatmap**: Parking lots appear as "unstable" areas

### 3. **Root Cause**
The dataset includes:
- ✅ **GPSLocated** flag (whether GPS has a fix)
- ✅ **EngineStatus** flag (whether engine is running)
- ❌ But both can be true while stationary (parked with engine on)

## Solution: Multi-Layer Data Filtering

### Phase 1: Basic Tracking Filter (Already Implemented)
```typescript
// Only process points where vehicle is tracked
const isTracked = gpsLocated === true || engineOn === true
```

### Phase 2: Quality Filter (NEW - Just Added)
Added `isQualityPoint()` method with 5 filters:

#### Filter 1: Remove Stationary + Engine ON
```typescript
if (speed === 0 && engineOn === true) {
  return false; // Engine idling = noise
}
```

#### Filter 2: Remove Stationary + Engine OFF
```typescript
if (speed === 0 && engineOn === false) {
  return false; // Parked = not useful
}
```

#### Filter 3: Remove Unrealistic Speeds
```typescript
if (speed > 200) {
  return false; // GPS error
}
```

#### Filter 4: Validate Coordinates
```typescript
if (!lat || !lon || lat === 0 || lon === 0 || 
    Math.abs(lat) > 90 || Math.abs(lon) > 180) {
  return false; // Invalid GPS
}
```

#### Filter 5: Require Actual Movement (KEY FILTER)
```typescript
if (speed < 1) {
  return false; // Must be moving at least 1 km/h
}
```

## Results Expected

### Before Data Cleaning
- ❌ 44,426 points in `ABA 0048.csv`
- ❌ ~12 hours of stationary data
- ❌ Median corridor time: 3+ minutes
- ❌ Speed: 0.0 km/h in many corridors
- ❌ Noisy heatmap with parking spots

### After Data Cleaning
- ✅ ~4,000-8,000 **moving** points per file
- ✅ Only actual vehicle movement tracked
- ✅ Realistic median times (30-120 seconds)
- ✅ Accurate speeds (15-80 km/h)
- ✅ Clean heatmap showing only travel routes

## Implementation Details

### Modified Files
- **`lib/simulator.ts`**: Added `isQualityPoint()` method
- Applied to both fast-forward and normal modes
- Filters applied **before** ingestion to database

### Filter Application
```typescript
// Fast-forward mode
const trackedPoints = points.filter(p => {
  const isTracked = p.gpsLocated || p.engineOn;
  const isQuality = this.isQualityPoint(p);
  return isTracked && isQuality;
});

// Normal mode
if (isTracked && isQuality) {
  await this.ingestPoint(point);
}
```

### Logging Enhancement
```
[SIMULATOR] ⚡ Fast-forward: 5,234 quality points (39,192 filtered out)
```
Shows how many noisy points were removed.

## Testing Instructions

1. **Reset the database**:
   ```
   POST /api/db/reset
   ```

2. **Start fresh simulation**:
   - Click "Start Simulation"
   - Use "Fast-Forward" mode
   - Wait for completion

3. **Verify Results**:
   - Check corridors table: median times should be realistic (30-120s)
   - Check corridors: speeds should be > 0 km/h
   - Check heatmap: should show routes, not parking lots
   - Check alerts: should be about actual travel delays, not parking

## Expected Data Volume Reduction

| File | Original Points | Quality Points | Reduction |
|------|----------------|----------------|-----------|
| ABA 0048.csv | 44,426 | ~6,000 | 86% |
| ABA 0319.csv | ~40,000 | ~5,500 | 86% |
| Average | ~42,000 | ~6,000 | **85-90%** |

**Note**: This is **good** reduction - we're removing noise, not data!

## Benefits

✅ **Accurate corridor analysis** - Only actual travel time counted  
✅ **Realistic speeds** - No averaging with stationary points  
✅ **Clean visualizations** - Heatmap shows routes, not parking  
✅ **Meaningful alerts** - Delays are real, not parking/idling  
✅ **Better performance** - 85% less data to process  
✅ **Reliable baselines** - Computed from moving vehicles only  

## Future Enhancements (Optional)

1. **Speed-based segmentation**: Separate highway (>60 km/h) vs city (<30 km/h)
2. **Acceleration detection**: Flag harsh braking/acceleration
3. **Route deviation**: Compare actual vs expected routes
4. **Time-of-day analysis**: Rush hour vs off-peak patterns
5. **Weather correlation**: GPS quality vs weather conditions

## Configuration (Optional)

You can adjust quality thresholds in `isQualityPoint()`:

```typescript
// Current: speed >= 1 km/h
if (point.speed < 1) return false;

// Stricter: speed >= 5 km/h (only highway/main roads)
if (point.speed < 5) return false;

// More lenient: speed >= 0.5 km/h (catch slow traffic)
if (point.speed < 0.5) return false;
```

**Recommendation**: Keep at 1 km/h for balanced results.
