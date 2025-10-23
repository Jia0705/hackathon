/**
 * Heatmap API
 * GET /api/heatmap - Returns GeoJSON of H3 hexes with instability scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { cellToBoundary } from 'h3-js';
import { prisma } from '@/lib/prisma';
import { calculateInstabilityScore } from '@/lib/gps-processing';

interface HexStats {
  shortDrops: number;
  longDrops: number;
  traversals: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const h3res = parseInt(searchParams.get('h3res') || '7');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    
    console.log(`[HEATMAP] Generating heatmap - h3res:${h3res}, from:${from}, to:${to}`);
    
    // Build time filter
    const timeFilter: any = {};
    if (from) timeFilter.gte = new Date(from);
    if (to) timeFilter.lte = new Date(to);
    
    // Fetch all drops in time window
    const drops = await prisma.drop.findMany({
      where: timeFilter.gte || timeFilter.lte ? { startTs: timeFilter } : undefined,
      select: {
        startLat: true,
        startLon: true,
        endLat: true,
        endLon: true,
        durationSec: true,
        reason: true,
      },
    });
    
    // Aggregate by hex
    const { latLngToCell } = await import('h3-js');
    const hexStats = new Map<string, HexStats>();
    const tauShort = parseInt(process.env.TAU_SHORT || '60');
    
    console.log(`[HEATMAP] Processing ${drops.length} drops with TAU_SHORT=${tauShort}`);
    
    for (const drop of drops) {
      try {
        // Attribute drop to both start and end hexes
        const startHex = latLngToCell(drop.startLat, drop.startLon, h3res);
        const endHex = latLngToCell(drop.endLat, drop.endLon, h3res);
        
        const isShort = drop.durationSec <= tauShort * 1.5;
        
        for (const hex of [startHex, endHex]) {
          if (!hexStats.has(hex)) {
            hexStats.set(hex, { shortDrops: 0, longDrops: 0, traversals: 0 });
          }
          
          const stats = hexStats.get(hex)!;
          if (isShort) {
            stats.shortDrops++;
          } else {
            stats.longDrops++;
          }
        }
      } catch (error) {
        console.error(`[HEATMAP] Error processing drop at (${drop.startLat}, ${drop.startLon}):`, error);
      }
    }
    
    console.log(`[HEATMAP] Created ${hexStats.size} hex cells from drops`);
    
    // Also count traversals through each hex
    const traversals = await prisma.traversal.findMany({
      where: timeFilter.gte || timeFilter.lte ? { startTs: timeFilter } : undefined,
      select: {
        startLat: true,
        startLon: true,
        endLat: true,
        endLon: true,
      },
    });
    
    for (const traversal of traversals) {
      try {
        const startHex = latLngToCell(traversal.startLat, traversal.startLon, h3res);
        const endHex = latLngToCell(traversal.endLat, traversal.endLon, h3res);
        
        for (const hex of [startHex, endHex]) {
          if (!hexStats.has(hex)) {
            hexStats.set(hex, { shortDrops: 0, longDrops: 0, traversals: 0 });
          }
          hexStats.get(hex)!.traversals++;
        }
      } catch (error) {
        console.error(`[HEATMAP] Error processing traversal at (${traversal.startLat}, ${traversal.startLon}):`, error);
      }
    }
    
    console.log(`[HEATMAP] Final hex count after traversals: ${hexStats.size}`);
    
    // Build GeoJSON
    const features = [];
    
    console.log(`[HEATMAP] Building GeoJSON from ${hexStats.size} hex cells`);
    
    for (const [hex, stats] of hexStats.entries()) {
      try {
        const boundary = cellToBoundary(hex, true); // [lat, lon] format
        
        // Convert to GeoJSON Polygon coordinates [lon, lat] and close the ring
        const ring = boundary.map(([lat, lon]) => [lon, lat]);
        ring.push(ring[0]); // Close the polygon
        const coordinates = [ring];
        
        const instability = calculateInstabilityScore(
          stats.shortDrops,
          stats.longDrops,
          stats.traversals
        );
        
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates,
          },
          properties: {
            hex,
            instability,
            shortDrops: stats.shortDrops,
            longDrops: stats.longDrops,
            traversals: stats.traversals,
          },
        });
      } catch (error) {
        console.error(`[HEATMAP] Error building feature for hex ${hex}:`, error);
      }
    }
    
    const geojson = {
      type: 'FeatureCollection',
      features,
    };
    
    console.log(`[HEATMAP] Generated ${features.length} hex features`);
    
    return NextResponse.json(geojson, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error('Heatmap error:', error);
    return NextResponse.json(
      { error: 'Failed to generate heatmap' },
      { status: 500 }
    );
  }
}
