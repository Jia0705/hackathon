/**
 * GPS Processing Library
 * Core algorithms for drop detection, corridor identification, and stability analysis
 */

import { latLngToCell } from 'h3-js';
import { distance, bearing } from '@turf/turf';
import { point } from '@turf/helpers';

export interface GPSFix {
  ts: Date;
  lat: number;
  lon: number;
  speed?: number;
  accuracy?: number;
  heading?: number;
}

export interface Drop {
  startTs: Date;
  endTs: Date;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  durationSec: number;
  reason: 'weak_signal' | 'long_gap' | 'micro_drop';
}

export interface CorridorKey {
  aH3: string;
  bH3: string;
  direction: number; // 0-15 (16-way bearing bucket)
}

export interface Traversal {
  corridorKey: CorridorKey;
  startTs: Date;
  endTs: Date;
  travelSec: number;
  avgSpeedKmh: number;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
}

/**
 * Classify a GPS fix as strong or weak
 */
export function isStrongFix(fix: GPSFix, tauShort: number = 60): boolean {
  // If accuracy is available, use it (≤30m is strong)
  if (fix.accuracy !== undefined && fix.accuracy !== null) {
    return fix.accuracy <= 30;
  }
  // Otherwise, assume strong (weak fixes are detected by gaps in time series)
  return true;
}

/**
 * Detect drops (signal loss) in a trip's GPS points
 * Returns array of Drop objects
 */
export function detectDrops(
  points: GPSFix[],
  tauShort: number = 60
): Drop[] {
  const drops: Drop[] = [];
  
  if (points.length < 2) return drops;
  
  // Sort by timestamp
  const sorted = [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  
  // Calculate modal sampling interval (most common gap)
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].ts.getTime() - sorted[i - 1].ts.getTime()) / 1000;
    if (gap > 0 && gap < 300) { // Only consider gaps under 5 minutes for modal calc
      gaps.push(gap);
    }
  }
  
  const modalInterval = gaps.length > 0
    ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    : 30; // default to 30s if can't determine
  
  const dropThreshold = Math.max(tauShort, modalInterval * 2);
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapSec = (curr.ts.getTime() - prev.ts.getTime()) / 1000;
    
    if (gapSec > tauShort) {
      const reason = gapSec <= tauShort * 1.5 ? 'micro_drop' 
        : gapSec > 300 ? 'long_gap' 
        : 'weak_signal';
      
      drops.push({
        startTs: prev.ts,
        endTs: curr.ts,
        startLat: prev.lat,
        startLon: prev.lon,
        endLat: curr.lat,
        endLon: curr.lon,
        durationSec: gapSec,
        reason,
      });
    }
  }
  
  return drops;
}

/**
 * Extract corridors from drops
 * A corridor is defined by A (last strong fix) to B (next strong fix)
 */
export function extractCorridors(
  drops: Drop[],
  h3Resolution: number = 7
): Traversal[] {
  const traversals: Traversal[] = [];
  
  for (const drop of drops) {
    // Skip micro-drops for traversal learning (but count for instability)
    if (drop.reason === 'micro_drop') continue;
    
    const aH3 = latLngToCell(drop.startLat, drop.startLon, h3Resolution);
    const bH3 = latLngToCell(drop.endLat, drop.endLon, h3Resolution);
    
    // Calculate bearing and bucket into 16 directions (22.5° each)
    const from = point([drop.startLon, drop.startLat]);
    const to = point([drop.endLon, drop.endLat]);
    const bearingDeg = bearing(from, to);
    const normalizedBearing = (bearingDeg + 360) % 360;
    const directionBucket = Math.floor(normalizedBearing / 22.5) % 16;
    
    // Calculate distance and average speed
    const distanceKm = distance(from, to, { units: 'kilometers' });
    const avgSpeedKmh = drop.durationSec > 0 
      ? (distanceKm / (drop.durationSec / 3600))
      : 0;
    
    traversals.push({
      corridorKey: {
        aH3,
        bH3,
        direction: directionBucket,
      },
      startTs: drop.startTs,
      endTs: drop.endTs,
      travelSec: drop.durationSec,
      avgSpeedKmh,
      startLat: drop.startLat,
      startLon: drop.startLon,
      endLat: drop.endLat,
      endLon: drop.endLon,
    });
  }
  
  return traversals;
}

/**
 * Calculate median of an array
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Calculate percentile (0-100)
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Get hour of day (0-23) from a Date
 */
export function getHourBucket(date: Date): number {
  return date.getUTCHours();
}

/**
 * Calculate instability score for a hex
 */
export function calculateInstabilityScore(
  shortDrops: number,
  longDrops: number,
  traversals: number,
  wShort: number = 1,
  wLong: number = 3
): number {
  if (traversals === 0) return 0;
  return (wShort * shortDrops + wLong * longDrops) / Math.max(1, traversals);
}

/**
 * Determine alert severity based on deviation
 */
export function getAlertSeverity(
  type: 'delay' | 'overspeed',
  deltaValue: number,
  threshold: number
): 'low' | 'medium' | 'high' {
  const ratio = Math.abs(deltaValue) / threshold;
  
  if (ratio >= 2) return 'high';
  if (ratio >= 1.5) return 'medium';
  return 'low';
}
