/**
 * CSV Simulator Service
 * Reads and replays CSV files from /public/dataset
 */

import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';

export interface SimulatorConfig {
  files: string[];
  speed: number; // 1, 10, 60 (multiplier)
  tripGapMinutes: number;
  skipDelays?: boolean; // Fast-forward mode (no timing delays)
}

export interface SimulatorStatus {
  isRunning: boolean;
  currentFile: string | null;
  processedPoints: number;
  totalPoints: number;
  currentTimestamp: string | null;
  speed?: number;
}

class Simulator {
  private config: SimulatorConfig | null = null;
  private status: SimulatorStatus = {
    isRunning: false,
    currentFile: null,
    processedPoints: 0,
    totalPoints: 0,
    currentTimestamp: null,
  };
  private abortController: AbortController | null = null;
  private currentSpeed: number = 1; // Track current speed dynamically
  
  async start(config: SimulatorConfig) {
    if (this.status.isRunning) {
      throw new Error('Simulator is already running');
    }
    
    this.config = config;
    this.currentSpeed = config.speed;
    this.status.isRunning = true;
    this.status.processedPoints = 0;
    this.status.totalPoints = 0;
    this.abortController = new AbortController();
    
    // Run simulation in background
    this.runSimulation().catch(error => {
      console.error('Simulator error:', error);
      this.status.isRunning = false;
    });
  }
  
  stop() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.status.isRunning = false;
  }
  
  forceReset() {
    console.log('[SIMULATOR] Force resetting state');
    if (this.abortController) {
      this.abortController.abort();
    }
    this.status = {
      isRunning: false,
      currentFile: null,
      processedPoints: 0,
      totalPoints: 0,
      currentTimestamp: null,
    };
    this.config = null;
    this.abortController = null;
  }
  
  setSpeed(speed: number) {
    this.currentSpeed = speed;
    console.log(`[SIMULATOR] Speed set to ${speed}×`);
  }
  
  getStatus(): SimulatorStatus {
    return { ...this.status, speed: this.currentSpeed };
  }
  
  private async runSimulation() {
    if (!this.config) return;
    
    const { files, tripGapMinutes } = this.config;
    const datasetPath = path.join(process.cwd(), 'public', 'dataset');
    
    for (const filename of files) {
      if (this.abortController?.signal.aborted) break;
      
      this.status.currentFile = filename;
      
      try {
        const filePath = path.join(datasetPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Parse CSV with auto-detection
        const records = parse(content, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
        
        this.status.totalPoints += records.length;
        
        // Extract vehicle ID from filename (e.g., "ABA 0048.csv" -> "ABA 0048")
        const vehicleId = filename.replace('.csv', '');
        
        // Map columns to standard format
        const points = records.map((record: any) => this.mapRecord(record, vehicleId));
        
        // Sort by timestamp
        points.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
        
        // Count tracked vs non-tracked points
        const trackedCount = points.filter(p => 
          p.gpsLocated === true || 
          p.gpsLocated === 1 || 
          p.gpsLocated === '1' || 
          p.gpsLocated === 'true' ||
          p.engineOn === true ||
          p.engineOn === 1
        ).length;
        
        console.log(`[SIMULATOR] 📊 File ${filename}: ${points.length} total points (${trackedCount} tracked, ${points.length - trackedCount} non-tracked)`);
        
        // Replay points with timing
        let lastTimestamp: Date | null = null;
        
        // Fast-forward mode: batch ingest tracked points only
        if (this.config.skipDelays) {
          // Filter to only tracked points (gpsLocated = true OR engineon = true)
          const trackedPoints = points.filter(p => 
            p.gpsLocated === true || 
            p.gpsLocated === 1 || 
            p.gpsLocated === '1' || 
            p.gpsLocated === 'true' ||
            p.engineOn === true ||
            p.engineOn === 1
          );
          
          console.log(`[SIMULATOR] ⚡ Fast-forward: ${trackedPoints.length} tracked points (${points.length - trackedPoints.length} skipped non-tracked)`);
          
          const batchSize = 500; // Larger batch for faster processing (up from 100)
          const parallelBatches = 2; // Reduced from 3 to prevent overwhelming the server
          
          for (let i = 0; i < trackedPoints.length; i += batchSize * parallelBatches) {
            if (this.abortController?.signal.aborted) break;
            
            // Create parallel batch promises
            const batchPromises = [];
            for (let j = 0; j < parallelBatches; j++) {
              const startIdx = i + (j * batchSize);
              if (startIdx >= trackedPoints.length) break;
              
              const batch = trackedPoints.slice(startIdx, startIdx + batchSize);
              if (batch.length > 0) {
                batchPromises.push(this.ingestBatch(batch));
              }
            }
            
            // Wait for all parallel batches to complete
            await Promise.all(batchPromises);
            
            // Update progress
            const processedInThisRound = Math.min(batchSize * parallelBatches, trackedPoints.length - i);
            this.status.processedPoints += processedInThisRound;
            const lastProcessedIdx = Math.min(i + processedInThisRound - 1, trackedPoints.length - 1);
            this.status.currentTimestamp = trackedPoints[lastProcessedIdx].ts;
            
            // Progress logging
            const progress = Math.round((i / trackedPoints.length) * 100);
            if (progress % 10 === 0 && progress > 0) {
              console.log(`[SIMULATOR] 📈 Progress: ${progress}% (${i.toLocaleString()}/${trackedPoints.length.toLocaleString()} points)`);
            }
            
            // Minimal delay - just prevent server overload
            await this.sleep(100); // Increased from 50ms to be safer
          }
        } else {
          // Normal mode: process all rows but only ingest tracked points
          // We iterate through all rows to maintain timing, but skip ingestion for non-tracked
          for (const point of points) {
            if (this.abortController?.signal.aborted) break;
            
            const currentTimestamp = new Date(point.ts);
            
            // Calculate delay based on current speed multiplier (dynamically updated)
            if (lastTimestamp) {
              const realGapMs = currentTimestamp.getTime() - lastTimestamp.getTime();
              const simulatedGapMs = realGapMs / this.currentSpeed;
              
              // Wait if gap is reasonable (< 5 minutes in real time)
              if (simulatedGapMs > 0 && simulatedGapMs < 300000) {
                await this.sleep(simulatedGapMs);
              }
            }
            
            // Only ingest tracked points (gpsLocated or engineOn)
            const isTracked = point.gpsLocated === true || 
                            point.gpsLocated === 1 || 
                            point.gpsLocated === '1' || 
                            point.gpsLocated === 'true' ||
                            point.engineOn === true ||
                            point.engineOn === 1;
            
            if (isTracked) {
              await this.ingestPoint(point);
            }
            
            this.status.processedPoints++;
            this.status.currentTimestamp = point.ts;
            lastTimestamp = currentTimestamp;
          }
        }
        
      } catch (error) {
        console.error(`Error processing file ${filename}:`, error);
      }
    }
    
    console.log('[SIMULATOR] ✅ Simulation completed!');
    console.log(`[SIMULATOR] 📊 Total processed: ${this.status.processedPoints} points`);
    
    this.status.isRunning = false;
    this.status.currentFile = null;
  }
  
  private mapRecord(record: any, vehicleId: string): any {
    // Try to detect timestamp column
    const tsColumn = this.findColumn(record, ['timestamp', 'time', 'ts', 'recorded_at', 'datetime']);
    const latColumn = this.findColumn(record, ['lat', 'latitude']);
    const lonColumn = this.findColumn(record, ['lon', 'lng', 'longitude']);
    const speedColumn = this.findColumn(record, ['speed', 'spd', 'velocity']);
    const accuracyColumn = this.findColumn(record, ['accuracy', 'hdop', 'eph', 'gps_acc']);
    const headingColumn = this.findColumn(record, ['heading', 'bearing', 'course', 'direction']);
    const gpsLocatedColumn = this.findColumn(record, ['gpslocated', 'gps_located', 'located', 'tracked']);
    const engineOnColumn = this.findColumn(record, ['engineon', 'engine_on', 'engine', 'ignition']);
    
    if (!tsColumn || !latColumn || !lonColumn) {
      throw new Error('Required columns (timestamp, lat, lon) not found');
    }
    
    return {
      vehicleId,
      ts: this.normalizeTimestamp(record[tsColumn]),
      lat: parseFloat(record[latColumn]),
      lon: parseFloat(record[lonColumn]),
      speed: speedColumn ? parseFloat(record[speedColumn]) : undefined,
      accuracy: accuracyColumn ? parseFloat(record[accuracyColumn]) : undefined,
      heading: headingColumn ? parseFloat(record[headingColumn]) : undefined,
      gpsLocated: gpsLocatedColumn ? this.parseBoolean(record[gpsLocatedColumn]) : undefined,
      engineOn: engineOnColumn ? this.parseBoolean(record[engineOnColumn]) : undefined,
    };
  }
  
  private findColumn(record: any, candidates: string[]): string | null {
    const keys = Object.keys(record).map(k => k.toLowerCase());
    for (const candidate of candidates) {
      const found = keys.find(k => k === candidate || k.includes(candidate));
      if (found) {
        return Object.keys(record)[keys.indexOf(found)];
      }
    }
    return null;
  }
  
  private normalizeTimestamp(value: string): string {
    // Try to parse various timestamp formats
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp: ${value}`);
    }
    return date.toISOString();
  }
  
  private async ingestPoint(point: any) {
    try {
      const response = await fetch('http://localhost:3000/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point),
      });
      
      if (!response.ok) {
        console.error('Ingest failed:', await response.text());
      }
    } catch (error) {
      console.error('Ingest error:', error);
    }
  }

  private async ingestBatch(points: any[]) {
    try {
      const response = await fetch('http://localhost:3000/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(points),
      });
      
      if (!response.ok) {
        console.error('Batch ingest failed:', await response.text());
      }
    } catch (error) {
      console.error('Batch ingest error:', error);
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Detect GPS drops in a sequence of points
   * Only return points where tracking is lost (weak signal) or restored
   */
  private detectDropsInPoints(points: any[]): any[] {
    const significantEvents: any[] = [];
    const TAU_SHORT = parseInt(process.env.TAU_SHORT || '60');
    
    let lastStrongFix: any | null = null;
    let dropStartPoint: any | null = null;
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const isStrong = this.isStrongFix(point);
      
      if (isStrong) {
        // Strong signal
        if (dropStartPoint) {
          // Drop just ended - calculate duration
          const dropDuration = (new Date(point.ts).getTime() - new Date(dropStartPoint.ts).getTime()) / 1000;
          
          if (dropDuration >= TAU_SHORT) {
            // Significant drop detected - include drop start and restoration points
            significantEvents.push({
              ...dropStartPoint,
              _event: 'drop_start',
            });
            significantEvents.push({
              ...point,
              _event: 'drop_end',
              _dropDuration: dropDuration,
            });
          }
          
          dropStartPoint = null;
        }
        lastStrongFix = point;
      } else {
        // Weak/no signal
        if (lastStrongFix && !dropStartPoint) {
          // Drop just started
          dropStartPoint = lastStrongFix;
        }
      }
    }
    
    // Handle drop that extends to end of file
    if (dropStartPoint) {
      const lastPoint = points[points.length - 1];
      const dropDuration = (new Date(lastPoint.ts).getTime() - new Date(dropStartPoint.ts).getTime()) / 1000;
      
      if (dropDuration >= TAU_SHORT) {
        significantEvents.push({
          ...dropStartPoint,
          _event: 'drop_start',
        });
        significantEvents.push({
          ...lastPoint,
          _event: 'drop_end',
          _dropDuration: dropDuration,
        });
      }
    }
    
    return significantEvents;
  }

  /**
   * Check if a GPS point has strong signal (can track the truck)
   */
  private isStrongFix(point: any): boolean {
    // Priority 1: Use GPSLocated column if available (most accurate)
    if (point.gpsLocated !== undefined && point.gpsLocated !== null) {
      return point.gpsLocated === true;
    }
    
    // Priority 2: Check accuracy data
    const accuracy = point.accuracy;
    if (accuracy !== undefined && accuracy !== null) {
      return accuracy <= 30;
    }
    
    // Priority 3: If no accuracy, assume strong if we have speed data
    if (point.speed !== undefined && point.speed !== null) {
      return true;
    }
    
    // Default: assume weak signal if we can't determine
    return false;
  }

  /**
   * Parse boolean values from CSV (handles "true"/"false" strings)
   */
  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return Boolean(value);
  }
}

export const simulator = new Simulator();
