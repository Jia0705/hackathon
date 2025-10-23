/**
 * Data Ingestion API
 * POST /api/ingest - Accepts GPS data points, segments trips, detects drops
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { detectDrops, extractCorridors, GPSFix } from '@/lib/gps-processing';
import { computeBaselines } from '@/lib/baseline-computation';
import { checkAndCreateAlerts } from '@/lib/alert-service';

const GPS_POINT_SCHEMA = z.object({
  vehicleId: z.string(),
  tripId: z.string().optional(),
  ts: z.string().datetime(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speed: z.number().optional(),
  accuracy: z.number().optional(),
  heading: z.number().optional(),
});

const BATCH_SCHEMA = z.array(GPS_POINT_SCHEMA);

const TRIP_GAP_MINUTES = 20;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both single point and batch ingestion
    const points = Array.isArray(body) ? body : [body];
    const validatedPoints = BATCH_SCHEMA.parse(points);
    
    if (validatedPoints.length === 0) {
      return NextResponse.json({ error: 'No points provided' }, { status: 400 });
    }
    
    // Group by vehicle
    const byVehicle = new Map<string, typeof validatedPoints>();
    for (const point of validatedPoints) {
      if (!byVehicle.has(point.vehicleId)) {
        byVehicle.set(point.vehicleId, []);
      }
      byVehicle.get(point.vehicleId)!.push(point);
    }
    
    const results = [];
    
    for (const [vehicleId, vehiclePoints] of byVehicle.entries()) {
      // Ensure vehicle exists
      let vehicle = await prisma.vehicle.findUnique({ where: { name: vehicleId } });
      if (!vehicle) {
        vehicle = await prisma.vehicle.create({ data: { name: vehicleId } });
      }
      
      // Sort points by timestamp
      const sorted = vehiclePoints.sort(
        (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
      );
      
      // Segment into trips (gap > TRIP_GAP_MINUTES)
      const trips: typeof validatedPoints[] = [];
      let currentTrip: typeof validatedPoints = [];
      
      for (const point of sorted) {
        if (currentTrip.length === 0) {
          currentTrip.push(point);
          continue;
        }
        
        const lastPoint = currentTrip[currentTrip.length - 1];
        const gapMinutes = 
          (new Date(point.ts).getTime() - new Date(lastPoint.ts).getTime()) / 60000;
        
        if (gapMinutes > TRIP_GAP_MINUTES) {
          trips.push(currentTrip);
          currentTrip = [point];
        } else {
          currentTrip.push(point);
        }
      }
      
      if (currentTrip.length > 0) {
        trips.push(currentTrip);
      }
      
      // Process each trip
      for (const tripPoints of trips) {
        if (tripPoints.length < 2) continue; // Need at least 2 points
        
        const startTime = new Date(tripPoints[0].ts);
        const endTime = new Date(tripPoints[tripPoints.length - 1].ts);
        
        // Find or create trip
        let trip = tripPoints[0].tripId
          ? await prisma.trip.findUnique({ where: { id: tripPoints[0].tripId } })
          : null;
        
        if (!trip) {
          trip = await prisma.trip.create({
            data: {
              vehicleId: vehicle.id,
              startTime,
              endTime,
              source: 'api_ingest',
            },
          });
        } else {
          // Update trip end time
          await prisma.trip.update({
            where: { id: trip.id },
            data: { endTime },
          });
        }
        
        // Insert GPS points (batch)
        await prisma.gPSPoint.createMany({
          data: tripPoints.map(p => ({
            tripId: trip.id,
            ts: new Date(p.ts),
            lat: p.lat,
            lon: p.lon,
            speed: p.speed,
            accuracy: p.accuracy,
            heading: p.heading,
          })),
          skipDuplicates: true,
        });
        
        // Detect drops
        const gpsFixes: GPSFix[] = tripPoints.map(p => ({
          ts: new Date(p.ts),
          lat: p.lat,
          lon: p.lon,
          speed: p.speed,
          accuracy: p.accuracy,
          heading: p.heading,
        }));
        
        const tauShort = parseInt(process.env.TAU_SHORT || '60');
        const drops = detectDrops(gpsFixes, tauShort);
        
        // Store drops
        if (drops.length > 0) {
          await prisma.drop.createMany({
            data: drops.map(d => ({
              tripId: trip.id,
              startTs: d.startTs,
              endTs: d.endTs,
              startLat: d.startLat,
              startLon: d.startLon,
              endLat: d.endLat,
              endLon: d.endLon,
              durationSec: d.durationSec,
              reason: d.reason,
            })),
          });
        }
        
        // Extract corridors from drops
        const h3Res = parseInt(process.env.H3_RESOLUTION || '7');
        const traversals = extractCorridors(drops, h3Res);
        
        for (const traversal of traversals) {
          const { corridorKey, ...traversalData } = traversal;
          
          // Find or create corridor
          let corridor = await prisma.corridor.findUnique({
            where: {
              aH3_bH3_direction: {
                aH3: corridorKey.aH3,
                bH3: corridorKey.bH3,
                direction: corridorKey.direction,
              },
            },
          });
          
          if (!corridor) {
            corridor = await prisma.corridor.create({
              data: {
                aH3: corridorKey.aH3,
                bH3: corridorKey.bH3,
                direction: corridorKey.direction,
              },
            });
          }
          
          // Store traversal
          await prisma.traversal.create({
            data: {
              corridorId: corridor.id,
              tripId: trip.id,
              startTs: traversalData.startTs,
              endTs: traversalData.endTs,
              travelSec: traversalData.travelSec,
              avgSpeedKmh: traversalData.avgSpeedKmh,
              startLat: traversalData.startLat,
              startLon: traversalData.startLon,
              endLat: traversalData.endLat,
              endLon: traversalData.endLon,
            },
          });
          
          // Update corridor baselines (async job - could be queued)
          await updateCorridorBaselines(corridor.id);
          
          // Check for alerts
          await checkAndCreateAlerts({
            corridorId: corridor.id,
            tripId: trip.id,
            vehicleId: vehicle.id,
            travelSec: traversalData.travelSec,
            avgSpeedKmh: traversalData.avgSpeedKmh,
            timestamp: traversalData.startTs,
          });
        }
        
        results.push({
          tripId: trip.id,
          vehicleId: vehicle.id,
          pointsProcessed: tripPoints.length,
          dropsDetected: drops.length,
          corridorsTraversed: traversals.length,
        });
      }
    }
    
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('Ingestion error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Update corridor baselines after new traversals
 */
async function updateCorridorBaselines(corridorId: string) {
  const traversals = await prisma.traversal.findMany({
    where: { corridorId },
    select: {
      travelSec: true,
      avgSpeedKmh: true,
      startTs: true,
    },
  });
  
  if (traversals.length === 0) return;
  
  const baselines = computeBaselines(corridorId, traversals);
  
  // Upsert baselines
  for (const baseline of baselines) {
    await prisma.corridorStats.upsert({
      where: {
        corridorId_bucketHour: {
          corridorId: baseline.corridorId,
          bucketHour: baseline.bucketHour,
        },
      },
      create: {
        corridorId: baseline.corridorId,
        bucketHour: baseline.bucketHour,
        count: baseline.count,
        medianTravelSec: baseline.medianTravelSec,
        p95SpeedKmh: baseline.p95SpeedKmh,
      },
      update: {
        count: baseline.count,
        medianTravelSec: baseline.medianTravelSec,
        p95SpeedKmh: baseline.p95SpeedKmh,
      },
    });
  }
}
