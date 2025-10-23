/**
 * Compute Baselines API
 * POST /api/compute/baselines - Compute all corridor baselines in batch
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeBaselines } from '@/lib/baseline-computation';

export async function POST() {
  try {
    console.log('[BASELINES] Starting batch baseline computation...');
    
    // Get all corridors
    const corridors = await prisma.corridor.findMany({
      select: { id: true },
    });
    
    console.log(`[BASELINES] Found ${corridors.length} corridors to process`);
    
    let processed = 0;
    let errors = 0;
    
    for (const corridor of corridors) {
      try {
        // Get traversals for this corridor
        const traversals = await prisma.traversal.findMany({
          where: { corridorId: corridor.id },
          select: {
            travelSec: true,
            avgSpeedKmh: true,
            startTs: true,
          },
        });
        
        if (traversals.length === 0) {
          continue; // Skip corridors with no traversals
        }
        
        // Compute baselines
        const baselines = computeBaselines(
          corridor.id,
          traversals.map((t: any) => ({
            travelSec: t.travelSec,
            avgSpeedKmh: t.avgSpeedKmh || 0,
            startTs: t.startTs,
          }))
        );
        
        // Store baselines in database
        for (const baseline of baselines) {
          await prisma.corridorStats.upsert({
            where: {
              corridorId_bucketHour: {
                corridorId: baseline.corridorId,
                bucketHour: baseline.bucketHour,
              },
            },
            create: baseline,
            update: {
              count: baseline.count,
              medianTravelSec: baseline.medianTravelSec,
              p95SpeedKmh: baseline.p95SpeedKmh,
            },
          });
        }
        
        processed++;
        
        if (processed % 10 === 0) {
          console.log(`[BASELINES] Processed ${processed}/${corridors.length} corridors`);
        }
      } catch (error) {
        console.error(`[BASELINES] Error processing corridor ${corridor.id}:`, error);
        errors++;
      }
    }
    
    console.log(`[BASELINES] ✅ Batch complete: ${processed} processed, ${errors} errors`);
    
    return NextResponse.json({
      ok: true,
      message: 'Baseline computation complete',
      processed,
      errors,
      total: corridors.length,
    });
    
  } catch (error) {
    console.error('[BASELINES] Batch computation failed:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to compute baselines',
    }, { status: 500 });
  }
}
