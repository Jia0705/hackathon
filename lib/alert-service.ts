/**
 * Alert Service
 * Handles alert creation and emission
 */

import { prisma } from './prisma';
import { getApplicableBaseline, checkDelayAlert, checkOverspeedAlert } from './baseline-computation';
import { getAlertSeverity } from './gps-processing';
import { alertEmitter } from '@/app/api/alerts/stream/route';

export interface AlertInput {
  corridorId: string;
  tripId: string;
  vehicleId: string;
  travelSec: number;
  avgSpeedKmh: number;
  timestamp: Date;
}

/**
 * Check traversal against baselines and create alerts if needed
 */
export async function checkAndCreateAlerts(input: AlertInput) {
  const { corridorId, tripId, vehicleId, travelSec, avgSpeedKmh, timestamp } = input;
  
  // Fetch corridor baselines
  const baselines = await prisma.corridorStats.findMany({
    where: { corridorId },
  });
  
  if (baselines.length === 0) return; // No baseline yet
  
  const applicableBaseline = getApplicableBaseline(baselines, timestamp);
  if (!applicableBaseline) return;
  
  const delayThresholdMin = parseInt(process.env.DELAY_THRESHOLD_MINUTES || '15');
  const alerts = [];
  
  // Check for delay alert
  const delayCheck = checkDelayAlert(travelSec, applicableBaseline, delayThresholdMin);
  if (delayCheck.isAlert) {
    // Check if alert already exists for this trip+corridor (deduplication)
    const existing = await prisma.alert.findFirst({
      where: {
        type: 'delay',
        tripId,
        corridorId,
        resolvedAt: null,
      },
    });
    
    if (!existing) {
      const severity = getAlertSeverity('delay', delayCheck.deltaSec, delayThresholdMin * 60);
      
      const alert = await prisma.alert.create({
        data: {
          type: 'delay',
          corridorId,
          tripId,
          vehicleId,
          severity,
          deltaValue: delayCheck.deltaSec,
          details: JSON.stringify({
            travelSec,
            baselineMedianSec: applicableBaseline.medianTravelSec,
            bucketHour: applicableBaseline.bucketHour,
          }),
        },
        include: {
          corridor: true,
          trip: true,
          vehicle: true,
        },
      });
      
      alerts.push(alert);
      
      // Emit to SSE clients
      alertEmitter.emit(alert);
    }
  }
  
  // Check for overspeed alert
  const overspeedCheck = checkOverspeedAlert(avgSpeedKmh, applicableBaseline);
  if (overspeedCheck.isAlert) {
    const existing = await prisma.alert.findFirst({
      where: {
        type: 'overspeed',
        tripId,
        corridorId,
        resolvedAt: null,
      },
    });
    
    if (!existing) {
      const severity = getAlertSeverity(
        'overspeed',
        overspeedCheck.deltaSpeedKmh,
        applicableBaseline.p95SpeedKmh * 0.1 // 10% threshold
      );
      
      const alert = await prisma.alert.create({
        data: {
          type: 'overspeed',
          corridorId,
          tripId,
          vehicleId,
          severity,
          deltaValue: overspeedCheck.deltaSpeedKmh,
          details: JSON.stringify({
            avgSpeedKmh,
            p95SpeedKmh: applicableBaseline.p95SpeedKmh,
            bucketHour: applicableBaseline.bucketHour,
          }),
        },
        include: {
          corridor: true,
          trip: true,
          vehicle: true,
        },
      });
      
      alerts.push(alert);
      
      // Emit to SSE clients
      alertEmitter.emit(alert);
    }
  }
  
  return alerts;
}
