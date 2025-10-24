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
  const hasInitialBounds = useRef<boolean>(false); // Track if we've set initial bounds
  const userHasInteracted = useRef<boolean>(false); // Track if user has zoomed/panned
  const lastSelectedCorridorId = useRef<string | null>(null); // Track last selected corridor
  const lastFeatureCount = useRef<number>(0); // Track feature count to detect data changes
  const mapSizeInvalidated = useRef<boolean>(false); // Track if map size was invalidated
  const corridorZoomActive = useRef<boolean>(false); // Track if we're zooming to a corridor

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

  // Clear corridorZoomActive flag when selectedCorridor becomes null
  useEffect(() => {
    if (selectedCorridor === null) {
      corridorZoomActive.current = false;
      console.log('[MAP] Cleared corridorZoomActive flag - selection ended');
    }
  }, [selectedCorridor]);

  // Initialize map
  useEffect(() => {
    if (!L || !mapContainer.current) return;
    if (map.current) return; // Map already initialized

    console.log('[MAP] Initializing Leaflet map...');

    // Create map
    map.current = L.map(mapContainer.current, {
      center: center as [number, number],
      zoom: 12, // Increased to 12 for closer initial view
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

    // Track user interactions (zoom/pan) to prevent auto-zoom
    map.current.on('zoomstart', () => {
      userHasInteracted.current = true;
      console.log('[MAP] User interacted - disabling auto-zoom');
    });
    
    map.current.on('dragstart', () => {
      userHasInteracted.current = true;
      console.log('[MAP] User panned - disabling auto-zoom');
    });

    // Invalidate size to ensure proper rendering
    setTimeout(() => {
      if (map.current) {
        map.current.invalidateSize();
        mapSizeInvalidated.current = true;
        console.log('[MAP] Map size invalidated on init');
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
      // Reset bounds tracking when no data
      hasInitialBounds.current = false;
      lastFeatureCount.current = 0;
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
      const shortDrops = feature.properties?.shortDrops || 0;
      const longDrops = feature.properties?.longDrops || 0;
      
      // Show hexagons that have drops OR traversals (more lenient)
      const hasData = traversals > 0 || shortDrops > 0 || longDrops > 0;
      
      // Filter extreme outliers only
      const reasonableInstability = instability < 100;
      
      return hasData && reasonableInstability;
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
        const shortDrops = feature?.properties?.shortDrops || 0;
        const longDrops = feature?.properties?.longDrops || 0;
        const totalDrops = shortDrops + longDrops;
        
        // Determine color based on drop count (GPS signal quality indicator)
        let fillColor: string;
        if (totalDrops === 0) {
          fillColor = '#00ff00'; // Green - no drops (excellent signal)
        } else if (totalDrops <= 2) {
          fillColor = '#90EE90'; // Light green - few drops (good signal)
        } else if (totalDrops <= 5) {
          fillColor = '#ffff00'; // Yellow - some drops (moderate signal)
        } else if (totalDrops <= 10) {
          fillColor = '#ffa500'; // Orange - many drops (poor signal)
        } else {
          fillColor = '#ff0000'; // Red - frequent drops (very poor signal)
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

    // Fit map to bounds only on initial load OR when data significantly changes
    // BUT: Don't auto-zoom if user has manually interacted with the map OR if corridor zoom is active
    const currentFeatureCount = filteredFeatures.length;
    const isFirstLoad = lastFeatureCount.current === 0 && currentFeatureCount > 0;
    const wasReset = lastFeatureCount.current > 100 && currentFeatureCount < 50; // Detect reset
    
    // Only auto-fit bounds on FIRST LOAD ONLY - never after that
    if (!hasInitialBounds.current && isFirstLoad && !userHasInteracted.current && !corridorZoomActive.current) {
      try {
        const bounds = geojsonLayer.getBounds();
        if (bounds.isValid()) {
          map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
          hasInitialBounds.current = true;
          lastFeatureCount.current = currentFeatureCount;
          console.log('[MAP] ✅ Initial map bounds set:', bounds, '(features:', currentFeatureCount, ')');
        }
      } catch (error) {
        console.error('[MAP] Error fitting bounds:', error);
      }
    } else {
      lastFeatureCount.current = currentFeatureCount;
      if (currentFeatureCount > 0) {
        const reason = corridorZoomActive.current ? 'corridor zoom active' : 
                       userHasInteracted.current ? 'user has interacted' : 
                       hasInitialBounds.current ? 'already initialized' : 'unknown';
        console.log('[MAP] Skipping fitBounds -', reason, `(${currentFeatureCount} features)`);
      }
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

    // Reset selected corridor tracking if no corridor is selected
    if (!selectedCorridor) {
      lastSelectedCorridorId.current = null;
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
        // TEMPORARILY DISABLED for debugging - show all corridors
        if (corridor.count < 1) {
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
        
        // Debug: Log first corridor coordinates
        if (renderedCount === 0) {
          console.log(`[MAP] First corridor coords: A(${aLat}, ${aLng}) -> B(${bLat}, ${bLng})`);
        }

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
          
          // Zoom to selected corridor (only if it's newly selected)
          if (isSelected && map.current && corridor.corridorId !== lastSelectedCorridorId.current) {
            console.log('[MAP] 🎯 Zooming to selected corridor:', corridor.corridorId);
            
            // Set corridor zoom flag to prevent heatmap from resetting zoom
            corridorZoomActive.current = true;
            
            // Calculate center point between A and B
            const centerLat = (aLat + bLat) / 2;
            const centerLng = (aLng + bLng) / 2;
            
            // Calculate appropriate zoom level based on distance
            const distance = Math.sqrt(
              Math.pow(aLat - bLat, 2) + Math.pow(aLng - bLng, 2)
            );
            
            // Adjust zoom based on corridor length
            // Reduced zoom levels so corridor takes ~50% of viewport (not full screen)
            let targetZoom = 12;
            if (distance < 0.01) {
              targetZoom = 12; // Very short corridor (reduced from 14)
            } else if (distance < 0.05) {
              targetZoom = 10; // Medium corridor (reduced from 12)
            } else {
              targetZoom = 8; // Long corridor (reduced from 10)
            }
            
            console.log(`[MAP] Corridor distance: ${distance.toFixed(4)}, target zoom: ${targetZoom}`);
            
            // Zoom to the corridor with smooth animation
            map.current.setView([centerLat, centerLng], targetZoom, {
              animate: true,
              duration: 0.5
            });
            
            // Mark as user interaction
            userHasInteracted.current = true;
            lastSelectedCorridorId.current = corridor.corridorId;
            
            // Open popup after animation completes
            setTimeout(() => {
              polyline.openPopup();
              // Don't clear corridor zoom flag immediately - it should stay active
              // for the duration of the selection (15 seconds)
            }, 600);
          }
        }
      } catch (error) {
        console.error('[MAP] Error rendering corridor:', corridor, error);
      }
    });

    console.log(`[MAP] ✅ Corridors rendered: ${renderedCount}, filtered out: ${filteredCount}`);
    console.log(`[MAP] Filter reasons:`, filterReasons);
    console.log(`[MAP] Total corridors to render: ${corridors.length}, Self-loops: ${filterReasons.selfLoop}, Low traversal (<1): ${filterReasons.lowTraversal}, Extreme deviation: ${filterReasons.extremeDeviation}`);
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
        <h3 className="text-sm font-semibold mb-3">GPS Drop Frequency</h3>
        <div className="space-y-1 text-xs mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(0, 255, 0, 0.7)' }}></div>
            <span>No Drops</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(144, 238, 144, 0.7)' }}></div>
            <span>Few (1-2 drops)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 255, 0, 0.7)' }}></div>
            <span>Some (3-5 drops)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 165, 0, 0.7)' }}></div>
            <span>Many (6-10 drops)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(255, 0, 0, 0.7)' }}></div>
            <span>Frequent (&gt;10 drops)</span>
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
