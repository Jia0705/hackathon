/**
 * Corridors API
 * GET /api/corridors - Returns list of corridors with stats and live deviations
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getApplicableBaseline } from '@/lib/baseline-computation';
import { formatDuration } from '@/lib/baseline-computation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const sort = searchParams.get('sort') || 'count'; // count | deviation | median
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Build time filter
    const timeFilter: any = {};
    if (from) timeFilter.gte = new Date(from);
    if (to) timeFilter.lte = new Date(to);
    
    // Fetch corridors with their stats
    const corridors = await prisma.corridor.findMany({
      include: {
        stats: true,
        traversals: {
          where: timeFilter.gte || timeFilter.lte ? { startTs: timeFilter } : undefined,
          orderBy: { startTs: 'desc' },
          take: 1, // Get most recent traversal
        },
        _count: {
          select: {
            traversals: {
              where: timeFilter.gte || timeFilter.lte ? { startTs: timeFilter } : undefined,
            },
          },
        },
      },
    });
    
    // Calculate live deviations
    const enrichedCorridors = corridors
      .filter(c => c._count.traversals > 0) // Only corridors with data in time window
      .map(corridor => {
        const globalStats = corridor.stats.find(s => s.bucketHour === -1);
        const lastTraversal = corridor.traversals[0];
        
        let deviationSec = 0;
        if (globalStats && lastTraversal) {
          const applicableBaseline = getApplicableBaseline(
            corridor.stats,
            lastTraversal.startTs
          );
          
          if (applicableBaseline) {
            deviationSec = lastTraversal.travelSec - applicableBaseline.medianTravelSec;
          }
        }
        
        return {
          corridorId: corridor.id,
          aH3: corridor.aH3,
          bH3: corridor.bH3,
          direction: corridor.direction,
          count: corridor._count.traversals,
          medianSec: globalStats?.medianTravelSec || 0,
          p95SpeedKmh: globalStats?.p95SpeedKmh || 0,
          lastSeen: lastTraversal?.startTs.toISOString() || null,
          deviationSec,
          deviationFormatted: deviationSec !== 0 ? formatDuration(Math.abs(deviationSec)) : null,
          deviationSign: deviationSec > 0 ? '+' : deviationSec < 0 ? '-' : '',
        };
      });
    
    // Sort
    const sorted = enrichedCorridors.sort((a, b) => {
      switch (sort) {
        case 'deviation':
          return Math.abs(b.deviationSec) - Math.abs(a.deviationSec);
        case 'median':
          return b.medianSec - a.medianSec;
        case 'count':
        default:
          return b.count - a.count;
      }
    });
    
    return NextResponse.json({
      corridors: sorted.slice(0, limit),
      total: sorted.length,
    });
  } catch (error) {
    console.error('Corridors error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch corridors' },
      { status: 500 }
    );
  }
}
