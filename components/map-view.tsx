'use client';

/**
 * Map Component
 * Displays MapLibre GL map with H3 heatmap layer and corridor overlays
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { HeatmapData } from '@/types';

interface MapViewProps {
  heatmapData: HeatmapData | null;
  onHexClick?: (hexId: string, properties: any) => void;
  center?: [number, number];
  zoom?: number;
}

export function MapView({ heatmapData, onHexClick, center = [0, 0], zoom = 2 }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Map already initialized

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center,
      zoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update heatmap layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !heatmapData) return;

    const mapInstance = map.current;

    // Remove existing heatmap source and layer if they exist
    if (mapInstance.getLayer('heatmap-layer')) {
      mapInstance.removeLayer('heatmap-layer');
    }
    if (mapInstance.getLayer('heatmap-outline')) {
      mapInstance.removeLayer('heatmap-outline');
    }
    if (mapInstance.getSource('heatmap')) {
      mapInstance.removeSource('heatmap');
    }

    // Add heatmap source
    mapInstance.addSource('heatmap', {
      type: 'geojson',
      data: heatmapData,
    });

    // Add fill layer with color ramp based on instability
    mapInstance.addLayer({
      id: 'heatmap-layer',
      type: 'fill',
      source: 'heatmap',
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['get', 'instability'],
          0, 'rgba(0, 255, 0, 0.1)',      // Low instability - green
          0.2, 'rgba(255, 255, 0, 0.3)',  // Medium-low - yellow
          0.5, 'rgba(255, 165, 0, 0.5)',  // Medium - orange
          1, 'rgba(255, 0, 0, 0.7)',      // High instability - red
        ],
        'fill-opacity': 0.6,
      },
    });

    // Add outline layer
    mapInstance.addLayer({
      id: 'heatmap-outline',
      type: 'line',
      source: 'heatmap',
      paint: {
        'line-color': '#ffffff',
        'line-width': 1,
        'line-opacity': 0.3,
      },
    });

    // Add click handler
    mapInstance.on('click', 'heatmap-layer', (e) => {
      if (e.features && e.features.length > 0) {
        const feature = e.features[0];
        const hexId = feature.properties?.hex;
        if (hexId && onHexClick) {
          onHexClick(hexId, feature.properties);
        }

        // Show popup
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="padding: 8px;">
              <strong>Hex: ${hexId}</strong><br/>
              Instability: ${feature.properties?.instability?.toFixed(3)}<br/>
              Short Drops: ${feature.properties?.shortDrops}<br/>
              Long Drops: ${feature.properties?.longDrops}<br/>
              Traversals: ${feature.properties?.traversals}
            </div>
          `)
          .addTo(mapInstance);
      }
    });

    // Change cursor on hover
    mapInstance.on('mouseenter', 'heatmap-layer', () => {
      mapInstance.getCanvas().style.cursor = 'pointer';
    });

    mapInstance.on('mouseleave', 'heatmap-layer', () => {
      mapInstance.getCanvas().style.cursor = '';
    });
  }, [mapLoaded, heatmapData, onHexClick]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="text-sm font-semibold mb-2">Instability Score</h3>
        <div className="space-y-1 text-xs">
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
      </div>
    </div>
  );
}
