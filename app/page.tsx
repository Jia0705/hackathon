'use client';

/**
 * Dashboard Page
 * Main view with map, alerts panel, corridors table, and controls
 */

import { useState, useEffect } from 'react';
import { MapView } from '@/components/map-view';
import { AlertsPanel } from '@/components/alerts-panel';
import { CorridorsTable } from '@/components/corridors-table';
import { SimulatorControls } from '@/components/simulator-controls';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Settings, Map as MapIcon, Table as TableIcon } from 'lucide-react';
import type { HeatmapData, Corridor, Alert } from '@/types';

export default function Dashboard() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [timeWindow, setTimeWindow] = useState<string>('24h');
  const [activeTab, setActiveTab] = useState<string>('map');
  const [isLoadingHeatmap, setIsLoadingHeatmap] = useState(false);
  const [isLoadingCorridors, setIsLoadingCorridors] = useState(false);

  // Fetch heatmap data
  useEffect(() => {
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeWindow]);

  // Fetch corridors data
  useEffect(() => {
    fetchCorridors();
    const interval = setInterval(fetchCorridors, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeWindow]);

  async function fetchHeatmap() {
    setIsLoadingHeatmap(true);
    try {
      const params = new URLSearchParams({
        h3res: '7',
        ...getTimeWindowParams(timeWindow),
      });

      const response = await fetch(`/api/heatmap?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHeatmapData(data);
      }
    } catch (error) {
      console.error('Failed to fetch heatmap:', error);
    } finally {
      setIsLoadingHeatmap(false);
    }
  }

  async function fetchCorridors() {
    setIsLoadingCorridors(true);
    try {
      const params = new URLSearchParams({
        sort: 'deviation',
        limit: '100',
        ...getTimeWindowParams(timeWindow),
      });

      const response = await fetch(`/api/corridors?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCorridors(data.corridors || []);
      }
    } catch (error) {
      console.error('Failed to fetch corridors:', error);
    } finally {
      setIsLoadingCorridors(false);
    }
  }

  function getTimeWindowParams(window: string) {
    const now = new Date();
    let from: Date;

    switch (window) {
      case '1h':
        from = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        from = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return {}; // All time
    }

    return {
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }

  function handleHexClick(hexId: string, properties: any) {
    console.log('Hex clicked:', hexId, properties);
    // TODO: Implement hex click handler - filter corridors or show details
  }

  function handleAlertClick(alert: Alert) {
    console.log('Alert clicked:', alert);
    // TODO: Pan/zoom map to corridor location
    setActiveTab('map');
  }

  function handleViewCorridor(corridor: Corridor) {
    console.log('View corridor:', corridor);
    // TODO: Open corridor detail modal
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">GPS Stability & Corridor Intelligence</h1>
            <p className="text-sm text-muted-foreground">Real-time GPS drop detection and corridor analysis</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Time Window Selector */}
            <Select value={timeWindow} onValueChange={setTimeWindow}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Map/Corridors Tabs */}
        <div className="flex-1 flex flex-col p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="map">
                <MapIcon className="w-4 h-4 mr-2" />
                Map
              </TabsTrigger>
              <TabsTrigger value="corridors">
                <TableIcon className="w-4 h-4 mr-2" />
                Corridors
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="map" className="flex-1 mt-4">
              <MapView
                heatmapData={heatmapData}
                onHexClick={handleHexClick}
                center={[0, 0]}
                zoom={2}
              />
            </TabsContent>
            
            <TabsContent value="corridors" className="flex-1 mt-4">
              <CorridorsTable
                corridors={corridors}
                onViewCorridor={handleViewCorridor}
                isLoading={isLoadingCorridors}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Alerts Panel & Simulator */}
        <div className="w-96 flex flex-col gap-4 p-4 border-l bg-muted/30">
          <div className="flex-1 min-h-0">
            <AlertsPanel onAlertClick={handleAlertClick} />
          </div>
          
          <div>
            <SimulatorControls />
          </div>
        </div>
      </div>
    </div>
  );
}
