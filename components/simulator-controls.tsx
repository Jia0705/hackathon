'use client';

/**
 * Simulator Controls Component
 * Controls for CSV replay simulation
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Play, Square, RotateCcw, FileText } from 'lucide-react';
import type { SimulatorStatus } from '@/types';

interface SimulatorControlsProps {
  onComplete?: () => void;
  onStart?: () => void;
}

export function SimulatorControls({ onComplete: onCompleteProp, onStart: onStartProp }: SimulatorControlsProps) {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [prevStatus, setPrevStatus] = useState<SimulatorStatus | null>(null);
  const [speed, setSpeed] = useState<string>('60');
  const [fastForward, setFastForward] = useState(true); // Fast-forward enabled by default
  const [isLoading, setIsLoading] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileSelectionMode, setFileSelectionMode] = useState<'quick' | 'custom'>('quick');

  // Fetch available files
  useEffect(() => {
    fetchFiles();
  }, []);

  // Poll simulator status
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Detect simulation completion
  useEffect(() => {
    if (prevStatus?.isRunning && !status?.isRunning && status && status.processedPoints > 0) {
      // Simulation just completed!
      console.log('[SIMULATOR] 🎉 Simulation completed! Computing baselines...');
      
      // Show notification
      alert('✅ Simulation Complete!\n\nProcessed ' + status.processedPoints.toLocaleString() + ' points.\n\nComputing baselines and refreshing data...');
      
      // Trigger completion callback
      if (onCompleteProp) {
        onCompleteProp();
      }
      
      // Auto-compute baselines
      computeBaselines();
    }
    
    setPrevStatus(status);
  }, [status?.isRunning, status?.processedPoints, onCompleteProp]);

  async function fetchFiles() {
    try {
      const response = await fetch('/api/simulator/files');
      if (response.ok) {
        const data = await response.json();
        setAvailableFiles(data.files);
        // Select first 5 files by default
        setSelectedFiles(data.files.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  }

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

  async function handleSpeedChange(newSpeed: string) {
    setSpeed(newSpeed);
    
    // If simulator is running, update speed dynamically
    if (status?.isRunning) {
      try {
        const response = await fetch('/api/simulator/speed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ speed: parseInt(newSpeed) }),
        });
        
        if (response.ok) {
          console.log(`Speed changed to ${newSpeed}× while running`);
        }
      } catch (error) {
        console.error('Failed to change speed:', error);
      }
    }
  }

  async function startSimulation() {
    if (selectedFiles.length === 0) {
      alert('Please select at least one file to simulate');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/simulator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed: parseInt(speed),
          files: selectedFiles,
          skipDelays: fastForward,
        }),
      });

      if (response.ok) {
        console.log('[SIMULATOR] Started successfully');
        await fetchStatus();
        
        // Notify parent that simulation has started
        if (onStartProp) {
          onStartProp();
        }
      } else {
        const error = await response.json();
        console.error('[SIMULATOR] Start failed:', error);
        alert(`Failed to start simulator: ${error.error}`);
      }
    } catch (error) {
      console.error('[SIMULATOR] Start error:', error);
      alert('Failed to start simulator: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }

  async function stopSimulation() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/simulator/stop', {
        method: 'POST',
      });

      if (response.ok) {
        console.log('[SIMULATOR] Stopped');
        await fetchStatus();
        
        // Auto-compute baselines after stopping
        console.log('[SIMULATOR] Auto-computing baselines...');
        await computeBaselines();
      } else {
        const error = await response.json();
        console.error('[SIMULATOR] Stop failed:', error);
      }
    } catch (error) {
      console.error('Failed to stop simulator:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function computeBaselines() {
    try {
      console.log('[BASELINES] Computing corridor baselines...');
      const response = await fetch('/api/compute/baselines', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[BASELINES] Computed:', result);
        return result;
      } else {
        const error = await response.json();
        console.error('[BASELINES] Computation failed:', error);
      }
    } catch (error) {
      console.error('Failed to compute baselines:', error);
    }
  }

  async function forceReset() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/simulator/reset', {
        method: 'POST',
      });

      if (response.ok) {
        console.log('[SIMULATOR] Force reset successful');
        await fetchStatus();
      } else {
        const error = await response.json();
        console.error('[SIMULATOR] Reset failed:', error);
      }
    } catch (error) {
      console.error('Failed to reset simulator:', error);
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
        {/* File Selection */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              Files: {selectedFiles.length} / {availableFiles.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileSelector(!showFileSelector)}
              disabled={status?.isRunning}
            >
              {showFileSelector ? 'Hide' : 'Select'}
            </Button>
          </div>

          {showFileSelector && (
            <div className="border rounded-md p-3 space-y-3">
              {/* Selection Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={fileSelectionMode === 'quick' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFileSelectionMode('quick')}
                  className="flex-1"
                >
                  Quick Select
                </Button>
                <Button
                  variant={fileSelectionMode === 'custom' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFileSelectionMode('custom')}
                  className="flex-1"
                >
                  Custom
                </Button>
              </div>

              {/* Quick Select Mode */}
              {fileSelectionMode === 'quick' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFiles(availableFiles.slice(0, 1))}
                    className="text-xs"
                  >
                    1 File
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFiles(availableFiles.slice(0, 5))}
                    className="text-xs"
                  >
                    5 Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFiles(availableFiles.slice(0, 10))}
                    className="text-xs"
                  >
                    10 Files
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFiles(availableFiles)}
                    className="text-xs"
                  >
                    All {availableFiles.length} Files
                  </Button>
                </div>
              )}

              {/* Custom Select Mode - Optimized */}
              {fileSelectionMode === 'custom' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFiles(availableFiles)}
                      className="text-xs flex-1"
                    >
                      All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedFiles([])}
                      className="text-xs flex-1"
                    >
                      None
                    </Button>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto border rounded p-2 space-y-1 bg-muted/30">
                    {availableFiles.map((file) => (
                      <div 
                        key={file}
                        className="flex items-center gap-2 text-xs hover:bg-accent p-1 rounded cursor-pointer"
                        onClick={() => {
                          if (selectedFiles.includes(file)) {
                            setSelectedFiles(selectedFiles.filter(f => f !== file));
                          } else {
                            setSelectedFiles([...selectedFiles, file]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedFiles.includes(file)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedFiles([...selectedFiles, file]);
                            } else {
                              setSelectedFiles(selectedFiles.filter(f => f !== file));
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono truncate">{file}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fast Forward Toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={fastForward}
            onCheckedChange={(checked) => setFastForward(checked === true)}
            disabled={status?.isRunning}
          />
          <span className="font-medium">Fast Forward (No Delays)</span>
          <span className="text-xs text-muted-foreground">
            - Process data instantly
          </span>
        </label>

        {/* Controls */}
        <div className="flex gap-2">
          <Select 
            value={speed} 
            onValueChange={handleSpeedChange}
            disabled={fastForward}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Speed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1× Speed</SelectItem>
              <SelectItem value="10">10× Speed</SelectItem>
              <SelectItem value="60">60× Speed</SelectItem>
              <SelectItem value="100">100× Speed</SelectItem>
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

        {/* Compute Baselines Button */}
        <Button
          onClick={computeBaselines}
          disabled={isLoading || status?.isRunning}
          variant="secondary"
          className="w-full"
        >
          Compute Baselines
        </Button>

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
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            {fastForward ? (
              <span className="text-green-600 font-medium">⚡ Fast Forward: Processing at maximum speed (batches of 100 points)</span>
            ) : (
              <span>Replay speed controls timing between GPS points. Fast Forward mode recommended for faster results.</span>
            )}
          </div>
          <div className="text-xs text-blue-600 font-medium">
            📍 Processing all GPS points to detect drops and build corridor baselines
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
