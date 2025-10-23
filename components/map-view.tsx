'use client';

/**
 * Map Component
 * Displays Leaflet map with H3 heatmap layer and corridor overlays
 */

import { useEffect, useRef, useState } from 'react';
import type { HeatmapData, Corridor } from '@/types';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  heatmapData: HeatmapData | null;
  corridors?: Corridor[];
  selectedCorridor?: Corridor | null;
  onHexClick?: (hexId: string, properties: any) => void;
  onCorridorClick?: (corridor: Corridor) => void;
  center?: [number, number];
  zoom?: number;
}

export function MapView({ 
  heatmapData, 
  corridors = [],
  selectedCorridor = null,
  onHexClick, 
  onCorridorClick,
  center = [3.1390, 101.6869], 
  zoom = 7 
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const heatmapLayerGroup = useRef<any>(null);
  const corridorLayerGroup = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [h3, setH3] = useState<any>(null);

  // Load Leaflet and H3 dynamically (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    Promise.all([
      import('leaflet'),
      import('h3-js')
    ]).then(([leaflet, h3Module]) => {
      setL(leaflet.default);
      setH3(h3Module);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!L || !mapContainer.current) return;
    if (map.current) return; // Map already initialized

    console.log('[MAP] Initializing Leaflet map...');

    // Create map
    map.current = L.map(mapContainer.current, {
      center: center as [number, number],
      zoom: zoom,
      zoomControl: true,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    // Create layer groups for hexagons and corridors
    heatmapLayerGroup.current = L.layerGroup().addTo(map.current);
    corridorLayerGroup.current = L.layerGroup().addTo(map.current);

    // Invalidate size to ensure proper rendering
    setTimeout(() => {
      if (map.current) {
        map.current.invalidateSize();
        console.log('[MAP] Map size invalidated');
      }
    }, 100);

    setMapLoaded(true);
    console.log('[MAP] Leaflet map initialized successfully');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [L]);

  // Update heatmap layer
  useEffect(() => {
    if (!L || !map.current || !mapLoaded) {
      console.log('[MAP] Not ready:', { LExists: !!L, mapExists: !!map.current, mapLoaded });
      return;
    }
    
    if (!heatmapData || !heatmapData.features || heatmapData.features.length === 0) {
      console.log('[MAP] No heatmap data available');
      if (heatmapLayerGroup.current) {
        heatmapLayerGroup.current.clearLayers();
      }
      return;
    }

    console.log('[MAP] Updating heatmap with', heatmapData.features.length, 'features');
    
    // Log sample features to understand the data
    if (heatmapData.features.length > 0) {
      console.log('[MAP] Sample features:', heatmapData.features.slice(0, 3).map((f: any) => ({
        hex: f.properties?.hex,
        instability: f.properties?.instability,
        traversals: f.properties?.traversals,
        shortDrops: f.properties?.shortDrops,
        longDrops: f.properties?.longDrops
      })));
    }

    // Clear existing layers
    if (heatmapLayerGroup.current) {
      heatmapLayerGroup.current.clearLayers();
    }

    // Filter features to show only reliable data
    const filteredFeatures = heatmapData.features.filter((feature: any) => {
      const traversals = feature.properties?.traversals || 0;
      const instability = feature.properties?.instability || 0;
      
      // Keep hexagons with at least 5 traversals (reliable data)
      // and reasonable instability values (< 50 - extreme outliers filtered)
      return traversals >= 5 && instability < 50;
    });

    console.log(`[MAP] Filtered features: ${filteredFeatures.length} of ${heatmapData.features.length} (removed ${heatmapData.features.length - filteredFeatures.length} outliers)`);

    if (filteredFeatures.length === 0) {
      console.log('[MAP] No features after filtering');
      return;
    }

    // Convert GeoJSON from [lng, lat] to [lat, lng] for Leaflet
    const leafletGeoJSON = {
      type: 'FeatureCollection',
      features: filteredFeatures.map((feature: any) => {
        if (feature.geometry.type === 'Polygon') {
          // Swap coordinates from [lng, lat] to [lat, lng]
          const swappedCoordinates = feature.geometry.coordinates.map((ring: any) =>
            ring.map((coord: number[]) => [coord[1], coord[0]])
          );
          
          return {
            ...feature,
            geometry: {
              ...feature.geometry,
              coordinates: swappedCoordinates
            }
          };
        }
        return feature;
      })
    };

    console.log('[MAP] First feature original coords:', heatmapData.features[0]?.geometry.coordinates[0]?.[0]);
    console.log('[MAP] First feature swapped coords:', leafletGeoJSON.features[0]?.geometry.coordinates[0]?.[0]);

    // Use GeoJSON layer directly - Leaflet native support
    const geojsonLayer = L.geoJSON(leafletGeoJSON as any, {
      style: (feature: any) => {
        const instability = feature?.properties?.instability || 0;
        
        // Determine color based on instability
        let fillColor: string;
        if (instability < 0.2) {
          fillColor = '#00ff00'; // Green
        } else if (instability < 0.5) {
          fillColor = '#ffff00'; // Yellow
        } else if (instability < 1) {
          fillColor = '#ffa500'; // Orange
        } else {
          fillColor = '#ff0000'; // Red
        }

        return {
          fillColor: fillColor,
          fillOpacity: 0.7,
          color: '#000000',
          weight: 2,
          opacity: 1,
        };
      },
      onEachFeature: (feature: any, layer: any) => {
        const hexId = feature.properties?.hex || 'unknown';
        const instability = feature.properties?.instability || 0;
        
        // Add popup
        layer.bindPopup(`
          <div style="padding: 8px;">
            <strong>Hex: ${hexId}</strong><br/>
            Instability: ${instability.toFixed(3)}<br/>
            Short Drops: ${feature.properties?.shortDrops || 0}<br/>
            Long Drops: ${feature.properties?.longDrops || 0}<br/>
            Traversals: ${feature.properties?.traversals || 0}
          </div>
        `);

        // Add click handler
        layer.on('click', () => {
          if (onHexClick) {
            onHexClick(hexId, feature.properties);
          }
        });
      }
    });

    // Add to layer group
    if (heatmapLayerGroup.current) {
      geojsonLayer.addTo(heatmapLayerGroup.current);
      console.log('[MAP] GeoJSON layer added to map');
    }

    // Fit map to bounds
    try {
      const bounds = geojsonLayer.getBounds();
      if (bounds.isValid()) {
        map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
        console.log('[MAP] ✅ Map fitted to bounds:', bounds);
      }
    } catch (error) {
      console.error('[MAP] Error fitting bounds:', error);
    }
  }, [L, mapLoaded, heatmapData, onHexClick]);

  // Update corridor layer
  useEffect(() => {
    if (!L || !h3 || !map.current || !mapLoaded || !corridors || corridors.length === 0) {
      console.log('[MAP] Corridors not ready or empty');
      if (corridorLayerGroup.current) {
        corridorLayerGroup.current.clearLayers();
      }
      return;
    }

    console.log('[MAP] Rendering', corridors.length, 'corridors', selectedCorridor ? '(with selected)' : '');
    
    // Log some sample corridor data to understand the values
    if (corridors.length > 0) {
      console.log('[MAP] Sample corridors:', corridors.slice(0, 5).map(c => ({
        count: c.count,
        deviation: c.deviationSec,
        median: c.medianSec,
        aH3: c.aH3,
        bH3: c.bH3
      })));
    }

    // Clear existing corridor layers
    if (corridorLayerGroup.current) {
      corridorLayerGroup.current.clearLayers();
    }

    let renderedCount = 0;
    let filteredCount = 0;
    const filterReasons: { [key: string]: number } = {
      lowTraversal: 0,
      extremeDeviation: 0,
      selfLoop: 0
    };

    corridors.forEach((corridor) => {
      try {
        // Skip self-loops (same cell)
        if (corridor.aH3 === corridor.bH3) {
          filteredCount++;
          filterReasons.selfLoop++;
          return;
        }

        // Filter out corridors with very few traversals (unreliable data)
        // Lower threshold since we have actual data
        if (corridor.count < 3) {
          filteredCount++;
          filterReasons.lowTraversal++;
          return;
        }

        // Skip corridors with unrealistic deviations
        // More lenient thresholds - check for extreme outliers only
        if (Math.abs(corridor.deviationSec) > 1800) { // 30 minutes
          filteredCount++;
          filterReasons.extremeDeviation++;
          return;
        }

        // Get center coordinates of both H3 cells
        const [aLat, aLng] = h3.cellToLatLng(corridor.aH3);
        const [bLat, bLng] = h3.cellToLatLng(corridor.bH3);

        // Determine color and weight based on deviation
        let color: string;
        let weight: number;
        
        // Highlight selected corridor
        const isSelected = selectedCorridor?.corridorId === corridor.corridorId;
        
        if (isSelected) {
          color = '#ff00ff'; // Magenta for selected
          weight = 10;
        } else if (corridor.deviationSec > 60) {
          color = '#ff0000'; // Red for high delays
          weight = 8;
        } else if (corridor.deviationSec > 30) {
          color = '#ffa500'; // Orange for medium delays
          weight = 6;
        } else if (corridor.deviationSec > 10) {
          color = '#ffff00'; // Yellow for small delays
          weight = 5;
        } else if (corridor.deviationSec < -10) {
          color = '#00ff00'; // Green for early
          weight = 5;
        } else {
          color = '#808080'; // Gray for on-time
          weight = 3;
        }

        // Create polyline for corridor
        const polyline = L.polyline([[aLat, aLng], [bLat, bLng]], {
          color: color,
          weight: weight,
          opacity: isSelected ? 1.0 : 0.7,
        });

        // Add popup
        polyline.bindPopup(`
          <div style="padding: 8px;">
            <strong>Corridor ${isSelected ? '(SELECTED)' : ''}</strong><br/>
            From: ${corridor.aH3}<br/>
            To: ${corridor.bH3}<br/>
            Traversals: ${corridor.count}<br/>
            Median: ${corridor.medianSec}s<br/>
            Deviation: ${corridor.deviationFormatted || corridor.deviationSec + 's'}<br/>
            Speed (P95): ${corridor.p95SpeedKmh.toFixed(1)} km/h
          </div>
        `);

        // Add click handler
        if (onCorridorClick) {
          polyline.on('click', () => {
            onCorridorClick(corridor);
          });
        }

        // Add to corridor layer group
        if (corridorLayerGroup.current) {
          polyline.addTo(corridorLayerGroup.current);
          renderedCount++;
          
          // Zoom to selected corridor
          if (isSelected && map.current) {
            const bounds = L.latLngBounds([[aLat, aLng], [bLat, bLng]]);
            map.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 12 });
            polyline.openPopup();
          }
        }
      } catch (error) {
        console.error('[MAP] Error rendering corridor:', corridor, error);
      }
    });

    console.log(`[MAP] ✅ Corridors rendered: ${renderedCount}, filtered out: ${filteredCount}`);
    console.log(`[MAP] Filter reasons:`, filterReasons);
  }, [L, h3, mapLoaded, corridors, onCorridorClick, selectedCorridor]);

  return (
    <div className="relative w-full h-full bg-gray-200">
      <div 
        ref={mapContainer} 
        className="absolute inset-0 z-0"
        style={{ minHeight: '400px' }}
      />
      
      {/* Loading indicator */}
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-sm text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      
      {/* No data message */}
      {mapLoaded && (!heatmapData || !heatmapData.features || heatmapData.features.length === 0) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="bg-black/80 text-white p-6 rounded-lg max-w-md text-center">
            <h3 className="font-semibold mb-2">No GPS Data Yet</h3>
            <p className="text-sm text-gray-300">
              Start the simulator and wait for GPS points to be processed. 
              The heatmap will appear once drops are detected.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Tip: Increase replay speed to 60× for faster results!
            </p>
          </div>
        </div>
      )}
      
      {/* Debug info */}
      <div className="absolute top-4 left-4 bg-black/70 text-white text-xs p-2 rounded z-[1000]">
        Leaflet: {L ? '✓' : '✗'} | 
        Map: {mapLoaded ? '✓' : '✗'} | 
        Features: {heatmapData?.features?.length || 0} | 
        Corridors: {corridors?.length || 0}
      </div>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-20">
        <h3 className="text-sm font-semibold mb-3">Hexagon Instability</h3>
        <div className="space-y-1 text-xs mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(0, 255, 0, 0.6)' }}></div>
            <span>Low (0 - 0.2)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 255, 0, 0.6)' }}></div>
            <span>Medium-Low (0.2 - 0.5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 165, 0, 0.6)' }}></div>
            <span>Medium (0.5 - 1.0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 0, 0, 0.6)' }}></div>
            <span>High (&gt; 1.0)</span>
          </div>
        </div>
        
        <h3 className="text-sm font-semibold mb-2 mt-3 pt-3 border-t">Corridor Delays</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-2" style={{ backgroundColor: '#ff0000' }}></div>
            <span>High Delay (&gt;60s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-1.5" style={{ backgroundColor: '#ffa500' }}></div>
            <span>Medium (30-60s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-1" style={{ backgroundColor: '#ffff00' }}></div>
            <span>Small (10-30s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1" style={{ backgroundColor: '#808080', opacity: 0.7 }}></div>
            <span>On-time (±10s)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-1" style={{ backgroundColor: '#00ff00' }}></div>
            <span>Early (&lt;-10s)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
