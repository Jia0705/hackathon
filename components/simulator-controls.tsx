'use client';

/**
 * Simulator Controls Component
 * Controls for CSV replay simulation
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Play, Square, RotateCcw } from 'lucide-react';
import type { SimulatorStatus } from '@/types';

export function SimulatorControls() {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [speed, setSpeed] = useState<string>('1');
  const [isLoading, setIsLoading] = useState(false);

  // Poll simulator status
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const response = await fetch('/api/simulator/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch simulator status:', error);
    }
  }

  async function startSimulation() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/simulator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed: parseInt(speed),
        }),
      });

      if (response.ok) {
        await fetchStatus();
      } else {
        const error = await response.json();
        alert(`Failed to start simulator: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to start simulator:', error);
      alert('Failed to start simulator');
    } finally {
      setIsLoading(false);
    }
  }

  async function stopSimulation() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/simulator/status?action=stop', {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Failed to stop simulator:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function resetSimulation() {
    await stopSimulation();
    // Add any cleanup logic here if needed
  }

  const progress = status?.totalPoints
    ? (status.processedPoints / status.totalPoints) * 100
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex gap-2">
          <Select value={speed} onValueChange={setSpeed} disabled={status?.isRunning}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1× Speed</SelectItem>
              <SelectItem value="10">10× Speed</SelectItem>
              <SelectItem value="60">60× Speed</SelectItem>
            </SelectContent>
          </Select>

          {!status?.isRunning ? (
            <Button
              onClick={startSimulation}
              disabled={isLoading}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Replay
            </Button>
          ) : (
            <Button
              onClick={stopSimulation}
              disabled={isLoading}
              variant="destructive"
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}

          <Button
            onClick={resetSimulation}
            disabled={isLoading || status?.isRunning}
            variant="outline"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Status */}
        {status && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">
                {status.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>

            {status.currentFile && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current File:</span>
                <span className="font-mono text-xs truncate max-w-[200px]">
                  {status.currentFile}
                </span>
              </div>
            )}

            {status.currentTimestamp && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Timestamp:</span>
                <span className="font-mono text-xs">
                  {new Date(status.currentTimestamp).toLocaleString()}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {status.processedPoints.toLocaleString()} / {status.totalPoints.toLocaleString()}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground">
          Replay speed controls how fast GPS data is ingested. Higher speeds process data faster.
        </div>
      </CardContent>
    </Card>
  );
}
