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
}

export interface SimulatorStatus {
  isRunning: boolean;
  currentFile: string | null;
  processedPoints: number;
  totalPoints: number;
  currentTimestamp: string | null;
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
  
  async start(config: SimulatorConfig) {
    if (this.status.isRunning) {
      throw new Error('Simulator is already running');
    }
    
    this.config = config;
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
  
  getStatus(): SimulatorStatus {
    return { ...this.status };
  }
  
  private async runSimulation() {
    if (!this.config) return;
    
    const { files, speed, tripGapMinutes } = this.config;
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
        
        // Replay points with timing
        let lastTimestamp: Date | null = null;
        
        for (const point of points) {
          if (this.abortController?.signal.aborted) break;
          
          const currentTimestamp = new Date(point.ts);
          
          // Calculate delay based on speed multiplier
          if (lastTimestamp) {
            const realGapMs = currentTimestamp.getTime() - lastTimestamp.getTime();
            const simulatedGapMs = realGapMs / speed;
            
            // Wait if gap is reasonable (< 5 minutes in real time)
            if (simulatedGapMs > 0 && simulatedGapMs < 300000) {
              await this.sleep(simulatedGapMs);
            }
          }
          
          // Send to ingest API
          await this.ingestPoint(point);
          
          this.status.processedPoints++;
          this.status.currentTimestamp = point.ts;
          lastTimestamp = currentTimestamp;
        }
        
      } catch (error) {
        console.error(`Error processing file ${filename}:`, error);
      }
    }
    
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
    const headingColumn = this.findColumn(record, ['heading', 'bearing', 'course']);
    
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
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const simulator = new Simulator();
