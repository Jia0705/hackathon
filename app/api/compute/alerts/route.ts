/**
 * Check Alerts API
 * POST /api/compute/alerts - Check all corridors for alerts in batch
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkAndCreateAlerts } from '@/lib/alert-service';

export async function POST() {
  try {
    console.log('[ALERTS] Starting batch alert checking...');
    
    // Get recent traversals (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const traversals = await prisma.traversal.findMany({
      where: {
        startTs: {
          gte: oneDayAgo,
        },
      },
      include: {
        trip: true,
      },
      orderBy: {
        startTs: 'desc',
      },
    });
    
    console.log(`[ALERTS] Found ${traversals.length} recent traversals to check`);
    
    let checked = 0;
    let alertsCreated = 0;
    let errors = 0;
    
    for (const traversal of traversals) {
      try {
        const result = await checkAndCreateAlerts({
          corridorId: traversal.corridorId,
          tripId: traversal.tripId,
          vehicleId: traversal.trip.vehicleId,
          travelSec: traversal.travelSec,
          avgSpeedKmh: traversal.avgSpeedKmh || 0,
          timestamp: traversal.startTs,
        });
        
        if (result) {
          alertsCreated++;
        }
        
        checked++;
        
        if (checked % 50 === 0) {
          console.log(`[ALERTS] Checked ${checked}/${traversals.length} traversals, ${alertsCreated} alerts created`);
        }
      } catch (error) {
        console.error(`[ALERTS] Error checking traversal ${traversal.id}:`, error);
        errors++;
      }
    }
    
    console.log(`[ALERTS] ✅ Batch complete: ${checked} checked, ${alertsCreated} alerts created, ${errors} errors`);
    
    return NextResponse.json({
      ok: true,
      message: 'Alert checking complete',
      checked,
      alertsCreated,
      errors,
      total: traversals.length,
    });
    
  } catch (error) {
    console.error('[ALERTS] Batch checking failed:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to check alerts',
    }, { status: 500 });
  }
}
