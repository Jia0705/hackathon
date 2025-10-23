/**
 * Test Heatmap Data
 * GET /api/test/heatmap - Check what heatmap data looks like
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('[HEATMAP-TEST] Checking heatmap data availability...');
    
    // Count drops
    const dropCount = await prisma.drop.count();
    console.log(`[HEATMAP-TEST] Total drops: ${dropCount}`);
    
    // Get sample drops
    const sampleDrops = await prisma.drop.findMany({
      take: 5,
      select: {
        id: true,
        startLat: true,
        startLon: true,
        endLat: true,
        endLon: true,
        durationSec: true,
        reason: true,
      },
    });
    
    // Count traversals
    const traversalCount = await prisma.traversal.count();
    console.log(`[HEATMAP-TEST] Total traversals: ${traversalCount}`);
    
    // Get sample traversals
    const sampleTraversals = await prisma.traversal.findMany({
      take: 5,
      select: {
        id: true,
        startLat: true,
        startLon: true,
        endLat: true,
        endLon: true,
        travelSec: true,
      },
    });
    
    // Try calling the actual heatmap API internally
    console.log('[HEATMAP-TEST] Calling heatmap API...');
    
    // Import and call directly instead of HTTP
    const { latLngToCell, cellToBoundary } = await import('h3-js');
    
    // Test H3 conversion with sample drop
    if (sampleDrops.length > 0) {
      try {
        const testDrop = sampleDrops[0];
        const testHex = latLngToCell(testDrop.startLat, testDrop.startLon, 7);
        const testBoundary = cellToBoundary(testHex, true);
        
        console.log('[HEATMAP-TEST] Test H3 conversion:');
        console.log(`  Input: lat=${testDrop.startLat}, lon=${testDrop.startLon}`);
        console.log(`  H3 Cell: ${testHex}`);
        console.log(`  Boundary points: ${testBoundary.length}`);
        
        return NextResponse.json({
          dropCount,
          sampleDrops,
          traversalCount,
          sampleTraversals,
          h3Test: {
            inputLat: testDrop.startLat,
            inputLon: testDrop.startLon,
            h3Cell: testHex,
            boundaryPoints: testBoundary.length,
            success: true,
          },
        });
      } catch (h3Error) {
        console.error('[HEATMAP-TEST] H3 conversion failed:', h3Error);
        
        return NextResponse.json({
          dropCount,
          sampleDrops,
          traversalCount,
          sampleTraversals,
          h3Test: {
            success: false,
            error: h3Error instanceof Error ? h3Error.message : 'H3 conversion failed',
          },
        });
      }
    }
    
    return NextResponse.json({
      dropCount,
      sampleDrops,
      traversalCount,
      sampleTraversals,
      h3Test: {
        success: false,
        error: 'No drops to test',
      },
    });
    
  } catch (error) {
    console.error('[HEATMAP-TEST] Error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
