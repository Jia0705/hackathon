/**
 * Shared TypeScript types for the application
 */

export interface Corridor {
  corridorId: string;
  aH3: string;
  bH3: string;
  direction: number;
  count: number;
  medianSec: number;
  p95SpeedKmh: number;
  lastSeen: string | null;
  deviationSec: number;
  deviationFormatted: string | null;
  deviationSign: string;
}

export interface Alert {
  id: string;
  type: 'delay' | 'overspeed';
  time: string;
  corridorId: string;
  aH3?: string;
  bH3?: string;
  tripId: string;
  vehicleId: string;
  vehicleName?: string;
  severity: 'low' | 'medium' | 'high';
  deltaValue: number;
  details: any;
}

export interface HexFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    hex: string;
    instability: number;
    shortDrops: number;
    longDrops: number;
    traversals: number;
  };
}

export interface HeatmapData {
  type: 'FeatureCollection';
  features: HexFeature[];
}

export interface SimulatorStatus {
  isRunning: boolean;
  currentFile: string | null;
  processedPoints: number;
  totalPoints: number;
  currentTimestamp: string | null;
}

export interface FilterState {
  timeWindow: '1h' | '6h' | '24h' | '7d' | 'all';
  from: string | null;
  to: string | null;
  vehicles: string[];
  tauShort: number;
  delayThreshold: number;
  h3Resolution: number;
}
