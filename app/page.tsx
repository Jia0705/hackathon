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
import { DebugPanel } from '@/components/debug-panel';
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
  const [isResetting, setIsResetting] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0); // For triggering manual refresh
  const [isSimulating, setIsSimulating] = useState(false); // Track simulation state
  const [selectedCorridor, setSelectedCorridor] = useState<Corridor | null>(null); // For highlighting corridor

  // Reset on page load/refresh
  useEffect(() => {
    const resetOnLoad = async () => {
      try {
        console.log('[DASHBOARD] 🔄 Resetting on page load...');
        
        // Stop simulator
        await fetch('/api/simulator/force-stop', { method: 'POST' });
        console.log('[DASHBOARD] ✅ Simulator stopped');
        
        // Reset database
        await fetch('/api/db/reset', { method: 'POST' });
        console.log('[DASHBOARD] ✅ Database reset');
        
        setIsResetting(false);
      } catch (error) {
        console.error('[DASHBOARD] Reset error:', error);
        setIsResetting(false);
      }
    };
    
    resetOnLoad();
    
    // Also stop simulator when user closes/refreshes the page
    const handleBeforeUnload = () => {
      // Use keepalive to ensure request completes even if page is closing
      navigator.sendBeacon('/api/simulator/force-stop');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // Run once on mount

  // Fetch heatmap data
  useEffect(() => {
    if (isResetting) return; // Don't fetch while resetting
    
    fetchHeatmap();
    // Refresh more frequently during simulation (10s), less frequently when idle (60s)
    const refreshInterval = isSimulating ? 10000 : 60000;
    const interval = setInterval(fetchHeatmap, refreshInterval);
    return () => clearInterval(interval);
  }, [timeWindow, isResetting, refreshKey, isSimulating]); // Add isSimulating dependency

  // Fetch corridors data
  useEffect(() => {
    if (isResetting) return; // Don't fetch while resetting
    
    fetchCorridors();
    // Refresh more frequently during simulation (10s), less frequently when idle (30s)
    const refreshInterval = isSimulating ? 10000 : 30000;
    const interval = setInterval(fetchCorridors, refreshInterval);
    return () => clearInterval(interval);
  }, [timeWindow, isResetting, refreshKey, isSimulating]); // Add isSimulating dependency

  async function fetchHeatmap() {
    setIsLoadingHeatmap(true);
    try {
      const timeParams = getTimeWindowParams(timeWindow);
      const params = new URLSearchParams({
        h3res: '7',
        ...(timeParams as Record<string, string>),
      });

      console.log('[DASHBOARD] Fetching heatmap with params:', Object.fromEntries(params));
      const response = await fetch(`/api/heatmap?${params}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[DASHBOARD] Heatmap data received:', data.features?.length, 'features');
        setHeatmapData(data);
      } else {
        console.error('[DASHBOARD] Heatmap fetch failed:', response.status, response.statusText);
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
      const timeParams = getTimeWindowParams(timeWindow);
      const params = new URLSearchParams({
        sort: 'deviation',
        limit: '1000', // Increased from 100 to show all corridors
        ...(timeParams as Record<string, string>),
      });

      console.log('[DASHBOARD] Fetching corridors with params:', Object.fromEntries(params));
      const response = await fetch(`/api/corridors?${params}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[DASHBOARD] Corridors data received:', data.corridors?.length, 'corridors');
        setCorridors(data.corridors || []);
      } else {
        console.error('[DASHBOARD] Corridors fetch failed:', response.status, response.statusText);
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
    console.log('[DASHBOARD] View corridor:', corridor.corridorId);
    
    // Set selected corridor first
    setSelectedCorridor(corridor);
    
    // Switch to map tab after a brief delay to ensure state is set
    setTimeout(() => {
      setActiveTab('map');
    }, 50);
    
    // Keep selection active for longer (15 seconds instead of 5)
    setTimeout(() => {
      setSelectedCorridor(null);
    }, 15000);
  }

  function handleSimulationComplete() {
    console.log('[DASHBOARD] 🎉 Simulation complete, refreshing data...');
    
    // Mark simulation as complete
    setIsSimulating(false);
    
    // Trigger immediate refresh of heatmap and corridors
    setRefreshKey(prev => prev + 1);
    
    // Switch to map tab to show results
    setActiveTab('map');
  }

  function handleSimulationStart() {
    console.log('[DASHBOARD] 🚀 Simulation started...');
    setIsSimulating(true);
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Reset Loading Overlay */}
      {isResetting && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-2">Resetting System</h2>
            <p className="text-gray-600">Stopping simulator and clearing database...</p>
          </div>
        </div>
      )}
      
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
            
            <TabsContent value="map" className="flex-1 mt-4 h-full">
              <div className="h-full w-full">
                <MapView
                  heatmapData={heatmapData}
                  corridors={corridors}
                  selectedCorridor={selectedCorridor}
                  onHexClick={handleHexClick}
                  onCorridorClick={handleViewCorridor}
                  center={[3.1390, 101.6869]}
                  zoom={12}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="corridors" className="flex-1 mt-4 data-[state=active]:flex data-[state=active]:flex-col overflow-hidden">
              <div className="h-full overflow-hidden">
                <CorridorsTable
                  corridors={corridors}
                  onViewCorridor={handleViewCorridor}
                  isLoading={isLoadingCorridors}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Alerts Panel & Simulator */}
        <div className="w-96 flex flex-col gap-4 p-4 border-l bg-muted/30 overflow-hidden">
          {/* Database Stats - Fixed Height */}
          <div className="flex-shrink-0 h-auto max-h-48 overflow-auto">
            <DebugPanel />
          </div>
          
          {/* Alerts Panel - Fixed Height, Scrollable */}
          <div className="flex-shrink-0 h-64 overflow-auto">
            <AlertsPanel onAlertClick={handleAlertClick} />
          </div>
          
          {/* Simulator Controls - Fixed Height */}
          <div className="flex-shrink-0 h-auto overflow-auto">
            <SimulatorControls />
          </div>
        </div>
      </div>
    </div>
  );
}
