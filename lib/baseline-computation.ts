/**
 * Baseline Computation Library
 * Handles hour-of-day bucketing, median travel time, and P95 speed calculations
 */

import { median, percentile, getHourBucket } from './gps-processing';

export interface CorridorBaseline {
  corridorId: string;
  bucketHour: number; // -1 for global, 0-23 for hourly
  count: number;
  medianTravelSec: number;
  p95SpeedKmh: number;
}

export interface TraversalData {
  travelSec: number;
  avgSpeedKmh: number;
  startTs: Date;
}

/**
 * Compute baselines for a corridor from its traversals
 * Returns both hourly and global baselines
 */
export function computeBaselines(
  corridorId: string,
  traversals: TraversalData[],
  minSamplesForHourly: number = 5
): CorridorBaseline[] {
  const baselines: CorridorBaseline[] = [];
  
  // Group traversals by hour of day
  const hourlyBuckets: Map<number, TraversalData[]> = new Map();
  
  for (const traversal of traversals) {
    const hour = getHourBucket(traversal.startTs);
    if (!hourlyBuckets.has(hour)) {
      hourlyBuckets.set(hour, []);
    }
    hourlyBuckets.get(hour)!.push(traversal);
  }
  
  // Compute hourly baselines (if enough samples)
  for (const [hour, hourTraversals] of hourlyBuckets.entries()) {
    if (hourTraversals.length >= minSamplesForHourly) {
      const travelTimes = hourTraversals.map(t => t.travelSec);
      const speeds = hourTraversals.map(t => t.avgSpeedKmh);
      
      baselines.push({
        corridorId,
        bucketHour: hour,
        count: hourTraversals.length,
        medianTravelSec: Math.round(median(travelTimes)),
        p95SpeedKmh: percentile(speeds, 95),
      });
    }
  }
  
  // Always compute global baseline as fallback
  if (traversals.length > 0) {
    const travelTimes = traversals.map(t => t.travelSec);
    const speeds = traversals.map(t => t.avgSpeedKmh);
    
    baselines.push({
      corridorId,
      bucketHour: -1, // Global baseline
      count: traversals.length,
      medianTravelSec: Math.round(median(travelTimes)),
      p95SpeedKmh: percentile(speeds, 95),
    });
  }
  
  return baselines;
}

/**
 * Get the appropriate baseline for a given time
 * Prefers hourly baseline if available, falls back to global
 */
export function getApplicableBaseline(
  baselines: CorridorBaseline[],
  timestamp: Date
): CorridorBaseline | null {
  const hour = getHourBucket(timestamp);
  
  // Try to find hourly baseline
  const hourlyBaseline = baselines.find(b => b.bucketHour === hour);
  if (hourlyBaseline) return hourlyBaseline;
  
  // Fall back to global baseline
  const globalBaseline = baselines.find(b => b.bucketHour === -1);
  return globalBaseline || null;
}

/**
 * Check if a traversal triggers a delay alert
 */
export function checkDelayAlert(
  travelSec: number,
  baseline: CorridorBaseline,
  thresholdMinutes: number = 15
): { isAlert: boolean; deltaSec: number } {
  const deltaSec = travelSec - baseline.medianTravelSec;
  const thresholdSec = thresholdMinutes * 60;
  
  return {
    isAlert: deltaSec >= thresholdSec,
    deltaSec,
  };
}

/**
 * Check if a traversal triggers an overspeed alert
 */
export function checkOverspeedAlert(
  avgSpeedKmh: number,
  baseline: CorridorBaseline
): { isAlert: boolean; deltaSpeedKmh: number } {
  const deltaSpeedKmh = avgSpeedKmh - baseline.p95SpeedKmh;
  
  return {
    isAlert: deltaSpeedKmh > 0 && baseline.p95SpeedKmh > 0,
    deltaSpeedKmh,
  };
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}
