'use client';

/**
 * Debug Panel Component
 * Shows database stats and provides reset/test buttons
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Trash2, Database } from 'lucide-react';

interface DBStats {
  vehicles: number;
  trips: number;
  gpsPoints: number;
  drops: number;
  corridors: number;
  traversals: number;
  corridorStats: number;
  alerts: number;
}

export function DebugPanel() {
  const [stats, setStats] = useState<DBStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/db/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setLastUpdate(new Date());
        
        if (data.sampleCorridor) {
          console.log('[DEBUG] Sample Corridor:', data.sampleCorridor);
        }
        if (data.dropsByReason) {
          console.log('[DEBUG] Drops by reason:', data.dropsByReason);
        }
      }
    } catch (error) {
      console.error('[DEBUG] Failed to fetch stats:', error);
    }
  };

  const resetDatabase = async () => {
    if (!confirm('⚠️ Are you sure? This will DELETE ALL DATA from the database!')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/db/reset', {
        method: 'POST',
      });

      if (response.ok) {
        console.log('[DEBUG] ✅ Database reset successfully');
        alert('✅ Database reset successfully! Start the simulator to generate new data.');
        await fetchStats();
      } else {
        const error = await response.json();
        console.error('[DEBUG] ❌ Reset failed:', error);
        alert('❌ Failed to reset database: ' + error.error);
      }
    } catch (error) {
      console.error('[DEBUG] Reset error:', error);
      alert('❌ Error resetting database');
    } finally {
      setLoading(false);
    }
  };

  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    fetchStats();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-3 cursor-pointer hover:bg-accent/50" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4" />
            Stats {stats && `(${stats.corridors} corridors)`}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setAutoRefresh(!autoRefresh);
            }}
          >
            {autoRefresh ? '⏸' : '▶'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3 p-3 pt-0">
          {stats && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">GPS:</span>
                <span className="font-semibold">{stats.gpsPoints.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Drops:</span>
                <span className="font-semibold">{stats.drops.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Corridors:</span>
                <span className="font-semibold text-blue-600">{stats.corridors}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Alerts:</span>
                <span className="font-semibold text-red-600">{stats.alerts}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStats}
              className="flex-1 h-7 text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={resetDatabase}
              disabled={loading}
              className="flex-1 h-7 text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Reset
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
