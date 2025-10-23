/**
 * Test Alert Creation
 * GET /api/test/alert - Create a test alert to verify the alerts panel
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { alertEmitter } from '@/app/api/alerts/stream/route';

export async function GET() {
  try {
    console.log('[ALERT-TEST] Creating test alert...');
    
    // Get a corridor (or create one)
    let corridor = await prisma.corridor.findFirst();
    
    if (!corridor) {
      // Create test data
      const vehicle = await prisma.vehicle.upsert({
        where: { name: 'TEST_VEHICLE' },
        update: {},
        create: { name: 'TEST_VEHICLE' },
      });
      
      const trip = await prisma.trip.create({
        data: {
          vehicleId: vehicle.id,
          startTime: new Date(),
          endTime: new Date(),
          source: 'alert-test',
        },
      });
      
      corridor = await prisma.corridor.create({
        data: {
          aH3: '871969aa3ffffff',
          bH3: '871969aa7ffffff',
          direction: 3,
        },
      });
    }
    
    // Get or create a vehicle and trip
    const vehicle = await prisma.vehicle.findFirst() || await prisma.vehicle.create({
      data: { name: 'TEST_VEHICLE' },
    });
    
    const trip = await prisma.trip.findFirst({
      where: { vehicleId: vehicle.id },
    }) || await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        startTime: new Date(),
        endTime: new Date(),
        source: 'alert-test',
      },
    });
    
    // Create test alert
    const alert = await prisma.alert.create({
      data: {
        corridorId: corridor.id,
        tripId: trip.id,
        vehicleId: vehicle.id,
        type: 'delay',
        severity: 'high',
        time: new Date(),
        deltaValue: 300, // 5 minutes delay
        description: 'Test alert: Significant delay detected on corridor',
      },
      include: {
        corridor: true,
        trip: true,
        vehicle: true,
      },
    });
    
    console.log('[ALERT-TEST] ✅ Alert created:', alert.id);
    
    // Emit the alert to SSE listeners
    const alertMessage = {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      time: alert.time.toISOString(),
      vehicleId: alert.vehicleId,
      vehicleName: alert.vehicle.name,
      tripId: alert.tripId,
      corridorId: alert.corridorId,
      aH3: alert.corridor.aH3,
      bH3: alert.corridor.bH3,
      deltaValue: alert.deltaValue,
      description: alert.description,
      createdAt: alert.createdAt.toISOString(),
    };
    
    alertEmitter.emit(alertMessage);
    console.log('[ALERT-TEST] ✅ Alert emitted to SSE listeners');
    
    return NextResponse.json({
      success: true,
      message: 'Test alert created and emitted',
      alert: alertMessage,
    });
    
  } catch (error) {
    console.error('[ALERT-TEST] ❌ Failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
