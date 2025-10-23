/**
 * Test Database Write
 * GET /api/test/db-write - Test if we can write GPS points to database
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('[DB-WRITE-TEST] Starting database write test...');
    
    // Step 1: Create test vehicle
    console.log('[DB-WRITE-TEST] Step 1: Creating test vehicle...');
    let vehicle = await prisma.vehicle.findUnique({ where: { name: 'TEST_VEHICLE' } });
    if (!vehicle) {
      vehicle = await prisma.vehicle.create({ data: { name: 'TEST_VEHICLE' } });
    }
    console.log('[DB-WRITE-TEST] ✅ Vehicle created:', vehicle.id);
    
    // Step 2: Create test trip
    console.log('[DB-WRITE-TEST] Step 2: Creating test trip...');
    const trip = await prisma.trip.create({
      data: {
        vehicleId: vehicle.id,
        startTime: new Date(),
        endTime: new Date(),
        source: 'db-write-test',
      },
    });
    console.log('[DB-WRITE-TEST] ✅ Trip created:', trip.id);
    
    // Step 3: Try to insert GPS points
    console.log('[DB-WRITE-TEST] Step 3: Inserting GPS points...');
    const now = new Date();
    const gpsData = [
      {
        tripId: trip.id,
        ts: new Date(now.getTime()),
        lat: 3.1390,
        lon: 101.6869,
        speed: 45.0,
        accuracy: 5.0,
        heading: 90.0,
      },
      {
        tripId: trip.id,
        ts: new Date(now.getTime() + 60000),
        lat: 3.1395,
        lon: 101.6875,
        speed: 50.0,
        accuracy: 5.0,
        heading: 90.0,
      },
      {
        tripId: trip.id,
        ts: new Date(now.getTime() + 180000), // 3 minute gap = drop
        lat: 3.1400,
        lon: 101.6880,
        speed: 45.0,
        accuracy: 5.0,
        heading: 90.0,
      },
    ];
    
    console.log('[DB-WRITE-TEST] GPS data to insert:', JSON.stringify(gpsData, null, 2));
    
    const result = await prisma.gPSPoint.createMany({
      data: gpsData,
    });
    
    console.log('[DB-WRITE-TEST] ✅ Inserted GPS points:', result.count);
    
    // Step 4: Verify they were saved
    console.log('[DB-WRITE-TEST] Step 4: Verifying GPS points...');
    const savedPoints = await prisma.gPSPoint.findMany({
      where: { tripId: trip.id },
    });
    console.log('[DB-WRITE-TEST] ✅ Found GPS points in DB:', savedPoints.length);
    
    // Step 5: Check all counts
    const counts = {
      vehicles: await prisma.vehicle.count(),
      trips: await prisma.trip.count(),
      gpsPoints: await prisma.gPSPoint.count(),
    };
    console.log('[DB-WRITE-TEST] Final counts:', counts);
    
    return NextResponse.json({
      success: true,
      message: 'Database write test completed successfully',
      vehicleId: vehicle.id,
      tripId: trip.id,
      gpsPointsInserted: result.count,
      gpsPointsFound: savedPoints.length,
      counts,
    });
    
  } catch (error) {
    console.error('[DB-WRITE-TEST] ❌ Test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
