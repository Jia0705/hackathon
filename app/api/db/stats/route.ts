/**
 * Database Stats API
 * GET /api/db/stats - Get database statistics
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [
      vehicleCount,
      tripCount,
      gpsCount,
      dropCount,
      corridorCount,
      traversalCount,
      statsCount,
      alertCount,
    ] = await Promise.all([
      prisma.vehicle.count(),
      prisma.trip.count(),
      prisma.gPSPoint.count(),
      prisma.drop.count(),
      prisma.corridor.count(),
      prisma.traversal.count(),
      prisma.corridorStats.count(),
      prisma.alert.count(),
    ]);
    
    // Get drop breakdown by reason
    const dropsByReason = await prisma.drop.groupBy({
      by: ['reason'],
      _count: true,
    });
    
    // Get sample corridor if exists
    let sampleCorridor = null;
    if (corridorCount > 0) {
      const sample = await prisma.corridor.findFirst({
        include: {
          stats: {
            where: { bucketHour: -1 }, // Global stats
            take: 1,
          },
          _count: {
            select: { traversals: true },
          },
        },
      });
      
      if (sample) {
        sampleCorridor = {
          id: sample.id,
          aH3: sample.aH3,
          bH3: sample.bH3,
          direction: sample.direction,
          traversalCount: sample._count.traversals,
          medianTravelSec: sample.stats[0]?.medianTravelSec || null,
          p95SpeedKmh: sample.stats[0]?.p95SpeedKmh || null,
        };
      }
    }
    
    return NextResponse.json({
      ok: true,
      stats: {
        vehicles: vehicleCount,
        trips: tripCount,
        gpsPoints: gpsCount,
        drops: dropCount,
        corridors: corridorCount,
        traversals: traversalCount,
        corridorStats: statsCount,
        alerts: alertCount,
      },
      dropsByReason: dropsByReason.map((d: any) => ({
        reason: d.reason,
        count: d._count,
      })),
      sampleCorridor,
    });
  } catch (error) {
    console.error('[DB STATS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}
